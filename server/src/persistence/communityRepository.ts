import { randomUUID } from "node:crypto";

/**
 * Community の永続化境界（ポート）。ADR-0004 の層分離に従い、
 * ユースケースはこのインターフェースにのみ依存する。
 * 具体実装（Prisma / InMemory）を注入する。
 */

export interface CommunityRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  synopsis: string | null;
  lastSlotKey: string | null;
  /** GCS 上のアイコン画像 URL（#457）。未設定は null。 */
  iconUrl: string | null;
  /** GCS 上のカバー画像 URL（#457）。未設定は null。 */
  coverUrl: string | null;
  /** 非公開の生成プロンプト指示（#488）。admin のみが設定・閲覧できる。公開 API には返さない。 */
  generationInstruction: string | null;
  createdAt: Date;
}

/** コミュニティ作成の入力型（#310）。id / createdAt はサーバ側で採番。 */
export interface CreateCommunityRecordInput {
  slug: string;
  name: string;
  description: string;
  generationInstruction?: string | null;
}

/** コミュニティ更新の入力型（#310 / #457 / #488）。slug は不変。 */
export interface UpdateCommunityRecordInput {
  name?: string;
  description?: string;
  /** アイコン画像 URL の更新（#457・アップロード API から渡す）。 */
  iconUrl?: string;
  /** カバー画像 URL の更新（#457・アップロード API から渡す）。 */
  coverUrl?: string;
  /** 非公開の生成プロンプト指示の更新（#488）。 */
  generationInstruction?: string | null;
}

export interface CommunityRepository {
  /** ID で community を取得する。存在しない場合は null を返す。 */
  findById(id: string): Promise<CommunityRecord | null>;
  /** slug で community を取得する。存在しない場合は null を返す。 */
  findBySlug(slug: string): Promise<CommunityRecord | null>;
  /** 全 community を createdAt 昇順で取得する。 */
  list(): Promise<CommunityRecord[]>;
  /** community を新規作成して返す（#310 / admin CRUD）。 */
  create(input: CreateCommunityRecordInput): Promise<CommunityRecord>;
  /** name / description を部分更新して返す。存在しない場合は null（#310 / admin CRUD）。 */
  update(id: string, input: UpdateCommunityRecordInput): Promise<CommunityRecord | null>;
}

function cloneRecord(r: CommunityRecord): CommunityRecord {
  return { ...r };
}

/** DB 非依存のインメモリ実装。ユースケース/ルートのテストで注入する。 */
export function createInMemoryCommunityRepository(
  initialRecords: CommunityRecord[] = [],
): CommunityRepository {
  const records: CommunityRecord[] = initialRecords.map(cloneRecord);

  return {
    findById(id: string): Promise<CommunityRecord | null> {
      const found = records.find((r) => r.id === id);
      return Promise.resolve(found ? cloneRecord(found) : null);
    },

    findBySlug(slug: string): Promise<CommunityRecord | null> {
      const found = records.find((r) => r.slug === slug);
      return Promise.resolve(found ? cloneRecord(found) : null);
    },

    list(): Promise<CommunityRecord[]> {
      const sorted = [...records].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return Promise.resolve(sorted.map(cloneRecord));
    },

    create(input: CreateCommunityRecordInput): Promise<CommunityRecord> {
      const record: CommunityRecord = {
        id: randomUUID(),
        slug: input.slug,
        name: input.name,
        description: input.description,
        synopsis: null,
        lastSlotKey: null,
        iconUrl: null,
        coverUrl: null,
        generationInstruction: input.generationInstruction ?? null,
        createdAt: new Date(),
      };
      records.push(record);
      return Promise.resolve(cloneRecord(record));
    },

    update(id: string, input: UpdateCommunityRecordInput): Promise<CommunityRecord | null> {
      const record = records.find((r) => r.id === id);
      if (!record) return Promise.resolve(null);
      if (input.name !== undefined) record.name = input.name;
      if (input.description !== undefined) record.description = input.description;
      if (input.iconUrl !== undefined) record.iconUrl = input.iconUrl;
      if (input.coverUrl !== undefined) record.coverUrl = input.coverUrl;
      if (input.generationInstruction !== undefined)
        record.generationInstruction = input.generationInstruction;
      return Promise.resolve(cloneRecord(record));
    },
  };
}
