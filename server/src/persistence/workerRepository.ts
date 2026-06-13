import type { UpdateWorkerInput } from "@hatchery/common";

export interface WorkerRecord {
  id: string;
  displayName: string;
  role: string | null;
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
}

export interface WorkerRepository {
  findById(id: string): Promise<WorkerRecord | null>;
  update(id: string, input: UpdateWorkerInput): Promise<WorkerRecord | null>;
  /** 複数 id の Worker をまとめて取得する。存在しない id は除外する（#53・定時バッチの発言者解決）。 */
  listByIds(ids: string[]): Promise<WorkerRecord[]>;
  /**
   * post/comment の `author` 値（id か displayName）から有効な Worker を解決する（#478）。
   * - 各 author を id で照合し、見つからなければ displayName で照合する（id 一致を優先）。
   * - 入力 authors の順序を保持し、解決できた author に対応する Worker を 1 件返す（解決不能な author は除外）。
   * - 論理削除済（deletedAt != null）の Worker は対象外。
   * バッチが author に UUID id を保存する新データと、displayName を保存していた旧データの双方を解決するため。
   */
  resolveByAuthors(authors: string[]): Promise<WorkerRecord[]>;
  /** Worker を全件取得する（#240・仮想オフィス用）。論理削除済は除外（#331: Worker は AI 投稿者のみ）。 */
  listBotWorkers(): Promise<WorkerRecord[]>;
  /** Worker を論理削除済も含めて全件取得する（#218・メッセージ発言者名解決用 / #331）。 */
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

export function createInMemoryWorkerRepository(
  initialWorkers: Array<
    Omit<WorkerRecord, "deletedAt" | "imageUrl"> & {
      deletedAt?: Date | null;
      imageUrl?: string | null;
    }
  > = [],
): WorkerRepository {
  const workers: WorkerRecord[] = initialWorkers.map((w) => ({
    ...w,
    deletedAt: w.deletedAt ?? null,
    imageUrl: w.imageUrl ?? null,
  }));

  return {
    findById(id: string): Promise<WorkerRecord | null> {
      const found = workers.find((w) => w.id === id && w.deletedAt === null);
      return Promise.resolve(found ? { ...found } : null);
    },

    update(id: string, input: UpdateWorkerInput): Promise<WorkerRecord | null> {
      const worker = workers.find((w) => w.id === id && w.deletedAt === null);
      if (!worker) return Promise.resolve(null);
      if (input.displayName !== undefined) worker.displayName = input.displayName;
      if (input.role !== undefined) worker.role = input.role;
      if (input.personality !== undefined) worker.personality = input.personality;
      return Promise.resolve({ ...worker });
    },

    listByIds(ids: string[]): Promise<WorkerRecord[]> {
      return Promise.resolve(
        ids
          .map((id) => workers.find((w) => w.id === id && w.deletedAt === null))
          .filter((w): w is WorkerRecord => w !== undefined)
          .map((w) => ({ ...w })),
      );
    },

    resolveByAuthors(authors: string[]): Promise<WorkerRecord[]> {
      const active = workers.filter((w) => w.deletedAt === null);
      return Promise.resolve(
        authors
          .map(
            (author) =>
              // id 一致を displayName 一致より優先する。
              active.find((w) => w.id === author) ??
              active.find((w) => w.displayName === author),
          )
          .filter((w): w is WorkerRecord => w !== undefined)
          .map((w) => ({ ...w })),
      );
    },

    listBotWorkers(): Promise<WorkerRecord[]> {
      return Promise.resolve(
        workers.filter((w) => w.deletedAt === null).map((w) => ({ ...w })),
      );
    },

    listAllBotWorkers(): Promise<WorkerRecord[]> {
      return Promise.resolve(workers.map((w) => ({ ...w })));
    },

    softDelete(id: string): Promise<WorkerRecord | null> {
      const worker = workers.find((w) => w.id === id && w.deletedAt === null);
      if (!worker) return Promise.resolve(null);
      worker.deletedAt = new Date();
      return Promise.resolve({ ...worker });
    },

    findDeletedById(id: string): Promise<WorkerRecord | null> {
      const found = workers.find((w) => w.id === id);
      return Promise.resolve(found ? { ...found } : null);
    },

    updateImageUrl(id: string, imageUrl: string): Promise<WorkerRecord | null> {
      const worker = workers.find((w) => w.id === id);
      if (!worker) return Promise.resolve(null);
      worker.imageUrl = imageUrl;
      return Promise.resolve({ ...worker });
    },

    create(input: CreateWorkerInput): Promise<WorkerRecord> {
      const record: WorkerRecord = {
        id: input.id,
        displayName: input.displayName,
        role: input.role ?? null,
        personality: input.personality ?? null,
        imageUrl: null,
        deletedAt: null,
      };
      workers.push(record);
      return Promise.resolve({ ...record });
    },
  };
}
