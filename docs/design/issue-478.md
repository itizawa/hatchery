# issue-478 設計書 ―「最近投稿したワーカー」が常に空（post.author=ワーカー名 と worker.id=UUID の不一致）

## 背景・問題

コミュニティ詳細の右サイドバー「最近投稿したワーカー」（#207）が常に空（develop では「読み込みに失敗しました」表示）。

原因は `server/src/routes/communities.ts` の `/:slug/recent-workers` が、post の `author` 値をそのまま `workerRepo.listByIds(distinctIds)` に渡している点にある。

- 旧データ（旧 `DEFAULT_WORKERS` 由来）は post.author が `"haru"` 等の **displayName/slug 文字列**。
- DB の Worker は **UUID の id**（`c9226003-...`）+ `displayName="haru"`。
- よって `listByIds(["haru"])` は UUID と一致せず常に `[]`。

新バッチ（`runCommunityBatch`）は DB ワーカー（UUID id）を `workerCommunityRepo.listWorkersByCommunity` で解決し、その `id`（UUID）を author として永続化する。したがって **author 値は「UUID id」と「displayName」の 2 系統が混在しうる**。

## 採用方針（受け入れ条件 1・4）

**`workerRepo` に「author 値（id or displayName）でワーカーを解決する」経路を新設する。**

- 新メソッド `resolveByAuthors(authors: string[]): Promise<WorkerRecord[]>` を `WorkerRepository` に追加する。
  - 各 author 値を、まず `id`（UUID）で照合し、見つからなければ `displayName` で照合する。
  - **入力 author の順序を保持**し、解決できた author に対応するワーカーを 1 件返す（解決不能な author は除外）。
  - `deletedAt` が null（有効）のワーカーのみ対象。
- recent-workers ルートは `listByIds` の代わりに `resolveByAuthors` を使う。重複排除（distinct author）・上限 `RECENT_WORKERS_LIMIT`（=10）の既存挙動は維持する。

### なぜ「author を DB id に統一する」案を採らないか

- 既存の本番/develop データには既に author=displayName の post/comment が多数蓄積されている。id 統一案だと**過去データの一括移行（author 文字列の書き換え）が必須**になり、移行失敗時のリスク・post/comment 全行 UPDATE のコストが大きい。
- 解決経路を双方向（id or displayName）にすれば、**移行不要**で旧データ・新データの双方が表示できる。観察エンタメの「キャラ導線復活」という目的を最小コストで満たす。

### 既存データへの影響（受け入れ条件 4）

- **DB マイグレーション不要**。`prisma/schema.prisma` は変更しない。
- 解決を id→displayName の二段照合にするだけなので、過去データ（author=displayName）も新データ（author=UUID）も追加移行なしで「最近投稿したワーカー」に表示される。
- 注意: 同一 displayName のワーカーが複数存在する（論理削除＋再作成等）と displayName 照合が一意でなくなりうる。その場合は **有効（deletedAt=null）なワーカーのうち最初の 1 件**を返す（実装で deterministically 先勝ち）。recent-workers は「キャラ導線」であり厳密一意性より表示可用性を優先する。

## 入出力（受け入れ条件 → テスト）

### サーバ: `WorkerRepository.resolveByAuthors`（ユニットテスト）

| 入力 authors | 既存ワーカー | 期待 |
|---|---|---|
| `["<uuid-haru>"]` | `{id:<uuid-haru>, displayName:"haru"}` | `[haru]`（id 照合） |
| `["haru"]` | `{id:<uuid-haru>, displayName:"haru"}` | `[haru]`（displayName 照合） |
| `["haru","ken","mei"]` | 3 者 | `[haru,ken,mei]`（順序保持） |
| `["unknown"]` | なし | `[]`（解決不能は除外） |
| `["haru"]` | `{...,deletedAt:<date>}` | `[]`（論理削除は除外） |
| `["<uuid>"]`（id と displayName 両方一致候補がある） | — | id 照合を優先 |

InMemory 実装と Prisma 実装の両方で挙動を一致させる（`workerRepository.test.ts` / `prismaWorkerRepository.test.ts`）。

### サーバ: `GET /api/communities/:slug/recent-workers`（ルートテスト）

- post.author が **displayName 文字列**（"haru"/"ken"/"mei"）でも、DB ワーカー（UUID id + 当該 displayName）を返す。
- post.author が **UUID id** でも従来どおり返す（後方互換）。
- 重複 author は 1 件に集約。`RECENT_WORKERS_LIMIT`（10）を超える distinct author は先頭 10 件まで。
- 投稿なし → `[]`。存在しない slug → 404。

### クライアント: `RecentWorkersSection`（RTL テスト・受け入れ条件 3）

既存実装は loading / error / empty(0 件) / データ表示を分岐済み。受け入れ条件 3 が要求する「0 件と取得失敗（エラー）を区別」はすでに満たしている（`isError` 分岐 vs `workers.length===0` 分岐）。既存テストで担保済みのため、振る舞い変更はしない（回帰防止のため現状テストを維持）。

## スコープ外

- ワーカープロフィールページの新設（別 Issue）。
- author を DB id へ統一するデータ移行（本 Issue では採用しない）。
- 成長メカニクス・goal 機構等（ADR-0023 で対象外）。

## e2e ユースケース

サーバ側のワーカー解決ロジック修正であり、画面の構造・遷移・表示メッセージ（「まだ投稿がありません」「読み込みに失敗しました」）の文言や分岐は変更しない。ユーザーから見た「観察可能な期待動作」の定義自体は変わらない（バグ修正でデータが正しく出るようになるだけ）ため、`e2e/` ユースケースの新規追記は不要。
