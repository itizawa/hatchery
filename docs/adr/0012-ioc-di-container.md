# ADR-0012: IoC（DI コンテナ）導入検討と手動 DI の継続

- ステータス: Accepted
- 日付: 2026-06-05
- 関連 Issue: #93

## コンテキスト（背景）

`server/src/app.ts` の `createApp(deps: AppDeps)` は、各リポジトリを引数で受け取り
`deps.channelRepository ?? new InMemoryChannelRepository()` のように**手動のコンストラクタ注入（poor man's DI）**で依存を解決している。

Issue が進むにつれリポジトリ・ユースケースが増え、現時点で `AppDeps` には 7 種のリポジトリが並ぶ。

```
messageRepository（必須）
userRepository, channelMembershipRepository, channelRepository,
employeeRepository, appSettingRepository, batchRunLogRepository（省略可）
```

これらの省略可フィールドは InMemory 実装をデフォルトとして `createApp` 内でフォールバックしており、テスト時は InMemory、本番時は Prisma 実装を明示的に注入する設計となっている。

### 現状の課題

- `AppDeps` の型定義が大きくなり、フィールドを追加するたびに `createApp` と `server.ts` の両方を修正する必要がある
- InMemory デフォルト生成ロジックが `createApp` の中に分散している
- バッチエントリポイント（`server/src/batch/`）は別プロセスで、同じリポジトリを別途インスタンス化している

### 制約（ADR-0001 / ADR-0005）

- `client → common` / `server → common` の一方向依存（ADR-0001）。DI コンテナは `server` 内に閉じる必要がある
- `common` は実行環境非依存の純粋 TypeScript（ADR-0005）。`reflect-metadata` 等のデコレータ基盤を `common` に持ち込んではならない

---

## 決定

**IoC/DI コンテナは導入せず、現状の手動 DI（poor man's DI）を継続する。**

`server.ts`（本番起動エントリ）が Prisma 実装を生成して `createApp` に渡す既存の構成を「事実上の composition root」として認め、現状維持とする。

**対応実装 Issue は起票しない**（設計変更・コード修正は本決定では不要）。

---

## 理由

1. **composition root が既に存在する**: `server.ts` は `PrismaXxxRepository` を生成して `createApp` に渡す本番用 composition root として機能している（`createApp` 内の `??` フォールバックはテスト用の InMemory 実装で、テスト容易性を担保する設計上の意図）。コンテナを導入しても現状以上の集約にはならない。

2. **テスト容易性が高い**: 現行の `createApp(deps)` パターンは `supertest` + InMemory 実装の組み合わせで API 単体テストが書きやすく、モック差し替えも直感的。DI コンテナを導入してもこの容易性が向上するわけではない。

3. **ADR-0005 との整合**: tsyringe・InversifyJS はデコレータ + `reflect-metadata` を必要とし、`tsconfig.json` に `"experimentalDecorators": true` / `"emitDecoratorMetadata": true` が必要。これらは `common` の純粋性制約には直接抵触しないが、設定変更が monorepo 全体に波及するリスクがある。

4. **規模に対して過剰**: MVP は `server` 内のリポジトリ数が有限（現時点 7 種）で増加は緩やか。コンテナ導入のボイラープレート・魔術性・学習コストがメリットを上回る。

5. **Awilix（デコレータ不要）も費用対効果が低い**: デコレータ不要で関数 DI 寄りの Awilix は ADR-0005 への影響が小さいが、`AWILIX_AUTO_REGISTER` 等の命名規約魔術や独自コンテナ型を学習するコストが現状の明示的な引数注入より読みにくい。

---

## 検討した代替案

- **案A: 現状維持（採用）**: `createApp(deps: AppDeps)` に手動で実装を注入し続ける。`server.ts` が composition root として機能する。採用理由は上記「理由」のとおり。

- **案B: DI コンテナ導入（tsyringe / InversifyJS）**: デコレータベース。`reflect-metadata` 必要。ADR-0005 の純粋性制約との整合リスクがある。MVP 規模に対して過剰。**採用しない。**

- **案C: DI コンテナ導入（Awilix）**: デコレータ不要の関数 DI。`server` 内に閉じられるため ADR-0001/0005 への影響は最小。ただし Awilix 独自の API・命名規約の学習コストが必要で、現状の明示的引数注入より見通しが悪くなる。**採用しない。**

- **案D: Composition root の整理のみ（コンテナなし）**: `createApp` の InMemory デフォルト生成を呼び出し側に移し、`createApp` を依存がすべて必須の純粋なファクトリに整理する。将来の拡張には有効だが、決定当時は顕在化した問題はなかった。**→ その後 #137・#290 で採用済み（後述「補遺」参照）。**

---

## 影響（結果）

- **良い影響**: 追加コスト・ライブラリ依存がなく、既存のテストパターンがそのまま維持される
- **トレードオフ**: `AppDeps` はリポジトリ追加のたびに型を更新する必要がある（IoC コンテナを入れない以上、この課題は残る）
- **フォローアップ（解消済み）**: 当初「リポジトリ数が 10 以上に増えるか、バッチとサーバで配線の重複が顕著になった時点で案D（composition root 整理）を再評価する」としていた。実際にリポジトリが増え配線重複が顕在化したため、#137・#290 で案D を採用し再評価を完了した（IoC コンテナ不採用の本決定は維持）。

---

## 補遺: 案D の採用（#137・#290）

本決定（IoC/DI コンテナ不採用・手動 DI 継続）は維持しつつ、フォローアップに残していた **案D（composition root 整理）を採用した**。コンテナは導入せず、手動 DI のまま composition root を整理しただけなので、本 ADR の決定そのものとは矛盾しない。

- **#137**: 本番用 composition root を `server/src/composition/createPrismaDeps.ts` に集約し、`server.ts`・`batch/index.ts`・`batch/summaryIndex.ts` がこれを共有。Prisma リポジトリの二重インスタンス化を解消。テスト用の InMemory 合成ヘルパ `server/src/testing/createTestDeps.ts` も導入。
- **#290**: `createApp` から InMemory デフォルト生成（`?? new InMemoryX()`）を撤去し、`AppDeps` の全リポジトリフィールドを必須化。`createApp` は「受け取った依存をそのまま配線するだけ」の純粋ファクトリになった。どの実装を使うかの決定は呼び出し側（`createPrismaDeps` / `createTestDeps`）に一元化された。

結果として、依存の選択と生成は composition root（`createPrismaDeps` / `createTestDeps`）に集約され、`createApp` は実装非依存の純粋ファクトリとなった。挙動・HTTP 契約は不変（純粋リファクタ）。
