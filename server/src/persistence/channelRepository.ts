import { DEFAULT_CHANNELS } from "@hatchery/common";
import type { Channel } from "@hatchery/common";

export interface ChannelRepository {
  findById(id: string): Promise<Channel | null>;
  updateLabel(id: string, label: string): Promise<Channel | null>;
}

/** DB 非依存のインメモリ実装。ルートのテストで注入する。既定は DEFAULT_CHANNELS で初期化。 */
export class InMemoryChannelRepository implements ChannelRepository {
  private readonly channels: Channel[];

  constructor(channels: Channel[] = DEFAULT_CHANNELS.map((c) => ({ ...c }))) {
    this.channels = channels;
  }

  async findById(id: string): Promise<Channel | null> {
    return this.channels.find((c) => c.id === id) ?? null;
  }

  async updateLabel(id: string, label: string): Promise<Channel | null> {
    const channel = this.channels.find((c) => c.id === id);
    if (!channel) return null;
    channel.label = label;
    return { ...channel };
  }
}
