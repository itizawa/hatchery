import { buildSummaryPrompt, selectMessagesForDay } from "@hatchery/common";

import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import type { ChannelRepository } from "../persistence/channelRepository.js";
import type { MessageRepository } from "../persistence/messageRepository.js";
import { getApiKey } from "../utils/apiKey.js";

import { generateSummaryWithClaude, type SummaryGenerator } from "./aiMessageGenerator.js";

/** あらすじ更新バッチの依存（#53）。 */
export interface RunSummaryBatchDeps {
  channelRepo: ChannelRepository;
  messageRepo: MessageRepository;
  appSettingRepo: AppSettingRepository;
  /** テスト用に注入可能な要約生成関数。省略時は Claude を使う。 */
  summarize?: SummaryGenerator;
  /** 「当日」の基準時刻（既定 現在時刻）。テストで固定するため注入可能。 */
  now?: Date;
}

/**
 * あらすじ更新バッチ（#53）。1 日 1 回、当日作成されたメッセージを要約して
 * 各チャンネルの summary を更新する（会話生成バッチとは別スケジュール）。
 * 更新したチャンネル id の配列を返す。
 *
 * エラーハンドリング:
 * - API キー未設定 → スキップ（空配列）。
 * - チャンネル単位の失敗 → ログを残し次チャンネルへ継続。
 */
export async function runSummaryBatch(deps: RunSummaryBatchDeps): Promise<string[]> {
  const apiKey = await getApiKey(deps.appSettingRepo);
  if (!apiKey) {
    console.error("[summaryBatch] API キーが設定されていないためスキップします");
    return [];
  }

  const summarize = deps.summarize ?? generateSummaryWithClaude;
  const now = deps.now ?? new Date();

  // 当日 0 時を起点に取得し、チャンネル肥大時も全履歴ロードを避ける（取得後に正確な当日分へ絞る）。
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const channels = await deps.channelRepo.list();
  const updated: string[] = [];
  for (const channel of channels) {
    try {
      const sinceToday = await deps.messageRepo.listByChannelSince(channel.id, startOfDay);
      const todays = selectMessagesForDay(sinceToday, now);
      if (todays.length === 0) continue;

      const previous = await deps.channelRepo.getSummary(channel.id);
      const prompt = buildSummaryPrompt({
        channelLabel: channel.label,
        previousSummary: previous?.summary ?? null,
        messages: todays.map((m) => ({ speaker: m.speaker, text: m.text })),
      });

      const summary = await summarize(prompt, apiKey);
      await deps.channelRepo.updateSummary(channel.id, summary);
      updated.push(channel.id);
    } catch (err) {
      console.error(`[summaryBatch] チャンネル ${channel.id} のあらすじ更新に失敗しました:`, err);
    }
  }

  return updated;
}
