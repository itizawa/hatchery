import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecentWorkersSection } from "./RecentWorkersSection.js";
import type { RecentWorker } from "../api/communities.js";

const mockWorkers: RecentWorker[] = [
  { id: "worker-1", displayName: "haru", role: "ムードメーカー", imageUrl: null },
  { id: "worker-2", displayName: "ken", role: "ベテラン", imageUrl: null },
];

describe("RecentWorkersSection", () => {
  it("ワーカーがいるとき displayName と role を表示する", () => {
    render(<RecentWorkersSection workers={mockWorkers} isLoading={false} />);
    expect(screen.getByText("haru")).toBeInTheDocument();
    expect(screen.getByText("ムードメーカー")).toBeInTheDocument();
    expect(screen.getByText("ken")).toBeInTheDocument();
    expect(screen.getByText("ベテラン")).toBeInTheDocument();
  });

  it("workers が 0 件のとき空状態メッセージを表示する", () => {
    render(<RecentWorkersSection workers={[]} isLoading={false} />);
    expect(screen.getByText("まだ投稿がありません")).toBeInTheDocument();
  });

  it("isLoading=true のとき読み込み中テキストを表示する", () => {
    render(<RecentWorkersSection workers={[]} isLoading={true} />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("isError=true のとき読み込み失敗テキストを表示する", () => {
    render(<RecentWorkersSection workers={[]} isLoading={false} isError={true} />);
    expect(screen.getByText("読み込みに失敗しました")).toBeInTheDocument();
  });
});
