import type { ServiceId } from './types';

/**
 * サイトごとの DOM セレクタを一箇所に集約する。
 * 各サイトは頻繁に DOM を変えるため、壊れたらここだけ直せばよい構造にしている。
 * 各ロールは「候補の配列」になっており、上から順に最初に見つかったものを使う。
 */
export interface SiteSelectors {
  /** 質問入力欄（contenteditable / textarea） */
  composer: string[];
  /** 送信ボタン */
  sendButton: string[];
  /** 生成中であることを示す要素（停止ボタンなど）。これが消えたら完了とみなす */
  generatingIndicator: string[];
  /** アシスタントの回答メッセージ要素（最後の1件を読む） */
  assistantMessage: string[];
  /** 未ログインを示す要素（これが見えたら need_login） */
  loginIndicator: string[];
}

export const SELECTORS: Record<Exclude<ServiceId, 'manus'>, SiteSelectors> = {
  claude: {
    composer: ['div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]'],
    sendButton: [
      'button[aria-label="Send message"]',
      'button[aria-label="メッセージを送信"]',
      'button[aria-label*="Send"]',
    ],
    generatingIndicator: [
      'button[aria-label="Stop response"]',
      'button[aria-label*="Stop"]',
      'button[aria-label*="停止"]',
    ],
    assistantMessage: ['div.font-claude-message', '[data-testid="assistant-message"]'],
    loginIndicator: [
      'input[name="email"]',
      'button:has-text("Continue with Google")',
      'a[href*="/login"]',
    ],
  },
  chatgpt: {
    composer: ['div#prompt-textarea[contenteditable="true"]', 'textarea#prompt-textarea', 'div[contenteditable="true"]'],
    sendButton: [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="送信"]',
    ],
    generatingIndicator: [
      'button[data-testid="stop-button"]',
      'button[aria-label*="Stop"]',
      'button[aria-label*="停止"]',
    ],
    assistantMessage: ['div[data-message-author-role="assistant"]'],
    loginIndicator: [
      'button[data-testid="login-button"]',
      'a[href*="/auth/login"]',
      'button:has-text("Log in")',
    ],
  },
  gemini: {
    composer: ['rich-textarea div.ql-editor[contenteditable="true"]', 'div.ql-editor[contenteditable="true"]', 'div[contenteditable="true"]'],
    sendButton: [
      'button[aria-label="Send message"]',
      'button.send-button',
      'button[aria-label*="送信"]',
      'button[mattooltip*="Send"]',
    ],
    generatingIndicator: [
      'button[aria-label="Stop response"]',
      'button[aria-label*="Stop"]',
      'button[aria-label*="停止"]',
    ],
    assistantMessage: ['message-content .markdown', 'div.model-response-text', 'message-content'],
    loginIndicator: [
      'a[href*="accounts.google.com"]',
      'a[aria-label*="Sign in"]',
      'a:has-text("Sign in")',
    ],
  },
};
