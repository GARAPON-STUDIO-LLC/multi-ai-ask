@AGENTS.md

# Multi-AI 一括問い合わせ（プロジェクト概要）

1つの質問を Claude / ChatGPT / Gemini（フェーズ2で Manus）へ同時に投げ、回答を横並びで
比較する**個人ローカル専用**の Web アプリ。公式 API ではなく **Playwright によるブラウザ
自動操作**で各サービスのログイン済み Web UI を叩いて回答を回収する。

## アーキテクチャ

- `src/app/page.tsx` … サーバーコンポーネント。`enabledServices()` を読んで `AskClient` に渡す。
- `src/app/api/ask/route.ts` … SSE エンドポイント（`runtime = 'nodejs'` 必須）。`askAll()` のイベントを `data: <json>\n\n` で流す。
- `src/lib/orchestrator.ts` … 有効アダプタへ並列ファンアウトし、各サービスの進行を `AskEvent` にして1本のストリームにマージ（`askAll`）。
- `src/lib/browser.ts` … Playwright の**永続コンテキスト**をシングルトン管理（`globalThis` で HMR 越しに保持）。`.browser-profile/` にセッション保存。サービスごとに page を1枚確保。
- `src/lib/adapters/` … サービスごとの操作ロジック。
  - `types.ts` … `AIServiceAdapter` インターフェースと `ServiceStatus`。
  - `selectors.ts` … **全サイトの DOM セレクタを集約**（候補配列で上から順にフォールバック）。UI 変更で壊れたら最初にここを直す。
  - `helpers.ts` … `firstVisible` / `humanType` / `streamUntilStable`（完了検知）など共通処理。
  - `base.ts` … `makeChatAdapter()`。claude/chatgpt/gemini はこの共通実装を使う薄いラッパ。
  - `claude.ts` / `chatgpt.ts` / `gemini.ts` … 設定（id/name/url/selectors）のみ。
  - `manus.ts` … フェーズ2スタブ（`enabled: false`）。
  - `index.ts` … `ALL_ADAPTERS` / `ENABLED_ADAPTERS`。
- UI（`src/components/`）… `AskClient`（SSE 受信＋状態管理）/ `QuestionInput` / `AnswerColumn` / `StatusBadge`。

## 完了検知の方針（重要）

`streamUntilStable`（helpers.ts）が「生成停止ボタンが消える」かつ「回答テキストが
`stableMs` 間変化しない」で完了とみなす。停止ボタンのセレクタが取れなくてもテキスト
安定で完了できるフォールバック付き。

## よくある保守作業

- **回答が取れない / 入力できない**: 対象サイトを実際に開いて DevTools で composer / sendButton /
  generatingIndicator / assistantMessage のセレクタを確認し、`selectors.ts` を更新する。
  失敗時のスクショは `.screenshots/` に残る。
- **Manus を有効化**: `manus.ts` の `enabled` を true にして `submit` / `streamResponse` を実装。
  Manus は非同期エージェントで完了まで数分かかるため、`streamUntilStable` ではなく
  実行ステータス監視ベースの完了検知が必要。

## 制約・注意

- Playwright は `serverExternalPackages`（next.config.ts）でバンドル対象外にしている。
- `.browser-profile/` `.screenshots/` は `.gitignore` 済み（セッションを含むので共有しない）。
- 既定はヘッドあり（Bot 検知緩和）。CI 等では `HEADLESS=true`。
- 自分のアカウントを自動操作する都合上、規約的にはグレー。個人利用前提。
