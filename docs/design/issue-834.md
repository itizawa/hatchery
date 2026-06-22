# 設計書: コミュニティ／ホームフィードのポスト一覧を Reddit 風フラットリストに変更する (#834)

## 1. 目的 / 背景

コミュニティ詳細（`/communities/:slug`）とホームフィード（`/`・`/popular`）のポスト一覧が現在カード風（`border: 1px solid` + `bgcolor: background.paper` + `borderRadius: 1` + `mb: 1`）で表示されている。Reddit 風の「フラットリスト + border-bottom 区切り + hover 背景色変化」に変更し、情報密度を高め読み継ぎやすい UX を実現する。

## 2. スコープ（やること / やらないこと）

**やること**:
- `PostCard` に `variant?: "card" | "list"` prop を追加し、`"list"` 時に外枠カードスタイルを除去して border-bottom のみ付与する
- `CommunityScene.tsx` の post 一覧コンテナに `borderTop` + hover スタイルを追加し、`PostCard` を `variant="list"` で呼び出す
- `HomeFeedScene.tsx` も同様に変更する
- `PostCard.test.tsx` に `variant="list"` のテストを追加する
- e2e ユースケース（community・home-feed）にフラットリスト表示の UC を追記する

**やらないこと**:
- PostThread（スレッド詳細）の PostCard スタイル変更（スコープ外。`variant` デフォルト `"card"` で現行維持）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `PostCard` に `variant?: "card" | "list"` prop が追加されている（型定義）。デフォルトは `"card"`。
2. `variant="list"` レンダリング時：外枠 Box に `border: "1px solid"` の属性が存在しない（または `bgcolor: "background.paper"` 相当の外枠がない）。
3. `variant="list"` レンダリング時：外枠 Box が `borderBottom: "1px solid"` を持つ（border-bottom が存在する）。
4. `CommunityScene.tsx` の post 一覧コンテナに `borderTop: "1px solid"` + hover `bgcolor: action.hover` スタイルが付与されている。
5. `HomeFeedScene.tsx` の post 一覧コンテナに同様の `borderTop` + hover スタイルが付与されている。
6. `pnpm --filter @hatchery/client test` が緑。
7. `pnpm lint` が緑（ESLint flat config）。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### PostCard の variant prop 設計

`PostCard` の discriminated union 型（`loading: true` / `loading?: false`）はそのまま維持する。`variant` は loading 分岐とは独立した prop として、非 loading 側の型定義に追加する。`outerBoxSx` を `variant` に応じて切り替えるオブジェクトを用意する。

```ts
// "card" スタイル（現行維持）
const cardBoxSx = {
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1,
  p: 2,
  bgcolor: "background.paper",
  mb: 1,
} as const;

// "list" スタイル（新規）
const listBoxSx = {
  borderBottom: "1px solid",
  borderColor: "divider",
  p: 2,
} as const;
```

- loading Skeleton は現行の `outerBoxSx`（card スタイル）を維持する（Skeleton には variant を渡さない）。
- `variant` のデフォルト値は `"card"` とし、既存の呼び出し箇所（PostThread 等）はそのまま動く。

### CommunityScene / HomeFeedScene の変更

- `RouterLink` を `Box` でラップし、`Box` に hover スタイル（`"&:hover": { bgcolor: "action.hover", borderRadius: 2, cursor: "pointer" }`）を付与する。
- `RouterLink` 自体の `style={{ display: "block", textDecoration: "none", color: "inherit" }}` は `Box` への `sx` として移動する（またはラップした Box に適用）。
- ポスト一覧コンテナ Box に `borderTop: "1px solid"` + `borderColor: "divider"` を追加する。
- `PostCard` に `variant="list"` を渡す。

## 5. 影響範囲 / 既存への変更

対象ワークスペース: **client のみ**（server・common・docs への変更なし）

| ファイル | 変更内容 |
|----------|----------|
| `client/src/components/PostCard.tsx` | `variant` prop 追加・`outerBoxSx` 切り替えロジック追加 |
| `client/src/routes/CommunityScene.tsx` | post 一覧 Box に borderTop・hover スタイル追加・RouterLink を Box でラップ・PostCard に `variant="list"` 追加 |
| `client/src/routes/HomeFeedScene.tsx` | 同上 |
| `client/src/components/PostCard.test.tsx` | `variant="list"` のテスト追加 |
| `e2e/community/usecases.md` | UC-COMM-18 追記 |
| `e2e/home-feed/usecases.md` | UC-HOME-25 追記 |
| `e2e/usecases.md` | 索引更新 |

## 6. テスト計画（TDD で書くテスト一覧）

`PostCard.test.tsx` に `describe("variant（フラットリスト・#834）")` を追加し：

1. `variant="list"` 時、外枠に `bgcolor: "background.paper"` を持つ Box が存在しない（カードスタイルなし）
2. `variant="list"` 時、外枠に `borderBottom` スタイルを持つ要素が存在する
3. `variant` 未指定（デフォルト）時、既存の card スタイルが維持される（回帰確認）

## 7. リスク・未決事項

- `action.hover` は MUI テーマのカラーであり、ライト/ダーク切り替え等で自動適用されるため問題なし。
- `borderRadius: 2`（= 8px）の hover 丸みは CLAUDE.md の禁止パターン（16px 以上）に抵触しないため問題なし。
