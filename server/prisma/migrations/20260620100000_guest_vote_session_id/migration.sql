-- ゲスト vote 対応: sessionId を dedup キーに、userId を nullable に変更する（#777）。
-- Vote.sessionId（必須）を追加し、Vote.userId を nullable にする。
-- ユニーク制約を (userId, postId)/(userId, commentId) から (sessionId, postId)/(sessionId, commentId) に変更する。

-- Step 1: sessionId カラムを nullable で追加
ALTER TABLE "Vote" ADD COLUMN "sessionId" TEXT;

-- Step 2: 既存レコードに sessionId = userId をバックフィル
UPDATE "Vote" SET "sessionId" = "userId" WHERE "sessionId" IS NULL;

-- Step 3: sessionId を NOT NULL に変更
ALTER TABLE "Vote" ALTER COLUMN "sessionId" SET NOT NULL;

-- Step 4: 旧 userId ベースのユニーク制約を削除
DROP INDEX IF EXISTS "Vote_userId_postId_key";
DROP INDEX IF EXISTS "Vote_userId_commentId_key";

-- Step 5: 新しい sessionId ベースのユニーク制約を追加
CREATE UNIQUE INDEX "Vote_sessionId_postId_key" ON "Vote"("sessionId", "postId");
CREATE UNIQUE INDEX "Vote_sessionId_commentId_key" ON "Vote"("sessionId", "commentId");

-- Step 6: userId の外部キー制約を更新（Cascade → SetNull）
-- まず外部キー制約の名前を調べて削除し、新しい SetNull の FK を追加する
ALTER TABLE "Vote" DROP CONSTRAINT IF EXISTS "Vote_userId_fkey";
ALTER TABLE "Vote" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
