import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as authApi from "./auth.js";
import { communityFeedQueryKey, homeFeedQueryKeyPrefix } from "./feed.js";
import { postThreadQueryKey } from "./posts.js";
import { votePost, voteComment, useVotePost, useVoteComment } from "./votes.js";

/** JSON ボディを持つ Response を組み立てる小ヘルパ。 */
// eslint-disable-next-line max-params
function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const mockPost = {
  id: "post-1",
  community_id: "community-1",
  slot_key: "2026-06-01-morning",
  seq: 1,
  author: "worker-haru",
  title: "今日も元気に始めましょう",
  text: "おはようございます！今日もよろしくお願いします。",
  score: 5,
  created_at: "2026-06-01T09:00:00Z",
};

const mockComment = {
  id: "comment-1",
  community_id: "community-1",
  post_id: "post-1",
  slot_key: "2026-06-01-morning",
  seq: 1,
  author: "worker-ken",
  text: "いつも元気ですね！",
  score: 2,
  created_at: "2026-06-01T09:01:00Z",
};

describe("votePost (POST /api/posts/{postId}/vote)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき更新後の post を返す", async () => {
    const updatedPost = { ...mockPost, score: 6 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, updatedPost));
    vi.stubGlobal("fetch", fetchMock);

    const result = await votePost({ postId: "post-1", direction: "up", sessionId: "00000000-0000-0000-0000-000000000001" });
    expect(result).toEqual(updatedPost);
    expect(result.score).toBe(6);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/posts/post-1/vote");
    expect(request.method).toBe("POST");
  });

  it("409（二重投票）のとき例外を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(409, { error: "AlreadyVoted" })));
    await expect(votePost({ postId: "post-1", direction: "up", sessionId: "00000000-0000-0000-0000-000000000001" })).rejects.toThrow();
  });
});

describe("voteComment (POST /api/comments/{commentId}/vote)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("200 のとき更新後の comment を返す", async () => {
    const updatedComment = { ...mockComment, score: 3 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, updatedComment));
    vi.stubGlobal("fetch", fetchMock);

    const result = await voteComment({ commentId: "comment-1", direction: "up", sessionId: "00000000-0000-0000-0000-000000000002" });
    expect(result).toEqual(updatedComment);
    expect(result.score).toBe(3);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/comments/comment-1/vote");
    expect(request.method).toBe("POST");
  });
});

// ─── フックテスト共通 ─────────────────────────────────────────────────────────

type ThreadPost = { id: string; score: number; up_count: number; my_vote: "up" | "down" | null | undefined };
type ThreadComment = { id: string; score: number; up_count: number; my_vote: "up" | "down" | null | undefined };
type ThreadData = { post: ThreadPost; comments: ThreadComment[] };

const basePost: ThreadPost = { id: "post-1", score: 5, up_count: 2, my_vote: null };
const baseComment: ThreadComment = { id: "comment-1", score: 2, up_count: 2, my_vote: null };

function createHookWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      QueryClientProvider({ client: queryClient, children }),
  };
}

