-- Migration: 公共コミュニティモデルへの移行（#305 / ADR-0019 / ADR-0020）
-- 旧モデル（Message / Channel / ChannelEmployee / Task）を削除し、
-- 新モデル（Community / Post / Comment / Subscription / WorldState / Vote）を追加する。
--
-- ⚠️ 注意: このマイグレーションは既存のデータを破壊します。
-- 開発環境では `prisma migrate reset` または `prisma migrate dev` を使用してください。

-- 旧テーブルの削除
DROP TABLE IF EXISTS "Message" CASCADE;
DROP TABLE IF EXISTS "ChannelEmployee" CASCADE;
DROP TABLE IF EXISTS "Channel" CASCADE;
DROP TABLE IF EXISTS "Task" CASCADE;
DROP TYPE IF EXISTS "ChannelType";
DROP TYPE IF EXISTS "ChannelGoalType";
DROP TYPE IF EXISTS "TaskStatus";

-- User テーブルに新リレーション（subscriptions / votes）の準備
-- （既存 User テーブルは継続。新リレーションは FK で追加）

-- Community テーブル
CREATE TABLE "Community" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "synopsis" TEXT,
    "lastSlotKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

-- Post テーブル
CREATE TABLE "Post" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "communityId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "author" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Post_communityId_slotKey_seq_key" ON "Post"("communityId", "slotKey", "seq");
CREATE INDEX "Post_communityId_createdAt_idx" ON "Post"("communityId", "createdAt");

ALTER TABLE "Post" ADD CONSTRAINT "Post_communityId_fkey"
    FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comment テーブル
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "communityId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "author" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Comment_communityId_slotKey_seq_key" ON "Comment"("communityId", "slotKey", "seq");
CREATE INDEX "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt");

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_communityId_fkey"
    FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Subscription テーブル
CREATE TABLE "Subscription" (
    "userId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("userId","communityId")
);

CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_communityId_fkey"
    FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WorldState テーブル（グローバルシングルトン）
CREATE TABLE "WorldState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "summaryVersion" INTEGER NOT NULL DEFAULT 0,
    "workerStates" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldState_pkey" PRIMARY KEY ("id")
);

-- VoteTargetType enum と Vote テーブル
CREATE TYPE "VoteTargetType" AS ENUM ('post', 'comment');

CREATE TABLE "Vote" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "targetType" "VoteTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Vote_userId_targetType_targetId_key" ON "Vote"("userId", "targetType", "targetId");
CREATE INDEX "Vote_targetType_targetId_idx" ON "Vote"("targetType", "targetId");

ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_post_fkey"
    FOREIGN KEY ("targetId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE
    DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_comment_fkey"
    FOREIGN KEY ("targetId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE
    DEFERRABLE INITIALLY DEFERRED;
