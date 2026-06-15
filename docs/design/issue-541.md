# Issue #541: WorkerSchema の死蔵フィールド avatarUrl を削除し imageUrl に一本化する

## 背景

`common/src/domain/worker/worker.ts:14` の `WorkerSchema.avatarUrl`（`z.string().url().max(2048).optional()`）は、Prisma の `Worker` モデルに対応カラムが無く（Worker は `imageUrl` のみ）、`prismaWorkerRepository` のマッピングでも設定されないため常に `undefined` の死蔵フィールド。画像はアップロード・表示ともすべて `imageUrl` を使っており、`avatarUrl` は HTTP 契約（OpenAPI）に不要なノイズを生んでいる。上限も `imageUrl`（500）と不統一の 2048 で `.max()` 規約の意図と噛み合わない。

> 注: `AuthUser`/`User` の `avatarUrl`（人間ユーザー用）は正当な別物で、本 Issue の対象外。

## 受け入れ条件

1. `common/src/domain/worker/worker.ts` の `WorkerSchema` から `avatarUrl` を削除する。
2. OpenAPI 生成・client 型生成が成功し、Worker 型から `avatarUrl` が消える。
3. 既存の Worker 表示・テスト・fixtures が `imageUrl` 前提で緑のまま（参照切れ無し）。
4. `pnpm turbo run build typecheck test lint` が緑。User/AuthUser 側の `avatarUrl` には手を入れない。

## 設計判断

- **対象は `WorkerSchema.avatarUrl` のみ**。`grep -rn 'avatarUrl'` の調査で Worker 側の `avatarUrl` は
  - 定義: `common/src/domain/worker/worker.ts:14`
  - テスト: `common/src/domain/worker/worker.test.ts` の `describe("WorkerSchema: avatarUrl フィールド（#204）")` ブロック（#204 で追加された死蔵フィールドのテスト）
  - OpenAPI baseline fixture: `server/src/openapi/__fixtures__/openapi.baseline.json` の `Worker` スキーマ内 `avatarUrl`
  の 3 箇所のみ。読み書き（永続化・表示・アップロード）箇所は存在しない。
- `client/src/mocks/data/fixtures.ts` / `AccountScene.tsx` / `passport.ts` / `userRepository.ts` 等の `avatarUrl` はすべて `AuthUser`/`User`（人間ユーザー）由来でスコープ外。手を入れない。

- **TDD アプローチ（リファクタ＝振る舞い削除）**: 「Worker 型から `avatarUrl` が消える」ことをテストで固定する。
  1. `common/src/domain/worker/worker.test.ts` の死蔵フィールド `avatarUrl` の describe ブロックを、`WorkerSchema` が `avatarUrl` を**含まない**ことを検証するテストに置き換える（`WorkerSchema.shape` に `avatarUrl` キーが無い／`avatarUrl` を渡しても出力に残らない＝strip される）。
  2. 失敗を確認（まだ定義が残っている）→ コミット。
  3. `worker.ts` から `avatarUrl` 行を削除して緑化。

- **OpenAPI baseline 回帰テスト（#535）**: `registry.snapshot.test.ts` は `openapi.baseline.json` と byte 完全一致を要求する。`avatarUrl` 削除は「意図的な API スキーマ変更」なので、fixture の `Worker` スキーマから `avatarUrl` プロパティを削除して baseline を更新する（テストコメントの「意図的に変更した場合のみ fixture を更新する」に従う）。User 側スキーマ（`AuthUser`/`UpdateProfile`）の `avatarUrl` は触らない。

## スコープ外

- User/AuthUser の `avatarUrl`、画像アップロード機能。
- ユーザー可視の振る舞いは変わらない（死蔵フィールドの削除のみ）ため `e2e/` ユースケース更新は不要。

## 関連

#220, #204, #91, #535
