# ADR-0009: Scene 廃止と message の channel 直接紐づけ

- ステータス: Accepted
- 日付: 2026-05-30
- 関連 Issue: #27

> **注記（ADR-0018 / ADR-0019）**: ADR-0018 で公共型 AI コミュニティ（Reddit 風）へ方針転換した。本 ADR の**原則（定時方式・Scene 廃止・1 コールでまとめ生成・あらすじは直近ログで代替）は維持**される。ただしデータモデルは、本 ADR の「Message 1 モデル・channel 直結」を **ADR-0019 が `Post` + `Comment`（`community` 直結・`score` 別管理）へ更新**する。本文の「message」「channel」は、ADR-0019 以降は「post / comment」「community（サブレディット相当）」と読み替える。

## コンテキスト（背景）

現状のドメインは **Scene（1 定時で生成される 1 シーン = あらすじ + 発言列）** が message をまとめる構造になっていた
（`common` の `SceneSchema`、`server` の `SceneRepository` / `/scenes` / 定時バッチ、Prisma の `Scene`/`Message`）。

また Scene は **`scene`（あらすじ/summary）** フィールドを持ち、次の定時入力に渡す要約として機能する設計だった。

しかし実装を進める中で「message を Scene でまとめる必要はなく、message は channel に直接紐づければ十分」だと判断した。
あらすじ（summary）についても、次の定時の入力には channel の直近 message（`formatRecentLog`）をそのまま使えるため、
あらすじを別途生成・永続化する必要がないことが明らかになった。

本 ADR はこの判断を記録し、矛盾していた ADR-0004 / ADR-0005 / concept.md を整合させる。

## 決定

**ドメインから Scene を廃止し、message を channel に直接紐づくフラットな発言として扱う。**

- `Scene` モデル（common の `SceneSchema` / server の Prisma `Scene` テーブル）を**削除**する
- `Message` を Scene に属さない独立したレコードとし、`channel`（文字列 ID）に直接紐づける
- `scene`（あらすじ）フィールドを**廃止**する。次の定時の入力には `formatRecentLog(messages, n)` で整形した直近 message を用いる
- 定時バッチは引き続き 1 コールで複数 message を生成するが、**Scene でまとめず**に各 message を channel 紐づきで永続化する
- ルートを `/scenes` から `/messages` に移行し、POST body を `MessageArraySchema`（1 件以上の配列）とする

## 理由

- **単純化**: Scene レイヤーを除去することで、ドメインモデルが `Message` 1 モデルに収束し、コードが減り、理解が容易になる
- **あらすじ不要**: 次の定時入力には直近 message をそのまま渡せる（`formatRecentLog` が既に存在）ため、別途あらすじを生成・永続化するコストが無駄だった
- **フラット化のメリット**: message が channel 直結になることで、チャンネルのタイムライン表示が `Message` テーブルの単純なクエリで実現できる（Scene 経由の join が不要）
- 「定時に 1 コールでまとめて生成」というコスト設計の前提は維持するため、定時バッチ自体の構造は変わらない

## 検討した代替案

- **Scene を維持する**: あらすじを次の定時の入力に使う用途があると考えていたが、`formatRecentLog` で直近 message を整形すれば同等の入力が得られ、冗長だった。また Scene レイヤーが複雑性を増す割にメリットが薄いと判断し不採用
- **Scene を維持しあらすじだけ廃止**: 中途半端な残留になり、コードの複雑性が下がらない。不採用

## 影響（結果）

- 良い影響:
  - ドメインモデルが `Message` 1 モデルに簡素化される
  - Prisma スキーマから `Scene` テーブルが消え、`Message` が channel 直接紐づきになる
  - チャンネルごとのタイムライン取得がシンプルになる
  - ADR-0005 の「ドメインモデルと型」から Scene が消える（整合）
- トレードオフ / 注意点:
  - 既存 DB がある場合はデータ移行が必要（`Scene` / `Message` テーブルの drop と再作成）
  - concept.md の「シーン」「あらすじ」表現を更新する必要がある
- フォローアップが必要なこと:
  - ADR-0004 / ADR-0005 の影響欄を本 ADR を参照して更新（本 Issue で実施）
  - concept.md の「1 コールで 1 シーン」「あらすじ」記述を更新（本 Issue で実施）
