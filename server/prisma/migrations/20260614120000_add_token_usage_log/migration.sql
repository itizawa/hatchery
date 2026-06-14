-- CreateTable
-- #509: schema.prisma の TokenUsageLog モデルに対応する migration が欠落しており
-- （migrate deploy だけではテーブルが作られず）統合テストが落ちていたため補完する。
CREATE TABLE "TokenUsageLog" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "batchRunLogId" TEXT,

    CONSTRAINT "TokenUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenUsageLog_occurredAt_idx" ON "TokenUsageLog"("occurredAt");
