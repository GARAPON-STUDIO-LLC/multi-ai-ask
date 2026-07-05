@AGENTS.md

# Multi-AI 一括問い合わせ（プロジェクト概要）

1つの質問を Claude / ChatGPT / Gemini / Manus へ同時に投げ、回答を横並びで比較する
**個人ローカル専用**の Web アプリ。公式 API ではなく **Playwright によるブラウザ
自動操作**で各サービスのログイン済み Web UI を叩いて回答を回収する。4回答が出そろうと
Claude が自動で比較分析し、全体を Markdown でダウンロードできる。

## アーキテクチャ

- `src/app/page.tsx` … サーバーコンポーネント。`enabledServices()` を読んで `AskClient` に渡す。
- `src/app/api/ask/route.ts` … SSE エンドポイント（`runtime = 'nodejs'` 必須）。`askAll()` のイベントを `data: <json>\n\n` で流す。
- `src/lib/orchestrator.ts` … 有効アダプタへ並列ファンアウトし、各サービスの進行を `AskEvent` にして1本のストリームにマージ（`askAll`）。
- `src/lib/browser.ts` … Playwright の**永続コンテキスト**をシングルトン管理（`globalThis` で HMR 越しに保持）。`.browser-profile/` にセッション保存。ページは**文字列キー**で管理（サービス ID が基本だが、分析用の `'analysis'` など任意キーも持てる）。
- `src/lib/analyzer.ts` … 4回答の**比較分析**。合成プロンプトを組み立て、**Claude を専用ページ（`'analysis'`）**で走らせて共通点・相違点をストリーム（`/api/analyze`）。回答用の claude ページとは別タブで干渉しない。
- `src/lib/adapters/` … サービスごとの操作ロジック。
  - `types.ts` … `AIServiceAdapter` インターフェースと `ServiceStatus`。
  - `selectors.ts` … **全サイトの DOM セレクタを集約**（候補配列で上から順にフォールバック）。UI 変更で壊れたら最初にここを直す。
  - `helpers.ts` … `firstVisible` / `humanType` / `streamUntilStable`（完了検知）など共通処理。
  - `base.ts` … `makeChatAdapter()`。claude/chatgpt/gemini はこの共通実装を使う薄いラッパ。
  - `claude.ts` / `chatgpt.ts` / `gemini.ts` … 設定（id/name/url/selectors）のみ。
  - `manus.ts` … Manus（非同期エージェント）用の専用アダプタ。`enabled: true`。完了検知が
    chat 系と異なる（後述）ため `makeChatAdapter` を使わず独自実装。
  - `index.ts` … `ALL_ADAPTERS` / `ENABLED_ADAPTERS`。
- UI（`src/components/`）… `AskClient`（SSE 受信＋状態管理。全回答完了後に自動で `/api/analyze` を呼び、質問＋4回答＋分析を Markdown でダウンロードするボタンも持つ）/ `QuestionInput` / `AnswerColumn` / `AnalysisPanel`（全幅の分析フィールド）/ `StatusBadge`。

## 完了検知の方針（重要）

`streamUntilStable`（helpers.ts）が「生成停止ボタンが消える」かつ「回答テキストが
`stableMs` 間変化しない」で完了とみなす。停止ボタンのセレクタが取れなくてもテキスト
安定で完了できるフォールバック付き。

## よくある保守作業

- **回答が取れない / 入力できない**: 対象サイトを実際に開いて DevTools で composer / sendButton /
  generatingIndicator / assistantMessage のセレクタを確認し、`selectors.ts` を更新する。
  失敗時のスクショは `.screenshots/` に残る。
- **Manus のセレクタ修正**: 実 DOM は `npm run debug:manus`（`SUBMIT=1` で送信後も観察）で確認し
  `selectors.ts` の `manus` を直す。Manus の完了検知は「スピナー（`animate-spin`）が消える」かつ
  「本文に完了文言『タスクが完了しました』（`completionText`）が出る」の AND で判定している
  （スピナーはステップ間で一時的に消えるため、文言と組み合わせないと途中で誤完了する）。

## 制約・注意

- Playwright は `serverExternalPackages`（next.config.ts）でバンドル対象外にしている。
- `.browser-profile/` `.screenshots/` は `.gitignore` 済み（セッションを含むので共有しない）。
- 既定はヘッドあり（Bot 検知緩和）。CI 等では `HEADLESS=true`。
- 自分のアカウントを自動操作する都合上、規約的にはグレー。個人利用前提。
