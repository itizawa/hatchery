/**
 * CommunityFormFields の描画テスト（#595）。
 * CommunitiesTab の CreateCommunityForm / EditCommunityForm で共通化された
 * name / description / generationInstruction フィールドの描画を検証する。
 */
import { useForm } from "@tanstack/react-form";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
} from "@hatchery/common";

import { CommunityFormFields } from "./CommunityFormFields";

function TestWrapper(): ReactElement {
  const form = useForm({
    defaultValues: {
      name: "テスト名",
      description: "テスト概要",
      generationInstruction: "",
    },
    onSubmit: async () => {},
  });
  return <CommunityFormFields form={form} />;
}

describe("CommunityFormFields（#595）", () => {
  it("name / description / generationInstruction の入力欄を描画する", () => {
    render(<TestWrapper />);
    expect(screen.getByRole("textbox", { name: /コミュニティ名/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /生成プロンプト指示/ })).toBeInTheDocument();
  });

  it("name / description は required 属性を持つ", () => {
    render(<TestWrapper />);
    expect(screen.getByRole("textbox", { name: /コミュニティ名/ })).toBeRequired();
    expect(screen.getByRole("textbox", { name: /コミュニティ概要（公開）/ })).toBeRequired();
    expect(screen.getByRole("textbox", { name: /生成プロンプト指示/ })).not.toBeRequired();
  });

  it("各入力に Zod .max() と整合する maxLength が設定されている（#91）", () => {
    render(<TestWrapper />);
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
});
