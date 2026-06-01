# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## このリポジトリの現状

**ドキュメント／設計フェーズ。アプリのコードはまだ存在しない。** 現在あるのは `concept.md`（プロダクト企画）、`docs/adr/`（技術選定の記録）、`docs/dark-factory-workflow.md`（開発体制の定義）のみ。ADR で決めた構成（monorepo / pnpm + Turborepo / client・server・common）は**まだ実装されていない**＝`package.json`・`pnpm-workspace.yaml`・各ワークスペースは未作成。セットアップは別 Issue で行う前提（ADR-0002 のフォローアップ参照）。

実装着手前に必ず該当 ADR と Issue 本文（目的・受け入れ条件）を読むこと。ADR の決定が「正本」であり、それに反する実装をしない。

## プロダクト: Hatchery

Slack 型 UI で「自分の会社の AI 社員」を放置して眺める観察エンタメ（`concept.md`）。中核は **観察 → 関与 → 変化の実感** のループ。設計上の重要な制約:

- **定時方式**: 常時稼働せず、1 日数回の「定時」に **1 API コールで複数 message（複数社員の掛け合い）** を JSON 生成・検証・channel 紐づきで永続化する。常時稼働プロセスは前提にしない（ADR-0009: Scene 廃止）。
- MVP は「最小 1 ループ」のみ（社員 3 人・チャンネル 2 つ・定時 2 回、タスクは `new`→`done` の 2 状態）。経験値・進化イベント・関係値などの拡張は MVP に入れない。

## 開発ワークフロー: Dark Factory（最重要）

このリポジトリは **Dark Factory パターン**で開発する。人間が触るのは **Issue 起票** と **main 昇格** の 2 点だけ。設計・実装・テスト・レビュー・develop マージはすべて AI が回す。全文は `docs/dark-factory-workflow.md`。

> 旧フローにあった「独立した設計 PR とその人間承認」は**廃止**した。人間確認を減らすため、AI は Issue 本文の受け入れ条件から直接実装に入り、**1 回の `/df` 実行で 実装 → 実装 PR → セルフレビュー → develop マージまで通す**。設計書（`docs/design/issue-<N>.md`）は廃止せず、feature ブランチで実装と一緒に書いて**実装 PR に同梱**する（人間承認は挟まない）。作業は**専用 git worktree（`.claude/worktrees/issue-<N>/`・`.gitignore` 済み）で隔離**して行い、メインの作業ツリーは `switch` しない（人間の未コミット作業や `/loop /df` の並行実行とコンフリクトしないため）。

### フロー（人間ゲートは2点のみ）

1. 👤 人間が Issue を起票（ラベル `df:todo`）
2. 🤖 AI が Issue を解決する実装 PR を作成（`df:todo → df:dev-review`）
3. 🤖 AI がその PR をセルフレビュー・修正し、CI 緑 + 指摘ゼロで `develop` へマージ（`df:dev-review → df:done`）
4. 👤 人間が `develop → main` を昇格して本番反映

### ブランチ戦略

- `main` — 本番。**人間のみマージ可**。直接 push 禁止。
- `develop` — 統合。実装 PR は **AI 自身がレビュー → 修正 → マージ**（人間承認不要、CI 緑必須）。
- `feature/issue-<N>` — 実装ブランチ → `develop` への**実装 PR**。

### ラベル状態機械（Issue の状態＝次に動く担当）

| ラベル | 意味 | 次の担当 |
|--------|------|----------|
| `df:todo` | 人間が Issue 起票済み・AI 着手待ち | 🤖 AI（実装） |
| `df:dev-review` | 実装 PR 作成済み・レビュー〜マージ | 🤖 AI |
| `df:done` | develop マージ済み・本番昇格待ち | 👤 人間 |
| `df:blocked` | AI が判断不能・要人間介入 | 👤 人間 |

優先度ラベル `priority/{critical,high,medium,low}` は `df:*` と直交する軸で、複数の AI 実行可能 Issue があるとき `/df`（引数なし）が**着手順**を決めるのに使う（重み降順 → フェーズ進捗 `df:dev-review`>`df:todo` → `createdAt` 古い順）。**未設定は `medium` 相当**。詳細は `docs/dark-factory-workflow.md` §3 と `.claude/commands/df.md`。

### フェーズごとの AI の動き

