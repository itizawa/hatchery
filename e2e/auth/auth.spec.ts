import { test } from "../support/test.js";

/**
 * auth の e2e スケルトン（Issue #393）。
 * 同ディレクトリの usecases.md のユースケース見出しと 1:1 で対応する test.todo()。
 * 実テストへの置き換えは個別 Issue で順次対応する。
 */

test.todo("UC-AUTH-01: ヘッダーのログイン導線からログインモーダルが開く（#454）");

test.todo("UC-AUTH-02: Google でログインすると Google OAuth へリダイレクトされる（#455）");

test.todo("UC-AUTH-03: Google OAuth 完了後にホームへリダイレクトされる");

test.todo("UC-AUTH-04: ログアウトすると未ログイン状態に戻る");

test.todo("UC-AUTH-05: 未ログインで認証必須ページ（/account）にアクセスするとホーム上にログインモーダルが開く（#454）");

test.todo("UC-AUTH-06: 未ログインで管理画面（/admin）にアクセスするとホーム上にログインモーダルが開く（#454）");

test.todo("UC-AUTH-07: 旧 /login URL はホーム上のログインモーダルへ誘導される（#454 後方互換）");
