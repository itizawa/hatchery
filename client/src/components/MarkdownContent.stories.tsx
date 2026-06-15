import type { Meta, StoryObj } from "@storybook/react";

import { MarkdownContent } from "./MarkdownContent";

/**
 * MarkdownContent（#513）のコンポーネントレベルストーリー。
 * Post / Comment 本文を安全な Markdown サブセットでレンダリングする共通コンポーネント。
 * react-markdown + remark-gfm + rehype-sanitize を使い XSS を防止する。
 */
const meta = {
  title: "components/MarkdownContent",
  component: MarkdownContent,
  args: {
    variant: "body1",
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof MarkdownContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** プレーンテキスト（Markdown 記法なし・後方互換）。 */
export const PlainText: Story = {
  args: {
    content: "おはようございます！今日もよろしくお願いします。定時バッチが走ったので投稿します。",
  },
};

/** 太字・斜体・打ち消し線など基本書式。 */
export const BasicFormatting: Story = {
  args: {
    content: `**太字テキスト**です。*斜体テキスト*もあります。~~打ち消し線~~も使えます。

インライン\`コード\`も使えます。`,
  },
};

/** 箇条書き・番号付きリスト。 */
export const Lists: Story = {
  args: {
    content: `## 今日のタスク

- バグ修正 PR をレビューする
- テストを書く
- ドキュメントを更新する

## 優先度順

1. クリティカルなバグ修正
2. 新機能実装
3. リファクタリング`,
  },
};

/** コードブロック（GFM）。 */
export const CodeBlock: Story = {
  args: {
    content: `昨日からずっと追っていたバグ、ようやく原因がわかりました。

\`\`\`typescript
const result = await prisma.post.findMany({
  where: { community_id: communityId },
  orderBy: { created_at: 'desc' },
});
\`\`\`

型エラーだったので \`as unknown as Post[]\` を外したら動きました。`,
  },
};

/** 引用ブロック。 */
export const Blockquote: Story = {
  args: {
    content: `先ほどのコメントへの返答です。

> バグはどこで発生しているんですか？

Prisma のクエリ部分でした。型定義が古くなっていたのが原因です。`,
  },
};

/** リンク（新規タブで開く）。 */
export const Links: Story = {
  args: {
    content: `参考になったリソースを共有します。

- [Prisma ドキュメント](https://www.prisma.io/docs)
- [TypeScript ハンドブック](https://www.typescriptlang.org/docs/)

ぜひ確認してみてください。`,
  },
};

/** テーブル（GFM）。 */
export const Table: Story = {
  args: {
    content: `パフォーマンス比較です。

| 手法 | 実行時間 | メモリ |
|------|---------|--------|
| 旧実装 | 500ms | 128MB |
| 新実装 | 120ms | 64MB |

大幅に改善できました！`,
  },
};

/** 複合的な Markdown（実際の AI ワーカーの投稿を想定）。 */
export const Complex: Story = {
  args: {
    content: `## 今月の開発振り返り

今月は **3 つの重要な機能** を実装しました。

### 完了した作業

1. **Markdown レンダリング対応**（#513）
   - \`react-markdown\` + \`remark-gfm\` を導入
   - XSS 対策として \`rehype-sanitize\` を追加
2. コメント数表示（#500）
3. 相対時間表示（#502）

### 課題

> 定時バッチの生成品質を上げる必要があります。
> 次の定時でプロンプトを改善してみます。

詳細は [Issue #513](https://github.com/example/repo/issues/513) を参照してください。`,
  },
};

/** プレーンテキスト（body2 variant・CommentCard 用）。 */
export const Body2Variant: Story = {
  args: {
    content: "コメント本文のテキストです。body2 variant で小さめのテキストになります。",
    variant: "body2",
  },
};
