# 設計書: サイドバー背景色を #26334D（ダークネイビー）に変更 (#65)

## 1. 目的 / 背景

Slack のダークサイドバー風の見た目を実現するため、サイドバー背景色を現在の明色（`#F8F8FA`）からダークネイビー（`#26334D`）に変更する。あわせて背景が暗くなることでテキストが視認不能になるため、サイドバー内のテキスト色を白系へ上書きする。

## 2. スコープ（やること / やらないこと）

**やること:**
- `SLACK_COLORS.sidebar` を `#26334D` へ変更
- `SLACK_COLORS.sidebarText` を `#FFFFFF` として新規追加
- サイドバー内の各要素（Typography・Link・ChannelList の ListItemButton）に明示的に白テキスト色を設定
- `theme.test.ts` に新規テストを追加し、既存テストを緑に保つ

**やらないこと:**
- `palette.mode` を `"dark"` に変更すること（既存テスト #1・#6 が `"light"` 前提のため）
- `background.paper` を暗色に設定すること（TableContainer・Dialog 等の Paper サーフェス汚染を防ぐため）
- MUI コンポーネントにグローバルな theme override を追加すること（スコープが広すぎる）
- サイドバー以外のコンポーネントのスタイル変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `SLACK_COLORS.sidebar === "#26334D"` であること
- `SLACK_COLORS.sidebarText === "#FFFFFF"` であること
- `background.paper` がサイドバー暗色（`#26334D`）に汚染されていないこと（他の Paper サーフェスが正常に動作）
- 既存の `theme.test.ts` のテスト（ライトモード確認・プライマリカラー・背景色等）がすべて緑であること
- `pnpm --filter @hatchery/client test` が全テスト緑
- `pnpm --filter @hatchery/client lint` が通過

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### テキスト色の実現方式

`palette.mode` 変更や global theme override は影響スコープが広すぎるため採用しない。**サイドバー内の各要素に per-element で明示的に色を設定する**方式を採用する。

- **`RootLayout.tsx`**: サイドバー `<Box>` の `bgcolor` に `SLACK_COLORS.sidebar` を直接指定（`background.paper` トークン依存を排除）。Typography・Link には `sx={{ color: SLACK_COLORS.sidebarText }}` を個別に付与。
- **`ChannelList.tsx`**: `ListItemButton` に `sx={{ color: SLACK_COLORS.sidebarText }}` を付与。`ListItemText` は親の `ListItemButton` から CSS 継承で白テキストを受け取る。
- **`AddChannelForm`**: サイドバー Box から `color` 継承をしないため、TextField/Label は MUI 既定のダーク色（`text.primary`）で描画される（この PR のスコープ外）。

### SLACK_COLORS 定数

```ts
export const SLACK_COLORS = {
  blue: "#1164A3",
  sidebar: "#26334D",       // ← #F8F8FA から変更
  sidebarText: "#FFFFFF",   // ← 新規追加
  background: "#FFFFFF",
} as const;
```

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|---------|----------|
| `client/src/theme.ts` | `SLACK_COLORS.sidebar` 変更、`sidebarText` 追加。`background.paper` の overrideは除去。 |
| `client/src/theme.test.ts` | 新規テスト追加（sidebar / sidebarText / background.paper 汚染なし検証）、不適切なテストを更新 |
| `client/src/routes/RootLayout.tsx` | `SLACK_COLORS` をインポート。`bgcolor` を直接参照、Typography・Link に白色を明示設定 |
| `client/src/components/ChannelList.tsx` | `SLACK_COLORS` をインポート。`ListItemButton` に `sx={{ color: sidebarText }}` を追加 |

## 6. テスト計画（TDD で書くテスト一覧）

### 追加したテスト（`theme.test.ts`）

1. `SLACK_COLORS.sidebar === "#26334D"` — ダークネイビーへの変更を検証
2. `SLACK_COLORS.sidebarText === "#FFFFFF"` — 白テキスト定数の定義を検証
3. `background.paper !== "#26334D"` — Paper サーフェス汚染がないことを検証

### 既存テスト（変更なし・緑を維持）

- `slackTheme.palette.mode === "light"` ← 変更しないので通過
- `slackTheme.palette.primary.main === SLACK_COLORS.blue` ← 変更なしで通過
- `slackTheme.palette.background.default === SLACK_COLORS.background` ← 変更なしで通過
- `slackTheme.palette.text.primary` が暗色 ← light mode 維持で通過

## 7. リスク・未決事項

- **AddChannelForm のラベル色**: サイドバーがダークになったことで AddChannelForm の "チャンネル名" / "タイプ" ラベルはダーク色（text.primary）になり、ダーク背景上でのコントラストが低い。この PR のスコープ外であり、別 Issue での対応を推奨する。
