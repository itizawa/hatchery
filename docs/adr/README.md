# Architecture Decision Records (ADR)

このディレクトリは Hatchery のアーキテクチャ上の意思決定を記録する。

## ADR とは

ADR（Architecture Decision Record）は「重要な技術的決定」を、背景・決定・理由・検討した代替案・影響とともに 1 ファイル 1 決定で残す軽量ドキュメント。後から「なぜこうなっているのか」を辿れるようにするのが目的。

## フォーマット

[MADR](https://adr.github.io/madr/) 風のフォーマットを使う。新規作成時は [`template.md`](./template.md) をコピーする。

## ステータス

- `Accepted` — 提案中（設計レビュー待ち）
- `Accepted` — 承認済み（設計 PR がマージされた）
- `Superseded by ADR-XXXX` — 別 ADR に置き換えられた
- `Deprecated` — 廃止

## 一覧

| # | タイトル | ステータス |
|---|----------|-----------|
| [0001](./0001-monorepo-structure.md) | monorepo 構成（docs / client / server / common） | Accepted |
| [0002](./0002-package-manager-and-build-tooling.md) | パッケージマネージャとビルド/タスク管理（pnpm + Turborepo） | Accepted |
| [0003](./0003-client-stack.md) | client 技術スタック（React SPA） | Accepted |
| [0004](./0004-server-stack.md) | server 技術スタック（Express + Prisma） | Accepted |
| [0005](./0005-common-package.md) | common パッケージの責務と依存方向 | Accepted |
| [0006](./0006-client-server-type-sharing.md) | client ↔ server の型共有（OpenAPI + openapi-typescript） | Accepted |
| [0007](./0007-documentation-storybook-github-pages.md) | ドキュメント基盤（Storybook MDX + GitHub Pages） | Accepted |
| [0008](./0008-cloudflare-pages-hosting-and-ogp.md) | ホスティング先（Cloudflare Pages）と SPA でのページ毎 OGP 方針 | Accepted |
| [0009](./0009-remove-scene-direct-message-channel.md) | Scene 廃止と message の channel 直接紐づけ | Accepted |
| [0010](./0010-authentication-password-passport.md) | 認証方式: ID/Password（passport-local + express-session） | Accepted |
| [0011](./0011-server-hosting-cloud-run.md) | サーバホスティング先（Cloud Run）と開発環境デプロイパイプライン | Accepted |
| [0012](./0012-ioc-di-container.md) | IoC（DI コンテナ）導入検討と手動 DI の継続 | Accepted |
| [0013](./0013-dependency-update-policy.md) | 依存アップデートポリシー（Renovate + クールダウン） | Accepted |

## 命名規則

`NNNN-kebab-case-title.md`（連番 4 桁ゼロ埋め）。
