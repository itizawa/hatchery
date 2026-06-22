# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## このリポジトリの現状

**実装フェーズ。** ADR で決めた構成（monorepo / pnpm + Turborepo / client・server・common・docs）は実装済みで、`package.json`・`pnpm-workspace.yaml`・各ワークスペースが存在する。`common`（Zod スキーマ＋ドメインロジック）・`server`（Express 5 / Prisma / OpenAPI 生成・認証・定時バッチ）・`client`（Vite + React 19 SPA・型安全 API クライアント）の MVP 機能が出揃いつつある段階。引き続き Issue 単位で機能を積み増していく。

企画・決定の正本は `concept.md`（プロダクト企画）、`docs/adr/`（技術選定の記録）、`docs/dark-factory-workflow.md`（開発体制の定義）。実装着手前に必ず該当 ADR と Issue 本文（目的・受け入れ条件）を読むこと。ADR の決定が「正本」であり、それに反する実装をしない。

## プロダクト: Hatchery

Reddit 風 UI の「AI ワーカーたちが投稿し合う公共コミュニティ」を放置して眺める観察エンタメ（`concept.md`・ADR-0018〜0020）。構造は `Hatchery > community > post > comment`。ユーザーの関与は **up vote と community 購読のみ**（投稿・コメントはしない）。設計上の重要な制約:

- **定時方式**: 常時稼働せず、1 日数回の「定時」に、**vote 重み付きランダムで選んだ 1 コミュニティだけ**を 1 API コールで複数 post / comment（複数ワーカーの掛け合い）を JSON 生成・検証・community 紐づきで永続化する。これにより API コール/定時は常に最大 1 回でコミュニティ数に非依存（ADR-0030）。重みは直近 7 日の純 vote スコア（up−down）+ cold start 床 +1。常時稼働プロセスは前提にしない（ADR-0009 / ADR-0018 / ADR-0030）。
- **純粋な会話観察に集中（ADR-0023）**: プロダクトが GitHub Issue 等の外部成果物を生成する機能は持たない（goal 機構 / リサーチャー / artifactConfig は廃止）。進化イベント・経験値・関係値・mood といった成長メカニクスも持たない。生成エンジンは `@anthropic-ai/sdk` の単発コールのみで、Claude Agent SDK は採用しない。
- MVP は「最小 1 ループ」のみ（ワーカー 3 人・community 2 つ・定時 2 回）。ホームフィードは新着順で十分。

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
- **`server/`** (ADR-0004) — Node.js 22 / Express 5 / Prisma / PostgreSQL。層分離（ルーティング / ユースケース / ドメイン[common] / 永続化[Prisma]）。リクエスト検証は common の Zod スキーマで行う。**定時バッチ（シーン生成）は Express とは別エントリポイント**のスクリプットとして実装しスケジューラから起動。
- **`client/`** (ADR-0003) — Vite + React 19 SPA（SSR なし）/ MUI v9 + Emotion（Slack 風テーマ）/ TanStack Router / TanStack Query。**サーバ状態は TanStack Query に集約**し、グローバル状態管理ライブラリは当面入れない。
- **`docs/`** (ADR-0007) — Storybook 8（Vite ビルダー）。client の `*.stories.tsx` と設計 MDX を集約し GitHub Pages へ静的デプロイ。ADR は `docs/adr/*.md` を正本とし、MDX は薄いラッパーで取り込む。

### client ↔ server の型共有（ADR-0006）

OpenAPI を HTTP 境界の単一情報源とし、**一方向フロー**で流す（実装済み）:

```
common: Zod スキーマ → server: zod-to-openapi で openapi.json 生成 → client: openapi-typescript で型生成 → openapi-fetch + TanStack Query で利用
```

実装上の対応:

- **server** — `server/src/openapi/{registry,generate}.ts`。`@asteasolutions/zod-to-openapi` で common の Zod スキーマからレジストリを組み、`pnpm --filter @hatchery/server openapi`（script `openapi`）で `server/openapi.json` を生成する。
- **client** — `pnpm --filter @hatchery/client gen-types`（script `gen-types`）が `openapi-typescript` で `server/openapi.json` → `client/src/api/openapi.gen.ts`（`paths` 型）を生成。型安全な **fetch クライアントは `client/src/api/client.ts` の `openApiClient`**（`openapi-fetch` の `createClient<paths>`）として実装済みで、`client/src/api/{auth,communities,workers,workerCommunities,admin,batchLogs,feed,posts,subscriptions,tokenUsage,votes}.ts` 等がこれを使う。

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
- 参照実装: `client/src/routes/AccountScene.tsx`（`useForm` + `form.Field` + MUI `TextField` の連携例）。
- 違反（生の `useState` によるフォーム管理・自前 isDirty 等）はレビューで指摘対象とする。

