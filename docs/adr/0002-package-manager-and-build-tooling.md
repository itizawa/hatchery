# ADR-0002: パッケージマネージャとビルド/タスク管理（pnpm + Turborepo）

- ステータス: Accepted
- 日付: 2026-05-30
- 関連 Issue: #1

## コンテキスト（背景）

ADR-0001 で monorepo（4 ワークスペース）を採用した。これを運用するには (1) ワークスペースを束ねるパッケージマネージャ、(2) ビルド・テスト・lint をワークスペース横断かつ依存順で実行するタスクランナー、(3) Node バージョンと TypeScript の共通設定が必要。

Issue #1 では「パッケージマネージャ・ビルドツール・テストフレームワーク・Node バージョン」を未決論点として推奨を求めている。

## 決定

- **パッケージマネージャ: pnpm（workspaces）** を採用する。ルートに `pnpm-workspace.yaml` を置く。
- **タスク管理: Turborepo** を採用する。`turbo.json` で `build` / `test` / `lint` / `dev` のタスク依存とキャッシュを定義する。
- **Node: 22 LTS** に固定する（`.nvmrc` / `package.json` の `engines`）。
- **言語: TypeScript（strict 有効）**。ルートに `tsconfig.base.json` を置き、各ワークスペースが extends する。プロジェクト参照（project references）でワークスペース間の型解決とインクリメンタルビルドを行う。
- **テスト: Vitest** を全ワークスペース共通で採用する（client/common/server すべて）。
- **lint / format: ESLint（flat config）+ Prettier** を採用する。

## 理由

- **pnpm**: シンボリックリンクベースで `node_modules` の重複を抑え、monorepo のインストールが速い。厳密な依存解決により「宣言していない依存をたまたま使えてしまう」事故を防ぐ。
- **Turborepo**: 設定が軽量で pnpm workspaces とそのまま噛み合う。タスクのキャッシュ・並列化・依存順実行を最小設定で得られ、CI 時間短縮に効く。
- **Node 22 LTS**: 長期サポート。Express 5・Prisma・Vite いずれも対応。
- **Vitest 統一**: client（Vite ベース）と自然に統合でき、common の純粋ロジックも高速にテストできる。フレームワークを 1 つに統一すると設定・知識・CI が単純化する。CLAUDE.md の TDD 方針（テスト先行）を全ワークスペースで同じ書き味で実践できる。
- **ESLint + Prettier**: React/MUI/TypeScript エコシステムのプラグイン資産が最も厚く、AI が生成するコードの規約適用が安定する。

## 検討した代替案

- **npm / yarn workspaces**: 標準的だが、monorepo でのインストール速度・厳密性で pnpm に劣る。不採用。
- **Nx**: 高機能（依存グラフ・ジェネレータ）だが、この規模には設定・学習コストが過大。Turborepo の軽さを優先。
- **Bun**: 高速だが Prisma 等の互換性に不確実性が残る段階のため、安定性を優先して見送り。将来再検討可。
- **Jest（テスト）**: 実績は豊富だが、Vite ベースの client との統合で設定が増える。Vitest に統一。
- **Biome（lint/format）**: 非常に高速だが、MUI/React 周りのルール資産は ESLint が依然優位。速度より資産を優先。将来 Biome 移行は再検討可。

## 影響（結果）

- 良い影響: インストール・CI が高速。タスク依存（common → client/server）を Turborepo が保証。設定・テストの書き味が統一される。
- トレードオフ: pnpm 固有の厳密な依存解決により、依存の宣言漏れが初期に顕在化することがある（=正しい挙動だが移行時に手当てが要る）。
- フォローアップ: ルートに `pnpm-workspace.yaml` / `turbo.json` / `tsconfig.base.json` / `.nvmrc` / ESLint flat config / Prettier 設定を用意（別 Issue: セットアップ）。
