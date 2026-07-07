# 設計書: docs: SECURITY.md を作成する (#1082)

## 1. 目的 / 背景

このリポジトリはユーザー認証・ユーザーデータ・DB（PostgreSQL）を扱い、Cloud Run（server）/ Cloudflare Pages（client）へ本番デプロイされる公開 GitHub リポジトリだが、脆弱性を発見した第三者が Public Issue 以外の経路で報告する手段（`SECURITY.md`）が存在しない。GitHub は公開リポジトリのルートに `SECURITY.md` を置くと、Security タブに報告手順として表示する仕組みを標準でサポートしている。脆弱性を発見した人が Public Issue に晒すことなく報告できる経路と、報告に対する対応方針を明文化した `SECURITY.md` をリポジトリルートに追加する。

## 2. スコープ（やること / やらないこと）

- やること:
  - リポジトリルートに `SECURITY.md` を新規作成する。
  - `README.md` の「ドキュメント」一覧に `SECURITY.md` へのリンクを追加する。
  - `SECURITY.md` の存在・必須内容（対象範囲・報告方法・Public Issue 禁止の明記・対応方針）とREADMEからのリンクをリポジトリ規約テストで固定する（`tests/`）。
- やらないこと:
  - 実際の脆弱性対応フロー（トリアージ体制・修正 SLA の厳密化）の整備（別 Issue）。
  - 連絡先メールアドレスの記載（確定情報が無いため、GitHub Private vulnerability reporting のみを正式な報告経路として案内する）。
  - `client` / `server` / `common` のコード変更（ドキュメント追加のみ）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. リポジトリルートに `SECURITY.md` が存在する。
2. `SECURITY.md` に対象範囲（`main` ブランチ＝本番相当のみ対象）が明記されている。
3. `SECURITY.md` に脆弱性の報告方法（GitHub Private vulnerability reporting: Security タブ → "Report a vulnerability"）が明記されている。
4. `SECURITY.md` に Public Issue での脆弱性報告を行わないよう明記されている。
5. `SECURITY.md` に報告後の対応方針（受領確認の目安・修正までの流れ）が簡潔に記載されている。
6. `README.md` の「ドキュメント」一覧に `SECURITY.md` へのリンクが追加されている。
7. `client` / `server` / `common` のコード変更は伴わない（ドキュメント追加のみ）。

## 4. 設計方針

- 雛形は GitHub のデフォルトテンプレート（Supported Versions / Reporting a Vulnerability の 2 見出し構成）を土台にしつつ、このリポジトリの実態（単一の `main` ブランチが本番相当・バージョンテーブル管理はしていない）に合わせて簡略化する。
- 連絡先メールアドレスは確認が取れないため記載せず、GitHub Private vulnerability reporting のみを正式な報告経路として案内する（Issue 補足の指示どおり）。
- 受け入れ条件はテキストベース（Markdown の見出し・文言の存在）でテスト可能なため、`tests/` に repo 規約テストとして追加する（既存の `tests/adr-readme-status-legend.test.ts` 等と同じ「ファイル内容を読み込んで正規表現/文字列一致でアサートする」パターンを踏襲）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: docs）

- 新規: `SECURITY.md`（リポジトリルート）
- 変更: `README.md`（「ドキュメント」一覧に 1 行追加）
- 新規: `tests/security-md.test.ts`（repo 規約テスト）

`client` / `server` / `common` への変更はないため `pnpm turbo run build|test|lint` の対象範囲に実質影響しない。

## 6. テスト計画（TDDで書くテスト一覧）

`tests/security-md.test.ts`:

- `SECURITY.md` がリポジトリルートに存在する。
- 対象範囲として `main` ブランチが明記されている。
- GitHub Private vulnerability reporting（Security タブ → "Report a vulnerability"）への言及がある。
- Public Issue での報告を行わないよう明記されている。
- 対応方針（受領確認・修正までの流れ）の記載がある。
- `README.md` の「ドキュメント」一覧に `SECURITY.md` へのリンクがある。

## 7. リスク・未決事項

- なし。ユーザー可視の振る舞い変更ではないため `e2e/` の更新は不要。
