-- Scene 廃止・Message を channel 直接紐づけに変更（ADR-0009 / Issue #27）。
-- 既存の Message（sceneId 外部キー付き）と Scene テーブルを削除し、
-- フラットな Message テーブルを再作成する。

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_sceneId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Message";
DROP TABLE IF EXISTS "Scene";

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_channel_createdAt_idx" ON "Message"("channel", "createdAt");
