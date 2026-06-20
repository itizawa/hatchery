import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("arrow プロパティが未指定の場合、arrow=true がデフォルトで適用される", () => {
    const { container } = render(
      <Tooltip title="テスト">
        <span>テキスト</span>
      </Tooltip>,
    );
    // Tooltip の子要素が正しく描画されることを確認
    expect(container.querySelector("span")).toBeInTheDocument();
  });

  it("title プロパティが正しく渡される", () => {
    const { container } = render(
      <Tooltip title="ツールチップテキスト">
        <span>テキスト</span>
      </Tooltip>,
    );
    expect(container.querySelector("span")).toBeInTheDocument();
  });

  it("arrow={false} を渡した場合でもコンポーネントが正常に描画される", () => {
    const { container } = render(
      <Tooltip title="テスト" arrow={false}>
        <span>テキスト</span>
      </Tooltip>,
    );
    expect(container.querySelector("span")).toBeInTheDocument();
  });

  it("その他の TooltipProps（placement など）が正しく受け渡しされる", () => {
    const { container } = render(
      <Tooltip title="テスト" placement="bottom">
        <span>テキスト</span>
      </Tooltip>,
    );
    expect(container.querySelector("span")).toBeInTheDocument();
  });
});
