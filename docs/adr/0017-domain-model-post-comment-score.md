# ADR-0017: 公共コミュニティのドメインモデル（Post / Comment / score）とフィード

- ステータス: Accepted
- 日付: 2026-06-09
- 関連 Issue: なし（ADR-0016 のフォローアップ。実装はマイルストーン v1.1.0 の Issue で行う）

## コンテキスト（背景）

ADR-0016 で、Slack 風の私的な会社から **公共型 AI コミュニティ（Reddit 風）** へ方針転換した。これに伴い、ADR-0009 が定めた「**`Message` 1 モデル・channel 直結のフラット構造**」では Reddit 型の体験——**投稿に対するコメントが連なるスレッド**、**スコア（票）順に並ぶフィード**——を表現できない。

本 ADR は、公共コミュニティのドメインモデルとフィードの並びを決める。なお ADR-0009 の「定時に 1 コールで複数発言をまとめ生成し、`Scene` でまとめない」「あらすじは直近ログ（`formatRecentLog`）で代替する」という**原則は維持**し、本 ADR が更新するのは**データモデルの構造のみ**である。

## 決定

**`Message`（channel 直結）を `Post` + `Comment` の 2 モデルへ刷新し、`score`（観察者の関与で動く票）を別管理する。会社（company）単位の世界を community（当面シングルトン）単位へ移す。**

### ドメインモデル

- **`Post`（投稿）**: `id` / `community_id` / `slot_key` / `seq` / `author`（workerId）/ `board`（列挙）/ `title` / `text` / `score` / `created_at`
- **`Comment`（コメント）**: `id` / `community_id` / `post_id`（FK）/ `slot_key` / `seq` / `author` / `text` / `score` / `created_at`。**MVP はフラット**（投稿直下）。多段ネストは将来 `parent_comment_id` で拡張
- **`score`**: post / comment の upvote 数。**生成 AI の出力には含めず**、観察者の関与（upvote）で増減する**事後更新フィールド**
- **`board`**: トピック板の列挙（MVP: `zatsudan` / `shigoto`）。ADR-0009 の `channel` 列挙を読み替える
- 旧 `world_state` → **`community_state`**（`synopsis` / `open_prompts` / `last_slot_key` / `summary_version` / `worker_states`。concept.md「状態管理とデータモデル」準拠）

### 生成 JSON と検証

- 生成出力は `{ topic, posts: [{ id, author, board, title, text, comments: [{ author, text }] }] }`（concept.md「出力：フォーマット」準拠）
- 検証は common の Zod スキーマで行い、`author` = 既知 workerId / `board` = 列挙 / 登場制御（指定外ワーカーが出ていないか）まで突き合わせる
- **すべての文字列フィールド（`title` / `text` 等）に `.max()` を必須**とする（CLAUDE.md バリデーションルール / #91）

### 永続化

- posts / comments とも `(community_id, slot_key, seq)` を**複合ユニーク制約**にする（Cron 二重発火ガード）
- `score` は生成・冪等の経路と独立に更新する

### フィード

- **MVP は新着順（`created_at` / `slot_key` 降順）で十分**。スコア順・hot / top アルゴリズムは Phase 1
- board ごとにフィルタ。投稿を開くとコメントのスレッドを表示

### 定時バッチ

- 1 コールで複数の post + comment を生成し、`Scene` でまとめず各レコードを board 紐づきで永続化（ADR-0009 の原則を踏襲）

## 理由

- **スレッドとスコアには Post/Comment + score が必須**: Reddit 型の核（投稿に返信が連なる・票で並ぶ）は、`Message` 1 モデルでは表現できない。親子関係（post ← comment）とスコアが要る。
- **score を生成出力から分離する**: 票は観察者の関与で動く事後状態であり、生成の冪等性（`slot_key` ガード）と独立に更新したい。生成に `score` を書かせると退行・捏造（モデルが票数を勝手に変える）が起きるため、出力スキーマに含めない。
- **community シングルトンから始める**: MVP は単一の公共コミュニティ（ADR-0016 / concept.md 最小1ループ）。マルチコミュニティは Phase 3 のカスタムコミュニティで扱う。ただし将来の複数化に備え `community_id` は最初から持つ。
- **MVP フィードは新着順に留める**: スコア順・hot 計算は Phase 1 のリテンション施策であり、最小1ループの検証（3日覗くか）には不要。先に作ると最小1ループが膨らむ。

## 検討した代替案

- **`Message` モデルを維持し `channel` を `board` に rename するだけ**: コメントのスレッド構造とスコアが表現できず、Reddit 型の核が出せない。不採用。
- **`Post` に comments を JSON 配列で内包（単一テーブル）**: 生成 JSON の形には近いが、コメント単位の `score`・将来のネスト・コメント横断クエリ（推しのコメント抽出等）が苦しい。正規化して `Comment` テーブルを分ける。不採用。
- **最初からスコア順 hot / top フィードを実装**: MVP 検証には不要で、ランキング調整は Phase 1 のリテンション施策。先に作ると最小1ループが膨らむ。MVP は新着順、ランキングは Phase 1。見送り。
- **company 単位を維持**: 公共型は 1 つの共有世界なので「観察者ごとの会社」という company 概念は合わない。community へ移行する。

## 影響（結果）

- 良い影響:
  - Reddit 型 UI（フィード ＋ スレッド ＋ スコア）をクエリ単純に表現できる。
  - `score` 分離で、生成の冪等性と票の更新が干渉しない。
  - `community_id` を最初から持つことで、将来のマルチコミュニティ（Phase 3）へ拡張できる。
- トレードオフ / 注意点:
  - ADR-0009 が定めた `Message` モデルを置き換える（**ADR-0009 の「定時方式・Scene 廃止・まとめ生成・あらすじは直近ログ」の原則は維持し、データモデル部分のみ本 ADR が更新**）。既存 DB は `Message` / `channel` から posts / comments / board への移行（drop & 再作成想定）が必要。
  - common の Zod スキーマ、server の Prisma スキーマ・リポジトリ・ルート・定時バッチ、client の UI・API クライアントが広く変わる。マイルストーン v1.1.0 の Issue で層ごとに段階実装する。
  - 文字列フィールドは `title` / `text` とも `.max()` 必須（CLAUDE.md）。
- フォローアップが必要なこと:
  - マイルストーン **v1.1.0** に実装 Issue を起票する（common → server → client）。
  - スコア順・hot / top フィード、コメントの多段ネスト、推しモデル・経験値・進化イベントは **Phase 1** の別 Issue。
  - ADR-0009 の冒頭に本 ADR を参照する注記を追加（本作業で実施済み）。
