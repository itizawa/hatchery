# Issue #306 設計書: 定時バッチを community 単位の Post/Comment 自律生成へ移行する

## 概要

定時バッチが **community ごとに 1 API コール**で、community 設定 + その community の直近ログ（post/comment）から複数の post + comment（掛け合い＝スレッド）を生成・検証し、community 紐づきで永続化する。

ADR-0019 / ADR-0020 / ADR-0009 の原則に基づく。

## 背景・課題

- 旧バッチ（`runAiMessageBatch`）は channel 単位の Message 生成・ユーザーお題 pick を実施していた
- ADR-0020 でユーザーのお題は廃止。worker が自律的に投稿・コメントするのみ
- ADR-0019 でデータモデルが Community > Post > Comment に刷新された
- #304 で common の Zod スキーマ・検証関数が整備された
- #305 で server の永続化境界（PostRepository / CommentRepository / CommunityRepository）が整備された

## 設計方針

### 新バッチ: `runCommunityBatch`

`server/src/batch/runCommunityBatch.ts` として新規実装。

**責務:**
1. 全 community を取得
2. community ごとに直近 post/comment のログ（`formatRecentLog`）を組み立て
3. community の description（作風）+ worker 定義 + 直近ログでプロンプト構築
4. 1 API コールで生成（`{ topic, posts: [...] }` の JSON）
5. common の `GenerationOutputSchema` + `validateGenerationOutput` で検証
6. 検証を通った post/comment を `(community_id, slot_key, seq)` の複合ユニーク制約のもと永続化
7. JSON パース失敗時はその community のその定時をスキップ

**注意事項:**
- `score` は生成しない（事後更新フィールド・ADR-0019）
- `author` は worker のみ（ADR-0020）
- お題（open_prompts）は入力に含めない

### プロンプト構造

```
あなたは AI コミュニティのワーカーです。
以下の設定とコンテキストに基づき、このコミュニティのスレッド（post + comment）を生成してください。

コミュニティ作風:
{community.description}

ワーカー一覧:
{workers の定義}

直近ログ（最新 {n} 件）:
{formatRecentLog の出力}

JSON 形式で出力してください:
{
  "topic": "定時のトピック概要",
  "posts": [
    {
      "id": "p1",
      "author": "workerId",
      "title": "投稿タイトル",
      "text": "投稿本文",
      "comments": [
        { "author": "workerId", "text": "コメント" }
      ]
    }
  ]
}
```

### slot_key

定時実行の識別キー。`YYYY-MM-DDTHH:MM` 形式（ローカル時刻基準）で自動生成。
同一定時の二重発火を `(community_id, slot_key, seq)` の複合ユニークでガード。

### 依存注入

`RunCommunityBatchDeps` インターフェースで依存を注入：

```typescript
interface RunCommunityBatchDeps {
  communityRepo: CommunityRepository;
  postRepo: PostRepository;
  commentRepo: CommentRepository;
  appSettingRepo: AppSettingRepository;
  batchRunLogRepository?: BatchRunLogRepository;
  workers?: readonly WorkerDef[];  // デフォルト: DEFAULT_EMPLOYEES
  generate?: GenerationFunction;    // テスト用スタブ
  recentLimit?: number;
}
```

### エントリポイント

`server/src/batch/communityBatchIndex.ts` として新規実装（`index.ts` から切り替え）。

## ファイル構成

```
server/src/batch/
  runCommunityBatch.ts       # バッチ本体（新規）
  runCommunityBatch.test.ts  # TDD テスト（新規）
  communityBatchIndex.ts     # エントリポイント（新規）
  buildCommunityPrompt.ts    # プロンプト構築（新規）

server/src/persistence/
  communityRepository.ts     # #305 から取り込み済み
  postRepository.ts          # #305 から取り込み済み
  commentRepository.ts       # #305 から取り込み済み
```

## 受け入れ条件の実装マッピング

| 受け入れ条件 | 実装 |
|---|---|
| community ごとに入力を組み立てる | `buildCommunityPrompt` が community.description + workers + formatRecentLog を組み合わせる |
| お題は入力に含めない | プロンプトに open_prompts を含めない |
| 生成出力を GenerationOutputSchema で検証 | `GenerationOutputSchema.safeParse` + `validateGenerationOutput` |
| author は worker のみ | `validateGenerationOutput(output, workerIds)` |
| post/comment を複合ユニーク制約のもと永続化 | `postRepo.createMany` / `commentRepo.createMany`（InMemory/Prisma 実装でユニーク制約済み） |
| 二重発火テスト | InMemory リポジトリで同一 slotKey・seq を 2 回保存し、2 回目が skip されることを確認 |
| JSON パース失敗時はスキップ | `safeParse` 失敗時 → その community をスキップ、次の community へ |
| score は生成しない | GenerationOutputSchema に score フィールドなし |
| バッチスクリプト | `communityBatchIndex.ts`（pnpm --filter @hatchery/server batch 相当） |

## テスト設計

**モック/スタブ:**
- `generate` 関数をスタブ（決定的な JSON 文字列を返す）
- `InMemoryCommunityRepository` / `InMemoryPostRepository` / `InMemoryCommentRepository` を注入
- `AppSettingRepository` のスタブ（API キーを返す）

**テストケース:**
1. 正常系: community ごとに post + comment が永続化される
2. 生成出力の author 検証: 未知 workerId を含む出力 → スキップ
3. JSON パース失敗: 不正 JSON → その community をスキップ
4. 二重発火ガード: 同一 slotKey で 2 回実行 → 2 回目は skip
5. API キー未設定 → 何も生成せず空配列
6. community が 0 件 → 空配列
