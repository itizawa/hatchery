# 設計書: client API の `as unknown as Worker` 型キャストを解消し OpenAPI 生成型と整合させる (#372)

## 1. 目的 / 背景

ADR-0006 は OpenAPI を HTTP 境界の単一情報源とし、`common Zod → server openapi.json → client 型生成 → openapi-fetch` の一方向フローで型安全を保証する方針を定めている。

しかし `client/src/api/workers.ts` と `admin.ts` では、openapi-fetch の戻り型を `Worker`（common）へ橋渡しするために `as unknown as Worker` 二重キャストが使われており、型安全フローがバイパスされている。

根本原因は `WorkerSchema.deletedAt` の型定義にある。

```typescript
// common/src/domain/worker/worker.ts（変更前）
deletedAt: z.union([z.string().datetime(), z.date()]).nullable().optional(),
//                                          ^^^^^^^^ Date オブジェクトを許可
```

`z.date()` により TypeScript 型が `string | Date | null | undefined` となるが、JSON HTTP 境界ではすべての日時は ISO 文字列として転送される（`Date` オブジェクトは存在しない）。このズレが原因で client 生成型と `Worker` 型が非互換となっていた。

## 2. スコープ（やること / やらないこと）

### やること

- `WorkerSchema.deletedAt` を `z.string().datetime().nullable().optional()` に変更
- `client/src/api/workers.ts` の `as unknown as Worker[]` / `as unknown as Worker` キャストを除去
- `client/src/api/admin.ts` の `as unknown as Worker[]` / `as unknown as Worker` キャストを除去
- 上記に対応するテストを `common/src/domain/worker/worker.test.ts` に追加

### やらないこと

- `uploadWorkerImage` の multipart 直 fetch（openapi-fetch 非対応のため、スコープ外）
- `includeDeleted` クエリパラメータの OpenAPI 定義追加（Issue #379 別途）
- `role: string | null`（WorkerRecord）vs `role?: string`（Worker）の乖離修正（別 Issue）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `WorkerSchema.safeParse({ id: "w1", displayName: "Alice", deletedAt: new Date() }).success` が `false` になる（`Date` オブジェクトを受け付けない）
2. `WorkerSchema.safeParse({ id: "w1", displayName: "Alice", deletedAt: "2024-01-01T00:00:00.000Z" }).success` が `true` になる（ISO 文字列は受け付ける）
3. `WorkerSchema.safeParse({ id: "w1", displayName: "Alice", deletedAt: null }).success` が `true` になる（null を受け付ける）
4. `WorkerSchema.safeParse({ id: "w1", displayName: "Alice" }).success` が `true` になる（省略可能）
5. `pnpm typecheck` 通過（`as unknown as Worker` 除去後も型エラーなし）
6. `pnpm turbo run build test lint` 全緑

## 4. 設計方針

### WorkerSchema.deletedAt の変更

```typescript
// 変更前
deletedAt: z.union([z.string().datetime(), z.date()]).nullable().optional(),

// 変更後
deletedAt: z.string().datetime().nullable().optional(),
```

**理由**: HTTP 境界では `deletedAt` は常に ISO 文字列または null。`z.date()` は Prisma の `Date` オブジェクトを処理するサーバー内部型（`WorkerRecord.deletedAt: Date | null`）の都合であり、公開スキーマ（`WorkerSchema`）に含める必要はない。

サーバー内部は `WorkerRecord`（`workerRepository.ts` のインターフェース）で `Date | null` を扱い続けるため影響なし。

### client 側キャストの除去

変更後、`openapi-typescript` が生成する `Worker.deletedAt` 型は `string | null` になる。`Worker`（common）の `deletedAt` も同様に `string | null | undefined` になるため、`data` を直接 `Worker[]` / `Worker` として使えるようになる。

```typescript
// 変更前
return (data ?? []) as unknown as Worker[];

// 変更後
return data ?? [];
```

## 5. 影響範囲

| ファイル | 変更内容 |
|---------|----------|
| `common/src/domain/worker/worker.ts` | `deletedAt` を `z.string().datetime().nullable().optional()` に変更 |
| `common/src/domain/worker/worker.test.ts` | `deletedAt: Date` を拒否するテストを追加 |
| `client/src/api/workers.ts` | `:21`/`:49`/`:69` の `as unknown as Worker` を除去 |
| `client/src/api/admin.ts` | `:81`/`:97` の `as unknown as Worker` を除去、コメント更新 |

## 6. テスト計画（TDD）

`common/src/domain/worker/worker.test.ts` に追加:
- `deletedAt に Date オブジェクトを渡すと parse 失敗する（#372: HTTP 境界は文字列のみ）` → 現在 FAIL（z.date() が許可している）
- `deletedAt に ISO 文字列を渡すと parse 成功する（#372）` → 現在 PASS
- `deletedAt に null を渡すと parse 成功する（#372）` → 現在 PASS
- `deletedAt を省略しても parse 成功する（#372）` → 現在 PASS

## 7. リスク・未決事項

- `formatWorkerDisplayName` の引数型 `deletedAt?: Date | string | null` は `WorkerSchema` と独立しているため、`deletedAt: new Date(...)` を使うテスト（`worker.test.ts:193`）は `WorkerSchema` を経由しないため引き続き通過する。
- サーバー内部の `WorkerRecord.deletedAt: Date | null` は変更しない（Prisma 依存）。
