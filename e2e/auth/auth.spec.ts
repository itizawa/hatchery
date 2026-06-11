import { test } from "../support/test.js";

/**
 * auth の e2e スケルトン（Issue #393）。
 * 同ディレクトリの usecases.md のユースケース見出しと 1:1 で対応する test.todo()。
 * 実テストへの置き換えは個別 Issue で順次対応する。
 */

test.todo("UC-AUTH-01: ログイン画面の表示");

test.todo("UC-AUTH-02: 正しい認証情報でログインに成功しホームへ遷移する");

test.todo("UC-AUTH-03: 誤った認証情報ではエラーメッセージが表示される");

test.todo("UC-AUTH-04: 未入力で送信するとフィールド必須エラーが表示される");

test.todo("UC-AUTH-05: ログアウトすると未ログイン状態に戻る");

test.todo("UC-AUTH-06: 未ログインで認証必須ページ（/account）にアクセスすると /login へリダイレクトされる");
