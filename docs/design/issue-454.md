# Issue #454 設計: ログインをモーダル表示にしてページ遷移せずログインできるようにする

## 背景と現状の差分

Issue 起票時点では ID/パスワード + Google ログインの併用を前提にしていたが、その後 **#455 でログインは Google 認証のみに統一**された。現行 `client/src/routes/LoginScene.tsx` は Google ログインボタン 1 つだけの presentational コンポーネントで、

- `LOGIN_ID_MAX_LENGTH` / `PASSWORD_MAX_LENGTH` を使う入力フォーム
- `login()` ミューテーション・認証失敗エラー表示
- `AcceptInvitationScene.tsx`（#455 で削除済み）

は **存在しない**。よって受け入れ条件のうちフォーム入力・`@tanstack/react-form` での状態管理・`AcceptInvitationScene` 更新は **対象が消滅**しているため、Issue の本質（「ページ遷移せず、閲覧コンテキストを保ったままログインできる」）に沿って次のように再解釈する。

- LoginDialog は「Google でログイン」ボタンと案内文をモーダル化したもの（入力フィールドが無いため `useForm` 不要・`.max()` 対象のユーザー入力フィールドも無い）。
- `AcceptInvitationScene` の更新は対象外（既に存在しない）。

この再解釈と理由を本設計書に記録する（Issue 補足「設計判断のポイントを /df が確定する」に対応）。

## 受け入れ条件 → 入出力（再解釈後）

| AC | 内容 | 本実装での扱い |
|----|------|----------------|
| 1 | `LoginDialog.tsx` 新規作成・ログイン機能を `Dialog` に移植 | Google ログインボタン + 案内文を `Dialog`(`DialogTitle`/`DialogContent`/`DialogActions`) に移植。入力フィールドが無いため `useForm`/`.max()` は適用不要 |
| 2 | 新規グローバル状態ライブラリを入れず URL 駆動で開閉 | root ルートに `validateSearch` で `login` search param を追加（`?login=1` で開、`useSearch`/`useNavigate` で開閉）。リロード/リダイレクトで復元可能 |
| 3 | `AppHeader`・`LandingScene` の導線をモーダル開に変更・背景保持 | `/login` 遷移をやめ、現在パスを保ったまま `search: { login: 1 }` を付与して開く。テストで背景コンテンツ保持を検証 |
| 4 | 認証ガード未認証時の導線維持 | `requireAuth`/`requireAdminRoute` の `redirect({ to: "/login" })` を `redirect({ to: "/", search: { login: 1 } })` に置換。遷移先（公開ホーム）でモーダルが開く |
| 5 | 成功後モーダルが閉じ認証反映 | Google OAuth は全画面遷移で完結→戻り時は認証済み。モーダル状態は URL search param なので、ログイン後の遷移先 URL に `login` を含めないことで閉じる。`useAuth`(=`AUTH_ME_QUERY_KEY`) で UI 更新 |
| 6 | `/login` 直接参照箇所の整合・リンク切れ無し | `/login` ルートは残し、アクセス時 `/?login=1` へ `redirect` する後方互換にする（ブックマーク・OAuth 失敗時遷移などの dead link 防止） |
| 7 | テスト・Storybook を新コンポーネントに合わせ更新 | `LoginScene.test.tsx`→ガード/`/login`リダイレクト/モーダル開閉の検証に更新、`LoginDialog.test.tsx` 新設、`LoginScene.stories.tsx`→`LoginDialog.stories.tsx` 新設 |
| 8 | client 内完結・import 境界 | client のみ変更。common への依存も増やさない（Google ボタンのみ） |
| 9 | build/test/lint 緑 | CI で担保 |

## 方式の選定

**設計判断①（ルートを残すか純モーダルか）**: `/login` ルートは「廃止せず、`/?login=1` への redirect に変える」。理由: ブックマーク・OAuth コールバックの失敗時フォールバック・既存リンクの後方互換を保ちつつ、実体はモーダル駆動へ一本化できる（dead link を作らない／AC6）。

**設計判断②（ガードの redirect 置換）**: `redirect({ to: "/login" })` を `redirect({ to: "/", search: { login: 1 } })` に置換。未認証ユーザーは公開ホーム（ゲスト UI）に着地し、その上にログインモーダルが自動で開く。これにより「閲覧コンテキストを保ったままログイン」体験になり、保護ルートからの誘導も維持される（AC4）。

**モーダルのマウント位置**: `LoginDialog` は `RootLayout` と `AuthLayout` の両方にマウントし、`login` search param が真のとき開く。どちらのレイアウトでも（保護ルートからの redirect 先・LP・/login redirect 先のいずれでも）モーダルが表示される。

**search param のスキーマ**: root ルートに `validateSearch` を追加し `{ login?: true }` を返す（`login=1`/`login=true` を真と解釈、それ以外は undefined）。グローバル状態ライブラリは増やさない（AC2）。

## 変更ファイル

- 新規 `client/src/components/LoginDialog.tsx` — モーダル本体（`open`/`onClose` props）。
- 新規 `client/src/components/LoginDialog.test.tsx` — 開く・Google ボタン表示・閉じる・案内文。
- 新規 `client/src/components/LoginDialog.stories.tsx` — Storybook。
- 変更 `client/src/router.tsx` — root に `validateSearch`(login)、ガード redirect 置換、`/login` ルートを `/?login=1` へ redirect、`LoginDialog` を Root/Auth レイアウトにマウント（AppShell 経由）。
- 変更 `client/src/routes/RootLayout.tsx` / `AuthLayout.tsx` — `LoginDialog` を search param 駆動でマウント。
- 変更 `client/src/components/AppHeader.tsx` — 「ログイン」リンクを `search:{login:1}` でモーダル開に変更（現在パス保持）。ログアウト後遷移も `/?login=1` ではなく `/` に（モーダルは開かない）。
- 変更 `client/src/routes/LandingScene.tsx` — CTA を `/lp` のまま `search:{login:1}` でモーダル開に変更。
- 削除/縮退 `client/src/routes/LoginScene.tsx` — ルート実体を廃し redirect に寄せるため不要化（`LoginDialog` に内容移植）。`LoginScene.stories.tsx` は `LoginDialog.stories.tsx` に置換。
- 変更 `client/src/routes/LoginScene.test.tsx` → `client/src/router.test.tsx` ほか — ガード redirect 先と `/login` redirect の検証へ更新。
- 変更 e2e: `e2e/auth/usecases.md`（無ければ新設）と `e2e/usecases.md` にモーダルログインのユースケースを追記。

## TDD 計画（先にテスト→失敗→実装）

1. `LoginDialog.test.tsx`: `open` で「Google でログイン」ボタンと見出しが出る／`open=false` で出ない／閉じるボタンで `onClose` が呼ばれる。
2. `router.test.tsx`: 未ログインで `/account`・`/admin` を開くと公開ホーム（ホームフィード）が表示され、かつログインモーダル（"Google でログイン"）が開く。`/login` を開くと `/?login=1` へ落ちてモーダルが開く。`?login=1` 付き `/` でモーダルが開き、背景にホームフィードが残る。
3. `AppHeader.test.tsx`: 未ログイン時ヘッダーの「ログイン」をクリックするとモーダルが開き、背景（メイン領域）が保持される。ログアウト後はモーダルが開かない。
4. `LandingScene` テスト: CTA クリックでモーダルが開く（または `?login=1` を付与する）。
</content>
</invoke>
