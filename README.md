# Multi-AI 一括問い合わせ

1つの質問を **Claude / ChatGPT / Gemini / Manus** に同時に投げ、回答を横並びで比較できる個人用 Web アプリです。
さらに、4つの回答が出そろうと **Claude が自動で共通点・相違点を比較分析**し、全体を **Markdown でダウンロード**できます。

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

ヘッドありの Chromium が起動し、Claude / ChatGPT / Gemini / Manus のタブが開きます。
各サイトに**手動でログイン**（2FA・キャプチャもここで突破）したら、ターミナルで **Enter** を押してください。
セッションは `.browser-profile/` に保存され、以降は再ログイン不要です。

> Manus は Google OAuth（「Google で続行」）でログインできます。同じプロファイルで Gemini に
> ログイン済みなら、その Google セッションを再利用してパスワード入力なしで通せます。

### 2. アプリを起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開き、質問を入力して「4つのAIに聞く」を押すと、
各サービスの回答が4カラムにリアルタイムでストリーミング表示されます。
（送信は `⌘/Ctrl + Enter` でも可能）

- 4回答が出そろうと、下部の **分析パネル**に Claude による比較（共通点・相違点・各回答の特徴・総合結論）が自動表示されます。
- **「⬇ Markdown をダウンロード」ボタン**で、質問・4回答・分析結果を1つの `.md` にまとめて保存できます。
- Manus は非同期エージェントのため、回答完了まで数分かかることがあります。

## 仕組み

```
ブラウザ(UI) ──POST /api/ask (SSE)──> Next.js Route Handler
                                          │
                                          ▼
                                   Orchestrator（並列ファンアウト）
                    ┌──────────────┬──────────┼──────────┬──────────┐
                 Claude         ChatGPT      Gemini      Manus
                 （各 adapter が Playwright の page を1枚ずつ担当）
                                          │
                          1つの永続ブラウザコンテキスト
                       （.browser-profile/ にセッション保存）

全回答完了後（UIが自動判定）:
ブラウザ(UI) ──POST /api/analyze (SSE)──> analyzer（Claude を専用ページで実行）──> 分析パネル
```

- 各サービスの操作は `src/lib/adapters/` のアダプタに分離。Manus のみ非同期エージェント用の独自アダプタ。
- DOM セレクタは `src/lib/adapters/selectors.ts` に集約。サイトの UI 変更で壊れたらここを直します。
- 回答完了は「生成停止ボタンが消える」かつ「テキストが一定時間変化しない」の2段構えで検知します。
  Manus のみ「スピナー消滅 かつ 本文に『タスクが完了しました』」で判定します。

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| カラムに「要ログイン」と出る | `npm run setup-login` で再ログイン |
| 回答が取れない / セレクタずれ | `selectors.ts` を現在の DOM に合わせて修正。失敗時のスクショは `.screenshots/` |
| ヘッドレスで動かしたい | `HEADLESS=true npm run dev`（Bot 検知されやすいので非推奨） |

## 注意事項

- **個人利用が前提**です。自分のアカウントを自動操作する行為は各サービスの利用規約上グレーな領域です。自己責任でご利用ください。
- ログインセッション（`.browser-profile/`）は **Git 管理対象外**です（`.gitignore` 済み）。秘匿情報を含むため共有しないでください。

## 実装済みの主な機能

- Claude / ChatGPT / Gemini / Manus の4サービス同時問い合わせ
- Manus（非同期エージェント）対応（スピナー消滅 + 完了文言で完了検知）
- 4回答の自動比較分析（Claude を専用ページで実行）
- 質問・4回答・分析結果の Markdown ダウンロード

## 今後の候補

- 質問/回答履歴の保存
- 分析エンジンの UI 切り替え（現状は Claude 固定）
