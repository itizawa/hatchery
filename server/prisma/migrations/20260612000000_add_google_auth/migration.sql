-- Migration: Google OAuth 認証サポート追加（#343 / ADR-0027）
-- User.passwordHash を nullable 化し、User.googleId（UNIQUE）を追加する。

-- passwordHash を nullable にする（Google SSO ユーザーは passwordHash を持たない）
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- googleId カラムを追加（nullable / UNIQUE）
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
