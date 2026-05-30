import type { MessageRecord, MessageRepository } from "../persistence/messageRepository.js";

/** 保存済みメッセージの一覧を返すユースケース。 */
export function listMessages(repo: MessageRepository): Promise<MessageRecord[]> {
  return repo.list();
}
