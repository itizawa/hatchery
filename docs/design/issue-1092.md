# 設計書: test: common/src/domain/communityEngagement/communityEngagement.ts のスキーマにパーステストを追加する (#1092)

## 1. 目的 / 背景

`common/src/domain/communityEngagement/communityEngagement.ts` は `CommunityVoteEntrySchema` / `WorkerVoteEntrySchema` / `CommunityEngagementSchema`（GET /api/admin/community-engagement のレスポンススキーマ、#761）を定義しているが、対応する `communityEngagement.test.ts` が存在しない。`common/src/domain` 配下の他スキーマは軒並みパーステストを持っており、この欠落を埋める。

## 2. スコープ（やること / やらないこと）

- やること: `communityEngagement.ts` の3スキーマ（`CommunityVoteEntrySchema` / `WorkerVoteEntrySchema` / `CommunityEngagementSchema`）に対するパーステストの新設。
- やらないこと: `CommunityEngagementSchema` を利用する server 側ルート・ユースケースのテスト拡充（スコープ外、Issue 本文に明記）。スキーマ自体の仕様変更（`.max()` 追加等）は行わない（本 Issue は既存スキーマへのテスト追加のみ）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `common/src/domain/communityEngagement/communityEngagement.test.ts` を新設する。
2. `CommunityVoteEntrySchema` / `WorkerVoteEntrySchema`: 有効なデータのパースに成功する。`count` に負数を与えるとエラーになる。
3. `CommunityEngagementSchema`: 有効なデータのパースに成功する。`loyaltyScore` が範囲外（-0.1 や 1.1）の場合にエラーになる。
4. `pnpm turbo run build|test|lint` が緑であること。

## 4. 設計方針

- 参照実装 `common/src/domain/tokenUsageLog/tokenUsageLog.test.ts` のパターン（`describe`/`it` + 有効値のパース成功 + 境界値・不正値でのエラー）を踏襲する。
- `common` ワークスペース内のみの変更で完結させる（`client` / `server` への影響なし）。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `common` のみ。新規テストファイルの追加のみで既存コードの変更はない。

## 6. テスト計画（TDDで書くテスト一覧）

- `CommunityVoteEntrySchema`: 有効値パース成功 / `count` 負数でエラー
- `WorkerVoteEntrySchema`: 有効値パース成功 / `count` 負数でエラー
- `CommunityEngagementSchema`: 有効値パース成功 / `loyaltyScore` が -0.1 でエラー / `loyaltyScore` が 1.1 でエラー / `loyaltyScore` が境界値 0 と 1 で成功

## 7. リスク・未決事項

特になし。純粋なテスト追加のみで既存の挙動・API に影響しない。
