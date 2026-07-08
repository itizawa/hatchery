# 設計書: モバイル幅でコミュニティ探索一覧の統計行が単語の途中で改行される (#1116)

## 1. 目的 / 背景

本番環境をモバイル幅（390×844）で Playwright 撮影し目視確認したところ、`/communities`（コミュニティ探索一覧）の各カードにある統計行（「N件の投稿」「最終投稿: 〜」「N 購読者」）が単語の途中で改行され、表示崩れを起こしている。

該当コード: `client/src/routes/CommunityBrowseScene.tsx:71-85`。3つの `Typography`（投稿数・最終投稿・購読者数）を `Box`（`display: "flex", gap: 2`）で横並びにしているだけで、狭い画面幅での折り返し制御（`whiteSpace: "nowrap"` や `flexWrap`）が入っていない。

## 2. スコープ（やること / やらないこと）

- やること: `CommunityBrowseScene.tsx` の統計行 3 項目に `whiteSpace: "nowrap"` を指定し、行コンテナに `flexWrap: "wrap"` を設定して項目単位で折り返す。
- やらないこと: デスクトップ幅でのレイアウト変更、統計行以外（description・タイトル等）の折り返し制御、#883（同ファイルの別バグ）の対応。

## 3. 受け入れ条件（テストに落とせる粒度）

1. 統計行の3つの `Typography`（投稿数 / 最終投稿 / 購読者数）が `whiteSpace: "nowrap"` の inline style を持つ。
2. 行コンテナ（`Box`）に `flexWrap: "wrap"` が設定される。
3. デスクトップ幅での既存の見た目（1行表示・gap: 2）は変更後も維持される（`flexWrap: "wrap"` はデスクトップ幅では実質1行のまま表示されるため回帰しない）。
4. `CommunityBrowseScene.test.tsx` に、各統計テキストのノードが `white-space: nowrap` スタイルを持つことを検証するテストを追加する。
5. `pnpm turbo run build test lint` が緑であること。

## 4. 設計方針

MUI の `sx` prop で以下を追加するのみの CSS 修正:

- 投稿数 `Typography`: `sx={{ whiteSpace: "nowrap" }}`
- 最終投稿 `Typography`: 既存の `sx={{ display: "flex", alignItems: "center", gap: 0.5 }}` に `whiteSpace: "nowrap"` を追加
- 購読者数 `Typography`: `sx={{ whiteSpace: "nowrap" }}`
- 行コンテナ `Box`（71行目）: 既存の `sx={{ display: "flex", gap: 2, mt: 0.5, alignItems: "center" }}` に `flexWrap: "wrap"` を追加

ロジック変更なし。純粋な CSS のみの修正のため、既存の API モック・データ構造はそのまま利用する。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `client` のみ。
- 変更ファイル: `client/src/routes/CommunityBrowseScene.tsx`、`client/src/routes/CommunityBrowseScene.test.tsx`。
- server / common への影響なし。

## 6. テスト計画（TDD で書くテスト一覧）

- 新規テスト: 「統計行の各項目が `white-space: nowrap` で折り返し制御される」
  - `renderInBoundary(mockCommunities)` 後、投稿数・最終投稿・購読者数の各テキストノードに対し `toHaveStyle({ whiteSpace: "nowrap" })` を検証する。
- 既存テストは変更しない（表示テキスト自体は変わらないため回帰しないはず）。

## 7. リスク・未決事項

- 特になし。CSS のみの局所修正で、受け入れ条件・実装範囲ともに明確。
