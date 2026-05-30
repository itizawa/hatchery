# 設計書: monorepo 基盤とツールチェーンのセットアップ (#4)

- 関連 Issue: #4
- 関連 ADR: ADR-0001（monorepo 構成）, ADR-0002（pnpm + Turborepo）
- ステータス: 設計レビュー待ち

## 1. 目的 / 背景

ADR-0001・ADR-0002 で決定したリポジトリ基盤とツールチェーンを実装する。現状リポジトリにはアプリのコードがなく、`package.json` / `pnpm-workspace.yaml` / 各ワークスペースが未作成。本 Issue が以降すべての実装（common #5 / server #6 / client #7 / 型共有 #8 / docs #9）の前提になる。

ここで確立するのは「**4 ワークスペースの骨組み + 横断タスク基盤 + 依存方向の機械的強制**」であり、各ワークスペースの中身（ドメイン・API・画面）は本 Issue では扱わない。ADR の決定が正本であり、それに反する構成にしない。

## 2. スコープ（やること / やらないこと）

### やること

- ルートの `package.json` / `pnpm-workspace.yaml` 作成と 4 ワークスペース定義（`docs` / `client` / `server` / `common`）
- 各ワークスペースの最小 `package.json`（`@hatchery/*`）と空の雛形配置
- `turbo.json` による横断タスク（`build` / `test` / `lint` / `dev`）の依存・キャッシュ定義
- `.nvmrc`（Node 22）とルート `package.json` の `engines` 指定
- `tsconfig.base.json`（strict）+ 各ワークスペースの `tsconfig.json`（extends + project references）
- ESLint flat config + Prettier、**依存方向（client→common / server→common、client↔server 禁止）の import 制約**
- Vitest 全ワークスペース共通導入（各ワークスペースで空テストが緑）
- 生成物（`*.gen.ts` / `generated/` / `openapi.json` 由来）の `.gitignore` 追加

### やらないこと

- common / server / client / docs の中身の実装（#5〜#9）
- CI/CD パイプライン本体（GitHub Actions）・本番デプロイ
- 実 DB 接続・Prisma スキーマ（#6）、OpenAPI 生成（#8）、Storybook 本体（#9）
- MVP 機能（社員・シーン生成など）の実装

## 3. 受け入れ条件（テストに落とせる粒度）

1. ルートに `pnpm-workspace.yaml` が存在し、`docs` / `client` / `server` / `common` の 4 パッケージを認識する（`pnpm -r list` に 4 ワークスペースが出る）。
2. 各ワークスペースの `package.json` の `name` が `@hatchery/{docs,client,server,common}` である。
3. `pnpm install` がルートで成功する（lockfile 生成）。
4. `turbo run build` が全ワークスペースで成功し、common が client/server より先にビルドされる（依存順）。
5. `turbo run test` で各ワークスペースの Vitest が起動し、置いた最小テストが緑になる。
6. `turbo run lint` が成功する。
7. ESLint が依存方向違反を検出する: server から client を import するコード（または client から server）を置くと lint がエラーになる。逆に common への import は許可される。
8. ルート `package.json` の `engines.node` が `>=22` 系、`.nvmrc` が `22` 系。
9. `tsconfig.base.json` が `strict: true` を持ち、各ワークスペースの `tsconfig.json` がそれを extends し、project references で相互参照が解決する（`tsc -b` が通る）。
10. `.gitignore` に `*.gen.ts` / `generated/` / `openapi.json`（生成物）が含まれる。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 4.1 ディレクトリ構成（本 Issue で作る範囲）

```
.
├── package.json                 # ルート（private, packageManager=pnpm, engines.node>=22, devDeps: turbo/eslint/prettier/typescript/vitest）
├── pnpm-workspace.yaml          # packages: docs/client/server/common
├── turbo.json                   # build/test/lint/dev タスクと依存・キャッシュ
├── tsconfig.base.json           # strict 共有ベース
├── tsconfig.json                # project references の集約（solution tsconfig）
├── .nvmrc                       # 22
├── eslint.config.mjs            # flat config + 依存方向 import 制約
├── .prettierrc.json
├── .gitignore                   # 生成物を追加
├── common/
│   ├── package.json             # @hatchery/common
│   ├── tsconfig.json            # extends base, composite
│   ├── src/index.ts             # 空 export（雛形）
│   └── src/index.test.ts        # 最小テスト（緑）
├── server/
│   ├── package.json             # @hatchery/server （deps: @hatchery/common）
│   ├── tsconfig.json            # references: common
│   ├── src/index.ts
│   └── src/index.test.ts
├── client/
│   ├── package.json             # @hatchery/client （deps: @hatchery/common）
│   ├── tsconfig.json            # references: common
│   ├── src/index.ts
│   └── src/index.test.ts
└── docs/
    ├── package.json             # @hatchery/docs
    ├── tsconfig.json
    └── src/index.ts
```

各ワークスペースの中身はあくまで「タスクが緑になる最小雛形」。実体は後続 Issue で差し替える。

### 4.2 pnpm workspaces

- ルート `package.json` は `private: true`、`packageManager` に pnpm のバージョンを固定。
- `pnpm-workspace.yaml` に 4 パッケージのパスを列挙（glob ではなく明示列挙で構成を固定）。
- ワークスペース間依存は `workspace:*` プロトコルで宣言（client/server → common）。

