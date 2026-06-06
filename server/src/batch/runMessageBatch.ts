import type { Message } from "@hatchery/common";

import type { BatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import type { MessageRecord, MessageRepository } from "../persistence/messageRepository.js";

/** メッセージ生成器。本実装は LLM コールを行うが、現在はスタブを返す（本実装はスコープ外）。 */
export type MessageGenerator = () => Message[];

/** スタブのメッセージ生成器。MVP の最小メッセージ列を返す。 */
export const stubMessageGenerator: MessageGenerator = () => [
  { speaker: "emp-1", channel: "zatsudan", text: "おはようございます。" },
  { speaker: "emp-2", channel: "zatsudan", text: "今日もよろしくお願いします！" },
];

/** 定時バッチの依存。永続化と生成器を注入する。 */
export interface RunMessageBatchDeps {
  messageRepository: MessageRepository;
  generate?: MessageGenerator;
  batchRunLogRepository?: BatchRunLogRepository;
}

/**
 * 定時バッチ本体。複数 message を生成して channel 紐づきで永続化し、保存結果を返す。
 * Express を一切 import しない＝API プロセスと独立に起動できる（ADR-0004 / ADR-0009）。
 * バッチ実行結果（成功・失敗）を batchRunLogRepository に記録する（#75）。
 */
export async function runMessageBatch(deps: RunMessageBatchDeps): Promise<MessageRecord[]> {
  const generate = deps.generate ?? stubMessageGenerator;
  const { batchRunLogRepository } = deps;

  try {
    const records = await deps.messageRepository.createMany(generate());
    await batchRunLogRepository?.create({ status: "success", messageCount: records.length });
    return records;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof Error && "code" in err ? String((err as { code: unknown }).code) : undefined;
    await batchRunLogRepository?.create({
      status: "failure",
      errorMessage: message,
      errorCode: code,
    });
    throw err;
  }
}
