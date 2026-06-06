# 設計書: 招待リンクの受諾（新規ユーザー登録）画面を実装する (#134)

## 1. 目的 / 背景

#132 で実装した公開 API（`GET /api/invitations/:token` / `POST /api/invitations/:token/accept`）と
#133 で実装した管理 UI（招待リンク発行・コピー）を前提に、招待された人が実際に開く**受諾（新規登録）画面**を追加する。

## 2. スコープ（やること / やらないこと）

### やること
- 公開ルート `/invite/$token`（`requireAuth` なし・`AuthLayout`）の追加
- `useInvitation(token)` / `useAcceptInvitation(token)` フックの追加（`client/src/api/invitations.ts` に同梱）
- トークン状態に応じた UI 出し分け（active → フォーム / other/null → 無効メッセージ）
- 受諾成功後の自動ログイン遷移（`AUTH_ME_QUERY_KEY` invalidate → `/` へ navigate）
- ID 重複・招待失効エラーの適切な表示
- ログイン済みユーザーが訪問した場合の `/` へのリダイレクト
- 各入力フィールドへのフロント側文字数上限（Zod `.max()` と二重）

### やらないこと
- 受諾 API 本体（#132 実装済み）
- 招待の発行・管理 UI（#133 実装済み）
- パスワード強度メーター・メール確認などの拡張
- Storybook Stories（受諾画面は静的コンポーネントを含まず、ルート単体での動作確認が主）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- [ ] `/invite/:token` ルートが追加され、未ログインでも `AuthLayout`（サイドバーなし）で開ける
- [ ] トークン `status === "active"` のとき「ログイン ID / 表示名 / パスワード」フォームが表示される
- [ ] トークンが `null`（404）または `status !== "active"` のとき、フォームを出さず無効メッセージと `/login` リンクを表示する
- [ ] フォーム送信で `POST /api/invitations/:token/accept` が呼ばれ、成功時は `AUTH_ME_QUERY_KEY` を invalidate して `/` へ遷移する
- [ ] ID 重複（status=409 かつエラー内容が "User id already exists"）時は「この ID は既に使われています」を表示する
- [ ] フォーム送信でトークンが無効（409/410）だった場合は「この招待は使用できません」を表示する
- [ ] 各入力に maxLength 制約（ID: 50, 表示名: 100, パスワード: 100）が掛かっている
- [ ] ログイン済みユーザーがこの画面を開くと `/` にリダイレクトされる
- [ ] 受け入れ条件を網羅した RTL テストがあり、すべて緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### ルーティング（`client/src/router.tsx`）

`/invite/$token` ルートを追加。`requireAuth` を付けない。

`AppShell` の `AuthLayout` 判定: 現状の `AUTH_PATHS`（`"/login"` の完全一致配列）は
動的セグメント `/invite/:token` に対応できないため、`isAuthPath(pathname)` 関数を導入し、
前方一致（`startsWith("/invite/")`）を加える。

```typescript
function isAuthPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/invite/");
}
```

### API クライアント（`client/src/api/invitations.ts` に追記）

- `fetchInvitation(token)` — `GET /api/invitations/{token}` を呼ぶ。404 は `null`、2xx は `InvitationPublicSchema.parse(data)` を返す。
- `acceptInvitation(token, body)` — `POST /api/invitations/{token}/accept` を呼ぶ。非 2xx の場合はレスポンス本文の `error` フィールドと HTTP ステータスを持つエラーを投げる。
- `useInvitation(token)` — `useQuery` ラッパー。
- `useAcceptInvitation(token)` — `useMutation` ラッパー。`onSuccess` で `AUTH_ME_QUERY_KEY` を invalidate。

### 画面（`client/src/routes/AcceptInvitationScene.tsx`）

- `useAuth()` でログイン状態を確認。ログイン済みなら `useEffect` で `/` へ navigate。
- `useInvitation(token)` のローディング中はスピナーを表示。
- `data === null` または `data.status !== "active"` なら無効メッセージ + `/login` リンク。
- `data.status === "active"` なら `@tanstack/react-form` でフォームを表示。
- `useAcceptInvitation(token)` の `mutateAsync` でサブミット。エラーを `status` プロパティで判定してメッセージを出し分け。

## 5. 影響範囲 / 既存への変更

| 対象 | 変更内容 |
|------|----------|
| `client/src/api/invitations.ts` | `fetchInvitation` / `acceptInvitation` / `useInvitation` / `useAcceptInvitation` を追加 |
| `client/src/router.tsx` | `/invite/$token` ルート追加・`isAuthPath` 関数導入 |
| `client/src/routes/AcceptInvitationScene.tsx` | 新規作成 |
| `client/src/routes/AcceptInvitationScene.test.tsx` | 新規作成 |

server / common への変更はなし（#132 で API 実装済み）。

## 6. テスト計画（TDDで書くテスト一覧）

### `client/src/routes/AcceptInvitationScene.test.tsx`（RTL コンポーネントテスト）

1. 有効なトークン（`status: "active"`）では登録フォームが表示される
2. 使用済みトークン（`status: "used"`）ではエラーメッセージが表示されフォームがない
3. 期限切れトークン（`status: "expired"`）ではエラーメッセージが表示されフォームがない
4. 存在しないトークン（`null`）ではエラーメッセージが表示されフォームがない
5. 受諾成功時は `/` へ遷移する（ホーム画面のコンテンツが表示される）
6. ID 重複（409）のとき「この ID は既に使われています」が表示される
7. ログイン済みのユーザーがアクセスすると `/` へリダイレクトされる

### `client/src/api/invitations.test.ts`（API ユニットテスト）

8. `fetchInvitation` — 200 のとき `InvitationPublic` を返す
9. `fetchInvitation` — 404 のとき `null` を返す
10. `fetchInvitation` — 非 2xx（500）で例外を投げる
11. `acceptInvitation` — POST リクエストのパスとボディを確認する
12. `acceptInvitation` — 非 2xx で例外を投げる

## 7. リスク・未決事項

- **公開ルートの AuthLayout 判定**: `isAuthPath` を `pathname.startsWith("/invite/")` で実装するため、
  将来 `/invite-something` のような別パスを追加する場合はロジック変更が必要。現状はシンプルな条件でよい。
- **受諾後の遷移**: 成功時に `AUTH_ME_QUERY_KEY` invalidate → `useAuth()` が再フェッチされる前に
  navigate するため、HomeScene の `requireAuth` で再度 fetchMe が呼ばれる可能性がある。
  session は確立済みのため問題ない（#132 の passport.login で担保）。
- **ログイン済み訪問**: `useEffect` で navigate するため、一瞬フォームが見える可能性がある（flash）。
  許容範囲内とする（本番では認証済みユーザーが招待リンクを踏む頻度は低い）。
