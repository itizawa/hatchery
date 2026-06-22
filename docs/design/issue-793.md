# 設計書: config: @types/node を実行環境の Node 26 系に合わせて更新する (#793)

## 1. 目的 / 背景

このリポジトリは Node 26 を前提としているが（`.nvmrc`=26 / `engines.node`>=26 / Volta 26.2.0）、
ルート `package.json` の `@types/node` が `^22.10.2` のまま Node 26 と 4 メジャー乖離していた。
型定義を実行環境に揃え、Node 24/26 で追加・変更された標準 API の型チェックを正確にする。

## 2. スコープ（やること / やらないこと）

**やること:**
- ルート `package.json` の `@types/node` を `^26.0.0` に更新
- `pnpm install` で `pnpm-lock.yaml` を更新
- 更新に伴う型エラーがあれば解消
- 既存テストと lint・typecheck が緑であることを確認

**やらないこと:**
- Node ランタイム自体のバージョン変更（既に 26）
- CI Actions の Node バージョン変更（別途管理）
- ワークスペース配下の `@types/node`（server/client/common はルートからホイスティングを受けており個別宣言なし）

## 3. 受け入れ条件（テストに落とせる粒度）

1. ルート `package.json` の `@types/node` が `^26` 系（`^26.0.0`）になっている
2. 更新に伴う型エラーが 0 件（`pnpm typecheck` 緑）
3. 新規追加の `tests/node-types.test.ts` を含むリポジトリ規約テストが緑
4. `pnpm turbo run build test lint` が緑

## 4. 設計方針

- `npm view @types/node dist-tags.latest` で最新 26.x を確認 → `26.0.0`（2026-06-22 時点）
- ルート `package.json` の devDependencies のみ変更（`^26.0.0`）
- `pnpm install` で lock ファイルを更新
- Renovate が major 更新を automerge しない設定のため手動対応が必要（renovate.json の `major` ルール）

## 5. 影響範囲

- ルート `package.json` の devDependencies
- `pnpm-lock.yaml`
- 型エラーが発生した場合は該当ソースファイル

## 6. テスト計画（TDD）

- `tests/node-types.test.ts` を新規作成: `@types/node` のバージョンが `^26` 系であることを検証するテスト
  - ルート `package.json` の `devDependencies["@types/node"]` が `/^\^26/` にマッチすることをアサート
- 既存 `tests/node-engine.test.ts` が引き続き緑であること

## 7. リスク・未決事項

- `@types/node@26.0.0` で追加・変更された型が既存コードと競合する可能性があるが、
  確認の結果型エラーがなければその旨を PR に記載する
- `@types/node@26.0.0` は 2026-06-22 時点で唯一の 26.x リリースであるため `^26.0.0` で固定
