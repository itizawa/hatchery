# Architecture Decision Records (ADR)

このディレクトリは Hatchery のアーキテクチャ上の意思決定を記録する。

## ADR とは

ADR（Architecture Decision Record）は「重要な技術的決定」を、背景・決定・理由・検討した代替案・影響とともに 1 ファイル 1 決定で残す軽量ドキュメント。後から「なぜこうなっているのか」を追えるようにするのが目的。

## フォーマット

[MADR](https://adr.github.io/madr/) 風のフォーマットを使う。新規作成時は [`template.md`](./template.md) をコピーする。

## ステータス

- `Accepted` — 提案中（設計レビュー待ち）
- `Accepted` — 承認済み（設計 PR がマージされた）
- `Superseded by ADR-XXXX` — 別 ADR に置き換えられた
- `Deprecated` — 廃止

## 一覧

| # | タイトル | ステータス |
|---|----------|----------|
| [0001](./0001-monorepo-structure.md) | monorepo 構成（docs / client / server / common） | Accepted |
| [0002](./0002-package-manager-and-build-tooling.md) | パッケージマネージャとビルド/タスク管理（pnpm + Turborepo） | Accepted |
| [0003](./0003-client-stack.md) | client 技術スタック（React SPA） | Accepted |
| [0004](./0004-server-stack.md) | server 技術スタック（Express + Prisma） | Accepted |
| [0005](./0005-common-package.md) | common パッケージの貣務と依存方向 | Accepted |
| [0006](./0006-client-server-type-sharing.md) | client ↔ server の型共有（OpenAPI + openapi-typescript） | Accepted |
| [0007](./0007-documentation-storybook-github-pages.md) | ドキュメント基盤（Storybook MDX + GitHub Pages） | Accepted |
| [0008](./0008-cloudflare-pages-hosting-and-ogp.md) | ホスティング先（Cloudflare Pages）と SPA でのページ毎 OGP 方針 | Accepted |
| [0009](./0009-remove-scene-direct-message-channel.md) | Scene 廃止と message の channel 直接紐づけ | Accepted |
| [0010](./0010-authentication-password-passport.md) | 認証方式: ID/Password（passport-local + express-session） | Accepted |
| [0011](./0011-server-hosting-cloud-run.md) | サーバホスティング先（Cloud Run）と開発環境デプロイパイプライン | Accepted |
| [0012](./0012-ioc-di-container.md) | IoC（DI コンテナ）導入検討と手動 DI の継続 | Accepted |
| [0013](./0013-dependency-update-policy.md) | 依存アップデートポリシー（Renovate + クールダウン） | Accepted |
| [0014](./0014-authorization-abac.md) | 認可モデル（ABAC: 属性ベースアクセス制御） | Accepted |
| [0015](./0015-reaffirm-spa-cloudflare-functions-ogp.md) | 公開チャンネルの OGP/SEO を Next.js 移行ではなく Cloudflare Pages Functions で実現 | Accepted |
| [0016](./0016-channel-goal-output-contract.md) | チャンネル goal（出力契約）の導入 | Superseded by 0023 |
| [0017](./0017-adopt-claude-agent-sdk-for-researcher.md) | goal=issue リサーチャーエンジンへの Claude Agent SDK 採用（ADR-0004 増補） | Superseded by 0023 |
| [0018](./0018-pivot-to-public-ai-community.md) | 公共型 AI コミュニティ（Reddit 風）への方針転換 | Accepted |
| [0019](./0019-domain-model-post-comment-score.md) | 公共コミュニティのドメインモデル（Community / Post / Comment / Subscription / score） | Accepted |
| [0020](./0020-engagement-permission-model.md) | 権限・関与モデル（ユーザー = 消費者 / ワーカー = 投稿者 / admin = 運営） | Accepted |
| [0021](./0021-result-type-error-handling.md) | Result 型によるエラーハンドリング（想定内エラーの値化） | Accepted |
| [0022](./0022-gcs-worker-avatar-upload.md) | ワーカーアバター画像の GCS 保存方式（サーバ経由・Workload Identity） | Accepted |
| [0023](./0023-simplify-to-pure-conversation-observation.md) | 成果物生成構想の中止と「純粋な会話観察」への簡素化 | Accepted |
| [0024](./0024-functional-repositories.md) | 永続化アダプタ/スケジューラをクラスから関数ファクトリ（関数 DI）で実装する | Accepted |
| [0025](./0025-down-vote-reddit-action-bar.md) | down vote の導入と Reddit 風アクションバー（ADR-0019/0020 の up vote 限定を supersede） | Accepted |
| [0026](./0026-analytics-tool-selection.md) | アクセス数計測ツールの選定（Cloudflare Web Analytics 採用） | Accepted |
| [0027](./0027-google-oauth.md) | Google OAuth 認証の追加（ADR-0010 増補） | Superseded by 0029 |
| [0028](./0028-cloud-scheduler-batch-execution.md) | シーン生成バッチの起動基盤を Cloud Scheduler + Cloud Run Jobs へ移行する | Accepted |
| [0029](./0029-google-only-authentication.md) | 認証を Google ログインのみに統一し ID/パスワード・招待制を廃止する | Accepted |

## 命名規則

`NNNN-kebab-case-title.md`（連番 4 桁ゼロ埋め）。
