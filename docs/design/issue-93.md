# 設計書: IoC（DI コンテナ）の導入を検討し ADR にまとめる (#93)

## 1. 目的 / 背景

`server/src/app.ts` の `createApp(deps: AppDeps)` は、リポジトリを引数で受け取り `deps.channelRepository ?? new InMemoryChannelRepository()` のように手動コンストラクタ注入で依存を解決している。Issue が進むにつれリポジトリ数が増え（現時点で 7 種）、AppDeps が肥大化しつつあるため、IoC/DI コンテナの導入是非を検討し ADR に記録する。

## 2. スコープ（やること / やらないこと）

**やること:**
- 現状の手動 DI の課題を整理する
- 3 つの選択肢（現状維持 / コンテナ導入 / composition root 整理）を比較検討する
- ADR-0012 として決定を記録する
- `docs/adr/README.md` の一覧を更新する

**やらないこと:**
- 実コードの変更（配線リファクタ・ライブラリ導入）
- クライアント側への DI 導入検討

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `docs/adr/0012-ioc-di-container.md` が MADR 風フォーマットで存在する
- ADR に「現状の手動 DI の課題」「検討した選択肢（最低 3 つ）」「決定とその理由」「ADR-0001/0005 の境界・純粋性制約との整合」が含まれる
- `docs/adr/README.md` に ADR-0012 の行が追加されている
- 決定が「導入しない（①）」の場合、対応 Issue を作らない旨が ADR に明記されている

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 現状の分析

`createApp(deps: AppDeps)` は以下のリポジトリを受け取る：
- `messageRepository`（必須）
- `userRepository`, `channelMembershipRepository`, `channelRepository`, `employeeRepository`, `appSettingRepository`, `batchRunLogRepository`（省略可・省略時 InMemory）

`server.ts`（本番エントリ）が Prisma 実装を生成して `createApp` に渡す。これが事実上の **composition root**（配線の集約点）として機能している。

### 選択肢の比較

| 選択肢 | 概要 | 判断 |
|--------|------|------|
| ①現状維持 | 手動 DI を継続 | **採用**: テスト容易性高く、シンプルで理解しやすい |
| ②DI コンテナ導入 | tsyringe/Inversify/Awilix 等 | decorator 系はADR-0005違反リスク。全体に対して過剰 |
| ③Composition root 整理 | server.ts に配線を集約 | 実質的に現状すでに実現済み |

### 決定: 現状維持（選択肢①）

理由：
- `server.ts` がすでに composition root として機能している
- InMemory フォールバックによりテストが書きやすい
- decorator ベースのコンテナは `reflect-metadata` が必要でADR-0005の純粋性制約に抵触しうる
- MVP 規模では手動 DI のコストは低く、コンテナのオーバーヘッドに見合わない

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `docs`（ADR + README 更新のみ）
- コードの変更なし

## 6. テスト計画（TDD で書くテスト一覧）

本 Issue はドキュメント整備のみ。実装コードの変更はないためユニットテストは不要。

## 7. リスク・未決事項

- ADR 0011 は既存（Cloud Run ホスティング決定）のため、本 ADR は **0012** を採番する。
  Issue 本文に「0011」と記載があるが、実際のファイルは `0012-*.md` とする。
