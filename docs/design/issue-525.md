# 設計書: 投稿スレッド画面にコミュニティへの導線（パンくず）を追加する (#525)

## 1. 目的 / 背景

投稿スレッド（`/posts/$postId`）の右サイドバー（コミュニティ詳細カード）は `xs` で非表示のため、モバイルでは「どのコミュニティの投稿か」「どこへ戻るか」が一切わからない。SNS 経由でモバイル直接着地したユーザーが現在地を把握できるよう、左カラム（全ブレークポイントで表示される）の上部にコミュニティへのパンくずリンクを追加する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `PostThreadScene` 左カラム上部に `c/{slug}` 形式のコミュニティリンクを追加
- `xs` を含む全ブレークポイントで表示
- ローディング中はスケルトン表示、コミュニティ特定不可時は非表示
- `PostThreadScene.test.tsx` にテストを追加

**やらないこと:**
- 新規 API エンドポイントの追加（既存の `usePublicCommunities` を再利用）
- 投稿時刻・コメント数の併記（別 Issue #502/#500）
- サイドバーの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `PostCard` の前（上）に `c/{slug}` テキストを持つリンクが表示される
2. リンク先（href）が `/communities/$slug` である（TanStack Router の `Link` の `to` props）
3. `xs` を含む全ブレークポイントで表示される（`display: none` がない）
4. コミュニティデータ取得中はスケルトンが表示される（`Skeleton` component）
5. コミュニティが特定できない場合（communities が空 / community_id 不一致）はパンくずを出さない
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### コンポーネント設計

**`CommunityBreadcrumb`**（`PostThreadScene.tsx` 内のローカルコンポーネント）:
- `communityId: string` を受け取る
- `usePublicCommunities()` から communities を取得（Suspense クエリ・既存の右サイドバーと同じキャッシュを共有）
- `communities.find((c) => c.id === communityId)` でコミュニティを特定
- 特定できない場合は `null` を返す
- 特定できた場合は `RouterLink to="/communities/$slug" params={{ slug: community.slug }}` で `c/{slug}` テキストのリンクを返す

**`PostThreadScene` 左カラムへの組み込み**:
```
<Box sx={{ flex: 1, minWidth: 0 }}>
  <QueryBoundary fallback={<Skeleton />} errorFallback={() => null}>
    <CommunityBreadcrumb communityId={post.community_id} />
  </QueryBoundary>
  <PostCard ... />
  ...
</Box>
```

### データフロー

- `usePublicCommunities()` は既に右サイドバー（`PostThreadSidebar`）が呼んでいるため、同一クエリキー `["communities"]` のキャッシュを共有。追加ネットワークコストなし。
- ローディング状態は `QueryBoundary` の Suspense fallback（`Skeleton`）で処理する。
- エラー時は `errorFallback={() => null}` でサイレントに非表示（サイドバーと同じポリシー）。

## 5. 影響範囲 / 既存への変更

- `client/src/routes/PostThreadScene.tsx` — `CommunityBreadcrumb` 追加・左カラムに組み込み・`Link` import 追加
- `client/src/routes/PostThreadScene.test.tsx` — パンくずテスト追加（describe ブロック追加）
- その他ファイル: なし

## 6. テスト計画（TDDで書くテスト一覧）

`describe("PostThreadScene パンくず (#525)")` を追加:
1. `コミュニティデータ取得済み時、c/{slug} のパンくずリンクが表示される`
2. `パンくずリンクの href が /communities/$slug である`
3. `コミュニティが特定できない場合はパンくずを表示しない`
4. `communities ローディング中はパンくず領域にスケルトンが表示される`

テストは既存の `createWrapper`（communities キャッシュシード済み）を活用する。

## 7. リスク・未決事項

- `CommunityBreadcrumb` が `usePublicCommunities()` を呼ぶため、右サイドバーと合計 2 回 Suspense 境界を持つ。両者は同一クエリキーのため重複 fetch は発生しない。
- `Skeleton` の幅は固定値（80px）で問題ない（パンくずは短いテキスト）。
