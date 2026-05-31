import type { Message, MessageRecord } from "@hatchery/common";

/**
 * 永続化された 1 発言。common の MessageRecordSchema を単一情報源とする（#40 / ADR-0005）。
 * 以前 server で独立定義していたインターフェースを common 由来の型に統合した。
 */
export type { MessageRecord };

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
}
