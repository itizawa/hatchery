# 設計書: 設定画面のタブUIを改善する（URL同期・アクセシビリティ・Slack風スタイル）(#67)

## 1. 目的 / 背景

`SettingsScene.tsx` のタブ UI が `useState` のローカル管理のみのため、リロードや URL 共有でタブ状態が失われる。また aria 属性が不十分でアクセシビリティに課題があり、テーマも MUI デフォルトのままで Slack 風テーマとの統一感がない。

## 2. スコープ（やること / やらないこと）

**やること:**
- タブ状態を URL `?tab=<value>` に同期（TanStack Router `validateSearch`・`useSearch`・`useNavigate` を利用）
- 不正な `tab` 値は `SETTINGS_TABS[0]` にフォールバック
- タブ／タブパネルに適切な `id`・`aria-labelledby` を付与
- `slackTheme` に `MuiTabs` / `MuiTab` styleOverrides を追加
- `<Tabs>` に `variant="scrollable"` / `scrollButtons="auto"` を追加

**やらないこと:**
- 新しいタブの追加・SettingsScene 以外の画面への変更
- グローバルなアクセシビリティ改修

## 3. 受け入れ条件（テストに落とせる粒度）

1. `?tab=api-token` で `/admin` を開くと「API トークン設定」タブがアクティブになっている
2. `?tab=` 無し（または不正値）で `/admin` を開くと「ユーザー一覧」（`SETTINGS_TABS[0]`）がアクティブになっている
3. タブをクリックすると URL の `?tab=` が更新される
4. 各 `<Tab>` に `id="settings-tab-{value}"` が付いている
5. 各タブパネルに `role="tabpanel"`・`id="settings-tabpanel-{value}"`・`aria-labelledby="settings-tab-{value}"` が付いている

## 4. 設計方針

### URL 同期

TanStack Router の `validateSearch` を `adminRoute` に追加し、`tab` を型安全な search param として扱う。

```ts
// router.tsx
const SETTINGS_TAB_VALUES = ["users", "api-token"] as const;
type SettingsTabValue = (typeof SETTINGS_TAB_VALUES)[number];

const adminRoute = createRoute({
  ...
  validateSearch: (search: Record<string, unknown>): { tab?: SettingsTabValue } => {
    const tab = search.tab;
    if (typeof tab === "string" && SETTINGS_TAB_VALUES.includes(tab as SettingsTabValue)) {
      return { tab: tab as SettingsTabValue };
    }
    return {};
  },
});
```

`SettingsScene` では `useSearch({ from: "/admin" })` でタブ値を取得し、`useNavigate()` でタブ切り替え時に URL を更新する。

### アクセシビリティ

```tsx
<Tab id="settings-tab-{value}" aria-controls="settings-tabpanel-{value}" ... />
<Box
  id="settings-tabpanel-{value}"
  role="tabpanel"
  aria-labelledby="settings-tab-{value}"
  hidden={active !== tab.value}
  ...
/>
```

### Slack 風スタイル

`theme.ts` の `slackTheme` に `components` を追加:
- `MuiTabs.styleOverrides.indicator`: `backgroundColor: SLACK_COLORS.blue`
- `MuiTab.styleOverrides.root`: 非アクティブ時 `color: text.secondary`、ホバー時 `color: text.primary`

## 5. 影響範囲

- `client/src/router.tsx` — `adminRoute` に `validateSearch` 追加
- `client/src/routes/SettingsScene.tsx` — `useSearch`・`useNavigate` を使うよう変更
- `client/src/theme.ts` — `components.MuiTabs`・`MuiTab` styleOverrides 追加
- `client/src/routes/SettingsScene.test.tsx` — テスト追加

## 6. テスト計画

- `?tab=api-token` でアクティブタブが「API トークン設定」になる
- `?tab=invalid` でアクティブタブが「ユーザー一覧」（フォールバック）になる
- タブパネルの aria 属性が正しく設定されている
- タブクリックで URL の `tab` パラメータが更新される

## 7. リスク・未決事項

- TanStack Router の `validateSearch` の型推論: `from: "/admin"` で正しく型が解決されることを確認する。
- `SETTINGS_TABS` の `value` 型と `SETTINGS_TAB_VALUES` を二重管理にならないよう統一する。
