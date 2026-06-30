/**
 * Manus の DOM 診断スクリプト（エクスプローラ型）。
 * Manus は入力欄・送信ボタン・結果コンテナが未知なので、ページ上の操作可能な要素を
 * 洗い出して特定する。
 *
 * 使い方:
 *   npm run debug:manus            … 入力側の DOM だけダンプ（送信しない・安全）
 *   SUBMIT=1 npm run debug:manus   … プロンプトを送信し、結果/途中経過も数分観察する
 *
 * 任意の環境変数:
 *   PROMPT="..."   送信するプロンプト（既定は簡単な質問）
 *   MANUS_URL=...  開く URL（既定 https://manus.im/）
 *
 * 実行前に dev サーバー / 他のスクリプトは停止すること（プロファイルは同時に1つ）。
 */
import path from 'node:path';
import { chromium, type Page } from 'playwright';

const PROFILE_DIR = path.join(process.cwd(), '.browser-profile');
const MANUS_URL = process.env.MANUS_URL ?? 'https://manus.im/';
const DO_SUBMIT = process.env.SUBMIT === '1';
const PROMPT = process.env.PROMPT ?? '日本の首都はどこですか？一言で答えてください。';

interface InputInfo {
  kind: string;
  tag: string;
  id: string;
  cls: string;
  placeholder: string;
  ariaLabel: string;
  visible: boolean;
}
interface ButtonInfo {
  label: string;
  text: string;
  cls: string;
}
interface TextBlock {
  len: number;
  tag: string;
  cls: string;
  sample: string;
}

async function dumpInteractive(page: Page) {
  const inputs: InputInfo[] = await page.evaluate(() => {
    const out: InputInfo[] = [];
    const push = (el: Element, kind: string) => {
      const e = el as HTMLElement;
      out.push({
        kind,
        tag: e.tagName.toLowerCase(),
        id: e.id || '',
        cls: String(e.className ?? '').slice(0, 80),
        placeholder: e.getAttribute('placeholder') ?? '',
        ariaLabel: e.getAttribute('aria-label') ?? '',
        visible: !!(e.offsetParent || e.getClientRects().length),
      });
    };
    document.querySelectorAll('textarea').forEach((e) => push(e, 'textarea'));
    document.querySelectorAll('[contenteditable="true"]').forEach((e) => push(e, 'contenteditable'));
    document.querySelectorAll('[role="textbox"]').forEach((e) => push(e, 'role=textbox'));
    return out;
  });
  console.log('\n--- 入力欄候補 ---');
  inputs.forEach((i) => console.log(JSON.stringify(i)));

  const buttons: ButtonInfo[] = await page.evaluate(() => {
    const out: ButtonInfo[] = [];
    document.querySelectorAll('button, [role="button"]').forEach((el) => {
      const e = el as HTMLElement;
      const label = e.getAttribute('aria-label') ?? '';
      const text = (e.innerText ?? '').trim().slice(0, 30);
      const visible = !!(e.offsetParent || e.getClientRects().length);
      if (!visible || (!label && !text)) return;
      out.push({ label, text, cls: String(e.className ?? '').slice(0, 60) });
    });
    return out.slice(0, 40);
  });
  console.log('\n--- ボタン候補（可視・最大40）---');
  buttons.forEach((b) => console.log(JSON.stringify(b)));
}

async function dumpBiggestText(page: Page) {
  const blocks: TextBlock[] = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div,article,section,main,p'));
    return els
      .map((el) => {
        const e = el as HTMLElement;
        const t = (e.innerText ?? '').trim();
        return {
          len: t.length,
          tag: e.tagName.toLowerCase(),
          cls: String(e.className ?? '').slice(0, 80),
          sample: t.slice(0, 100).replace(/\s+/g, ' '),
        };
      })
      .filter((x) => x.len > 30)
      .sort((a, b) => b.len - a.len)
      .slice(0, 6);
  });
  console.log('--- テキスト量の多い要素 上位6（回答/ステップ コンテナの手がかり）---');
  blocks.forEach((x) => console.log(`len=${x.len} <${x.tag} class="${x.cls}"> "${x.sample}"`));
}

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
    locale: 'ja-JP',
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(MANUS_URL, { waitUntil: 'domcontentloaded' });
  console.log('Manus を開きました:', page.url(), '（5秒待機）');
  await page.waitForTimeout(5000);
  console.log('現在の URL:', page.url());

  await dumpInteractive(page);

  if (!DO_SUBMIT) {
    console.log('\n[入力側のみ] 送信して結果も観察するには SUBMIT=1 を付けて再実行:');
    console.log('  SUBMIT=1 npm run debug:manus');
  } else {
    console.log(`\nプロンプトを送信します: "${PROMPT}"`);
    const composer = (await page.locator('textarea').count())
      ? page.locator('textarea').first()
      : page.locator('[contenteditable="true"]').first();

    if (!(await composer.count())) {
      console.log('入力欄が見つかりませんでした。上の「入力欄候補」を確認してください。');
    } else {
      await composer.click();
      await composer.pressSequentially(PROMPT, { delay: 15 });
      await page.waitForTimeout(500);
      await composer.press('Enter');
      console.log('Enter を押しました。URL 遷移・ログイン要求・結果を観察します（最大約4分）…');

      for (let i = 1; i <= 12; i++) {
        await page.waitForTimeout(20_000);
        console.log(`\n===== 観察 ${i}/12（送信から約 ${i * 20} 秒）URL=${page.url()} =====`);
        await dumpBiggestText(page);
      }
    }
  }

  console.log('\n診断完了。出力を貼ってください。ブラウザは手動で閉じてください（Ctrl+C）。');
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
