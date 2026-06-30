import type { Page } from 'playwright';
import type { AIServiceAdapter, ServiceId } from './types';
import type { SiteSelectors } from './selectors';
import { anyVisible, firstVisible, humanType, isLoggedOut, streamUntilStable, waitForAny } from './helpers';

interface ChatAdapterConfig {
  id: ServiceId;
  name: string;
  url: string;
  enabled: boolean;
  selectors: SiteSelectors;
  /** Enter で送信できるか（false なら送信ボタンを押す）。既定 true。 */
  submitWithEnter?: boolean;
}

/** 最後にマッチした要素のテキストを返す（回答は通常いちばん下に追記されるため）。 */
async function readLast(page: Page, selectors: string[]): Promise<string> {
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel);
      const n = await loc.count();
      if (n > 0) return (await loc.nth(n - 1).innerText()).trim();
    } catch {
      /* noop */
    }
  }
  return '';
}

/**
 * claude / chatgpt / gemini のような「contenteditable に入力 → 送信 → 最後の回答が
 * ストリーミングされる」共通パターンを実装する汎用アダプタ。
 */
export function makeChatAdapter(cfg: ChatAdapterConfig): AIServiceAdapter {
  const sel = cfg.selectors;
  return {
    id: cfg.id,
    name: cfg.name,
    url: cfg.url,
    enabled: cfg.enabled,

    async ensureReady(page: Page) {
      // composer が現れるのを待つ。出なければログイン判定。
      const ok = await waitForAny(page, sel.composer, 12_000);
      if (ok) return { ready: true };
      const loggedOut = await isLoggedOut(page, sel);
      return { ready: !loggedOut };
    },

    async submit(page: Page, prompt: string) {
      const composer = await firstVisible(page, sel.composer);
      if (!composer) throw new Error(`${cfg.name}: 入力欄が見つかりません`);
      await humanType(composer, prompt);

      if (cfg.submitWithEnter ?? true) {
        await composer.press('Enter');
      } else {
        const send = await firstVisible(page, sel.sendButton);
        if (!send) throw new Error(`${cfg.name}: 送信ボタンが見つかりません`);
        await send.click();
      }
    },

    async *streamResponse(page: Page) {
      yield* streamUntilStable({
        readText: () => readLast(page, sel.assistantMessage),
        isGenerating: () => anyVisible(page, sel.generatingIndicator),
      });
    },
  };
}
