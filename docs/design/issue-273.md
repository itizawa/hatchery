# 設計書: サイドバーのチャンネル一覧と仮想オフィス間に Divider を追加し、仮想オフィス・管理画面にアイコンと hover スタイルを適用する (#273)

## 1. 目的 / 背景

`RootLayout.tsx` の `SidebarContent` でチャンネル一覧（`SidebarChannelSection`）と仮想オフィス・管理画面リンクが区切りなく並んでおり、hover/padding 表現も統一されていない。Slack 風 UI として識別性・一貫性を高める。

## 2. スコープ（やること / やらないこと）

**やること:**
- `SidebarChannelSection` と仮想オフィスリンクの間に `Divider` を挿入（`sx={{ my: 1 }}`）
- 仮想オフィスリンクを `ListItemButton + RouterLink + ListItemIcon（BusinessIcon）+ ListItemText` パターンに変更
- 管理画面リンクも同様に `ListItemButton + RouterLink + ListItemIcon（AdminPanelSettingsIcon）+ ListItemText` パターンに変更
- `uiParts/index.ts` に `Divider`、`ListItemIcon` を追加
- アイコン・テキストの色は `SLACK_COLORS.sidebarText` を維持

**やらないこと:**
- チャンネル名称・アイコンの動的カスタマイズ
- active 状態のスタイル強調

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. デスクトップ表示時、サイドバー内に `role="separator"` の Divider が表示される
2. 「仮想オフィス」リンクが `ListItemButton` でレンダリングされ、`to="/office"` へのリンクになっている
3. 「管理画面」リンクが `ListItemButton` でレンダリングされ、`to="/admin"` へのリンクになっている（admin ユーザーのみ）
4. 仮想オフィスに対応するアイコン（`BusinessIcon` または類似）が表示される
5. 管理画面に対応するアイコン（`AdminPanelSettingsIcon` または類似）が表示される
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### コンポーネント変更: `RootLayout.tsx` の `SidebarContent`

**Before:**
```tsx
<>
  <SidebarChannelSection />
  <Box sx={{ mt: 2 }}>
    <Link component={RouterLink} to="/office" ...>仮想オフィス</Link>
  </Box>
  {user && isAdmin(user) && (
    <Box sx={{ mt: 1 }}>
      <Link component={RouterLink} to="/admin" ...>管理画面</Link>
    </Box>
  )}
</>
```

**After:**
```tsx
<>
  <SidebarChannelSection />
  <Divider sx={{ my: 1 }} />
  <List dense>
    <ListItem disablePadding>
      <ListItemButton component={RouterLink} to="/office" sx={{ color: SLACK_COLORS.sidebarText }}>
        <ListItemIcon sx={{ color: SLACK_COLORS.sidebarText, minWidth: 36 }}>
          <BusinessIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="仮想オフィス" />
      </ListItemButton>
    </ListItem>
    {user && isAdmin(user) && (
      <ListItem disablePadding>
        <ListItemButton component={RouterLink} to="/admin" sx={{ color: SLACK_COLORS.sidebarText }}>
          <ListItemIcon sx={{ color: SLACK_COLORS.sidebarText, minWidth: 36 }}>
            <AdminPanelSettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="管理画面" />
        </ListItemButton>
      </ListItem>
    )}
  </List>
</>
```

### uiParts/index.ts への追加
- `Divider`（`@mui/material/Divider`）
- `ListItemIcon`（`@mui/material/ListItemIcon`）

### アイコンの使用方針
- `@mui/icons-material/Business`（仮想オフィス: ビル/会社を表す）
- `@mui/icons-material/AdminPanelSettings`（管理画面: 管理を表す）
- アイコンは `@mui/icons-material` パッケージを直接 import（MUI icons は uiParts 経由でなく直接 import が ADR 準拠）

## 5. 影響範囲

- `client/src/components/uiParts/index.ts`（`Divider`, `ListItemIcon` 追加）
- `client/src/routes/RootLayout.tsx`（`SidebarContent` 変更）
- `client/src/routes/RootLayout.test.tsx`（Divider・アイコン・ListItemButton テスト追加）

## 6. テスト計画

1. デスクトップ幅で `role="separator"` の Divider が存在する
2. 「仮想オフィス」テキストを持つ `ListItemButton` が `/office` へのリンクになっている
3. ログイン済み admin ユーザーで「管理画面」テキストを持つ `ListItemButton` が `/admin` へのリンクになっている
4. 非 admin ユーザーには「管理画面」リンクが表示されない（既存テストの網羅範囲）

## 7. リスク・未決事項

- なし（受け入れ条件が明確で実装範囲が限定的）
