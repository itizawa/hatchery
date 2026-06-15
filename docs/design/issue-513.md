# Issue #513 設計書: Post / Comment 本文を安全な Markdown サブセットでレンダリングする

## 背景と目的

現在、投稿・コメントの本文はプレーンテキストとして MUI の `Typography` でそのまま描画しているため、
AI ワーカーが生成した本文に含まれる改行・箇条書き・強調・コードブロック等が反映されない。
Reddit 風の読み物体験を向上させるため、本文を安全な Markdown サブセットでレンダリングする。

## 実装方針

### ライブラリ選定

- `react-markdown`: React 向け Markdown レンダラー。`components` マッピングで MUI コンポーネントへ差し替えが可能
- `remark-gfm`: GFM（GitHub Flavored Markdown）拡張。テーブル・打ち消し線・タスクリストをサポート
- `rehype-sanitize`: XSS 防止のためのサニタイズ。`defaultSchema` をベースに画像 (`img`) を除外したカスタムスキーマを設定

いずれも client ワークスペースのみに追加し、common / server には一切追加しない。

### 共通コンポーネント: `MarkdownContent.tsx`

`client/src/components/MarkdownContent.tsx` を新設し、以下の責務を持つ:

1. `react-markdown` を使って Markdown を描画する
2. `remark-gfm` で GFM をサポート（太字/斜体/打ち消し線/テーブル/タスクリスト等）
3. `rehype-sanitize` で XSS を防止（`<script>`/`javascript:` スキーム/`onerror` 等を無害化）
4. 画像 (`img` タグ) は描画しない（リンクとして代替表示）
5. リンクは `target="_blank" rel="noopener noreferrer"` で新規タブで開く
6. `components` マッピングで MUI コンポーネントを使いテーマと整合させる

### サニタイズ方針

`rehype-sanitize` の `defaultSchema` をベースに下記を調整:

- `img` タグを tagNames から除外（インライン画像を許可しない）
- `script`・`style`・`iframe`・`form`・`input`・`object` など潜在的に危険なタグを除外
- `on*` 属性（`onerror`, `onclick` 等）は `defaultSchema` で既に除外されているので維持
- `href` の `javascript:` スキームも `defaultSchema` で除外されているので維持

### MUI コンポーネントマッピング

| Markdown 要素 | MUI コンポーネント |
|--------------|----------------|
| `h1`〜`h6` | `Typography` variant=h6（深さに応じて縮小） |
| `p` | `Typography` variant（variant は呼び出し元から渡す） |
| `strong` | `Box` component="strong" sx={{ fontWeight: 'bold' }} |
| `em` | `Box` component="em" sx={{ fontStyle: 'italic' }} |
| `code` (inline) | `Box` component="code" sx={{ fontFamily: 'monospace', bgcolor: 'action.hover' }} |
| `pre` (block) | `Box` component="pre" sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1 }} |
| `blockquote` | `Box` sx={{ borderLeft: '3px solid', pl: 1, color: 'text.secondary' }} |
| `a` | MUI `Link` target="_blank" rel="noopener noreferrer" |
| `ul` / `ol` | `Box` component="ul/ol" sx={{ pl: 2 }} |
| `li` | `Box` component="li" |
| `img` | 画像を描画せず MUI `Link` でフォールバック（alt または src を表示） |

### 置換箇所

1. `client/src/components/PostCard.tsx` の `post.text` 表示
   - `<Typography variant="body1">{post.text}</Typography>` → `<MarkdownContent content={post.text} variant="body1" />`
   - `truncateText` 対応: line-clamp スタイルを `MarkdownContent` のラッパーに移す
2. `client/src/components/CommentCard.tsx` の `comment.text` 表示
   - `<Typography variant="body2">{comment.text}</Typography>` → `<MarkdownContent content={comment.text} variant="body2" />`
3. `PostThreadScene.tsx` は PostCard / CommentCard を通じて自動的に対応

### Props 設計

```typescript
interface MarkdownContentProps {
  content: string;
  /** テキスト要素のベース variant（MUI Typography 準拠）。デフォルト body1 */
  variant?: "body1" | "body2";
}
```

### 後方互換性

- Markdown 記法を含まないプレーンテキストは `react-markdown` がそのままテキストとして扱うため、表示が破綻しない
- 改行は Markdown 仕様上 2 つ連続が必要だが、`remark-breaks` を追加することで単一改行も有効にできる
  - ただし本 Issue ではスコープ外のため、必要であれば別 Issue で対応する

## 受け入れ条件の確認

1. `MarkdownContent.tsx` を新設 → 実装する
2. 太字/斜体/打ち消し線/インラインコード/コードブロック/箇条書き/引用/リンク/見出し/テーブルをサポート → `react-markdown` + `remark-gfm` で対応
3. `PostCard.tsx` / `CommentCard.tsx` / `PostThreadScene.tsx` を置き換え → 実装する
4. XSS 防止テスト → `MarkdownContent.test.tsx` に Vitest + RTL で追加
5. Markdown 描画テスト → 同テストファイルに追加
6. Storybook に Markdown を含む本文のストーリーを追加 → `PostCard.stories.tsx` を作成（または既存に追加）
7. e2e usecases 更新 → `home-feed/usecases.md` と `post-thread/usecases.md` に UC を追追
8. `pnpm turbo run build/test/lint` 全緑

## 考慮事項

- `rehype-sanitize` は `rehype-raw` とセットで使うことが多いが、ここでは生 HTML 埋め込みを許可しないため `rehype-raw` は不要
- `react-markdown` の `skipHtml` オプションは非推奨で `rehype-sanitize` が推奨実装
- MUI v6 の `Typography` は `component` prop で HTML 要素を差し替えられるため、各 Markdown 要素をセマンティックに出し分けられる
- `truncateText` を PostCard で使っている箇所は、`MarkdownContent` の外側ラッパーに line-clamp スタイルを当てる（コンポーネント内部で処理せず、PostCard 側で制御）
