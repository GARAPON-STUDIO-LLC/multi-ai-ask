import path from 'node:path';
import fs from 'node:fs';
import { chromium, type BrowserContext, type Page } from 'playwright';

export const PROFILE_DIR = path.join(process.cwd(), '.browser-profile');
export const SCREENSHOT_DIR = path.join(process.cwd(), '.screenshots');

/** ヘッドあり/なしは環境変数で切替（既定はヘッドあり：Bot 検知緩和のため）。 */
const HEADLESS = process.env.HEADLESS === 'true';

// Next.js の HMR で複数回 import されてもブラウザを使い回すため globalThis に保持する。
interface BrowserGlobal {
  context: BrowserContext | null;
  // キーはサービス ID が基本だが、分析用の 'analysis' など任意のページキーも持てる。
  pages: Map<string, Page>;
  launching: Promise<BrowserContext> | null;
}
const g = globalThis as unknown as { __multiAiBrowser?: BrowserGlobal };
const store: BrowserGlobal = (g.__multiAiBrowser ??= { context: null, pages: new Map(), launching: null });

/** 永続コンテキスト（ログインセッションを .browser-profile に保存）を取得（無ければ起動）。 */
export async function getContext(): Promise<BrowserContext> {
  if (store.context) return store.context;
  if (store.launching) return store.launching;

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  store.launching = chromium
    .launchPersistentContext(PROFILE_DIR, {
      headless: HEADLESS,
      viewport: { width: 1280, height: 900 },
      // 自動操作を悟られにくくする最小限の指定
      args: ['--disable-blink-features=AutomationControlled'],
      locale: 'ja-JP',
    })
    .then((ctx) => {
      store.context = ctx;
      store.launching = null;
      ctx.on('close', () => {
        store.context = null;
        store.pages.clear();
      });
      return ctx;
    });

  return store.launching;
}

/**
 * サービスごとに 1 枚の page を確保する。既存があれば再利用する。
 * url が指定されていて、まだそのページが開かれていなければ遷移する。
 */
export async function getPage(key: string, url: string): Promise<Page> {
  const ctx = await getContext();
  let page = store.pages.get(key);
  if (page && !page.isClosed()) return page;

  page = await ctx.newPage();
  store.pages.set(key, page);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  return page;
}

/** 新しい質問のために、対象ページを URL に作り直す（会話をリセット）。 */
export async function resetPage(key: string, url: string): Promise<Page> {
  const existing = store.pages.get(key);
  if (existing && !existing.isClosed()) {
    await existing.close().catch(() => {});
  }
  store.pages.delete(key);
  return getPage(key, url);
}

/** デバッグ用スクリーンショットを保存し、パスを返す。 */
export async function saveScreenshot(page: Page, name: string): Promise<string | null> {
  try {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const file = path.join(SCREENSHOT_DIR, `${name}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch {
    return null;
  }
}
