import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_EMPLOYEES } from "@hatchery/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfficeScene } from "./OfficeScene.js";

afterEach(() => cleanup());

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("OfficeScene", () => {
  it('renders "仮想オフィス" heading', () => {
    render(<OfficeScene />);
    expect(screen.getByRole("heading", { name: "仮想オフィス" })).toBeInTheDocument();
  });

  it("renders a button with aria-label for each DEFAULT_EMPLOYEE", () => {
    render(<OfficeScene />);
    for (const employee of DEFAULT_EMPLOYEES) {
      expect(screen.getByRole("button", { name: employee.displayName })).toBeInTheDocument();
    }
  });

  it("opens popover with role and isBot badge on character click", async () => {
    const user = userEvent.setup();
    render(<OfficeScene />);

    expect(screen.queryByText("ムードメーカー")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "haru" }));

    expect(screen.getByText("ムードメーカー")).toBeInTheDocument();
    expect(screen.getByText("AI社員")).toBeInTheDocument();
  });

  it("opens popover with Enter key on character", async () => {
    const user = userEvent.setup();
    render(<OfficeScene />);

    expect(screen.queryByText("ベテラン")).not.toBeInTheDocument();

    screen.getByRole("button", { name: "ken" }).focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("ベテラン")).toBeInTheDocument();
  });
});
