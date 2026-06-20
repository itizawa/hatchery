# 設計書: CommentCard のコネクター線がコメント本文と重なる（Avatar/本文を flex 横並びに変更）(#827)

## 1. 目的 / 背景

`CommentCard` はスレッドコネクター線（`comment-avatar-connector`）を `position: absolute` で配置しているが、本文（`MarkdownContent` 等）が同じ水平範囲に流し込まれており、コネクターと本文が重なって表示されるバグが発生していた。

## 2. スコープ（やること / やらないこと）

**やること**
- `CommentCard` の本文エリアをアバター列（左）と本文列（右）の `display: flex` 横並びに変更する

**やらないこと**
- コネクター線の座標値・`data-left` 等の変更
- `AuthorByline` コンポーネント自体の変更（PostCard での利用を維持）
- スレッドネスト構造・Vote ロジックの変更

## 3. 受け入れ条件

- `CommentCard` の本文エリアが `display: flex` で横並びになっている
- 左列（`width: 24px`）にアバター（`Avatar`）を配置する
- 右列（`flex: 1`）に著者名・投稿時刻・本文・投票/共有ボタンを配置する
- コネクター線（`comment-avatar-connector`）がアバター列の横幅内に収まり、本文テキストと重ならない
- 既存テスト 26 件が全て緑のまま

## 4. 設計方針

### 旧構造

```
<Box>  ← 絶対配置のコネクター群
  <Box> ← 本文(AuthorByline + MarkdownContent が全幅に流れてコネクターと重なる)
```

### 新構造

```
<Box>  ← 絶対配置のコネクター群（変更なし）
  <Box display="flex">
    <Box width=24>  ← アバター列（コネクターがこの幅内に収まる）
    <Box flex=1>    ← 本文列（著者名・時刻・本文・Vote）
```

### AuthorByline の扱い

`AuthorByline` はアバター＋名前を一体で表示するが、新レイアウトではアバターを左列・名前を右列に分離する必要がある。`AuthorByline` は `PostCard` で継続利用するため変更せず、`CommentCard` 側でアバター描画をインライン化する。

## 5. 影響範囲 / 既存への変更

- `client/src/components/CommentCard.tsx` — import 変更（`AuthorByline` 削除、`Avatar`・`Typography` 追加）、本文エリアを flex 化
- `AuthorByline.tsx` / `PostCard.tsx` — 変更なし

## 6. テスト計画

既存テスト 26 件（`CommentCard.test.tsx`）がレイアウト変更後も全て緑であることを確認する。  
本修正はユーザー可視の振る舞い（コメント表示・Vote 動作）を変えないため e2e ユースケースの更新は不要。

## 7. リスク・未決事項

- `author_worker` が null の場合、左列が空になる（アバター非表示）。既存の `mockComment`（`author_worker` なし）テスト群がこのケースをカバー済みで問題なし。
- コネクター `top: 30px` は `py: 0.75`（6px） + アバター高 24px = 30px と一致しており、新レイアウトでも位置は変わらない。
