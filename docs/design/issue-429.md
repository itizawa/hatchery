# 設計書: e2e post-thread エリアの test.todo 10 件を実テストに実装する (#429)

## 1. 目的 / 背景

`e2e/post-thread/post-thread.spec.ts` の `test.todo()` 10 件が未実装のまま。
投稿スレッド画面は 2 カラムレイアウト・up/down vote・vote クリック時のページ遷移抑止など
直近の修正が集中しており、e2e での回帰検知の価値が高い。

Issue 作成時点では 7 件だったが、その後 UC-POST-08〜10 が追加されて 10 件になっているため
すべて実装する。

## 2. スコープ（やること / やらないこと）

### やること
- `e2e/post-thread/post-thread.spec.ts` の `test.todo()` 10 件すべてを実テストに置き換える
- `page.route()` で API をモックし、バックエンドなしでブラウザ側の振る舞いを検証する

### やらないこと
- 他エリアの e2e テスト実装
- e2e の CI パイプライン組み込み

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. UC-POST-01: コメント付き post のスレッドページで post 本文・コメント一覧・「コメント N 件」が表示される
2. UC-POST-02: コメント 0 件の post では「コメント N 件」見出しが表示されない
3. UC-POST-03: ログイン済みで post に upvote すると score が+1 になる（楽観更新）
4. UC-POST-04: ログイン済みでコメントに upvote すると score が+1 になる（楽観更新）
5. UC-POST-05: スレッドページにテキスト入力欄とコメント送信ボタンが存在しない
6. UC-POST-06: 存在しない postId では「データの取得に失敗しました。」と「再試行」ボタンが表示される
7. UC-POST-07: post / コメントの発言者がアバター（または頭文字フォールバック）＋表示名で表示される
8. UC-POST-08: 未ログインで vote を押すと「投票するにはログインが必要です」スナックバーが表示される
9. UC-POST-09: md 以上の画面幅でサイドバーに所属コミュニティ詳細と購読ボタンが表示される
10. UC-POST-10: post / コメントに投稿時刻（相対時間）が `<time>` 要素で表示される

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- 先行実装の `e2e/home-feed/home-feed.spec.ts` / `e2e/community/community.spec.ts` と同じパターンを踏襲する
- `page.route()` で API をモックし、バックエンドなしでブラウザ側の振る舞いを検証する
- モックデータは各テストが共有する定数として定義する
- vote テスト（UC-POST-03・04）は楽観更新の即時反映を確認するため、
  vote API モック + スレッド再フェッチのモックをカウンタ方式で実装する

### 主要 API モック対象
- `**/api/auth/me` → 認証状態を制御
- `**/api/communities` → サイドバー用公開コミュニティ一覧
- `**/api/posts/{postId}` → スレッド（post + comments）
- `**/api/posts/{postId}/vote` → post への vote
- `**/api/comments/{commentId}/vote` → comment への vote
- `**/api/communities/{slug}/subscription` → 購読状態

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: e2e のみ
- `e2e/post-thread/post-thread.spec.ts`: `test.todo()` → `test()` に全件置き換え
- `e2e/post-thread/usecases.md`: 件数記載を 7 件→10 件に更新（テストと 1:1 対応させる）

## 6. テスト計画（TDD で書くテスト一覧）

UC-POST-01 〜 UC-POST-10 の 10 件（§3 と 1:1 対応）。
すべて `page.route()` モックを使ったブラウザテスト。

## 7. リスク・未決事項

- vote テストの楽観更新タイミング: `useVotePost` の `onMutate` で即時スコア更新するため、
  API モックが成功する前に score が変化する。これが UC-POST-03・04 の検証ポイント。
- UC-POST-09 のサイドバーは `display: { xs: "none", md: "block" }` のため、
  Desktop Chrome（1280x720）では表示される前提で検証する。
