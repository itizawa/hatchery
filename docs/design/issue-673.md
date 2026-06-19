# 設計書: comment 生成バッチを分離し直近3日の post/comment へ vote 重みで付与する (#673)

## 1. 目的 / 背景

#672（post バッチ分離）に続き、**comment 生成を独立バッチに分離**する。これにより：

- post バッチ（1日1回）と comment バッチ（1日4回・従来頻度）が独立してスケジュール実行できる。
- comment バッチは直近3日の post を対象に、post の vote スコアで重み付けした件数のコメントを生成する（人気の高い post により多くのコメントが付く）。
- 稀に3日超の古い post を活性化することで、埋もれた議題に再び注目が集まる体験を作る。
- ADR-0034 の「#673 完了時点: communityBatchIndex を retire」を達成する。

## 2. スコープ（やること / やらないこと）

### やること
- `commentBatchIndex.ts`（エントリポイント）+ `runCommentBatch.ts`（本体）の新規作成
- `CommentBatchOutputSchema` を common に追加（comment-only 生成出力スキーマ）
- `PostRepository` に `listRecentByCommunity` / `listOldByCommunity` を追加
- vote 重み付きコメント数計算の純粋関数（`calcCommentCounts.ts`）
- comment バッチ用プロンプトビルダー（`buildCommentBatchPrompt.ts`）
- comment バッチ用永続化（`persistCommentBatchOutput.ts`）
- 全コミュニティ並列実行（ADR-0033 踏襲）

### やらないこと
- Cloud Scheduler のジョブ登録変更（インフラ作業・手動）
- communityBatchIndex のコード削除（古い post/comment 混合バッチ）
- vote による post ランキング画面の変更
- ワーカー登場ローテーション更新（post バッチ担当・comment バッチは更新しない）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. comment バッチ専用エントリポイントが `commentBatchIndex.ts` として存在し、`communityBatchIndex.ts` と同じ構造で実行できる
2. 全コミュニティを Promise.allSettled で並列処理する（1コミュニティの失敗が他に波及しない）
3. 対象 post は `createdAt >= now - 3日` の投稿（直近3日）に限定される
4. 各 post のコメント数 = `clamp(base + round(k × max(0, score)), min, max)` で計算される（base=1, k=0.5, min=1, max=5）
5. vote 0 でも base=1 件のコメントが生成される
6. vote が多い post ほど多くのコメントが生成される
7. 確率 `p=0.1` で古い post（直近3日超）を1件追加する
8. 確率判定・件数計算は rng 注入で決定化してテスト可能
9. 生成は 1 コミュニティ = 1 API コール（ADR-0030 の post-comment 分離後方針）
10. GenerationOutputSchema の代わりに `CommentBatchOutputSchema` を使用する
11. drip + reveal フィルタでコメントの公開時刻を散らす
12. BatchRunLog と TokenUsageLog を各コミュニティ毎に記録する
13. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### 4.1 CommentBatchOutputSchema（common）

comment バッチの AI 出力は「既存 post への comment 追加」なので、`GenerationOutputSchema`（posts.min(1)）は使えない。新しいスキーマを common に追加する：

```typescript
// 既存の GenerationOutputCommentSchema を再利用
CommentBatchPostOutputSchema = z.object({
  ref: z.string().min(1).max(50),  // "ref-1" → 既存 post ID
  comments: z.array(GenerationOutputCommentSchema),
});

CommentBatchOutputSchema = z.object({
  topic: z.string().min(1).max(200),
  posts: z.array(CommentBatchPostOutputSchema).min(1),
});
```

`posts[i].ref` が postRefMap 経由で実際の postId に変換される（既存の `replies` 機能と同様）。

### 4.2 PostRepository 新メソッド

```typescript
// 直近 N 日以内の post を取得（コメントバッチの対象選定）
listRecentByCommunity(communityId: string, since: Date, limit?: number): Promise<PostRecord[]>

// 指定日時より前の post を score 降順で取得（古い post 活性化の候補）
listOldByCommunity(communityId: string, before: Date, limit?: number): Promise<PostRecord[]>
```

### 4.3 vote 重みコメント数計算（純粋関数）

```typescript
// calcCommentCounts.ts
const COMMENT_BATCH_BASE = 1;   // vote 0 でも最低 1 件
const COMMENT_BATCH_K = 0.5;    // vote スコア 1 あたり 0.5 件追加
const COMMENT_BATCH_MIN = 1;    // 下限
const COMMENT_BATCH_MAX = 5;    // 上限
const REVIVAL_PROBABILITY = 0.1; // 古い post 活性化確率 10%

function calcCommentCount(score: number): number
  → clamp(base + round(k × max(0, score)), min, max)

function pickOldPostForRevival(
  oldPosts: readonly PostRecord[],
  p: number,
  rng: () => number,
): PostRecord | null
```

