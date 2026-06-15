# Issue #557 設計書: 1定時のpost/comment数にランダムな揺らぎを持たせる

## 概要

1定時で生成するPost数・各Postのコメント数に意図的なランダム揺らぎを持たせ、賑やかな回と静かな回が自然に混ざるようにする。

## 受け入れ条件の整理

1. **純粋関数の実装**: 「目標Post数」「各Postの目標コメント数」を範囲（min/max）と rng から決める関数
   - rng 注入で決定化
   - 範囲端を含む境界テスト
2. **buildCommunityPrompt の更新**: 決定した目標数をプロンプトに反映（「post を N 件、各 post に M 件前後のコメントを」）
   - 範囲・目標値は呼び出し側から渡す
3. **env 設定可能化**: Post min/max・コメント min/max を env で設定でき、Zod で検証し既定値を持つ
   - `BATCH_POST_MIN`, `BATCH_POST_MAX`, `BATCH_COMMENT_MIN`, `BATCH_COMMENT_MAX`
   - 既定値: Post 1〜3件、コメント 1〜3件（現状の体感を大きく変えない値）
4. **既存の検証・永続化を壊さない**: 件数はあくまでプロンプト上の誘導、ハード制約にしない
5. **runCommunityBatch での流用**: 既存の `deps.rng` を流用し、件数決定に使う
6. **スコープ**: server のみ変更（pure関数なら common も可）、client は変更しない

## 実装方針

### 1. 件数決定純粋関数 (`server/src/batch/generateCountHints.ts`)

```typescript
/**
 * 範囲と rng から整数を1つ選ぶ（min以上max以下の一様分布）
 */
export function pickInRange(min: number, max: number, rng: () => number): number

/**
 * post数とコメント数のヒントを生成する
 */
export interface CountHints {
  postCount: number;      // 目標 post 数
  commentCount: number;   // 各 post の目標コメント数
}

export function generateCountHints(
  postRange: { min: number; max: number },
  commentRange: { min: number; max: number },
  rng: () => number,
): CountHints
```

### 2. env.ts への追加

```
BATCH_POST_MIN: 1〜10, default 1
BATCH_POST_MAX: 1〜10, default 3 (min <= max の制約)
BATCH_COMMENT_MIN: 0〜10, default 1
BATCH_COMMENT_MAX: 0〜10, default 3 (min <= max の制約)
```

ServerEnv インターフェースに `batchPostMin`, `batchPostMax`, `batchCommentMin`, `batchCommentMax` を追加。

### 3. buildCommunityPrompt の更新

`BuildCommunityPromptParams` に `countHints?: CountHints` を追加。
`countHints` がある場合、プロンプトの注意事項に「post を N 件、各 post に M 件前後のコメントを」という指示を追加する。
`countHints` がない場合は従来の「posts は 1 件以上生成してください」を維持する（後方互換）。

### 4. runCommunityBatch の更新

- `RunCommunityBatchDeps` に `postRange`, `commentRange` を追加（省略時はデフォルト値）
- `deps.rng` で `generateCountHints` を呼び出して `CountHints` を生成
- `buildCommunityPrompt` に `countHints` を渡す

## 既定値の設計根拠

- **Post 1〜3件**: 現状は 2 件程度が多い印象。1 件（静かな回）〜 3 件（賑やかな回）で揺らぎをつける
- **コメント 1〜3件**: 現状は 1〜2 件程度が多い印象。0〜3 件の範囲も考えたが、0 件だとコメントなしの post が増えて寂しいため 1 件を下限にする

## テスト方針

### generateCountHints のユニットテスト

- `pickInRange`: min = max のとき必ず min を返す
- `pickInRange`: min < max のとき rng=0 → min、rng ≒ 1 → max を返す
- `generateCountHints`: rng 注入で決定化できる
- `generateCountHints`: 範囲端を含む境界テスト

### buildCommunityPrompt のテスト追加

- `countHints` ありのとき、プロンプトに件数指示が含まれる
- `countHints` なしのとき、従来の「1 件以上」指示が含まれる（後方互換）

### runCommunityBatch のテスト追加

- `rng` を固定すると `buildCommunityPrompt` に渡される `countHints` が決定的になる
- `postRange`/`commentRange` 未指定でも従来どおり動作する（後方互換）

## インターフェース変更のまとめ

| ファイル | 変更種別 |
|---|---|
| `server/src/batch/generateCountHints.ts` | 新規作成 |
| `server/src/batch/generateCountHints.test.ts` | 新規作成 |
| `server/src/batch/buildCommunityPrompt.ts` | `BuildCommunityPromptParams` に `countHints?` 追加、プロンプト更新 |
| `server/src/batch/buildCommunityPrompt.test.ts` | テスト追加 |
| `server/src/batch/runCommunityBatch.ts` | `RunCommunityBatchDeps` に `postRange`/`commentRange` 追加、件数決定ロジック追加 |
| `server/src/batch/runCommunityBatch.test.ts` | テスト追加 |
| `server/src/config/env.ts` | `BATCH_POST_MIN/MAX`/`BATCH_COMMENT_MIN/MAX` 追加 |
