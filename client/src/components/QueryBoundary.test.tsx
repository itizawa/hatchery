import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QueryBoundary } from "./QueryBoundary";

/** 常に throw してエラーフォールバックを発火させるテスト用子コンポーネント。 */
function AlwaysThrows(): ReactElement {
  throw new Error("boom");
}

/** 解決しない Promise を throw して Suspend し続けるテスト用子コンポーネント。 */
function SuspendsForever(): ReactElement {
  throw new Promise<void>(() => {
    // 永遠に解決しない（Suspense fallback を表示し続ける）。
  });
}

describe("QueryBoundary", () => {
  // React は子が throw すると console.error にエラーを出すため、テスト中は抑制する。
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("(a) 子が throw すると既定のエラーフォールバック（再試行ボタン）が表示される", () => {
    render(
      <QueryBoundary>
        <AlwaysThrows />
      </QueryBoundary>,
    );

    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("(b) 「再試行」で reset が呼ばれ、子が再レンダリングされる", async () => {
    // throw するかどうかは外部フラグで制御する（render 中に書き換えると React の再試行で
    // throw が握りつぶされるため、フラグの切替は reset ハンドラ経由でのみ行う）。
    const flag = { shouldThrow: true };

    /** flag.shouldThrow が true の間 throw し、false になると正常表示に切り替わる子。 */
    function Flaky(): ReactElement {
      if (flag.shouldThrow) {
        throw new Error("boom once");
      }
      return <div>復活コンテンツ</div>;
    }

    // reset が呼ばれたら次回レンダリングでは throw しないようにフラグを倒す。
    const onResetSpy = vi.fn(() => {
      flag.shouldThrow = false;
    });

    render(
      <QueryBoundary
        errorFallback={({ reset }) => (
          <button
            type="button"
            onClick={() => {
              onResetSpy();
              reset();
            }}
          >
            再試行
          </button>
        )}
      >
        <Flaky />
      </QueryBoundary>,
    );

    // 初回は throw されエラーフォールバックが出る。
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
    expect(screen.queryByText("復活コンテンツ")).not.toBeInTheDocument();

    // 再試行（reset）で子が再レンダリングされ、今度は正常表示になる。
    await userEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(onResetSpy).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("復活コンテンツ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "再試行" })).not.toBeInTheDocument();
  });

  it("(c) 子が Suspend している間は fallback が表示される", () => {
    render(
      <QueryBoundary fallback={<div>読み込み中...</div>}>
        <SuspendsForever />
      </QueryBoundary>,
    );

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("errorFallback を渡すと既定の代わりにそれが表示され、reset を呼べる", async () => {
    let recovered = false;

    function FlakyCustom(): ReactElement {
      if (!recovered) {
        throw new Error("custom boom");
      }
      return <div>カスタム復活</div>;
    }

    render(
      <QueryBoundary
        errorFallback={({ error, reset }) => (
          <div>
            <span>カスタムエラー: {error.message}</span>
            <button
              type="button"
              onClick={() => {
                recovered = true;
                reset();
              }}
            >
              カスタム再試行
            </button>
          </div>
        )}
      >
        <FlakyCustom />
      </QueryBoundary>,
    );

    expect(screen.getByText("カスタムエラー: custom boom")).toBeInTheDocument();
    // 既定フォールバックのボタンは表示されない。
    expect(screen.queryByRole("button", { name: "再試行" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "カスタム再試行" }));
    expect(await screen.findByText("カスタム復活")).toBeInTheDocument();
  });

  it("正常時は子をそのまま表示する", () => {
    function Ok(): ReactElement {
      const [v] = useState("正常コンテンツ");
      return <div>{v}</div>;
    }

    render(
      <QueryBoundary>
        <Ok />
      </QueryBoundary>,
    );

    expect(screen.getByText("正常コンテンツ")).toBeInTheDocument();
  });
});
