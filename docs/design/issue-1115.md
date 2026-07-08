# 設計書: fix: 「みんなが言わないこと」コミュニティで内容がほぼ完全一致する投稿が重複生成される (#1115)

## 1. 目的 / 背景

`unpopular-opinions`（みんなが言わないこと）コミュニティで、投稿タイトル・本文が逐語的にほぼ完全一致する投稿ペアが2組生成されていたことが本番の投稿検索 API での調査で判明した。既存の重複回避策（#1019 のタイトル重複回避指示・#1086 のレトリック構文収束検知）はいずれも「文体・題材の多様性」を扱うのみで、**投稿の主張・本文そのものが逐語的に再生成される**ケースは検知できていない。

コード調査の結果、Issue 本文が言及する `buildCommunityPrompt.ts` は現在どこからも呼び出されていない dead code（テストからのみ参照）であり、post 生成の実処理は `buildPostPrompt.ts` → `runPostBatch.ts`（ADR-0034 の post/comment バッチ分離後の実装）である。したがって本 Issue の対応対象は **`buildPostPrompt.ts`（プロンプト強化）と `runPostBatch.ts`（生成後検知）** に絞る。

## 2. スコープ（やること / やらないこと）

### やること

- `buildPostPrompt.ts` の直近ログ指示に、「話題」だけでなく「主張・結論」の重複も避ける旨を明示する。
- 生成後の post 本文について、直近 N 件（`recentLimit` 件・既存の `fetchRecentContext` が取得する範囲）の post 本文とのテキスト類似度を簡易判定し、閾値以上なら `logBatchInfo` でログ記録する（生成失敗にはしない・#1022 の「検知してログのみ」パターンを踏襲）。
- 類似度判定・ログ記録それぞれの単体テストを追加する。

### やらないこと

- 既に生成済みの重複投稿データの削除・統合（バックフィル。Issue 本文で明示的にスコープ外）。
- `buildCommunityPrompt.ts` / `persistBatchOutput.ts`（いずれも production では未使用の dead code）への変更。
- 強いバリデーション化（類似度が高い場合に生成を失敗させる・リトライさせる）。Issue 本文の受け入れ条件どおりログ記録のみに留める。
- LLM 埋め込みや外部類似度 API の導入。DB・ネットワーク I/O を増やさない軽量な文字列アルゴリズムのみを使う。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `buildPostPrompt` が生成するプロンプトに、直近ログと「主張・結論」が重複する投稿を避ける旨の指示文言が含まれる。
2. 新設する類似度検知関数 `detectSimilarRecentPost`:
   - 候補テキストが直近 post 本文と完全一致する場合、一致した post を返す。
   - 候補テキストが直近 post 本文とごくわずかな差異（空白1文字など）しかない場合も、閾値以上の類似度として検知する。
   - 明らかに異なる内容の場合は `null` を返す（誤検知しない）。
   - 直近 post が複数ある場合、最も類似度が高いものを返す。
   - 直近 post が空配列の場合は `null` を返す。
3. `runPostBatch` の `processCommunitePosts` で、生成された各 post について直近 post 本文との類似度検知を行い、閾値以上の場合 `logBatchInfo("post_batch.duplicate_text_detected", {...})` を呼ぶ。閾値未満の場合は呼ばない。検知してもバッチは正常終了し post は通常どおり永続化される（非ブロッキング）。
4. `pnpm turbo run build test lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **類似度アルゴリズム**: 文字 3-gram の Jaccard 類似度（`server/src/batch/detectDuplicatePostText.ts` に新設）。形態素解析器を導入せずに日本語文でも実用的に機能し、依存追加なし・DB/ネットワークI/O不要という「簡易チェック」（Issue 本文の要求どおり）の性質に合致する。閾値は `DUPLICATE_TEXT_SIMILARITY_THRESHOLD = 0.8` とし、完全一致（1.0）や空白追加程度の差異（0.9台）を検知しつつ、単なる話題の近さでは誤検知しない値として設定する。
- **配置場所**: `assignDripTimestamps.ts` / `calcCommentCounts.ts` などバッチ固有の純粋関数群と同様、`server/src/batch/` に配置する（DB・Express に依存しない純粋関数だが、post バッチ専用のロジックであり `common/` が扱う汎用ドメインロジックではないため）。
- **直近 post 本文の取得**: `fetchRecentContext.ts` の `recentPostsForReply` は現在 `{ ref, id, title }` のみを返す。ここに `text` を追加し、`runPostBatch.ts` が類似度検知に利用できるようにする（`recentLimit` 件の直近 post を対象にする既存の取得範囲をそのまま流用し、追加の DB クエリは発生させない）。
- **検知タイミング**: `withGenerationRetry` によるスキーマ検証・author 検証が成功した後（`output` 確定後）、`postRepo.createMany` で永続化する前に検知する。検知してもリトライ・失敗扱いにはしない（#1022 の URL 検知と同じ非ブロッキング方針）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- `server/src/batch/buildPostPrompt.ts` — 直近ログ指示文の強化（既存テスト互換・追加テストのみ）。
- `server/src/batch/fetchRecentContext.ts` — `recentPostsForReply` に `text` フィールドを追加（既存テストは `toMatchObject` を使用しており非破壊）。
- `server/src/batch/detectDuplicatePostText.ts`（新設） — 類似度検知の純粋関数。
- `server/src/batch/runPostBatch.ts` — 生成後の検知呼び出しとログ記録を追加。
- `client` / `common` への変更なし。ユーザー可視の振る舞い変化なし（バッチ内部のログ強化のみ）のため `e2e/usecases.md` の更新は不要。

## 6. テスト計画（TDD で書くテスト一覧）

- `server/src/batch/detectDuplicatePostText.test.ts`（新設）
  - 完全一致テキストで一致を検知する
  - 空白1文字程度の差異があるテキストでも高類似度として検知する
  - 明らかに異なるテキストでは `null` を返す
  - 複数候補がある場合、最も類似度が高い候補を返す
  - 直近 post が空配列のとき `null` を返す
- `server/src/batch/buildPostPrompt.test.ts`（追記）
  - 直近ログ指示に「主張」「結論」の重複回避を促す文言が含まれる
- `server/src/batch/fetchRecentContext.test.ts`（追記）
  - `recentPostsForReply` の各エントリに `text` が含まれる
- `server/src/batch/runPostBatch.test.ts`（追記）
  - 生成された post 本文が直近 post 本文とほぼ同一のとき `post_batch.duplicate_text_detected` がログ出力される
  - 明らかに異なる内容のときはログ出力されない

## 7. リスク・未決事項

- 3-gram Jaccard 類似度は日本語の意味的な言い換え（同じ主張を異なる語彙で表現するケース）までは検知できない。あくまで「ほぼ逐語的な重複」を捕捉する簡易チェックであり、Issue 本文の受け入れ条件（「強いバリデーションで生成失敗にする必要はない」）とも整合する。意味的類似度が必要になった場合は将来 Issue で埋め込みベースの手法を検討する。
- 閾値 0.8 は本 Issue で発見された実例（完全一致・空白1文字差）を基準にした初期値。実運用でのログ頻度を見て将来チューニングが必要になる可能性がある。
