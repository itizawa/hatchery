# Issue #692 設計書: PostThreadSkeleton の構造を PostThreadScene の実 UI と一致させる

## 背景と目的

`/posts/$postId`（投稿スレッド）を初回アクセスすると、データ取得中に `PostThreadSkeleton` が表示される。
しかし現行の `client/src/components/PostThreadSkeleton.tsx` の構造が実際の `PostThreadScene` と乖離しており、
ローディング → 表示完了時にレイアウトが大きくズレている（CLS 問題）。

本 Issue では `PostThreadSkeleton.tsx` のみを修正し、実 UI レイアウトとの一致を達成する。

## 差分分析

### 現行のスケルトン

```
[outer box: p:3 maxWidth:1200 mx:auto]
  [flex row gap:3]
    [left flex:1]
      [rectangular h:200 mb:2]  // PostCard 全体を 1 つのブロックで代替
      [text mb:1]               // コメントセクション（構造不一致）
      [text mb:1]
      [text 60%]
    [right w:312]
      [rectangular h:300]       // CommunitySidebarCard を 1 つのブロックで代替
```

### 実 UI の構造

```
[outer box: p:3 maxWidth:1200 mx:auto]
  [flex row gap:3]
    [left flex:1]
      [community breadcrumb: text width:80 mb:1]  // ← スケルトンに欠如
      [PostCard: border/borderRadius:1/p:2/bgcolor:paper]
        [flex row gap:1]
          [VoteControl: pt:0.5 → 縦長ボタン]
          [right flex:1]
            [h6 title]
            [byline row]
            [body text]
            [action bar: mt:1]
      [comment section: mt:2]  // ← mb:2 ではなく mt:2
        [subtitle typography: mb:1]
        [comment cards...]
    [right w:312 display:{xs:none,md:block} sticky top:80]
      [CommunitySidebarCard]
        [border/borderRadius:1/p:2]
          [Stack row gap:1.5: Avatar(40×40) + h6 name]
          [Divider mb:1]
          [body2 description mb:1]
          [caption createdAt mb:2]
          [Stack buttons]
            [ShareButton]
            [SubscribeButton]
```

## 設計方針

### 変更対象

- `client/src/components/PostThreadSkeleton.tsx` のみ

### 変更内容

**1. コミュニティパンくず相当を追加**
```tsx
<Skeleton variant="text" width={80} sx={{ mb: 1 }} />
```
左カラム最上部（PostCard スケルトンより前）に追加する。

**2. PostCard 相当スケルトンを実レイアウトに合わせる**
- 外枠: `border: "1px solid"` / `borderColor: "divider"` / `borderRadius: 1` / `p: 2` / `bgcolor: "background.paper"` / `mb: 1`
- 内部: `display: "flex"` / `gap: 1` / `alignItems: "flex-start"`
  - 左: VoteControl 相当 → `variant="rectangular"` / `width: 32` / `height: 64`
  - 右: `flex: 1` / `minWidth: 0`
    - タイトル: `variant="text"` / `width: "70%"` / `sx={{ mb: 0.5 }}`
    - byline: `variant="text"` / `width: "40%"` / `sx={{ mb: 1 }}`
    - 本文 3 行: `variant="text"` × 3（3 行目は `width: "80%"`）
    - アクションバー: `variant="text"` / `width: "30%"` / `sx={{ mt: 1 }}`

**3. コメントセクションのスケルトンを修正**
- `mb: 2` → `mt: 2` に変更（実 UI に合わせる）
- サブタイトル Skeleton: `variant="text"` / `width: 80` / `sx={{ mb: 1 }}`
- コメントカード相当を 2 件追加: 各 `variant="rectangular"` / `height: 80` / `borderRadius: 1` / `mb: 1` + テキスト数行

**4. 右サイドバーを CommunitySidebarCard 構造に合わせる**
- 外枠: `border: 1` / `borderColor: "divider"` / `borderRadius: 1` / `p: 2`
- Avatar: `variant="circular"` / `width: 40` / `height: 40`
- コミュニティ名: `variant="text"` / `width: "60%"`
- Divider
- 説明文: `variant="text"` × 2〜3 行
- ボタン: `variant="rectangular"` / `height: 36` / `width: "100%"`

**5. `data-testid="post-thread-skeleton"` を維持する**

## スコープ外

- PostCard / CommunitySidebarCard / CommentCard 側の変更は行わない
- テスト追加は #660 が担当するため、既存テストが壊れないことのみ確認する
- コメントカードの動的個数対応は別 Issue

## 検証方法

- `pnpm turbo run build test lint` が全緑
- `data-testid="post-thread-skeleton"` が維持されていること
