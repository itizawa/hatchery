import type { Message, MessageRecord } from "@hatchery/common";

/**
 * 永続化された 1 発言。common の MessageRecordSchema を単一情報源とする（#40 / ADR-0005）。
 * 以前 server で独立定義していたインターフェースを common 由来の型に統合した。
 */
export type { MessageRecord };

/** #企画 チャンネルの UX 提案メッセージ作成入力（#76）。 */
export interface PlanningMessageInput {
  speaker: string;
  channel: string;
  text: string;
  proposalTitle: string;
  proposalReason: string;
  proposalTargetUrl: string;
}

function cloneRecord(record: MessageRecord): MessageRecord {
  return { ...record };
}

/**
 * メッセージの永続化境界（ポート）。ユースケースはこのインターフェースにのみ依存し、
 * 具体実装（Prisma / InMemory）を注入する（ADR-0004 の層分離 / ADR-0009）。
 */
export interface MessageRepository {
  list(): Promise<MessageRecord[]>;
  createMany(input: Message[]): Promise<MessageRecord[]>;
  /** channelId でフィルタリングしたメッセージ一覧を返す（#48）。 */
  listByChannel(channelId: string): Promise<MessageRecord[]>;
  /** UX 提案メッセージを 1 件作成する（#76）。 */
  createPlanningMessage(input: PlanningMessageInput): Promise<MessageRecord>;
  /** GitHub Issue 起票後にメッセージの issueNumber / issueUrl を更新する（#76）。 */
  updateIssueRef(id: string, issueNumber: number, issueUrl: string): Promise<MessageRecord | null>;
}

/** DB 非依存のインメモリ実装。ユースケース/ルートのテストで注入する。 */
export class InMemoryMessageRepository implements MessageRepository {
  private readonly records: MessageRecord[] = [];
  private seq = 0;

  list(): Promise<MessageRecord[]> {
    return Promise.resolve(this.records.map(cloneRecord));
  }

  createMany(input: Message[]): Promise<MessageRecord[]> {
    const created = input.map((m, index) => {
      this.seq += 1;
      const record: MessageRecord = {
        id: `mem-${this.seq}`,
        speaker: m.speaker,
        channel: m.channel,
        text: m.text,
        createdAt: new Date(0),
        order: index,
      };
      this.records.push(record);
      return cloneRecord(record);
    });
    return Promise.resolve(created);
  }

  listByChannel(channelId: string): Promise<MessageRecord[]> {
    return Promise.resolve(
      this.records.filter((r) => r.channel === channelId).map(cloneRecord),
    );
  }

  createPlanningMessage(input: PlanningMessageInput): Promise<MessageRecord> {
    this.seq += 1;
    const record: MessageRecord = {
      id: `mem-${this.seq}`,
      speaker: input.speaker,
      channel: input.channel,
      text: input.text,
      createdAt: new Date(0),
      order: 0,
      proposalTitle: input.proposalTitle,
      proposalReason: input.proposalReason,
      proposalTargetUrl: input.proposalTargetUrl,
    };
    this.records.push(record);
    return Promise.resolve(cloneRecord(record));
  }

  updateIssueRef(id: string, issueNumber: number, issueUrl: string): Promise<MessageRecord | null> {
    const record = this.records.find((r) => r.id === id);
    if (!record) {
      return Promise.resolve(null);
    }
    record.issueNumber = issueNumber;
    record.issueUrl = issueUrl;
    return Promise.resolve(cloneRecord(record));
  }
}
