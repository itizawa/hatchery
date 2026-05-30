import type { Message, Scene } from "@hatchery/common";

/** SceneRecord を深くコピーする（内部配列・Message 要素の漏洩を防ぐ）。 */
function cloneRecord(record: SceneRecord): SceneRecord {
  return { ...record, messages: record.messages.map((m) => ({ ...m })) };
}

/**
 * 永続化されたシーン 1 件。common の Scene（あらすじ + 発言列）に
 * 永続化由来の id / createdAt を加えたもの。
 */
export interface SceneRecord {
  id: string;
  /** あらすじ（common の Scene.scene / DB の summary）。 */
  scene: string;
  createdAt: Date;
  messages: Message[];
}

/**
 * シーンの永続化境界（ポート）。ユースケースはこのインターフェースにのみ依存し、
 * 具体実装（Prisma / InMemory）を注入する（ADR-0004 の層分離）。
 */
export interface SceneRepository {
  list(): Promise<SceneRecord[]>;
  create(input: Scene): Promise<SceneRecord>;
}

/** DB 非依存のインメモリ実装。ユースケース/ルートのテストで注入する。 */
export class InMemorySceneRepository implements SceneRepository {
  private readonly records: SceneRecord[] = [];
  private seq = 0;

  list(): Promise<SceneRecord[]> {
    // 内部配列・要素を外に漏らさないよう深い防御的コピーを返す。
    return Promise.resolve(this.records.map(cloneRecord));
  }

  create(input: Scene): Promise<SceneRecord> {
    this.seq += 1;
    const record: SceneRecord = {
      id: `mem-${this.seq}`,
      scene: input.scene,
      createdAt: new Date(0),
      messages: input.messages.map((m) => ({ ...m })),
    };
    this.records.push(record);
    return Promise.resolve(cloneRecord(record));
  }
}
