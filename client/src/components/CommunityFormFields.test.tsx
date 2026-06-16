/**
 * CommunityFormFields の単体テスト（#595）。
 * name/description/generationInstruction の 3 フィールドが
 * 正しいラベル・maxLength・バリデーション設定で描画されることを検証する。
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
} from "@hatchery/common";

import { CommunityFormFields } from "./CommunityFormFields";

// テスト用のデフォルト props
const defaultProps = {
  name: {
    value: "",
    onChange: vi.fn(),
    onBlur: vi.fn(),
    error: false,
    helperText: "",
  },
  description: {
    value: "",
    onChange: vi.fn(),
    onBlur: vi.fn(),
    error: false,
    helperText: `最大 ${COMMUNITY_DESCRIPTION_MAX_LENGTH} 文字`,
  },
  generationInstruction: {
    value: "",
    onChange: vi.fn(),
    onBlur: vi.fn(),
    helperText: `最大 ${COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH} 文字（省略時は概要を使用）`,
  },
};

describe("CommunityFormFields（#595）", () => {
  it("コミュニティ名・概要・生成プロンプト指示フィールドが描画される", () => {
    render(<CommunityFormFields {...defaultProps} />);
    expect(screen.getByRole("textbox", { name: /コミュニティ名/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /生成プロンプト指示/ })).toBeInTheDocument();
  });

  it("各入力に Zod .max() と整合する maxLength が設定されている（#91）", () => {
    render(<CommunityFormFields {...defaultProps} />);
    expect(screen.getByRole("textbox", { name: /コミュニティ名/ })).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_NAME_MAX_LENGTH),
    );
    expect(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_DESCRIPTION_MAX_LENGTH),
    );
    expect(screen.getByRole("textbox", { name: /生成プロンプト指示/ })).toHaveAttribute(
      "maxlength",
      String(COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH),
    );
  });

  it("コミュニティ名と概要は required 属性を持つ", () => {
    render(<CommunityFormFields {...defaultProps} />);
    expect(screen.getByRole("textbox", { name: /コミュニティ名/ })).toBeRequired();
    expect(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toBeRequired();
  });

  it("生成プロンプト指示は required 属性を持たない（任意フィールド）", () => {
    render(<CommunityFormFields {...defaultProps} />);
    expect(screen.getByRole("textbox", { name: /生成プロンプト指示/ })).not.toBeRequired();
  });

  it("name.error=true のとき error 状態で描画される", () => {
    const props = {
      ...defaultProps,
      name: { ...defaultProps.name, error: true, helperText: "コミュニティ名は必須です" },
    };
    render(<CommunityFormFields {...props} />);
    expect(screen.getByText("コミュニティ名は必須です")).toBeInTheDocument();
  });

  it("description.error=true のとき error 状態で描画される", () => {
    const props = {
      ...defaultProps,
      description: { ...defaultProps.description, error: true, helperText: "作風の説明は必須です" },
    };
    render(<CommunityFormFields {...props} />);
    expect(screen.getByText("作風の説明は必須です")).toBeInTheDocument();
  });

  it("name フィールドに入力すると onChange が呼ばれる", async () => {
    const onChange = vi.fn();
    const props = { ...defaultProps, name: { ...defaultProps.name, onChange } };
    render(<CommunityFormFields {...props} />);
    await userEvent.type(screen.getByRole("textbox", { name: /コミュニティ名/ }), "テスト");
    expect(onChange).toHaveBeenCalled();
  });

  it("初期値が value props に反映される", () => {
    const props = {
      ...defaultProps,
      name: { ...defaultProps.name, value: "AI コミュニティ" },
      description: { ...defaultProps.description, value: "AI の話題を語る" },
      generationInstruction: { ...defaultProps.generationInstruction, value: "詳しく議論してください" },
    };
    render(<CommunityFormFields {...props} />);
    expect(screen.getByRole("textbox", { name: /コミュニティ名/ })).toHaveValue("AI コミュニティ");
    expect(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toHaveValue("AI の話題を語る");
    expect(screen.getByRole("textbox", { name: /生成プロンプト指示/ })).toHaveValue("詳しく議論してください");
  });
});
