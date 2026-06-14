# Issue #498 設計書: ホームフィードの投稿カードをクリックしてスレッドへ遷移できるようにする

## 背景・目的

develop 環境のホームフィード（`/` 新着順 / `/popular` 人気順）では、投稿カードをクリックしてもスレッド（`/posts/$postId`）へ遷移しない。観察エンタメの中核体験「投稿を見て → スレッドを開いて掛け合いを読む」の入口が塞がれている。

原因は、`CommunityScene` は各 `PostCard` を `RouterLink` で囲んでいるのに対し、`HomeFeedScene` は `PostCard` を素のまま並べてリンク化していないこと。`CommunityScene` の実装に揃えて修正する。

## 受け入れ条件 → 入出力

| # | 受け入れ条件 | 入力 / 操作 | 期待出力 |
|---|---|---|---|
| 1 | 各投稿カードが `/posts/$postId` へのリンクになる | ホームフィードを描画 | 各カードが `href="/posts/<id>"` を持つ `RouterLink` で囲まれる |
| 2 | vote ボタン押下ではスレッド遷移しない | vote ボタンをクリック | `voteStopPropagation` により `preventDefault`/`stopPropagation` され遷移しない（既存 #411 と同主旨） |
| 3 | RTL テストでリンク href を検証 | `HomeFeedScene.test.tsx` | 投稿カードが `/posts/$postId` への href を持つことを検証 |
| 4 | build/test/lint 緑・import 境界維持 | `pnpm turbo run build test lint` | 緑。client → common 一方向境界を破らない |

## 設計判断

- **`CommunityScene` の `RouterLink` 方式をそのまま流用**する。`PostCard` を `<RouterLink to="/posts/$postId" params={{ postId: post.id }} style={{ display: "block", textDecoration: "none", color: "inherit" }}>` で囲む。これにより既存の `voteStopPropagation` 機構（`PostCard` 内の vote クリックで `e.preventDefault()`/`e.stopPropagation()`）がそのまま vote 押下時の遷移抑止に効く。
- `PostCard` / `VoteControl` には変更を加えない（既に `voteStopPropagation` を備える）。
- 既に `HomeFeedScene` は `@tanstack/react-router` の `Link as RouterLink` を import 済みのため追加 import は不要。
- 無限スクロールの sentinel・空状態・LoginPromptSnackbar はそのまま維持する。

## テスト

`client/src/routes/HomeFeedScene.test.tsx` に以下を追加:

- 投稿カードがスレッド（`/posts/<id>`）への href を持つリンクで囲まれていることを検証（受け入れ条件 1, 3）。
- vote ボタン押下では vote API は呼ばれるがスレッド遷移は発生しないことは、既存の #481 vote テスト（vote 押下でスナックバー表示・遷移しない）でカバーされるため、リンク化後もそれらが緑であることで担保する（受け入れ条件 2 の回帰）。

## e2e

`e2e/home-feed/usecases.md` の `UC-HOME-02: 投稿カードからスレッドページへ遷移できる` が既にこの振る舞いを記述済み（仕様先行・未実装だった）。本 PR で実装が仕様に追いつくため usecases の追記・変更は不要。
