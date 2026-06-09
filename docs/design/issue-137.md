# Issue #137 設計書: createApp を純粋ファクトリ化し composition root を集約する

## 概要

ADR-0012 の案D に基づき、`createApp` を「受け取った依存をそのまま配線する純粋ファクトリ」に整理する。
InMemory フォールバック生成を `createApp` 内から撤去し、テスト合成ヘルパ / Prisma 本番合成ヘルパに分離する。

## 変更方針

### 1. `createApp` の純粋ファクトリ化

`AppDeps` の省略可（`?`）リポジトリフィールドをすべて**必須**に変更する。
`createApp` 内の `?? new InMemoryXxx()` フォールバックを撤去し、受け取った依存をそのまま配線する。

変更対象フィールド:
- `userRepository?: UserRepository` → `userRepository: UserRepository`
- `channelMembershipRepository?: ChannelMembershipRepository` → `channelMembershipRepository: ChannelMembershipRepository`
- `channelRepository?: ChannelRepository` → `channelRepository: ChannelRepository`
- `employeeRepository?: EmployeeRepository` → `employeeRepository: EmployeeRepository`
- `appSettingRepository?: AppSettingRepository` → `appSettingRepository: AppSettingRepository`
- `batchRunLogRepository?: BatchRunLogRepository` → `batchRunLogRepository: BatchRunLogRepository`
- `invitationLinkRepository?: InvitationLinkRepository` → `invitationLinkRepository: InvitationLinkRepository`

`security?` はリポジトリ DI とは別軸のため現状どおり省略可のまま残す。
`sessionStore?` も省略可のまま（本番ガードロジックはそのまま維持）。

### 2. テスト合成ヘルパ: `server/src/testing/createTestDeps.ts`

テストが `createApp` に渡す全依存を束ねるヘルパ関数を新設する。

```ts
// server/src/testing/createTestDeps.ts
export interface TestDepsOverrides { ... }
export async function createTestDeps(overrides?: TestDepsOverrides): Promise<AppDeps>
```

- 各リポジトリの InMemory 実装を生成して返す
- `overrides` で任意のリポジトリを上書き可能
- `userRepository` はデフォルトで `InMemoryUserRepository.createWithTestUser()` を使う
- `batchRunLogRepository` はデフォルトで `new InMemoryBatchRunLogRepository()` を返す

### 3. 本番・バッチ composition ヘルパ: `server/src/composition/createPrismaDeps.ts`

Prisma 実装一式を生成する共有ヘルパ関数を新設する。

```ts
// server/src/composition/createPrismaDeps.ts
import type { PrismaClient } from "@prisma/client";
export function createPrismaDeps(prisma: PrismaClient): AppDeps
```

- `server/src/server.ts` と `server/src/batch/index.ts`（および将来の他バッチエントリ）がこれを使う
- 各バッチは自分が必要なリポジトリのサブセットを取り出して使えばよい

### 4. 既存テストの移行

各ルートテストの `createApp({ messageRepository, userRepository?, ... })` のパターンを
`createApp(createTestDeps({ ... }))` のパターンに移行する。

ただし、各テストが個別に差し込んでいるリポジトリ（spy 対象やカスタムデータ入り）は
`overrides` で渡すことで個別 override を維持する。

### 5. ADR-0012 の決定を維持

- DI コンテナライブラリ（tsyringe / Inversify / Awilix 等）を一切導入しない
- `common` に `reflect-metadata` 等の DI 基盤を持ち込まない
- 手動 DI（poor man's DI）のまま composition 構造のみ整理する

## 責務分担

| モジュール | 責務 |
|-----------|------|
| `server/src/app.ts` | Express ルーティング配線のみ。どの実装を使うかの決定は一切しない |
| `server/src/composition/createPrismaDeps.ts` | 本番・バッチ用 Prisma 実装の生成 |
| `server/src/testing/createTestDeps.ts` | テスト用 InMemory 実装の生成 |
| `server/src/server.ts` | API プロセスの composition root（`createPrismaDeps` を使う） |
| `server/src/batch/index.ts` | バッチエントリの composition root（`createPrismaDeps` を使う） |

## リポジトリ追加時の変更箇所

新しいリポジトリを追加するとき変更するのは以下のみ:
1. `server/src/app.ts` の `AppDeps` 型に必須フィールドを追加
2. `server/src/composition/createPrismaDeps.ts` に Prisma 実装を追加
3. `server/src/testing/createTestDeps.ts` に InMemory 実装を追加

`createApp` 本体のフォールバック分岐を触る必要はない。
