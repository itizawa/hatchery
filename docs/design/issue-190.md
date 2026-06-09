# Issue #190 設計書: モバイル幅でサイドバーをドロワー化しレスポンシブ表示に対応する

## 目的

`RootLayout.tsx` を改修し、モバイル幅（`md` ブレークポイント未満）でサイドバーをドロワー（MUI `Drawer` の `variant="temporary"`）に変更する。デスクトップ幅（`md` 以上）では従来どおり恒久サイドバーを横並び表示する。

## 変更対象ファイル

- `client/src/routes/RootLayout.tsx` — 改修対象
- `client/src/components/AppHeader.tsx` — ハンバーガーボタン追加のため改修
- `client/src/routes/RootLayout.test.tsx` — 新規テストファイル
- `client/src/components/uiParts/index.ts` — `AppBar`, `Toolbar`, `Drawer`, `IconButton` を追加エクスポート

## 設計方針

### コンポーネント構成

```
RootLayout
├── AppHeader (既存)
│   └── ハンバーガーボタン（モバイルのみ表示）を受け取る
│       → props: onMenuOpen?: () => void
└── Body (display: flex)
    ├── Drawer variant="temporary" (モバイル: md未満のみ)
    │   └── SidebarContent（共通コンポーネント）
    ├── 恒久サイドバー nav (デスクトップ: md以上のみ)
    │   └── SidebarContent（共通コンポーネント）
    └── メイン領域
        └── Outlet
```

### サイドバー内容の共通化

`SidebarContent` という内部コンポーネント（`RootLayout.tsx` 内に定義、外部 export は不要）を作り、ドロワーと恒久サイドバーの両方で再利用する。

内容:
- `SidebarChannelSection`
- 仮想オフィスリンク
- 管理画面リンク（管理者のみ）

### ナビゲーション後のドロワー自動クローズ

MUI `Drawer` の `variant="temporary"` ではナビゲーションを検知して自動クローズする必要がある。`@tanstack/react-router` の `useLocation` フックを用い、パス変化を `useEffect` で監視してドロワーを閉じる。

### モバイル幅でのオーバーフロー防止

メイン領域（`main`）の `Box` に `minWidth: 0` と `overflow: "auto"` を設定して横スクロールを防ぐ。

### uiParts への追加

`Drawer`, `AppBar`, `Toolbar`, `IconButton` は既に export されているもの（`IconButton` は既存）。`Drawer` と `AppBar`, `Toolbar` を追加する。

## 受け入れ条件とテスト対応

| 受け入れ条件 | テスト内容 |
|---|---|
| モバイル幅でハンバーガーボタンが表示される | matchMedia モックで md 未満に設定し、ハンバーガーボタンが存在する |
| ハンバーガーボタンクリックでドロワーが開く | クリック後にドロワー内サイドバー内容が表示される |
| デスクトップ幅で恒久サイドバーが表示される | matchMedia モックで md 以上に設定し、nav aria-label="サイドバー" が表示される |
| チャンネル選択でドロワーが閉じる | ドロワー開状態でルート変化をシミュレートし、ドロワーが閉じる |
| メイン領域が横スクロールを起こさない | CSS の minWidth: 0 設定を確認する（スナップショットまたは style 確認） |

## MUI ブレークポイント

MUI v6 デフォルトブレークポイント:
- `xs`: 0px
- `sm`: 600px
- `md`: 900px（モバイル/デスクトップの境界）
- `lg`: 1200px
- `xl`: 1536px

`useMediaQuery(theme.breakpoints.down("md"))` で `md` 未満かどうかを判定する。

## 実装詳細

### `AppHeader` の変更

`AppHeader` に `onMenuOpen?: () => void` props を追加し、モバイル幅（`useMediaQuery`）でハンバーガーボタンを表示する。

### `RootLayout` の変更

1. `useState` で `drawerOpen` を管理
2. `useLocation` と `useEffect` でパス変化を監視しドロワーを閉じる
3. `useMediaQuery(theme.breakpoints.down("md"))` でモバイル判定
4. モバイル: `Drawer variant="temporary"` を表示（サイドバーは非表示）
5. デスクトップ: 恒久サイドバーを表示（Drawer は非表示）
6. `AppHeader` に `onMenuOpen` を渡す（モバイルのみ有効）

### ドロワーの幅

ドロワー幅はデスクトップサイドバーと同じ 260px に統一する。
