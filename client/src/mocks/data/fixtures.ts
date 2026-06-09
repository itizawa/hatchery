import type {
  AuthUser,
  Channel,
  MessageRecord,
  AppSettingResponse,
  BatchRunLog,
} from "@hatchery/common";

export const mockAdminUser: AuthUser = {
  id: "admin-user",
  loginId: "admin-user",
  displayName: "管理者ユーザー",
  role: "admin",
  avatarUrl: undefined,
  employeeId: undefined,
};

export const mockMemberUser: AuthUser = {
  id: "member-user",
  loginId: "member-user",
  displayName: "一般ユーザー",
  role: "member",
  avatarUrl: undefined,
  employeeId: "employee-1",
};

export const mockChannels: Channel[] = [
  { id: "zatsudan", label: "雑談", type: "zatsudan", goal: { type: "chat" } },
  { id: "shigoto", label: "仕事", type: "task", goal: { type: "chat" } },
  { id: "kikaku", label: "企画", type: "planning", goal: { type: "issue" } },
];

export const mockMessages: MessageRecord[] = [
  {
    id: "msg-1",
    createdEmployeeId: "haru",
    channel: "zatsudan",
    text: "おはようございます！今日もよろしくお願いします。",
    createdAt: new Date("2026-06-05T09:00:00Z"),
    postedAt: new Date("2026-06-05T09:00:00Z"),
    order: 0,
  },
  {
    id: "msg-2",
    createdEmployeeId: "ken",
    channel: "zatsudan",
    text: "おはよう！昨日の件、確認しておきますね。",
    createdAt: new Date("2026-06-05T09:01:00Z"),
    postedAt: new Date("2026-06-05T09:01:00Z"),
    order: 1,
  },
  {
    id: "msg-3",
    createdEmployeeId: "mei",
    channel: "zatsudan",
    text: "おはようございます。今日も頑張りましょう！",
    createdAt: new Date("2026-06-05T09:02:00Z"),
    postedAt: new Date("2026-06-05T09:02:00Z"),
    order: 2,
  },
];

export const mockSettings: AppSettingResponse[] = [
  { key: "CLAUDE_API_KEY", maskedValue: "sk-ant-api03-****" },
];

export const mockBatchLogs: BatchRunLog[] = [
  {
    id: "log-1",
    executedAt: new Date("2026-06-05T09:00:00Z"),
    status: "success",
    messageCount: 3,
    errorMessage: null,
    errorCode: null,
  },
  {
    id: "log-2",
    executedAt: new Date("2026-06-04T21:00:00Z"),
    status: "failure",
    messageCount: 0,
    errorMessage: "API キーが設定されていません",
    errorCode: "MISSING_API_KEY",
  },
];
