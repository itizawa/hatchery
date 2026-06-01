# 設計書: fix: マイグレーション順序バグ（remove_scene が init より前に走り migrate deploy が失敗する） (#92)

## 1. 目的 / 背景

`server/prisma/migrations/` のマイグレーションがタイムスタンプ昇順に実行される Prisma の仕様に対し、
`remove_scene_direct_message_channel` のタイムスタンプ `20260530000000` が `init`（`20260530112931`）より
古くなっているため、クリーン DB では `prisma migrate deploy` / `migrate reset` が必ず失敗する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `20260530000000_remove_scene_direct_message_channel` を `20260530120000_remove_scene_direct_message_channel` にリネームする（SQL 内容の変更なし）

**やらないこと:**
- SQL の内容変更
- 他のマイグレーションの変更
- `_prisma_migrations` テーブルの既存レコードの更新（クリーン構築前提のため不要）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- マイグレーションディレクトリ名がタイムスタンプ昇順 = 依存順に並んでいる
  - `20260530112931_init` < `20260530120000_remove_scene_direct_message_channel` < `20260530200000_add_user_model`
- CI（test/lint）が緑

## 4. 設計方針

Prisma はマイグレーションをディレクトリ名のアルファベット昇順（= タイムスタンプ昇順）で適用する。
`remove_scene` は `init` で作成された `Message`/`Scene` テーブルに依存するため、
`init` の後・`add_user_model` の前のタイムスタンプ `20260530120000` へリネームする。

依存順（修正後）:
1. `20260530112931_init`
2. `20260530120000_remove_scene_direct_message_channel`（旧: `20260530000000`）
3. `20260530200000_add_user_model`
4. `20260531000000_add_channel_employee`
5. `20260601000000_add_employee_isbot_userid`
6. `20260601100000_add_employee_personality`

## 5. 影響範囲 / 既存への変更

- **`server/`**: `prisma/migrations/` 内のディレクトリ名変更のみ
- `_prisma_migrations` に旧名で記録がある開発環境では `migrate reset` が必要（備考参照）

## 6. テスト計画

本 Issue は CI の test/lint 通過を受け入れ条件とする。
DB を伴う統合テストは `DATABASE_URL` が無い CI 環境でスキップされる既存の挙動に従う。

## 7. リスク・未決事項

- 旧名（`20260530000000_...`）で `_prisma_migrations` に記録がある既存環境では `migrate reset --force` が必要。
  現状はクリーン構築前提のため影響は限定的。
