# 設計書: サイドバーのコミュニティアイコンと他アイコンのサイズを統一する (#855)

## 1. 目的 / 背景

`SidebarCommunitySection.tsx` のコミュニティ一覧 `Avatar`（24px）と「探す」リンクの `ExploreIcon`（`fontSize="small"` = 20px）のサイズが不揃いで、同一縦リスト内の視覚的な整列が崩れている。両者を 20px に統一し、`SIDEBAR_ICON_SIZE` 定数で一元管理する。

## 2. スコープ（やること / やらないこと）

**やること**:
- `SidebarCommunitySection.tsx` 内の `Avatar` と `ExploreIcon` のアイコンサイズを 20px に統一
- `SIDEBAR_ICON_SIZE = 20` 定数を導入して両者に適用
- コミュニティ行の `ListItemIcon` も `SIDEBAR_ICON_SX` を再利用して整合性を維持

**やらないこと**:
- サイドバー以外の画面（`CommunityHeader` / `CommunitySidebarCard` 等）のアイコンサイズ調整
- e2e ユースケースの更新（振る舞い変化なし）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `SIDEBAR_ICON_SIZE` が 20 として export されている
2. コミュニティ Avatar のレンダリング時、コンテナの width・height が 20px である
3. iconUrl 有り（img）・無し（イニシャル）両ケースで Avatar が正しくレンダリングされる
4. 「探す」アイコン（ExploreIcon）の fontSize が 20 に一致している
5. `pnpm turbo run build test lint` が全て緑

## 4. 設計方針

- サイズ定数 `export const SIDEBAR_ICON_SIZE = 20` を `SidebarCommunitySection.tsx` に追加
- `Avatar` の sx: `{ width: SIDEBAR_ICON_SIZE, height: SIDEBAR_ICON_SIZE, fontSize: "0.75rem", bgcolor: "primary.main" }`
- `ExploreIcon`: `fontSize="small"` を削除し `sx={{ fontSize: SIDEBAR_ICON_SIZE }}` に変更
- コミュニティ行の `<ListItemIcon sx={{ minWidth: 36 }}>` は `SIDEBAR_ICON_SX`（既存定数）を再利用

## 5. 影響範囲

- `client/src/components/SidebarCommunitySection.tsx`（変更のみ）
- `client/src/components/SidebarCommunitySection.test.tsx`（テスト追加）

## 6. テスト計画（TDD で書くテスト一覧）

- `SIDEBAR_ICON_SIZE が 20 で export されている`
- `コミュニティ Avatar が width 20px height 20px でレンダリングされる`
- `iconUrl がある Avatar も width 20px height 20px でレンダリングされる`

## 7. リスク・未決事項

- `fontSize="small"` = 20px は MUI デフォルト値に依存するため、MUI バージョン変更で変わりうる。定数 `SIDEBAR_ICON_SIZE` で明示的に指定することでこの依存を解消する。