// ─── useVotePost ──────────────────────────────────────────────────────────────
describe("useVotePost (楽観更新フック)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("onMutate: 未 vote → up で score/up_count/my_vote が楽観的に更新される", async () => {
    vi.spyOn(authApi, "useAuth").mockReturnValue({ data: null } as ReturnType<typeof authApi.useAuth>);

    let resolveFetch!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((res) => { resolveFetch = res; })));

    const { queryClient, wrapper } = createHookWrapper();
    queryClient.setQueryData(postThreadQueryKey("post-1"), { post: { ...basePost, score: 5, up_count: 2, my_vote: null }, comments: [] } satisfies ThreadData);

    const { result } = renderHook(() => useVotePost(), { wrapper });
    act(() => { result.current.mutate({ postId: "post-1", direction: "up" }); });

    await waitFor(() => {
      const d = queryClient.getQueryData<ThreadData>(postThreadQueryKey("post-1"));
      expect(d?.post.my_vote).toBe("up");
    });

    const d = queryClient.getQueryData<ThreadData>(postThreadQueryKey("post-1"));
    expect(d?.post.score).toBe(6);
    expect(d?.post.up_count).toBe(3);

    resolveFetch(jsonResponse(200, { ...basePost, score: 6 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("onMutate: up 済み → up（toggle off）で score/up_count/my_vote が元に戻る方向に更新される", async () => {
    vi.spyOn(authApi, "useAuth").mockReturnValue({ data: null } as ReturnType<typeof authApi.useAuth>);

    let resolveFetch!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((res) => { resolveFetch = res; })));

    const { queryClient, wrapper } = createHookWrapper();
    queryClient.setQueryData(postThreadQueryKey("post-1"), { post: { ...basePost, score: 5, up_count: 2, my_vote: "up" }, comments: [] } satisfies ThreadData);

    const { result } = renderHook(() => useVotePost(), { wrapper });
    act(() => { result.current.mutate({ postId: "post-1", direction: "up" }); });

    await waitFor(() => {
      const d = queryClient.getQueryData<ThreadData>(postThreadQueryKey("post-1"));
      expect(d?.post.my_vote).toBeNull();
    });

    const d = queryClient.getQueryData<ThreadData>(postThreadQueryKey("post-1"));
    expect(d?.post.score).toBe(4);
    expect(d?.post.up_count).toBe(1);

    resolveFetch(jsonResponse(200, { ...basePost, score: 4 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("onError: ミューテーション失敗時にキャッシュが元の値へロールバックされる", async () => {
    vi.spyOn(authApi, "useAuth").mockReturnValue({ data: null } as ReturnType<typeof authApi.useAuth>);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "ServerError" })));

    const { queryClient, wrapper } = createHookWrapper();
    queryClient.setQueryData(postThreadQueryKey("post-1"), { post: { ...basePost, score: 5, up_count: 2, my_vote: null }, comments: [] } satisfies ThreadData);

    const { result } = renderHook(() => useVotePost(), { wrapper });
    act(() => { result.current.mutate({ postId: "post-1", direction: "up" }); });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const d = queryClient.getQueryData<ThreadData>(postThreadQueryKey("post-1"));
    expect(d?.post.score).toBe(5);
    expect(d?.post.up_count).toBe(2);
    expect(d?.post.my_vote).toBeNull();
  });

  it("onSettled: 成功時に postThreadQueryKey・communityFeedQueryKey・homeFeedQueryKeyPrefix を invalidate する", async () => {
    vi.spyOn(authApi, "useAuth").mockReturnValue({ data: null } as ReturnType<typeof authApi.useAuth>);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { ...basePost, score: 6 })));

    const { queryClient, wrapper } = createHookWrapper();
    queryClient.setQueryData(postThreadQueryKey("post-1"), { post: { ...basePost }, comments: [] } satisfies ThreadData);

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useVotePost("tech"), { wrapper });

    act(() => { result.current.mutate({ postId: "post-1", direction: "up" }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: postThreadQueryKey("post-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: communityFeedQueryKey("tech") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: homeFeedQueryKeyPrefix() });
  });
});

// ─── useVoteComment ───────────────────────────────────────────────────────────
describe("useVoteComment (楽観更新フック)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("onMutate: 未 vote → up で対象コメントの score/up_count/my_vote が楽観的に更新される", async () => {
    vi.spyOn(authApi, "useAuth").mockReturnValue({ data: null } as ReturnType<typeof authApi.useAuth>);

    let resolveFetch!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((res) => { resolveFetch = res; })));

    const { queryClient, wrapper } = createHookWrapper();
    queryClient.setQueryData(postThreadQueryKey("post-1"), {
      post: { ...basePost },
      comments: [{ ...baseComment, score: 2, up_count: 2, my_vote: null }],
    } satisfies ThreadData);

    const { result } = renderHook(() => useVoteComment("post-1"), { wrapper });
    act(() => { result.current.mutate({ commentId: "comment-1", direction: "up" }); });

    await waitFor(() => {
      const d = queryClient.getQueryData<ThreadData>(postThreadQueryKey("post-1"));
      expect(d?.comments[0]?.my_vote).toBe("up");
    });

    const d = queryClient.getQueryData<ThreadData>(postThreadQueryKey("post-1"));
    expect(d?.comments[0]?.score).toBe(3);
    expect(d?.comments[0]?.up_count).toBe(3);

    resolveFetch(jsonResponse(200, { ...baseComment, score: 3 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("onError: ミューテーション失敗時にコメントキャッシュが元の値へロールバックされる", async () => {
    vi.spyOn(authApi, "useAuth").mockReturnValue({ data: null } as ReturnType<typeof authApi.useAuth>);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "ServerError" })));

    const { queryClient, wrapper } = createHookWrapper();
    queryClient.setQueryData(postThreadQueryKey("post-1"), {
      post: { ...basePost },
      comments: [{ ...baseComment, score: 2, up_count: 2, my_vote: null }],
    } satisfies ThreadData);

    const { result } = renderHook(() => useVoteComment("post-1"), { wrapper });
    act(() => { result.current.mutate({ commentId: "comment-1", direction: "up" }); });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const d = queryClient.getQueryData<ThreadData>(postThreadQueryKey("post-1"));
    expect(d?.comments[0]?.score).toBe(2);
    expect(d?.comments[0]?.up_count).toBe(2);
    expect(d?.comments[0]?.my_vote).toBeNull();
  });
});
