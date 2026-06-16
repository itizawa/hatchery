# 設計書: attachAuthorWorker / buildAuthorWorkerEnricher テスト追加 (#587)

## 1. 目的 / 背景

`server/src/routes/authorWorker.ts` の `attachAuthorWorker` / `buildAuthorWorkerEnricher` に専用の
ユニットテストが存在しない。空配列早期 return・resolve 成功/失敗・`listBotWorkers` 取得 1 回保証
という境界が未カバーで、#479 の発言者表示の中核ロジックが担保されていない。
`server/src/routes/authorWorker.test.ts` を新設してこれらを固定する（#587）。

## 2. スコープ（やること / やらないこと）

- やること: `server/src/routes/authorWorker.test.ts` を新設してユニットテストを追加する
- やらないこと: `authorWorker.ts` 本体の実装変更、common の `buildAuthorWorkerResolver` テスト（別途テスト済み）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- 空配列入力のとき `[]` を即返す（early return / `listBotWorkers` 呼び出し 0 回）
- author が id で一致するとき `author_worker` が付く
- author が displayName で一致するとき `author_worker` が付く
- 解決できない author のレコードには `author_worker` が付かない（client がフォールバック）
- `imageUrl=null` のワーカーは `image_url=null` になる
- 複数コレクションに `buildAuthorWorkerEnricher` の返却 enricher を適用しても `listBotWorkers` は 1 回だけ呼ばれる

## 4. 設計方針

- `listBotWorkers` を `vi.fn().mockResolvedValue(workers)` でスタブ化した fake `WorkerRepository` を使う
- `WorkerRecord` の全フィールドを持つ fixture を定義し各テストで再利用する
- `commentCount.test.ts` と同じ `makeRepo` パターンを踏襲する

## 5. 影響範囲 / 既存への変更

- 追加: `server/src/routes/authorWorker.test.ts`（新規ファイルのみ）
- 変更なし: 本体実装・他ルート・共通層

## 6. テスト計画（TDDで書くテスト一覧）

### attachAuthorWorker
1. 空配列入力 → `[]` を返し、`listBotWorkers` は呼ばれない
2. author=id 一致 → `author_worker` が付く
3. author=displayName 一致 → `author_worker` が付く
4. 解決不能 author → `author_worker` が付かない（キー自体が存在しない）
5. `imageUrl=null` → `image_url=null`

### buildAuthorWorkerEnricher
6. 複数コレクションに enricher を適用しても `listBotWorkers` が 1 回だけ呼ばれる

## 7. リスク・未決事項

なし（純粋なテスト追加のため実装リスクなし）
