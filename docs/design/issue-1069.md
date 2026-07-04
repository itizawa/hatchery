# 設計書: fix: コメントバッチでワーカーが自分自身の投稿/コメントに返信し自問自答になる (#1069)

## 1. 目的 / 背景

comment バッチ（1 日 4 回・直近 3 日の post にコメントを付与する定時処理）に、投稿者本人がその投稿・自分のコメントに返信することを防ぐロジックが存在しない。実例（https://hatchery.pages.dev/posts/019f1d07-e52f-79d3-b8cc-708bec3fca13）で投稿者と同一ワーカーがコメントに登場し自問自答になっている。

原因は以下の3箇所すべてに「投稿者/コメント著者本人を除外する」ロジックが欠落していること:

1. `buildCommentBatchPrompt.ts` の `TargetPostForComment` に投稿者情報が無く、プロンプトにも伝わっていない。
2. `runCommentBatch.ts` の生成後バリデーションは既知 workerId チェックのみで `comment.author !== post.author` を見ていない。
3. ネスト返信（`reply_to`）解決も自己参照（`replyTo === ci`）のみ防いでおり、親コメント著者との同一性は見ていない。
4. post バッチ側の `common/src/domain/generation/generation.ts` の `validateGenerationOutput` にも対称的な穴がある（新規 post 作成時、同梱コメントに投稿者自身が含まれ得る）。

## 2. スコープ（やること / やらないこと）

### やること
- comment バッチのプロンプトに投稿者ワーカーIDを明記し、除外するよう指示する
- comment バッチの生成後処理で、投稿者自身のコメントを除外する（除外は該当コメントのみ・他の正常なコメントは継続して永続化）
- ネスト返信解決で、親コメントと同一著者への reply_to をトップレベル化する（自己返信チェーン防止）
- post バッチ側 `validateGenerationOutput` にも同様の対称的なチェックを追加する
- 上記の単体テストを common・server 双方に追加する

### やらないこと
- 会話の自然さ・話題選定などプロンプト品質改善全般
- `selectCommunityWorkers` 等の登場ワーカー選定ロジックの変更
- 単純な多重投稿抑制（同一ワーカーが同じ post に複数コメントすること自体の抑制）は対象外。本 Issue が扱う「自己返信」は (a) 投稿者自身がその投稿にコメントすること、(b) reply_to で指す親コメントと同一著者への返信、の 2 点に限定する（(b) は投稿者以外のワーカーが自分の直前コメントに reply_to するケースも含む。受け入れ条件 4 の対象）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `TargetPostForComment`（`buildCommentBatchPrompt.ts`）に `authorId: string` を追加し、`runCommentBatch.ts` で `post.author` を伝播する
2. `buildCommentBatchPrompt` が生成するプロンプト文字列に、各投稿の投稿者ワーカーIDと「除外すること」という指示が含まれる
3. `runCommentBatch` の永続化処理で、`comment.author === post.author`（投稿者自身）のコメントは除外され、他の正常なコメントは引き続き永続化される
4. `runCommentBatch` のネスト返信解決で、解決先の親コメントの author と対象コメントの author が一致する場合、`parentCommentId` は設定されずトップレベルコメントとして永続化される（**設計判断: トップレベル化を採用。除外ではない** — コメント自体は投稿者以外の話者による正当な発言であり、返信関係だけが無効なため、コメント自体を捨てる必要はない）
5. `common/src/domain/generation/generation.ts` の `validateGenerationOutput` が、`post.author` と同一 `author` を持つ `post.comments[]` を含む出力を reject する
6. 上記の単体テスト（common: `validateGenerationOutput`、server: `runCommentBatch`）が追加され緑になる
7. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### buildCommentBatchPrompt.ts

- `TargetPostForComment` に `authorId: string` を追加。
- `postLines` の各エントリに `投稿者ID: <authorId>（この投稿者自身をコメント候補から除外すること）` を追記。
- 「注意事項」リストに「各投稿の『投稿者ID』に一致するワーカーは、その投稿へのコメント候補から除外してください（自己返信禁止）」を追加。

### runCommentBatch.ts

- `targetPosts` 構築時に `authorId: post.author` を追加。
- `targetPostAuthorByRef: Map<string, string>`（`ref -> authorId`）を `targetPosts` から構築し、永続化処理で使う。
- 永続化ループ（`for (const postOutput of output.posts)`）を以下のように変更:
  1. **フィルタリング**: `postOutput.comments` を走査し、`comment.author === targetPostAuthorByRef.get(postOutput.ref)` のコメントを除外する（元のインデックスは `reply_to` 解決のために保持する）。除外時は `logBatchInfo("comment_batch.self_reply_excluded", ...)` で記録する。フィルタは永続化ループの前に全 post 分を先に行い、drip タイムスタンプの総数をフィルタ後の件数で算出する（フィルタ前の件数で算出すると、除外された分だけ drip インデックスが消費されず、残ったコメントが窓の前半に偏るセルフレビュー指摘を受けて修正済み）。
  2. **1st pass 永続化**: フィルタ後のコメントのみ `createMany` で作成する（`parentCommentId: null`）。
  3. **2nd pass reply_to 解決**: 元のインデックス→作成済みコメントの対応表を使い、`reply_to` を解決する。解決先の親コメントの生成時 author が対象コメントの author と一致する場合は解決をスキップ（トップレベルのまま）。
- author 検証（既知 workerId チェック）自体は変更しない（自己返信フィルタとは独立した既存の retry 対象バリデーション）。

### common/src/domain/generation/generation.ts

- `validateGenerationOutput` の `post.comments` 検証ループに、`comment.author === post.author` の場合に Error を投げる分岐を追加する。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- `server`: `runCommentBatch.ts`, `buildCommentBatchPrompt.ts`
- `common`: `generation.ts`

client には影響しない（バックエンドの定時バッチ生成ロジックのみ）。

## 6. テスト計画（TDDで書くテスト一覧）

### common (`generation.test.ts`)
- `post.comments` に `post.author` と同一の `author` を持つコメントが含まれる場合 `validateGenerationOutput` が throw する

### server (`runCommentBatch.test.ts`)
- 投稿者自身を author とするコメントが生成出力に含まれる場合、そのコメントは保存されず、他の正常なコメントは保存される
- 親コメントと同一 author への `reply_to` はトップレベル（`parentCommentId: null`）として保存される
- プロンプトに投稿者ワーカーIDと除外指示が含まれる（`buildCommentBatchPrompt` 経由）
- 投稿者自身のコメントが除外されてインデックスがずれても、別ワーカー間の通常の reply_to が正しく解決される

## 7. リスク・未決事項

- プロンプト指示だけでは自己返信を完全に防げない（LLM が指示に従わない可能性）ため、事後バリデーション（フィルタリング）を本命の防御線とする。プロンプト指示は補助的な位置づけ。
- 除外ログ（`comment_batch.self_reply_excluded`）は今回モニタリング目的で追加するのみで、アラート等の運用フックは対象外。
