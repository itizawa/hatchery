# 設計書: test: e2e/worker に worker.spec.ts を新設し UC-WORKER-01〜07 を Playwright テストとして実装する (#1098)

## 1. 目的 / 背景

`e2e/worker/usecases.md`（ワーカー個別プロフィールページ `/workers/$workerId`、#690・#929 で実装済み）には UC-WORKER-01〜07 の 7 件のユースケースが定義されているが、`e2e/worker/` に `worker.spec.ts` 自体が存在せず e2e カバレッジから漏れている。`e2e/worker/worker.spec.ts` を新設し、usecases.md の各 UC と 1:1 対応する `test()` / `test.todo()` を用意する。

## 2. スコープ（やること / やらないこと）

**やること**:
- `e2e/worker/worker.spec.ts` を新設し、UC-WORKER-01〜07 を 1:1 の `test()` / `test.todo()` で宣言する。
- UC-WORKER-01（プロフィールページへの遷移）・02（プロフィール表示）・03（投稿の空状態）・05（所属コミュニティの空状態）・07（コメントの空状態）を実テストとして実装する。
- UC-WORKER-04（所属コミュニティ一覧表示）・06（コメント一覧表示）は `test.todo()` として明示する（Issue 受け入れ条件3）。

**やらないこと**:
- `WorkerScene` 本体の実装変更（既存機能の検証追加のみ）。
- UC-WORKER-04 / 06 の実テスト化（本 Issue のスコープ外。将来 Issue で対応）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `e2e/worker/worker.spec.ts` に UC-WORKER-01〜07 の `test()` / `test.todo()` が 1 件ずつ存在する。
2. UC-WORKER-01: フィードの投稿カードのワーカー byline をクリックすると `/workers/{workerId}` へ遷移し、ページにワーカーの displayName が表示される。
3. UC-WORKER-02: `/workers/{workerId}` を直接開くと、アバター・displayName・role・personality・最近の投稿（1件以上）が表示される。
4. UC-WORKER-03: 投稿が 0 件のワーカーでは `data-testid="worker-posts-empty"` の「まだ投稿がありません。」が表示され、投稿カードは表示されない。
5. UC-WORKER-05: 所属コミュニティが 0 件のワーカーでは `data-testid="worker-communities-empty"` の「まだ所属コミュニティがありません。」が表示される。
6. UC-WORKER-07: コメントが 0 件のワーカーでは `data-testid="worker-comments-empty"` の「まだコメントがありません。」が表示される。
7. `pnpm --filter e2e-tests exec tsc --noEmit`（型検査）・`pnpm turbo run build|test|lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- 既存の最新パターン（#1097 `e2e/search/search.spec.ts`、#1085 `e2e/about/about.spec.ts`）に倣い、`../support/test.js` の `test`/`expect`（`test.todo()` ラッパー）を使う。
- `page.route()` で `common` の実 Zod スキーマ（`WorkerSchema` / `PostSchema` / `CommunitySchema` / `CommentSchema` / `AuthorWorkerSchema`）のフィールド名と一致するモック JSON を返し、バックエンドなしでブラウザ側の挙動のみを検証する。
- モック対象エンドポイント: `GET /api/auth/me`（401・未ログイン）、`GET /api/communities`（グローバルナビ用・空配列）、`GET /api/feed`（UC-WORKER-01 の遷移元）、`GET /api/workers/:workerId`、`GET /api/workers/:workerId/posts`、`GET /api/workers/:workerId/communities`、`GET /api/workers/:workerId/comments`。
- 各テストは `WorkerScene` が 4 つの独立した `QueryBoundary`（プロフィール / 投稿 / コミュニティ / コメント）を持つため、対象外のセクションもレンダリングが破綻しないよう毎回 4 エンドポイントすべてをモックする（`mockWorkerProfile()` ヘルパーで一括設定し、テストごとに `posts` / `communities` / `comments` の override を渡す）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / common / server / docs）

- 新規ファイルのみ: `e2e/worker/worker.spec.ts`、本設計書。
- 既存コード（`client` / `server` / `common`）の変更なし。

## 6. テスト計画（TDD で書くテスト一覧）

- UC-WORKER-01: フィード投稿の byline クリック → `/workers/{id}` 遷移 → displayName 見出し表示。
- UC-WORKER-02: プロフィール直接アクセス → アバター・displayName・role・personality・投稿タイトル表示。
- UC-WORKER-03: 投稿 0 件 → 空状態メッセージ表示・投稿カード非表示。
- UC-WORKER-04: `test.todo()`。
- UC-WORKER-05: 所属コミュニティ 0 件 → 空状態メッセージ表示。
- UC-WORKER-06: `test.todo()`。
- UC-WORKER-07: コメント 0 件 → 空状態メッセージ表示。

## 7. リスク・未決事項

- e2e は現状 CI（`pnpm turbo run build|test|lint`）に組み込まれていない（`playwright.config.ts` のコメント参照）。本 Issue でも CI 組み込みは対象外とし、ローカル `pnpm e2e` での実行確認に留める。
- UC-WORKER-04 / 06 の実テスト化は将来 Issue のスコープとする。