- **実装（`df:todo`）**: `feature/issue-<N>` の worktree を `.claude/worktrees/issue-<N>/` に作成（`git worktree add ... origin/develop`。メインツリーは switch しない）→ 設計書 `docs/design/issue-<N>.md` を書いてコミット → Issue 本文の受け入れ条件を入出力に落とし後述の TDD で実装 → `develop` へ実装 PR（設計書を含む。本文 `Closes #N` + 設計判断の要点 + テスト結果サマリ）→ Issue を `df:dev-review` に → **そのまま続けてレビューへ**。
- **レビュー（`df:dev-review`）**: `/code-review` で実装 PR をレビュー → 指摘を自分で修正 → 収束まで反復 → CI 緑 + 指摘ゼロで **AI が `develop` へマージ** → `df:done`。自力で解消できない場合は `df:blocked` を付け人間に委ねる。`/df` は 1 回の実行で実装からこのマージまでを続けて完走する。
- **本番（`df:done`）**: `develop → main` の昇格 PR は**人間のみ**がマージ。

### TDD（実装フェーズ）

ユーザーのグローバル方針どおりテスト駆動。設計書の受け入れ条件を入出力に落とし、**まずテストを書き → 失敗を確認 → コミット → 通す最小実装**。実装中はテストを変更しない。全テスト緑 + lint 通過まで反復。

コミットメッセージ規約: `feat:` / `fix:` / `refactor:` / `docs:` / `config:` / `test:` / `style:`

## アーキテクチャ（ADR で決定済み・実装はこれから）

monorepo の 4 ワークスペース。**依存方向は client → common / server → common の一方向のみ**（client と server は相互依存しない。common はアプリ固有パッケージに依存しない）。ESLint の import 制約でこの境界を機械的に強制する。

- **`common/`** (ADR-0005) — 実行環境非依存の純粋 TypeScript。ドメインモデル・型・ドメインロジック（登場メンバー選定、あらすじ要約等の純粋関数）・**Zod スキーマ**を置く。React/MUI/DOM や Express/Prisma/Node 固有 API は置かない。ドメインロジックはここで TDD する（UI/DB 不要で高速にテスト可能）。
- **`server/`** (ADR-0004) — Node.js 22 / Express 5 / Prisma / PostgreSQL。層分離（ルーティング / ユースケース / ドメイン[common] / 永続化[Prisma]）。リクエスト検証は common の Zod スキーマで行う。**定時バッチ（シーン生成）は Express とは別エントリポイント**のスクリプトとして実装しスケジューラから起動。
- **`client/`** (ADR-0003) — Vite + React 19 SPA（SSR なし）/ MUI v6 + Emotion（Slack 風テーマ）/ TanStack Router / TanStack Query。**サーバ状態は TanStack Query に集約**し、グローバル状態管理ライブラリは当面入れない。
- **`docs/`** (ADR-0007) — Storybook 8（Vite ビルダー）。client の `*.stories.tsx` と設計 MDX を集約し GitHub Pages へ静的デプロイ。ADR は `docs/adr/*.md` を正本とし、MDX は薄いラッパーで取り込む。

### client ↔ server の型共有（ADR-0006）

OpenAPI を HTTP 境界の単一情報源とし、**一方向フロー**で流す:

```
common: Zod スキーマ → server: zod-to-openapi で openapi.json 生成 → client: openapi-typescript で型生成 → openapi-fetch + TanStack Query で利用
```

生成物（型・openapi.json 由来の `*.gen.ts` / `generated/`）は**コミットしない**（`.gitignore` 済み）。ビルド前タスクで再生成し、Turborepo で `server:openapi → client:gen-types → client:build` の順を保証する。

## ツールチェーン（ADR-0002・未セットアップ）

実装が始まると以下になる予定。コマンドは `package.json` / `turbo.json` 整備後に確定:

- パッケージマネージャ: **pnpm**（workspaces）/ タスク: **Turborepo**（`turbo run build|test|lint|dev`）
- Node **22 LTS**（`.nvmrc`）/ TypeScript strict（`tsconfig.base.json` を各ワークスペースが extends、project references）
- テスト: **Vitest**（全ワークスペース共通）。client は + React Testing Library
- lint/format: **ESLint（flat config）+ Prettier**

## ADR の追加・更新

技術的な決定は `docs/adr/NNNN-kebab-case-title.md`（連番 4 桁）に MADR 風フォーマットで 1 ファイル 1 決定で残す。新規は `docs/adr/template.md` をコピーし、`docs/adr/README.md` の一覧表に行を追加する。
