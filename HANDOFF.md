# HANDOFF — セッション再開用メモ

このファイルは、別セッション（人間 / AI）が作業を**正確に再開**するための引き継ぎ文書です。
アーキテクチャ詳細は [`CLAUDE.md`](./CLAUDE.md)、使い方は [`README.md`](./README.md) を参照。

最終更新: 2026-07-01（フェーズ1 実装完了時点）

---

## 1. このプロジェクトは何か

1つの質問を **Claude / ChatGPT / Gemini**（フェーズ2で Manus）に同時に投げ、回答を横並びで
比較する**個人ローカル専用** Web アプリ。公式 API ではなく **Playwright によるブラウザ自動操作**で、
ログイン済みの各サービス Web UI を叩いて回答を回収する。

## 2. 確定している設計判断（蒸し返さないこと）

| 論点 | 決定 | 理由 |
|---|---|---|
| 連携方式 | **ブラウザ自動操作（Playwright）** | 「Claude in Chrome を使用」の意図。Manus に公開 API が無く全 API 方式が不可能。既存サブスクを使える |
| 利用範囲 | **個人ローカルのみ** | 初回手動ログイン → `.browser-profile/` に永続化。マルチユーザー/デプロイは対象外 |
| Manus | **フェーズ2に分離** | 非同期エージェントで完了まで数分・完了検知が別ロジックになるため。今は `enabled:false` スタブ |
| スタック | Next.js 16 + React 19 + TS + Tailwind 4 + Playwright + SSE / npm | ユーザーのハウススタイル準拠 |

## 3. 現在の状態（フェーズ1）

### 実装済み
- 3カラム UI（質問入力 + Claude/ChatGPT/Gemini の回答カラム + 状態バッジ）
- SSE による逐次ストリーミング表示
- Playwright 永続コンテキストのシングルトン管理、サービス別 page 再利用
- アダプタ構造（共通ロジック `base.ts` + サイト別設定 + セレクタ集約 `selectors.ts`）
- 初回ログインスクリプト `npm run setup-login`
- 完了検知（停止ボタン消滅 + テキスト安定の2段構え）、エラー時スクショ保存

### 検証済み ✅
- `npm run build`（型チェック・Lint 含む）成功
- Playwright Chromium 起動（永続コンテキスト）
- ホームページ描画（3カラム表示）
- `/api/ask` 入力バリデーション（空質問 → 400）

### 未検証 ⚠️（再開時の最優先事項）
- **実サイトでの回答取得が未検証**。ユーザーのログインと画面（ヘッドあり）が必要なため、
  AI セッションでは確認できていない。
- → 各サイトの **DOM セレクタ（`src/lib/adapters/selectors.ts`）が現在の UI と合っているかは未保証**。
  最初の実走行でズレが出たらここを直すのが主作業になる。

## 4. 再開手順

```bash
cd multi-ai-ask
npm install                 # 依存未インストールの場合
npx playwright install chromium
npm run setup-login         # Chromium が開く→各サイトに手動ログイン→ターミナルで Enter
npm run dev                 # http://localhost:3000
```

質問を送って3カラムに回答が出れば成功。出ない/取れない場合は §5 へ。

## 5. 最初に着手すべきこと（次のセッションの TODO）

1. **実走行でセレクタ検証**: Claude/ChatGPT/Gemini それぞれで回答が取得・ストリーミングされるか確認。
   - ズレたら対象サイトを DevTools で開き、`selectors.ts` の composer / sendButton /
     generatingIndicator / assistantMessage を実 DOM に合わせて更新。
   - 失敗時のスクショは `.screenshots/` に出る。
2. **完了検知の調整**: 途中で `done` になる/いつまでも `generating` の場合、
   `src/lib/adapters/helpers.ts` の `streamUntilStable` の `stableMs`/`timeoutMs` を調整。
3. （フェーズ2）Manus 有効化: `src/lib/adapters/manus.ts` の `enabled:true` 化と
   `submit`/`streamResponse` 実装（実行ステータス監視ベースの完了検知が必要）。

## 6. ファイルマップ（どこを触るか）

| やりたいこと | 触るファイル |
|---|---|
| セレクタ修正（最頻出） | `src/lib/adapters/selectors.ts` |
| 完了検知・入力の挙動 | `src/lib/adapters/helpers.ts`, `base.ts` |
| サービス追加/設定 | `src/lib/adapters/<service>.ts`, `index.ts` |
| 並列実行・イベント | `src/lib/orchestrator.ts` |
| ブラウザ起動・セッション | `src/lib/browser.ts` |
| SSE エンドポイント | `src/app/api/ask/route.ts` |
| UI | `src/components/*`, `src/app/page.tsx` |
| 初回ログイン | `scripts/setup-login.ts` |

## 7. 既知のリスク / 注意

- **Bot 検知**（特に claude.ai / chatgpt.com の Cloudflare）。既定ヘッドあり + 実プロファイル +
  人間的タイピングで緩和しているが、ブロックされうる。ヘッドレス（`HEADLESS=true`）は検知されやすい。
- **DOM 変更で壊れる前提**。`selectors.ts` 集約 + テキスト安定フォールバックで延命する設計。
- `.browser-profile/`（ログインセッション）と `.screenshots/` は **Git 管理外**（`.gitignore` 済み）。共有しない。
- 自分のアカウントの自動操作は各社規約上**グレー**。個人利用前提・自己責任。

## 8. コミット方針

作業ごとに区切ってコミットする（ユーザー方針）。
