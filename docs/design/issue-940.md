# 設計書: aiMessageGenerator.ts の SUMMARY_MODEL をハードコードせず BATCH_MODEL 環境変数で制御できるようにする (#940)

## 1. 目的 / 背景

`server/src/batch/aiMessageGenerator.ts:37` の `SUMMARY_MODEL` がハードコード（`"claude-sonnet-4-6"` 固定）されており、`BATCH_MODEL` 環境変数が効かない。`BATCH_MODEL=claude-haiku-4-5` でコストダウンを図っても、あらすじ生成だけは常に高コストモデルを使い続ける問題を解消する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `SUMMARY_MODEL` 定数を削除し、`createSummaryGenerator(model)` ファクトリを追加する
- `generateSummaryWithClaude` を `createSummaryGenerator(DEFAULT_BATCH_MODEL)` で実装し直す
- `aiMessageGenerator.test.ts` に `createSummaryGenerator` のモデル注入テストを追加する

**やらないこと:**
- あらすじ生成モデルをシーン生成と独立した別 env 変数で制御する（将来拡張）
- `generateSummaryWithClaude` の呼び出し側の配線変更（現状どのバッチスクリプトからも呼ばれていないため不要）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `SUMMARY_MODEL` 定数が削除され、`createSummaryGenerator(model)` ファクトリが追加される
2. `generateSummaryWithClaude` は `createSummaryGenerator(DEFAULT_BATCH_MODEL)` として実装される
3. `createSummaryGenerator("claude-haiku-4-5")` が返す SummaryGenerator は `model: "claude-haiku-4-5"` で `messages.create` を呼ぶ
4. `generateSummaryWithClaude` は `model: DEFAULT_BATCH_MODEL（="claude-sonnet-4-6"）` で呼ぶ（後方互換）
5. `pnpm turbo run build test --filter=@hatchery/server` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

`createClaudeConversationGenerator(model)` と対称的なパターンで `createSummaryGenerator(model)` を追加する。

```typescript
// Before
const SUMMARY_MODEL: BatchModel = "claude-sonnet-4-6";
export const generateSummaryWithClaude: SummaryGenerator = async (prompt, apiKey) => {
  const result = await callClaudeText({ ..., model: SUMMARY_MODEL, ... });
  return result.text;
};

// After
export function createSummaryGenerator(model: BatchModel): SummaryGenerator {
  return async (prompt, apiKey) => {
    const result = await callClaudeText({ ..., model, ... });
    return result.text;
  };
}
export const generateSummaryWithClaude: SummaryGenerator = createSummaryGenerator(DEFAULT_BATCH_MODEL);
```

## 5. 影響範囲 / 既存への変更

- `server/src/batch/aiMessageGenerator.ts`: `SUMMARY_MODEL` 定数削除・`createSummaryGenerator` 追加・`generateSummaryWithClaude` 書き換え
- `server/src/batch/aiMessageGenerator.test.ts`: `createSummaryGenerator` のテスト追加・`generateSummaryWithClaude` の model テスト追加

ユーザー可視の振る舞いは変わらない（純粋なリファクタ＋テスト追加）。

## 6. テスト計画（TDDで書くテスト一覧）

- `createSummaryGenerator`: 指定モデルで `messages.create` が呼ばれる（`claude-haiku-4-5`）
- `createSummaryGenerator`: 生成テキストを文字列で返す
- `generateSummaryWithClaude`: デフォルトモデル（`claude-sonnet-4-6`）で `messages.create` が呼ばれる

## 7. リスク・未決事項

- `generateSummaryWithClaude` の呼び出し側が存在しないため、呼び出し側の配線（AC5）は不要と判断。  
  ただし Issue 本文に「`runCommunityBatch.ts` 等」とあるため、その記載は設計書に反映する（現状では不要）。
