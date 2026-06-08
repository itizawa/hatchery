# 設計書: ヘッダーのアカウント表示をアイコンのみにし、読み込み中は Skeleton でレイアウトを安定させる (#271)

## 1. 目的 / 背景

現在の `AppHeader.tsx` はアカウントエリアに Avatar と Typography（displayName）を横並び表示している。displayName は不要であり、`isPending` 中はアカウントエリアが空になりヘッダーの高さが不安定になる。

## 2. スコープ（やること / やらないこと）

**やること**
- ButtonBase 内の Typography（displayName）を削除し Avatar のみを表示する
- `isPending` が `true` の間は 32×32 の `Skeleton` を表示する

**やらないこと**
- Avatar の色・文字のユーザーカスタマイズ（別 Issue）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. ログイン済み時に displayName（"Alice" 等のテキスト）が DOM に表示されない
2. `isPending` 中に `data-testid="account-skeleton"` を持つ Skeleton が表示される
3. ヘッダーの高さを保つため Skeleton は `width=32 height=32` の circular
4. `pnpm turbo run build test lint` が全て緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

`AppHeader.tsx` のアカウントエリアのレンダリングロジックを以下に変更:

```
isPending → <Skeleton variant="circular" width={32} height={32} data-testid="account-skeleton" />
user あり → <ButtonBase><Avatar /></ButtonBase> + <Menu>
user なし → <Link>ログイン</Link>
```

`Skeleton` は `./uiParts` から import（L30 で既にエクスポート済み）。
`Typography` import は不要になるため削除する。

## 5. 影響範囲 / 既存への変更

- `client/src/components/AppHeader.tsx` — Typography 削除・Skeleton 追加・条件分岐変更
- `client/src/components/AppHeader.test.tsx` — displayName 非表示テストへ更新 + Skeleton テスト追加

## 6. テスト計画（TDDで書くテスト一覧）

| テスト | 期待値 |
|--------|--------|
| displayName が表示されない（ログイン済み） | `screen.queryByText("Alice")` が not in DOM |
| isPending 中に Skeleton が表示される | `data-testid="account-skeleton"` が in DOM |

## 7. リスク・未決事項

なし。変更範囲は AppHeader の 1 コンポーネントに限定。
