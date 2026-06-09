# 設計書: fix: モバイル（md 未満）ではツールチップとサイドバーの hover 表示要素を出さない (#277)

## 1. 目的 / 背景

hover 前提の UI がタッチ端末では成立せず、不自然な挙動・誤タップの原因になる。モバイル幅（`md` 未満）でのみ、ツールチップおよびサイドバーの hover 表示要素（3 点メニュー）を非表示にし、デスクトップ幅では従来どおりの hover 挙動を維持する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `useIsMobile()` カスタム hook を `client/src/hooks/useIsMobile.ts` に切り出す
- `RootLayout.tsx` のインライン `useMediaQuery` を `useIsMobile()` hook に置き換え
- `SidebarChannelSection.tsx`: モバイル時 `Tooltip` を非表示
- `ChannelList.tsx`: モバイル時 3 点メニュー `IconButton` をレンダリングしない

**やらないこと:**
- モバイルで 3 点メニューを隠した際の代替 UI（別 Issue）
- `(hover: none)` メディアクエリを用いた判定（`md` 閾値で統一する）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `useIsMobile()` hook が存在し、`useMediaQuery(theme.breakpoints.down("md"))` の結果を返す
2. `RootLayout.tsx` が `useIsMobile()` を使用しインライン判定を排除する
3. `SidebarChannelSection`: モバイル時はログイン済みでも Tooltip が表示されない
4. `SidebarChannelSection`: デスクトップ時はログイン済みで Tooltip が表示される
5. `ChannelList`: モバイル時はログイン済みでも 3 点メニューボタンが表示されない
6. `ChannelList`: デスクトップ時はログイン済みで 3 点メニューボタンが表示される
7. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `useIsMobile()` を `client/src/hooks/useIsMobile.ts` に配置（client 内に閉じ、`client → common` 境界を守る）
- `useTheme` と `useMediaQuery` は既存の `client/src/components/uiParts/index.ts` からインポート
- `SidebarChannelSection`: `isMobile` が true のとき `Tooltip` でラップせず `IconButton` のみをレンダリング
- `ChannelList`: `isMobile` が true のとき `secondaryAction` に `undefined` を渡してボタンをレンダリングしない

## 5. 影響範囲 / 既存への変更

対象ワークスペース: **client**

- 新規: `client/src/hooks/useIsMobile.ts`
- 変更: `client/src/routes/RootLayout.tsx`（hook 差し替え）
- 変更: `client/src/components/SidebarChannelSection.tsx`（Tooltip 条件分岐）
- 変更: `client/src/components/ChannelList.tsx`（secondaryAction 条件分岐）
- 新規テスト: `client/src/hooks/useIsMobile.test.ts`
- 更新テスト: `client/src/components/SidebarChannelSection.test.tsx`
- 更新テスト: `client/src/components/ChannelList.test.tsx`

## 6. テスト計画（TDD で書くテスト一覧）

**`useIsMobile.test.ts`**
- モバイル幅（matchMedia が `(max-width: ...)` にマッチ）: `true` を返す
- デスクトップ幅（マッチしない）: `false` を返す

**`SidebarChannelSection.test.tsx`（追加）**
- モバイル時 + ログイン済み: Tooltip が表示されない（`role="tooltip"` が DOM に無い）
- デスクトップ時 + ログイン済み: Tooltip タイトル文字列が DOM にある

**`ChannelList.test.tsx`（追加）**
- モバイル時 + ログイン済み: 3 点メニューボタンが表示されない
- デスクトップ時 + ログイン済み: 3 点メニューボタンが表示される

## 7. リスク・未決事項

- jsdom での `matchMedia` モック: `vi.stubGlobal("matchMedia", ...)` or `window.matchMedia` モックが必要。既存の RootLayout.test.tsx で採用しているパターンを参照して統一する。
