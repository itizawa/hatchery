-- Issue #331: ADR-0020 後処理。Worker は AI 投稿者のみとなったため、
-- isBot フラグと User との 1:1 リレーション（userId / FK / unique index）を削除する。

-- DropForeignKey
ALTER TABLE "workers" DROP CONSTRAINT IF EXISTS "workers_userId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "workers_userId_key";

-- AlterTable
ALTER TABLE "workers" DROP COLUMN "isBot",
DROP COLUMN "userId";
