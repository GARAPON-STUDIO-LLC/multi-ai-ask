# Multi-AI 一括問い合わせ

1つの質問を **Claude / ChatGPT / Gemini**（フェーズ2で Manus）に同時に投げ、回答を横並びで比較できる個人用 Web アプリです。

公式 API ではなく、**ログイン済みのブラウザを Playwright で自動操作**して各サービスの Web UI から回答を回収します。そのため API キー・トークン課金が不要で、既存のサブスクリプションをそのまま使えます。

## 技術スタック

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Playwright（Chromium / 永続コンテキストでログインセッションを保存）
- ストリーミングは SSE（Server-Sent Events）

## セットアップ

```bash
npm install
npx playwright install chromium
```

## 使い方

### 1. 初回ログイン（1回だけ）

```bash
npm run setup-login
```

ヘッドありの Chromium が起動し、Claude / ChatGPT / Gemini のタブが開きます。
各サイトに**手動でログイン**（2FA・キャプチャもここで突破）したら、ターミナルで **Enter** を押してください。
セッションは `.browser-profile/` に保存され、以降は再ログイン不要です。

### 2. アプリを起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開き、質問を入力して「4つのAIに聞く」を押すと、
各サービスの回答が3カラムにリアルタイムでストリーミング表示されます。
（送信は `⌘/Ctrl + Enter` でも可能）

## 仕組み

```
ブラウザ(UI) ──POST /api/ask (SSE)──> Next.js Route Handler
                                          │
                                          ▼
                                   Orchestrator（並列ファンアウト）
                          ┌───────────────┼───────────────┐
                       Claude          ChatGPT          Gemini
                    （各 adapter が Playwright の page を1枚ずつ担当）
                                          │
                          1つの永続ブラウザコンテキスト
                       （.browser-profile/ にセッション保存）
```

- 各サービスの操作は `src/lib/adapters/` のアダプタに分離。
- DOM セレクタは `src/lib/adapters/selectors.ts` に集約。サイトの UI 変更で壊れたらここを直します。
- 回答完了は「生成停止ボタンが消える」かつ「テキストが一定時間変化しない」の2段構えで検知します。

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| カラムに「要ログイン」と出る | `npm run setup-login` で再ログイン |
| 回答が取れない / セレクタずれ | `selectors.ts` を現在の DOM に合わせて修正。失敗時のスクショは `.screenshots/` |
| ヘッドレスで動かしたい | `HEADLESS=true npm run dev`（Bot 検知されやすいので非推奨） |

## 注意事項

- **個人利用が前提**です。自分のアカウントを自動操作する行為は各サービスの利用規約上グレーな領域です。自己責任でご利用ください。
- ログインセッション（`.browser-profile/`）は **Git 管理対象外**です（`.gitignore` 済み）。秘匿情報を含むため共有しないでください。

## フェーズ2（今後）

- Manus アダプタの実装（エージェント実行ステータス監視ベースの完了検知）
- 質問/回答履歴の保存（better-sqlite3）
- 4回答を Claude API で統合要約
