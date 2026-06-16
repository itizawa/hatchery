# 設計書: Issue #597 — selectOneCommunity 等の純粋ロジックを runCommunityBatch から分離する

## 背景と目的

`server/src/batch/runCommunityBatch.ts`（383 行）に純粋関数として抽出できるロジックが内包されていた。
ADR-0005 の方針では vote 重み付き選定のような純粋ドメインロジックは `common` で TDD すべきとされている。

本 Issue では以下の 2 関数を純粋モジュールへ抽出し、単体テスト可能にする。

## 抽出対象と移設先

### 1. `generateSlotKey` → `common/src/logic/generateSlotKey.ts`

- **型**: `(now?: Date) => string`
- **性質**: 完全な純粋関数。UTC 基準で `"YYYY-MM-DDTHH:MM"` 形式の定時キーを生成する。
- **移設先**: `common/src/logic/` — DOM/Node/Express/Prisma 依存なし。
- **理由**: 日時のフォーマット変換のみで副作用なし。`common` に置いて単体テストできる。

### 2. `buildCommunityWeights` → `common/src/logic/buildCommunityWeights.ts`

- **型**: `(communityIds: readonly string[], netScores: ReadonlyMap<string, number>) => CommunityWeight[]`
- **性質**: 純粋関数。community ID 配列と net vote スコア Map を受け取り、重み付き選定に使う `CommunityWeight[]` を返す。
- **移設先**: `common/src/logic/` — DB アクセスなし。
- **理由**: 元の `selectOneCommunity` 内の重み計算ロジック（`Math.max(0, score) + 1`）を切り出すことで、DB を介さずに単体テストできる。
- **分離方針**: `selectOneCommunity` 自体は `voteRepo.netScoresByCommunitySince()` という非同期 I/O を含むため `server` に残る。ただし、重み計算のみを `buildCommunityWeights` に委譲するよう orchestration に縮小する。

## runCommunityBatch の変更

`selectOneCommunity` は `runCommunityBatch.ts` 内に残るが、内部で `buildCommunityWeights` を呼ぶ形に縮小する。これにより:

- バッチ本体はオーケストレーションに専念。
- 純粋判定部は `common` でユニットテスト可能。
- `generateSlotKey` は `runCommunityBatch.ts` からの re-export をやめ、`common` から直接インポートする。

## common/src/index.ts の更新

新しい 2 モジュールを `export *` で公開する:

```typescript
export * from "./logic/generateSlotKey.js";
export * from "./logic/buildCommunityWeights.js";
```

## 受け入れ条件の対応

1. **純粋判定部の抽出と単体テスト** → `generateSlotKey` + `buildCommunityWeights` を `common` に抽出し、各テストファイルを追加。
2. **runCommunityBatch の orchestration への縮小** → `selectOneCommunity` 内の重み計算を `buildCommunityWeights` に委譲。
3. **既存バッチ統合テストは緑のまま** → `runCommunityBatch.test.ts` を変更せず（`generateSlotKey` re-export も維持）。
4. **pnpm turbo run build test lint が緑** → 確認済み。
5. **一方向 import 境界の遵守** → `common` → `server` は参照しない。`server` → `common` のみ。
