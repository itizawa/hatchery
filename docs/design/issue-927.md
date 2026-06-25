# 設計書: ニュースコミュニティの投稿本文にはてなブックマークURLが露出し観察体験を損なう (#927)

## 1. 目的 / 背景

本番フィード（`GET /api/communities/news/feed`）で取得した投稿 8 件中 6 件の本文冒頭に `https://b.hatena.ne.jp/hotentry/general` などの外部 URL が露出している。

原因: `buildCommunityPrompt` の `feedArticlesSection` が各記事を

```
- 「タイトル」（by author）
  URL: https://b.hatena.ne.jp/hotentry/general
  概要: ...
```

という形式でプロンプトに含めており、AI がその `URL:` 行を post の `text` フィールドの冒頭にそのまま書き出してしまっている。

## 2. スコープ（やること / やらないこと）

**やること**:
- `feedArticlesSection` から `URL: ${a.url}` 行を削除（タイトル + 著者 + 概要のみにする）
- `buildCommunityPrompt` の注意事項に URL 禁止指示を追加
- `buildPostPrompt` の注意事項にも同様の URL 禁止指示を追加

**やらないこと**:
- ニュース収集・外部 URL 参照の仕組み自体の変更
- generationInstruction の変更
- クライアントサイドのサニタイズ

## 3. 受け入れ条件（テストに落とせる粒度）

1. `buildCommunityPrompt` に `feedArticles` を渡した場合、生成プロンプトに記事の URL 文字列（`https://...`）が含まれない
2. `buildCommunityPrompt` の生成プロンプトの注意事項に「URL を含めない」旨の禁止指示が含まれる
3. `buildPostPrompt` の生成プロンプトの注意事項に「URL を含めない」旨の禁止指示が含まれる
4. タイトル・概要・著者は引き続きプロンプトに含まれる（情報量維持）
5. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### feedArticlesSection の変更

変更前:
```typescript
return `- 「${a.title}」${authorPart}\n  URL: ${a.url}${summaryPart}`;
```

変更後:
```typescript
return `- 「${a.title}」${authorPart}${summaryPart}`;
```

AI が題材を把握するにはタイトル + 概要で十分。URL は投稿内容の生成には不要で、かえって本文への露出リスクになる。

### 注意事項への禁止指示追加

両ファイルの注意事項セクションに以下を追加:

```
- 投稿本文（text フィールド）およびコメント本文（text）に URL（http または https から始まる文字列）を含めないこと
```

ベルトアンドサスペンダー戦略: URL をプロンプトから除去する（防衛的削除）＋明示的禁止指示（フェイルセーフ）。

## 5. 影響範囲 / 既存への変更

- `server/src/batch/buildCommunityPrompt.ts`: feedArticlesSection のテンプレート変更、注意事項追加
- `server/src/batch/buildCommunityPrompt.test.ts`: 既存の feedArticles URL 検証テストの更新 + 新規テスト追加
- `server/src/batch/buildPostPrompt.ts`: 注意事項追加
- `server/src/batch/buildPostPrompt.test.ts`: 新規テスト追加

ユーザー可視の振る舞いは変わらない（バッチが生成する投稿内容の品質改善だが、API スキーマ・UI は変更なし）。e2e ユースケースの更新は不要。

## 6. テスト計画（TDD で書くテスト一覧）

### `buildCommunityPrompt.test.ts` の更新

1. **既存テスト更新**: `feedArticles が指定された場合にプロンプトに注入される` — URL の `toContain` を `not.toContain` に変更（タイトル・概要・著者は引き続き含まれること）
2. **新規**: `feedArticles の URL はプロンプトに含まれない（#927）` — feedArticles.url が prompt に現れないこと
3. **新規**: `buildCommunityPrompt の注意事項に URL 禁止指示が含まれる（#927）` — 「URL」＋「含めない」の禁止文言

### `buildPostPrompt.test.ts` への追加

4. **新規**: `buildPostPrompt の注意事項に URL 禁止指示が含まれる（#927）` — 「URL」＋「含めない」の禁止文言

## 7. リスク・未決事項

- URL を feedArticlesSection から除去すると、将来 AI が元記事を参照したい場合に URL が分からなくなる。ただし現プロダクトの要件は「URL を使わずに記事を素材として語る」体験であり、URL 除去は要件に合致している（ADR-0023「観察エンタメ集中」）。
