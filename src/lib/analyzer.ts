import type { Page } from 'playwright';
import { claudeAdapter } from './adapters/claude';
import type { ServiceStatus } from './adapters/types';
import { resetPage, saveScreenshot } from './browser';

/** 分析パネル1本分の進行イベント（サービスの AskEvent と別枠。ServiceId を汚さない）。 */
export interface AnalysisEvent {
  status: ServiceStatus;
  /** generating / done のときの分析全文 */
  text?: string;
  /** error のときのメッセージ */
  error?: string;
  /** error のときのスクショパス（あれば） */
  screenshot?: string;
}

/** 分析対象の1回答。 */
export interface AnswerInput {
  name: string;
  text: string;
}

/** 回答が長すぎるとプロンプトが肥大化するため、1件あたりの上限で切り詰める。 */
const MAX_PER_ANSWER = 4000;

/** 分析ページのキー（回答用の 'claude' ページとは別タブにして干渉を避ける）。 */
const ANALYSIS_PAGE_KEY = 'analysis';

/** 4回答を比較・分析させる合成プロンプトを日本語で組み立てる。 */
export function buildAnalysisPrompt(question: string, answers: AnswerInput[]): string {
  const blocks = answers
    .map((a) => {
      const t = a.text.length > MAX_PER_ANSWER ? a.text.slice(0, MAX_PER_ANSWER) + '\n…（以下略）' : a.text;
      return `## ${a.name}\n${t}`;
    })
    .join('\n\n');

  return [
    '以下は、同じ質問に対する複数の AI サービスの回答です。これらを読み比べて分析してください。',
    '',
    '# 質問',
    question,
    '',
    '# 各サービスの回答',
    blocks,
    '',
    '# 依頼',
    '次の観点で、日本語で簡潔に分析してください（Markdown の見出しと箇条書きで整理）。',
    '1. **共通点** — 各回答が一致している点',
    '2. **相違点** — 回答が食い違う点・そのサービスにしかない主張',
    '3. **各回答の特徴** — それぞれの強み・弱み・スタンスの違い',
    '4. **総合的な結論** — 最も妥当な見解、または回答同士が補完し合う点',
    '',
    '各サービスの回答本文をそのまま長く引用せず、要点を抽出して比較してください。',
  ].join('\n');
}

/**
 * 4回答を Claude（分析専用ページ）に投げ、比較分析をストリームする。
 * orchestrator.runService と同じ進行（connecting→submitting→generating→done）を踏むが、
 * 単一アダプタ（Claude）を専用ページで動かす点だけが異なる。
 */
export async function* analyzeAnswers(question: string, answers: AnswerInput[]): AsyncGenerator<AnalysisEvent> {
  const prompt = buildAnalysisPrompt(question, answers);
  let page: Page | null = null;
  try {
    yield { status: 'connecting' };
    page = await resetPage(ANALYSIS_PAGE_KEY, claudeAdapter.url);

    const { ready } = await claudeAdapter.ensureReady(page);
    if (!ready) {
      yield { status: 'need_login' };
      return;
    }

    yield { status: 'submitting' };
    await claudeAdapter.submit(page, prompt);

    yield { status: 'generating', text: '' };
    let last = '';
    for await (const text of claudeAdapter.streamResponse(page)) {
      last = text;
      yield { status: 'generating', text };
    }
    yield { status: 'done', text: last };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const shot = page ? await saveScreenshot(page, 'analysis') : null;
    yield { status: 'error', error: message, screenshot: shot ?? undefined };
  }
}
