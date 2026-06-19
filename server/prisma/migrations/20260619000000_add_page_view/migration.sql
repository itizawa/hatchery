-- #665 / ADR-0032: PageView テーブルを追加し、Post / Comment に viewCount カラムを追加する。
-- ADR-0031（Vote Exclusive Arc）と同じ作法で postId / commentId の FK + CHECK + unique を設定する。

-- 1. Post / Comment に viewCount カラムを追加（累積閲覧数・デフォルト 0）
ALTER TABLE "Post"    ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Comment" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

-- 2. PageView テーブルを作成
CREATE TABLE "PageView" (
    "id"        TEXT NOT NULL,
    "postId"    TEXT,
    "commentId" TEXT,
    "userId"    TEXT,
    "sessionId" TEXT NOT NULL,
    "viewedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- 3. FK（CASCADE）を追加
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. セッション単位 dedup のユニーク制約（NULL を区別する PostgreSQL の仕様で postId / commentId が両立する）
CREATE UNIQUE INDEX "PageView_postId_sessionId_key"    ON "PageView"("postId", "sessionId");
CREATE UNIQUE INDEX "PageView_commentId_sessionId_key" ON "PageView"("commentId", "sessionId");

-- 5. 集計 JOIN 用の index
CREATE INDEX "PageView_postId_idx"    ON "PageView"("postId");
CREATE INDEX "PageView_commentId_idx" ON "PageView"("commentId");
CREATE INDEX "PageView_viewedAt_idx"  ON "PageView"("viewedAt");

-- 6. Exclusive Arc: ちょうど片方だけ非 null を強制する CHECK 制約（ADR-0031 と同手順）
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_exclusive_arc"
    CHECK ((("postId" IS NOT NULL)::int + ("commentId" IS NOT NULL)::int) = 1);
