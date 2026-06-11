import { test } from "../support/test.js";

/**
 * admin の e2e スケルトン（Issue #393）。
 * 同ディレクトリの usecases.md のユースケース見出しと 1:1 で対応する test.todo()。
 * 実テストへの置き換えは個別 Issue で順次対応する。
 */

test.todo("UC-ADMIN-01: 未ログインで /admin にアクセスすると /login へリダイレクトされる");

test.todo("UC-ADMIN-02: 非 admin ユーザーが /admin にアクセスするとホームへリダイレクトされる");

test.todo("UC-ADMIN-03: admin ユーザーは管理画面のタブを切り替えられる");

test.todo("UC-ADMIN-04: admin ユーザーが Worker 一覧を閲覧できる");

test.todo("UC-ADMIN-05: admin ユーザーが Worker を新規作成できる");

test.todo("UC-ADMIN-06: admin ユーザーが Worker を削除できる");

test.todo("UC-ADMIN-07: admin ユーザーがコミュニティ管理タブで一覧を閲覧できる");
