# 設計書: client の AuthorByline コンポーネントのフォールバック分岐をテストする (#589)

## 1. 目的 / 背景

`client/src/components/AuthorByline.tsx` は post/comment の発言者を「アバター画像 + 表示名」で表示する byline コンポーネント（#479）。
対応するテストが存在しないため、3 つの状態分岐（authorWorker なし / image_url null / image_url あり）が未カバー。
PostCard/CommentCard 経由で間接描画はされるが、コンポーネント単体での分岐アサートが無い。

## 2. スコープ（やること / やらないこと）

- やること: `AuthorByline.test.tsx` を新設し 3 分岐を RTL でテスト
- やらないこと: AuthorByline 本体の変更、PostCard/CommentCard への変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. `authorWorker` が undefined のとき、生の `author` 文字列（Typography）が表示される
2. `authorWorker` の `image_url` が null のとき、`display_name` の頭文字大文字が表示され `<img>` は表示されない
3. `authorWorker` の `image_url` が設定されているとき、`<img>` の src にその URL が適用される
4. `pnpm turbo run build test lint` が緑

## 4. 設計方針

- RTL（`@testing-library/react`）+ vitest で単体テスト
- 参照実装: `CommentCard.test.tsx` のパターンに準拠
- `AuthorWorker` 型は `AuthorByline.tsx` から import して型安全に使う

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `client/` のみ
- 新規ファイル: `client/src/components/AuthorByline.test.tsx`

## 6. テスト計画（TDD で書くテスト一覧）

| テストケース | 期待動作 |
|------------|----------|
| authorWorker undefined | `author` 文字列が Typography で表示される |
| image_url null | 表示名の頭文字（大文字）が表示され img は非表示 |
| image_url あり | img.src に image_url が適用される |

## 7. リスク・未決事項

なし（既存コンポーネントのテスト追加のみ）
