# Issue #481 設計書: 未認証ユーザーが vote ボタンを押したらログインへ誘導する

## 目的 / 背景

ホームフィード・コミュニティ・スレッドの各 post / comment の up/down vote ボタンは、未認証（ゲスト）にも活性表示されている。だが vote API（`POST /api/posts/:postId/vote` / `POST /api/comments/:commentId/vote`）は `requireAuth` 必須で、ゲストが押すと **401 で黙って失敗** し、何も起きない（手応えゼロ）。

`concept.md` の中核価値「自分が押した票で良い投稿が浮く／vote はコストゼロで即手応え」が、最初に触れるゲストでまったく成立しない。本 Issue では、ゲストが vote を押したときの「無反応で失敗」をなくし、ログインへ自然に誘導する。

## 設計判断（確定事項）

受け入れ条件 3 の「ボタン無効化＋ツールチップ / 押下時にログイン誘導 のいずれか」について、**押下時にログイン誘導（スナックバー＋ログインリンク）**を採用する。理由:

- **中核価値の体験を残す**: ボタンを無効化（グレーアウト）すると、ゲストは「vote という行為があること」自体を体感しづらい。ボタンは活性のまま押せて、押すと「ログインすれば票が反映される」と知らせる方が、vote の手応え（中核価値）と新規登録への導線の両方を成立させる。
- **サイレント 401 を根本から断つ**: ゲストの場合は vote mutation（API コール）を**そもそも発火しない**。`useAuth()` の認証状態で分岐し、未認証なら API を呼ばずにログイン誘導スナックバーを開く。これにより「401 で黙って失敗」が構造的に起きえなくなる。
- **#454（ログインのモーダル化）との整合**: 現状ログイン導線は `/login` ルートへの遷移（`AppHeader` 等と同じ）。本 Issue ではスナックバー内のアクションを `/login` への `RouterLink` とする。#454 でモーダル化されたら、この遷移先をモーダルオープンへ差し替えるだけで済む（疎結合）。
- **認証状態の単一情報源**: 分岐は `useAuth()`（`client/src/api/auth.ts`、`GET /auth/me` を TanStack Query で取得・401 なら null）に基づく。

## 入出力（受け入れ条件 → 振る舞い）

### AC1: ゲスト vote → サイレント 401 にせずログイン誘導

- 入力: 未認証状態（`useAuth()` の data が null/undefined）で post / comment の up または down vote ボタンをクリック。
- 出力:
  - vote API（`votePost` / `voteComment` mutation）は**発火しない**（401 を出さない）。
  - ログイン誘導スナックバー（MUI `Snackbar` + `Alert severity="info"`）が表示される。文言は「投票するにはログインが必要です」。
  - スナックバー内に `/login` への「ログイン」リンク（`RouterLink`）があり、クリックでログイン画面へ遷移できる。
- 検証: RTL（HomeFeedScene / CommunityScene / PostThreadScene の各 RTL、ないし共通フックのユニットテスト）。

### AC2: 認証済み vote → 従来どおり score 即時反映

- 入力: 認証済み状態で vote ボタンをクリック。
- 出力: 従来どおり `votePost` / `voteComment` mutation が発火し、楽観更新で score が即時反映される。スナックバーは表示しない。
- 検証: RTL（認証済みで vote すると mutation が呼ばれ score が反映される回帰テスト）。

### AC3: `useAuth()` で分岐・設計書に方式を明記

本ドキュメントに採用方式（押下時ログイン誘導スナックバー）を明記済み。実装は `useAuth()` の認証状態で分岐する。

### AC4: `pnpm turbo run build test lint` が緑

CI で担保する。

## 実装方針

### 1. 共通フック `useGuestVoteGuard`（client）

`client/src/hooks/useGuestVoteGuard.ts` を新規追加する。3 つのシーン（Home / Community / PostThread）で同じ「ゲストなら vote を止めてスナックバーを開く」ロジックを共有するため、フックに切り出す。

