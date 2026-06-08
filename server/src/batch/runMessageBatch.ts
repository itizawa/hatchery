import type { Message } from "@hatchery/common";

import type { BatchRunLogRepository } from "../persistence/batchRunLogRepository.js";
import type { MessageRecord, MessageRepository } from "../persistence/messageRepository.js";

/** メッセージ生成器。本実装は LLM コールを行うが、現在はスタブを返す（本実装はスコープ外）。 */
export type MessageGenerator = () => Message[];

/** スタブのメッセージ生成器。MVP の最小メッセージ列を返す。 */
export const stubMessageGenerator: MessageGenerator = () => [
  { createdEmployeeId: "emp-1", channel: "zatsudan", text: "おはようございます。" },
  { createdEmployeeId: "emp-2", channel: "zatsudan", text: "今日もよろしくお願いします！" },
];

/** 定時バッチの依存。永続化と生成器を注入する。 */
export interface RunMessageBatchDeps {
  messageRepository: MessageRepository;
  /** バッチ実行ログの永続化（省略時はログ保存しない）。 */
  batchRunLogRepository?: BatchRunLogRepository;
  generate?: MessageGenerator;
}

/**
 * 定時バッチ本体。複数 message を生成して channel 紐づきで永続化し、保存結果を返す。
 * Express を一切 import しない＝API プロセスと独立に起動できる（ADR-0004 / ADR-0009）。
 * 成功・失敗は batchRunLogRepository に記録する（注入されている場合のみ）。
 */
export async function runMessageBatch(deps: RunMessageBatchDeps): Promise<MessageRecord[]> {
  const generate = deps.generate ?? stubMessageGenerator;
  try {
    const records = await deps.messageRepository.createMany(generate());
    await deps.batchRunLogRepository?.create({
      status: "success",
      messageCount: records.length,
      errorMessage: null,
      errorCode: null,
    });
    return records;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorCode = (err as { code?: string }).code ?? null;
    try {
      await deps.batchRunLogRepository?.create({
        status: "failure",
        messageCount: 0,
        errorMessage,
        errorCode,
      });
    } catch {
      // ログ保存失敗は元のエラーを隠さない
    }
    throw err;
  }
}
