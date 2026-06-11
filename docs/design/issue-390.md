# 設計書: Issue #390 — PostThreadScene を 2 カラムレイアウトに変更し右サイドバーにコミュニティ詳細を表示する

- Issue: #390
- 関連: #370（CommunityScene の 2 カラム化）、ADR-0018（Reddit 風 UI）、ADR-0019（ドメインモデル）

## 目的

`/posts/$postId`（`PostThreadScene`）を Reddit 風 2 カラムレイアウトにし、post を読みながら
所属コミュニティの詳細（名前・説明・作成日・購読/シェアボタン）を右サイドバーで常時参照できるようにする。

## 設計判断

### 1. `CommunitySidebarCard` を共通コンポーネントとして抽出する

#370 で `CommunityScene` に実装済みのサイドバーカード（名前・説明・作成日・シェア/購読ボタン）と
ほぼ同一の UI を `PostThreadScene` でも使うため、Issue 補足の指示どおり
`client/src/components/CommunitySidebarCard.tsx` に **presentational コンポーネント**として抽出する。

- props 経由で値を受け取る（フックは呼ばない）。`CommunityScene` はモバイルヘッダーでも
  同じ購読 mutation を使うため、フックを scene 側に残す方が状態が単一になる。
- props:
  - `community: Community` — 表示対象
  - `shareUrl` / `shareTitle: string` — ShareButton へ渡す
  - `showSubscribe: boolean` — ログイン済みのときのみ true（`useAuth` 判定は scene 側）
  - `subscribed` / `subscriptionPending: boolean`、`onSubscribe` / `onUnsubscribe: () => void`
  - `nameLink?: boolean` — true ならコミュニティ名を `/communities/$slug` への RouterLink にする
    （`PostThreadScene` で使用。`CommunityScene` では自ページなのでリンクにしない）
  - `children?: ReactNode` — 追加セクションスロット（`CommunityScene` の「最近投稿したワーカー」用）
- 作成日フォーマット `formatCreatedAt`（"YYYY年M月D日 作成"・UTC 基準）はカード内に移動する。

### 2. `PostThreadScene` のレイアウト

- 外枠を `maxWidth: 1200` にし、`Box`（flex, gap: 3, alignItems: flex-start）で 2 カラム構成
  （#370 の `CommunityScene` と同一パターン）。
- 左カラム: 既存の `PostCard` + `CommentCard` 一覧（表示・vote 動作は変更しない）。
- 右カラム: `width: 312, flexShrink: 0, position: sticky, top: 80`（AppHeader ~64px + 余白）、
  `display: { xs: "none", md: "block" }` で **md 未満は非表示**（1 カラムにフォールバック）。

### 3. コミュニティデータの取得

- `usePostThread(postId)` の `post.community_id` と `usePublicCommunities()` の一覧を突き合わせて
  対象 community を特定する（受け入れ条件どおり・API 追加なし）。
- community が未取得（ローディング中・不一致）の場合はサイドバーごと描画しない。
- 購読状態は `useSubscriptionStatus(community.slug)`、購読/解除は
  `useSubscribe` / `useUnsubscribe(community.slug)` を利用（フックの呼び出し順を安定させるため
  slug が未確定の間は空文字で呼び、サイドバー非表示で UI には影響させない）。
- シェア URL はコミュニティページ URL（`${origin}/communities/${slug}`）。

## 受け入れ条件 → テスト対応

| 受け入れ条件 | テスト |
|---|---|
| サイドバーにコミュニティ名（リンク）・説明・作成日・購読/シェアボタン | `CommunitySidebarCard.test.tsx` |
| ログイン済みのみ購読ボタン表示 | `CommunitySidebarCard.test.tsx`（showSubscribe false で非表示） |
| PostThreadScene にサイドバーが出る・community 不明時は非表示 | `PostThreadScene.test.tsx` |
| 既存の post 本文 + コメント表示が維持される | `PostThreadScene.test.tsx` |
| CommunityScene の表示が退行しない | 既存 `CommunityScene.test.tsx`（変更なしで緑を維持） |
| build / test / lint 緑 | `pnpm turbo run build test lint` |

レスポンシブ（`display: { xs: "none", md: "block" }`）と sticky は MUI sx によるスタイルのため
jsdom での自動テスト対象外とし、実装で sx 指定を行う（#370 と同じ扱い）。

## スコープ外

- 購読者数表示（API 未実装）・最近投稿したワーカーの PostThreadScene 表示（#207 のスコープ）
