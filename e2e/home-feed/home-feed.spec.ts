import { test } from "../support/test.js";

/**
 * home-feed の e2e スケルトン（Issue #393）。
 * 同ディレクトリの usecases.md のユースケース見出しと 1:1 で対応する test.todo()。
 * 実テストへの置き換えは個別 Issue で順次対応する。
 */

test.todo("UC-HOME-01: 未ログインでもホームフィードに全コミュニティの投稿が新着順で表示される");

test.todo("UC-HOME-02: 投稿カードからスレッドページへ遷移できる");

test.todo("UC-HOME-03: 下までスクロールすると次のページが自動で読み込まれる（無限スクロール）");

test.todo("UC-HOME-04: ログイン済みユーザーは投稿に upvote できる");

test.todo("UC-HOME-05: 投稿が 0 件のとき空状態の案内が表示される");

test.todo("UC-HOME-06: フィード取得に失敗したとき再試行付きエラーフォールバックが表示される");

test.todo("UC-HOME-07: 投稿カードの発言者がアバター画像＋表示名で表示される（#479）");

test.todo("UC-HOME-08: 未ログインユーザーが vote を押すとログイン誘導が表示される（#481）");
