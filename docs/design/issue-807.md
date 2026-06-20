# 設計書: Issue #807 - Skeleton と実 UI のレイアウト二重管理を解消する

## 背景・目的

`PostThreadSkeleton.tsx` は実 UI（`PostCard` / `CommunitySidebarCard`）とは別の手書きコンポーネントとして Skeleton を定義しており、レイアウト寸法が実 UI と独立している。実 UI を変更しても Skeleton が自動追随せず、人間が二重メンテしないとズレる問題がある。

本 Issue では `PostCard` / `CommunitySidebarCard` に `loading?: boolean` prop を追加し、Skeleton 表示を同じレイアウトコードから生成することで単一情報源にする。

## 設計判断

### PostCard の loading 対応

`PostCard` に discriminated union 型を使い、`loading={true}` 時は `post` / `onVote` 等のデータ系 prop を必須にしない形にする。

```ts
type PostCardProps =
  | {
      loading: true;
    }
  | {
      loading?: false;
      post: Post;
      onVote: (direction: VoteDirection) => void;
      currentVote?: VoteDirection | null;
      voteDisabled?: boolean;
      voteStopPropagation?: boolean;
      postUrl?: string;
      truncateText?: boolean;
      community?: PostCardCommunity;
      onCommunityClick?: () => void;
      onCommentClick?: () => void;
    };
```

`loading={true}` 時は、外枠 Box（`border`, `borderRadius`, `p`, `bgcolor`, `mb`）は同じにして、内部を Skeleton で埋める:
- タイトル相当: `<Skeleton variant="text" width="70%" sx={{ mb: 0.5 }} />`
- byline 相当: `<Skeleton variant="text" width="40%" sx={{ mb: 1 }} />`
- 本文相当 (3行): `<Skeleton variant="text" />` × 3
- アクションバー相当: `<Skeleton variant="text" width="30%" sx={{ mt: 1 }} />`

### CommunitySidebarCard の loading 対応

同様に discriminated union を使う:

```ts
type CommunitySidebarCardProps =
  | {
      loading: true;
    }
  | {
      loading?: false;
      community: Community;
      shareUrl: string;
      // ...その他 props
    };
```

`loading={true}` 時は外枠 Box（`border`, `borderColor`, `borderRadius`, `p`）は同じにして:
- Avatar + コミュニティ名 行: circular Skeleton + text Skeleton
- Divider
- 説明文 Skeleton (2行)
- ボタン相当 Skeleton

### PostThreadSkeleton の置き換え

`PostThreadSkeleton.tsx` を `<PostCard loading />` と `<CommunitySidebarCard loading />` の合成に変更する。既存の `data-testid` は維持する:
- `data-testid="post-thread-skeleton"` (外枠 `section`)
- `data-testid="community-sidebar-skeleton"` - 右カラムに `data-testid` を付与する方法を検討

受け入れ条件 3 で「既存の data-testid を維持する」とあるが、`PostThreadSkeleton.test.tsx` を確認すると `community-sidebar-skeleton` は `PostThreadScene.tsx` の `SidebarSkeletonColumn` に付いており、`PostThreadSkeleton.tsx` の `CommunitySidebarSkeleton` には付いていない。`PostThreadSkeleton.tsx` の右カラムに `data-testid="community-sidebar-skeleton"` を引き続き持たせる方針とする。

`community-breadcrumb-skeleton` も `PostThreadScene.tsx` の `QueryBoundary` fallback にあるため、`PostThreadSkeleton.tsx` には該当する `data-testid` は元々なかった。受け入れ条件は外枠の `post-thread-skeleton` の維持を主眼とする。

### Suspense / fallback 配線

変更なし。`router.tsx` の `<QueryBoundary fallback={<PostThreadSkeleton />}>` と `PostThreadScene.tsx` の `<SidebarSkeletonColumn>` はそのまま維持する。

## TDD 方針

1. `PostCard.test.tsx` に loading レンダリングテストを追加:
   - `loading={true}` で Skeleton が描画されること
   - `loading={true}` 時にデータ由来テキストが出ないこと
   - 既存テスト（loading=false パス）が緑のままであること

2. `CommunitySidebarCard.test.tsx` に loading レンダリングテストを追加:
   - `loading={true}` で Skeleton が描画されること
   - `loading={true}` 時にデータ由来テキストが出ないこと

3. テスト追加 → 失敗確認 → コミット → 実装で緑に

## ファイル変更一覧

- `client/src/components/PostCard.tsx` - loading prop 追加・Skeleton 分岐
- `client/src/components/CommunitySidebarCard.tsx` - loading prop 追加・Skeleton 分岐
- `client/src/components/PostThreadSkeleton.tsx` - loading 対応コンポーネントの合成に置き換え
- `client/src/components/PostCard.test.tsx` - loading テスト追加
- `client/src/components/CommunitySidebarCard.test.tsx` - loading テスト追加
- `docs/design/issue-807.md` (本ファイル)
