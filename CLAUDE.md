# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## このリポジトリの現状

**実装フェーズ。** ADR で決めた構成（monorepo / pnpm + Turborepo / client・server・common・docs）は実装済みで、`package.json`・`pnpm-workspace.yaml`・各ワークスペースが存在する。`common`（Zod スキーマ＋ドメインロジック）・`server`（Express 5 / Prisma / OpenAPI 生成・認証・定時バッチ）・`client`（Vite + React 19 SPA・型安全 API クライアント）の MVP 機能が出揃いつつある段階。引き続き Issue 単位で機能を積み増していく。

企画・決定の正本は `concept.md`（プロダクト企画）、`docs/adr/`（技術選定の記録）、`docs/dark-factory-workflow.md`（開発体制の定義）。実装着手前に必ず該当 ADR と Issue 本文（目的・受け入れ条件）を読むこと。ADR の決定が「正本」であり、それに反する実装をしない。

## プロダクト: Hatchery

Slack 型 UI で「自分の会社の AI 社員」を放置して眺める観察エンタメ（`concept.md`）。中核は **観察 → 関与 → 変化の実感** のループ。設計上の重要な制約:

- **定時方式**: 常時稼働せず、1 日数回の「定時」に **1 API コールで複数 message（複数社員の掛け合い）** を JSON 生成・検証・channel 紐づきで永続化する。常時稼働プロセスは前提にしない（ADR-0009: Scene 廃止）。
- MVP は「最小 1 ループ」のみ（社員 3 人・チャンネル 2 つ・定時 2 回、タスクは `new`→`done` の 2 状態）。経験値・進化イベント・関係値などの拡張は MVP に入れない。

## 開発ワークフロー: Dark Factory（最重要）

このリポジトリは **Dark Factory パターン**で開発する。人間が触るのは **Issue 起票** と **main 昇格** の 2 点だけ。設計・実装・テスト・レビュー・develop マージはすべて AI が回す。全文は `docs/dark-factory-workflow.md`。

> 旧フローにあった「独立した設計 PR とその人間承認」は**廃止**した。人間確認を減らすため、AI は Issue 本文の受け入れ条件から直接実装に入り、**1 回の `/df` 実行で 実装 → 実装 PR → セルフレビュー → develop マージまで通す**。設計書（`docs/design/issue-<N>.md`）は廃止せず、feature ブランチで実装と一緒に書いて**実装 PR に同梱**する（人間承認は挟まない）。作業は**専用 git worktree（`.claude/worktrees/issue-<N>/`・`.gitignore` 済み）で隔離**して行い、メインの作業ツリーは `switch` しない（人間の未コミット作業や `/loop /df` の並行実行とコンフリクトしないため）。

### フロー（人間ゲートは2点のみ）

1. 👤 人間が Issue を起票（任意で `priority/*`・マイルストーンを設定。状態ラベルは付けない）
2. 🤖 AI が Issue を解決する実装 PR を作成（Issue は open のまま・develop ベースの実装 PR が立つ）
3. 🤖 AI がその PR をセルフレビュー・修正し、CI 緑 + 指摘ゼロで `develop` へマージし Issue をクローズ
4. 👤 人間が `develop → main` を昇格して本番反映

### ブランチ戦略

- `main` — 本番。**人間のみマージ可**。直接 push 禁止。
- `develop` — 統合。実装 PR は **AI 自身がレビュー → 修正 → マージ**（人間承認不要、CI 緑必須）。
- `feature/issue-<N>` — 実装ブランチ → `develop` への**実装 PR**。

### 状態管理（Issue の状態 + 実装 PR で判定。状態ラベルは使わない）

Dark Factory の進行は **Issue の open/closed と develop ベース実装 PR の有無**で管理する。`df:todo` のような `df:*` 状態ラベルは廃止済みで使わない（`/df` がこの状態から「次に何をすべきか」を判定する）。