### 4.4 古い post の選定方針

- `listOldByCommunity` は score 降順で最大 20 件を返す（top-20 から無作為抽出で人気重視）
- `pickOldPostForRevival` が確率 p で1件をランダムに選ぶ
- score が 0 以上の post に限定（過度にネガティブな post の再活性化を避ける）

### 4.5 プロンプト構造（buildCommentBatchPrompt.ts）

```
[安定] トーン規約 + 作風 + ワーカー定義
[可変] 対象 post 一覧（ref, title, text, 既存コメント数, commentCount ヒント）
[出力] CommentBatchOutputSchema の JSON 形式
```

各 post に対して「この post に {N} 件のコメントを付けてください」という件数指示を含める。

### 4.6 ドリップ割当

コメントバッチの drip 窓 = comment バッチ間隔（3h = 10800000ms）。
バッチ実行時刻から3時間以内にコメントの createdAt を散らし、reveal フィルタにより徐々に解禁する。

### 4.7 communityBatchIndex の扱い

- コードは残す（後方互換）
- Cloud Scheduler からの登録を外すのはインフラ担当（デプロイ手順書更新）
- コード内に `@deprecated` コメントを追加して意図を明示

## 5. 影響範囲 / 既存への変更

| 対象 | 変更内容 |
|------|---------|
| `common/src/domain/generation/generation.ts` | `CommentBatchPostOutputSchema` / `CommentBatchOutputSchema` を追加 |
| `common/src/domain/generation/index.ts` | 新スキーマを re-export |
| `common/src/index.ts` | 新スキーマを re-export |
| `server/src/persistence/postRepository.ts` | `listRecentByCommunity` / `listOldByCommunity` をインターフェースに追加 + InMemory 実装 |
| `server/src/persistence/prismaPostRepository.ts` | 上記の Prisma 実装を追加 |
| `server/src/batch/` | 新ファイル（calcCommentCounts, buildCommentBatchPrompt, persistCommentBatchOutput, runCommentBatch, commentBatchIndex）を追加 |
| `docs/adr/0034-post-comment-batch-split.md` | comment バッチの設計判断を追記 |

## 6. テスト計画（TDD で書くテスト一覧）

### calcCommentCounts.test.ts
- [x] score=0 → base(1) 件
- [x] score=2 → clamp(1 + round(0.5×2), 1, 5) = 2 件
- [x] score=8 → clamp(1 + round(0.5×8), 1, 5) = 5 件（max）
- [x] score=-1 → max(0, -1)=0 → base(1) 件（負スコアは 0 扱い）
- [x] score=100 → max=5 に clamp される
- [x] pickOldPostForRevival: oldPosts=[] → null
- [x] pickOldPostForRevival: rng() >= p → null（確率外れ）
- [x] pickOldPostForRevival: rng() < p → oldPosts からランダムに1件返す

### buildCommentBatchPrompt.test.ts
- [x] workers なし → スキップしない（workerLines が空）
- [x] targetPosts に ref / title / commentCount が含まれること
- [x] postRefMap が正しく構築されること（ref → postId）
- [x] コミュニティの作風が含まれること

### runCommentBatch.test.ts
- [x] apiKey なし → 早期 return（コメント 0 件）
- [x] communities 0 件 → 早期 return
- [x] 1 コミュニティ 正常系 → コメントが保存される
- [x] 直近3日 post 0 件・古い post 活性化なし → 対象なし → スキップ
- [x] vote スコア高い post はより多くのコメントを受ける（モック注入で確認）
- [x] 古い post が確率的に追加される（rng=0.0 → 追加あり、rng=0.9 → 追加なし）
- [x] JSON パース失敗 → 当該コミュニティを failure BatchRunLog に記録・他には波及しない
- [x] author 検証失敗 → 当該コミュニティを failure BatchRunLog に記録・他には波及しない

### commentBatchIndex.test.ts
- [x] runCommentBatch が呼ばれること
- [x] disconnect が必ず呼ばれること（成功時・失敗時）

## 7. リスク・未決事項

- **communityBatchIndex の二重実行**: Cloud Scheduler のジョブ更新が遅れると、古い `communityBatchIndex`（post+comment）と新 `commentBatchIndex` が並行実行される。移行期間は既存 communityBatchIndex を止めてから commentBatchIndex を有効化するよう運用で対応。
- **最大コメント数**: max=5 は仮設定。実際のコスト・体験を見てから調整する（名前付き定数で変更可能）。
- **古い post のスコア閾値**: 現在 `score >= 0` を使用。0スコアも含めるため候補が多くなりうるが、top-20 でキャップしているため問題ない。
