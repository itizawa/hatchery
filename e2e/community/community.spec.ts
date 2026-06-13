import { test } from "../support/test.js";

/**
 * community の e2e スケルトン（Issue #393）。
 * 同ディレクトリの usecases.md のユースケース見出しと 1:1 で対応する test.todo()。
 * 実テストへの置き換えは個別 Issue で順次対応する。
 */

test.todo("UC-COMM-01: コミュニティ一覧（/communities）が未ログインでも閲覧できる");

test.todo("UC-COMM-02: 一覧からコミュニティ詳細ページへ遷移できる");

test.todo("UC-COMM-03: コミュニティ詳細に post 一覧と直近の登場ワーカーが表示される");

test.todo("UC-COMM-04: ログイン済みユーザーがコミュニティを購読できる");

test.todo("UC-COMM-05: 購読済みコミュニティの購読を解除できる");

test.todo("UC-COMM-06: 未ログインユーザーには購読ボタンが表示されない");

test.todo("UC-COMM-07: コミュニティ詳細が Reddit 風ヘッダー（カバー＋重ねたアイコン＋name）で表示される");

test.todo("UC-COMM-08: コミュニティ詳細の最近の登場ワーカー取得に失敗してもページ本体は表示される");
