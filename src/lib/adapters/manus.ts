import type { Page } from 'playwright';
import type { AIServiceAdapter } from './types';
import { SELECTORS } from './selectors';
import { anyVisible, bodyIncludes, firstVisible, humanType, streamUntilStable } from './helpers';

/**
 * Manus アダプタ。
 *
 * Manus は非同期エージェント基盤で、回答完了までに数分かかる。chat 系（claude/chatgpt/
 * gemini）と違い「生成停止ボタンが消える」だけでは完了と判断できない（スピナーはステップ間で
 * 一時的に消える）。そこで完了検知は次の 2 条件の AND で行う:
 *   1. スピナー（animate-spin）が出ていない
 *   2. 本文に完了文言「タスクが完了しました」が出ている
 * どちらか一方だけでは途中のステップ完了を誤って拾うため、両方をそろえて完了とする。
 *
 * 実 DOM は `npm run debug:manus` の診断で確認済み（selectors.ts の manus を参照）。
 */
const sel = SELECTORS.manus;
const COMPLETION = sel.completionText ?? ['タスクが完了しました'];

/** 左チャット領域の最後の markdown（＝最終回答）テキストを返す。途中はステップ経過が入る。 */
async function readAnswer(page: Page): Promise<string> {
  for (const s of sel.assistantMessage) {
    try {
      const loc = page.locator(s);
      const n = await loc.count();
      if (n > 0) return (await loc.nth(n - 1).innerText()).trim();
    } catch {
      /* noop */
    }
  }
  return '';
}

export const manusAdapter: AIServiceAdapter = {
  id: 'manus',
  name: 'Manus',
  url: 'https://manus.im/',
  enabled: true,

  async ensureReady(page: Page) {
    // manus.im はログイン済みなら /app にリダイレクトされ tiptap 入力欄が出る。
    // 未ログインだと /login に飛ぶ。セッション復元に時間がかかるので長めに待つ。
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (await anyVisible(page, sel.composer)) return { ready: true };
      // /login にリダイレクトされた or ログイン文言が見えたら未ログイン確定。
      if (page.url().includes('/login') || (await anyVisible(page, sel.loginIndicator))) {
        return { ready: false };
      }
      await page.waitForTimeout(500);
    }
    return { ready: false };
  },

  async submit(page: Page, prompt: string) {
    const composer = await firstVisible(page, sel.composer);
    if (!composer) throw new Error('Manus: 入力欄が見つかりません');
    await humanType(composer, prompt);

    // 初回ロード直後は入力を取りこぼすことがあるため、反映を確認して1回だけ再試行する。
    const typed = await composer
      .evaluate((el) => (el as HTMLElement).innerText || (el as HTMLInputElement).value || '')
      .catch(() => '');
    if (!typed.trim()) {
      await humanType(composer, prompt);
    }

    // Manus は Enter で送信でき、送信すると /app/<taskId> に遷移する。
    await composer.press('Enter');
  },

  async *streamResponse(page: Page) {
    // Manus はタスクが数分に及ぶため、chat 系より長い timeout / stable を使う。
    yield* streamUntilStable({
      readText: () => readAnswer(page),
      // スピナーが出ている、または完了文言がまだ無い間は「生成中」とみなす。
      // => スピナー消滅 かつ 完了文言出現 の両方がそろって初めて完了に進む。
      isGenerating: async () =>
        (await anyVisible(page, sel.generatingIndicator)) || !(await bodyIncludes(page, COMPLETION)),
      stableMs: 2_500,
      // 完了文言ベースで判定するため、インジケータ不検知フォールバックは効かせない
      // （回答テキストが長時間安定でも、完了文言が出るまでは待つ）。
      longStableMs: Number.POSITIVE_INFINITY,
      pollMs: 1_500,
      timeoutMs: 600_000,
    });
  },
};
