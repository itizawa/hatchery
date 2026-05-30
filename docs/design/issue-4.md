# 設計書: monorepo 基盤とツールチェーンのセットアップ (#4)

- 関連 Issue: #4
- 関連 ADR: ADR-0001（monorepo 構成）, ADR-0002（pnpm + Turborepo / Node 26）
- ステータス: 設計レビュー待ち

## 1. 目的 / 背景

ADR-0001・ADR-0002 で決定したリポジトリ基盤とツールチェーンを実装する。現状リポジトリにはアプリのコードがなく、`package.json` / `pnpm-workspace.yaml` / 各ワークスペースが未作成。本 Issue が以降すべての実装（common #5 / server #6 / client #7 / 型共有 #8 / docs #9）の前提になる。

ここで確立するのは「**4 ワークスペースの骨組み + 横断タスク基盤 + 依存方向の機械的強制**」であり、各ワークスペースの中身（ドメイン・API・画面）は本 Issue では扱わない。ADR の決定が正本であり、それに反する構成にしない。

## 2. スコープ（やること / やらないこと）

### やること

- ルートの `package.json` / `pnpm-workspace.yaml` 作成と 4 ワークスペース定義（`docs` / `client` / `server` / `common`）
- 各ワークスペースの最小 `package.json`（`@hatchery/*`）と空の雛形配置
- `turbo.json` による横断タスク（`build` / `test` / `lint` / `dev`）の依存・キャッシュ定義
- `.nvmrc`（Node 26）とルート `package.json` の `engines.node` 指定 + `.npmrc`（`engine-strict=true`）で Node 版を実効化
- `tsconfig.base.json`（strict）+ 各ワークスペースの `tsconfig.json`（extends + project references）
- ESLint flat config + Prettier、**依存方向（client→common / server→common、docs→client、client↔server / common→アプリ固有 / docs→server を禁止）の import 制約**
- Vitest 全ワークスペース共通導入（各ワークスペースで空テストが緑）
- 生成物（`*.gen.ts` / `generated/` / `openapi.json` 由来）+ 標準成果物（`node_modules` / `.turbo` / `dist` / `coverage`）の `.gitignore` 追加

### やらないこと

- common / server / client / docs の中身の実装（#5〜#9）
- CI/CD パイプライン本体（GitHub Actions）・本番デプロイ
- 実 DB 接続・Prisma スキーマ（#6）、OpenAPI 生成（#8）、Storybook 本体（#9）
- MVP 機能（社員・シーン生成など）の実装

## 3. 受け入れ条件（テストに落とせる粒度）

1. ルートに `pnpm-workspace.yaml` が存在し、`docs` / `client` / `server` / `common` の 4 パッケージを認識する（`pnpm -r list` に 4 ワークスペースが出る）。
2. 各ワークスペースの `package.json` の `name` が `@hatchery/{docs,client,server,common}` である。
3. `pnpm install` がルートで成功する（lockfile 生成）。
4. `turbo run build` が全ワークスペースで成功し、common が client/server より先にビルドされる（`turbo run build --dry=json` のタスクグラフで common→client/server の依存順を assert）。
5. `turbo run test` で各ワークスペースの Vitest が起動し、置いた最小テストが緑になる。
6. `turbo run lint` が成功する。
7. ESLint が依存方向違反を検出する（**禁止方向すべて**）:
   - `server → client` / `client → server` を import すると lint エラー
   - `common → @hatchery/{client,server,docs}` を import すると lint エラー
   - `docs → server` を import すると lint エラー
   - 逆に許可方向（`client→common` / `server→common` / `docs→client` / `docs→common`）は lint が通る。
8. ルート `package.json` の `engines.node` が `>=26` 系、`.nvmrc` が `26` 系、`.npmrc` に `engine-strict=true` があり、Node 版不一致で `pnpm install` が失敗する（宣言だけでなく実効的に強制される）。
9. `tsconfig.base.json` が `strict: true` を持ち、各ワークスペースの `tsconfig.json` がそれを extends し、project references で相互参照が解決する（`tsc -b` が通る）。
10. `.gitignore` に `*.gen.ts` / `generated/` / `openapi.json`（生成物）に加え `node_modules` / `.turbo` / `dist` / `coverage` が含まれる。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 4.1 ディレクトリ構成（本 Issue で作る範囲）

