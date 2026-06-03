# 設計書: サイドバー背景色を #26334D（ダークネイビー）に変更 (#65)

## 1. 目的 / 背景

Slack のダークサイドバー風の見た目を実現するため、サイドバー背景色を現在の明色（`#F8F8FA`）からダークネイビー（`#26334D`）に変更する。あわせて背景が暗くなることでテキストが視認不能になるため、サイドバー内のテキスト色を白系へ上書きする。

## 2. スコープ（やること / やらないこと）

**やること:**
- `SLACK_COLORS.sidebar` を `#26334D` へ変更
- サイドバーのメインテキスト（"Hatchery" タイトル・リンク等）の色を白系に変更（`RootLayout.tsx`）
- `ChannelList` の `ListItemButton` / `ListItemText` のテキスト色を MUI theme の `components` styleOverrides で白系に上書き
- `theme.test.ts` に新規テストを追加し、既存テストを緑に保つ

**やらないこと:**
- `palette.mode` を `"dark"` に変更すること（既存テスト #1・#6 が `"light"` 前提のため）
- サイドバー以外のコンポーネントのスタイル変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `SLACK_COLORS.sidebar === "#26334D"` であること
- `slackTheme.palette.background.paper === "#26334D"` であること
- `slackTheme.components.MuiListItemButton.styleOverrides.root` が定義されており、`color` に白系の値（`#FFFFFF` 相当）を含むこと
- 既存の `theme.test.ts` のテスト（ライトモード確認・プライマリカラー・背景色等）がすべて緑であること
- `pnpm --filter @hatchery/client test` が全テスト緑
- `pnpm --filter @hatchery/client lint` が通過

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### テキスト色の実現方式

`palette.mode` を変更すると `text.primary` が白になりメインエリアも影響を受けるため、**サイドバーに限定した上書き方式**を採用する。

- **テーマ側**: `slackTheme` の `components.MuiListItemButton.styleOverrides.root` と `components.MuiListItemText.styleOverrides.primary` に `color: "#FFFFFF"` を設定。これにより `ChannelList` 内のアイテムが自動で白文字になる。
- **RootLayout 側**: サイドバー `<Box>` の `sx` プロパティで `color: "#FFFFFF"` を明示し、タイトル・リンク等を白にする。

### SLACK_COLORS 定数の追加

```ts
export const SLACK_COLORS = {
  blue: "#1164A3",
  sidebar: "#26334D",           // ← #F8F8FA から変更
  sidebarText: "#FFFFFF",       // ← 新規追加
  background: "#FFFFFF",
} as const;
```

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|---------|----------|
| `client/src/theme.ts` | `SLACK_COLORS.sidebar` 変更、`sidebarText` 追加、`components` styleOverrides 追加 |
| `client/src/theme.test.ts` | 新規テスト追加（サイドバー色・styleOverrides 検証）、test #4 の説明文更新 |
| `client/src/routes/RootLayout.tsx` | サイドバー Box の `color` を `"#FFFFFF"` に変更 |

`ChannelList.tsx` 自体は変更不要（テーマの styleOverrides で対応）。

## 6. テスト計画（TDD で書くテスト一覧）

### 追加するテスト（`theme.test.ts`）

1. `SLACK_COLORS.sidebar === "#26334D"` → 実装前に失敗することを確認
2. `slackTheme.palette.background.paper === "#26334D"` → 実装前に失敗
3. `MuiListItemButton styleOverrides.root` が定義されている → 実装前に失敗

### 既存テスト（変更なし・緑を維持）

- `slackTheme.palette.mode === "light"` ← 変更しないので通過
- `slackTheme.palette.primary.main === SLACK_COLORS.blue` ← 変更なしで通過
- `slackTheme.palette.background.paper === SLACK_COLORS.sidebar` ← 値が更新されるので通過
- `slackTheme.palette.text.primary` が暗色 ← light mode 維持で通過

## 7. リスク・未決事項

- **test #4 の説明文**: 現在「ライト用の明るい色」と記載されているが `#26334D` はダーク色。アサーション自体は通過するが、説明文を更新する（テスト意図の正確さのため）。
- **`RootLayout` のリンク色**: `color: "inherit"` となっているリンクは白になる。視認性は改善される。
