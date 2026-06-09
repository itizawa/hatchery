import { z } from "zod";

/** Employee ID の最大文字数（#202）。ID 系フィールドの実用的上限。 */
export const EMPLOYEE_ID_MAX_LENGTH = 100;

/**
 * チャンネルへの Employee 追加リクエストのボディ（POST /channels/:channelId/employees）。
 * channelId は URL パスから取るため、ボディは employeeId のみ（ADR-0005 / ADR-0006）。
 */
export const AddChannelMemberSchema = z.object({
  employeeId: z.string().min(1).max(EMPLOYEE_ID_MAX_LENGTH),
});

export type AddChannelMember = z.infer<typeof AddChannelMemberSchema>;

/**
 * Employee ↔ Channel の所属 1 件。多対多（1 Employee が複数チャンネルに所属可能）の最小表現。
 */
export const ChannelMembershipSchema = z.object({
  channelId: z.string().min(1),
  employeeId: z.string().min(1),
});

export type ChannelMembership = z.infer<typeof ChannelMembershipSchema>;
