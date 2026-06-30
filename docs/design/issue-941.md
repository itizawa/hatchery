# 設計書: MODEL_PRICING を satisfies Record で型安全にし ALLOWED_BATCH_MODELS との乖離を型エラーで検出する (#941)

## 1. 目的 / 背景

`server/src/config/env.ts` の `ALLOWED_BATCH_MODELS` と `common/src/domain/tokenUsageLog/tokenPricing.ts` の `MODEL_PRICING` が独立管理されており、新モデル追加時に `MODEL_PRICING` への追加漏れを型・CI で検出できない。
`calculateCostUsd` は未知モデルで 0 を返してサイレント失敗するため、コスト計測の精度が損なわれるリスクがある。

## 2. スコープ（やること / やらないこと）

### やること

- `ALLOWED_BATCH_MODELS` / `BatchModel` を `common/src/domain/tokenUsageLog/tokenPricing.ts` に移動する
- `MODEL_PRICING` に `satisfies Record<BatchModel, ...>` を付与し、型レベルで網羅性を強制する
- `server/src/config/env.ts` で `ALLOWED_BATCH_MODELS` / `BatchModel` を `@hatchery/common` から import し re-export（既存 server 内 import を壊さない）する
- `tokenPricing.test.ts` に「ALLOWED_BATCH_MODELS の全モデルが MODEL_PRICING に含まれる」テストを追加する

### やらないこと

- `DEFAULT_BATCH_MODEL` の移動（server の設定値であり common に置く必要はない）
- `calculateCostUsd` のシグネチャ変更（未知モデルで 0 を返す既存挙動の変更）
- server 内の BatchModel import パス変更（`server/src/config/env.ts` が re-export するので不要）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `common/src/domain/tokenUsageLog/tokenPricing.ts` に `ALLOWED_BATCH_MODELS` と `BatchModel` が定義されている
2. `MODEL_PRICING` が `satisfies Record<BatchModel, { inputPerMToken: number; outputPerMToken: number }>` を持つ
3. `ALLOWED_BATCH_MODELS` に存在するが `MODEL_PRICING` に存在しないモデルがある場合、`tsc` がエラーを出す（型安全性）
4. `tokenPricing.test.ts` に「ALLOWED_BATCH_MODELS の全モデルが MODEL_PRICING に含まれる」テストが追加されている
5. `server/src/config/env.ts` が `@hatchery/common` から `BatchModel` / `ALLOWED_BATCH_MODELS` を import している
6. `pnpm turbo run build test --filter=@hatchery/common --filter=@hatchery/server` が緑
7. 一方向 import 境界（common → server 禁止）を維持する

## 4. 設計方針

### BatchModel を common に移動する理由

- `MODEL_PRICING`（コスト計算の純粋ロジック）は common に属する
- `satisfies Record<BatchModel, ...>` を付与するには `BatchModel` が common からアクセス可能でなければならない
- common → server の import は ESLint で禁止されているため、server の型を参照できない
- よって `ALLOWED_BATCH_MODELS` / `BatchModel` を common に移動し、server が common から import する（正しい依存方向）

### server での re-export

`aiMessageGenerator.ts` 等が `../config/env.js` から `BatchModel` を import しているため、
`server/src/config/env.ts` で `export type { BatchModel } from "@hatchery/common"` と
`export { ALLOWED_BATCH_MODELS } from "@hatchery/common"` を行い、既存 import パスを壊さない。

## 5. 影響範囲 / 既存への変更

- `common/src/domain/tokenUsageLog/tokenPricing.ts`: `ALLOWED_BATCH_MODELS` / `BatchModel` 追加、`MODEL_PRICING` の `satisfies` 更新
- `server/src/config/env.ts`: 同定数・型の定義削除、common からの import + re-export に変更

## 6. テスト計画（TDDで書くテスト一覧）

1. `ALLOWED_BATCH_MODELS` の全モデルが `MODEL_PRICING` のキーに存在する（ランタイム保証テスト）

## 7. リスク・未決事項

- 既存の `server` 内 import（`aiMessageGenerator.ts` 等）は re-export で互換性を維持するため影響なし
- TypeScript project references が正しく設定されていれば `tsc -b` で型エラーを確認可能
