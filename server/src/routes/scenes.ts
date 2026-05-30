import { SceneSchema } from "@hatchery/common";
import { Router } from "express";

import { validateBody } from "../middleware/validateBody.js";
import type { SceneRepository } from "../persistence/sceneRepository.js";
import { createScene } from "../usecases/createScene.js";
import { listScenes } from "../usecases/listScenes.js";

/** /scenes ルータ。永続化は注入された SceneRepository に委ねる（層分離）。 */
export function createScenesRouter(repo: SceneRepository): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    listScenes(repo)
      .then((scenes) => res.status(200).json(scenes))
      .catch(next);
  });

  router.post("/", validateBody(SceneSchema), (req, res, next) => {
    createScene(repo, req.body)
      .then((created) => res.status(201).json(created))
      .catch(next);
  });

  return router;
}
