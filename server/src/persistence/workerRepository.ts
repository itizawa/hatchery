import type { UpdateWorkerInput } from "@hatchery/common";

export interface WorkerRecord {
  id: string;
  displayName: string;
  role: string | null;
  isBot: boolean;
  personality: string | null;
  /** ワーカーの画像 URL（#220）。#204 でアップロード基盤実装後に値が入る。現時点は null。 */
  imageUrl: string | null;
  /** 論理削除日時（#218）。null=有効、値=削除済み。 */
  deletedAt: Date | null;
}

/** Worker 作成の入力型（#217）。id は呼び出し元（server route）で付与する。 */
export interface CreateWorkerInput {
  id: string;
  displayName: string;
  role?: string;
  personality?: string;
  isBot: boolean;
}

export interface WorkerRepository {
  findById(id: string): Promise<WorkerRecord | null>;
  update(id: string, input: UpdateWorkerInput): Promise<WorkerRecord | null>;
  /** 複数 id の Worker をまとめて取得する。存在しない id は除外する（#53・定時バッチの発言者解決）。 */
  listByIds(ids: string[]): Promise<WorkerRecord[]>;
  /** isBot=true の Worker を全件取得する（#240・仮想オフィス用）。論理削除済は除外。 */
  listBotWorkers(): Promise<WorkerRecord[]>;
  /** isBot=true の Worker を論理削除済も含めて全件取得する（#218・メッセージ発言者名解決用）。 */
  listAllBotWorkers(): Promise<WorkerRecord[]>;
  /** Worker を論理削除する（#218）。deletedAt をセットする。対象が存在しない場合は null を返す。 */
  softDelete(id: string): Promise<WorkerRecord | null>;
  /** 論理削除済含む Worker を id で取得する（#218・削除後の確認用）。 */
  findDeletedById(id: string): Promise<WorkerRecord | null>;
  /** ワーカーの画像 URL を更新する（#204）。存在しない id は null を返す。 */
  updateImageUrl(id: string, imageUrl: string): Promise<WorkerRecord | null>;
  /** 新しい Worker を作成して返す（#217）。 */
  create(input: CreateWorkerInput): Promise<WorkerRecord>;
}

export class InMemoryWorkerRepository implements WorkerRepository {
  private readonly workers: WorkerRecord[];

  constructor(workers: Array<Omit<WorkerRecord, "deletedAt" | "imageUrl"> & { deletedAt?: Date | null; imageUrl?: string | null }> = []) {
    this.workers = workers.map((w) => ({ ...w, deletedAt: w.deletedAt ?? null, imageUrl: w.imageUrl ?? null }));
  }

  async findById(id: string): Promise<WorkerRecord | null> {
    const found = this.workers.find((w) => w.id === id && w.deletedAt === null);
    return found ? { ...found } : null;
  }

  async update(id: string, input: UpdateWorkerInput): Promise<WorkerRecord | null> {
    const worker = this.workers.find((w) => w.id === id && w.deletedAt === null);
    if (!worker) return null;
    if (input.displayName !== undefined) worker.displayName = input.displayName;
    if (input.role !== undefined) worker.role = input.role;
    if (input.personality !== undefined) worker.personality = input.personality;
    return { ...worker };
  }

  async listByIds(ids: string[]): Promise<WorkerRecord[]> {
    return ids
      .map((id) => this.workers.find((w) => w.id === id && w.deletedAt === null))
      .filter((w): w is WorkerRecord => w !== undefined)
      .map((w) => ({ ...w }));
  }

  async listBotWorkers(): Promise<WorkerRecord[]> {
    return this.workers.filter((w) => w.isBot && w.deletedAt === null).map((w) => ({ ...w }));
  }

  async listAllBotWorkers(): Promise<WorkerRecord[]> {
    return this.workers.filter((w) => w.isBot).map((w) => ({ ...w }));
  }

  async softDelete(id: string): Promise<WorkerRecord | null> {
    const worker = this.workers.find((w) => w.id === id && w.deletedAt === null);
    if (!worker) return null;
    worker.deletedAt = new Date();
    return { ...worker };
  }

  async findDeletedById(id: string): Promise<WorkerRecord | null> {
    const found = this.workers.find((w) => w.id === id);
    return found ? { ...found } : null;
  }

  async updateImageUrl(id: string, imageUrl: string): Promise<WorkerRecord | null> {
    const worker = this.workers.find((w) => w.id === id);
    if (!worker) return null;
    worker.imageUrl = imageUrl;
    return { ...worker };
  }

  async create(input: CreateWorkerInput): Promise<WorkerRecord> {
    const record: WorkerRecord = {
      id: input.id,
      displayName: input.displayName,
      role: input.role ?? null,
      isBot: input.isBot,
      personality: input.personality ?? null,
      imageUrl: null,
      deletedAt: null,
    };
    this.workers.push(record);
    return { ...record };
  }
}
