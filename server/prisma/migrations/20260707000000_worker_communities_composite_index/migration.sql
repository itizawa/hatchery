-- #1078: worker_communities のカーソルページネーションクエリ（communityId で絞り込み、workerId 昇順で
-- 範囲比較・ソート）を単一インデックスで賄うため、communityId 単体インデックスを (communityId, workerId)
-- の複合インデックスに置き換える。

DROP INDEX "worker_communities_communityId_idx";

CREATE INDEX "worker_communities_communityId_workerId_idx" ON "worker_communities"("communityId", "workerId");
