# 設計書: チャンネル詳細のメッセージ入力フォームを Slack 風に画面下部へ固定配置する (#203)

## 1. 目的 / 背景

`ChannelScene` でメッセージが増えると入力フォームが画面外へ押し出される問題を解消する。
Slack と同様に、入力フォームを常に画面下部に固定し、メッセージ一覧のみがスクロールする UX にする。

## 2. スコープ（やること / やらないこと）

### やること

- `RootLayout` の `<main>` 領域をビューポート高に拘束し、`ChannelScene` が `height: 100%` で使えるようにする
- `ChannelScene` をフレックスカラムで縦分割し、ChannelView 上部スクロール + MessageInput 下部固定にする
- `MessageInput` に Slack 風スタイル（上端区切り線 `borderTop`・背景色整合）を付ける

### やらないこと

- Enter 送信 / Shift+Enter 改行のリッチ入力（別 Issue）
- スレッド・未読既読・絵文字・添付（別 Issue）
- `MessageInput` / `ChannelView` の既存インターフェース変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. DOM 上で `MessageInput`（送信ボタン）が `ChannelView`（メッセージ一覧 aria-label）より後ろ（下）に位置する
2. `MessageInput` の既存テスト 5 件（空文字 disabled / 入力 enabled / onSubmit 呼ばれる / 送信後クリア / disabled=true 双方無効）が引き続き緑
3. `ChannelView` の既存テスト 7 件が引き続き緑
4. `pnpm turbo run build|test|lint` + `pnpm typecheck` 全緑

## 4. 設計方針

### 4-1. RootLayout の高さ拘束

```
変更前: <Box sx={{ display:"flex", minHeight:"100vh" }}>
変更後: <Box sx={{ display:"flex", height:"100vh" }}>

<Box component="main" sx={{ flexGrow:1, ... }}>
→ overflow:"hidden" を追加してビューポート外に溢れさせない
```

`minHeight` だとコンテンツが多いときに 100vh を超えて伸びる。`height: 100vh` に固定し、
main は `overflow: hidden` で溢れを隠す。これにより子要素が `height: 100%` で
ビューポート高に追随できる。

他ルート（ログイン・管理画面等）への影響: ページ自体のスクロールが必要な画面は overflow-y: auto 相当の Box で内部スクロールを持てばよい。現状の admin / settings / login は短いため問題なし。

### 4-2. ChannelScene のフレックスレイアウト

```tsx
<Box sx={{ display:"flex", flexDirection:"column", height:"100%" }}>
  <Box sx={{ flex:1, overflow:"auto" }}>  {/* スクロール領域 */}
    <ChannelView ... />
  </Box>
  {authUser && <MessageInput ... />}  {/* 下部固定 */}
</Box>
```

ChannelView・MessageInput の props インターフェースは変更しない（presentational 維持）。

### 4-3. MessageInput のスタイル追加

```tsx
<Box component="form" sx={{
  display:"flex", gap:1, p:2,
  borderTop:1, borderColor:"divider",
  flexShrink:0,
  bgcolor:"background.default",
}}>
```

`borderTop` で上端区切り線を付与（Slack 風）。`flexShrink: 0` で縮まないことを明示。
`bgcolor` は既存テーマ（白）に合わせる。

## 5. 影響範囲 / 既存への変更

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `client/src/routes/ChannelScene.tsx` | 変更 | Box ラッパー追加・uiParts から Box import |
| `client/src/routes/RootLayout.tsx` | 変更 | `minHeight` → `height`・main に `overflow:hidden` |
| `client/src/components/MessageInput.tsx` | 変更 | `borderTop`・`flexShrink:0`・`bgcolor` を sx に追加 |
| `client/src/routes/ChannelScene.test.tsx` | 新規 | DOM 順序テスト |
| `client/src/routes/ChannelScene.stories.tsx` | 変更 | 多メッセージ story 追加 |

## 6. テスト計画（TDD で書くテスト一覧）

`client/src/routes/ChannelScene.test.tsx`（新規）:

- `MessageInput (送信ボタン) が ChannelView (メッセージ一覧) より後ろ (下) に位置する`
  - useParams / useChannels / useChannelMessages / usePostChannelMessage / useAuth を vi.mock でモック
  - `compareDocumentPosition` で DOCUMENT_POSITION_FOLLOWING を確認

## 7. リスク・未決事項

- **他ルートのスクロール**: `height: 100vh` + `main overflow: hidden` にすると、将来コンテンツが長い画面（設定画面等）でスクロールしなくなる可能性。現状は短いため問題なし。必要なら各 Scene 側で `overflow-y: auto` の Box を持てばよい。
- **`ChannelScene` の Suspense 境界**: `useChannels` / `useChannelMessages` は `useSuspenseQuery` 使用。テストでは hooks をモック（vi.mock でラップ）して Suspense なしで描画可能。
