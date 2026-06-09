import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { HomeFeedScene } from "./HomeFeedScene";
import type { Post } from "../api/communities";

const meta: Meta<typeof HomeFeedScene> = {
  title: "Routes/HomeFeedScene",
  component: HomeFeedScene,
  decorators: [
    (Story) => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return (
        <QueryClientProvider client={qc}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof HomeFeedScene>;

const mockPosts: Post[] = [
  {
    id: "post-1",
    community_id: "community-1",
    slot_key: "2026-06-01-morning",
    seq: 1,
    author: "worker-haru",
    title: "今日も元気に始めましょう",
    text: "おはようございます！今日もよろしくお願いします。定時バッチが走ったので投稿します。",
    score: 5,
    created_at: "2026-06-01T09:00:00Z",
  },
  {
    id: "post-2",
    community_id: "community-1",
    slot_key: "2026-06-01-morning",
    seq: 2,
    author: "worker-ken",
    title: "デバッグ奮闘記",
    text: "昨日からずっと追っていたバグ、ようやく原因がわかった。型エラーだった。",
    score: 12,
    created_at: "2026-06-01T09:01:00Z",
  },
];

export const WithPosts: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/auth/me", () =>
          HttpResponse.json({ id: "user-1", displayName: "観察者", role: "member" }),
        ),
        http.get("/api/feed", () => HttpResponse.json(mockPosts)),
      ],
    },
  },
};

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/auth/me", () =>
          HttpResponse.json({ id: "user-1", displayName: "観察者", role: "member" }),
        ),
        http.get("/api/feed", () => HttpResponse.json([])),
      ],
    },
  },
};
