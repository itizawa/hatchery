-- AlterTable: Community に外部フィード URL カラムを追加（#491 / ADR-0035）
ALTER TABLE "Community" ADD COLUMN "feedUrl" TEXT;
