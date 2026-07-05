# HANDOFF — セッション再開用メモ

このファイルは、別セッション（人間 / AI）が作業を**正確に再開**するための引き継ぎ文書です。
アーキテクチャ詳細は [`CLAUDE.md`](./CLAUDE.md)、使い方は [`README.md`](./README.md) を参照。

最終更新: 2026-07-06（Manus 実装＋4回答の自動比較分析＋Markdown ダウンロードまで実装・E2E確認済み）

---

## 1. このプロジェクトは何か

1つの質問を **Claude / ChatGPT / Gemini / Manus** に同時に投げ、回答を横並びで
比較する**個人ローカル専用** Web アプリ。公式 API ではなく **Playwright によるブラウザ自動操作**で、
ログイン済みの各サービス Web UI を叩いて回答を回収する。

## 2. 確定している設計判断（蒸し返さないこと）

| 論点 | 決定 | 理由 |
|---|---|---|
| 連携方式 | **ブラウザ自動操作（Playwright）** | 「Claude in Chrome を使用」の意図。Manus に公開 API が無く全 API 方式が不可能。既存サブスクを使える |
| 利用範囲 | **個人ローカルのみ** | 初回手動ログイン → `.browser-profile/` に永続化。マルチユーザー/デプロイは対象外 |
| Manus | **フェーズ2として実装済み**（`enabled:true`） | 非同期エージェントで完了まで数分・完了検知が別ロジック。`makeChatAdapter` を使わず独自実装（スピナー消滅 AND「タスクが完了しました」文言で完了判定） |
| スタック | Next.js 16 + React 19 + TS + Tailwind 4 + Playwright + SSE / npm | ユーザーのハウススタイル準拠 |

## 3. 現在の状態

### 実装済み
- **4カラム UI**（質問入力 + Claude/ChatGPT/Gemini/Manus の回答カラム + 状態バッジ）
- SSE による逐次ストリーミング表示
- Playwright 永続コンテキストのシングルトン管理、ページ別再利用（キーは文字列。分析用 `'analysis'` も持つ）
- アダプタ構造（共通ロジック `base.ts` + サイト別設定 + セレクタ集約 `selectors.ts`）。Manus のみ独自アダプタ
- 初回ログインスクリプト `npm run setup-login`（Claude/ChatGPT/Gemini/Manus）
- 完了検知（停止ボタン消滅 + テキスト安定の2段構え）、エラー時スクショ保存
- **Manus（非同期エージェント）対応**（`enabled:true`。スピナー消滅 AND「タスクが完了しました」で完了検知）
- **4回答の自動比較分析**（全回答完了後、Claude を専用ページで走らせ共通点・相違点を全幅パネルに表示）
  - `src/lib/analyzer.ts` + `/api/analyze` + `AnalysisPanel`。E2E 動作確認済み（2026-07-06）
- **Markdown ダウンロード**（質問・4回答・分析結果を1つの `.md` に。`AskClient` の `buildMarkdown`/ボタン）
- 注意: `humanType` は改行を Shift+Enter で入力する（素の `\n` は Enter＝送信になり複数行プロンプトが途中送信される。分析プロンプトで発覚した全アダプタ共通のバグ修正済み）

### 検証済み ✅
- `npm run build`（型チェック・Lint 含む）成功
- Playwright Chromium 起動（永続コンテキスト）
- ホームページ描画（3カラム表示）
- `/api/ask` 入力バリデーション（空質問 → 400）
- **実サイトで Claude / ChatGPT / Gemini の3サービスとも回答取得を確認**（2026-07-01）
  - Claude のセレクタは UI 変更に追従して修正済み（下記）
  - 回答コンテナ: `div.font-claude-response`（`font-claude-message` は廃止）
  - 生成中判定: `div[data-is-streaming="true"]`（web 検索で止まっても誤完了しない）
- **Manus も実サイトで E2E 回答取得を確認**（2026-07-06）
  - 入力: `div.tiptap.ProseMirror`（Enter 送信で `/app/<taskId>` に遷移）
  - 回答: `[class*="chat-message"] [class*="markdown"]` の最後の要素（途中はステップ経過）
  - 完了検知: スピナー `[class*="animate-spin"]` 消滅 **かつ** 本文に「タスクが完了しました」
  - ログインは Google OAuth。同プロファイルの Gemini 用 Google セッションを再利用してログイン可

