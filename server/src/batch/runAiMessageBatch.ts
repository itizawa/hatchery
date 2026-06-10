import {
  buildChannelConversationPrompt,
  calcPostedAtOffsets,
  formatRecentLog,
  parseConversationMessages,
  type Message,
} from "@hatchery/common";

import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import type { BatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import type { ChannelMembershipRepository } from "../persistence/channelMembershipRepository.js";
import type { ChannelRepository } from "../persistence/channelRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import type { MessageRecord, MessageRepository } from "../persistence/messageRepository.js";
import { getApiKey } from "../utils/apiKey.js";

import { generateConversationWithClaude, type ConversationGenerator } from "./aiMessageGenerator.js";

/** プロンプトに載せる直近メッセージの既定件数（#53）。 */
const DEFAULT_RECENT_LIMIT = 30;

/** AI 会話生成バッチの依存。永続化・生成器を注入する（#53）。 */
export interface RunAiMessageBatchDeps {
  channelRepo: ChannelRepository;
  messageRepo: MessageRepository;
  membershipRepo: ChannelMembershipRepository;
  workerRepo: WorkerRepository;
  appSettingRepo: AppSettingRepository;
  /** バッチ実行ログの永続化（省略時はログ保存しない）。 */
  batchRunLogRepository?: BatchRunLogRepository;
  /** テスト用に注入可能な会話生成関数。省略時は Claude を使う。 */
  generate?: ConversationGenerator;
  /** プロンプトに載せる直近メッセージ件数（既定 30）。 */
  recentLimit?: number;
}

/**
 * 定時バッチ本体（#53 / #284）。goal.type='chat' の各チャンネルで、所属する AI 社員（isBot=true）の
 * 掛け合い会話を 1 API コールで生成・検証し、channel 紐づきで永続化する（ADR-0016）。
 * Express を一切 import しない＝API プロセスと独立に起動できる（ADR-0004 / ADR-0009）。
 *
 * エラーハンドリング:
 * - API キー未設定 → 何も生成せず空配列（スキップ）。
 * - チャンネル単位の失敗（生成エラー・JSON 不正など）→ リトライせずログを残し次チャンネルへ。
 */
export async function runAiMessageBatch(deps: RunAiMessageBatchDeps): Promise<MessageRecord[]> {
  const apiKey = await getApiKey(deps.appSettingRepo);
  if (!apiKey) {
    console.error("[aiMessageBatch] API キーが設定されていないためスキップします");
    return [];
  }

  const generate = deps.generate ?? generateConversationWithClaude;
  const recentLimit = deps.recentLimit ?? DEFAULT_RECENT_LIMIT;

  const channels = await deps.channelRepo.list();
  const chatChannels = channels.filter((c) => c.goal.type === "chat");

  const saved: MessageRecord[] = [];
  const errors: string[] = [];
  for (const channel of chatChannels) {
    try {
      const memberIds = await deps.membershipRepo.listEmployeeIdsByChannel(channel.id);
      const members = await deps.workerRepo.listByIds(memberIds);
      const bots = members.filter((e) => e.isBot);
      if (bots.length === 0) continue;

      const recentDesc = await deps.messageRepo.listRecentByChannel(channel.id, recentLimit);
      const recentAsc = [...recentDesc].reverse();
      // MessageRecord → RecentEntry に変換（ADR-0019 移行期: #305/#306 で server 側を刷新後に整理）
      const recentLog = formatRecentLog(
        recentAsc.map((m) => ({
          community_id: m.channel,
          author: m.createdEmployeeId,
          text: m.text,
        })),
        recentLimit,
      );
      const summaryEntry = await deps.channelRepo.getSummary(channel.id);

      const prompt = buildChannelConversationPrompt({
        channelLabel: channel.label,
        workers: bots.map((e) => ({
          id: e.id,
          displayName: e.displayName,
          role: e.role,
          personality: e.personality,
        })),
        recentLog,
        summary: summaryEntry?.summary ?? null,
      });

      const raw = await generate(prompt, apiKey);
      const messages: Message[] = parseConversationMessages(
        raw,
        channel.id,
        bots.map((e) => e.id),
      );
      if (messages.length === 0) continue;

      const batchTime = new Date();
      const postedAts = calcPostedAtOffsets(batchTime, messages.length);
      const created = await deps.messageRepo.createMany(
        messages.map((m, i) => ({ ...m, postedAt: postedAts[i] })),
      );
      saved.push(...created);
    } catch (err) {
      // リトライせず、ログを残して次チャンネルへ。失敗はバッチ実行ログに集約して監視可能にする。
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[aiMessageBatch] チャンネル ${channel.id} の会話生成に失敗しました:`, err);
      errors.push(`${channel.id}: ${message}`);
    }
  }

  // 1 チャンネルでも失敗していれば failure として記録し、監視で『正常だが投稿ゼロ』と区別できるようにする。
  await deps.batchRunLogRepository?.create({
    status: errors.length > 0 ? "failure" : "success",
    messageCount: saved.length,
    errorMessage: errors.length > 0 ? errors.join("; ") : null,
    errorCode: null,
  });

  return saved;
}
