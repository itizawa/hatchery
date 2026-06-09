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
  createdAt: Date;
}

export interface CommunityRepository {
  /** ID で community を取得する。存在しない場合は null を返す。 */
  findById(id: string): Promise<CommunityRecord | null>;
  /** slug で community を取得する。存在しない場合は null を返す。 */
  findBySlug(slug: string): Promise<CommunityRecord | null>;
  /** 全 community を createdAt 昇順で取得する。 */
  list(): Promise<CommunityRecord[]>;
}

function cloneRecord(r: CommunityRecord): CommunityRecord {
  return { ...r };
}

/** DB 非依存のインメモリ実装。ユースケース/ルートのテストで注入する。 */
export class InMemoryCommunityRepository implements CommunityRepository {
  private readonly records: CommunityRecord[];

  constructor(records: CommunityRecord[] = []) {
    this.records = records.map(cloneRecord);
  }

  findById(id: string): Promise<CommunityRecord | null> {
    const found = this.records.find((r) => r.id === id);
    return Promise.resolve(found ? cloneRecord(found) : null);
  }

  findBySlug(slug: string): Promise<CommunityRecord | null> {
    const found = this.records.find((r) => r.slug === slug);
    return Promise.resolve(found ? cloneRecord(found) : null);
  }

  list(): Promise<CommunityRecord[]> {
    const sorted = [...this.records].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return Promise.resolve(sorted.map(cloneRecord));
  }
}
