# 設計書: コミュニティ表示から r/ プレフィックスを削除する (#342)

## 1. 目的 / 背景

Reddit 風 UI への pivot 時に `r/{slug}` という Reddit 慣習の表示形式を採用したが、Hatchery
独自のサービスとして `r/` プレフィックスは不要。現在 3 箇所のクライアント表示に残っており、いずれも
`community.name`（表示名）が別途レンダリングされているため冗長。`r/` を削除し表示名を `community.name`
に統一する。

## 2. スコープ（やること / やらないこと）

### やること
- `client/src/routes/CommunityBrowseScene.tsx` のカード見出しから `r/{slug}` を削除し `community.name` に統一（重複する `body1` 行を削除）。
- `client/src/routes/CommunityScene.tsx` の h1 を `r/{communitySlug}` から `community?.name` に変更（重複する `subtitle1` 行を削除）。
- `client/src/components/SidebarCommunitySection.tsx` のリストアイテム表示を `r/${community.slug}` から `community.name` に変更。
- 既存テスト `SidebarCommunitySection.test.tsx` の期待値を `r/slug` → `name` に更新。

### やらないこと
- サーバ・API・OpenAPI スキーマの変更（`client` 内に閉じる）。
- slug の URL パス（`/communities/$slug`）の変更（表示のみ変更し URL は維持）。
- ロジック・データ取得の変更。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `CommunityBrowseScene` のカード見出し（`subtitle1`）が `community.name` を表示し、`r/{slug}` を含まない。重複していた `body1` の `community.name` 行は無くなる。
2. `CommunityScene` の h1 が `community.name` を表示し、`r/{slug}` を含まない。重複していた `subtitle1` の `community.name` 行は無くなる。
3. `SidebarCommunitySection` のリストアイテムが `community.name` を表示し、`r/{slug}` を含まない。
4. `client → common` の一方向 import 境界を維持し、`pnpm turbo run build test lint` が緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

純粋な表示文字列の置換。

- `CommunityBrowseScene`: 見出し `Typography variant="subtitle1"` の中身を `community.name` にし、直後の `body1`（`community.name` 表示）行を削除。
- `CommunityScene`: h1 `Typography variant="h5"` の中身を `community?.name` にする。`community &&` ブロック内の `subtitle1`（`community.name`）行を削除し、description のみ残す。h1 が常に表示される一方 name は community 取得後にしか出ないため、`community?.name`（未取得時は空表示）で対応。
- `SidebarCommunitySection`: `primary={`r/${community.slug}`}` を `primary={community.name}` にする。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / common / server / docs）

- `client` のみ。3 コンポーネント + 1 既存テスト + 新規テスト 2 本。
- common / server / docs への変更なし。

## 6. テスト計画（TDDで書くテスト一覧）

- `CommunityBrowseScene.test.tsx`（新規）: コミュニティ一覧で `community.name` が表示され、`r/{slug}` が表示されないこと。
- `CommunityScene.test.tsx`（新規）: h1 に `community.name` が表示され、`r/{slug}` が表示されないこと。
- `SidebarCommunitySection.test.tsx`（既存更新）: `community.name` が表示され、`r/{slug}` が表示されないこと。

## 7. リスク・未決事項

- `CommunityScene` の h1 は community 未取得時に空表示となるが、既存挙動でも slug は描画されるため軽微。description ブロックは `community &&` を維持する。
- リスクは低い（表示文字列の置換のみ、ロジック変更なし）。
