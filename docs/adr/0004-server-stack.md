# ADR-0004: server 技術スタック（Express + Prisma）

- ステータス: Accepted
- 日付: 2026-05-30
- 関連 Issue: #1

## コンテキスト（背景）

server は Hatchery の API サーバ。役割は (1) client へメッセージ/社員データを返す REST API、(2) 定時バッチで LLM を 1 コールし複数 message を生成・永続化する処理（concept.md の「定時方式」）。データはログ・タスクなど構造化された永続データで、リレーショナルに表現できる。Issue #1 で Node.js / Express.js / TypeScript / Prisma / PostgreSQL が示されている。

## 決定

`server` を以下のスタックで構築する。

- **ランタイム: Node.js 22 LTS**
- **言語: TypeScript（strict）**
- **Web フレームワーク: Express.js（v5）**
- **ORM: Prisma**（スキーマ駆動、マイグレーション管理）
- **DB: PostgreSQL**
- **バリデーション: Zod**。リクエスト/レスポンスのスキーマを Zod で定義し、`common` に置いて client と共有する。Zod スキーマから OpenAPI を生成する（ADR-0006）
- **テスト: Vitest**。ドメインロジックは `common` 側でユニットテスト、API は統合テスト（テスト用 PostgreSQL に対して実行）
- **構成方針**: ルーティング（Express）/ ユースケース / ドメイン（`common`）/ 永続化（Prisma）を層として分離し、ドメインロジックを Express・Prisma から独立させる

定時バッチ（メッセージ生成）は Express アプリとは別のエントリポイント（スクリプト）として実装し、スケジューラ（cron / ホスティングのスケジュール機能）から起動する。常時稼働プロセスは前提にしない（concept.md の方針に合わせる）。Scene 廃止の判断は ADR-0009 を参照（#27）。

## 理由

- **Express 5**: 枯れていて学習資産が豊富。AI が安定して実装でき、ミドルウェア資産も厚い。本 API の規模に対して十分。
- **Prisma**: 型安全な DB アクセスとマイグレーションを一体で提供。TypeScript との親和性が高く、スキーマが単一情報源になる。
- **PostgreSQL**: ログ・タスク・社員・メッセージといった構造化データとリレーションに最適。JSON 型も使え、柔軟な保存にも対応。
- **Zod を common に置く**: サーバの入力検証とクライアントの型・OpenAPI 生成を 1 つのスキーマ定義から導けるため、二重定義を避けられる（ADR-0005・0006）。
- ドメインを層分離することで、TDD（テスト先行）をドメイン中心に進めやすい。

## 検討した代替案

- **NestJS**: DI・構造化が強力だが、この規模には重い。Express の軽さを優先。
- **Fastify**: 高速・スキーマ駆動が魅力だが、Issue 方針（Express）と資産の厚さから Express を採用。
- **ORM に TypeORM / Drizzle**: Drizzle は軽量で魅力的だが、マイグレーションとスキーマ駆動の完成度・実績で Prisma を採用。
- **OpenAPI 生成に tsoa（デコレータ駆動）**: 有力だが、Zod スキーマを `common` で client と共有する方針（ランタイム検証も兼ねる）と相性が良い zod ベース生成を採用（ADR-0006）。

## 影響（結果）

- 良い影響: スキーマ（Prisma / Zod）が単一情報源になり、型・検証・ドキュメントが一貫する。バッチと API を分離でき、コストの読める定時運用に合う。
- トレードオフ: API の統合テストにテスト用 PostgreSQL が必要（Docker 等）。CI でのDB 準備が要る。
- フォローアップ: DB スキーマ（Prisma schema）の初期設計、バッチ実行基盤・スケジューラ選定は別 Issue。
