/**
 * コミュニティフォームの共通フィールド群（#595）。
 * CreateCommunityForm / EditCommunityForm の両方が共有する
 * name / description / generationInstruction の 3 フィールドを描画する。
 */
import type { ReactElement } from "react";

import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
} from "@hatchery/common";

import { TextField } from "./uiParts/index.js";

/** 各フィールドへのバインディング props。 */
interface FieldBindingProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
  error: boolean;
  helperText: string;
}

/** generationInstruction は任意フィールドのため error/required は持たない。 */
interface OptionalFieldBindingProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
  helperText: string;
}

export interface CommunityFormFieldsProps {
  name: FieldBindingProps;
  description: FieldBindingProps;
  generationInstruction: OptionalFieldBindingProps;
}

/**
 * コミュニティフォームの共通フィールド群（#595）。
 * name・description・generationInstruction の 3 フィールドを描画する。
 * フォーム状態は呼び出し元の form.Field が保持し、このコンポーネントは
 * value/onChange/onBlur/error/helperText を受け取るだけ（状態を持たない）。
 */
export function CommunityFormFields({
  name,
  description,
  generationInstruction,
}: CommunityFormFieldsProps): ReactElement {
  return (
    <>
      <TextField
        label="コミュニティ名"
        size="small"
        required
        value={name.value}
        onChange={name.onChange}
        onBlur={name.onBlur}
        inputProps={{ maxLength: COMMUNITY_NAME_MAX_LENGTH }}
        error={name.error}
        helperText={name.helperText}
      />
      <TextField
        label="コミュニティ概要（公開）"
        size="small"
        required
        multiline
        rows={3}
        value={description.value}
        onChange={description.onChange}
        onBlur={description.onBlur}
        inputProps={{ maxLength: COMMUNITY_DESCRIPTION_MAX_LENGTH }}
        error={description.error}
        helperText={description.helperText}
      />
      <TextField
        label="生成プロンプト指示（管理者のみ・非公開）定時バッチの生成プロンプトに使用"
        size="small"
        multiline
        rows={4}
        value={generationInstruction.value}
        onChange={generationInstruction.onChange}
        onBlur={generationInstruction.onBlur}
        inputProps={{ maxLength: COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH }}
        helperText={generationInstruction.helperText}
      />
    </>
  );
}
