import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useImageUpload, ACCEPTED_MIME } from "./useImageUpload.js";

describe("useImageUpload", () => {
  it("ACCEPTED_MIME が定義されている", () => {
    expect(ACCEPTED_MIME).toBe("image/png,image/jpeg,image/webp,image/gif");
  });

  it("inputRef / handleClick / handleFileChange / handleKeyDown を返す", () => {
    const { result } = renderHook(() =>
      useImageUpload({ upload: vi.fn(), isPending: false }),
    );
    expect(result.current.inputRef).toBeDefined();
    expect(typeof result.current.handleClick).toBe("function");
    expect(typeof result.current.handleFileChange).toBe("function");
    expect(typeof result.current.handleKeyDown).toBe("function");
  });

  it("handleFileChange: ファイルを選択すると upload が呼ばれ onSuccess が実行される", async () => {
    const upload = vi.fn().mockResolvedValue({ id: "x", imageUrl: "https://example.com/a.png" });
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useImageUpload({ upload, isPending: false, onSuccess }),
    );

    const file = new File(["data"], "test.png", { type: "image/png" });
    const input = document.createElement("input");
    input.type = "file";
    Object.defineProperty(input, "files", { value: [file] });

    await act(async () => {
      await result.current.handleFileChange({
        target: input,
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(upload).toHaveBeenCalledWith(file);
    expect(onSuccess).toHaveBeenCalledWith({ id: "x", imageUrl: "https://example.com/a.png" });
  });

  it("handleFileChange: ファイルが空の場合 upload を呼ばない", async () => {
    const upload = vi.fn();
    const { result } = renderHook(() =>
      useImageUpload({ upload, isPending: false }),
    );

    const input = document.createElement("input");
    input.type = "file";
    Object.defineProperty(input, "files", { value: [] });

    await act(async () => {
      await result.current.handleFileChange({
        target: input,
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(upload).not.toHaveBeenCalled();
  });

  it("handleFileChange: ファイル入力値がリセットされる（e.target.value = '')", async () => {
    const upload = vi.fn().mockResolvedValue({});
    const { result } = renderHook(() =>
      useImageUpload({ upload, isPending: false }),
    );

    const file = new File(["data"], "test.png", { type: "image/png" });
    let capturedValue: string | undefined;
    const fakeTarget = {
      files: [file],
      get value() { return capturedValue ?? ""; },
      set value(v: string) { capturedValue = v; },
    };

    await act(async () => {
      await result.current.handleFileChange({
        target: fakeTarget,
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(capturedValue).toBe("");
  });

  it("handleKeyDown: Enter キーで handleClick が呼ばれる（isPending=false）", () => {
    const { result } = renderHook(() =>
      useImageUpload({ upload: vi.fn(), isPending: false }),
    );

    const clickSpy = vi.fn();
    const fakeInput = { click: clickSpy } as unknown as HTMLInputElement;
    Object.defineProperty(result.current.inputRef, "current", { value: fakeInput, writable: true });

    act(() => {
      result.current.handleKeyDown({
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(clickSpy).toHaveBeenCalled();
  });

  it("handleKeyDown: Space キーで handleClick が呼ばれる（isPending=false）", () => {
    const { result } = renderHook(() =>
      useImageUpload({ upload: vi.fn(), isPending: false }),
    );

    const clickSpy = vi.fn();
    const fakeInput = { click: clickSpy } as unknown as HTMLInputElement;
    Object.defineProperty(result.current.inputRef, "current", { value: fakeInput, writable: true });

    act(() => {
      result.current.handleKeyDown({
        key: " ",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(clickSpy).toHaveBeenCalled();
  });

  it("handleKeyDown: isPending=true のとき Enter キーを押しても click が呼ばれない", () => {
    const { result } = renderHook(() =>
      useImageUpload({ upload: vi.fn(), isPending: true }),
    );

    const clickSpy = vi.fn();
    const fakeInput = { click: clickSpy } as unknown as HTMLInputElement;
    Object.defineProperty(result.current.inputRef, "current", { value: fakeInput, writable: true });

    act(() => {
      result.current.handleKeyDown({
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(clickSpy).not.toHaveBeenCalled();
  });
});
