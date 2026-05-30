import { MessageArraySchema } from "@hatchery/common";
import { Router } from "express";

import { validateBody } from "../middleware/validateBody.js";
import type { MessageRepository } from "../persistence/messageRepository.js";
import { createMessages } from "../usecases/createMessages.js";
import { listMessages } from "../usecases/listMessages.js";

/** /messages ルータ。永続化は注入された MessageRepository に委ねる（層分離 / ADR-0009）。 */
export function createMessagesRouter(repo: MessageRepository): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    listMessages(repo)
      .then((messages) => res.status(200).json(messages))
      .catch(next);
  });

  router.post("/", validateBody(MessageArraySchema), (req, res, next) => {
    createMessages(repo, req.body)
      .then((created) => res.status(201).json(created))
      .catch(next);
  });

  return router;
}
