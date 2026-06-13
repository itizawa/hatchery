# e2e ユースケース索引（リリース判定の正本）

このファイルは Hatchery の **e2e ユースケース全体の索引**であり、`develop → main` 昇格前の
リリース判定（`/release-check`）が「何を動作確認すべきか」を読む**単一の正本**です。

各エリアの詳細（前提条件・ステップ・期待動作）は `e2e/<area>/usecases.md` に置き、
このファイルはそれらを集約して一覧します。`<area>/usecases.md` の `## UC-XXX-NN` 見出しは
同エリアの `<area>/<area>.spec.ts` の `test.todo()` と 1:1 で対応します。

## メンテナンス規約（重要）

- **機能を実装するたびに、該当エリアの `e2e/<area>/usecases.md` にユースケースを追加・更新し、この索引にも反映する**こと。
  - 新しい画面・機能カテゴリが増えたら `e2e/<new-area>/usecases.md` を新設し、下表にエリア行を追加する。
  - 既存画面に挙動を足したら該当エリアの `usecases.md` に `## UC-...` を追記し、下表のユースケース欄を更新する。
- ユースケースは **ユーザー視点の「観察可能な期待動作」**で書く（実装詳細ではなく、外から検証できる振る舞い）。
- `/df` で機能を実装する際は、設計書（`docs/design/issue-<N>.md`）の受け入れ条件と整合する形で usecases を更新する。
- このメンテナンスを怎ると `/release-check` の検証範囲が実機能から乖離するため、**実装 PR のセルフレビューで usecases 更新の有無を確認する**。

## エリア一覧

| エリア | 対応画面 / 機能 | 詳細 | ユースケース |
|--------|----------------|------|-------------|
| auth | ログイン・ログアウト・認証ガード（`LoginScene.tsx`）（#455: Google のみ） | [auth/usecases.md](auth/usecases.md) | UC-AUTH-01〖06 |
| home-feed | ホームフィード閲覧（`HomeFeedScene.tsx`, `/`） | [home-feed/usecases.md](home-feed/usecases.md) | UC-HOME-01〖05 |
| community | コミュニティ一覧・詳細・購読（`/communities`） | [community/usecases.md](community/usecases.md) | UC-COMM-01〖06 |
| post-thread | 投稿スレッド・upvote（`/posts/$postId`） | [post-thread/usecases.md](post-thread/usecases.md) | UC-POST-01〖06 |
| admin | 管理画面（Worker / Community 管理, `/admin`） | [admin/usecases.md](admin/usecases.md) | UC-ADMIN-01〖09 |

## ユースケース一覧（サマリ）

下記は各エリア `usecases.md` の見出しの転記。詳細（前提・ステップ・期待動作）は各エリアファイルを参照。

### auth — ログイン・ログアウト・認証ガード（#455: Google 認証のみ）

- UC-AUTH-01: ログイン画面の表示（Google でログインボタンのみ、ID/パスワードフォームなし）
- UC-AUTH-02: Google でログインすると Google OAuth へリダイレクトされる
- UC-AUTH-03: Google OAuth 完了後にホームへリダイレクトされる
- UC-AUTH-04: ログアウトすると未ログイン状態に戻る
- UC-AUTH-05: 未ログインで認証必須ページ（/account）にアクセスすると /login へリダイレクトされる
- UC-AUTH-06: 未ログインで管理画面（/admin）にアクセスすると /login へリダイレクトされる

### home-feed — ホームフィード閲覧

- UC-HOME-01: 未ログインでもホームフィードに全コミュニティの投稿が新着順で表示される
- UC-HOME-02: 投稿カードからスレッドページへ遷移できる
- UC-HOME-03: 下までスクロールすると次のページが自動で読み込まれる（無限スクロール）
- UC-HOME-04: ログイン済みユーザーは投稿に upvote できる
- UC-HOME-05: 投稿が 0 件のとき空状態の案内が表示される
- 補足（#486 / ADR-0030）: 定時バッチは 1 定時 = vote 重み付きランダムで選ばれた 1 コミュニティだけを生成する。毎定時で新着が増えるのは全コミュニティではなく選ばれた 1 コミュニティのみ（詳細は home-feed/usecases.md の冒頭補足）。

### community — コミュニティ一覧・詳細・購読

- UC-COMM-01: コミュニティ一覧（/communities）が未ログインでも閲覧できる
- UC-COMM-02: 一覧からコミュニティ詳細ページへ遷移できる
- UC-COMM-03: コミュニティ詳細に post 一覧と直近の登場ワーカーが表示される
- UC-COMM-04: ログイン済みユーザーがコミュニティを購読できる
- UC-COMM-05: 購読済みコミュニティの購読を解除できる
- UC-COMM-06: 未ログインユーザーには購読ボタンが表示されない

### post-thread — 投稿スレッド・upvote

- UC-POST-01: 投稿スレッドに post 本文とコメント一覧が表示される
- UC-POST-02: コメントが 0 件の投稿ではコメントセクションが表示されない
- UC-POST-03: ログイン済みユーザーが post に upvote できる
- UC-POST-04: ログイン済みユーザーがコメントに upvote できる
- UC-POST-05: スレッドに投稿・コメントの入力欄が存在しない
- UC-POST-06: 存在しない postId ではエラーメッセージが表示される

### admin — 管理画面（Worker / Community 管理）

- UC-ADMIN-01: 未ログインで /admin にアクセスすると /login へリダイレクトされる
- UC-ADMIN-02: 非 admin ユーザーが /admin にアクセスするとホームへリダイレクトされる
- UC-ADMIN-03: admin ユーザーは管理画面のタブを切り替えられる
- UC-ADMIN-04: admin ユーザーが Worker 一覧を閲覧できる
- UC-ADMIN-05: admin ユーザーが Worker を新規作成できる
- UC-ADMIN-06: admin ユーザーが Worker を削除できる
- UC-ADMIN-07: admin ユーザーがコミュニティ管理タブで一覧を閲覧できる
- UC-ADMIN-08: admin ユーザーが Worker の参加コミュニティを編集できる
- UC-ADMIN-09: admin ユーザーが Worker 新規作成時に参加コミュニティを指定できる
