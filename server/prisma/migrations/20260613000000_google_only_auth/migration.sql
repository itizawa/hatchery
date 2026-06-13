-- Migration: Google 認証のみへ統一（#455 / ADR-0029）
-- loginId / passwordHash を削除し、email（必須・UNIQUE）と googleId を NOT NULL 化する。
-- InvitationLink テーブルを削除する。

-- 1. email カラムを追加（まず nullable で追加し、既存行にデフォルト値を埋めてから NOT NULL 化）
ALTER TABLE "User" ADD COLUMN "email" TEXT;

-- 既存行の email を googleId から仮値で埋める（移行時の NULL 回避）
UPDATE "User" SET "email" = 'migrated_' || "id" || '@placeholder.invalid' WHERE "email" IS NULL;

-- email を NOT NULL + UNIQUE にする
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- 2. googleId を NOT NULL 化（既存の nullable googleId を必須に変更）
--    NULL の行がある場合は移行不可（アプリ側で全ユーザーを Google 移行してから適用すること）
ALTER TABLE "User" ALTER COLUMN "googleId" SET NOT NULL;

-- 3. loginId カラムを削除（インデックスも自動削除される）
ALTER TABLE "User" DROP COLUMN "loginId";

-- 4. passwordHash カラムを削除
ALTER TABLE "User" DROP COLUMN "passwordHash";

-- 5. InvitationLink テーブルを削除（#455: 招待制廃止）
DROP TABLE IF EXISTS "InvitationLink";