```
.
├── package.json                 # ルート（private, packageManager=pnpm, engines.node>=26, devDeps: turbo/eslint/prettier/typescript/vitest）
├── pnpm-workspace.yaml          # packages: docs/client/server/common
├── turbo.json                   # build/test/lint/dev タスクと依存・キャッシュ
├── tsconfig.base.json           # strict 共有ベース
├── tsconfig.json                # project references の集約（solution tsconfig）
├── .nvmrc                       # 26
├── .npmrc                       # engine-strict=true（Node 版を実効化）
├── eslint.config.mjs            # flat config + 依存方向 import 制約
├── .prettierrc.json
├── .gitignore                   # 生成物 + node_modules/.turbo/dist/coverage を追加
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
    ├── package.json             # @hatchery/docs （deps: @hatchery/client）
    ├── tsconfig.json            # references: client, common
    ├── src/index.ts
    └── src/index.test.ts        # 最小テスト（緑）
```

各ワークスペースの中身はあくまで「タスクが緑になる最小雛形」。実体は後続 Issue で差し替える。

### 4.2 pnpm workspaces

- ルート `package.json` は `private: true`、`packageManager` に pnpm のバージョンを固定。`engines.node` は `>=26`。
- `.npmrc` に `engine-strict=true` を置き、`engines.node` を**実効化**する（pnpm は宣言だけだと警告止まりで誤った Node でも install が通るため、ここで強制する）。
- `pnpm-workspace.yaml` に 4 パッケージのパスを列挙（glob ではなく明示列挙で構成を固定）。
- ワークスペース間依存は `workspace:*` プロトコルで宣言（client/server → common、docs → client/common）。

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

- `tsconfig.base.json`: `strict: true`, `composite: true`, `declaration: true`。`module`/`moduleResolution` のベースは **`nodenext`** とする。
- **共有される common の解決方式を本設計で確定する**（実装時送りにしない）。common は client・server **双方から参照される**ため、common が出力する `.d.ts` が両コンシューマから解決可能でなければならない。common は `module: nodenext` / `moduleResolution: nodenext` で `.d.ts` を出力し、相対 import は拡張子付き（`.js`）で書く。これは Node（server）と Vite（client, bundler 解決）の両方から無問題に解決できる最も安全な共通項。
- client は Vite 前提のため `moduleResolution: bundler` を各 tsconfig で上書きしてよいが、それは client 自身のソース解決に対してのみ。**参照先 common の `.d.ts` は nodenext 互換で出力済み**なので references は崩れない。
- ルート solution `tsconfig.json` は `references` で 4 ワークスペースを束ね、`tsc -b` でインクリメンタルビルド。
- 各ワークスペース `tsconfig.json` は base を extends し、依存先（client/server→common、docs→client/common）を `references` に持つ。

### 4.5 ESLint（依存方向の機械的強制）— 本 Issue の肝

ADR-0001 の「client → common / server → common の一方向のみ、client↔server 禁止、common はアプリ固有に依存しない」＋ ADR-0007 の docs（client の stories を集約）を lint で強制する。

- ESLint flat config（`eslint.config.mjs`）をルートに置く。
- **主軸は `eslint-plugin-import` の `import/no-restricted-paths` の zone 定義**（パスベースで相対 import まで確実に塞げる）に確定する。`no-restricted-imports`（パッケージ名 `@hatchery/*` ベース）は補助として併用し、パッケージ名経由の抜け道も塞ぐ。
- 禁止する方向（zone）:
  - `client/**` → `server/**`・`@hatchery/server` を禁止
  - `server/**` → `client/**`・`@hatchery/client` を禁止
  - `common/**` → `@hatchery/{client,server,docs}`・各 `**` を禁止（common はアプリ固有に依存しない）
  - `docs/**` → `server/**`・`@hatchery/server` を禁止（docs は client/common のみ参照可）
- 許可する方向（明示）: `client→common` / `server→common` / `docs→client` / `docs→common`。

### 4.6 Vitest / ESLint / Prettier

- Vitest はルート devDependency。各ワークスペースに最小 `*.test.ts` を置き、`turbo run test` が全ワークスペースで緑になることを確認。client の RTL は #7 で追加（本 Issue では React 非依存の素の Vitest）。
- Prettier はルート設定 1 つを全体共有。ESLint と競合しない構成（フォーマットは Prettier、lint ルールは ESLint）。

## 5. 影響範囲 / 既存への変更

