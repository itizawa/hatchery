-- AlterTable: User にサロゲートキー化対応の loginId カラムを追加する（#185）
-- 既存行は id（ログイン文字列）を loginId に引き継ぐ
ALTER TABLE "User" ADD COLUMN "loginId" TEXT;

-- 既存行のバックフィル: loginId = id（旧ログイン文字列を引き継ぐ）
UPDATE "User" SET "loginId" = "id";

-- loginId を NOT NULL に変更
ALTER TABLE "User" ALTER COLUMN "loginId" SET NOT NULL;

-- CreateIndex: loginId の一意制約
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");