| Issue 状態 | 実装 PR（`feature/issue-<N>` → develop） | フェーズ | 次の担当 |
|------------|------------------------------------------|---------|----------|
| open | PR なし | 実装 → 実装 PR 作成 | 🤖 AI |
| open | develop ベース PR あり | レビュー → マージ → クローズ | 🤖 AI |
| closed | — | 完了（develop マージ済み・本番昇格待ち） | 👤 人間 |

判断不能・自力解消不能なときは Issue にコメントし、**`milestone/*` ラベル（マイルストーン）を解除**して自動選択対象外にしたうえで停止する（人間介入待ち）。

優先度ラベル `priority/{critical,high,medium,low}` と `milestone/*` ラベルは状態とは直交する軸で、複数の AI 実行可能 Issue があるとき `/df`（引数なし）が**着手対象・着手順**を決めるのに使う（マイルストーン昇順 → 優先度の重み降順 → フェーズ進捗（PR あり > PR なし）→ `createdAt` 古い順）。**優先度未設定は `medium` 相当**。詳細は `docs/dark-factory-workflow.md` §3 と `.claude/commands/df.md`。

### フェーズごとの AI の動き

- **実装（open・PR なし）**: `feature/issue-<N>` の worktree を `.claude/worktrees/issue-<N>/` に作成（`git worktree add ... origin/develop`。メインツリーは switch しない）→ 設計書 `docs/design/issue-<N>.md` を書いてコミット → Issue 本文の受け入れ条件を入出力に落とし後述の TDD で実装 → `develop` へ実装 PR（設計書を含む。本文 `Closes #N` + 設計判断の要点 + テスト結果サマリ）→ **そのまま続けてレビューへ**。
- **レビュー（open・develop ベース PR あり）**: `/code-review` で実装 PR をレビュー → 指摘を自分で修正 → 収束まで反復 → CI 緑 + 指摘ゼロで **AI が `develop` へマージ**し Issue をクローズ。自力で解消できない場合は Issue にコメントしてマイルストーンを解除し人間に委ねる。`/df` は 1 回の実行で実装からこのマージまでを続けて完走する。
- **本番（Issue クローズ済み）**: `develop → main` の昇格 PR は**人間のみ**がマージ。

### TDD（実装フェーズ）

ユーザーのグローバル方針どおりテスト駆動。設計書の受け入れ条件を入出力に落とし、**まずテストを書き → 失敗を確認 → コミット → 通す最小実装**。実装中はテストを変更しない。全テスト緑 + lint 通過まで反復。

コミットメッセージ規約: `feat:` / `fix:` / `refactor:` / `docs:` / `config:` / `test:` / `style:`

## アーキテクチャ（ADR で決定済み・実装済み）

monorepo の 4 ワークスペース。**依存方向は client → common / server → common の一方向のみ**（client と server は相互依存しない。common はアプリ固有パッケージに依存しない）。ESLint の import 制約でこの境界を機械的に強制する。

- **`common/`** (ADR-0005) — 実行環境非依存の純粋 TypeScript。ドメインモデル・型・ドメインロジック（登場メンバー選定、あらすじ要約等の純粋関数）・**Zod スキーマ**を置く。React/MUI/DOM や Express/Prisma/Node 固有 API は置かない。ドメインロジックはここで TDD する（UI/DB 不要で高速にテスト可能）。
- **`server/`** (ADR-0004) — Node.js 22 / Express 5 / Prisma / PostgreSQL。層分離（ルーティング / ユースケース / ドメイン[common] / 永続化[Prisma]）。リクエスト検証は common の Zod スキーマで行う。**定時バッチ（シーン生成）は Express とは別エントリポイント**のスクリプトとして実装しスケジューラから起動。
- **`client/`** (ADR-0003) — Vite + React 19 SPA（SSR なし）/ MUI v6 + Emotion（Slack 風テーマ）/ TanStack Router / TanStack Query。**サーバ状態は TanStack Query に集約**し、グローバル状態管理ライブラリは当面入れない。
- **`docs/`** (ADR-0007) — Storybook 8（Vite ビルダー）。client の `*.stories.tsx` と設計 MDX を集約し GitHub Pages へ静的デプロイ。ADR は `docs/adr/*.md` を正本とし、MDX は薄いラッパーで取り込む。

