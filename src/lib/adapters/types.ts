import type { Page } from 'playwright';

/** 各サービスの進行状態 */
export type ServiceStatus =
  | 'idle' // 未開始
  | 'connecting' // ページを開いている
  | 'need_login' // ログインが必要
  | 'submitting' // 質問を入力・送信中
  | 'generating' // 回答生成中
  | 'done' // 完了
  | 'error'; // エラー

export type ServiceId = 'claude' | 'chatgpt' | 'gemini' | 'manus';

export interface AIServiceAdapter {
  id: ServiceId;
  /** UI に表示する名前 */
  name: string;
  /** 操作対象の URL */
  url: string;
  /** false のサービスは orchestrator が無視する（Manus は当面 false） */
  enabled: boolean;

  /**
   * ページがログイン済みで質問可能な状態かを確認する。
   * 未ログインなら { ready: false } を返す。
   */
  ensureReady(page: Page): Promise<{ ready: boolean }>;

  /** 質問を入力欄に投入して送信する。 */
  submit(page: Page, prompt: string): Promise<void>;

  /**
   * 回答テキストを逐次 yield する（その時点の「全文」を返す。差分ではない）。
   * 生成が完了したら return する。
   */
  streamResponse(page: Page): AsyncGenerator<string>;
}
