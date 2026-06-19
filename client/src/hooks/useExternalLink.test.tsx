/**
 * useExternalLink フックのテスト（Issue #661 / Issue #717）
 *
 * 受け入れ条件:
 * - 外部リンククリックでモーダルが開くこと（AC8）
 * - 「続行」で window.open が対象 URL で呼ばれること（AC3, AC8）
 * - 「キャンセル」で遷移しないこと（AC4, AC8）
 * - 「今後表示しない」永続化後はモーダルを挙まず遷移すること（AC5, AC8）
 * - 内部リンクが対象外であること（AC7, AC8）
 * - isExternalUrl の各ケースを純粋関数として直接ユニットテスト（Issue #717）
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExternalLinkProvider, isExternalUrl, useExternalLink } from "./useExternalLink";

const STORAGE_KEY = "hatchery:external-link:skip-warning";

describe("isExternalUrl (#717)", () => {
  // jsdom 環境では window.location.origin は "http://localhost" になる

  it("外部 https URL → true", () => {
    expect(isExternalUrl("https://example.com")).toBe(true);
  });

  it("外部 http URL → true", () => {
    expect(isExternalUrl("http://example.com/path")).toBe(true);
  });

  it("相対パス /path → false", () => {
    expect(isExternalUrl("/path")).toBe(false);
  });

  it("相対パス ./relative → false", () => {
    expect(isExternalUrl("./relative")).toBe(false);
  });

  it("同一オリジン URL → false", () => {
    expect(isExternalUrl(`${window.location.origin}/some/path`)).toBe(false);
  });

  it("非 http(s) スキーム ftp:// → false", () => {
    expect(isExternalUrl("ftp://example.com")).toBe(false);
  });

  it("非 http(s) スキーム mailto: → false", () => {
    expect(isExternalUrl("mailto:user@example.com")).toBe(false);
  });

  it("不正 URL（解析エラー） → false", () => {
    expect(isExternalUrl("not-a-url")).toBe(false);
  });
});

/** Node.js 26 の実験的 localStorage は --localstorage-file 未指定で undefined になるため
 * テスト用のインメモリ実装で置き換える。jsdom の Storage API と同等の動作をする。 */
function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    // eslint-disable-next-line max-params
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

const localStorageMock = createLocalStorageMock();

// テスト用コンポーネント
const TestComponent = ({ href }: { href: string }) => {
  const { openExternalLink } = useExternalLink();
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        openExternalLink(href);
      }}
    >
      リンク
    </button>
  );
};

const renderWithProvider = (href: string) => {
  return render(
    <ExternalLinkProvider>
      <TestComponent href={href} />
    </ExternalLinkProvider>,
  );
};

describe("useExternalLink", () => {
  beforeEach(() => {
    // Node.js 26 の localStorage は --localstorage-file 未指定で undefined になるため
    // テスト用インメモリ実装で置き換える
    vi.stubGlobal("localStorage", localStorageMock);
    localStorageMock.removeItem(STORAGE_KEY);
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    localStorageMock.removeItem(STORAGE_KEY);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("外部リンクのクリック", () => {
    it("外部リンクをクリックすると確認モーダルが開く", async () => {
      renderWithProvider("https://example.com");
      await userEvent.click(screen.getByRole("button", { name: "リンク" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/外部サイトへのアクセス/)).toBeInTheDocument();
    });

    it("内部リンク（同一オリジン）はモーダルを開かずに openExternalLink は何もしない", async () => {
      // jsdom の window.location.origin を使ったパス（vitest では "http://localhost:3000"）
      const internalUrl = `${window.location.origin}/some-path`;
      renderWithProvider(internalUrl);
      await userEvent.click(screen.getByRole("button", { name: "リンク" }));
      // ダイアログが開かないこと
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      // window.open も呼ばれないこと（内部リンクはrouter経由のため）
      expect(window.open).not.toHaveBeenCalled();
    });

    it("http(s) 以外のスキームはモーダルを開かない", async () => {
      renderWithProvider("mailto:test@example.com");
      await userEvent.click(screen.getByRole("button", { name: "リンク" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("モーダルに遷移先のホスト名が表示される", async () => {
      renderWithProvider("https://example.com/path?q=1");
      await userEvent.click(screen.getByRole("button", { name: "リンク" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/example\.com/)).toBeInTheDocument();
    });
  });

  describe("「続行」ボタン", () => {
    it("「続行」を押すと window.open が対象 URL で呼ばれる", async () => {
      renderWithProvider("https://example.com");
      await userEvent.click(screen.getByRole("button", { name: "リンク" }));
      await userEvent.click(screen.getByRole("button", { name: "続行" }));
      expect(window.open).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
    });

    it("「続行」を押すとモーダルが閉じる", async () => {
      renderWithProvider("https://example.com");
      await userEvent.click(screen.getByRole("button", { name: "リンク" }));
      await userEvent.click(screen.getByRole("button", { name: "続行" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("「キャンセル」ボタン", () => {
    it("「キャンセル」を押すと window.open は呼ばれない", async () => {
      renderWithProvider("https://example.com");
      await userEvent.click(screen.getByRole("button", { name: "リンク" }));
      await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
      expect(window.open).not.toHaveBeenCalled();
    });

    it("「キャンセル」を押すとモーダルが閉じる", async () => {
      renderWithProvider("https://example.com");
      await userEvent.click(screen.getByRole("button", { name: "リンク" }));
      await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("「今後この警告を表示しない」", () => {
    it("チェックして「続行」すると localStorage に保存される", async () => {
      renderWithProvider("https://example.com");
      await userEvent.click(screen.getByRole("button", { name: "リンク" }));
      await userEvent.click(screen.getByRole("checkbox", { name: /今後この警告を表示しない/ }));
      await userEvent.click(screen.getByRole("button", { name: "続行" }));
      expect(localStorageMock.getItem(STORAGE_KEY)).toBe("true");
    });

    it("localStorage に保存済みの場合は外部リンクでもモーダルを開かず直接 window.open する", async () => {
      localStorageMock.setItem(STORAGE_KEY, "true");
      renderWithProvider("https://example.com");
      await userEvent.click(screen.getByRole("button", { name: "リンク" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(window.open).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
    });
  });
});
