# Issue #796 設計書: 返信があるコメントのアバター下にスレッドコネクターを表示する

## 概要

`CommentCard` に `hasChildren?: boolean` プロップを追加し、子コメントが存在する場合にアバター下（`top: "30px"` から `bottom: 0`）に縦線を描画する。これにより、depth=0 のトップレベルコメントでも子コメントへの視覚的スレッド接続が示される。

## 背景

現状の `CommentCard` では depth > 0 の返信コメントにのみ L 字コネクターを描画している。トップレベルコメントが返信を持っていても視覚的なスレッド構造が示されず、Reddit 風の完成度が低い。

## 変更対象ファイル

- `client/src/components/CommentCard.tsx` — `hasChildren` プロップ追加・縦線描画
- `client/src/routes/PostThreadScene.tsx` — `renderCommentTree` で `hasChildren` を渡す
- `client/src/components/CommentCard.test.tsx` — 新テスト追加

## 設計判断

### 縦線の位置

子コメント（depth+1）の L 字コネクターは `left: ${(depth+1)*INDENT_PER_DEPTH - 8}px = ${depth*INDENT_PER_DEPTH + 8}px` に描画される。
親コメントのアバター下縦線も同じ `left: ${clampedDepth * INDENT_PER_DEPTH + 8}px` にすることで、縦線が自然に接続する。

### スタイル

既存コネクター線（`depth > 0` のとき描画する縦線）と同一スタイルを採用:
- `width: "2px"`
- `bgcolor: CONNECTOR_COLOR`（= `"divider"`）
- `borderRadius: "1px"`
- `top: "30px"`, `bottom: 0`

### プロップ名

`hasChildren?: boolean`（デフォルト `false`）— 子コメントの有無を示す。省略時は縦線を描画しない。

### testid

`data-testid="comment-avatar-connector"` を付与し、テストで検出可能にする。

## 受け入れ条件チェックリスト

1. `CommentCard` に `hasChildren?: boolean`（デフォルト `false`）プロップを追加
2. `hasChildren=true` の場合にアバター下縦線（`data-testid="comment-avatar-connector"`）を描画
   - `left: ${clampedDepth * INDENT_PER_DEPTH + 8}px`
   - `width: "2px"`, `bgcolor: CONNECTOR_COLOR`, `borderRadius: "1px"`
   - `top: "30px"`, `bottom: 0`
3. `hasChildren=false`（省略含む）は縦線なし
4. `PostThreadScene.tsx` の `renderCommentTree` で `hasChildren={node.children.length > 0}` を渡す
5. テスト追加（hasChildren=true/false、depth=0/1 の left 位置）
6. `pnpm turbo run build test lint` が全て緑
