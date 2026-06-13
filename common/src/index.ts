/**
 * @hatchery/common — 実行環境非依存の純粋 TypeScript。
 * client / server が共有するドメインモデル・型・Zod スキーマ・ドメインロジック（純粋関数）の単一情報源（ADR-0005）。
 * Scene は ADR-0009（#27）で廃止。旧 Channel/Message/Task/ChannelMembership は ADR-0019（#330）で削除済み。
 */

// ── 公共コミュニティ新ドメイン（ADR-0019・#304）────────────────────────
export * from "./domain/community/index.js";
export * from "./domain/post/index.js";
export * from "./domain/feed/index.js";
export * from "./domain/comment/index.js";
export * from "./domain/subscription/index.js";
export * from "./domain/worldState/index.js";
export * from "./domain/generation/index.js";

// ── 共通ドメイン ────────────────────────────────────────────────
export * from "./domain/appSetting/index.js";
export * from "./domain/batchRunLog/index.js";
export * from "./domain/tokenUsageLog/index.js";
export * from "./domain/auth/index.js";
export * from "./domain/worker/index.js";
export * from "./constants/workerMessages.js";
export * from "./errors/index.js";
export * from "./result/index.js";

// ── ロジック ────────────────────────────────────────────────────
export * from "./logic/formatRecentLog.js";
export * from "./logic/selectAppearingMembers.js";
export * from "./logic/calcPostedAtOffsets.js";
