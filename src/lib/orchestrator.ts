import type { Page } from 'playwright';
import { ENABLED_ADAPTERS } from './adapters';
import type { AIServiceAdapter, ServiceId, ServiceStatus } from './adapters/types';
import { resetPage, saveScreenshot } from './browser';

export interface AskEvent {
  service: ServiceId;
  name: string;
  status: ServiceStatus;
  /** generating / done のときの回答全文 */
  text?: string;
  /** error のときのメッセージ */
  error?: string;
  /** error のときのスクショパス（あれば） */
  screenshot?: string;
}

type Emit = (e: AskEvent) => void;

/** 1サービス分を実行し、進行に応じてイベントを emit する。 */
async function runService(adapter: AIServiceAdapter, prompt: string, emit: Emit): Promise<void> {
  const base = { service: adapter.id, name: adapter.name };
  let page: Page | null = null;
  try {
    emit({ ...base, status: 'connecting' });
    page = await resetPage(adapter.id, adapter.url);

    const { ready } = await adapter.ensureReady(page);
    if (!ready) {
      emit({ ...base, status: 'need_login' });
      return;
    }

    emit({ ...base, status: 'submitting' });
    await adapter.submit(page, prompt);

    emit({ ...base, status: 'generating', text: '' });
    let lastText = '';
    for await (const text of adapter.streamResponse(page)) {
      lastText = text;
      emit({ ...base, status: 'generating', text });
    }
    emit({ ...base, status: 'done', text: lastText });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const shot = page ? await saveScreenshot(page, adapter.id) : null;
    emit({ ...base, status: 'error', error: message, screenshot: shot ?? undefined });
  }
}

/**
 * 有効な全アダプタに並列で質問を投げ、各サービスのイベントを発生順に1本のストリームに
 * マージして yield する。
 */
export async function* askAll(prompt: string): AsyncGenerator<AskEvent> {
  const queue: AskEvent[] = [];
  let wake: (() => void) | null = null;
  let active = ENABLED_ADAPTERS.length;

  const push: Emit = (e) => {
    queue.push(e);
    wake?.();
    wake = null;
  };

  for (const adapter of ENABLED_ADAPTERS) {
    runService(adapter, prompt, push).finally(() => {
      active -= 1;
      wake?.();
      wake = null;
    });
  }

  while (active > 0 || queue.length > 0) {
    if (queue.length > 0) {
      yield queue.shift()!;
      continue;
    }
    await new Promise<void>((r) => {
      wake = r;
    });
  }
}

/** UI が初期表示に使う、有効サービスの一覧。 */
export function enabledServices() {
  return ENABLED_ADAPTERS.map((a) => ({ id: a.id, name: a.name, url: a.url }));
}
