-- AlterTable: Comment にまとめコメントフラグを追加（#1165）
ALTER TABLE "Comment" ADD COLUMN "isSummary" BOOLEAN NOT NULL DEFAULT false;
