# 設計書: Renovate の依存アップデート PR を定期的にレビュー&マージしていく運用を定める (#149)

## 1. 目的 / 背景

Issue #148（ADR-0013）で Renovate 導入・7日クールダウン・グルーピング・週次スケジュールが設定済み。
しかし **automerge ポリシー（どの種別をどの条件で自動マージするか）** は未定義のまま残されていた。
本 Issue はその運用を確定し、`renovate.json` と ADR-0013 に反映することで Dark Factory ワークフローと整合した
低負荷の依存更新フローを確立する。

## 2. スコープ（やること / やらないこと）

### やること

- `renovate.json` に automerge ポリシーを追加
  - devDependencies minor/patch: `automerge: true`, `automergeType: "pr"`（CI 緑で自動マージ）
  - dependencies（本番）minor/patch: `automerge: false`（手動レビュー）
  - major（全種別）: `automerge: false`（手動レビュー）
- PR 溜まり防止設定を追加
  - `dependencyDashboard: true`（未処理 PR の一覧 Issue を生成）
  - `prConcurrentLimit: 5`（同時 PR 数の上限）
- ADR-0013 を更新して automerge 方針を記録

### やらないこと

- Renovate App の GitHub インストール（人間が行う作業）
- 既存 packageRules のグルーピングやスケジュール変更（ADR-0013 決定済み）
- 本番 PR への automerge 有効化（リスク上 manual review を維持）
- 金額換算・コスト管理（別 Issue）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `renovate.json` の devDependencies minor/patch ルールに `automerge: true` が設定されている
2. `renovate.json` の devDependencies minor/patch ルールに `automergeType: "pr"` が設定されている（CI チェック必須を保証）
3. `renovate.json` の dependencies（本番）minor/patch ルールに `automerge: false` が設定されている（falsy でも可）
4. `renovate.json` の major ルールに `automerge: false` が設定されている
5. `renovate.json` に `dependencyDashboard: true` が設定されている
6. `renovate.json` に `prConcurrentLimit` が正の数値として設定されている
7. ADR-0013 に automerge ポリシーが記載されている
8. ADR-0013 に `dependencyDashboard` への言及がある

## 4. 設計方針

### automerge の安全性担保

`automergeType: "pr"` を採用する理由：

- Renovate は PR に対して CI ステータスチェックが全て緑になるまでマージを待つ
- `automergeType: "branch"` は PR を作らずブランチ直接マージのため CI が走らないリスクがある
- `"pr"` 方式なら CI ワークフロー（lint/test/build）が必ず実行される

### 対象の線引き

| 種別 | devDeps | 本番 deps |
|------|---------|----------|
| patch | ✅ automerge | ❌ manual |
| minor | ✅ automerge | ❌ manual |
| major | ❌ manual | ❌ manual |

根拠：
- devDeps は本番バンドルに含まれないためリスクが低く、CI 緑で担保できる
- 本番依存の minor でも API 変更を含む可能性があり、人間の確認が望ましい
- major は必ず破壊的変更を伴うため常に手動レビュー

### PR 溜まり防止

- `dependencyDashboard: true`: GitHub Issue として未処理 Renovate PR 一覧が自動管理される
- `prConcurrentLimit: 5`: 同時に 5 件を超える PR を作らず、消化が追いつく速度に抑える

### ADR-0013 の更新方針

既存の「フォローアップが必要なこと」節に automerge 運用決定を追記し、
「決定」節にも automerge ポリシーの概要を追記する。
ステータスは変更せず（Accepted のまま）、補足として追記する形にする。

## 5. 影響範囲

- `renovate.json`（ルート）: automerge 設定・dependencyDashboard・prConcurrentLimit 追加
- `docs/adr/0013-dependency-update-policy.md`: automerge 方針の追記
- `tests/renovate-config.test.ts`: automerge・dependencyDashboard・prConcurrentLimit のテスト追加
- `tests/adr-dependency-update-policy.test.ts`: ADR-0013 automerge 記載のテスト追加

## 6. テスト計画（TDD で書くテスト一覧）

### `tests/renovate-config.test.ts` に追加

- devDependencies minor/patch ルールに `automerge: true`
- devDependencies minor/patch ルールに `automergeType: "pr"`
- dependencies（本番）minor/patch ルールの automerge が falsy
- major ルールに `automerge: false`
- `dependencyDashboard: true`
- `prConcurrentLimit` が正数

### `tests/adr-dependency-update-policy.test.ts` に追加

- ADR-0013 本文に `automerge` への言及がある
- ADR-0013 本文に `dependencyDashboard` への言及がある

## 7. リスク・未決事項

- Renovate App の GitHub インストールが完了していない場合、設定があっても PR は生成されない（人間の作業）
- `prConcurrentLimit: 5` の値は初期値として設定。実際の PR 生成頻度を見て後で調整可能
