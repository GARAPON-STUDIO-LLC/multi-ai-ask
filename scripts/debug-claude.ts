/**
 * Claude のセレクタ診断スクリプト。
 * .browser-profile（ログイン済みセッション）を使って claude.ai を開き、
 * テスト質問を送って、どのセレクタが現在の DOM にマッチするかを出力する。
 *
 * 実行前に dev サーバー / setup-login は必ず停止すること（プロファイルは同時に1つしか開けない）。
 *
 * 実行: npm run debug:claude
 */
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { SELECTORS } from '../src/lib/adapters/selectors';

const PROFILE_DIR = path.join(process.cwd(), '.browser-profile');

// 現状の selectors.ts に加えて、claude.ai でよく使われる回答コンテナの候補も総当たりで確認する。
const ASSISTANT_CANDIDATES = [
  ...SELECTORS.claude.assistantMessage,
  'div.font-claude-response',
  'div[data-is-streaming]',
  'div[data-testid="message-content"]',
  '.font-claude-message .prose',
  'div.grid-cols-1 .prose',
  '.prose',
];

async function report(page: Page, label: string, selectors: string[]) {
  console.log(`\n=== ${label} ===`);
  for (const s of selectors) {
    let count = -1;
    let sample = '';
    try {
      const loc = page.locator(s);
      count = await loc.count();
      if (count > 0) sample = (await loc.nth(count - 1).innerText()).slice(0, 80).replace(/\n/g, ' ');
    } catch (e) {
      sample = `(エラー: ${(e as Error).message.slice(0, 40)})`;
    }
    console.log(`  count=${String(count).padStart(3)}  ${s}${sample ? `  -> "${sample}"` : ''}`);
  }
}

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
    locale: 'ja-JP',
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded' });

  console.log('claude.ai を開きました。ログイン状態を確認中…（5秒待機）');
  await page.waitForTimeout(5000);

  await report(page, '入力欄 composer', SELECTORS.claude.composer);
  await report(page, 'ログイン判定 loginIndicator', SELECTORS.claude.loginIndicator);
  console.log(`\ncontenteditable=true の総数: ${await page.locator('[contenteditable="true"]').count()}`);

  // 入力欄が見つかればテスト質問を送ってみる
  const composer = page.locator(SELECTORS.claude.composer[0]).first();
  if (await composer.count()) {
    console.log('\nテスト質問「1たす1は？」を送信します…');
    await composer.click();
    await composer.pressSequentially('1たす1は？', { delay: 15 });
    await composer.press('Enter');

    // 生成中の様子と回答の様子を 3 秒おきに 5 回観察
    for (let i = 1; i <= 5; i++) {
      await page.waitForTimeout(3000);
      console.log(`\n----- 観察 ${i}/5（送信から約 ${i * 3} 秒）-----`);
      await report(page, '生成中インジケータ generatingIndicator', SELECTORS.claude.generatingIndicator);
      await report(page, '回答 assistantMessage 候補', ASSISTANT_CANDIDATES);
    }
  } else {
    console.log('\n入力欄が見つかりませんでした。Claude にログインできているか確認してください。');
  }

  console.log('\n診断完了。上の出力をそのまま貼ってください。ブラウザは手動で閉じてください。');
  // ブラウザは開いたままにする（DOM を手で確認できるように）。Ctrl+C で終了。
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
