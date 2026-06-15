# 設計書: e2e home-feed エリアの test.todo を実テストに実装する (#427)

## 1. 目的 / 背景

`e2e/home-feed/home-feed.spec.ts` に定義されたスケルトン（`test.todo()`）を実テストへ置き換え、
ホームフィード表示・無限スクロール・ゲスト閲覧・vote 誘導・空状態・エラーフォールバックのリグレッションを継続的に検知できるようにする。

Issue 起票時点の `test.todo()` は 6 件（UC-HOME-01〜06）だったが、その後 UC-HOME-07〜12（UC-HOME-10 除く）が追加され現在 11 件になっている。
本 Issue の受け入れ条件（"6 件すべて"）を満たしつつ、既存の 11 件すべてを実テスト化する。

## 2. スコープ（やること / やらないこと）

### やること
- `e2e/home-feed/home-feed.spec.ts` の全 `test.todo()` 11 件を実テストに置き換える。
- `page.route()` で API をモックし、バックエンド不要でブラウザ側の振る舞いを検証する。

### やらないこと
- 他エリア（community / post-thread / admin 等）の e2e 実装（別 Issue 担当）。
- CI パイプラインへの e2e 組み込み（別 Issue 担当）。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `test.todo()` が 0 件になること（全 11 件が実テスト `test(...)` に置き換わる）。
2. 無限スクロール（UC-HOME-03）でページ 2 が自動読み込みされることを検証すること。
3. `page.route()` でモックし、テストが実行順に依存しないこと。
4. `pnpm exec playwright test e2e/home-feed` が安定して緑。

## 4. 設計方針

### モック戦略
- auth.spec.ts と同じく `page.route()` で全 API をインターセプト。
- `/api/auth/me`、`/api/communities`、`/api/feed`、`/api/posts/*/vote` をモック。
- 認証状態の切り替えは auth.spec.ts と同じ closure 方式。
- 無限スクロールは feed 呼び出し回数でページを切り替える closure 方式。

### 無限スクロール（UC-HOME-03）
- `page.evaluate()` で main 要素を `scrollTop = scrollHeight` する。
- IntersectionObserver の感度は `threshold: 0.1`。Playwright headless Chrome でも動作する。
- スクロール後、`page.waitForFunction()` で投稿件数が増えるまで待機する。

### vote の楽観更新（UC-HOME-04）
- `useVotePost` の optimistic update は `postThreadQueryKey` のみ更新。
- ホームフィードのスコアは `onSettled` 後の re-fetch で更新される。
- テストでは feed の 2 回目のレスポンスに更新スコアを返し、再レンダリングを検証する。

## 5. 影響範囲 / 既存への変更

- `e2e/home-feed/home-feed.spec.ts`（書き換え）
- それ以外のワークスペース（client / server / common）への変更なし。

## 6. テスト計画

| # | ユースケース | 主な検証観点 |
|---|------------|------------|
| UC-HOME-01 | 未ログインでもフィード閲覧可能 | 投稿タイトルが表示される |
| UC-HOME-02 | 投稿カードからスレッド遷移 | URL が /posts/{id} になる |
| UC-HOME-03 | 無限スクロール | ページ 2 の投稿が追加表示される |
| UC-HOME-04 | ログイン済みの upvote | スコアが更新される |
| UC-HOME-05 | 投稿 0 件の空状態 | "まだ投稿がありません。" が表示される |
| UC-HOME-06 | フィード取得失敗 | エラー文・再試行ボタンが表示される |
| UC-HOME-07 | 発言者アバター＋表示名 | 表示名が生の author 文字列でなく worker 名で表示される |
| UC-HOME-08 | 未ログインの vote でログイン誘導 | スナックバー "投票するにはログインが必要です" |
| UC-HOME-09 | コメント数表示 | 💬 N が表示される |
| UC-HOME-11 | 相対時刻表示 | 時刻要素（`<time>`）が表示される |
| UC-HOME-12 | 所属コミュニティ名表示 | c/slug が表示され、クリックでコミュニティページへ遷移 |

## 7. リスク・未決事項

- UC-HOME-03（無限スクロール）: `IntersectionObserver` は Playwright headless Chrome で動作するが、
  CI 環境によっては `waitForFunction` のタイムアウトが必要な場合がある。
- UC-HOME-11（相対時刻）: システム時刻に依存しないよう、`created_at` を数時間前に固定して
  "N時間前" 相当のラベルが出ることを確認する。
