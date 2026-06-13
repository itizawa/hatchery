-- #489: ワーカーの community 参加テーブル（worker ↔ community 多対多中間）を追加する。
-- 定時バッチはこの紐づきから community ごとの登場ワーカーを DB 取得して
-- 会話生成・author 検証に使う（DEFAULT_WORKERS への直接依存を外すデータ基盤）。

CREATE TABLE "worker_communities" (
    "workerId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_communities_pkey" PRIMARY KEY ("workerId", "communityId")
);

CREATE INDEX "worker_communities_communityId_idx" ON "worker_communities"("communityId");

ALTER TABLE "worker_communities" ADD CONSTRAINT "worker_communities_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "worker_communities" ADD CONSTRAINT "worker_communities_communityId_fkey"
    FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
