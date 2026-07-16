import {
  buildManualSlotKey,
  ConflictError,
  CreateCommentRequestSchema,
  CreateCommunitySchema,
  CreatePostRequestSchema,
  CreateWorkerSchema,
  NotFoundError,
  POST_PIN_MAX_COUNT,
  UpdateCommunitySchema,
  type UpdateCommunityInput,
} from "@hatchery/common";
import { randomUUID } from "crypto";
import { Router } from "express";

import { requireAdminAccess } from "../middleware/requireAdminAccess.js";
import { validateBody } from "../middleware/validateBody.js";
import { toAdminCommunityResponse } from "./communityResponse.js";
import { toPostResponse } from "./postResponse.js";
import type { CommentRepository } from "../persistence/commentRepository.js";
import type { CommunityRepository } from "../persistence/communityRepository.js";
import type { PostRepository } from "../persistence/postRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";

export function createAdminRouter({
  workerRepository,
  communityRepository,
  postRepository,
  commentRepository,
}: {
  workerRepository: WorkerRepository;
  communityRepository: CommunityRepository;
  postRepository: PostRepository;
  commentRepository: CommentRepository;
}): Router {
  const router = Router();

  router.use(requireAdminAccess);

  // eslint-disable-next-line max-params
  router.delete("/workers/:id", async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const result = await workerRepository.softDelete(id);
      if (!result) {
        next(new NotFoundError("WorkerNotFound"));
        return;
      }
      res.status(200).json({ id: result.id, deletedAt: result.deletedAt });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/workers",
    validateBody(CreateWorkerSchema),
    // eslint-disable-next-line max-params
    async (req, res, next) => {
      try {
        const input = req.body as { displayName: string; role?: string; personality?: string; verbosity?: string };
        const worker = await workerRepository.create({
          id: randomUUID(),
          displayName: input.displayName,
          role: input.role,
          personality: input.personality,
          verbosity: input.verbosity,
        });
        res.status(201).json(worker);
      } catch (err) {
        next(err);
      }
    },
  );

  // eslint-disable-next-line max-params
  router.get("/communities", async (_req, res, next) => {
    try {
      const communities = await communityRepository.list();
      res.json(communities.map(toAdminCommunityResponse));
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/communities",
    validateBody(CreateCommunitySchema),
    // eslint-disable-next-line max-params
    async (req, res, next) => {
      try {
        const { slug, name, description, generationInstruction, feedUrl } = req.body as {
          slug: string;
          name: string;
          description: string;
          generationInstruction?: string;
          feedUrl?: string | null;
        };
        const existing = await communityRepository.findBySlug(slug);
        if (existing) {
          next(new ConflictError("CommunitySlugAlreadyExists"));
          return;
        }
        const community = await communityRepository.create({
          slug,
          name,
          description,
          generationInstruction: generationInstruction ?? null,
          feedUrl: feedUrl ?? null,
        });
        res.status(201).json(toAdminCommunityResponse(community));
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    "/communities/:id",
    validateBody(UpdateCommunitySchema),
    // eslint-disable-next-line max-params
    async (req, res, next) => {
      try {
        const { id } = req.params as { id: string };
        const input = req.body as UpdateCommunityInput;
        const community = await communityRepository.update(id, input);
        if (!community) {
          next(new NotFoundError("CommunityNotFound"));
          return;
        }
        res.json(toAdminCommunityResponse(community));
      } catch (err) {
        next(err);
      }
    },
  );

  // admin: 任意の worker 名義で post を手動作成（#433・ADR-0020）。
  // slotKey は manual:<uuid> + seq 0 で採番し、定時バッチの複合ユニーク制約と衝突しない。
  // eslint-disable-next-line max-params
  router.post("/posts", validateBody(CreatePostRequestSchema), async (req, res, next) => {
    try {
      const { communityId, authorWorkerId, title, text } = req.body as {
        communityId: string;
        authorWorkerId: string;
        title: string;
        text: string;
      };

      const community = await communityRepository.findById(communityId);
      if (!community) {
        next(new NotFoundError("CommunityNotFound"));
        return;
      }
      // findById は論理削除済みワーカーを null で返すため、削除済みも 404 になる。
      const worker = await workerRepository.findById(authorWorkerId);
      if (!worker) {
        next(new NotFoundError("WorkerNotFound"));
        return;
      }

      const [post] = await postRepository.createMany(communityId, [
        { slotKey: buildManualSlotKey(randomUUID()), seq: 0, author: authorWorkerId, title, text },
      ]);
      res.status(201).json(post);
    } catch (err) {
      next(err);
    }
  });

  // admin: post を pin する（#1089）。community あたり最大 POST_PIN_MAX_COUNT 件。
  // 上限チェックと更新は pinPostIfUnderLimit で原子的に行い、同時リクエストによる
  // 上限超過（TOCTOU）を防ぐ（セルフレビュー指摘）。
  // eslint-disable-next-line max-params
  router.post("/posts/:id/pin", async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const result = await postRepository.pinPostIfUnderLimit({
        id,
        pinnedAt: new Date(),
        maxCount: POST_PIN_MAX_COUNT,
      });
      if (result === "not_found") {
        next(new NotFoundError("PostNotFound"));
        return;
      }
      if (result === "limit_exceeded") {
        next(new ConflictError("PostPinLimitExceeded"));
        return;
      }
      res.status(200).json(toPostResponse(result));
    } catch (err) {
      next(err);
    }
  });

  // admin: post の pin を解除する（#1089）。未 pin でも冪等に 200 を返す。
  // eslint-disable-next-line max-params
  router.delete("/posts/:id/pin", async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const updated = await postRepository.unpinPost(id);
      if (!updated) {
        next(new NotFoundError("PostNotFound"));
        return;
      }
      res.status(200).json(toPostResponse(updated));
    } catch (err) {
      next(err);
    }
  });

  // admin: 任意の worker 名義で comment を手動作成（#433・ADR-0020）。
  // communityId は postId から解決して紐づける。slotKey は manual:<uuid> + seq 0。
  // eslint-disable-next-line max-params
  router.post("/comments", validateBody(CreateCommentRequestSchema), async (req, res, next) => {
    try {
      const { postId, authorWorkerId, text } = req.body as {
        postId: string;
        authorWorkerId: string;
        text: string;
      };

      const post = await postRepository.findById(postId);
      if (!post) {
        next(new NotFoundError("PostNotFound"));
        return;
      }
      const worker = await workerRepository.findById(authorWorkerId);
      if (!worker) {
        next(new NotFoundError("WorkerNotFound"));
        return;
      }

      const [comment] = await commentRepository.createMany(post.communityId, [
        {
          postId,
          slotKey: buildManualSlotKey(randomUUID()),
          seq: 0,
          author: authorWorkerId,
          text,
        },
      ]);
      res.status(201).json(comment);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
