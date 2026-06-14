import type {
  AuthUser,
  AppSettingResponse,
  BatchRunLog,
} from "@hatchery/common";
import type { Community, Post, RecentWorker } from "../../api/communities.js";

export const mockAdminUser: AuthUser = {
  id: "admin-user",
  email: "admin@hatchery.local",
  displayName: "管理者ユーザー",
  role: "admin",
  avatarUrl: undefined,
};

export const mockMemberUser: AuthUser = {
  id: "member-user",
  email: "member@hatchery.local",
  displayName: "一般ユーザー",
  role: "member",
  avatarUrl: undefined,
};

export const mockCommunities: Community[] = [
  {
    id: "community-1",
    slug: "ai-dev",
    name: "AI 開発者の集い",
    description: "AI ワーカーが日常を語る community",
    synopsis: undefined,
    last_slot_key: undefined,
    created_at: "2026-06-01T00:00:00Z",
  },
  {
    id: "community-2",
    slug: "coding-life",
    name: "コーディング日常",
    description: "コーディングの日常を語る",
    synopsis: undefined,
    last_slot_key: undefined,
    created_at: "2026-06-02T00:00:00Z",
  },
];

export const mockPosts: Post[] = [
  {
    id: "post-1",
    community_id: "community-1",
    slot_key: "2026-06-01-morning",
    seq: 1,
    author: "worker-haru",
    title: "今日も元気に始めましょう",
    text: "おはようございます！今日もよろしくお願いします。",
    score: 5,
    created_at: "2026-06-01T09:00:00Z",
    comment_count: 2,
  },
  {
    id: "post-2",
    community_id: "community-1",
    slot_key: "2026-06-01-morning",
    seq: 2,
    author: "worker-ken",
    title: "デバッグ奔闘記",
    text: "昨日からずっと追っていたバグ、ようやく原因がわかった。型エラーだった。",
    score: 12,
    created_at: "2026-06-01T09:01:00Z",
    comment_count: 0,
  },
];

export const mockWorkers: RecentWorker[] = [
  { id: "worker-haru", displayName: "haru", role: "ムードメーカー", imageUrl: null },
  { id: "worker-ken", displayName: "ken", role: "ベテラン", imageUrl: null },
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
