# 設計書: CI で Vitest カバレッジレポートを生成・PR コメントに投稿する (#71)

## 1. 目的 / 背景

現在の CI（`.github/workflows/ci.yml`）では `pnpm turbo run lint test build` を実行しているが、`--coverage` フラグが付いておらずカバレッジ情報が生成されていない。PR ごとにカバレッジの変化が見えないため、テスト品質の劣化に気づきにくい。

## 2. スコープ（やること / やらないこと）

### やること
- 各ワークスペース（`common` / `server` / `client`）に `@vitest/coverage-v8` を追加し、カバレッジ設定を追加する
- CI ワークフローを更新し、カバレッジレポートを生成・アップロードする
- PR に vitest-coverage-report-action でカバレッジサマリをコメント投稿する
- 各ワークスペースに現実的なカバレッジ閾値を設定する

### やらないこと
- `docs` ワークスペースへのカバレッジ設定追加（ストーリーテストはカバレッジ対象外）
- カバレッジの外部収集基盤（Codecov 等）への送信
- 既存テストの追加・修正

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `common/`, `server/`, `client/` それぞれで `vitest run --coverage` が成功し `coverage/` ディレクトリが生成される
- `coverage/` 配下に `lcov.info` と `coverage-summary.json` が生成される
- 設定した閾値未満の場合 vitest がゼロ以外のコードで終了する（CI が失敗する）
- CI 実行後に `coverage-common`, `coverage-server`, `coverage-client` という名前の artifact がアップロードされる
- PR では vitest-coverage-report-action によりカバレッジサマリのコメントが投稿される
- `.int.test.ts` は `DATABASE_URL` がない CI 環境でスキップされる既存挙動を維持する

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### カバレッジプロバイダー
`@vitest/coverage-v8` を採用（Node.js 組み込みの V8 カバレッジを使用、追加の Babel 変換不要）。

### vitest 設定の配置方針
- `common/`: 新規 `common/vitest.config.ts` を作成（既存設定なし）
- `server/`: 新規 `server/vitest.config.ts` を作成（既存設定なし）
- `client/`: 既存 `client/vite.config.ts` の `test` セクションに `coverage` を追加

### カバレッジ閾値の設定方針
既存テスト状況を踏まえ、**現実的な閾値として 50%** を設定する。
- `common`: 純粋な TypeScript / Zod スキーマ、13 テストファイル・19 ソースファイル → 50%
- `server`: DB 統合テスト（`.int.test.ts`）は CI ではスキップされるため低めに → 50%
- `client`: UI コンポーネント混在 → 50%

閾値は将来、実際のカバレッジ測定後に段階的に引き上げる想定。

### CI ワークフローの変更
`ci.yml` を以下のように変更する：
1. `pnpm turbo run lint build` でビルドと lint を実行（従来通り）
2. 各ワークスペースを個別に `vitest run --coverage` で実行（ワークスペースごとに artifact を作成するため）
3. `actions/upload-artifact@v4` でカバレッジレポートをアップロード
4. `davelosert/vitest-coverage-report-action@v2` で PR コメントを投稿

### `@vitest/coverage-v8` の配置
根 `package.json` の devDependencies に追加（vitest が root にあるため同様に root に配置）。

## 5. 影響範囲 / 既存への変更

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `package.json`（root） | 変更 | `@vitest/coverage-v8` 追加 |
| `common/vitest.config.ts` | 新規 | カバレッジ設定付き vitest 設定 |
| `server/vitest.config.ts` | 新規 | カバレッジ設定付き vitest 設定 |
| `client/vite.config.ts` | 変更 | coverage セクション追加 |
| `.github/workflows/ci.yml` | 変更 | カバレッジ生成・アップロード・PR コメント |
| `pnpm-lock.yaml` | 変更 | lockfile 更新 |

## 6. テスト計画（TDD で書くテスト一覧）

本 Issue はインフラ/設定変更のため、通常の TDD サイクルでのユニットテストは不適切。
代わりに以下の受け入れ条件を直接検証する：

1. **設定ファイル検証**: `common/vitest.config.ts` および `server/vitest.config.ts` の coverage セクションが正しい設定を持つことを確認
2. **CI ワークフロー検証**: `.github/workflows/ci.yml` が artifact アップロードステップを含むことを確認
3. **既存テストの維持**: `pnpm turbo run lint test` が引き続き緑（カバレッジなしの通常テスト）

設定ファイルのスキーマ検証のための `tests/` リポジトリ規約テストを追加する。

## 7. リスク・未決事項

- **閾値**: 実際のカバレッジ値が不明なため 50% に設定。CI 実行後に実値を確認し調整が必要
- **`davelosert/vitest-coverage-report-action`**: PR がない push（develop への直接 push）では PR コメントをスキップする必要がある → `if: github.event_name == 'pull_request'` で条件付けする
- **coverage artifact のパス**: 各ワークスペースの `coverage/` が `{workspace}/coverage/` になる点に注意
