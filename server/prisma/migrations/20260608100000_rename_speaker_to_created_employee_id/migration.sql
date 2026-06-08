-- Message.speaker → createdEmployeeId リネーム + Employee FK 追加（#222）
-- ai-planner は planningBatch が使用するが DEFAULT_EMPLOYEES に含まれないため、
-- FK 制約追加前に Employee として挿入する（ON CONFLICT DO NOTHING で冪等）。
INSERT INTO "Employee" ("id", "displayName", "role", "isBot")
VALUES ('ai-planner', 'AI Planner', NULL, TRUE)
ON CONFLICT ("id") DO NOTHING;

-- カラムをリネーム（既存データを保持する）。
ALTER TABLE "Message" RENAME COLUMN "speaker" TO "createdEmployeeId";

-- Employee への外部キー制約を追加（onDelete: Restrict）。
ALTER TABLE "Message" ADD CONSTRAINT "Message_createdEmployeeId_fkey"
  FOREIGN KEY ("createdEmployeeId") REFERENCES "Employee"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL は FK カラムに自動でインデックスを作らないため明示的に追加する。
CREATE INDEX "Message_createdEmployeeId_idx" ON "Message"("createdEmployeeId");
