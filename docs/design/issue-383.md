# Issue #383: communityBatchIndex（定時バッチのエントリポイント）のテストを追加する

- Issue: https://github.com/itizawa/hatchery/issues/383
- 関連 ADR: ADR-0009（定時バッチ方式）、ADR-0018（community 単位生成）、ADR-0020

## 背景 / 課題

`server/src/batch/communityBatchIndex.ts` は定時バッチの CLI エントリポイントだが、現状は以下の構造でテスト不可能だった。

- `main()` がモジュール内 private で、モジュールロード時に即実行される（import しただけで実行される）。
- `prismaClient.ts`（`new PrismaClient()` の値 import）をトップレベルで静的 import しており、テストから import すると `prisma generate` 未実行の CI 環境で `@prisma/client did not initialize yet` で落ちる。

## 設計判断

### 1. テスト可能なエントリ関数 `runCommunityBatchCli` を公開する

依存注入で完結する薄いエントリ関数を切り出して export する。

```ts
export interface CommunityBatchCliDeps {
  /** runCommunityBatch に渡す依存一式（テストでは InMemory リポジトリ + スタブ generate を注入） */
  batchDeps: RunCommunityBatchDeps;
  /** 終了時に必ず呼ぶ後始末（本番では prisma.$disconnect） */
  disconnect: () => Promise<void>;
}

export async function runCommunityBatchCli(
  cliDeps: CommunityBatchCliDeps,
): Promise<RunCommunityBatchResult>;
```

- `runCommunityBatch` の呼び出し・完了ログ出力・`finally` での `disconnect` 呼び出しがエントリ層の責務。
- 「community ごとの走査・1 件失敗時の継続・0 件時の正常終了」は `runCommunityBatch` の実装だが、エントリ関数経由（実物の `runCommunityBatch` + スタブ依存）で検証することで配線ごと固める。

### 2. 直接実行ガード + prisma の遅延 import

- `main()` は `import.meta.url === pathToFileURL(process.argv[1]).href` のときのみ起動する（`tsx src/batch/communityBatchIndex.ts` での直接実行時）。テストからの import では実行されない。
- `prismaClient.ts` は `main()` 内で動的 import する。これにより本モジュールを import するテストは `@prisma/client` の値ロードを発生させない（turbo test は prisma generate に依存しない罠への対策）。
- Prisma リポジトリファクトリ群は `import type { PrismaClient }` のみで値ロードしないため、静的 import のままで安全。
- エラー時に `process.exitCode = 1` を設定する挙動（`main().catch`）は従来どおり。

## テスト設計（受け入れ条件 → テストケース）

`server/src/batch/communityBatchIndex.test.ts`（Anthropic SDK・DB へ実アクセスしない）:

1. 複数 community があるとき、`generate`（スタブ生成器）が community ごとに 1 回ずつ呼ばれ、生成結果が永続化される。
2. 1 つの community の生成が reject しても、他の community の処理は継続される（runCommunityBatch の per-community catch を配線ごと検証）。エントリ関数は正常 resolve する。
3. 対象 community が 0 件のとき、エラーにせず空の結果で正常終了する。
4. 正常終了時・`runCommunityBatch` 相当が throw した場合のどちらでも `disconnect` が必ず 1 回呼ばれる（`finally` の検証）。throw 時はエントリ関数も reject する。
5. モジュールを import しただけではバッチが実行されない（直接実行ガード）。

## スコープ外

- `aiMessageGenerator.ts` の実 API テスト（Issue 記載どおり対象外）。
- cron の時刻計算（`schedule.test.ts` の責務）。
