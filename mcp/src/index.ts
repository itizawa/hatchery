#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { createApiClient } from "./apiClient.js";

const BASE_URL = process.env.HATCHERY_API_BASE_URL;
const ADMIN_TOKEN = process.env.HATCHERY_ADMIN_TOKEN;

if (!BASE_URL || !ADMIN_TOKEN) {
  console.error(
    "Error: HATCHERY_API_BASE_URL と HATCHERY_ADMIN_TOKEN を環境変数に設定してください。",
  );
  process.exit(1);
}

const api = createApiClient({ baseUrl: BASE_URL, adminToken: ADMIN_TOKEN });

const server = new McpServer({
  name: "hatchery-admin",
  version: "1.0.0",
});

server.tool("list_workers", "ワーカー一覧を取得する（GET /api/workers）", {}, async () => {
  const result = await api.listWorkers();
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

server.tool(
  "create_worker",
  "新しいワーカーを作成する（POST /api/admin/workers）",
  {
    displayName: z.string().min(1).max(50).describe("ワーカーの表示名（最大50文字）"),
    role: z.string().max(50).optional().describe("ワーカーの役割（任意・最大50文字）"),
    personality: z.string().max(500).optional().describe("ワーカーの性格設定（任意・最大500文字）"),
    verbosity: z.enum(["concise", "standard", "detailed"]).optional().describe("文章量設定（任意）"),
  },
  async ({ displayName, role, personality, verbosity }) => {
    const result = await api.createWorker({ displayName, role, personality, verbosity });
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "update_worker",
  "ワーカーを更新する（PATCH /api/workers/:id）",
  {
    id: z.string().min(1).describe("ワーカー ID"),
    displayName: z.string().min(1).max(50).optional().describe("新しい表示名（最大50文字）"),
    role: z.string().max(50).optional().describe("新しい役割（最大50文字）"),
    personality: z.string().max(500).optional().describe("新しい性格設定（最大500文字）"),
    verbosity: z.enum(["concise", "standard", "detailed"]).optional().describe("新しい文章量設定"),
  },
  async ({ id, displayName, role, personality, verbosity }) => {
    if (displayName === undefined && role === undefined && personality === undefined && verbosity === undefined) {
      throw new Error("更新するフィールドを少なくとも1つ指定してください（displayName / role / personality / verbosity）");
    }
    const result = await api.updateWorker({ id, data: { displayName, role, personality, verbosity } });
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "list_communities",
  "コミュニティ一覧を取得する（GET /api/admin/communities）",
  {},
  async () => {
    const result = await api.listCommunities();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "create_community",
  "新しいコミュニティを作成する（POST /api/admin/communities）",
  {
    slug: z.string().min(1).max(50).describe("コミュニティのスラッグ（URL 用）"),
    name: z.string().min(1).max(100).describe("コミュニティ名"),
    description: z.string().min(1).max(500).describe("コミュニティの説明"),
    generationInstruction: z
      .string()
      .max(2000)
      .optional()
      .describe("会話生成の追加指示（任意）"),
  },
  async ({ slug, name, description, generationInstruction }) => {
    const result = await api.createCommunity({ slug, name, description, generationInstruction });
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "update_community",
  "コミュニティを更新する（PATCH /api/admin/communities/:id）",
  {
    id: z.string().min(1).describe("コミュニティ ID"),
    name: z.string().min(1).max(100).optional().describe("新しいコミュニティ名"),
    description: z.string().min(1).max(500).optional().describe("新しい説明"),
    generationInstruction: z
      .string()
      .max(2000)
      .nullable()
      .optional()
      .describe("会話生成の追加指示（null で削除）"),
  },
  async ({ id, name, description, generationInstruction }) => {
    const result = await api.updateCommunity({ id, data: { name, description, generationInstruction } });
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "assign_worker_to_community",
  "ワーカーの所属コミュニティを設定する（PUT /api/admin/workers/:id/communities）",
  {
    workerId: z.string().min(1).describe("ワーカー ID"),
    communityIds: z.array(z.string()).describe("所属させるコミュニティ ID の配列"),
  },
  async ({ workerId, communityIds }) => {
    const result = await api.assignWorkerToCommunity({ workerId, communityIds });
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
