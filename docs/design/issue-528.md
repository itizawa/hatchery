# Issue #528 設計書: PostThreadScene にブラウザタブタイトルを設定する

## 背景・目的

投稿スレッド（`/posts/$postId`）は `useDocumentTitle` を呼んでおらず、ブラウザのタブ/履歴のタイトルが投稿内容を反映しない問題がある。
`CommunityScene` には既に `useDocumentTitle` の実装パターンがあり、同パターンを `PostThreadScene` にも適用する。

## 受け入れ条件の整理

1. `PostThreadScene` で `useDocumentTitle` を用い、データ取得後に `「<post.title> - Hatchery」` をタブタイトルに設定する。
2. ローディング中・取得失敗時に未定義/壊れたタイトルにならない（`useDocumentTitle` の既存 undefined ハンドリングに従う）。
3. `PostThreadScene.test.tsx` に「post タイトルが `document.title` に反映される」テストを追加する。
4. `pnpm turbo run build test lint` が緑。

## 実装方針

### 変更対象

- `client/src/routes/PostThreadScene.tsx`: `useDocumentTitle` フックを import し呼び出す。

### 実装詳細

```typescript
// PostThreadScene.tsx の追加箇所
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";

// PostThreadScene コンポーネント内
useDocumentTitle(`${post.title} - Hatchery`);
```

- `usePostThread(id)` は Suspense 化されているため、`PostThreadScene` がレンダリングされる時点では `data.post` は必ず取得済み（`undefined` にはならない）。よって `post.title` は常に有効。
- フォーマットは `「<post.title> - Hatchery」` を採用（CommunityScene の `${community.name} - Hatchery` パターンと統一）。
- コミュニティ名は含めない（シンプルに投稿タイトルのみ。Issue 補足より「コミュニティ名を含めるかは実装判断」）。

### テスト追加

`PostThreadScene.test.tsx` に新しい `describe` ブロックを追加:

```typescript
describe("PostThreadScene タイトル (#528)", () => {
  it("post タイトルが document.title に反映される", async () => {
    // ...
  });
});
```

キャッシュシードで即時描画させ、`document.title` が `「今日も元気に始めましょう - Hatchery」` になることを確認する。

## e2e ユースケース更新

ブラウザタブタイトルは「ユーザー可視の振る舞い」だが、今回の変更は既存画面への軽微な追加で、
現在の `e2e/` ユースケースには投稿スレッドのタイトル確認が含まれていない。
e2e テストは現時点では `test.todo()` のためそのままとし、新しいユースケース項目は追加しない
（バックエンド/フロント変更の規模が小さく、新規 UI ページを追加するわけではないため）。

実際は `document.title` の変化はブラウザ観察可能な挙動なので、e2e の usecases.md に
「投稿スレッドを開いたときタブタイトルが投稿タイトルを含む」旨を追記する。

## 考慮事項

- `useDocumentTitle` の既存実装（`client/src/hooks/useDocumentTitle.ts`）は `title` が falsy の場合に `DEFAULT_DOCUMENT_TITLE`（"Hatchery"）にフォールバックする。
- `PostThreadScene` は `QueryBoundary` でラップされており、データ取得完了後にのみレンダリングされるため、ローディング中のタイトル壊れは発生しない。
- エラー時は `ErrorBoundary` が代わりにレンダリングされるため、`PostThreadScene` 自体は呼ばれず、タイトルは前ページのままになる（これは許容）。
