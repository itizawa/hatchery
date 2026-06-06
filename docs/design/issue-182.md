# 設計書: サイドバーのチャンネル一覧から各チャンネル詳細画面へ遷移できるようにする (#182)

## 1. 目的 / 背景

`ChannelList.tsx` のチャンネル項目（`ListItemButton`）にルーティングリンクが付いておらず、クリックしても何も起きない。ルート定義・レイアウト・チャンネル取得はすべて実装済みで、欠けているのはサイドバーからのリンク 1 点のみ。

## 2. スコープ（やること / やらないこと）

**やること**:
- `ChannelList.tsx` の `ListItemButton` を TanStack Router の `Link` を用いたリンクに変更する
- `ChannelList.test.tsx` に遷移先 href の検証テストを追加する

**やらないこと**:
- server / common / OpenAPI への変更
- アクティブチャンネルのハイライト表示・未読バッジ
- チャンネル作成モーダル化 (#177) / ユーザー操作 Menu 集約 (#176)

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `ChannelList.tsx` の各チャンネル項目が `<a href="/channels/{channel.id}">` として描画される
2. 既存テスト（ラベル表示・タイプアイコン表示）が引き続き緑であること
3. `ChannelList.test.tsx` にルータ内描画でリンクの `href` を検証するテストが追加されている
4. スタイル: `textDecoration: "none"` でリンクの下線が出ないこと（サイドバーの既存配色 `SLACK_COLORS.sidebarText` を維持）
5. `pnpm --filter @hatchery/client test` および `pnpm --filter @hatchery/client lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **`ListItemButton component={RouterLink}`**: MUI の `ListItemButton` に TanStack Router の `Link as RouterLink` を `component` prop で渡す。これにより `ListItemButton` が `<a>` タグとして描画され、TanStack Router の型安全なルート解決が使える。`to={`/channels/${channel.id}`}` で href を生成する（MUI と TanStack Router の型推論の制約から full path 形式を採用）。
- `textDecoration: "none"` を sx に追加してデフォルトのリンク下線を抑制する。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **client のみ**
- `client/src/components/ChannelList.tsx`: `ListItemButton` にリンク付与
- `client/src/components/ChannelList.test.tsx`: リンク href 検証テスト、RouterProvider 対応テストヘルパー

## 6. テスト計画（TDDで書くテスト一覧）

### 新規テスト（`describe("ChannelList のナビゲーション (#182)")`）

1. **「各チャンネル項目が対応する /channels/:id へのリンクになっている」**: `createMemoryHistory` で minimal ルータを作成し `RouterProvider` 内に `ChannelList` を描画。`getByRole("link", { name: /雑談/ })` が `href="/channels/zatsudan"` を持つことを確認。

## 7. リスク・未決事項

- MUI の `OverridableComponent` と TanStack Router の型推論の制約: `to` prop に full path 文字列を使い `params` を省略することで TypeScript エラーを回避。ランタイム動作は正しい。