### client ↔ server の型共有（ADR-0006）

OpenAPI を HTTP 境界の単一情報源とし、**一方向フロー**で流す（実装済み）:

```
common: Zod スキーマ → server: zod-to-openapi で openapi.json 生成 → client: openapi-typescript で型生成 → openapi-fetch + TanStack Query で利用
```

実装上の対応:

- **server** — `server/src/openapi/{registry,generate}.ts`。`@asteasolutions/zod-to-openapi` で common の Zod スキーマからレジストリを組み、`pnpm --filter @hatchery/server openapi`（script `openapi`）で `server/openapi.json` を生成する。
- **client** — `pnpm --filter @hatchery/client gen-types`（script `gen-types`）が `openapi-typescript` で `server/openapi.json` → `client/src/api/openapi.gen.ts`（`paths` 型）を生成。型安全な **fetch クライアントは `client/src/api/client.ts` の `openApiClient`**（`openapi-fetch` の `createClient<paths>`）として実装済みで、`client/src/api/{auth,channels,scenes,admin}.ts` がこれを使う。

生成物（型・openapi.json 由来の `*.gen.ts` / `generated/`）は**コミットしない**（`.gitignore` 済み）。ビルド前タスクで再生成し、Turborepo (`turbo.json`) で `@hatchery/server#openapi → @hatchery/client#gen-types → @hatchery/client#build` の順を保証する。

## ツールチェーン（ADR-0002・セットアップ済み）

- パッケージマネージャ: **pnpm**（workspaces, `packageManager: pnpm@9.15.0`）/ タスク: **Turborepo**。ルート script: `pnpm build|test|lint|dev`（= `turbo run ...`）、`pnpm typecheck`（`tsc -b`）、`pnpm test:repo`（リポジトリ規約テスト `tests/`）
- Node **26**（`.nvmrc` = `26` / `engines.node >=26` / Volta `26.2.0`）/ TypeScript strict（`tsconfig.base.json` を各ワークスペースが extends、project references）
- テスト: **Vitest**（全ワークスペース共通）。client は + React Testing Library（jsdom）
- lint/format: **ESLint（flat config）+ Prettier**。client→common / server→common の一方向 import 境界を ESLint で強制
- ワークスペース別の主要 script は各 `*/package.json` 参照（例: server `dev`/`batch`/`openapi`/`db:*`、client `dev`/`gen-types`/`build`）

## バリデーションルール

**ユーザーが入力する文字列フィールドは、Zod スキーマで必ず `.max()` による上限を設定すること**（#91）。
フロントエンドでも `inputProps={{ maxLength: N }}` 等で同じ上限を強制し、サーバ側 Zod と二重で守る。
上限値は表示・DB・UX を考慮して各フィールドごとに決める（例: チャンネル名 50 文字）。
`.max()` が無い `z.string()` は不正データ・表示崩れ・DB 負荷の原因になるため、レビューで指摘対象とする。

## フォーム規約

**フォームの状態管理は `@tanstack/react-form`（`useForm` / `form.Field`）を使うこと**（#262）。

- `useState` によるフォームフィールドの自前管理・自前 `isDirty` 実装は禁止。
- バリデーション・ダーティ検知・送信ハンドリングはすべて `useForm` に委ねる。
- 参照実装: `client/src/routes/LoginScene.tsx`（`useForm` + `form.Field` + MUI `TextField` の連携例）。
- 違反（生の `useState` によるフォーム管理・自前 isDirty 等）はレビューで指摘対象とする。

## ADR の追加・更新

技術的な決定は `docs/adr/NNNN-kebab-case-title.md`（連番 4 桁）に MADR 風フォーマットで 1 ファイル 1 決定で残す。新規は `docs/adr/template.md` をコピーし、`docs/adr/README.md` の一覧表に行を追加する。
