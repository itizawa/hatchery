# Issue #732 設計書: サイドバー「探す」リンクのアイコンを他ナビ項目と揃えて中央寄せする

## 背景・目的

`SidebarCommunitySection.tsx` の「探す」リンクで、`ExploreIcon` を `Box component="span" sx={SIDEBAR_ICON_SX}` で包んでいるため、`RootLayout.tsx` の他ナビ項目（`ListItemIcon sx={SIDEBAR_ICON_SX}`）とアイコンの位置が揃わない。

MUI の `ListItemIcon` は `ListItemButton` 内でアイコンを等幅・中央寄せするための専用コンポーネントであり、`Box component="span"` では同等のスタイリング（`minWidth` + `display: flex` + `align-items: center`）が完全には再現されない。

## 変更範囲

- `client/src/components/SidebarCommunitySection.tsx` のみ（`client` ワークスペース限定）
- `client/src/components/SidebarCommunitySection.test.tsx` にテスト追加

## 設計判断

### 変更内容

`SidebarCommunitySection.tsx` の「探す」リンク部分（97〜99 行目）:

```tsx
// Before
<Box component="span" sx={SIDEBAR_ICON_SX}>
  <ExploreIcon fontSize="small" />
</Box>

// After
<ListItemIcon sx={SIDEBAR_ICON_SX}>
  <ExploreIcon fontSize="small" />
</ListItemIcon>
```

`ListItemIcon` は既に `SidebarCommunitySection.tsx` の `uiParts` インポートに含まれているため、追加インポートは不要。

### 参照実装との一致

`RootLayout.tsx` の各ナビ項目（ホーム・人気・ランキング等）は `<ListItemIcon sx={SIDEBAR_ICON_SX}>` パターンを使用している。本変更でパターンを統一する。

## 受け入れ条件の対応

| 条件 | 対応 |
|------|------|
| 1. `Box component="span"` → `ListItemIcon` に置換 | `SidebarCommunitySection.tsx` を修正 |
| 2. アイコン位置が他ナビ項目と揃う | `ListItemIcon` の MUI スタイリングにより実現 |
| 3. `RouterLink` で `/communities` へ遷移・表示は維持 | 変更は wrapper 要素のみで `RouterLink` は触らない |
| 4. `MuiListItemIcon-root` クラスを検証するテスト追加 | `SidebarCommunitySection.test.tsx` に追加 |
| 5. `client` のみ・`pnpm turbo run build test lint` 緑 | 変更対象は `client` ワークスペースのみ |

## e2e ユースケース更新

ユーザー可視の振る舞い（遷移先・表示テキスト）は変わらない（アイコンの CSS 構造変更のみ）ため、`e2e/` の更新は不要。
