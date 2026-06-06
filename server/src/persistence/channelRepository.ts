import { randomUUID } from "node:crypto";

import { DEFAULT_CHANNELS } from "@hatchery/common";
import type { Channel, CreateChannelInput, UpdateChannelInput } from "@hatchery/common";

export interface ChannelRepository {
  /** 全チャンネルを返す（GET /channels・#47）。 */
  list(): Promise<Channel[]>;
  /** チャンネルを新規作成して返す。id はサーバ側で採番する（POST /channels・#47）。 */
  create(input: CreateChannelInput): Promise<Channel>;
  /** label / type を部分更新して返す。存在しない場合は null（PATCH /channels/:id・#54）。 */
  update(id: string, input: UpdateChannelInput): Promise<Channel | null>;
  /** id でチャンネルを 1 件取得する。存在しない場合は null（#48）。 */
  findById(id: string): Promise<Channel | null>;
  /**
   * チャンネルのあらすじ（要約）と更新日時を取得する（#53）。
   * 未設定のチャンネルは { summary: null, summaryUpdatedAt: null }、存在しないチャンネルは null。
   */
  getSummary(channelId: string): Promise<ChannelSummary | null>;
  /** チャンネルのあらすじを更新する（summaryUpdatedAt は現在時刻で更新）（#53）。 */
  updateSummary(channelId: string, summary: string): Promise<void>;
}

/** チャンネルのあらすじ（要約）と更新日時（#53）。API には公開しないバッチ内部の文脈。 */
export interface ChannelSummary {
  summary: string | null;
  summaryUpdatedAt: Date | null;
}

/** DB 非依存のインメモリ実装。ルートのテストで注入する。既定は DEFAULT_CHANNELS で初期化。 */
export class InMemoryChannelRepository implements ChannelRepository {
  private readonly channels: Channel[];
  private readonly summaries = new Map<string, ChannelSummary>();

  constructor(channels: Channel[] = DEFAULT_CHANNELS.map((c) => ({ ...c }))) {
    this.channels = channels;
  }

  async list(): Promise<Channel[]> {
    return this.channels.map((c) => ({ ...c }));
  }

  async create(input: CreateChannelInput): Promise<Channel> {
    const channel: Channel = { id: randomUUID(), label: input.label, type: input.type };
    this.channels.push(channel);
    return { ...channel };
  }

  async update(id: string, input: UpdateChannelInput): Promise<Channel | null> {
    const channel = this.channels.find((c) => c.id === id);
    if (!channel) return null;
    if (input.label !== undefined) channel.label = input.label;
    if (input.type !== undefined) channel.type = input.type;
    return { ...channel };
  }

  async findById(id: string): Promise<Channel | null> {
    return this.channels.find((c) => c.id === id) ?? null;
  }

  async getSummary(channelId: string): Promise<ChannelSummary | null> {
    if (!this.channels.some((c) => c.id === channelId)) return null;
    const entry = this.summaries.get(channelId);
    return entry ? { ...entry } : { summary: null, summaryUpdatedAt: null };
  }

  async updateSummary(channelId: string, summary: string): Promise<void> {
    this.summaries.set(channelId, { summary, summaryUpdatedAt: new Date() });
  }
}
