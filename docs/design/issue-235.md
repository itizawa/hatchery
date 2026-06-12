# 設計書: アクセス数計測ツールの技術選定と ADR 作成 (#235)

## 1. 目的 / 背景

プロダクト Hatchery の公開（Cloudflare Pages）に向けて、どれくらいのユーザーが訪問しているかを計測する基盤が存在しない。「モニターが 3 日覗き続けるか」という検証指標（concept.md §9-10）を定量的に確かめるため、PV/UU・再訪・滞在などを計測できるアクセス解析ツールを選定し、ADR として記録する。

## 2. スコープ（やること / やらないこと）

**やること**:
- アクセス解析ツールの比較検討（5 候補以上）
- 採用案と理由・却下案を ADR `docs/adr/0026-analytics-tool-selection.md` に記録
- `docs/adr/README.md` の一覧表に追記
- ADR 内容を検証する `tests/adr-analytics-tool-selection.test.ts` の追加

**やらないこと**:
- ツールの実際の導入・タグ埋め込み・SDK 導入（別 Issue で対応）
- client / server / common のコード変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `docs/adr/0026-*.md` が 1 件だけ存在する
- ADR 本文に MADR 必須セクション（コンテキスト / 決定 / 理由 / 検討した代替案 / 影響）がある
- ステータスが `Accepted`、関連 Issue `#235` が明記されている
- 検討した代替案が 3 つ以上記載されている
- 採用ツール名（Cloudflare Web Analytics）が決定として記載されている
- SPA / GDPR / コスト / 導入容易性 / データ所有の比較軸が含まれている
- `docs/adr/README.md` に `[0026](./0026-*.md)` リンク行が存在する
- `pnpm test:repo` / `pnpm lint` が緑

## 4. 設計方針

### 比較候補

| ツール | SPA対応 | プライバシー/Cookie | コスト | 導入容易性 | データ所有 |
|--------|---------|-------------------|--------|-----------|----------|
| **Cloudflare Web Analytics** | 手動でルート遷移イベント追加 | Cookie なし・GDPR 準拠 | 無料（Pages 内包） | スクリプト 1 行 + 設定 | Cloudflare ダッシュボード |
| Google Analytics 4 | 公式 SPA 対応あり | Cookie 使用・同意バナー必要 | 無料（360 は有料） | gtag.js + SPA 設定 | Google |
| Plausible Analytics | 自動 SPA 対応 | Cookie なし・GDPR 準拠 | $9/月〜（OSS セルフホスト可） | スクリプト 1 行 | クラウド: Plausible / セルフホスト: 自社 |
| Umami | 自動 SPA 対応 | Cookie なし・GDPR 準拠 | 無料枠 10 万 PV/月（OSS） | スクリプト 1 行 | クラウド: Umami / セルフホスト: 自社 |
| PostHog | SDK 自動対応 | Cookie 使用（オプトアウト可） | 100 万イベント/月無料 | SDK 導入必要 | クラウド: PostHog / セルフホスト可 |

### 採用案: Cloudflare Web Analytics

**理由**:
- 完全無料で Cloudflare Pages に統合済み（既存インフラ ADR-0008 との親和性が最高）
- Cookie を使用せず GDPR 準拠（同意バナーの実装が不要）
- Beacon API ベースで、パフォーマンスへの影響が最小
- スクリプト 1 行 + Cloudflare 管理画面で有効化するだけで導入完了
- SPA ルート遷移計測は手動（`window.__cfBeacon`）で実装可能だが、PV 計測は初期フェーズで十分

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `docs/` のみ（コード変更なし）
- 追加ファイル: `docs/adr/0026-analytics-tool-selection.md`
- 変更ファイル: `docs/adr/README.md`
- 追加テスト: `tests/adr-analytics-tool-selection.test.ts`

## 6. テスト計画（TDD で書くテスト一覧）

1. `docs/adr/0026-*.md` が 1 件だけ存在する（ファイル存在確認）
2. ADR が MADR 必須セクション見出しを持つ（ファイル内容確認）
3. ステータス `Accepted`・関連 Issue `#235` の記載確認
4. 検討した代替案が 3 つ以上ある（代替案見出しの数確認）
5. 採用ツール「Cloudflare Web Analytics」が記載されている
6. `docs/adr/README.md` に `[0026]` 行が存在する

## 7. リスク・未決事項

- Issue #235 作成時点では ADR 0015 が次番の想定だったが、その後 0015〜0025 が追加済みのため **0026 を採番**する。
- 実際の計測ツール導入（タグ埋め込み）は別 Issue で対応。
