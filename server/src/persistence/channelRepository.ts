import { DEFAULT_CHANNELS } from "@hatchery/common";
import type { Channel } from "@hatchery/common";

export interface ChannelRepository {
  updateLabel(id: string, label: string): Promise<Channel | null>;
}

/** DB 非依存のインメモリ実装。ルートのテストで注入する。既定は DEFAULT_CHANNELS で初期化。 */
export class InMemoryChannelRepository implements ChannelRepository {
  private readonly channels: Channel[];

  constructor(channels: Channel[] = DEFAULT_CHANNELS.map((c) => ({ ...c }))) {
    this.channels = channels;
  }

  async updateLabel(id: string, label: string): Promise<Channel | null> {
    const channel = this.channels.find((c) => c.id === id);
    if (!channel) return null;
    channel.label = label;
    return { ...channel };
  }
}
