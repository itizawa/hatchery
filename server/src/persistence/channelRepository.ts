import { randomUUID } from "node:crypto";

import { DEFAULT_CHANNELS } from "@hatchery/common";
import type { Channel, CreateChannelInput } from "@hatchery/common";

export interface ChannelRepository {
  /** 全チャンネルを返す（GET /channels・#47）。 */
  list(): Promise<Channel[]>;
  /** チャンネルを新規作成して返す。id はサーバ側で採番する（POST /channels・#47）。 */
  create(input: CreateChannelInput): Promise<Channel>;
  updateLabel(id: string, label: string): Promise<Channel | null>;
}

/** DB 非依存のインメモリ実装。ルートのテストで注入する。既定は DEFAULT_CHANNELS で初期化。 */
export class InMemoryChannelRepository implements ChannelRepository {
  private readonly channels: Channel[];

  constructor(channels: Channel[] = DEFAULT_CHANNELS.map((c) => ({ ...c }))) {
    this.channels = channels;
  }

  async list(): Promise<Channel[]> {
    return this.channels.map((c) => ({ ...c }));
  }

  async create(input: CreateChannelInput): Promise<Channel> {
    const channel: Channel = { id: randomUUID(), label: input.label };
    this.channels.push(channel);
    return { ...channel };
  }

  async updateLabel(id: string, label: string): Promise<Channel | null> {
    const channel = this.channels.find((c) => c.id === id);
    if (!channel) return null;
    channel.label = label;
    return { ...channel };
  }
}
