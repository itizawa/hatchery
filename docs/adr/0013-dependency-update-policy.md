# ADR-0013: 依存アップデートポリシー（Renovate + クールダウン）

- ステータス: Accepted
- 日付: 2026-06-05
- 関連 Issue: #148
- 関連 ADR: ADR-0002

## コンテキスト（背景）

依存ライブラリを定期的に最新化しないと既知 CVE にさらされ続けるが、**公開直後のパッケージを即座に取り込むリスクもある**。npm エコシステムでは、メンテナ乗っ取りやパッケージ名スクワッティングによりマルウェアを混入したバージョンが公開・数時間後に取り下げられる事例が複数報告されている。

現状（Issue #148 調査時点）:

- 自動依存アップデートの仕組みが無い（Dependabot も Renovate も未設定）
- CI に依存監査（`pnpm audit` 等）ステップが無い
- lockfile コミット + `--frozen-lockfile` + `engine-strict=true` の良い基盤はある（ADR-0002）

## 決定

**Renovate Bot** による週次自動アップデート + **7 日クールダウン**（`minimumReleaseAge: "7 days"`）を導入する。重大 CVE は例外として即時適用（`vulnerabilityAlerts.minimumReleaseAge: "0 days"`）。CI に `pnpm audit --audit-level=high` を追加する。

具体的な設定:

- `baseBranches: ["develop"]` — 更新 PR のターゲットは `develop` のみ（main 直は出さない）
- `schedule: ["every weekend"]` — 週次で更新 PR を生成
- `minimumReleaseAge: "7 days"` — 公開から 7 日未満のパッケージは対象外
- `packageRules` でグルーピング: major は個別 / devDeps minor-patch は一括 / deps minor-patch は一括
- `vulnerabilityAlerts.minimumReleaseAge: "0 days"` — CVE 対応 PR は即時生成（クールダウン例外）
- CI ジョブに `pnpm audit --audit-level=high` を追加（high/critical のみ fail、low/moderate は通過）

**automerge の設定は対象外**（別 Issue #149: どの種別をどの条件で automerge するかは運用 Issue で定める）。

**Renovate App の GitHub インストールが別途必要**。設定ファイルを置くだけでは Renovate は動かない。リポジトリオーナーが [Renovate App](https://github.com/apps/renovate) を GitHub からインストールする必要がある。

## 理由

### Renovate を選んだ理由（Dependabot ではなく）

- **`minimumReleaseAge`** による公開後クールダウンが Renovate のネイティブ機能として存在する。Dependabot にはこの機能が無い。
- **グルーピングの柔軟さ**: minor/patch を種別ごとにまとめられる。レビュー負荷を減らせる。
- **automerge の細かな制御**: devDeps のみ automerge、prod は手動レビュー、といった設定が容易。

### クールダウン 7 日の根拠

- npm エコシステムで悪性版がコミュニティ・自動スキャナに検知されるまでの実績が概ね 24〜72 時間。7 日は余裕を持った安全バッファ。
- Renovate の公式ドキュメントも "stabilityDays" として 3〜7 日を推奨例として挙げる。
- 1 週間超えると最新化の恩恵（バグ修正・パフォーマンス改善）を享受できない期間が長くなる。7 日がバランス点。

### CVE は即時例外

- クールダウンは「未知のマルウェア混入リリース」対策。既知 CVE への修正は逆に即時に取り込むべき。
- `vulnerabilityAlerts.minimumReleaseAge: "0 days"` で Renovate が CVE 修正 PR を即日生成するようにする。

### `pnpm audit --audit-level=high`

- low/moderate は誤検知や開発環境限定の依存が多く、fail にすると開発が頻繁にブロックされる。
- high/critical は実際に悪用可能な脆弱性であることが多く、fail にして即対応を促すべき。

## 検討した代替案

- **Dependabot**: GitHub ネイティブで導入容易。ただし `minimumReleaseAge`（クールダウン）機能が無く、グルーピングの柔軟性も低い。本件の核心要件を満たせないため不採用。
- **クールダウン無しの即時自動アップデート**: 速さ重視だがサプライチェーンリスクを受け入れることになる。本プロジェクトは小規模でも依存数が多く、リスク対策優先。
- **pnpm 10 系の `minimumReleaseAge`（インストール時クールダウン）**: pnpm 10.16+ の機能で強力だが、pnpm のメジャーアップグレードが必要（別 Issue #150）。本 Issue では Renovate 設定側のクールダウンで代替し、pnpm アップグレードは独立して行う。
- **`pnpm audit --audit-level=critical`（critical のみ fail）**: 安全側だが high な脆弱性がスルーされる懸念。`high` を最低ラインとして採用。
- **`pnpm audit --audit-level=moderate`**: 誤検知増でビルドが頻繁に red になりノイズになる。不採用。

## 影響（結果）

**良い影響:**
- 依存更新が定期・自動化され、手動忘れによる放置が無くなる
- クールダウンにより悪性リリースを掴むリスクが低減する
- CI での `pnpm audit` により既知 CVE を早期検知できる
- 更新 PR がすべて `develop` に向くのでブランチ戦略と整合する

**トレードオフ / 注意点:**
- Renovate App の GitHub インストールが別途必要（リポジトリオーナーが行う）
- `pnpm audit` が既存依存の high 脆弱性を検出した場合は CI が red になる（その場合は `pnpm audit fix` または例外設定で対応）
- クールダウン中は最新版の機能・バグ修正の採用が 7 日遅れる（許容範囲と判断）

**フォローアップが必要なこと:**
- Renovate App の GitHub インストール（人間が行う）
- automerge の運用方針決定（Issue #149）
- pnpm 10 系アップグレード後に pnpm ネイティブの `minimumReleaseAge` も有効化を検討（Issue #150）
- 多層防御の追加候補（GitHub Dependency review / OpenSSF Scorecard / `onlyBuiltDependencies` によるポストインストールスクリプト制限）の継続検討
