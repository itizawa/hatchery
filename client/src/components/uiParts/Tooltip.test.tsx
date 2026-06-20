import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("arrow プロパティが未指定の場合、arrow=true がデフォルトで適用される（open で強制表示して矢印要素を確認）", () => {
    render(
      <Tooltip title="テスト" open>
        <span>テキスト</span>
      </Tooltip>,
    );
    // MUI Tooltip の arrow=true のとき .MuiTooltip-arrow 要素が描画される
    const arrowEl = document.querySelector(".MuiTooltip-arrow");
    expect(arrowEl).toBeInTheDocument();
  });

  it("title プロパティが正しく渡され、ツールチップのテキストが表示される（open で強制表示）", () => {
    render(
      <Tooltip title="ツールチップテキスト" open>
        <span>テキスト</span>
      </Tooltip>,
    );
    expect(screen.getByText("ツールチップテキスト")).toBeInTheDocument();
  });

  it("arrow={false} を渡した場合は矢印要素が描画されない", () => {
    render(
      <Tooltip title="テスト" arrow={false} open>
        <span>テキスト</span>
      </Tooltip>,
    );
    const arrowEl = document.querySelector(".MuiTooltip-arrow");
    expect(arrowEl).not.toBeInTheDocument();
  });

  it("その他の TooltipProps（placement など）が正しく受け渡しされる", () => {
    render(
      <Tooltip title="テスト" placement="bottom" open>
        <span>テキスト</span>
      </Tooltip>,
    );
    // placement="bottom" のとき MuiTooltip に data-popper-placement 属性が付く
    const tooltip = document.querySelector("[data-popper-placement]");
    expect(tooltip).toHaveAttribute("data-popper-placement", "bottom");
  });
});
