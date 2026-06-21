# 設計書: e2e/home-feed の UC-HOME-15〜19 を Playwright テストとして実装する (#740)

## 1. 目的 / 背景

`e2e/home-feed/home-feed.spec.ts` の UC-HOME-15〜19 が `test.todo()` のまま未実装になっている。
これらはリリース判定（`/release-check`）で検証すべき機能であり、自動テストとして実装することで品質を担保する。

## 2. スコープ（やること / やらないこと）

### やること
- UC-HOME-15: タブ復帰時の自動再取得（refetchOnWindowFocus）テスト実装
- UC-HOME-16: コンパクト表示切り替えは **廃止済み**（Issue #811 で削除）のため `test.skip` に変更してコメントで廃止理由を明記
- UC-HOME-17: 未ログイン状態でようこそセクションが表示されるテスト実装
- UC-HOME-18: ログイン済み+投稿ありのときようこそセクションが非表示になるテスト実装
- UC-HOME-19: ログイン済み+投稿0件のときようこそセクションが表示されるテスト実装

### やらないこと
- 新規 UI の実装（e2e テスト実装のみ）
- UC-HOME-20、UC-HOME-21 の実装（スコープ外）
- コンパクト表示 UI の復元（廃止済み）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. UC-HOME-15: `page.evaluate` で `document.visibilityState` を変化させ、`visibilitychange` イベントを発火することでタブ復帰を疑似再現。フィード API が再度呼ばれた（またはデータが更新された）ことを確認する
2. UC-HOME-16: 廃止済み（Issue #811）のため `test.skip` に変更し、コメントで廃止理由を明記する
3. UC-HOME-17: 未ログイン（auth/me が 401）+ 投稿あり → ようこそセクション（「Hatchery へようこそ」見出し）が表示される
4. UC-HOME-18: ログイン済み（auth/me が 200）+ 投稿あり → ようこそセクションが**非表示**になる
5. UC-HOME-19: ログイン済み（auth/me が 200）+ フィードが空（投稿 0 件）→ ようこそセクションが表示される
6. `test.todo()` を実テスト（または廃止の場合 `test.skip`）に書き換え、`e2e/home-feed/usecases.md` の期待動作と整合する
7. `pnpm turbo run build lint test` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 参照実装パターン（既存の UC-HOME-01〜14 に従う）

- `page.route("**/api/xxx", ...)` で API をモック
- 認証状態は `page.route("**/api/auth/me", ...)` で制御
  - 未ログイン: 401 を返す（またはモックなし = デフォルト 404）
  - ログイン済み: 200 + ユーザー情報を返す
- `setupCommonMocks(page)` で共通モックを設定してから `page.goto("/")`

### UC-HOME-15（タブ復帰）

TanStack Query の `refetchOnWindowFocus: true`（`staleTime: 30_000`）を検証する。
Playwright の `page.evaluate` でブラウザ内から `document.hidden` を `false` に設定し、`visibilitychange` イベントを発火する手法を採用する。
ただし staleTime が 30 秒のため、「30 秒待つ」方法はテストに不適切。
代替手段: フィード API の呼び出し回数をカウントし、最初の goto + visibilitychange 後で 2 回以上呼ばれていることを確認する。

```typescript
// リクエストカウント方式
let feedRequestCount = 0;
await page.route("**/api/feed?*", (route) => {
  feedRequestCount++;
  return route.fulfill({ ... });
});
await page.goto("/");
// データが表示されるまで待機（初回フェッチ完了）
await expect(page.getByText(MOCK_POST.title)).toBeVisible();
// staleTime を 0 に強制できないため、visibilitychange で再取得をトリガー
// queryClient の staleTime をリセットするには難しいため、
// page.evaluate で document の hidden プロパティを操作し、visibilitychange を発火する
await page.evaluate(() => {
  Object.defineProperty(document, "hidden", { value: false, configurable: true, writable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});
// 1 回以上フェッチされていることを確認（初回最低1回）
expect(feedRequestCount).toBeGreaterThanOrEqual(1);
```

注記: staleTime 超過を待機する代わりに、ページ内の QueryClient にアクセスして staleTime を操作するか、初回ロード確認のみで refetchOnWindowFocus の設定確認を補完する（Playwright で QueryClient の内部にアクセスするのは困難なため、queryClient.ts のユニットテストで検証済みとして、e2e では「動作の外形確認」に留める）。

最終的なアプローチ: `page.evaluate` で `document.hidden` を `false` にセットして `visibilitychange` を発火。フィード API へのリクエスト数が 1 を超えることを確認する（staleTime が 30 秒なのでフォーカス直後は再取得されないケースもあり得るが、`page.clock.tick` を使って時間を進める方法を活用する）。

Playwright には `page.clock.tick()` / `page.clock.install()` API があり、これを使えば `Date.now()` や `setTimeout` を仮想的に進められる。
1. `await page.clock.install()` でタイマーを制御下に置く
2. `page.goto("/")` で初回表示
3. `await page.clock.tick(31_000)` で 31 秒進める（staleTime 超過）
4. `visibilitychange` イベントを発火
5. フィード再取得リクエストを確認

### UC-HOME-17〜19（ようこそセクション）

`HomeFeedScene.tsx` の `showWelcome = !user || !hasPosts` ロジックに対応する。
- UC-HOME-17（未ログイン）: `user` が `null/undefined` → `showWelcome = true`
- UC-HOME-18（ログイン済み+投稿あり）: `user` あり + `hasPosts = true` → `showWelcome = false`
- UC-HOME-19（ログイン済み+投稿なし）: `user` あり + `hasPosts = false` → `showWelcome = true`

確認対象: `page.getByRole("heading", { name: /Hatchery へようこそ/ })` の表示/非表示

## 5. 影響範囲 / 既存への変更

- `e2e/home-feed/home-feed.spec.ts`: UC-HOME-15,16,17,18,19 の test.todo を書き換え
- 新規ファイル: なし
- client/server/common/docs: 変更なし

## 6. テスト計画（TDD で書くテスト一覧）

| UC | テスト内容 | 検証ポイント |
|----|-----------|------------|
| UC-HOME-15 | タブ復帰時の再取得 | clock.tick で staleTime を超過後、visibilitychange でフィード API が再リクエストされる |
| UC-HOME-16 | 廃止（test.skip） | — |
| UC-HOME-17 | 未ログイン+投稿あり | ようこそセクション「Hatchery へようこそ」が visible |
| UC-HOME-18 | ログイン済み+投稿あり | ようこそセクションが hidden（not visible） |
| UC-HOME-19 | ログイン済み+投稿なし | ようこそセクション「Hatchery へようこそ」が visible |

## 7. リスク・未決事項

- UC-HOME-15（タブ復帰）: Playwright の `page.clock` は TanStack Query の `Date.now()` 内部呼び出しに効くかどうか環境依存の可能性あり。効かない場合は「リクエスト発生」の確認は省略し、「refetchOnWindowFocus の設定はユニットテスト済み（queryClient.test.ts）」として外形確認のみに留める方針を採る。
- UC-HOME-16: コンパクト表示は Issue #811 で廃止済み。`test.skip` として廃止理由をコメントで明記する。usecases.md の UC-HOME-16 エントリについては、廃止になっているため将来的に削除を検討すべきだが、本 Issue のスコープ外とする。