- **ほぼ新規追加**。既存の `concept.md` / `docs/dark-factory-workflow.md` / `CLAUDE.md` は変更しない。
- **例外**: Node 版を 22→26 に変更したことに伴い `docs/adr/0002-package-manager-and-build-tooling.md` を改訂する（決定・理由の Node 記述を更新）。ADR が正本のため、設計より先に ADR を直す。
- リポジトリ直下に多数の設定ファイルが増える（上記 4.1）。
- 後続 Issue（#5〜#9）はすべてこの骨組みの上に乗る。`turbo.json` は #8（型共有の生成順）で追記される前提。
- `.gitignore` 既存内容に生成物パターン + 標準成果物（`node_modules` / `.turbo` / `dist` / `coverage`）を追記。

## 6. テスト計画（TDD で書くテスト一覧）

本 Issue は設定・スキャフォルディング中心のため、「コマンドが成立すること」を検証スクリプト／最小ユニットテストで担保する。実装フェーズで以下を先に用意し失敗を確認 → 通す。

1. **ワークスペース認識テスト**: `pnpm -r list --json` をパースし、`@hatchery/{common,server,client,docs}` の 4 つが存在することを assert（スクリプト or vitest）。
2. **依存方向 lint テスト（肝） — 正/負マトリクス**: ESLint Node API（`new ESLint()`）を使い、**フィクスチャ文字列をメモリ/一時ファイルに対してプログラム実行**して検証する。これにより違反フィクスチャがリポ本体の `turbo run lint` を赤にしない（フィクスチャは本体 lint 対象に含めず、テスト内でのみ評価）。検証ケース:
   - 負（エラーが出ること）: `server→client` / `client→server` / `common→@hatchery/client`（・server・docs）/ `docs→server`
   - 正（エラーが出ないこと）: `client→common` / `server→common` / `docs→client` / `docs→common`
   - （補助）`no-restricted-imports` 側で `@hatchery/*` パッケージ名経由の違反も同様に負ケースを確認。
3. **common 最小ユニットテスト**: `common/src/index.test.ts` で雛形関数（例: `add` などのダミー純粋関数、または `export {}` のみなら存在確認）が緑。
4. **server / client / docs 最小テスト**: 各ワークスペース（docs 含む）の `*.test.ts` が緑。
5. **型チェック**: `tsc -b` がエラーなく完了する（CI 的に `turbo run build` 経由でも可）。
6. **タスク依存順**: `turbo run build --dry=json` の出力（タスクグラフ）をパースし、common の build が client/server/docs の build の依存に入っていることを assert（ログ文字列マッチではなく構造化出力で検証）。
7. **Node 版の実効化**: `.npmrc` に `engine-strict=true` があり、`engines.node` が `>=26` であることを assert（誤った Node では install が失敗する旨を受け入れ #8 と対応）。

> 受け入れ条件の各項目（§3）と上記テストを対応させ、実装 PR では `turbo run lint test build` が緑であることをサマリに記載する。

## 7. リスク・未決事項

- **モジュール解決方式**（方針確定済み・§4.4）: ベース＝`nodenext`、共有 common は `nodenext` で `.d.ts` 出力（拡張子付き相対 import）、client のみ `bundler` に上書き。project references との相性は実装時に `tsc -b` で確認するが、common を nodenext 出力に固定することで両コンシューマからの解決を担保する。
- **依存方向強制の手段**（方針確定済み・§4.5）: 主軸＝`import/no-restricted-paths` の zone、補助＝`no-restricted-imports`（`@hatchery/*` パッケージ名）。両併用でパス・パッケージ名双方の抜け道を塞ぐ。
- **Node バージョン**: **Node 26** を採用（ADR-0002 改訂に追従）。Node 26 は本設計時点で LTS 化前（Active LTS は 2026 秋見込み）だが、最新ランタイム機能の前倒し採用方針。`.npmrc` の `engine-strict=true` で実効化。
- **pnpm / Turborepo / 各ツールのバージョン**: 本設計ではバージョンを固定せず「Node 26 対応の安定最新」を前提とする。具体ピンは実装 PR で `packageManager` / lockfile により確定。
- **client の Vitest + RTL**: 本 Issue では React 非依存の Vitest のみ。RTL・jsdom 環境は #7（client）で追加するため、ここでは導入しない。
- **CI 連携**: `df-develop.yml` 等の Actions は ADR/ワークフロー上「方式A採用時のみ」。本 Issue ではローカルで `turbo run` が緑になることを基準とし、CI は別途。
