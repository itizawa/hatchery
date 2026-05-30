import type { Message } from "@hatchery/common";

import type { MessageRecord, MessageRepository } from "../persistence/messageRepository.js";

/** 複数メッセージを一括永続化するユースケース。入力検証はルート層の validateBody で済んでいる前提。 */
export function createMessages(repo: MessageRepository, input: Message[]): Promise<MessageRecord[]> {
  return repo.createMany(input);
}
