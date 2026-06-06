-- CreateEnum
CREATE TYPE "BatchRunLogStatus" AS ENUM ('success', 'failure');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE "BatchRunLog" (
    "id" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "BatchRunLogStatus" NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorCode" TEXT,

    CONSTRAINT "BatchRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchRunLog_executedAt_idx" ON "BatchRunLog"("executedAt");
