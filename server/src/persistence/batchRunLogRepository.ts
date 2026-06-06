import type { BatchRunLogRecord } from "@hatchery/common";

export interface BatchRunLogInput {
  status: "success" | "failure";
  messageCount?: number;
  errorMessage?: string;
  errorCode?: string;
}

export interface BatchRunLogRepository {
  create(input: BatchRunLogInput): Promise<BatchRunLogRecord>;
  listRecent(limit: number): Promise<BatchRunLogRecord[]>;
}

export class InMemoryBatchRunLogRepository implements BatchRunLogRepository {
  private readonly records: BatchRunLogRecord[] = [];
  private seq = 0;

  async create(input: BatchRunLogInput): Promise<BatchRunLogRecord> {
    this.seq += 1;
    const record: BatchRunLogRecord = {
      id: `mem-log-${this.seq}`,
      executedAt: new Date(),
      status: input.status,
      messageCount: input.messageCount ?? null,
      errorMessage: input.errorMessage ?? null,
      errorCode: input.errorCode ?? null,
    };
    this.records.push(record);
    return { ...record };
  }

  async listRecent(limit: number): Promise<BatchRunLogRecord[]> {
    return [...this.records]
      .reverse()
      .slice(0, limit)
      .map((r) => ({ ...r }));
  }
}
