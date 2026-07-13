# 設計書: server route factory関数(createXRouter)の位置引数DIをオブジェクト引数化する (#1174)

## 1. 目的 / 背景

CLAUDE.md「関数引数規約（#720）」は引数2個以上の関数をオブジェクト引数に統一するよう定めている。`server/src/routes/` 配下の9つの router factory 関数（`createAdminRouter` 等）が、DI 依存を位置引数のまま `eslint-disable-next-line max-params` で通しており、規約の例外（Express ミドルウェア・配列コールバック）に該当しない。他の router factory（`createWorkersRouter`・`createDashboardRouter`・`createFeedRouter` 等）は既にオブジェクト引数化済みで、本 Issue はこれと同じパターンに揃える。

## 2. スコープ（やること / やらないこと）

**やること**:
- 以下9ファイルの `createXxxRouter(a, b, c, ...)` を `createXxxRouter({ a, b, c, ... }: { ... })` 形式に変更する。
  - `admin.ts`（`createAdminRouter`）
  - `adminCommunityImage.ts`（`createAdminCommunityImageRouter`）
  - `adminCommunityWorkers.ts`（`createAdminCommunityWorkersRouter`）
  - `adminWorkerCommunities.ts`（`createAdminWorkerCommunitiesRouter`）
  - `adminWorkerImage.ts`（`createAdminWorkerImageRouter`）
  - `auth.ts`（`createAuthRouter`）
  - `communities.ts`（`createCommunitiesRouter`）
  - `posts.ts`（`createPostsRouter`）
  - `sitemap.ts`（`createSitemapRouter`）
- 呼び出し元（`server/src/app.ts`・`server/src/routes/auth.test.ts`）を新シグネチャに追従させる。
- 対象9ファイルの factory 関数直前の `eslint-disable-next-line max-params` を削除する。

**やらないこと**:
- ルータ内部の `.get()/.post()` ハンドラ（`(req, res, next)`）は Express ミドルウェア例外のため対象外。位置引数のまま維持する。
- `apiDocs.ts`・`health.ts`・`feed.ts` 等、既にオブジェクト引数化済み・対象外と Issue 本文で明記された router は対象外。
- ルーティング挙動・レスポンス形状の変更は一切行わない（シグネチャのみの変更）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. 上記9ファイルの `createXxxRouter` が名前付きオブジェクト引数を受け取ること（`grep` で位置引数の呼び出しが残っていないことを確認）。
2. `server/src/app.ts` の呼び出しが全てオブジェクト引数形式に更新されていること。
3. `server/src/routes/auth.test.ts` の `createAuthRouter` 呼び出しがオブジェクト引数形式に更新されていること。
4. 変更した9ファイルすべてで factory 関数直前の `eslint-disable-next-line max-params` が削除されていること。
5. `pnpm turbo run build|test|lint` が緑であること。既存のルーティング挙動・テスト（`admin.test.ts`・`communities.test.ts`・`posts.test.ts`・`sitemap.test.ts` 等、`createApp` 経由の統合テスト）が全て変更前と同じ結果で通ること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- 既存のオブジェクト引数パターン（`createWorkersRouter`・`createDashboardRouter`・`createFeedRouter`）に完全準拠する。分割代入 + インライン型注釈（`{ a, b }: { a: TypeA; b: TypeB }`）の形式を踏襲する。
- 引数名はそれぞれの実装ファイル内で既に使われているローカル変数名（例: `workerRepository`・`communityRepo` 等）をそのままプロパティ名として使う。呼び出し元のプロパティ名もこれに合わせる。
- 本 Issue は**純粋なシグネチャ変更**であり、ロジック・レスポンス形状・ルーティングパスは一切変更しない。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: server）

- `server/src/routes/{admin,adminCommunityImage,adminCommunityWorkers,adminWorkerCommunities,adminWorkerImage,auth,communities,posts,sitemap}.ts`（シグネチャ変更）
- `server/src/app.ts`（呼び出し元、9箇所）
- `server/src/routes/auth.test.ts`（呼び出し元、2箇所）
- client・common への影響なし（server 内部の DI シグネチャ変更のみ、HTTP 契約・OpenAPI に変化なし）。

## 6. テスト計画（TDDで書くテスト一覧）

本 Issue はロジック変更を伴わない**シグネチャ変更のみのリファクタ**のため、新しい振る舞いに対するテストケースは存在しない。TDD の「まずテストを書く」は以下の形で行う:

1. **red**: `server/src/routes/auth.test.ts` の `createAuthRouter(...)` 呼び出し2箇所を先にオブジェクト引数形式（新シグネチャ）へ書き換える。この時点では `auth.ts` 側のシグネチャがまだ位置引数のままのため、TypeScript の型エラーで **red**（`pnpm --filter @hatchery/server typecheck` 失敗）になることを確認する。
2. **green**: 9ファイルの factory 関数シグネチャをオブジェクト引数に変更し、`app.ts` の呼び出し9箇所を追従させることで型エラーを解消する。
3. **回帰確認**: 上記以外の8つの factory は呼び出し元が `app.ts` のみで直接のシグネチャレベル単体テストが無いため、既存の統合テスト（`admin.test.ts`・`admin.communities.test.ts`・`admin.posts.test.ts`・`adminCommunityImage.test.ts`・`adminCommunityWorkers.test.ts`・`adminWorkerCommunities.test.ts`・`adminWorkerImage.test.ts`・`communities.test.ts`・`posts.test.ts`・`sitemap.test.ts`）が `createApp`/`AppDeps` 経由で該当ルータを exercise しており、これらが全緑であることでシグネチャ変更後もランタイム挙動が変わっていないことを保証する。
4. `pnpm turbo run build|test|lint` を最終確認として実行する。

## 7. リスク・未決事項

- 呼び出し元の引数名とプロパティ名の対応を誤ると `app.ts` 側で型エラーになるため、変更は1ファイルずつ丁寧に対応させる。
- ユーザー可視の振る舞い変更は無いため、`e2e/` usecases の更新は不要（PR 本文にその旨を明記する）。
