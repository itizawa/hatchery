import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecentWorkersSection } from "./RecentWorkersSection.js";
import type { RecentWorker } from "../api/communities.js";

const mockWorkers: RecentWorker[] = [
  { id: "worker-1", displayName: "haru", role: "ムードメーカー", imageUrl: null },
  { id: "worker-2", displayName: "ken", role: "ベテラン", imageUrl: null },
];

// #462: RecentWorkersSection は純表示コンポーネント（workers のみ）。
// ローディング/エラーは呼び出し側の QueryBoundary に委譲するため、ここでは検証しない。
describe("RecentWorkersSection", () => {
  it("ワーカーがいるとき displayName と role を表示する", () => {
    render(<RecentWorkersSection workers={mockWorkers} />);
    expect(screen.getByText("haru")).toBeInTheDocument();
    expect(screen.getByText("ムードメーカー")).toBeInTheDocument();
    expect(screen.getByText("ken")).toBeInTheDocument();
    expect(screen.getByText("ベテラン")).toBeInTheDocument();
  });

  it("workers が 0 件のとき空状態メッセージを表示する", () => {
    render(<RecentWorkersSection workers={[]} />);
    expect(screen.getByText("まだ投稿がありません")).toBeInTheDocument();
  });
});
