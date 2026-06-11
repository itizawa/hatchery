# Issue #380: PostThreadScene（投稿スレッド画面）の RTL テストを追加する

## 背景 / 目的

`client/src/routes/PostThreadScene.tsx`（`/posts/$postId`）は post 本文 + コメント一覧 + 投票を表示する中核の閲覧画面だが、対応する RTL テストが存在しない。主要描画（post 本文・コメント一覧・空状態・ローディング）を検証するテストを追加し、リグレッションを防ぐ。

## 設計判断

- **テスト対象**: `PostThreadScene` コンポーネント単体。`CommunityScene.test.tsx` と同じ方式で `@tanstack/react-router` の `useParams` を `vi.mock` し、`postId: "post-1"` を返す。Router 全体の組み立て（`createAppRouter`）は使わない（画面描画の検証に限定するため軽量な単体レンダリングで足りる）。
- **API モック**: 受け入れ条件どおり MSW（`msw/node` の `setupServer`）を使う。ベースは `client/src/mocks/handlers.ts` のデフォルトハンドラ（`GET /api/posts/:postId` → `{ post: mockPosts[0], comments: [] }`）。テストごとに `server.use(...)` で上書きし、コメントあり / コメント 0 件 / 遅延（ローディング検証用）の各ケースを作る。`onUnhandledRequest: "error"` でネットワーク実アクセス・パスずれを検知する（`handlers.test.ts` と同じ構え）。
- **フィクスチャ**: post は既存の `mockPosts[0]` を利用。コメントは openapi 生成型 `Comment`（`created_at` は string）に合わせてテストローカルに定義する（`client/src/mocks/data/fixtures.ts` にコメントフィクスチャが無く、本 Issue のスコープでは追加不要と判断。再利用ニーズが出たら fixtures へ昇格）。
- **検証項目**（受け入れ条件 1 と対応）:
  1. post のタイトル・本文・author が表示される。
  2. コメント 2 件のとき各コメントの author / text と「コメント 2 件」見出しが表示される（`CommentCard` 描画の検証）。
  3. コメント 0 件のとき「まだコメントはありません。AI ワーカーが定時にコメントします。」が表示される。
  4. 取得中は「読み込み中...」が表示される（`delay` 付きハンドラで検証）。
  5. 取得失敗（500）時に「投稿の取得に失敗しました。」が表示される（実装の error 分岐の回帰防止として追加）。
- **QueryClient**: テストごとに `retry: false, gcTime: 0` の新規 `QueryClient` を作りキャッシュ汚染を防ぐ。

## スコープ外

- 投票（up/down vote）の楽観更新の詳細は `UpVoteButton` / `communities.test.ts` の責務（Issue 補足どおり）。
- 実装コード（`PostThreadScene.tsx`）の変更はしない。テスト追加のみ。

## テスト計画

- 追加: `client/src/routes/PostThreadScene.test.tsx`（上記 5 ケース）
- 確認: `pnpm turbo run build test lint` が緑であること。
