# 設計書: 定時バッチの Claude API トークン使用量を記録し管理画面の「トークン使用量」で実コストを可視化する (#663)

## 1. 目的 / 背景

`server/src/batch/aiMessageGenerator.ts` の `callClaudeText` は `message.usage` を破棄しており、
定時バッチが Claude API を実際に呼び出しているにもかかわらず `TokenUsageLog` が一切記録されない。
既存の `TokenUsageLogRepository.create()` / 管理画面の「トークン使用量」タブは配線されていない。

「生成境界で usage を取り出して `create()` に渡す配線」を追加することで、実コストを可視化する。

## 2. スコープ（やること / やらないこと）

**やること**
- `callClaudeText` が `{ text, inputTokens, outputTokens, model }` を返すよう変更
- `ConversationGeneratorResult` 型を導入し `ConversationGenerator` の戻り値型を変更
- `runCommunityBatch` が `tokenUsageLogRepository?: TokenUsageLogRepository` を受け取り、
  generate() 成功後に `create()` を呼ぶ
- `communityBatchIndex.ts` で `createPrismaTokenUsageLogRepository` を生成・注入
- 既存テストを新型に追従させ、新テストを追加

**やらないこと**
- `SummaryGenerator` 型は変更しない（あらすじ生成はコスト記録対象外）
- client（管理画面タブ）は変更しない（既存実装をそのまま使う）
- `batchRunLogId` の完全な紐づけ（Prisma の create が返す ID を利用するが、取れなければ `null`）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `generateConversationWithClaude(prompt, apiKey)` の戻り値が
   `{ text: "...", inputTokens: N, outputTokens: M, model: "..." }` を持つ
2. `createClaudeConversationGenerator(model)` で作った generate も同様に usage を返す
3. `runCommunityBatch` に `tokenUsageLogRepository` を注入し、generate が usage を返したとき
   `create({ model, inputTokens, outputTokens, batchRunLogId })` が呼ばれる
4. `tokenUsageLogRepository` 未注入時は `create()` が呼ばれない
5. generate が usage を持たない（`inputTokens` が undefined）場合も `create()` が呼ばれない
6. API キー未設定・community 0 件でスキップした場合は `create()` が呼ばれない
7. `communityBatchIndex.ts` の `main()` が `createPrismaTokenUsageLogRepository` を生成・注入する
8. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 型変更

```typescript
// aiMessageGenerator.ts に追加
export type ConversationGeneratorResult = {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
};

// 既存型を変更
export type ConversationGenerator = (
  prompt: string,
  apiKey: string,
) => Promise<ConversationGeneratorResult>;
```

usage フィールドをオプショナルにすることで、テストスタブが `{ text: "..." }` のみ返す場合も
型エラーなく動作し、`runCommunityBatch` 側で undefined チェックにより記録をスキップできる。

### runCommunityBatch への追加

`RunCommunityBatchDeps` に `tokenUsageLogRepository?: TokenUsageLogRepository` を追加。
generate() 直後に usage 情報を変数に保持し、`batchRunLogRepository.create()` の結果
（`batchRunLogId`）と合わせて `tokenUsageLogRepository.create()` を呼ぶ。

## 5. 影響範囲 / 既存への変更

- **server**: `aiMessageGenerator.ts` / `runCommunityBatch.ts` / `communityBatchIndex.ts`
- **server テスト**: `aiMessageGenerator.test.ts` / `runCommunityBatch.test.ts` / `communityBatchIndex.test.ts`
- **client**: 変更なし（既存タブをそのまま使う）
- **common**: 変更なし

## 6. テスト計画（TDD で書くテスト一覧）

### aiMessageGenerator.test.ts（新規テスト）
- `generateConversationWithClaude` が `message.usage` から `inputTokens` / `outputTokens` / `model` を返す
- `createClaudeConversationGenerator` で作った関数も同様

### runCommunityBatch.test.ts（新規テスト）
- `tokenUsageLogRepository` 注入 + generate が usage を返す → `create()` が呼ばれる（正しい引数）
- `tokenUsageLogRepository` 未注入 → `create()` が呼ばれない
- generate が usage を持たない → `create()` が呼ばれない

### 既存テストの追従
- 全テストの `vi.fn().mockResolvedValue(string)` を `{ text: string }` 形式に変更
- `communityBatchIndex.test.ts` の generate 型注釈を更新

## 7. リスク・未決事項

- `createBatchConversationGenerator`（Batches API 経路）は `BatchResultLike` の `message.usage`
  を利用できるか不確定。型定義を更新して取り出すが、実際に usage が返るかは本番でのみ確認可能。
  optional のため実害なし。
- `batchRunLogId` はバッチ実行ログ作成後に取得するため、`tokenUsageLogRepository.create()`
  の呼び出し順を `batchRunLogRepository.create()` の後にする。