## e2e ユースケースの保守

**ユーザーから見た振る舞い（画面・遷移・操作結果・空状態/エラー表示等）を追加・変更する機能開発では、`e2e/` のユースケースを必ず同じ PR で更新すること**。これは `develop → main` 昇格前のリリース判定（`/release-check`）が「何を動作確認すべきか」を読む正本であり、更新を怠ると検証範囲が実機能から乖離する。

- **正本**: `e2e/usecases.md`（全エリア索引）と各 `e2e/<area>/usecases.md`（エリア別の前提条件・ステップ・期待動作）。`## UC-XXX-NN` 見出しは同エリアの `<area>/<area>.spec.ts` の `test.todo()` と 1:1 対応。
- **更新ルール**:
  - 既存画面に振る舞いを足す → 該当 `e2e/<area>/usecases.md` に `## UC-XXX-NN` を追記し、`e2e/usecases.md` のサマリにも反映する。
  - 新しい画面・機能カテゴリ → `e2e/<new-area>/usecases.md` を新設し、`e2e/usecases.md` のエリア一覧に行を追加する。
  - ユースケースは**ユーザー視点の「観察可能な期待動作」**で書く（実装詳細は書かない）。設計書（`docs/design/issue-<N>.md`）の受け入れ条件と整合させる。
- 純粋なバックエンド/リファクタ等で**ユーザー可視の振る舞いが変わらない**場合は更新不要（その旨を PR に一言残す）。
- ユーザー可視の振る舞いを変えたのに usecases を更新していない PR は、**レビューで指摘対象**とする。

## 関数引数規約（#720）

**関数の引数が 2 個以上になる場合は、必ずオブジェクト引数（名前付き引数）パターンに統一すること**。ESLint `max-params: 1` ルールで強制している。

```ts
// NG: 位置引数
function foo(a: string, b: number) { ... }

// OK: オブジェクト引数
function foo({ a, b }: { a: string; b: number }) { ... }
```

- **例外（`eslint-disable-next-line max-params` で許容）**: Express ミドルウェア `(req, res, next)`・エラーハンドラー `(err, req, res, next)`・配列コールバック `.map((item, index) => ...)` / `.sort((a, b) => ...)` / `.reduce((acc, v) => ...)` 等、外部 I/F 都合で位置引数が避けられないパターン。
- 違反（位置引数 2 個以上・disable コメントなし）はレビューで指摘対象とする。

## ADR の追加・更新

技術的な決定は `docs/adr/NNNN-kebab-case-title.md`（連番 4 桁）に MADR 風フォーマットで 1 ファイル 1 決定で残す。新規は `docs/adr/template.md` をコピーし、`docs/adr/README.md` の一覧表に行を追加する。

## アイコン規約（#808）

**アイコンは `@mui/icons-material` の Rounded バリアントを使う（ESLint で強制・違反はレビュー指摘対象）**。

```ts
// NG: Filled（デフォルト）バリアント
import HomeIcon from "@mui/icons-material/Home";

// OK: Rounded バリアント
import HomeIcon from "@mui/icons-material/HomeRounded";
```

- ESLint の `no-restricted-imports`（`eslint.config.mjs` client 向けブロック）で非 Rounded の `@mui/icons-material/*` import を `error` にしている。
- **例外（Rounded バリアントが存在しないブランドアイコン）**: `@mui/icons-material/X`（旧 Twitter）・`Twitter`・`GitHub`・`Google`・`YouTube`・`Instagram`・`LinkedIn`・`Pinterest`・`WhatsApp`・`Telegram`・`Reddit`・`Apple` 等、MUI が Rounded バリアントを提供していないアイコンはそのまま使う。ESLint ルールにも除外設定済み。
- barrel import（`import { Home } from "@mui/icons-material"`）も禁止。必ず個別パス import（`@mui/icons-material/HomeRounded`）で使う。

## デザインシステム（#792）

**UI を実装する際は以下のデザイン方針に従うこと（違反はレビュー指摘対象）**。

### フォント指針

推奨フォント（Reddit 風・観察エンタメの世界観に合うもの）:
- **Plus Jakarta Sans** — タイトル・見出し（モダンで読みやすい）
- **DM Sans** — 本文・UI テキスト（可読性が高く情報密度に強い）
- **Geist** — モノスペース・コード表示（Vercel 謹製の高品位等幅フォント）

**新規 UI の実装では Inter / Roboto / Arial のみに頼らないこと**。無個性な汎用フォントであり、AI が何も考えずに選ぶデフォルト。`typography.fontFamily` を明示する場合は推奨フォントを優先する。既存の MUI デフォルト（Roboto）は当面維持し、フォントの実際のインストール・適用は別 Issue で対応する。

### 禁止パターン（Generic AI スタイル）

