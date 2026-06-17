# 設計書: post / comment の vote をボディ下のアクションバーへ移動する (#683)

## 1. 目的 / 背景

現在 `PostCard` / `CommentCard` は `VoteControl`（up/score/down）をカード左端の独立カラムに縦置きで表示している。ADR-0025 が「post のアクションバーは Reddit 風（up/down 矢印 + 中央スコア + シェア）」と定めており、本文下のアクションバーに横並びで配置するのが自然。本 Issue はその意図に沿うようにレイアウトを変更する。

## 2. スコープ（やること / やらないこと）

### やること
- `PostCard`: 左カラムの `VoteControl` を撤去し、本文下のアクションバー（💬コメント数・ShareButton がある行）の先頭（左）に配置する
- `CommentCard`: 左カラムの `VoteControl` を撤去し、本文の下に `VoteControl` のみのアクションバーを新設する
- 既存テスト（score・up/down クリック・ShareButton 等）が緑のまま通ることを確認する
- 新レイアウトを検証するテストを追加する

### やらないこと
- `VoteControl` のデザイン変更（アイコン・色・プロップ追加など）
- CommentCard への ShareButton / コメント数追加（別 Issue）
- common / server / API スキーマの変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. PostCard でアクションバーの並びが `VoteControl → コメント数（💬）→ ShareButton`（DOM 順で先行）
2. PostCard の既存テスト（score 表示・up/down vote・ShareButton）が引き続き通る
3. `voteStopPropagation` が有効な時に up/down ボタンクリックで `stopPropagation` / `preventDefault` が呼ばれる（回帰）
4. CommentCard でアクションバー（VoteControl）が本文（MarkdownContent）より DOM 順で後に現れる
5. CommentCard の既存テスト（score 表示・up/down vote）が引き続き通る
6. Reddit 風インデント / コネクター線（`depth` ベース）の挙動は変わらない

## 4. 設計方針

### PostCard

`Box sx={{ display:"flex", gap:1, alignItems:"flex-start" }}` の二カラム構成を廃止する。

変更前:
```
Card Box
  Flex Box (two-column)
    Left: Box > VoteControl
    Right: Box (flex:1)
      Title, Byline, Body, OGP
      Action Bar: [CommentCount | ShareButton]
```

変更後:
```
Card Box
  Title
  Byline
  Body (MarkdownContent) / OGP
  Action Bar (flex): [VoteControl wrapper | CommentCount | ShareButton]
```

`voteStopPropagation` 用の `handleVoteClick` はアクションバー内の VoteControl を囲む `Box onClick={handleVoteClick}` で継続して機能させる。

### CommentCard

二カラム構成を廃止し、本文の下に `VoteControl` のみのアクションバーを追加する。

変更前:
```
Indent Box
  Connector
  Content Box
    Flex Box (two-column)
      Left: Box > VoteControl
      Right: Box (flex:1) > Byline, Body, OGP
```

変更後:
```
Indent Box
  Connector
  Content Box
    Byline
    Body (MarkdownContent) / OGP
    Action Bar (flex): [VoteControl]
```

## 5. 影響範囲

- `client/src/components/PostCard.tsx`
- `client/src/components/CommentCard.tsx`
- `client/src/components/PostCard.test.tsx`（既存テスト回帰確認 + 新レイアウトテスト追加）
- `client/src/components/CommentCard.test.tsx`（同上）

e2e/ ディレクトリが未作成のため今回は更新しない（PR 本文に記載）。

## 6. テスト計画

### PostCard.test.tsx に追加
- "vote コントロールがコメント数（💬）より前（DOM 順で先）に現れる"
  - `compareDocumentPosition` で up vote ボタンがコメント数要素より先行することをアサート

### CommentCard.test.tsx に追加
- "vote コントロールが本文より後（下）に現れる"
  - `compareDocumentPosition` で up vote ボタンが本文テキストより後に来ることをアサート

## 7. リスク・未決事項

- `minWidth: 0` はカード全幅レイアウトなら不要になるが、タイトルが長い場合の折り返しは CSS 標準に委ねる（`word-break: break-word` は既存のグローバル CSS に依存）
- CommentCard アクションバーの `mt` 値は `0.5` を採用（Body 直後に適切な間隔を確保）
