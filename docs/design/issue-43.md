# 設計書: 環境変数・設定管理の統一化（Zod スキーマ検証 + .env テンプレート） (#43)

## 1. 目的 / 背景

server・client の環境変数を **Zod スキーマで検証・型安全化**し、`.env` テンプレートと
セットアップ手順を整備して開発・本番環境への対応を明確にする。

着手時点のリポジトリ実態を確認した結果、本 Issue の要求のうち **server 側はすでに実装済み**
であった。

- `server/src/config/env.ts` … Zod で環境変数を検証し、不正値は `loadEnv()` 実行時に `ZodError`
  を投げる。`PORT` / `DATABASE_URL` / レート制限・ボディ上限・タイムアウト・CORS を型付きで export。
  app.ts から利用済み（#34 / #35 で整備）。
- `server/src/config/env.test.ts` … 正常値・不正値の検証テストあり。
- `server/.env.example` … 開発用サンプル値 + 本番向けコメントあり。

一方 **client 側は env 設定が一切存在しない**（`client/src/config/` 自体が無い）。client は現在
API を **同一オリジン相対**（`window.location.origin`、dev は Vite proxy）で呼んでおり
（`client/src/api/client.ts`、ADR-0006 準拠）、ビルド時に検証される公開環境変数を持たない。

そこで本 Issue では **genuine な欠落である client 側の env 設定**と、**横断的なセットアップ手順
ドキュメント**を整備する。既存の同一オリジン設計を壊さずに、将来のクロスオリジン配信（#78:
Cloudflare Pages × Cloud Run）で必要になる API ベース URL のオーバーライドを可能にする。

## 2. スコープ（やること / やらないこと）

### やること

- `client/src/config/env.ts` を新設し、Vite 公開環境変数を Zod で検証する。
  - `VITE_API_BASE_URL`（任意・URL 形式）/ `VITE_LOG_LEVEL`（任意・enum、既定 `info`）。
  - 不正値はビルド時/起動時に `ZodError` を投げる。テスト容易性のため `loadClientEnv(source)` を export。
- `client/src/api/client.ts` を `clientEnv.apiBaseUrl` 優先・未設定時は従来どおり同一オリジンに
  フォールバックするよう接続（**非破壊**）。
- `client/.env.example`（開発用サンプル）を追加。
- `docs/SETUP.md` を新設し、client/server の env 一覧・`.env.local` の作り方・CI/CD での
  シークレット注入方針を記載。README から参照を張る。
- 上記すべてを TDD（client env スキーマのユニットテスト）で実装し、`turbo run lint test build` を緑にする。

### やらないこと（スコープ外・理由付き）

- **server env スキーマの作り直し**（`NODE_ENV` / `SESSION_SECRET` / `LOG_LEVEL` を必須化する等）。
  server env はすでに #34 / #35 でセキュリティ観点の形で実装・テスト済みで、Issue 本文の字義どおりの
  形（`DATABASE_URL` 必須など）へ作り替えると **既存テスト（`loadEnv({})` が throw しない前提）を破壊**し、
  かつ現状それらを消費するコードが無い。よって現行 server env を**正本として維持**する。
- **`.github/workflows/` のデプロイ/シークレット注入ワークフロー雛形**。実デプロイ基盤（Cloud Run /
  Cloudflare Pages）と GitHub Secrets 運用は **#78 が一括で構築**する。ここで雛形を足すと #78 と
  重複・衝突するため、CI/CD での env 注入は **`docs/SETUP.md` に方針として記載するに留める**。
- **`VITE_API_BASE_URL` の必須化**。現行の同一オリジン設計（ADR-0006 / `api/client.ts`）と矛盾し
  既存テストを壊すため、**任意（未設定＝同一オリジン）**とする。#78 でクロスオリジン配信する際に
  値を設定すればベース URL を差し替えられる。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `loadClientEnv(source)` は `VITE_API_BASE_URL` が **有効な URL** のときその値を `apiBaseUrl` に格納する。
