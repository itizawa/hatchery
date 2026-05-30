import type { SceneRecord, SceneRepository } from "../persistence/sceneRepository.js";

/** 保存済みシーンの一覧を返すユースケース。 */
export function listScenes(repo: SceneRepository): Promise<SceneRecord[]> {
  return repo.list();
}