```
export interface GuestVoteGuard {
  /** 実行可否を判定し vote を実行する。ゲストなら誘導を開いて false、認証済みなら run() を呼び 副作用を実行。 */
  guardVote: (run: () => void) => void;
  /** ログイン誘導スナックバーの開閉状態。 */
  promptOpen: boolean;
  /** スナックバーを閉じる。 */
  closePrompt: () => void;
}
```

- `useAuth()` の `data`（AuthUser | null | undefined）を読み、`Boolean(data)` で認証済み判定。
- `guardVote(run)`: 認証済みなら `run()` を実行（= mutation 発火）。未認証なら `run()` を呼ばず `promptOpen=true` にする。
- `promptOpen` / `closePrompt` は `useState` でローカル管理（フォーム状態ではないので #262 のフォーム規約の対象外。`@tanstack/react-form` は使わない）。

### 2. ログイン誘導スナックバー `LoginPromptSnackbar`（client）

`client/src/components/LoginPromptSnackbar.tsx` を新規追加する。`open` / `onClose` を受け取り、MUI `Snackbar` + `Alert severity="info"` を描画。Alert の `action` に `/login` への `RouterLink`（MUI `Link` component={RouterLink}）を置く。

- `autoHideDuration` は 6000ms。`anchorOrigin` は他のスナックバー（AccountScene 等）と揃えて `{ vertical: "bottom", horizontal: "center" }`。
- ユーザー入力フィールドは持たない（Zod `.max()` 規約の対象なし）。

### 3. 各シーンへの適用

`HomeFeedScene.tsx` / `CommunityScene.tsx` / `PostThreadScene.tsx` で:

- `useGuestVoteGuard()` を呼ぶ。
- 各 `onVote` を `(direction) => guardVote(() => votePost({ ... }))` のように包む。コメントの vote（PostThreadScene）も同様に `guardVote(() => voteComment({ ... }))` で包む。
- シーン末尾に `<LoginPromptSnackbar open={promptOpen} onClose={closePrompt} />` を 1 つ置く。
- `HomeFeedScene` は現状 `useAuth()` を呼んでいないが、フック内部で `useAuth()` を呼ぶため追加の import は不要（フック経由）。

PostCard / CommentCard / VoteControl 自体は変更しない（ボタンは活性のまま・`voteDisabled` は使わない）。これにより既存テストへの影響を最小化する。

## import 境界 / ADR 整合

- 変更は client ワークスペース内で完結（client → common の一方向のみ。server へ依存しない）。
- 楽観更新やゲストの一時 vote 保持はスコープ外（Issue 補足どおり）。ゲストの vote は破棄され、ログイン後に改めて押す前提。
- ADR-0023（成長メカ・外部成果物なし）には抵触しない（純粋に UI の認証誘導）。

## テスト計画（TDD）

1. `client/src/hooks/useGuestVoteGuard.test.tsx`: 認証済みなら `run()` が呼ばれ `promptOpen=false`、未認証なら `run()` が呼ばれず `promptOpen=true`、`closePrompt()` で false に戻る。`useAuth` をモックして検証。
2. `client/src/components/LoginPromptSnackbar.test.tsx`: `open=true` で誘導文言と `/login` リンクが表示される、`open=false` では非表示。
3. シーン RTL（既存 HomeFeedScene.test.tsx を拡張）: ゲストで vote ボタンを押すとログイン誘導が表示され、vote API（`/vote`）が呼ばれないこと。認証済みでは従来どおり mutation が発火すること（回帰）。

## e2e ユースケース更新

ユーザー可視の振る舞い（ゲストの vote 押下でログイン誘導が出る）を追加するため、`e2e/home-feed/usecases.md` と `e2e/post-thread/usecases.md` に UC を追記し、`e2e/usecases.md` の索引へ反映する。
