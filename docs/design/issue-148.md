# 設計書: chore(security): Renovate 導入 + サプライチェーン対策 (#148)

## 1. 目的 / 背景

依存ライブラリを定期的に最新化しながら、**公開直後の悪性リリース（マルウェア混入・メンテナ乗っ取り）を掴まないようにする**。リリースから約1週間寝かせることでコミュニティ・スキャナが悪性版を検知・取り下げる時間を稼ぐ。

現状は自動アップデート仕組み・CI の依存監査ステップともに未整備であり、更新は手動頼り。

## 2. スコープ（やること / やらないこと）

**やること:**
- `renovate.json` をリポジトリルートに追加（Renovate Bot による週次 PR 自動生成）
- `minimumReleaseAge: "7 days"` でクールダウンを設定
- 重大セキュリティ修正の例外ポリシーを `vulnerabilityAlerts` で設定（`minimumReleaseAge: "0 days"` で即時適用）
- PR ターゲットを `develop` のみ（`main` 直は除外）
- グルーピング設定（devDeps / deps / major を分ける）
- CI ワークフロー（`ci.yml`）に `pnpm audit --audit-level=high` ステップを追加
- ADR-0013 として依存アップデートポリシーを記録
- `docs/adr/README.md` に 0013 を追記

**やらないこと:**
- automerge の設定（別 Issue #149 のスコープ）
- pnpm 10 系へのアップグレード（別 Issue #150）
- GitHub Dependency review / OpenSSF Scorecard の有効化（検討事項として ADR に記載するのみ）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `renovate.json` がリポジトリルートに存在し、有効な JSON である
2. `baseBranches` が `develop` を含み `main` を含まない
3. `minimumReleaseAge` が `"7 days"` に設定されている
4. `schedule` が定義されている（週次以上の頻度）
5. `vulnerabilityAlerts.minimumReleaseAge` が `"0 days"`（セキュリティ修正は即時）
6. CI ワークフローに `pnpm audit --audit-level` を含むステップが存在する
7. `docs/adr/0013-*.md` が存在し、MADR 必須セクション + Renovate・minimumReleaseAge・develop・ADR-0002 への言及を含む
8. `docs/adr/README.md` に 0013 のリンク行が追記されている

## 4. 設計方針

### Renovate 設定
- `config:recommended` をベースに最小差分で設定を追加
- `baseBranches: ["develop"]`: ブランチ戦略（develop → main は人間のみ）に整合
- `schedule: ["every weekend"]`: 週次で更新 PR を生成
- `minimumReleaseAge: "7 days"`: Renovate ネイティブ機能で全パッケージにクールダウンを適用
- `vulnerabilityAlerts.minimumReleaseAge: "0 days"`: CVE 対応は即時。クールダウンより安全性を優先
- packageRules でグルーピング: major は個別、minor/patch は deps 種別ごとにまとめる

### CI pnpm audit
- 既存の `build-test-lint` ジョブに `pnpm audit --audit-level=high` ステップを追加
- `--audit-level=high`: critical/high のみ fail にし、low/moderate は warn 扱い（誤検知で開発を止めない）
- `--ignore-scripts` は不要（install 時に制限はしない方針）
- 失敗時は開発者が対応するまでブロック

### ADR-0013
- ADR-0002（pnpm + Turborepo）との関連を明記
- クールダウン 7 日の根拠（npm エコシステムの取り下げ実績）を記載
- Dependabot を採用しなかった理由（minimumReleaseAge / グルーピング柔軟性）を記載

## 5. 影響範囲

- `renovate.json` (新規)
- `.github/workflows/ci.yml` (pnpm audit ステップ追加)
- `docs/adr/0013-dependency-update-policy.md` (新規)
- `docs/adr/README.md` (0013 行追記)
- `tests/renovate-config.test.ts` (新規)
- `tests/adr-dependency-update-policy.test.ts` (新規)
- `tests/dependency-audit-workflow.test.ts` (新規)

## 6. テスト計画

- `tests/renovate-config.test.ts`: renovate.json の存在・JSON 妥当性・baseBranches・minimumReleaseAge・schedule・vulnerabilityAlerts
- `tests/adr-dependency-update-policy.test.ts`: ADR-0013 の MADR 体裁・Renovate/minimumReleaseAge/develop/ADR-0002 言及・README 追記
- `tests/dependency-audit-workflow.test.ts`: ci.yml に pnpm audit --audit-level ステップが存在する

## 7. リスク・未決事項

- Renovate App の GitHub インストールは人間が別途行う必要がある（設定ファイルを置くだけでは動かない。ADR と README に明記）
- `pnpm audit --audit-level=high` が既存の依存で fail する可能性: 事前に確認し、必要なら `--ignore` を追加するか `continue-on-error: true` で warn 扱いにする（今回は高水準（high）のみ fail にすることで誤検知を最小化）
