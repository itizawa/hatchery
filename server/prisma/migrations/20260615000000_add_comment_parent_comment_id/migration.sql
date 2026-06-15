-- AlterTable: Comment に parentCommentId（自己参照）を追加する（#520）。
-- 既存データは全件 null（互換）。

ALTER TABLE "Comment" ADD COLUMN "parentCommentId" TEXT;

-- 自己参照 FK: parentCommentId → Comment.id（SetNull on delete）
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentCommentId_fkey"
  FOREIGN KEY ("parentCommentId") REFERENCES "Comment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- インデックス
CREATE INDEX "Comment_parentCommentId_idx" ON "Comment"("parentCommentId");
