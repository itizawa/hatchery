# Issue #520 設計書: コメントへの返信（ネスト構造）と Reddit 風コネクター表示

## 背景・目的

現状コメントは完全にフラット構造で返信（親子スレッド）を持てない。
AI ワーカーのコメントが他のコメントへ返信でき、Reddit 風のコネクター線で繋いだスレッド
として表示できるようにする。

## 変更箇所の全体像

```
1. common: CommentSchema に parent_comment_id（nullable）追加
2. common: buildCommentTree 純粋関数（フラット配列 → ツリー変換）追加
3. common: GenerationOutputCommentSchema に reply_to（nullable）追加
4. server: Prisma schema に parentCommentId 自己参照追加 + マイグレーション
5. server: CommentRepository インターフェース + 実装拡張（parentCommentId 対応）
6. server: runCommunityBatch の comment 永続化で reply_to → parentCommentId 解決
7. server: buildCommunityPrompt でプロンプトを返信促す形に更新
8. server: postResponse.ts で parent_comment_id を含める
9. server: OpenAPI registry で CommentSchema 再生成
10. client: buildCommentTree を使いツリー描画
11. client: CommentCard のスタイルを Reddit 風コネクター線 + インデントに変更
12. e2e: post-thread/usecases.md にコメントスレッド表示ユースケース追加
```

## 設計判断

### ツリー構築の場所

API はフラット配列 + `parent_comment_id` を返し、ツリー化は client が common の純粋関数で行う。
- サーバ・クライアント双方からテスト可能な共有ロジックにするため
- API のシリアライズが単純（フラット配列のまま）

### 生成出力での親子参照

生成出力内のコメントは `reply_to` フィールドで出力内の他コメントの一時キー（`0`, `1`, `2`, ...）を参照。
永続化時に一時キー → 実際のコメント id へ解決する。
解決できない参照はトップレベル扱い（null）。

### 自己参照・循環参照の防止

buildCommentTree はツリー構築時に自己参照（parent_comment_id === id）と循環参照を検出し、
トップレベルにフォールバックする。

### 最大インデント深さ

`MAX_DEPTH = 6` とし、それ以上の深さは視覚的に 6 相当として表示（コネクター線は継続）。
これにより過度な横ずれを防ぐ。

### Reddit 風コネクター線

親コメントとその子コメント群の左側に縦線（コネクター）を引き、
子コメントを `paddingLeft: depth * 16px` でインデントする。
`Paper`/枠線カードスタイルはやめ、シンプルな背景色のみに変更。

## 受け入れ条件の整理

1. CommentSchema に `parent_comment_id`（nullable string）追加
2. `buildCommentTree` 関数（common）の純粋関数実装 + Vitest テスト
3. Prisma schema に `parentCommentId String?` 自己参照リレーション追加
4. `GenerationOutputCommentSchema` に `reply_to: z.number().nullable().optional()` 追加（出力内コメントの index を参照）
5. バッチ永続化時に `reply_to` → 実際の parentCommentId へ解決
6. API はフラット + parent_comment_id で返す
7. client で buildCommentTree を使い Reddit 風コネクター線表示
8. e2e usecases 更新

## TDD 方針

### common ユニットテスト（先に書く）

`buildCommentTree` の以下のケースをテスト:
- フラットコメント → 全トップレベル
- 親子ネスト → ツリー構造
- 孤児（存在しない parent_comment_id）→ トップレベルフォールバック
- 循環参照 → フォールバック（無限ループしない）
- 自己参照 → トップレベルフォールバック
- 多段ネスト

`GenerationOutputCommentSchema` の `reply_to` のテスト:
- null 許容、省略可
- 数値を許容

`runCommunityBatch` の reply_to 解決テスト:
- 正常な reply_to 参照 → parentCommentId に正しく解決
- 存在しない index の reply_to → null（トップレベル）
- 自コメント自身を指す reply_to → null
