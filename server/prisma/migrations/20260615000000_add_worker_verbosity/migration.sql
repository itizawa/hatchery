-- AlterTable
-- #625: ワーカーごとの文章量設定（verbosity）を追加する。
-- 既存行は既定値 'standard' で埋まる。
ALTER TABLE "workers" ADD COLUMN "verbosity" TEXT NOT NULL DEFAULT 'standard';
