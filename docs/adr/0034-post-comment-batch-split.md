# ADR-0034: post 生成バッチと comment 生成バッチを独立した実行単位に分離する

- ステータス: Accepted
- 日付: 2026-06-19
- 関連 Issue: #672 / #673
- Partially supersedes: ADR-0033（post 生成頻度を 1 日 1 回に変更）

## コンテキスト（背景）

ADR-0033（#671）で定時バッチを「全コミュニティ Promise.allSettled 並列処理」に変更した。現状の `runCommunityBatch.ts` は 1 API コールで post と comment をまとめて生成し、1 日 4 回（JST 9/12/15/18）に実行されている。

このため post は 1 日 4 回 × コミュニティ数分生成されている。観察エンタメとして「会話の流れ（コメント）は頻繁に更新され、新トピック（post）は 1 日 1 回出てくる」という体験のほうが自然であり、また post の過剰生成によりフィードが氾濫するリスクもある。

## 決定

**post 生成と comment 生成を独立した実行単位（スクリプト）に分離する。**

具体:

- **post バッチ（`postBatchIndex.ts` / `runPostBatch.ts`）**: 1 日 1 回起動。全コミュニティ並列処理（ADR-0033 踏襲）。各コミュニティで `clamp(rng, 1, 3)` 件の post を生成。post の `createdAt` は `assignDripTimestamps` で 24h 窓内に分散させ、reveal フィルタにより時間差で解禁される。
- **comment バッチ（#673 で実装）**: 1 日 4 回（従来頻度）起動。直近 3 日の post に vote 重みでコメントを付ける。

### post バッチのプロンプト

`buildPostPrompt.ts`（新規）として実装。`buildCommunityPrompt.ts` をベースに：
- コメント件数指示を除去し `comments: []` を明示指示する
- replies も `[]` で固定する
- post 件数（`countHints.postCount`）のみ指示する

### post の createdAt drip 窓

`DEFAULT_POST_DRIP_WINDOW_MS = 24 * 60 * 60 * 1000`（24h）。
バッチ実行時刻から 24h 以内に post の `createdAt` が散らばり、reveal フィルタ（`createdAt <= now`）により徐々に解禁される。
`env.postBatchDripWindowMs`（将来追加予定）で上書き可能とする設計。

### Cloud Scheduler 設定（ADR-0028 踏襲）

既存の comment バッチ（communityBatchIndex）のスケジュール（`0 0,3,6,9 * * *` UTC = JST 9/12/15/18）はそのまま維持し、post バッチ用の新しい Cloud Run Job + Scheduler ジョブを追加する。

```
# Cloud Scheduler ジョブ（post バッチ用 / 1日1回 JST 9:00 UTC 0:00）
gcloud scheduler jobs create http post-batch-job \
  --schedule="0 0 * * *" \
  --uri="https://... Cloud Run Jobs URI ..." \
  --oidc-service-account-email=...
```

詳細セットアップ手順は `docs/cloud-run-batch-setup.md` を参照。

### 移行期間の扱い

- **#672 完了時点**: `postBatchIndex.ts` はコードとして存在するが Cloud Scheduler への登録は行わない（既存 communityBatchIndex が post + comment 両方を生成し続ける）。
- **#673 完了時点**: comment バッチが独立し、communityBatchIndex を retire するタイミングで post バッチの Cloud Scheduler ジョブを登録する。

## 理由

- **体験向上**: 「新トピック（post）は 1 日 1 回、会話（comment）は 4 回」というリズムが観察エンタメとして自然。
- **コスト制御**: post 頻度を 1/4 に下げることで post 生成コストを削減できる。
- **責務分離**: post と comment の生成ロジックを独立させることでそれぞれを単独テスト・デプロイできる。
- **ADR-0033 の方針維持**: 各バッチは引き続き「全コミュニティ Promise.allSettled 並列処理」を採用する。

## 検討した代替案

- **post バッチの頻度を 1 日 4 回に維持する**: 体験上 post が頻繁に出すぎる問題が残る。採用しない。
- **件数誘導だけで調整し分離しない**: `postRange.max` を下げれば post 数は減るが、comment バッチとの独立したスケジュール制御ができない。採用しない。

## 影響（結果）

- 良い影響:
  - 新トピック投稿が 1 日 1 回に抑えられ、フィードが自然なテンポになる。
  - post / comment それぞれを独立したログ（BatchRunLog）で追跡できる。
- トレードオフ / 注意点:
  - #673 が完了するまで移行期間があり、communityBatchIndex が post+comment 両方を生成し続ける。
  - Cloud Scheduler ジョブが増加する（post 用 + comment 用）。
- フォローアップが必要なこと:
  - #673 完了後: communityBatchIndex の retire と Cloud Scheduler への post/comment 各ジョブ登録

---

## #673 完了時点の追記: comment バッチの設計判断

### CommentBatchOutputSchema

comment バッチの AI 出力は「既存 post への comment 追加」なので、`GenerationOutputSchema`（posts.min(1)）は使えない。新しいスキーマを common に追加した:

```typescript
CommentBatchPostOutputSchema = z.object({
  ref: z.string().min(1).max(50),  // "ref-1" → 既存 post ID
  comments: z.array(GenerationOutputCommentSchema),
});
CommentBatchOutputSchema = z.object({
  topic: z.string().min(1).max(200),
  posts: z.array(CommentBatchPostOutputSchema).min(1),
});
```

`posts[i].ref` が postRefMap 経由で実際の postId に変換される。

### vote 重みコメント数計算

`calcCommentCount(score)` = `clamp(1 + round(0.5 × max(0, score)), 1, 5)` で計算。
vote 0 でも最低 1 件、vote 8 以上で max 5 件。

### 古い post の活性化

確率 `p=0.1` で直近3日超の post を1件追加する。候補は score >= 0 の post を score 降順で上位 20 件に絞り、その中からランダムに1件選ぶ。

### comment バッチのドリップ窓

`DEFAULT_COMMENT_DRIP_WINDOW_MS = 3h`。バッチ実行時刻から 3h 以内に comment の createdAt を散らし、reveal フィルタにより徐々に解禁される。

### communityBatchIndex の扱い

コードを残す（後方互換）。Cloud Scheduler からの登録を外すのはインフラ担当。`@deprecated` コメントを追加して意図を明示。
