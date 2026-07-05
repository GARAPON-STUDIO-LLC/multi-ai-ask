/** プロファイル切り分けテスト: TEST_PROFILE のプロファイルで起動して example.com を開くだけ */
import { chromium } from 'playwright';

const dir = process.env.TEST_PROFILE!;
async function main() {
  const ctx = await chromium.launchPersistentContext(dir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
    locale: 'ja-JP',
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto('https://manus.im/', { waitUntil: 'domcontentloaded' });
  console.log('OK:', page.url());
  await page.waitForTimeout(8000);
  console.log('OK: 8秒生存');
  await ctx.close();
  console.log('OK: 正常終了');
}
main().catch((e) => {
  console.error('NG:', e.message?.split('\n')[0]);
  process.exit(1);
});
