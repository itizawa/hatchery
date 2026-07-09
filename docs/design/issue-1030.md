# 設計書: refactor: client/src/api/communityEngagement.ts の as any キャストを解消する (#1030)

## 1. 目的 / 背景

`client/src/api/communityEngagement.ts` の `fetchCommunityEngagement` は `openApiClient` を `as any` にキャストして `GET("/api/admin/community-engagement", ...)` を呼び出している。コメントには「`openapi.gen.ts` はビルドパイプラインで生成されるため、ここでは unknown 経由でキャストし…」とあるが、実際には `client/src/api/openapi.gen.ts` に該当パスの型（`get` シグネチャ含む）が既に生成済みで、前提が崩れている。周辺の `admin.ts` / `auth.ts` / `feed.ts` 等は素の `openApiClient.GET(...)` 呼び出しで型安全に書けており、このファイルだけ型チェックの穴になっている。

## 2. スコープ（やること / やらないこと）

- やること: `fetchCommunityEngagement` の `(openApiClient as any).GET(...)` を型付きの `openApiClient.GET(...)` に置き換え、不要になった `eslint-disable-next-line @typescript-eslint/no-explicit-any` と前提の崩れた説明コメントを削除する。
- やらないこと: `community-engagement` エンドポイント自体の仕様変更・レスポンス形状の変更はしない。既存の `CommunityEngagementSchema` によるランタイム検証はそのまま維持する。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `(openApiClient as any).GET("/api/admin/community-engagement", ...)` が `openApiClient.GET("/api/admin/community-engagement", { credentials: "include" })` という素の型付き呼び出しに置き換わっている。
2. `eslint-disable-next-line @typescript-eslint/no-explicit-any` コメントと、前提が崩れている旨の JSDoc コメントが削除されている。
3. `pnpm --filter @hatchery/client typecheck` が型エラーなく通る。
4. 既存の `communityEngagement.test.ts` の全テストが引き続き緑であること（振る舞いは変わらないため、既存テストを変更せずそのまま通す）。
5. `pnpm turbo run build|test|lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

`client/src/api/admin.ts` の `fetchAdminWorkers` 等と同じパターンに合わせ、`openApiClient.GET` を素の型付き呼び出しにする。戻り値の検証は既存どおり `unwrap({ result, label })` → `CommunityEngagementSchema.parse(data)` を維持する。実装の関数シグネチャ・エクスポート・呼び出し元（`useCommunityEngagement` フック）は変更しない。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / server / common / docs）

- 対象ワークスペース: `client` のみ（`client/src/api/communityEngagement.ts`）。
- `server` / `common` への変更なし。
- ユーザー可視の振る舞い変更なし（型レベルのリファクタのみ）。

## 6. テスト計画（TDDで書くテスト一覧）

既存の `client/src/api/communityEngagement.test.ts` が `fetchCommunityEngagement` の振る舞い（GET 呼び出し・スキーマ検証・非 2xx での例外）を既にカバーしている。本 Issue は振る舞いを変えない型レベルのリファクタのため、新規テストは追加せず、既存テストが変更後も緑であることを確認する形で TDD サイクルを回す（変更前に既存テストが通ることを確認 → 型キャスト除去 → 既存テストが引き続き緑であることを再確認）。

## 7. リスク・未決事項

- 型付き呼び出しに変えることで型エラーが顕在化するリスクはあるが、`openapi.gen.ts` に該当パスの型が既に存在することを確認済みのため低リスク。
- 未決事項なし。
