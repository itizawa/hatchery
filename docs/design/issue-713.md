# 設計書: common/src/domain/ogp/ogp.ts の OgpMetaSchema 各フィールドに .max() を追加する (#713)

## 1. 目的 / 背景

CLAUDE.md § バリデーションルール（#91）の規約として、ユーザーが入力する文字列フィールドには Zod スキーマで必ず `.max()` による上限を設定することが義務付けられている。
現状の `OgpMetaSchema` は `.max()` を持たず、OGP 取得エンドポイントが返す長大な文字列がサーバ・クライアント双方でバリデーション漏れとなっている。

## 2. スコープ（やること / やらないこと）

**やること:**
- `common/src/domain/ogp/ogp.ts` の `OgpMetaSchema` 全 4 フィールドに `.max()` を追加する
  - `title`: `.max(300)` （OGP タイトルは通常 50-60 文字程度、余裕を持って 300）
  - `description`: `.max(500)` （OGP description の推奨は 160 文字程度、余裕を持って 500）
  - `image`: `.max(2048)` （URL の最大長に揃える）
  - `site_name`: `.max(100)` （サイト名は短い。余裕を持って 100）
- TDD: `.max()` 超過時の Zod バリデーション失敗テストを先に書く

**やらないこと:**
- OgpUrlQuerySchema の変更（既に .max() 設定済み）
- フロントエンド側 inputProps の変更（OgpMeta はユーザー入力フィールドではなく OGP 取得結果）
- 上限値定数の export（内部用途のみ）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- [ ] `OgpMetaSchema.parse({ title: "a".repeat(301) })` が ZodError をスローする
- [ ] `OgpMetaSchema.parse({ description: "a".repeat(501) })` が ZodError をスローする
- [ ] `OgpMetaSchema.parse({ image: "a".repeat(2049) })` が ZodError をスローする
- [ ] `OgpMetaSchema.parse({ site_name: "a".repeat(101) })` が ZodError をスローする
- [ ] 各フィールドが上限値ちょうどの文字列・null・undefined のときは parse が成功する
- [ ] 既存テスト（`common/src/logic/ogp.test.ts`）が引き続き緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

変更は `common/src/domain/ogp/ogp.ts` の `OgpMetaSchema` 定義のみ。

```ts
export const OgpMetaSchema = z.object({
  title: z.string().max(300).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  image: z.string().max(2048).nullable().optional(),
  site_name: z.string().max(100).nullable().optional(),
});
```

`.max()` は `.nullable()` の前に置く（Zod の `ZodString` チェーンとして自然な順）。

テストは `common/src/domain/ogp/ogp.test.ts` に新設する（既存は `common/src/logic/` にある別テスト）。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `common`
- 変更ファイル: `common/src/domain/ogp/ogp.ts`（OgpMetaSchema）
- 新規ファイル: `common/src/domain/ogp/ogp.test.ts`
- 下流への影響: server と client が `OgpMetaSchema` を利用しているが、上限追加は**より厳しいバリデーション**なので既存の有効データには影響しない

## 6. テスト計画（TDDで書くテスト一覧）

| テストケース | 内容 |
|------------|------|
| title 上限超過 | 301 文字の title で ZodError |
| description 上限超過 | 501 文字の description で ZodError |
| image 上限超過 | 2049 文字の image で ZodError |
| site_name 上限超過 | 101 文字の site_name で ZodError |
| 上限値ちょうどは成功 | 300/500/2048/100 文字それぞれで parse 成功 |
| null は成功 | 全フィールド null で parse 成功 |
| undefined は成功 | 全フィールド省略で parse 成功 |

## 7. リスク・未決事項

- 特になし。上限追加は純粋な制約強化で後方互換性を壊さない（実際に流通している OGP データが上限を超える場合はバリデーションエラーになるが、それは想定内の正当な弾き）
