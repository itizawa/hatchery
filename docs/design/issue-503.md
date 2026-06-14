# 設計: #503 ホームフィードの投稿カードに所属コミュニティ名（c/slug）を表示する

## 背景・目的

ホームフィード（`/` = 新着順 / `/popular` = 人気順）は購読・認証に関係なく**全コミュニティの投稿を混在**して表示する（#347）。しかし投稿カードには所属コミュニティが表示されず、「どの板の話か」が判別できない。`concept.md` の簡易ワイヤー（`c/ざつだん · haru`）でも各投稿にコミュニティ名を出す設計。

本 Issue では**ホームの混在フィードの投稿カードにのみ**所属コミュニティ名（`c/{slug}`）を表示し、そのコミュニティ（`/communities/$slug`）へ辿れるようにする。単一コミュニティページ（`CommunityScene`）では自明なため表示しない。

## 方針

### コミュニティ名の解決（受け入れ条件 2）

**案B（クライアント側解決）** を採用する。`usePublicCommunities()`（既に `PostThreadScene` で使用済みの Suspense クエリ・`staleTime` 60s）で取得した `Community[]` を `id → community` の Map にし、各 post の `community_id` から名前を引く。

- 理由: コミュニティ数が少ない MVP では十分軽量。OpenAPI スキーマ（feed API レスポンス）・server を変更せず、ADR-0006 の一方向フローに触れずに完結する。案A（feed API に community を含める）は将来のページング時に堅牢だがスコープ過大。
- `community_id` は `PostSchema.community_id`（#499 で確定済みの正しいフィールド名）を使う。

### 表示と出し分け（受け入れ条件 1・3）

`PostCard` に**任意プロップ**を追加し、文脈に応じて出し分ける（PostCard 自身は router 非依存を維持＝既存テストが router 無しで render しているため）。

- `community?: { slug: string; name: string }` — 指定時のみ author byline 行の先頭に `c/{slug}` を表示する。
- `onCommunityClick?: () => void` — 指定時は `c/{slug}` をクリック可能にする。クリックで `e.stopPropagation()` + `e.preventDefault()` して親（post スレッドへの `RouterLink`）への伝播・デフォルト遷移を抑止し、コールバックでコミュニティへ遷移する（既存の `VoteControl` / `ShareButton` と同じ「アンカー内インタラクティブ要素 + stopPropagation」パターンに揃える）。

`HomeFeedScene` のみ `community` と `onCommunityClick`（`useNavigate` で `/communities/$slug` へ）を渡す。`CommunityScene` / `PostThreadScene` は渡さない → 重複表示なし。

## 変更ファイル

- `client/src/components/PostCard.tsx` — `community` / `onCommunityClick` プロップ追加、`c/{slug}` byline 描画。
- `client/src/routes/HomeFeedScene.tsx` — `usePublicCommunities` で Map を組み、各 `PostCard` に `community` / `onCommunityClick` を渡す。
- `client/src/components/PostCard.test.tsx` — community 表示/非表示の出し分け・クリックで伝播抑止＆コールバック発火のケース追加。
- `client/src/routes/HomeFeedScene.test.tsx` — 混在フィードで各カードに `c/{slug}` が出るケース追加。
- `e2e/home-feed/usecases.md` — 「ホームの各投稿に所属コミュニティ名が表示される」を追記。

## テスト（受け入れ条件 4）

PostCard:
- `community` 指定時に `c/{slug}` を表示する。
- `community` 未指定時は `c/` 表示を出さない（単一コミュニティ文脈の出し分け）。
- `onCommunityClick` 指定時、`c/{slug}` クリックで onCommunityClick が呼ばれ、親 onClick へ伝播しない（stopPropagation）。

HomeFeedScene:
- 異なる `community_id` の投稿が混在するフィードで、各カードに対応する `c/{slug}` が表示される。

## スコープ外

- コミュニティアイコン表示（#457）。ここは名前テキストのみ。
- feed API レスポンスへの community 埋め込み（案A）。
