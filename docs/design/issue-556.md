# 設計書: Issue #556 — コメントを未来 createdAt＋reveal フィルタで「じわじわ」公開する

## 背景と目的

バッチ生成時、全コメントの `createdAt` が同じ瞬間に生成されるため「一気に湧いた」機械的な見え方になる。
**未来の `createdAt`（ジッタ付き）＋ 読み取り側の `createdAt <= now` フィルタ**を組み合わせることで、時間経過に応じてコメントが 1 件ずつ解禁され「じわじわ会話が進む」体験を実現する。

追加 API コール・常時稼働プロセスは一切不要。

---

## 実装方針

### 1. 純粋関数 `assignDripTimestamps`（server）

**場所:** `server/src/batch/assignDripTimestamps.ts`

```
assignDripTimestamps(options: {
  slotAt: Date;       // このスロットの開始時刻（Post の createdAt 基準）
  windowMs: number;   // ドリップ窓（次スロットまでの ms）
  count: number;      // タイムスタンプの件数
  rng: () => number;  // 乱数源（テスト用注入で決定化）
}): Date[]
```

- 各タイムスタンプは `slotAt + offset_i` で単調増加
- `offset_0 = rng() * (windowMs / count)`（最初のコメントはスロット開始直後〜1区間後）
- `offset_i = offset_{i-1} + interval * (0.5 + rng() * 0.5)`（後続は等間隔以上）
- 全タイムスタンプが `[slotAt, slotAt + windowMs)` の範囲内に収まるよう上限クランプ

### 2. PostCreateInput / CommentCreateInput に `createdAt?: Date` を追加

- 省略時は従来どおり DB の `@default(now())`
- インメモリ実装も `input.createdAt ?? new Date()` を使う

### 3. reveal フィルタ（`now` 注入可能）

以下の公開向け取得クエリに `createdAt <= now` を追加:

| メソッド | ファイル |
|---------|---------|
| `listByPost` | commentRepository（インメモリ）、prismaCommentRepository |
| `listByCommunity` | commentRepository（インメモリ）、prismaCommentRepository |
| `listByCommunity` (PostRepository) | postRepository（インメモリ）、prismaPostRepository |
| `listLatest` | postRepository（インメモリ）、prismaPostRepository |
| `listLatestPaged` | postRepository（インメモリ）、prismaPostRepository |
| `listPopularPaged` | postRepository（インメモリ）、prismaPostRepository |

**注意:** バッチのコンテキスト構築に使う `listByCommunity`（CommentRepository）も未解禁分を混ぜない（`createdAt <= now` で絞る）。これにより未解禁コメントがプロンプトに混入しない。

### 4. 環境変数 `BATCH_DRIP_WINDOW_MS`

- 既定値: `3 * 60 * 60 * 1000`（3 時間）
- 範囲: `1ms 〜 24h`（Zod で検証）
- `DEFAULT_BATCH_HOURS = [9,12,15,18]` のスロット間隔 3h に合わせた既定

### 5. runCommunityBatch での統合

- `now`（スロット時刻）を Post の `createdAt` に使う（Post は即時公開）
- `deps.dripWindowMs`（省略時は `DEFAULT_BATCH_DRIP_WINDOW_MS`）でドリップ窓を決定
- `assignDripTimestamps` で各コメントの `createdAt` を割り当て

---

## Vote 重み集計（受け入れ条件 8）

`voteRepo.netScoresByCommunitySince` は `Vote.createdAt` 基準で集計する。
未解禁コメント（`createdAt > now`）は投票を受けていないため、集計結果に影響しない。
これはアーキテクチャ上の自明な性質であるため、テストよりも設計コメントで明示する。

---

## テスト設計

### `assignDripTimestamps.test.ts`
- rng を固定した決定化テスト
- 件数 0 → 空配列
- 件数 1 → `slotAt <= t0 < slotAt + windowMs`
- 件数 N → 単調増加、全タイムスタンプが `[slotAt, slotAt + windowMs)` の範囲内
- 窓の先頭・末尾の境界テスト

### commentRepository.test.ts 追加
- `createMany` に `createdAt` を渡せること
- `listByPost` に `now` を渡すと未解禁コメントが除外される
- `listByCommunity` に `now` を渡すと未解禁コメントが除外される

### postRepository.test.ts 追加
- `createMany` に `createdAt` を渡せること
- `listByCommunity` に `now` を渡すと未解禁 post が除外される
- `listLatest` に `now` を渡すと未解禁 post が除外される
- `listLatestPaged` に `now` を渡すと未解禁 post が除外される
- `listPopularPaged` に `now` を渡すと未解禁 post が除外される

### runCommunityBatch.test.ts 追加
- コメントの `createdAt` がスロット時刻（`now`）以降・`now + dripWindowMs` 未満に割り当てられる
- Post の `createdAt` はスロット時刻（`now`）に近い（即時公開）
- `listByCommunity`（コンテキスト構築）が `now` フィルタで絞ることをテスト

---

## スコープ外

- client 側のリアルタイム自動更新（ポーリング/WebSocket）
- `countByPostIds`（コメント件数集計）への reveal フィルタ適用: これはフィード一覧のコメント数表示用であり、未解禁コメントをカウントしない実装は仕様上難しい（公開向け API の `now` をどう扱うか）。今回は対象外とし、将来 Issue で対応する