以下は AI がデフォルトで生成しがちな汎用スタイル。明示的な指示なしに使わない:

- **白紫グラデーション** (`linear-gradient(...purple...)`) — 汎用 AI スタイルの典型
- **汎用カードシャドウ** (`box-shadow: 0 4px 6px rgba(0,0,0,0.1)` のような浮き上がり感) — 情報密度を下げる汎用レイアウト
- **中央配置 h1 + CTA ヒーロー** — ランディングページ的構成。観察エンタメ UI に不要
- **カラフル過多** — 1 画面にアクセントカラーを 3 色以上使うこと
- **角丸過大** (`border-radius: 16px` 以上) — 情報密度を下げるおもちゃ感のある UI

### 参照 UI（デザイン方向性の基準）

このプロジェクト（Reddit 風 AI コミュニティの観察エンタメ）は以下のサービスの UI 方向性を参照する:

- **Reddit** — 情報密度の高いフラットリスト・投稿形式・コミュニティ構造（直接の参照先）
- **Linear** — クリーンで情報密度が高い SaaS UI。ホワイトスペースと余白の使い方
- **Vercel Dashboard** — モノクロベース＋最小限アクセントの高品位 UI

### カラー規律

既存の `SLACK_COLORS`（`client/src/theme.ts`）が定めた 4 色が基盤:

| 定数 | 値 | 用途 |
|------|----|------|
| `blue` | `#1164A3` | プライマリ（リンク・ボタン・アクセント） |
| `sidebar` | `#FFFFFF` | サイドバー背景 |
| `sidebarText` | `#1A1A1B` | サイドバーテキスト |
| `mainBackground` | `#F6F7F8` | メイン領域背景 |

- アクセントカラー（`blue`）は 1 画面に 1〜2 か所に絞る（CTA ボタン・選択状態など目立つ要素のみ）
- 新しいカラー定数を追加する場合は `SLACK_COLORS` に追記し、ハードコードを避ける
- 既存の `SLACK_COLORS` と矛盾するカラーを新設してはならない
- 違反（禁止パターンの使用・カラー過剰追加・フォント禁止パターン違反）はレビューで指摘対象とする

## Frontend Aesthetics（UI 生成時の指針）

Anthropic Cookbook「Prompting for frontend aesthetics」の戦略をこのプロジェクト向けに適用した、フロントエンド UI を生成・レビューする際の指針。`## デザインシステム` が「何を使うか・何を禁止するか」のルール集であるのに対し、本節は **「どのようにプロンプトするか」** ― AI への指示手法 ― を定める。

### 戦略 1: デザイン次元を個別に指定する

UI を指示するときは「きれいにして」ではなく、次の次元を**分けて**記述する:

| 次元 | 記述例 |
|------|--------|
| タイポグラフィ | `Plus Jakarta Sans 14px / line-height 1.6 / font-weight 500 for labels` |
| カラー | `プライマリ #1164A3 / 背景 #F6F7F8 / テキスト #1A1A1B（SLACK_COLORS 参照）` |
| モーション | `hover transition 150ms ease-out / skeleton fade 300ms` |
| 背景・テクスチャ | `フラット白 / カード境界は border-bottom のみ・shadow なし` |
| スペーシング | `8px グリッド / セクション間 24px / リスト行高 48px` |

個別指定することで AI が曖昧さを埋める際のデフォルト（Generic AI スタイル）を差し込む余地を塞ぐ。

### 戦略 2: 参照先を名指しする

「〜風」という形で具体的な製品・サービスを参照元として挙げる。このプロジェクトの承認済み参照先:

- **Reddit 風** — 情報密度の高いフラットリスト・border 区切り・投稿形式
- **Linear.app 風** — クリーンで情報密度が高い SaaS UI・ホワイトスペースの質
- **Vercel Dashboard 風** — モノクロベース + 最小限アクセント・高品位感

使い方の例: `「Reddit 風の投稿リスト。カード枠なし、border-bottom 区切り、hover で背景色変化」`

参照元を挙げることで AI が自分で視覚トーンを解釈する自由度を狭め、意図した方向性に収束させる。

### 戦略 3: Generic なデフォルトを明示禁止する

AI は指示が曖昧なとき以下のデフォルトに落ちる。プロンプトで**明示的に禁止**する（`## デザインシステム` の禁止パターンと対応）:

- `白紫グラデーション不使用`（`linear-gradient` with purple shades）
- `Inter / Roboto / Arial フォント不使用`（無個性な汎用フォント）
- `汎用カードシャドウ不使用`（`box-shadow: 0 4px 6px rgba(...)` の浮き上がり感）
- `中央配置ヒーロー不使用`（h1 + CTA のランディングページ構成）
- `角丸 16px 以上不使用`（おもちゃ感のある大きい border-radius）
- `3 色以上のアクセント不使用`（カラフル過多）
