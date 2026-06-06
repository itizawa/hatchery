-- #76: 企画チャンネル追加と UX 提案メッセージフィールドの追加。

-- ChannelType enum に planning を追加する。
ALTER TYPE "ChannelType" ADD VALUE IF NOT EXISTS 'planning';

-- Message テーブルに UX 提案用 optional フィールドを追加する。
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "proposalTitle" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "proposalReason" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "proposalTargetUrl" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "issueNumber" INTEGER;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "issueUrl" TEXT;
