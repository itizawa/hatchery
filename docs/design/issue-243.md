# 設計書: Reddit 風グローバルヘッダーを追加し、アカウントメニューをヘッダー右上へ移動する (#243)

## 1. 目的 / 背景

現在の RootLayout はサイドバー下部に UserFooter（Avatar・表示名・ログアウト等）を配置しているが、
Reddit のようにページ上部に水平ヘッダーを固定しアカウント操作を右上へ移動することで、
どの画面からでもユーザー情報とアクションに素早くアクセスできる UX を実現する。

## 2. スコープ（やること / やらないこと）

### やること
- `AppHeader` コンポーネント（全幅ショット・sticky・SLACK_COLORS.sidebar 背景）の新規作成
- RootLayout に AppHeader を組み込み、UserFooter をサイドバーから削除
- `UserFooter.tsx` / `UserFooter.test.tsx` の削除（未使用コードを残さない）

### やらないこと（別 Issue）
- ヘッダーへの検索バー追加
- 管理画面リンクのヘッダー移動（#190 のレスポンシブ対応と調整）
- ヘッダーのハンバーガーメニュー化（#190）

## 3. 受け入れ条件

1. `client/src/components/AppHeader.tsx` を新規作成する
   - 左端: Hatchery ブランド名（`/` へのリンク）
   - 右端: ログイン済み → Avatar(32px)・表示名・ユーザーメニュー（アカウント設定・ログアウト）
   - 右端: 未ログイン → 何も表示しない
   - 全幅・`position: sticky` / `top: 0`・`z-index` をコンテンツより上
   - 背景: `SLACK_COLORS.sidebar`、テキスト: `SLACK_COLORS.sidebarText`
2. `RootLayout.tsx` を更新する
   - `AppHeader` を最上部に配置（`flex-direction: column` の外枚）
   - サイドバーから `<UserFooter />` を削除
3. `UserFooter.tsx` / `UserFooter.test.tsx` を削除する
4. `AppHeader.test.tsx` を追加し、ログイン済み・未ログイン・ログアウト操作を検証する
5. `pnpm turbo run build|test|lint` が緑

## 4. 設計方针

### AppHeader の構成
```
<AppBar position="sticky" sx={{ bgcolor: SLACK_COLORS.sidebar, zIndex: ... }}>
  <Toolbar>
    <Link to="/">Hatchery</Link>    ← 左端（flexGrow: 1 のダミー Box で右寄せ）
    <Box sx={{ ml: "auto" }}>       ← 右端
      <ButtonBase aria-label="ユーザーメニュー"> ← ログイン済みのみ表示
        <Avatar>{initial}</Avatar>
        <Typography>{displayName}</Typography>
      </ButtonBase>
      <Menu>
        <MenuItem to="/account">アカウント設定</MenuItem>
        <MenuItem onClick={handleLogout}>ログアウト</MenuItem>
      </Menu>
    </Box>
  </Toolbar>
</AppBar>
```

### レイアウト変更（RootLayout）
```
Before:
  <Box display="flex" minHeight="100vh">
    <Sidebar>
      ...
      <UserFooter />   ← サイドバー下部
    </Sidebar>
    <Main><Outlet /></Main>
  </Box>

After:
  <Box display="flex" flexDirection="column" minHeight="100vh">
    <AppHeader />    ← 最上部
    <Box display="flex" flexGrow={1}>
      <Sidebar>...</Sidebar>
      <Main><Outlet /></Main>
    </Box>
  </Box>
```

### UserFooter の処理
- `UserFooter.tsx` / `UserFooter.test.tsx` を削除する
- アカウントロジック（useAuth / useLogout / navigate）は AppHeader に移植

## 5. 影響範囲 / 既存への変更

- **client** ワークスペースのみ変更
- `client/src/components/AppHeader.tsx` — 新規追加
- `client/src/components/AppHeader.test.tsx` — 新規追加
- `client/src/routes/RootLayout.tsx` — AppHeader 追加・UserFooter 削除
- `client/src/components/UserFooter.tsx` — 削除
- `client/src/components/UserFooter.test.tsx` — 削除

## 6. テスト計画

`AppHeader.test.tsx` に以下を網羅:
1. ログイン済みのとき displayName が表示される
2. 初期表示時にアカウント設定 menuitem が DOM 上に存在しない（Menu は閉じている）
3. 初期表示時にログアウト menuitem が DOM 上に存在しない（Menu は閉じている）
4. ユーザーメニュートリガーボタンが表示される
5. トリガークリック後にアカウント設定 menuitem が表示される
6. トリガークリック後にログアウト menuitem が表示される
7. ログアウト menuitem クリックで /auth/logout への POST リクエストが送信される
8. ログアウト成功後に /login へ遷移する
9. 未ログイン時は displayName が表示されない
10. 未ログイン時はユーザーメニュートリガーが表示されない

## 7. リスク・未決事項

- AppBar の `z-index` は MUI 既定（1100）を使用。モーダル（1300）より低いが通常コンテンツより高い。
- サイドバーが AppHeader の下に潜り込まないよう `minHeight: 0` / `overflow: auto` の調整が必要な場合がある。
