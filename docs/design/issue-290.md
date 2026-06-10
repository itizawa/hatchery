# 設計書: composition root を集約し createApp を依存必須の純粋ファクトリにする（ADR-0012 案D） (#290)

## 1. 目的 / 背景

ADR-0012 は手動 DI 継続を採用しつつ、**案D（composition root 整理）**を「リポジトリ増加 or サーバ/バッチの配線重複が顕著になった時点で再評価する」とフォローアップに残していた。

Issue #137 で `createPrismaDeps`（Prisma 配線の単一情報源）と `createTestDeps`（テスト用 InMemory 合成ヘルパ）は既に導入済みで、`server.ts` / `batch/index.ts` / `batch/summaryIndex.ts` の Prisma 配線重複は解消済み。

残る案D 未達の点は **`createApp` 内に残る InMemory デフォルト生成（`?? new InMemoryX()`）** で、`AppDeps` の community / post / comment / subscription / vote / worldState の 6 フィールドが省略可（`?`）のまま `createApp` 内でフォールバックしている。本 Issue でこれを解消し `createApp` を「依存がすべて必須の純粋ファクトリ」に整理する。

## 2. スコープ（やること / やらないこと）

### やること

- `AppDeps` の 6 つの省略可リポジトリフィールド（community / post / comment / subscription / vote / worldState）を**必須化**する。
- `createApp` から `?? new InMemoryX()` フォールバック（6 行）と、それに伴って不要になる InMemory import を**除去**する。
- `createTestDeps` がこれら 6 リポジトリの InMemory 実装も必ず返すようにする（フォールバック撤去後もテストが成立するため）。
- ADR-0012 の「決定 / 影響（結果）/ フォローアップ」を**案D 採用**に更新する。

### やらないこと

- IoC コンテナ導入（ADR-0012 で不採用のまま）。
- #288（リポジトリの関数ファクトリ化）— 本 Issue はクラスのままで成立する純粋リファクタ。
- Prisma 配線モジュールの新規作成（既に `createPrismaDeps` に集約済み・受け入れ条件3は達成済み）。
- HTTP 契約・公開 API・挙動の変更。client / common の変更。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `AppDeps` の `communityRepository` / `postRepository` / `commentRepository` / `subscriptionRepository` / `voteRepository` / `worldStateRepository` が**必須**（`?` なし）になっている。→ 型レベル: `createApp` がこれら省略時に型エラー（コンパイルで担保。`tsc` build が緑であること）。
2. `createApp` 内に `?? new InMemoryX()` フォールバックが 1 つも残っていない（grep で 0 件）。
3. `createTestDeps()` の戻り値が上記 6 リポジトリすべてを含む（テスト: 各フィールドが定義済みであること）。
4. `createApp(createTestDeps())` で生成したアプリの既存ルート（communities / posts / feed）が従来どおり 2xx/期待挙動を返す（既存の routes テストが緑のまま）。
5. `createPrismaDeps(prisma)` が上記 6 リポジトリすべてを Prisma 実装で返す（既存・回帰確認）。
6. `pnpm turbo run build test lint`（server 範囲）が緑。一方向 import 境界（server → common）を維持。
7. ADR-0012 が案D 採用に更新されている（ステータス / 決定 / 影響）。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **`AppDeps`（`server/src/app.ts`）**: 6 フィールドの `?` を外して必須化。コメントの「省略時は空の InMemory 実装」表現を「必須・呼び出し側が注入」へ更新。
- **`createApp`（`server/src/app.ts`）**: `const communityRepo = deps.communityRepository ?? new InMemoryCommunityRepository()` などのフォールバック 6 行を `deps.xxxRepository` の直接参照に置換。未使用になる 6 つの InMemory import を削除。
- **`createTestDeps`（`server/src/testing/createTestDeps.ts`）**: post / comment / subscription / vote / worldState の InMemory 実装を追加注入（community は既に入っている）。これがテスト用 InMemory 合成ファクトリ（受け入れ条件2 のヘルパに該当）。
- **`createPrismaDeps`**: 既に 6 リポジトリすべてを返しているため変更不要（回帰テストで担保）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / server / common / docs）

- **server**: `src/app.ts`（AppDeps 必須化・フォールバック/import 除去）、`src/testing/createTestDeps.ts`（6 リポジトリ追加）。
- **docs**: `docs/adr/0012-ioc-di-container.md`（案D 採用へ更新）、本設計書。
- **client / common**: 変更なし。

## 6. テスト計画（TDDで書くテスト一覧）

`server/src/testing/createTestDeps.test.ts` に追記:

- `createTestDeps()` が `postRepository` / `commentRepository` / `subscriptionRepository` / `voteRepository` / `worldStateRepository` を返す（各 `toBeDefined()`）。

`server/src/app.composition.test.ts` に追記:

- `createApp(createTestDeps())` で生成したアプリが community/post 系のルートで起動・応答する（既存 routes テスト群が回帰として機能。必要なら最小の起動確認を追加）。

InMemory フォールバック除去後も既存の全 routes テスト（communities / posts / feed 等）が緑であることを回帰として確認する。

## 7. リスク・未決事項

- フォールバック除去により、`createTestDeps` を経由せず手書きで deps を組んでいるテストがあると型エラーになる。→ 全 routes テストは `createTestDeps()` 経由のため影響なし（事前確認済み）。万一あれば `createTestDeps()` へ寄せる。
- 挙動は不変（InMemory 実装は createTestDeps が同じものを供給）。回帰は既存テストで担保。
