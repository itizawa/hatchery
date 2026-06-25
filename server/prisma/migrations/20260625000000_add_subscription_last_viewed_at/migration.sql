-- AlterTable: Subscription に lastViewedAt を追加（#933）
ALTER TABLE "Subscription" ADD COLUMN "lastViewedAt" TIMESTAMP(3);
