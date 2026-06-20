/*
  Warnings:

  - You are about to drop the `session` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "upCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Community" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "upCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Vote" ALTER COLUMN "id" DROP DEFAULT;

-- DropTable
DROP TABLE "session";
