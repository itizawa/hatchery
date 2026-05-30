import type { ChannelMembershipRepository } from "../persistence/channelMembershipRepository.js";

/** チャンネルに Employee を追加する（入力検証はルート層の validateBody で済んでいる前提）。 */
export function addChannelMember(
  repo: ChannelMembershipRepository,
  channelId: string,
  employeeId: string,
): Promise<void> {
  return repo.addMember(channelId, employeeId);
}

/** チャンネルから Employee を除外する。 */
export function removeChannelMember(
  repo: ChannelMembershipRepository,
  channelId: string,
  employeeId: string,
): Promise<void> {
  return repo.removeMember(channelId, employeeId);
}
