import { type RecentEntry, formatRecentLog } from "@hatchery/common";

import type { CommunityRecord } from "../persistence/communityRepository.js";
import type { CommentRepository } from "../persistence/commentRepository.js";
import type { PostRepository } from "../persistence/postRepository.js";

export interface RecentContext {
  recentLog: string[];
  recentPostsForReply: Array<{ ref: string; id: string; title: string }>;
  popularPosts: Array<{ title: string; author: string; score: number }>;
}

export async function fetchRecentContext({
  postRepo,
  commentRepo,
  community,
  recentLimit,
  maxPostsForReply,
  now,
  popularPostsWindowDays,
  popularPostsMinScore,
  popularPostsLimit,
}: {
  postRepo: PostRepository;
  commentRepo: CommentRepository;
  community: CommunityRecord;
  recentLimit: number;
  maxPostsForReply: number;
  now: Date;
  popularPostsWindowDays: number;
  popularPostsMinScore: number;
  popularPostsLimit: number;
}): Promise<RecentContext> {
  const recentPosts = await postRepo.listByCommunity(community.id, recentLimit, { now });
  const recentComments = await commentRepo.listByCommunity(community.id, recentLimit, { now });

  const allEntries: (RecentEntry & { createdAt: Date })[] = [
    ...recentPosts.map((p) => ({
      community_id: community.slug,
      author: p.author,
      text: p.text,
      title: p.title,
      createdAt: p.createdAt,
    })),
    ...recentComments.map((c) => ({
      community_id: community.slug,
      author: c.author,
      text: c.text,
      createdAt: c.createdAt,
    })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const recentLog = formatRecentLog(allEntries, recentLimit);

  const recentPostsForReply = recentPosts.slice(0, maxPostsForReply).map((p, i) => ({
    ref: `ref-${i + 1}`,
    id: p.id,
    title: p.title,
  }));

  const popularPostsSince = new Date(
    now.getTime() - popularPostsWindowDays * 24 * 60 * 60 * 1000,
  );
  const topPosts = await postRepo.listTopByCommunity(community.id, {
    since: popularPostsSince,
    minScore: popularPostsMinScore,
    limit: popularPostsLimit,
  });
  const popularPosts = topPosts.map((p) => ({
    title: p.title,
    author: p.author,
    score: p.score,
  }));

  return { recentLog, recentPostsForReply, popularPosts };
}
