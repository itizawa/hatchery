/**
 * #596: withSettingsTabPanel HOC のユニットテスト
 *
 * タブパネルの Suspense/QueryBoundary/Skeleton ラップを汎用ヘルパーに集約するリファクタリング。
 * HOC が children を QueryBoundary で包み、fallback・エラー時の挙動が正しく動作することを検証する。
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "../queryClient.js";
import { withSettingsTabPanel } from "./SettingsScene.js";

function Wrapper({ children }: { children: ReactNode }): ReactElement {
  // createQueryClient は再レンダリングのたびに呼ばれないよう、コンポーネント外で生成する必要がある。
  // ここでは render ごとに新しい QueryClient を渡す簡易 Wrapper として実装しており、
  // テスト内では Wrapper の再レンダリングを発生させないため問題ない。
  // より厳密には各テストの beforeEach で生成する設計が望ましいが、
  // このテストファイルのケース（再レンダリングなし）では本実装で十分。
  const [queryClient] = useState(() => createQueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("withSettingsTabPanel（#596）", () => {
  beforeEach(() => {
    // React が ErrorBoundary の throw で console.error を呼ぶので抑制する
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("(a) Inner が正常にレンダリングされると Inner の内容が表示される", async () => {
    function NormalInner(): ReactElement {
      return <div>Inner コンテンツ</div>;
    }
    const WrappedComponent = withSettingsTabPanel(NormalInner, <div>ローディング中</div>);

    render(
      <Wrapper>
        <WrappedComponent />
      </Wrapper>,
    );

    expect(await screen.findByText("Inner コンテンツ")).toBeInTheDocument();
  });

  it("(b) Inner が Suspend しているときは fallback が表示される", async () => {
    function SuspendingInner(): ReactElement {
      throw new Promise<void>(() => {
        // 永遠に解決しない
      });
    }
    const WrappedComponent = withSettingsTabPanel(
      SuspendingInner,
      <div data-testid="custom-skeleton">スケルトン</div>,
    );

    render(
      <Wrapper>
        <WrappedComponent />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("custom-skeleton")).toBeInTheDocument();
    });
  });

  it("(c) Inner が throw したときは QueryBoundary の再試行フォールバックが表示される", async () => {
    function ThrowingInner(): ReactElement {
      throw new Error("テストエラー");
    }
    const WrappedComponent = withSettingsTabPanel(ThrowingInner, <div>ローディング中</div>);

    render(
      <Wrapper>
        <WrappedComponent />
      </Wrapper>,
    );

    expect(
      await screen.findByRole("button", { name: "再試行" }),
    ).toBeInTheDocument();
  });
});
