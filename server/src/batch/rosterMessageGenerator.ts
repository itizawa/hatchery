import {
  DEFAULT_CHANNELS,
  DEFAULT_EMPLOYEES,
  EMPLOYEE_MESSAGE_TEMPLATES,
  buildRosterMessages,
  type Employee,
  type Channel,
  type Message,
} from "@hatchery/common";

import type { MessageGenerator } from "./runMessageBatch.js";

/** createRosterMessageGenerator のオプション。既定は MVP の社員・チャンネル・テンプレート。 */
export interface RosterMessageGeneratorOptions {
  channels?: readonly Channel[];
  employees?: readonly Employee[];
  templates?: Readonly<Record<string, readonly string[]>>;
  /** 1 チャンネルあたり発言させる社員数（既定 2）。 */
  perChannel?: number;
  /** 乱数源（既定 Math.random）。テストで決定的にするため注入可能。 */
  rng?: () => number;
}

/**
 * MVP の定時バッチ用メッセージ生成器（#32）。
 * common の純粋ロジック buildRosterMessages を、既定の社員・チャンネル・静的テンプレートで束ねる。
 * AI 生成への差し替えは別 Issue（#53）。それまでは静的テンプレートからランダムに選ぶ。
 */
export function createRosterMessageGenerator(
  options: RosterMessageGeneratorOptions = {},
): MessageGenerator {
  const channels = options.channels ?? DEFAULT_CHANNELS;
  const employees = options.employees ?? DEFAULT_EMPLOYEES;
  const templates = options.templates ?? EMPLOYEE_MESSAGE_TEMPLATES;
  const perChannel = options.perChannel ?? 2;
  const rng = options.rng ?? Math.random;

  return (): Message[] =>
    buildRosterMessages({
      channels: channels.map((c) => c.id),
      employees,
      templates,
      perChannel,
      rng,
    });
}
