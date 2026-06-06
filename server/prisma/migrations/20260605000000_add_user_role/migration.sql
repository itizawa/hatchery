-- #136: ユーザー権限ロール（admin / member）の追加。
-- 既存 User は全員 admin にバックフィルする（ロックアウト防止）。
-- 新規ユーザー（招待受諾）は既定 member として登録される。

-- 1. UserRole enum を作成する。
CREATE TYPE "UserRole" AS ENUM ('admin', 'member');

-- 2. role カラムを nullable で追加する（バックフィル前なので NOT NULL にできない）。
ALTER TABLE "User" ADD COLUMN "role" "UserRole";

-- 3. 既存 User を全員 admin にバックフィルする。
UPDATE "User" SET "role" = 'admin';

-- 4. role カラムを NOT NULL + DEFAULT member に変更する。
ALTER TABLE "User" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'member';
