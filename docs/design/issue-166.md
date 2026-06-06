# 設計書: Storybook 本番 base path を実リポジトリ名 `/hatchery/` に修正する (#166)

## 1. 目的 / 背景

デプロイ済み Storybook（GitHub Pages）の各ストーリーを開くとアセットが 404 になりプレビューが表示されない。

根本原因: リポジトリが `ai-workspace` → `hatchery` にリネームされ、GitHub Pages の配信 URL は `https://itizawa.github.io/hatchery/` になったが、`docs/.storybook/main.cts` の本番ビルド `base` が旧リポジトリ名 `/ai-workspace/` のままハードコードされている。このため本番 Storybook は `/ai-workspace/assets/...` という存在しないサブパスでアセットを参照し全て 404 になる。

## 2. スコープ（やること / やらないこと）

### やること
- `docs/.storybook/main.cts` の本番 `base` デフォルト値を `/ai-workspace/` → `/hatchery/` へ修正する。
- `viteFinal` の `base` 決定ロジックを対象にしたユニットテスト（`docs/` ワークスペース・Vitest）を追加する。

### やらないこと
- `STORYBOOK_BASE_PATH` 上書きの仕組みの撤去（維持する）。
- `base` のワークフロー側からの動的注入（`${{ github.event.repository.name }}` 化。将来の任意改善でありスコープ外）。
- `.github/workflows/deploy-storybook.yml` の変更（受け入れ条件 1 は「デフォルト値修正 or ワークフロー注入のどちらでも可」。今回はデフォルト値修正を採用するためワークフローは触らない）。
- client / server / common への変更。
- `git remote` URL の変更。

## 3. 受け入れ条件（テストに落とせる粒度）

1. PRODUCTION ビルドかつ `STORYBOOK_BASE_PATH` 未設定時、`viteFinal` 適用後の `config.base === "/hatchery/"` となること。
2. PRODUCTION ビルドかつ `STORYBOOK_BASE_PATH` 設定時、`config.base` がその値となること（上書きの仕組みを維持）。
3. 非 PRODUCTION（`configType !== "PRODUCTION"`）では `base` が変更されない（`/` 相当 = `undefined` のまま）こと。
4. 変更は `docs/` ワークスペースに限定し、client / server / common に触れないこと。
5. `pnpm turbo run build` / `test` / `lint` がすべて緑であること。

## 4. 設計方針

- 最小修正: `main.cts` 内 `config.base = process.env.STORYBOOK_BASE_PATH ?? "/ai-workspace/";` のデフォルトリテラルを `"/hatchery/"` に変更する。コメントの趣旨（GitHub Project Pages のサブパス配信、`STORYBOOK_BASE_PATH` による上書き）は保つ。
- テストは `viteFinal` を直接呼び出して検証する。`main.cts` の default export（`StorybookConfig`）から `viteFinal` を取り出し、空の vite config と `{ configType }` を渡し、戻り値の `base` を検証する。
- `STORYBOOK_BASE_PATH` を読むため、テスト内で `process.env.STORYBOOK_BASE_PATH` を一時設定・復元する（`afterEach` で元に戻す）。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **`docs/` のみ**。
- 変更ファイル: `docs/.storybook/main.cts`（1 行）、`docs/src/storybook-base-path.test.ts`（新規テスト）、`docs/design/issue-166.md`（本設計書）。
- 依存方向の一方向境界（client→common / server→common）には影響しない。

## 6. テスト計画（TDD で書くテスト一覧）

`docs/src/storybook-base-path.test.ts`（vitest, `include: ["src/**/*.test.{ts,tsx}"]` に合致させるため `src/` 配下に置く。対象は `../.storybook/main.cts` を import）:

- `viteFinal` が定義されている（スモーク）。
- (a) `configType: "PRODUCTION"` かつ env 未設定 → `base === "/hatchery/"`。
- (b) `configType: "PRODUCTION"` かつ `STORYBOOK_BASE_PATH = "/custom/"` → `base === "/custom/"`。
- (c) `configType: "DEVELOPMENT"` → `base` が未変更（`undefined`）。

まず (a) が現状 `/ai-workspace/` で失敗することを確認 → `main.cts` 修正後に全緑。

## 7. リスク・未決事項

- `main.cts` は `.cts`（CommonJS TS）。vitest（vite 変換）で import 可能か要確認。既存 `storybook-preview.test.ts` が `../.storybook/preview.js` を import できているため import 経路自体は機能する見込み。万一 `.cts` の import に失敗する場合は import 形式を調整する。
- ワークフロー側に `STORYBOOK_BASE_PATH` を渡していないため、デフォルト値修正だけで本番 base が `/hatchery/` になる（整合済み）。将来のリネーム耐性のための動的化は別 Issue 推奨。
