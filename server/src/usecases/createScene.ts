import type { Scene } from "@hatchery/common";

import type { SceneRecord, SceneRepository } from "../persistence/sceneRepository.js";

/** シーンを永続化するユースケース。入力検証はルート層の validateBody で済んでいる前提。 */
export function createScene(repo: SceneRepository, input: Scene): Promise<SceneRecord> {
  return repo.create(input);
}
