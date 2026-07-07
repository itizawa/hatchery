import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommunityWorkersSection } from "./CommunityWorkersSection.js";
import type { CommunityWorker } from "../api/communities.js";

const mockWorkers: CommunityWorker[] = [
  { id: "worker-1", displayName: "haru", role: "ムードメーカー" },
  { id: "worker-2", displayName: "ken", role: "ベテラン" },
];

// #462 / #1078: CommunityWorkersSection は純表示コンポーネント（workers + 無限スクロール用の props のみ）。
// ローディング/エラーは呼び出し側の QueryBoundary に委譲するため、ここでは検証しない。
describe("CommunityWorkersSection", () => {
  it("ワーカーがいるとき displayName と role を表示する", () => {
    render(<CommunityWorkersSection workers={mockWorkers} />);
    expect(screen.getByText("haru")).toBeInTheDocument();
    expect(screen.getByText("ムードメーカー")).toBeInTheDocument();
    expect(screen.getByText("ken")).toBeInTheDocument();
    expect(screen.getByText("ベテラン")).toBeInTheDocument();
  });

  it("workers が 0 件のとき空状態メッセージを表示する", () => {
    render(<CommunityWorkersSection workers={[]} />);
    expect(screen.getByText("まだ投稿がありません")).toBeInTheDocument();
  });

  it("isFetchingNextPage が true のとき「読み込み中...」を表示する（#1078）", () => {
    render(<CommunityWorkersSection workers={mockWorkers} isFetchingNextPage />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("isFetchingNextPage が false のとき「読み込み中...」を表示しない（#1078）", () => {
    render(<CommunityWorkersSection workers={mockWorkers} isFetchingNextPage={false} />);
    expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
  });

  it("sentinelRef を渡すと sentinel 要素に ref が設定される（#1078）", () => {
    const sentinelRef = createRef<HTMLDivElement>();
    render(<CommunityWorkersSection workers={mockWorkers} sentinelRef={sentinelRef} />);
    expect(sentinelRef.current).not.toBeNull();
  });
});
