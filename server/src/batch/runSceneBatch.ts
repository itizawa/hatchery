import type { Scene } from "@hatchery/common";

import type { SceneRecord, SceneRepository } from "../persistence/sceneRepository.js";

/** シーン生成器。本 Issue では LLM 呼び出しをせず固定スタブを返す（本実装はスコープ外）。 */
export type SceneGenerator = () => Scene;

/** スタブのシーン生成器。MVP の最小シーン（1 発言）を返す。 */
export const stubSceneGenerator: SceneGenerator = () => ({
  scene: "（スタブ）定時のひとコマ",
  messages: [{ speaker: "emp-1", channel: "zatsudan", text: "おはようございます。" }],
});

/** 定時バッチの依存。永続化と生成器を注入する。 */
export interface RunSceneBatchDeps {
  sceneRepository: SceneRepository;
  generate?: SceneGenerator;
}

/**
 * 定時バッチ本体。1 シーンを生成して永続化し、保存結果を返す。
 * Express を一切 import しない＝API プロセスと独立に起動できる（ADR-0004 / concept.md の定時方式）。
 */
export function runSceneBatch(deps: RunSceneBatchDeps): Promise<SceneRecord> {
  const generate = deps.generate ?? stubSceneGenerator;
  return deps.sceneRepository.create(generate());
}