### 既知の注意 ⚠️
- DOM 依存のため、各サイトの UI 変更で再びセレクタがズレる可能性がある。
  ズレたら `npm run debug:claude` と同じ要領で `selectors.ts` を直す（ChatGPT/Gemini 用の
  診断スクリプトは未作成。必要時に debug-claude.ts を複製して作る）。

## 4. 再開手順

```bash
cd multi-ai-ask
npm install                 # 依存未インストールの場合
npx playwright install chromium
npm run setup-login         # Chromium が開く→各サイトに手動ログイン→ターミナルで Enter
npm run dev                 # http://localhost:3000
```

質問を送って4カラムに回答が出て、下部の分析パネルに比較が出れば成功。出ない/取れない場合は §5 へ。

## 5. メンテナンス／次に着手する候補

主要機能（4サービス問い合わせ・Manus・自動分析・Markdown DL）は実装＆E2E確認済み。
以降は主に保守と磨き込み。

- **未確認**: `npm run dev` のブラウザ UI で「質問→4カラム→分析パネル自動表示→DL ボタン」を
  目視確認（各機能はスクリプト経由で E2E 確認済みだが、実 UI 通しての目視は未実施）。
- **セレクタずれ対応**（最頻出の保守）: 対象サイトを DevTools で開き、`selectors.ts` の
  composer / sendButton / generatingIndicator / assistantMessage を実 DOM に合わせて更新。
  診断は `npm run debug:claude` / `npm run debug:manus`（`SUBMIT=1` で送信後も観察）。
  失敗時スクショは `.screenshots/`。ChatGPT/Gemini 用診断は未作成（必要時に debug-claude.ts を複製）。
- **完了検知の調整**: 途中で `done`/いつまでも `generating` の場合、`helpers.ts` の
  `streamUntilStable` の `stableMs`/`timeoutMs`（Manus は `manus.ts` 内の値）を調整。
- **今後の候補**: 質問/回答履歴の保存、分析エンジンの UI 切り替え（現状 Claude 固定）。

## 6. ファイルマップ（どこを触るか）

| やりたいこと | 触るファイル |
|---|---|
| セレクタ修正（最頻出） | `src/lib/adapters/selectors.ts` |
| 完了検知・入力の挙動 | `src/lib/adapters/helpers.ts`, `base.ts`（Manus は `manus.ts`） |
| サービス追加/設定 | `src/lib/adapters/<service>.ts`, `index.ts` |
| 並列実行・イベント | `src/lib/orchestrator.ts` |
| 比較分析（合成プロンプト・完了検知） | `src/lib/analyzer.ts`, `src/app/api/analyze/route.ts` |
| ブラウザ起動・セッション | `src/lib/browser.ts` |
| 質問 SSE エンドポイント | `src/app/api/ask/route.ts` |
| UI | `src/components/*`（`AskClient`＝状態管理＋自動分析＋Markdown DL、`AnalysisPanel`＝分析欄）, `src/app/page.tsx` |
| 初回ログイン | `scripts/setup-login.ts` |
| Manus DOM 診断 | `scripts/debug-manus.ts` |

## 7. 既知のリスク / 注意

- **Bot 検知**（特に claude.ai / chatgpt.com の Cloudflare）。既定ヘッドあり + 実プロファイル +
  人間的タイピングで緩和しているが、ブロックされうる。ヘッドレス（`HEADLESS=true`）は検知されやすい。
- **DOM 変更で壊れる前提**。`selectors.ts` 集約 + テキスト安定フォールバックで延命する設計。
- `.browser-profile/`（ログインセッション）と `.screenshots/` は **Git 管理外**（`.gitignore` 済み）。共有しない。
- 自分のアカウントの自動操作は各社規約上**グレー**。個人利用前提・自己責任。

## 8. コミット方針

作業ごとに区切ってコミットする（ユーザー方針）。
