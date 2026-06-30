import type { Locator, Page } from 'playwright';
import type { SiteSelectors } from './selectors';

/** 候補セレクタのうち、最初に DOM 上に存在するものの Locator を返す（無ければ null）。 */
export async function firstVisible(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    try {
      if (await loc.count()) return loc;
    } catch {
      // 無効なセレクタはスキップ
    }
  }
  return null;
}

/** いずれかの候補セレクタが visible になるまで待つ。timeout で false。 */
export async function waitForAny(page: Page, selectors: string[], timeout = 15_000): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      try {
        if (await page.locator(sel).first().isVisible()) return true;
      } catch {
        /* noop */
      }
    }
    await page.waitForTimeout(250);
  }
  return false;
}

/** 未ログイン判定。loginIndicator が見えていて composer が無ければ未ログイン。 */
export async function isLoggedOut(page: Page, sel: SiteSelectors): Promise<boolean> {
  const composer = await firstVisible(page, sel.composer);
  if (composer) return false; // 入力欄があるならログイン済みとみなす
  for (const s of sel.loginIndicator) {
    try {
      if (await page.locator(s).first().isVisible()) return true;
    } catch {
      /* noop */
    }
  }
  return false;
}

/** 人間らしく1文字ずつ入力する（Bot 検知緩和）。 */
export async function humanType(locator: Locator, text: string): Promise<void> {
  await locator.click();
  await locator.pressSequentially(text, { delay: 12 });
}

interface StreamOptions {
  /** 最新の回答テキストを返す関数 */
  readText: () => Promise<string>;
  /** 生成中かどうかを返す関数 */
  isGenerating: () => Promise<boolean>;
  /** 生成インジケータが消えたあと、テキストがこの時間変化しなければ完了（ms） */
  stableMs?: number;
  /**
   * 生成インジケータが信頼できない（取れない/誤検知で消えない）場合の保険。
   * 回答が出ていて、テキストがこの時間変化しなければインジケータに関係なく完了とみなす（ms）。
   */
  longStableMs?: number;
  /** ポーリング間隔（ms） */
  pollMs?: number;
  /** 全体のタイムアウト（ms） */
  timeoutMs?: number;
}

/**
 * 回答が完了するまでテキストをポーリングして yield する汎用ジェネレータ。
 * 「生成インジケータが消える」かつ「テキストが stableMs 間変化しない」で完了とみなす。
 */
export async function* streamUntilStable(opts: StreamOptions): AsyncGenerator<string> {
  const stableMs = opts.stableMs ?? 1500;
  const longStableMs = opts.longStableMs ?? 4000;
  const pollMs = opts.pollMs ?? 400;
  const timeoutMs = opts.timeoutMs ?? 180_000;

  const start = Date.now();
  let last = '';
  let lastChangeAt = Date.now();
  let sawGenerating = false;

  while (Date.now() - start < timeoutMs) {
    const [text, generating] = await Promise.all([opts.readText(), opts.isGenerating()]);
    if (generating) sawGenerating = true;

    if (text && text !== last) {
      last = text;
      lastChangeAt = Date.now();
      yield text;
    }

    const idleMs = Date.now() - lastChangeAt;
    // 通常完了: 生成インジケータが消え、かつテキストが stableMs 安定したら完了。
    if (!generating && idleMs >= stableMs && (sawGenerating || last.length > 0)) {
      return;
    }
    // 保険: インジケータが信頼できなくても、回答が出ていて longStableMs 安定したら完了。
    if (last.length > 0 && idleMs >= longStableMs) {
      return;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

/** Locator のテキストを安全に取得（無ければ空文字）。 */
export async function safeText(page: Page, selectors: string[]): Promise<string> {
  const loc = await firstVisible(page, selectors);
  if (!loc) return '';
  try {
    return (await loc.innerText()).trim();
  } catch {
    return '';
  }
}

/** いずれかのセレクタが今 visible かを返す。 */
export async function anyVisible(page: Page, selectors: string[]): Promise<boolean> {
  for (const s of selectors) {
    try {
      if (await page.locator(s).first().isVisible()) return true;
    } catch {
      /* noop */
    }
  }
  return false;
}
