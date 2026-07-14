# 設計書: ワーカーランキングの名前・アイコンからワーカー詳細画面に遷移できるようにする (#1161)

## 1. 目的 / 背景

ワーカーランキング画面（`/ranking`・`WorkerRankingScene.tsx`）の各行はアバター + 表示名を表示しているだけで、クリックしても何も起きない。ワーカー個別のプロフィール画面 `/workers/$workerId`（#929）は既に存在するため、ランキングからそこへの遷移導線を追加する。

## 2. スコープ（やること / やらないこと）

**やること**:
- `RankingRow` のアバター + 表示名を `/workers/$workerId` への `RouterLink` でラップする。
- リンク領域はキーボード操作（Tab → Enter）で遷移できるようにする。
- テスト可能な `data-testid="ranking-row-worker-link"` を付与する。
- `e2e/ranking/usecases.md` に遷移導線のユースケースを追記する。

**やらないこと**:
- 行全体のリンク化（順位・閲覧数・評価スコアのセルはクリック不可のまま）。
- ランキングのレイアウト・指標変更（#1065 で対応済み）。
- 新規 API・OpenAPI 変更（既存 `useWorkerRanking()` の `worker_id` をそのまま使う）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `RankingRow` の名前・アイコン領域が `to="/workers/$workerId" params={{ workerId: item.worker_id }}` の `RouterLink` でラップされている。
2. リンクは `data-testid="ranking-row-worker-link"` を持つ。
3. リンクは `textDecoration: "none", color: "inherit"` で、キーボードフォーカス可能な `<a>` としてレンダリングされる（`RouterLink` のデフォルト挙動）。
4. 行内の他セル（順位・閲覧数・評価スコア）はリンクの外側にあり、クリックしても遷移しない。
5. 既存の空状態・ソート順・アバター表示・スコア色分けの挙動は変更しない（既存テスト全て緑のまま）。

## 4. 設計方針

`AuthorByline.tsx`（44〜75行目）と同じパターンを採用する。`RankingRow` 内で `WorkerAvatar` + `Typography(display_name)` を包む `Box` を `@tanstack/react-router` の `Link`（`RouterLink`）でラップし、`to="/workers/$workerId"` `params={{ workerId: item.worker_id }}` を渡す。スタイルは `style={{ textDecoration: "none", color: "inherit" }}` を基本にし、`Box` 側の `sx` はそのまま維持する。hover 時の視覚的フィードバックとして `sx` に `"&:hover": { textDecoration: "underline" }` 相当を Link の `Box` に追加する。

行全体はリンク化しない（`TableRow` はそのまま。名前セル内の `Box` だけをラップ）ため、他セルへの誤クリックは発生しない。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **client** のみ。
- 変更ファイル: `client/src/routes/WorkerRankingScene.tsx`（`RankingRow`）、`client/src/routes/WorkerRankingScene.test.tsx`（テスト追加）、`e2e/ranking/usecases.md`・`e2e/usecases.md`（ユースケース追記）。
- server / common への変更なし。既存 API・既存ルート（`/workers/$workerId`）の再利用のみ。

## 6. テスト計画（TDD）

`WorkerRankingScene.test.tsx` に以下を追加する（既存テストと同様、`Link` を `<a href={to}>` にモックした環境で検証）:

- 各行の名前・アイコン領域が `data-testid="ranking-row-worker-link"` を持ち、`href` が `/workers/{worker_id}` になっている。
- 複数行存在する場合、それぞれのリンクが対応する `worker_id` を指している。

## 7. リスク・未決事項

特になし。既存の `AuthorByline` / `CommentCard` と同じ確立されたパターンの横展開のため設計リスクは低い。
