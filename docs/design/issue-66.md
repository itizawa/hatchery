# 設計書: サイドバー左下にログインユーザー表示・ログアウト・設定遷移を追加 (#66)

## 1. 目的 / 背景

現在のサイドバーにはログインユーザー情報が表示されておらず、ログアウトは画面上からできない。
Slack 風 UI として、サイドバー左下にログインユーザー名・ログアウトボタン・アカウント設定への遷移を配置する。

## 2. スコープ（やること / やらないこと）

**やること**
- `UserFooter` コンポーネントを `client/src/components/UserFooter.tsx` として新規作成
- `RootLayout.tsx` のサイドバー末尾に `UserFooter` を追加（サイドバーの最下部に固定）
- 既存の単独「アカウント設定」リンクは削除し `UserFooter` に統合

**やらないこと**
- `/settings` ルートの新規追加（既存の `/account` ルートを使用）
- アバター画像の表示（displayName テキストのみ）

## 3. 受け入れ条件（テストに落とせる粒度）

- [ ] ログイン済みの場合、サイドバーにユーザーの `displayName` が表示される
- [ ] ログイン済みの場合、ログアウトボタンが表示される
- [ ] ログアウトボタン押下で `useLogout` ミューテーションが呼ばれ `/login` へ遷移する
- [ ] サイドバーの設定リンクから `/account` へ遷移できる
- [ ] 未ログイン（`null`）の場合、`UserFooter` は表示されない
- [ ] ローディング中（`isLoading`）は `UserFooter` を表示しない

## 4. 設計方針

### コンポーネント構成

```
RootLayout
  └── サイドバー (nav)
       ├── ChannelList
       ├── AddChannelForm
       ├── 管理画面リンク（現状維持）
       └── UserFooter (新規・mt:"auto" で最下部固定)
            ├── Avatar + displayName テキスト
            ├── アカウント設定リンク (RouterLink to="/account")
            └── ログアウト IconButton
```

### `UserFooter` の実装

- `useAuth()` で `user` を取得、`isLoading=true` または `user=null` の場合は何も描画しない
- `useLogout()` ミューテーションを呼び、成功後に TanStack Router の `useNavigate()` で `/login` へ遷移
- MUI の `Avatar`（イニシャル表示）+ `Typography`（displayName）+ `IconButton`（ログアウト）で構成
- `Link as RouterLink to="/account"` でアカウント設定へ遷移

### レイアウト（最下部固定）

既存サイドバーは `p: 2` で `flexDirection: "column"` ではないため、`UserFooter` に `mt: "auto"` + `pt: 2` を付けることで末尾に押し下げる。

## 5. 影響範囲 / 既存への変更

- **新規**: `client/src/components/UserFooter.tsx`
- **新規**: `client/src/components/UserFooter.test.tsx`
- **変更**: `client/src/routes/RootLayout.tsx`
  - 既存の `user && <Link to="/account">アカウント設定</Link>` を削除
  - サイドバー末尾に `<UserFooter />` を追加
  - サイドバーの Box に `display: "flex"`, `flexDirection: "column"` を追加（`mt: "auto"` が機能するため）

## 6. テスト計画

`client/src/components/UserFooter.test.tsx`（フル app render + memory history）:

1. ログイン済みで `/` にアクセスすると `displayName` が表示される
2. ログイン済みでログアウトボタンが表示される
3. ログアウトボタン押下で `useLogout` のミューテーション関数が呼ばれる
4. ログアウト成功後に `/login` へ遷移する
5. `/account` への設定リンクが存在する
6. 未ログイン時は `UserFooter` の各要素が表示されない

## 7. リスク・未決事項

- `useNavigate` は RouterProvider 内でのみ呼び出せる → フル app render でテストすることで回避
- `logout` 後の `onSuccess` コールバックで `navigate` を呼ぶ構成のため、`useMutation` の `onSuccess` 内での `useNavigate` の扱いに注意
