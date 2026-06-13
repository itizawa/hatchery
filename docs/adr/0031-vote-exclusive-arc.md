# ADR-0031: Vote の投票対象参照を Exclusive Arc（postId/commentId 本物FK + CHECK）にする

- ステータス: Accepted（ADR-0019 / ADR-0025 の「多態参照 (target_type, target_id)」を supersede）
- 日付: 2026-06-13
- 関連 Issue: #453

## コンテキスト（背景）

ADR-0019 / ADR-0025 では up/down vote を `Vote(user_id, target_type, target_id, direction)` の
**多態参照**で表していた。`target_id` には Post / Comment いずれかの id が入り、DB の外部キー（FK）を
張っていない。schema コメントは「アプリケーション層で存在確認する」と謳っていたが、vote API
（`server/src/routes/posts.ts` / `prismaVoteRepository.ts`）に明示的な存在チェックは無く、
存在しない id への vote は `addScore`（存在しない行への update）が落ちることで間接的に弾かれていただけ。

この多態参照には以下の整合性リスクがあった:

- **存在保証が無い**: FK が無いため存在しない Post / Comment を指す vote を DB が弾けない。
- **cascade が無い**: Post / Comment を削除しても関連 vote が残り、孤児 vote になり得る。
- **非トランザクション**: vote 作成と score 更新（`addScore`）が別操作で、片方だけ成功する中間状態があり得た。

投票対象は **Post / Comment の 2 種で固定**（ADR 上も増える予定が無い）であり、列数が増えない範囲なら
Exclusive Arc で整合性を DB の制約に寄せられる。

## 決定

**`Vote` の投票対象を `postId? / commentId?` の 2 本の本物 FK（onDelete: Cascade）で表す Exclusive Arc に
する。ちょうど片方だけ非 null を CHECK 制約で強制し、`target_type` / `target_id` enum 多態参照を廃止する。**

具体:

- スキーマ: `Vote` から `targetType` / `targetId` と `VoteTargetType` enum を廃止。`postId String?` /
  `commentId String?` を追加し、それぞれ `Post` / `Comment` へ `@relation(onDelete: Cascade)`。
  `Post` / `Comment` に逆リレーション `votes Vote[]` を追加。
- CHECK 制約 `CHECK ((("postId" IS NOT NULL)::int + ("commentId" IS NOT NULL)::int) = 1)` を
  マイグレーション SQL で付与（Prisma はスキーマで CHECK を宣言できないため `--create-only` 後に手編集）。
- 二重投票防止: ユニーク制約を `@@unique([userId, postId])` / `@@unique([userId, commentId])` に置換
  （PostgreSQL は NULL を一意制約上区別するため、post 票と comment 票が同テーブルで両立する）。
- データ移行: 同一マイグレーション内で旧カラム drop の**前に** backfill
  （`targetType='post' → postId` / `targetType='comment' → commentId`）し、既存 vote を欠損なく移す。
- 永続化ポート（`VoteRepository`）の公開シグネチャは多態的な `(targetType, targetId)` のまま維持し、
  Prisma 実装が `postId` / `commentId` にマップする。これにより in-memory 実装・route・バッチ集計の
  変更範囲を最小化する。
- vote 記録と score 更新を **単一 DB トランザクション**にまとめる新メソッド `voteAndApplyScore` を追加し、
  vote エンドポイントはこれ 1 呼び出しで処理する（中間状態を排除）。
- HTTP 境界（OpenAPI）は不変。vote エンドポイントは URL パスで対象が決まるため、
  リクエスト / レスポンス契約に破壊的変更は無い。

## 理由

- **整合性を DB に寄せる**: 存在保証・cascade・原子性をアプリ層の暗黙のふるまいではなく、FK・CHECK・
  トランザクションという構造で担保できる。孤児 vote と存在しないターゲットへの vote が原理的に発生しない。
- **対象は 2 種固定**: ADR-0019 / ADR-0023 の方針上、投票対象が Post / Comment 以外に増える計画は無い。
  列が 2 本で収まる範囲では Exclusive Arc が最も単純かつ堅牢。

## 検討した代替案

- **多態参照のまま + アプリ層で存在チェック**: FK を張らず vote API で存在確認する案。cascade と原子性が
  別途必要で、チェック漏れ・競合・孤児が残る。整合性をコードで守り続けるコストが高く却下。
- **共通親テーブル（Votable / Class Table Inheritance）**: Post / Comment を共通の Votable で束ね、Vote は
  Votable を 1 本の FK で参照する案。対象が 3 種以上に増える場合の正攻法だが、2 種固定の現状では
  テーブルとクエリが過剰に複雑化する。**将来 3 種以上に増える場合の再設計候補**として残す（スコープ外）。

## 影響（結果）

- 良い影響: 存在保証・cascade 削除・vote/score の原子性が DB 制約で保証される。schema コメントの
  「アプリ層で存在確認」という暗黙依存が解消。
- トレードオフ: 投票対象を 3 種以上に増やすと列が増え、Exclusive Arc は破綻する（その時は CTI へ再設計）。
- フォローアップ: `direction`（ADR-0025）が schema にはあるがマイグレーション化されていなかったドリフトを、
  本マイグレーションで冪等に補完した（`VoteDirection` enum / `direction` カラム）。
