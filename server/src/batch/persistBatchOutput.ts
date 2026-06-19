import type { GenerationOutput } from "@hatchery/common";

import type { CommentRecord, CommentRepository } from "../persistence/commentRepository.js";
import type { PostRecord, PostRepository } from "../persistence/postRepository.js";

import { assignDripTimestamps } from "./assignDripTimestamps.js";

export interface PersistBatchOutputResult {
  savedPosts: PostRecord[];
  savedComments: CommentRecord[];
}

export async function persistBatchOutput({
  postRepo,
  commentRepo,
  communityId,
  output,
  postRefMap,
  slotKey,
  commentSeqStart,
  now,
  dripWindowMs,
  rng,
}: {
  postRepo: PostRepository;
  commentRepo: CommentRepository;
  communityId: string;
  output: GenerationOutput;
  postRefMap: Map<string, string>;
  slotKey: string;
  commentSeqStart: number;
  now: Date;
  dripWindowMs: number;
  rng: () => number;
}): Promise<PersistBatchOutputResult> {
  const savedPosts: PostRecord[] = [];
  const savedComments: CommentRecord[] = [];

  // Post 作成（createdAt は now + 軽いオフセット）
  const postCount = output.posts.length;
  const postStaggerMs = postCount > 1 ? Math.floor(dripWindowMs / (postCount * 10)) : 0;
  // eslint-disable-next-line max-params
  const postInputs = output.posts.map((post, postIdx) => ({
    slotKey,
    seq: postIdx,
    author: post.author,
    title: post.title,
    text: post.text,
    createdAt: new Date(now.getTime() + postIdx * postStaggerMs),
  }));
  const createdPosts = await postRepo.createMany(communityId, postInputs);
  savedPosts.push(...createdPosts);

  // Comment 作成（2-pass: 1st pass で全コメント作成 → 2nd pass で reply_to を解決）
  // eslint-disable-next-line max-params
  const totalCommentCount = output.posts.reduce((sum, p) => sum + p.comments.length, 0);
  const dripTimestamps = assignDripTimestamps({
    slotAt: now,
    windowMs: dripWindowMs,
    count: totalCommentCount,
    rng,
  });

  let commentSeq = commentSeqStart;
  let dripIdx = 0;

  for (let postIdx = 0; postIdx < output.posts.length; postIdx++) {
    const post = output.posts[postIdx];
    const createdPost = createdPosts[postIdx];
    if (!post || !createdPost) continue;
    if (post.comments.length === 0) continue;

    // 1st pass: parentCommentId=null で全コメントを作成
    const commentInputsFirstPass = post.comments.map((comment) => {
      const commentCreatedAt =
        dripTimestamps[dripIdx++] ?? new Date(now.getTime() + dripIdx * 1000);
      return {
        postId: createdPost.id,
        slotKey,
        seq: commentSeq++,
        author: comment.author,
        text: comment.text,
        createdAt: commentCreatedAt,
        parentCommentId: null,
      };
    });
    const createdComments = await commentRepo.createMany(communityId, commentInputsFirstPass);
    savedComments.push(...createdComments);

    // 2nd pass: reply_to が設定されているコメントの parentCommentId を解決
    if (commentRepo.updateParentCommentId) {
      for (let ci = 0; ci < post.comments.length; ci++) {
        const genComment = post.comments[ci];
        const createdComment = createdComments[ci];
        if (!genComment || !createdComment) continue;

        const replyTo = genComment.reply_to ?? null;
        if (replyTo === null) continue;
        if (replyTo < 0 || replyTo >= post.comments.length || replyTo === ci) continue;

        const parentCreated = createdComments[replyTo];
        if (!parentCreated) continue;

        await commentRepo.updateParentCommentId(createdComment.id, parentCreated.id);
        const idx = savedComments.findIndex((c) => c.id === createdComment.id);
        if (idx !== -1) {
          savedComments[idx] = { ...savedComments[idx]!, parentCommentId: parentCreated.id };
        }
      }
    }
  }

  // Reply（既存 post 宛コメント）を作成
  if (output.replies && output.replies.length > 0) {
    for (const reply of output.replies) {
      const targetPostId = postRefMap.get(reply.targetPostRef);
      if (!targetPostId) continue;

      const replyInputs = [
        {
          postId: targetPostId,
          slotKey,
          seq: commentSeq++,
          author: reply.author,
          text: reply.text,
        },
      ];
      const createdReplyComments = await commentRepo.createMany(communityId, replyInputs);
      savedComments.push(...createdReplyComments);
    }
  }

  return { savedPosts, savedComments };
}
