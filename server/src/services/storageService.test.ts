import { describe, expect, it } from "vitest";

import {
  InMemoryStorageService,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  getImageExtension,
  type StorageService,
} from "./storageService.js";

describe("ALLOWED_IMAGE_MIME_TYPES", () => {
  it("image/png, image/jpeg, image/webp, image/gif を含む", () => {
    expect(ALLOWED_IMAGE_MIME_TYPES).toContain("image/png");
    expect(ALLOWED_IMAGE_MIME_TYPES).toContain("image/jpeg");
    expect(ALLOWED_IMAGE_MIME_TYPES).toContain("image/webp");
    expect(ALLOWED_IMAGE_MIME_TYPES).toContain("image/gif");
  });
});

describe("MAX_IMAGE_SIZE_BYTES", () => {
  it("5MB（5 * 1024 * 1024）である", () => {
    expect(MAX_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("getImageExtension", () => {
  it("image/png → 'png'", () => {
    expect(getImageExtension("image/png")).toBe("png");
  });

  it("image/jpeg → 'jpg'", () => {
    expect(getImageExtension("image/jpeg")).toBe("jpg");
  });

  it("image/webp → 'webp'", () => {
    expect(getImageExtension("image/webp")).toBe("webp");
  });

  it("image/gif → 'gif'", () => {
    expect(getImageExtension("image/gif")).toBe("gif");
  });

  it("不明な MIME は null を返す", () => {
    expect(getImageExtension("application/pdf")).toBeNull();
  });
});

describe("InMemoryStorageService", () => {
  it("StorageService インターフェースを満たす", () => {
    const service: StorageService = new InMemoryStorageService();
    expect(typeof service.uploadWorkerImage).toBe("function");
  });

  it("画像をアップロードして URL を返す", async () => {
    const service = new InMemoryStorageService();
    const buffer = Buffer.from("fake-image-data");
    const result = await service.uploadWorkerImage({
      workerId: "haru",
      mimeType: "image/png",
      buffer,
    });
    expect(result).toMatch(/^inmemory:\/\/workers\/haru\/.+\.png$/);
  });

  it("アップロードされた画像のデータを getUploadedData で取得できる", async () => {
    const service = new InMemoryStorageService();
    const buffer = Buffer.from("test-content");
    const url = await service.uploadWorkerImage({
      workerId: "worker-1",
      mimeType: "image/jpeg",
      buffer,
    });
    const stored = service.getUploadedData(url);
    expect(stored).not.toBeNull();
    expect(stored?.mimeType).toBe("image/jpeg");
    expect(stored?.buffer.equals(buffer)).toBe(true);
  });

  it("異なる workerId に対して異なる URL を生成する", async () => {
    const service = new InMemoryStorageService();
    const buffer = Buffer.from("data");
    const url1 = await service.uploadWorkerImage({ workerId: "haru", mimeType: "image/png", buffer });
    const url2 = await service.uploadWorkerImage({ workerId: "ken", mimeType: "image/png", buffer });
    expect(url1).not.toBe(url2);
    expect(url1).toContain("/haru/");
    expect(url2).toContain("/ken/");
  });
});

describe("InMemoryStorageService.uploadCommunityImage（#457）", () => {
  it("StorageService インターフェースに uploadCommunityImage を持つ", () => {
    const service: StorageService = new InMemoryStorageService();
    expect(typeof service.uploadCommunityImage).toBe("function");
  });

  it("icon 画像をアップロードすると communities/{id}/icon/{uuid}.{ext} 形式の URL を返す", async () => {
    const service = new InMemoryStorageService();
    const result = await service.uploadCommunityImage({
      communityId: "comm-1",
      kind: "icon",
      mimeType: "image/png",
      buffer: Buffer.from("fake"),
    });
    expect(result).toMatch(/^inmemory:\/\/communities\/comm-1\/icon\/.+\.png$/);
  });

  it("cover 画像をアップロードすると communities/{id}/cover/{uuid}.{ext} 形式の URL を返す", async () => {
    const service = new InMemoryStorageService();
    const result = await service.uploadCommunityImage({
      communityId: "comm-1",
      kind: "cover",
      mimeType: "image/webp",
      buffer: Buffer.from("fake"),
    });
    expect(result).toMatch(/^inmemory:\/\/communities\/comm-1\/cover\/.+\.webp$/);
  });

  it("アップロードされた画像のデータを getUploadedData で取得できる", async () => {
    const service = new InMemoryStorageService();
    const buffer = Buffer.from("cover-content");
    const url = await service.uploadCommunityImage({
      communityId: "comm-1",
      kind: "cover",
      mimeType: "image/jpeg",
      buffer,
    });
    const stored = service.getUploadedData(url);
    expect(stored?.mimeType).toBe("image/jpeg");
    expect(stored?.buffer.equals(buffer)).toBe(true);
  });
});
