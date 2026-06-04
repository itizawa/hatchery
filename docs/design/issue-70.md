# 設計書: ログインページ専用レイアウト（サイドバーなし）を作成する (#70)

## 1. 目的 / 背景

現在 `/login` ルートは `rootRoute`（`RootLayout` を使用）の子ルートとして定義されており、ログインページにもサイドバーが表示されてしまう。ログインページはサイドバー不要なため、専用レイアウトに切り出す。

## 2. スコープ（やること / やらないこと）

**やること:**
- `AuthLayout.tsx` を作成する（サイドバーなし・シンプルなレイアウト）
- `router.tsx` を TanStack Router の pathless layout route 方式でリファクタリングし、`/login` を `AuthLayout` 下に置く
- 既存ルート（`/`, `/channels/:channelId`, `/admin`, `/account`）は引き続き `RootLayout`（サイドバーあり）で描画される

**やらないこと:**
- サイドバーのデザイン変更
- ログインページ自体（`LoginScene`）の変更
- 認証フロー（beforeLoad ガード）の変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `/login` にアクセスしたとき `<nav aria-label="サイドバー">` が DOM に存在しない
- `/login` にアクセスしたとき「ログイン」見出しが描画される
- `/` にアクセスしたときサイドバー（ChannelList）が引き続き描画される
- `/channels/:channelId` にアクセスしたときサイドバーが引き続き描画される
- `/admin` にアクセスしたときサイドバーが引き続き描画される（ログイン済み前提）
- `pnpm --filter @hatchery/client test` 全テスト通過
- `pnpm --filter @hatchery/client lint` 通過

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### TanStack Router の pathless layout route 方式

TanStack Router では、`path` の代わりに `id` を指定することで「URL に影響しないレイアウト専用のルート（pathless layout route）」を作れる。これを使い、ルートツリーを以下のように再構成する。

**変更前:**
```
rootRoute (RootLayout - サイドバーあり)
  ├── indexRoute (/)
  ├── channelRoute (/channels/$channelId)
  ├── loginRoute (/login)  ← サイドバーが出てしまう
  ├── adminRoute (/admin)
  └── accountRoute (/account)
```

**変更後:**
```
rootRoute (component なし = <Outlet /> のみ)
  ├── appLayoutRoute (id="_app", RootLayout - サイドバーあり)
  │   ├── indexRoute (/)
  │   ├── channelRoute (/channels/$channelId)
  │   ├── adminRoute (/admin)
  │   └── accountRoute (/account)
  └── authLayoutRoute (id="_auth", AuthLayout - サイドバーなし)
      └── loginRoute (/login)
```

`rootRoute` を `component: () => <Outlet />` に変更し、既存の `RootLayout`（サイドバーあり）を `appLayoutRoute` に移動する。`authLayoutRoute` は `AuthLayout`（サイドバーなし）を持つ。

### AuthLayout コンポーネント

サイドバーを持たないシンプルなラッパー。`LoginScene` 自体が `Box` でレイアウトを管理しているため、`AuthLayout` は `<Outlet />` を提供するだけでよい。

## 5. 影響範囲 / 既存への変更

- **client/src/routes/AuthLayout.tsx** — 新規作成
- **client/src/router.tsx** — `rootRoute` のコンポーネント変更・`appLayoutRoute`・`authLayoutRoute` 追加・ルートツリー再構成
- **client/src/router.test.tsx** — `/login` でサイドバーが表示されないことを検証するテストを追加

既存の `RootLayout.tsx` / `LoginScene.tsx` への変更はなし。

## 6. テスト計画（TDDで書くテスト一覧）

| # | テスト内容 | 検証方法 |
|---|-----------|---------|
| 1 | `/login` でサイドバーが表示されない | `queryByRole("navigation", { name: /サイドバー/ })` が null |
| 2 | `/login` で「ログイン」見出しが表示される | `findByRole("heading", { name: /ログイン/ })` が存在 |
| 3 | `/` でサイドバーが引き続き表示される（既存テストで担保） | `findByText("#雑談")` が存在 |

## 7. リスク・未決事項

- `rootRoute` のコンポーネント変更により、既存のルーターテストで `RootLayout` の描画前提があれば修正が必要（確認済み: `router.test.tsx` はサイドバーの存在を前提とするが、ホーム・チャンネルルートは引き続き `RootLayout` 下に置くため影響なし）
- TanStack Router の pathless layout route が `router.test.tsx` の型に影響する可能性 → `routeTree` の型は自動推論されるため問題ない
