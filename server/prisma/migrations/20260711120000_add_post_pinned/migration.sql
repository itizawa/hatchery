-- AlterTable: Post に pin 状態カラムを追加（#1089）
ALTER TABLE "Post" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN "pinnedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Post_communityId_isPinned_idx" ON "Post"("communityId", "isPinned");