### 4.3 Turborepo

`turbo.json`（概念）:

```jsonc
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test":  { "dependsOn": ["^build"] },
    "lint":  {},
    "dev":   { "cache": false, "persistent": true }
  }
}
```

- `^build` により依存パッケージ（common）が先にビルドされ、ADR-0001 の依存方向と一致。
- 型共有の生成順（`server:openapi → client:gen-types → client:build`、ADR-0006）は #8 で `turbo.json` に追記する前提。本 Issue ではフックとなる素の build 依存のみ定義。

### 4.4 TypeScript

- `tsconfig.base.json`: `strict: true`, `composite: true`, `declaration: true`, モジュール解決は `bundler`/`nodenext` を ADR と各ワークスペース要件に合わせて選定（client は Vite 前提、server は Node 前提のため、ベースは共通設定、各 tsconfig で上書き）。
- ルート solution `tsconfig.json` は `references` で 4 ワークスペースを束ね、`tsc -b` でインクリメンタルビルド。
- 各ワークスペース `tsconfig.json` は base を extends し、依存先（common）を `references` に持つ。

### 4.5 ESLint（依存方向の機械的強制）— 本 Issue の肝

ADR-0001 の「client → common / server → common の一方向のみ、client↔server 禁止、common はアプリ固有に依存しない」を lint で強制する。

- ESLint flat config（`eslint.config.mjs`）をルートに置く。
- `no-restricted-imports`（または `eslint-plugin-import` の `import/no-restricted-paths`）で:
  - `client/**` から `@hatchery/server`・`server/**` への import を禁止
  - `server/**` から `@hatchery/client`・`client/**` への import を禁止
  - `common/**` から `@hatchery/{client,server,docs}` への import を禁止
- `import/no-restricted-paths` の zone 定義でワークスペース境界を表現するのが第一候補（パスベースで確実）。

### 4.6 Vitest / ESLint / Prettier

- Vitest はルート devDependency。各ワークスペースに最小 `*.test.ts` を置き、`turbo run test` が全ワークスペースで緑になることを確認。client の RTL は #7 で追加（本 Issue では React 非依存の素の Vitest）。
- Prettier はルート設定 1 つを全体共有。ESLint と競合しない構成（フォーマットは Prettier、lint ルールは ESLint）。

## 5. 影響範囲 / 既存への変更

- **新規追加のみ**。既存の `concept.md` / `docs/adr/*` / `docs/dark-factory-workflow.md` / `CLAUDE.md` は変更しない。
- リポジトリ直下に多数の設定ファイルが増える（上記 4.1）。
- 後続 Issue（#5〜#9）はすべてこの骨組みの上に乗る。`turbo.json` は #8（型共有の生成順）で追記される前提。
- `.gitignore` 既存内容に生成物パターンを追記。

## 6. テスト計画（TDD で書くテスト一覧）

本 Issue は設定・スキャフォルディング中心のため、「コマンドが成立すること」を検証スクリプト／最小ユニットテストで担保する。実装フェーズで以下を先に用意し失敗を確認 → 通す。

1. **ワークスペース認識テスト**: `pnpm -r list --json` をパースし、`@hatchery/{common,server,client,docs}` の 4 つが存在することを assert（スクリプト or vitest）。
2. **依存方向 lint テスト（肝）**: 一時的に「server から client を import する」フィクスチャに対し ESLint を実行し、エラーが出ることを確認する自動テスト。逆に common への import はエラーが出ないことも確認。
3. **common 最小ユニットテスト**: `common/src/index.test.ts` で雛形関数（例: `add` などのダミー純粋関数、または `export {}` のみなら存在確認）が緑。
4. **server / client / docs 最小テスト**: 各ワークスペースの `*.test.ts` が緑。
5. **型チェック**: `tsc -b` がエラーなく完了する（CI 的に `turbo run build` 経由でも可）。
6. **タスク依存順**: `turbo run build` のログで common が client/server に先行することを確認（手動 or dry-run 出力検証）。

> 受け入れ条件の各項目（§3）と上記テストを対応させ、実装 PR では `turbo run lint test build` が緑であることをサマリに記載する。

## 7. リスク・未決事項

- **モジュール解決方式の統一**: client（Vite/bundler）と server（Node/nodenext）で最適な `moduleResolution` が異なる。ベースは共通にし各ワークスペースで上書きする方針だが、project references との相性は実装時に検証する。
- **依存方向強制の手段**: `import/no-restricted-paths`（パスベース）と `no-restricted-imports`（パッケージ名ベース）のどちらを主にするか。両方を併用してパッケージ名・相対パス双方の抜け道を塞ぐ案を推奨。実装時に確定。
- **pnpm / Turborepo / 各ツールのバージョン**: 本設計ではバージョンを固定せず「Node 22 LTS 対応の安定最新」を前提とする。具体ピンは実装 PR で `packageManager` / lockfile により確定。
- **client の Vitest + RTL**: 本 Issue では React 非依存の Vitest のみ。RTL・jsdom 環境は #7（client）で追加するため、ここでは導入しない。
- **CI 連携**: `df-develop.yml` 等の Actions は ADR/ワークフロー上「方式A採用時のみ」。本 Issue ではローカルで `turbo run` が緑になることを基準とし、CI は別途。
