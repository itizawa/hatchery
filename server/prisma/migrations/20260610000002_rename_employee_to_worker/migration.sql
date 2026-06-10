-- #329: Employee テーブルを workers にリネーム（Prisma モデル名も Worker へ変更）。
-- @@map("workers") により Prisma クライアントは prisma.worker として扱う。
ALTER TABLE "Employee" RENAME TO "workers";

-- インデックス・制約名を新テーブル名に合わせてリネームする。
ALTER INDEX IF EXISTS "Employee_userId_key" RENAME TO "workers_userId_key";
ALTER TABLE "workers" RENAME CONSTRAINT "Employee_userId_fkey" TO "workers_userId_fkey";
ALTER TABLE "workers" RENAME CONSTRAINT "Employee_pkey" TO "workers_pkey";
