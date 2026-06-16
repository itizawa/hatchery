-- #554: Vote テーブルに createdAt インデックスを追加する。
-- netScoresByCommunitySince の WHERE v."createdAt" >= $since フィルタを効率化する。
-- Issue 原文の (targetType, createdAt) は #453 Exclusive Arc 移行で targetType が削除済みのため、
-- 等価最適化として createdAt 単体インデックスを追加する。

CREATE INDEX "Vote_createdAt_idx" ON "Vote"("createdAt");
