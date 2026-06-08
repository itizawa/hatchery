# 設計書: ヘッダー・サイドバーの背景を白色に、メイン領域を薄グレーに変更する（Reddit 風配色） (#272)

## 1. 目的 / 背景

現在の配色は Slack 風のダークネイビー（`#26334D`）をヘッダー・サイドバーに使用している。
Reddit のように白基調の明るい UI に変更し、読みやすさと視覚的統一性を向上させる。

## 2. スコープ（やること / やらないこと）

**やること:**
- `SLACK_COLORS.sidebar` を `#26334D` → `#FFFFFF`
- `SLACK_COLORS.sidebarText` を `#FFFFFF` → `#1A1A1B`
- `SLACK_COLORS.mainBackground: "#F6F7F8"` を新規追加
- `slackTheme.palette.background.default` を `#F6F7F8`（`mainBackground` 経由）に変更

**やらないこと:**
- `SLACK_COLORS` 定数名の改名（別 Issue）
- ダークモード対応
- server / common への変更
- AppHeader.tsx / RootLayout.tsx / SidebarChannelSection.tsx / ChannelList.tsx の個別変更（`SLACK_COLORS` 参照のため値変更で自動追従）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `SLACK_COLORS.sidebar` が `#FFFFFF` である
2. `SLACK_COLORS.sidebarText` が `#1A1A1B` である
3. `SLACK_COLORS.mainBackground` が `#F6F7F8` である
4. `slackTheme.palette.background.default` が `SLACK_COLORS.mainBackground`（`#F6F7F8`）である
5. `slackTheme.palette.mode` が `"light"` のまま
6. `slackTheme.palette.primary.main` が `SLACK_COLORS.blue` のまま
7. `client` ワークスペースのみ変更。`server` / `common` は不変

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- 変更対象は `client/src/theme.ts` のみ
- `SLACK_COLORS` の色定数値を更新し、`mainBackground` を追加する
- `slackTheme.palette.background.default` を `SLACK_COLORS.mainBackground` に変更する
- AppHeader.tsx・RootLayout.tsx・SidebarChannelSection.tsx・ChannelList.tsx は `SLACK_COLORS` の参照のみで値変更による自動追従を確認済み
- ADR-0003 のコンポーネント構成決定には反しない（色値の変更は ADR 更新不要）

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|---------|----------|
| `client/src/theme.ts` | `SLACK_COLORS` の `sidebar`・`sidebarText` 値変更、`mainBackground` 追加、`palette.background.default` 更新 |
| `client/src/theme.test.ts` | 新しい色値に対応するテストの更新 |

## 6. テスト計画（TDD で書くテスト一覧）

`client/src/theme.test.ts` を更新:

- `SLACK_COLORS.sidebar` が `#FFFFFF` であること
- `SLACK_COLORS.sidebarText` が `#1A1A1B` であること
- `SLACK_COLORS.mainBackground` が `#F6F7F8` であること
- `slackTheme.palette.background.default` が `SLACK_COLORS.mainBackground` であること（旧値 `SLACK_COLORS.background` ではない）
- `slackTheme.palette.mode` が `"light"` であること（既存テスト維持）
- `slackTheme.palette.primary.main` が `SLACK_COLORS.blue` であること（既存テスト維持）

## 7. リスク・未決事項

- 白ヘッダー・白サイドバーへの変更で `AppHeader` の視認性が低下するリスクがあるが、`SLACK_COLORS.sidebarText` を `#1A1A1B`（濃色）に変更することで対処する
- `background.paper` が `#FFFFFF` なので、白背景サイドバーとの境界が曖昧になる可能性があるが、`borderRight: 1, borderColor: "divider"` が既に設定されているため許容範囲
