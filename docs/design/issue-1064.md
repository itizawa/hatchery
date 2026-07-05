# 設計書: ネストコメント返信元の引用プレビュー表示を削除する（#931の一部撤回） (#1064)

## 1. 目的 / 背景

#931 で、ネストコメントに親コメントの冒頭テキストを引用プレビューとして表示する機能を追加した
（`CommentCard.tsx` の `parentComment` prop / `parentPreview` 算出 / 引用枠 JSX、
`PostThreadScene.tsx` の `commentMap` を使った `parentComment` 引き当て・受け渡し）。

運用の結果、この引用プレビューは不要と判断された。返信のネスト構造自体（インデント・コネクター線・
`parent_comment_id`）は維持したまま、**引用プレビューの見た目部分のみ**を撤去する。

## 2. スコープ（やること / やらないこと）

### やること

- `CommentCard.tsx` から引用プレビュー関連コード（`parentComment` prop・`parentPreview` 算出・
  `data-testid="comment-quote-preview"` の JSX）を削除する。
- `PostThreadScene.tsx` から `parentComment` の算出（`commentMap` による `parent_comment_id` 引き当て）と
  `CommentCard` への受け渡しを削除する。
- `e2e/post-thread/usecases.md` の `UC-POST-24`（引用プレビュー）を削除し、`e2e/usecases.md` サマリから該当記述を除去する。
- 引用プレビュー専用テスト（`CommentCard.test.tsx` の「引用プレビュー（#931）」describe ブロック）を削除する。

### やらないこと

- コメントのネスト構造・インデント・L字/縦コネクター線・`parent_comment_id` の変更（維持する）。
- `commentMap`（`renderCommentTree` 内で `node.id` からコメント本体を引き当てる用途）自体の削除（これは
  引用プレビュー以外の用途でも使われているため残す）。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `CommentCard` は `parentComment` prop を持たない。
2. `parentComment` を渡していた頃に表示されていた `data-testid="comment-quote-preview"` 要素は、
   どのような入力でも描画されない。
3. `PostThreadScene` から `CommentCard` へ `parentComment` は渡されない。
4. コメントのネスト表示（L字コネクター `comment-l-connector`・アバター下コネクター `comment-avatar-connector`・
   インデント）は既存のまま変更されない（既存テストがそのまま緑で通ることで担保）。
5. `e2e/post-thread/usecases.md` に `UC-POST-24` が存在しない。`e2e/usecases.md` のサマリ行から
   「ネストコメントの返信元引用プレビュー（#931）」の記述が消えている。
6. `pnpm turbo run build test lint` が緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- 純粋な UI 撤去（revert）であり、新規ロジックの追加はない。
- `CommentCard.tsx`:
  - `CommentCardProps`（non-loading 分岐）から `parentComment?: Comment | null` を削除。
  - 本体側の `parentComment = null` 分割代入・`parentPreview` 算出（`truncateCodePoints` を使った
    40 文字切り詰め処理）・引用枠 JSX ブロックを削除する。
  - `truncateCodePoints` 関数自体は `shareTitle` の算出にも使われているため残す。
- `PostThreadScene.tsx` の `renderCommentTree`:
  - `parentComment` のローカル変数算出（`comment.parent_comment_id` → `commentMap.get(...)`）と
    `<CommentCard parentComment={parentComment} .../>` の受け渡しを削除する。
  - `commentMap` 自体は `node.id` からコメント本体を取得するために使い続けるため残す。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client）

| ファイル | 変更内容 |
|----------|----------|
| `client/src/components/CommentCard.tsx` | `parentComment` prop・`parentPreview` 算出・引用枠 JSX を削除 |
| `client/src/components/CommentCard.test.tsx` | 「引用プレビュー（#931）」describe ブロックを削除 |
| `client/src/routes/PostThreadScene.tsx` | `parentComment` 算出・受け渡しを削除 |
| `e2e/post-thread/usecases.md` | `UC-POST-24` を削除 |
| `e2e/usecases.md` | post-thread 行のサマリから引用プレビューの記述を除去 |

## 6. テスト計画（TDD で書くテスト一覧）

この Issue は既存機能の revert（削除）であり、新しい振る舞いを追加するものではない。
そのため TDD は「削除対象のテストが赤くなる新規テストを書く」形ではなく、次の手順で進める:

1. 変更前に `CommentCard.test.tsx` / `PostThreadScene.test.tsx` がベースラインで全緑であることを確認済み（62 tests green）。
2. 実装コード（`CommentCard.tsx` / `PostThreadScene.tsx`）から引用プレビュー関連コードを削除する。
3. `parentComment` prop が型として存在しなくなるため、それを前提にしていた
   `CommentCard.test.tsx` の「引用プレビュー（#931）」describe ブロック（型エラーになる）を削除する。
4. 削除後、残る全テスト（ネスト構造・コネクター線・共有ボタン等、既存の回帰テスト）が緑のままであることを確認する。
5. `pnpm turbo run build test lint` を実行し、型エラー・lint エラーが無いことを確認する。

## 7. リスク・未決事項

- 特になし。UI 上の見た目要素のみの削除であり、データモデル（`parent_comment_id`）・API 契約への影響はない。
