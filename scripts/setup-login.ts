/**
 * 初回ログイン用スクリプト。
 * .browser-profile を使うヘッドあり Chromium を起動し、各サービスをタブで開く。
 * 各サイトに手動でログイン（2FA・キャプチャもここで突破）したあと、
 * ターミナルで Enter を押すとセッションが保存されて終了する。
 *
 * 実行: npm run setup-login
 */
import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';
import { chromium } from 'playwright';

const PROFILE_DIR = path.join(process.cwd(), '.browser-profile');

const SITES = [
  { name: 'Claude', url: 'https://claude.ai/new' },
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Gemini', url: 'https://gemini.google.com/app' },
  { name: 'Manus', url: 'https://manus.im/' },
];

async function main() {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  console.log('ブラウザを起動します。各タブでログインしてください…\n');

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
    locale: 'ja-JP',
  });

  for (const site of SITES) {
    const page = await ctx.newPage();
    await page.goto(site.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    console.log(`  - ${site.name}: ${site.url} を開きました`);
  }

  console.log(
    '\n各サイトにログインできたら、このターミナルで Enter を押してください（セッションが保存されます）。',
  );

  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });

  await ctx.close();
  console.log('\n保存しました。`npm run dev` で利用できます。');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
