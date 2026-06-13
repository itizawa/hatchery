-- #453 / ADR-0031: Vote の多態参照（targetType, targetId）を Exclusive Arc へ移行する。
-- postId? / commentId? の本物 FK（onDelete CASCADE）にし、CHECK 制約で
-- 「ちょうど片方だけ非 null」を強制する。既存 vote データは backfill で欠損なく移行する。
--
-- 手順（順序重要・カラム drop の前に必ず backfill する）:
--   0. VoteDirection enum / direction カラムを冪等に補完（ADR-0025 で schema には入ったが
--      マイグレーション化されておらず、フレッシュ DB に存在しない欠落を埋める）
--   1. postId / commentId カラムを nullable で追加
--   2. 既存行を targetType に応じて backfill（post→postId, comment→commentId）
--   3. 旧ユニーク制約 / index / targetType / targetId カラム / VoteTargetType enum を drop
--   4. FK（CASCADE）・新ユニーク制約・新 index・CHECK 制約を追加

-- 0. ADR-0025（down vote）の direction を冪等に補完する。
--    既にデプロイ済み DB では存在するため IF NOT EXISTS / 例外捕捉で二重適用を避ける。
DO $$
BEGIN
    CREATE TYPE "VoteDirection" AS ENUM ('up', 'down');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END$$;

ALTER TABLE "Vote" ADD COLUMN IF NOT EXISTS "direction" "VoteDirection" NOT NULL DEFAULT 'up';

-- 1. 新カラム追加（まず nullable）
ALTER TABLE "Vote" ADD COLUMN "postId" TEXT;
ALTER TABLE "Vote" ADD COLUMN "commentId" TEXT;

-- 2. 既存データの backfill（stg / 本番の既存 vote を欠損なく移行する）
UPDATE "Vote" SET "postId" = "targetId" WHERE "targetType" = 'post';
UPDATE "Vote" SET "commentId" = "targetId" WHERE "targetType" = 'comment';

-- 3. 旧 index / ユニーク制約 / 多態参照カラム / enum を drop
DROP INDEX "Vote_userId_targetType_targetId_key";
DROP INDEX "Vote_targetType_targetId_idx";
ALTER TABLE "Vote" DROP COLUMN "targetType";
ALTER TABLE "Vote" DROP COLUMN "targetId";
DROP TYPE "VoteTargetType";

-- 4a. 本物 FK（Post / Comment への参照・onDelete CASCADE）
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4b. 二重投票防止のユニーク制約（NULL は PostgreSQL の一意制約上区別されるため両立する）
CREATE UNIQUE INDEX "Vote_userId_postId_key" ON "Vote"("userId", "postId");
CREATE UNIQUE INDEX "Vote_userId_commentId_key" ON "Vote"("userId", "commentId");

-- 4c. 集計 JOIN 用の index
CREATE INDEX "Vote_postId_idx" ON "Vote"("postId");
CREATE INDEX "Vote_commentId_idx" ON "Vote"("commentId");

-- 4d. Exclusive Arc: ちょうど片方だけ非 null を強制する CHECK 制約
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_exclusive_arc"
    CHECK ((("postId" IS NOT NULL)::int + ("commentId" IS NOT NULL)::int) = 1);
