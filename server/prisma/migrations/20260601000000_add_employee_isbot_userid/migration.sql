-- Issue #49: Employee に isBot フラグと User との 1:1 リレーション（userId）を追加

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
