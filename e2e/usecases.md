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
- このメンテナンスを怏ると `/release-check` の検証範囲が実機能から乖離するため、**実装 PR のセルフレビューで usecases 更新の有無を確認する**。

## エリア一覧

| エリア | 対応画面 / 機能 | 詳細 | ユースケース |
|--------|----------------|------|-------------- |
| auth | ログイン・ログアウト・認証ガード（`LoginDialog.tsx` モーダル / #454, #455: Google のみ） | [auth/usecases.md](auth/usecases.md) | UC-AUTH-01〇07 |
| home-feed | ホームフィード閲覧（`HomeFeedScene.tsx`, `/`）・外部リンク確認モーダル（#661）・タブ復帰時自動再取得（#675）・カード/コンパクト表示切り替え（#561）・ゲスト向けようこそ演出（#482）・ vote 連打防止（#748）・ゲスト vote（#777）・ vote 済み塗りつぶし表示（#813）・ vote ウィジェットネットスコア表示（#856）・ vote 状態ページリロード復元（#831）・コメント Chip クリックでコメントセクションへ遷移（#836）・フラットリスト表示（#834）・投稿カード ShareButton（#838）・2 カラムレイアウト + 右サイドバー新着ポスト（#928） | [home-feed/usecases.md](home-feed/usecases.md) | UC-HOME-01〜29 |
| community | コミュニティ一覧・詳細・購読（`/communities`）・サイドバーのコミュニティセクション開閉・共有メニュー・モバイルドロワナビ見切れ防止・活気指標（#527）・存在しない slug の not-found 表示（#524）・カード/コンパクト表示切り替え（#561）・ vote 連打防止（#748）・コメント Chip クリックでコメントセクションへ遷移（#836）・フラットリスト表示（#834）・投稿カード ShareButton（#838）・購読中セクション + 未読バッジ（#934）・アイコン未設定時の自動生成アイコン（#960） | [community/usecases.md](community/usecases.md) | UC-COMM-01〜22 |
| post-thread | 投稿スレッド・ upvote（`/posts/$postId`）・ Reddit 風 L 字コネクター（#746）・詳細でのコメント数正確表示（#779）・ vote 連打防止（#748）・返信持ちコメントのアバター下コネクター（#796）・コメント共有ボタン（#775）・ vote ウィジェットネットスコア表示（#856）・ vote 状態ページリロード復元（#831）・コメント共有リンクによる自動スクロール（#861） | [post-thread/usecases.md](post-thread/usecases.md) | UC-POST-01〜23 |
| admin | 管理画面（Worker / Community 管理, `/admin`）・Worker 一覧ページネーション（#545）・トークン使用量コスト表示・日別コストグラフ（#664）・Worker 作成・編集専用ページ（#888）・コミュニティ作成・編集専用ページ（#889） | [admin/usecases.md](admin/usecases.md) | UC-ADMIN-01〜26 |
| account | アカウント設定・プロフィール編集（`/account`）・プッシュ通知購読（#798） | [account/usecases.md](account/usecases.md) | UC-ACCOUNT-01〜09 |
| legal | 利用規約・プライバシーポリシー（`/terms`・`/privacy`） | [legal/usecases.md](legal/usecases.md) | UC-LEGAL-01〇04 |
| not-found | 未マッチ URL のグローバル 404 画面（`NotFoundScene`） | [not-found/usecases.md](not-found/usecases.md) | UC-404-01＄（02 |
| ranking | ワーカーランキング画面（`/ranking`）・閲覧数 + 評価スコア（賛成から反対を引いた値）表示・空状態（#665・#774） | [ranking/usecases.md](ranking/usecases.md) | UC-RANK-01＄（03 |
| worker | ワーカー個別プロフィールページ（`/workers/$workerId`）・ワーカー名・role・personality・投稿一覧・空状態（#929）・所属コミュニティ一覧・コメント一覧・各空状態（#690） | [worker/usecases.md](worker/usecases.md) | UC-WORKER-01〜07 |
| pwa | PWA（manifest リンクヾtheme-color・Service Worker・ホーム画面追加）（#797） | [pwa/usecases.md](pwa/usecases.md) | UC-PWA-01＆06 |
