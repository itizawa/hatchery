-- Issue #33: Employee ↔ Channel の所属（多対多）中間テーブルを追加
CREATE TABLE "ChannelEmployee" (
    "channelId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "ChannelEmployee_pkey" PRIMARY KEY ("channelId","employeeId")
);

-- CreateIndex
CREATE INDEX "ChannelEmployee_employeeId_idx" ON "ChannelEmployee"("employeeId");

-- AddForeignKey
ALTER TABLE "ChannelEmployee" ADD CONSTRAINT "ChannelEmployee_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelEmployee" ADD CONSTRAINT "ChannelEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