2. `VITE_API_BASE_URL` が **未設定**のとき `apiBaseUrl` は `undefined`（＝同一オリジンにフォールバック）。
3. `VITE_API_BASE_URL` が **URL でない文字列**のとき `loadClientEnv` は `ZodError` を投げる（ビルド時に気付ける）。
4. `VITE_LOG_LEVEL` 未設定のとき `logLevel` は既定の `"info"`。
5. `VITE_LOG_LEVEL` に許可値（`debug`/`info`/`warn`/`error`）を渡すとその値を返し、不正値は `ZodError` を投げる。
6. `client/src/api/client.ts` は `clientEnv.apiBaseUrl` があればそれを、無ければ従来どおり
   `window.location.origin`（非ブラウザ時は空文字）を baseUrl に用いる（既存テストが緑のまま）。
7. `client/.env.example` が存在し、`VITE_API_BASE_URL` / `VITE_LOG_LEVEL` のサンプルとコメントを含む。
8. `docs/SETUP.md` が存在し、client/server の env 一覧・`.env.local` 作成手順・CI/CD 注入方針を記載。
9. `turbo run lint test build` が緑。

## 4. 設計方針

- **依存方向**: client → common の一方向のみ（ADR）。env 設定は client 固有のため `client/src/config/`
  に置き、common には依存させない（server の `config/env.ts` と対称）。
- **Zod 検証**: server の `loadEnv` と同じ流儀。`loadClientEnv(source: Record<string, unknown> =
import.meta.env)` とし、モジュール読込時に `export const clientEnv = loadClientEnv()` を評価して
  **不正値はビルド/起動時に即エラー**にする。テストは `source` を明示注入して純粋に検証する。
- **Vite 公開変数**: Vite は `import.meta.env.VITE_*` を自動的にクライアントへ公開する（`define` 追加不要）。
  既定では `import.meta.env` から読む。
- **非破壊接続**: `api/client.ts` の baseUrl を `clientEnv.apiBaseUrl ?? (window?.location.origin ?? "")`
  に変更。未設定時の挙動は現状と完全一致。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- **client**（主）:
  - 追加: `src/config/env.ts` / `src/config/env.test.ts` / `.env.example` /
    `src/vite-env.d.ts`（`import.meta.env` を型付けする Vite 標準の参照）。
  - 変更: `src/api/client.ts`（baseUrl 解決に `clientEnv.apiBaseUrl` を導入。非破壊）/
    `package.json`（`zod ^3.24.1` を依存に追加。直接 import するため）。
- **docs**: 追加 `SETUP.md` / 変更 `README.md`（SETUP.md への参照を追加）。
- **server**: 変更なし（既存 env を正本として維持）。
- **common**: 変更なし。

## 6. テスト計画（TDD で書くテスト一覧）

- `client/src/config/env.test.ts`（Vitest）
  - 有効な `VITE_API_BASE_URL` を読み `apiBaseUrl` に格納する。
  - `VITE_API_BASE_URL` 未設定なら `apiBaseUrl` は `undefined`。
  - URL でない `VITE_API_BASE_URL` は `ZodError` で弾く。
  - `VITE_LOG_LEVEL` 未設定なら既定 `"info"`。
  - 許可された `VITE_LOG_LEVEL` を読み取る／不正値は弾く。
- 既存 `client/src/api/auth.test.ts` 等が緑のまま（同一オリジン挙動の非破壊を担保）。

## 7. リスク・未決事項

- `import.meta.env` を直接の既定ソースにするため、Node 実行（vitest）でも型上は問題ないが、テストは
  常に `source` を明示注入して環境差の影響を受けないようにする。
- 将来 #78 でクロスオリジン配信する際は、Cloudflare Pages のビルド変数に `VITE_API_BASE_URL` を
  設定する（本 Issue の `apiBaseUrl` 解決がそのまま効く）。`docs/SETUP.md` に明記する。
- 本 Issue は起票時点（#6/#7 セットアップ前）の前提が現状と乖離していたため、server 側は実態に
  合わせて「維持」と判断した。判断根拠は本設計書 §1・§2 に明記。
