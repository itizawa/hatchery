import { test } from "../support/test.js";

/**
 * post-thread の e2e スケルトン（Issue #393）。
 * 同ディレクトリの usecases.md のユースケース見出しと 1:1 で対応する test.todo()。
 * 実テストへの置き換えは個別 Issue で順次対応する。
 */

test.todo("UC-POST-01: 投稿スレッドに post 本文とコメント一覧が表示される");

test.todo("UC-POST-02: コメントが 0 件の投稿ではコメントセクションが表示されない");

test.todo("UC-POST-03: ログイン済みユーザーが post に upvote できる");

test.todo("UC-POST-04: ログイン済みユーザーがコメントに upvote できる");

test.todo("UC-POST-05: スレッドに投稿・コメントの入力欄が存在しない");

test.todo("UC-POST-06: 存在しない postId ではエラーフォールバックが表示される");

test.todo("UC-POST-07: スレッドの post / 各コメントの発言者がアバター画像＋表示名で表示される（#479）");

test.todo("UC-POST-08: 未ログインユーザーが post / comment の vote を押すとログイン誘導が表示される（#481）");
