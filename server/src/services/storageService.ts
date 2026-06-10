import { randomUUID } from "crypto";

/**
 * GCS ワーカーアバター画像の保存サービス（ADR-0022 / #204）。
 *
 * 本番（Cloud Run）: GCS クライアントで実際の bucket に保存。
 * ローカル開発 / テスト: InMemoryStorageService を使用。
 *
 * 依存注入（ADR-0012 の手動 DI）でインターフェースのみに依存させる。
 */

/** アップロード入力 */
export interface UploadWorkerImageInput {
  workerId: string;
  mimeType: string;
  buffer: Buffer;
}

/** ストレージサービスのインターフェース */
export interface StorageService {
  /**
   * ワーカーのアバター画像をアップロードして公開 URL を返す。
   * 命名規約: workers/{workerId}/{uuid}.{ext}
   */
  uploadWorkerImage(input: UploadWorkerImageInput): Promise<string>;
}

/** 許可する MIME タイプ（ADR-0022）。 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/** 最大ファイルサイズ: 5MB（ADR-0022）。 */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** MIME タイプからファイル拡張子を解決する。不明な MIME は null を返す。 */
export function getImageExtension(mimeType: string): string | null {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mimeType] ?? null;
}

/**
 * GCS ストレージサービスの実装。
 * Cloud Run の Workload Identity Federation（ADR-0011）を踏襲し、
 * サービスアカウントキーファイルを使わない。
 * ADL の @google-cloud/storage はデフォルトで Application Default Credentials（ADC）を使用するため、
 * Cloud Run 環境では自動的に Workload Identity が使われる。
 */
export class GcsStorageService implements StorageService {
  private readonly bucketName: string;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  async uploadWorkerImage(input: UploadWorkerImageInput): Promise<string> {
    const { Storage } = await import("@google-cloud/storage");
    const storage = new Storage();

    const ext = getImageExtension(input.mimeType);
    if (!ext) {
      throw new Error(`Unsupported MIME type: ${input.mimeType}`);
    }

    const objectName = `workers/${input.workerId}/${randomUUID()}.${ext}`;
    const bucket = storage.bucket(this.bucketName);
    const file = bucket.file(objectName);

    await file.save(input.buffer, {
      metadata: { contentType: input.mimeType },
    });

    return `https://storage.googleapis.com/${this.bucketName}/${objectName}`;
  }
}

/** テスト・ローカル開発用のインメモリストレージサービス。 */
export class InMemoryStorageService implements StorageService {
  private readonly store = new Map<string, { mimeType: string; buffer: Buffer }>();

  async uploadWorkerImage(input: UploadWorkerImageInput): Promise<string> {
    const ext = getImageExtension(input.mimeType) ?? "bin";
    const objectName = `workers/${input.workerId}/${randomUUID()}.${ext}`;
    const url = `inmemory://${objectName}`;
    this.store.set(url, { mimeType: input.mimeType, buffer: input.buffer });
    return url;
  }

  /** テスト用: アップロードされたデータを取得する。 */
  getUploadedData(url: string): { mimeType: string; buffer: Buffer } | null {
    return this.store.get(url) ?? null;
  }
}
