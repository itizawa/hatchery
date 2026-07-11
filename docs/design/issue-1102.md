# 設計書: test: e2e/account の UC-ACCOUNT-05 を Playwright テストとして実装する (#1102)

## 1. 目的 / 背景

`e2e/account/account.spec.ts` には UC-ACCOUNT-01〜04 が実テストとして実装済みだが、UC-ACCOUNT-05（初回ログイン直後 `?welcome=1` の歓迎メッセージ表示）のみ `testWrapper.todo()` のまま取り残されている。

対象の機能自体は既に実装済みであることを確認した:

- `client/src/router.tsx`（`/account` ルート）が `validateSearch` で `welcome` クエリパラメータを `{ welcome?: boolean }` にパースする（`parseTruthySearchFlag` 使用）。
- `client/src/routes/AccountScene.tsx` L19 `useSearch({ from: "/account" })` で `welcome` を取得し、L67-71 で `welcome` が truthy のときのみ `Alert severity="info"`（「ようこそ Hatchery へ！まずは表示名を設定しましょう。」）を表示する。

したがって受け入れ条件 1（実装確認）は満たされており、条件 3（未実装の場合の切り出し）は該当しない。本 Issue は条件 2 の e2e テスト実装のみを行う。

## 2. スコープ（やること / やらないこと）

### やること
- `e2e/account/account.spec.ts` の `testWrapper.todo("UC-ACCOUNT-05: ...")` を実テストに置き換える。
- `?welcome=1` 付きで `/account` に遷移した場合に歓迎メッセージが表示されることを検証する。
- `?welcome=1` が付かない通常の `/account` 遷移では歓迎メッセージが表示されないことを検証する。

### やらないこと
- `AccountScene.tsx` / `router.tsx` 側の実装変更（既に実装済みのため不要）。
- `e2e/account/usecases.md` の UC-ACCOUNT-05 の記述変更（既存の記述が実装と一致しているため変更不要）。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `/account?welcome=1` へ遷移すると、アカウント設定フォーム上部に「ようこそ Hatchery へ！まずは表示名を設定しましょう。」という歓迎メッセージ（`Alert severity="info"`）が表示される。
2. `?welcome=1` を付けずに `/account` へ遷移した場合、上記の歓迎メッセージは表示されない。
3. `pnpm --filter e2e typecheck`（または該当 lint/typecheck）が緑であること。既存 UC-ACCOUNT-01〜04 のテストパターンを踏襲し、`setupAuthMocks` を再利用する。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

既存の UC-ACCOUNT-01〜04 と同じ Playwright テストパターンを踏襲する:

```ts
test("UC-ACCOUNT-05: 初回ログイン直後（?welcome=1）に表示名設定を促す歓迎メッセージが表示される", async ({ page }) => {
  await setupAuthMocks(page);

  await page.goto("/account?welcome=1");
  await expect(page.getByText("ようこそ Hatchery へ！まずは表示名を設定しましょう。")).toBeVisible();
});

test("UC-ACCOUNT-05b: ?welcome=1 が無い通常の /account 表示では歓迎メッセージが表示されない", async ({ page }) => {
  await setupAuthMocks(page);

  await page.goto("/account");
  await expect(page.getByText("ようこそ Hatchery へ！まずは表示名を設定しましょう。")).not.toBeVisible();
});
```

`testWrapper.todo()` の1行を上記2テストに置き換える（`test` は既存 import 済みの `@playwright/test` の `test`/`expect` をそのまま使う。`testWrapper` は他エリアで `todo` 未実装が残っている場合の共通ラッパーであり、実テストでは既存 UC-ACCOUNT-01〜04 と同様に素の `test` を使う）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: e2e）

| ワークスペース | ファイル | 変更内容 |
|--------------|---------|----------|
| e2e | `e2e/account/account.spec.ts` | `testWrapper.todo("UC-ACCOUNT-05: ...")` を実テスト2件に置き換え |

`client` / `server` / `common` への変更なし（対象機能は実装済みのため）。

## 6. テスト計画（TDD で書くテスト一覧）

1. `?welcome=1` 付きで歓迎メッセージが表示される（UC-ACCOUNT-05）
2. `?welcome=1` 無しで歓迎メッセージが表示されない（UC-ACCOUNT-05 の否定側・受け入れ条件2をカバー）

TDD の「まずテストを書き失敗を確認」は、本 Issue では対象実装が既に存在するため、テストを書いた時点で通常は green になる。ただし `testWrapper.todo()` → 実テスト化の差分自体をコミット前に一度実行し、モック設定の誤り等がないことを確認する（受け入れ条件を満たさない状態＝todo のまま、をテストの非存在で示す）。

## 7. リスク・未決事項

- Playwright の実行環境（ブラウザ）がこのセッションで利用可能か未確認。利用できない場合は静的な内容確認（テストコードのレビュー）にとどめ、PR 本文にその旨を明記する。
