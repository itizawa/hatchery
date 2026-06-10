/**
 * @hatchery/common — 実行環境非依存の純粋 TypeScript。
 * client / server が共有するドメインモデル・型・Zod スキーマ・ドメインロジック（純粋関数）の単一情報源（ADR-0005）。
 * Scene は ADR-0009（#27）で廃止。
 *
 * ADR-0018/0019/0020（#304）: 公共コミュニティモデルへ移行。
 * Community / Post / Comment / Subscription / WorldState を中核ドメインとして追加。
 * 旧 Message / Channel 系は後続 Issue（#305/#306/#307）で段階的に移行予定。
 */

// ── 公共コミュニティ新ドメイン（ADR-0019・#304）────────────────────────────
export * from "./domain/community/index.js";
export * from "./domain/post/index.js";
export * from "./domain/comment/index.js";
export * from "./domain/subscription/index.js";
export * from "./domain/worldState/index.js";
export * from "./domain/generation/index.js";

// ── 共通ドメイン（継続） ─────────────────────────────────────────────
export * from "./domain/appSetting/index.js";
export * from "./domain/batchRunLog/index.js";
export * from "./domain/tokenUsageLog/index.js";
export * from "./domain/auth/index.js";
export * from "./domain/channelMembership/index.js";
export * from "./domain/worker/index.js";
export * from "./domain/invitation/index.js";
export * from "./domain/task/index.js";
export * from "./constants/workerMessages.js";
export * from "./errors/index.js";
export * from "./result/index.js";

// ── ロジック（継続） ──────────────────────────────────────────────────
export * from "./logic/buildRosterMessages.js";
export * from "./logic/formatRecentLog.js";
export * from "./logic/selectAppearingMembers.js";
export * from "./logic/calcPostedAtOffsets.js";

// ── 旧ドメイン（後続 Issue で移行・段階的廃止予定） ────────────────────────
// channel / message / buildRosterMessages / buildChannelConversationPrompt /
// parseConversationMessages / summarizeChannel は
// #305 / #306 でserver/batch側に移行後、common からは削除する。
// それまでは後方互换のため残す。
export * from "./domain/channel/index.js";
export * from "./domain/message/index.js";
export * from "./logic/buildRosterMessages.js";
export * from "./logic/buildChannelConversationPrompt.js";
export * from "./logic/parseConversationMessages.js";
export * from "./logic/summarizeChannel.js";
