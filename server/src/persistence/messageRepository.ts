import type { Message, MessageRecord } from "@hatchery/common";

/**
 * 永続化された 1 発言。common の MessageRecordSchema を単一情報源とする（#40 / ADR-0005）。
 * 以前 server で独立定義していたインターフェースを common 由来の型に統合した。
 */
export type { MessageRecord };

/** 企画 チャンネルの UX 提案メッセージ作成入力（#76）。 */
export interface PlanningMessageInput {
  createdEmployeeId: string;
  channel: string;
  text: string;
  proposalTitle: string;
  proposalReason: string;
  proposalTargetUrl: string;
}

/**
 * メッセージ作成入力（#183）。Message に optional な postedAt を加えたもの。
 * postedAt 省略時はサーバ側で保存時刻（now）をセットする。
 * Message 型（common）は postedAt を持たないため代入可能。
 */
export interface MessageCreateInput extends Message {
  postedAt?: Date;
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
  /** メッセージを一括作成する。postedAt は MessageCreateInput で指定可。省略時は now。 */
  createMany(input: MessageCreateInput[]): Promise<MessageRecord[]>;
  /** channelId でフィルタリングし postedAt <= now のメッセージを返す（#183）。 */
  listByChannel(channelId: string): Promise<MessageRecord[]>;
  /** channel の直近 limit 件を新しい順（createdAt 降順）で返す（#53・会話生成の文脈用）。 */
  listRecentByChannel(channelId: string, limit: number): Promise<MessageRecord[]>;
  /** channel の createdAt >= since のメッセージを時系列昇順で返す（#53・あらすじ更新の当日分取得用）。 */
  listByChannelSince(channelId: string, since: Date): Promise<MessageRecord[]>;
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

  createMany(input: MessageCreateInput[]): Promise<MessageRecord[]> {
    const created = input.map((m, index) => {
      this.seq += 1;
      const record: MessageRecord = {
        id: `mem-${this.seq}`,
        createdEmployeeId: m.createdEmployeeId,
        channel: m.channel,
        text: m.text,
        createdAt: new Date(0),
        postedAt: m.postedAt ?? new Date(0),
        order: index,
      };
      this.records.push(record);
      return cloneRecord(record);
    });
    return Promise.resolve(created);
  }

  listByChannel(channelId: string): Promise<MessageRecord[]> {
    const now = new Date();
    return Promise.resolve(
      this.records
        .filter((r) => r.channel === channelId && r.postedAt.getTime() <= now.getTime())
        .sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime() || a.order - b.order)
        .map(cloneRecord),
    );
  }

  listRecentByChannel(channelId: string, limit: number): Promise<MessageRecord[]> {
    const recent = this.records
      .map((r, idx) => ({ r, idx }))
      .filter((x) => x.r.channel === channelId)
      // createdAt 降順、同時刻は挿入順の新しい方を優先（InMemory は createdAt が一律のため挿入順が効く）。
      .sort((a, b) => b.r.createdAt.getTime() - a.r.createdAt.getTime() || b.idx - a.idx)
      .slice(0, Math.max(0, limit))
      .map((x) => cloneRecord(x.r));
    return Promise.resolve(recent);
  }

  listByChannelSince(channelId: string, since: Date): Promise<MessageRecord[]> {
    return Promise.resolve(
      this.records
        .filter((r) => r.channel === channelId && r.createdAt.getTime() >= since.getTime())
        .map(cloneRecord),
    );
  }

  createPlanningMessage(input: PlanningMessageInput): Promise<MessageRecord> {
    this.seq += 1;
    const record: MessageRecord = {
      id: `mem-${this.seq}`,
      createdEmployeeId: input.createdEmployeeId,
      channel: input.channel,
      text: input.text,
      createdAt: new Date(0),
      postedAt: new Date(0),
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
