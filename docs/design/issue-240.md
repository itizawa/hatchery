# 設計書: fix: 仮想オフィスが 404 になる問題を修正し、DB 上の Bot Employee を実際に表示する (#240)

## 1. 目的 / 背景

`OfficeScene.tsx` は実装済みだが、`router.tsx` に `/office` ルートが未登録のため 404。
また `DEFAULT_EMPLOYEES`（ハードコード定数）を使用しており DB 上の Bot Employee を反映していない。
`GET /api/employees` エンドポイントも未実装。これらを一括修正する。

## 2. スコープ（やること / やらないこと）

**やること**
- `EmployeeRepository` インターフェースに `listBotEmployees()` を追加
- `InMemoryEmployeeRepository` / `PrismaEmployeeRepository` に実装
- `GET /api/employees` エンドポイントを追加（認証不要、isBot=true の Employee を返す）
- OpenAPI registry に `GET /api/employees` を登録
- `client/src/api/employees.ts` に `useBotEmployees()` フックを新規作成
- `OfficeScene.tsx` を `useBotEmployees()` を使う形に更新
- `router.tsx` に `/office` ルートを追加（`requireAuth` ガード付き）

**やらないこと**
- 非 Bot Employee（isBot=false）の一覧表示
- オフィスの座標をサーバに永続化する機能
- RootLayout サイドバーのリンク追加（既に存在する）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `InMemoryEmployeeRepository.listBotEmployees()` が `isBot: true` の Employee のみを返す
2. `InMemoryEmployeeRepository.listBotEmployees()` が Bot でない Employee を含まない
3. `GET /api/employees` が 200 で `isBot: true` の Employee[] を返す
4. `GET /api/employees` は認証不要（未ログインでも 200 を返す）
5. `/office` ルートへのアクセスで `OfficeScene` が表示される（ルート登録済み）
6. `OfficeScene` が `DEFAULT_EMPLOYEES` ではなく API データを使う

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `listBotEmployees(): Promise<EmployeeRecord[]>` を `EmployeeRepository` インターフェースに追加
- Prisma: `prisma.employee.findMany({ where: { isBot: true } })`
- InMemory: `this.employees.filter((e) => e.isBot)`
- エンドポイント: `GET /api/employees` は認証不要（`requireAuth` なし）。既存の `PATCH /:id` と同じルータに追加
- client 側は `useChannels()` と同パターン（`useSuspenseQuery` + `openApiClient.GET`）
- `OfficeScene` は `Suspense` でラップして `useBotEmployees()` を使う

## 5. 影響範囲 / 既存への変更

- **server**: `employeeRepository.ts`（インターフェース＋InMemory）、`prismaEmployeeRepository.ts`、`routes/employees.ts`、`openapi/registry.ts`
- **client**: `api/employees.ts`（新規）、`routes/OfficeScene.tsx`、`router.tsx`
- **common**: 変更なし
- **docs**: 変更なし

## 6. テスト計画（TDD で書くテスト一覧）

### server
- `employeeRepository.test.ts`: `listBotEmployees()` — Bot のみ返す / Bot でないを除外 / 空なら空配列
- `employees.test.ts`: `GET /api/employees` — 200 で Bot Employee[] / 認証不要

### client
- `OfficeScene.test.tsx`: コンポーネントが `useBotEmployees` データを受け取りレンダリングされる
- `router.tsx` に `/office` ルートが登録されていること（型レベルで確認）

## 7. リスク・未決事項

- OpenAPI 生成（`pnpm openapi`）はコミット対象外のため CI 上でのみ実行。client の `gen-types` も同様
- `OfficeView` コンポーネントの `employees` prop 型が `EmployeeRecord` と互換か要確認（OfficeView を読む）
