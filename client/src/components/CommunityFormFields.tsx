/**
 * コミュニティフォームの共通フィールド群（#595）。
 * CreateCommunityForm / EditCommunityForm の両方が共有する
 * name / description / generationInstruction の 3 フィールドを描画する。
 * form を props として受け取り、内部で form.Field を呼び出す。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// @tanstack/react-form の FormApi / ReactFormApi のジェネリクスが複雑で
// CreateCommunityInput / UpdateCommunityInput の両方に対応するために any を使用する。
// 設計書 docs/design/issue-595.md §7 参照。

import type { ReactElement } from "react";

import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
} from "@hatchery/common";

import { TextField } from "./uiParts/index.js";

/** @tanstack/react-form の form オブジェクトの最小インターフェース。 */
type AnyForm = { Field: any };

export interface CommunityFormFieldsProps {
  form: AnyForm;
}

/**
 * コミュニティフォームの共通フィールド群（#595）。
 * name・description・generationInstruction の 3 フィールドを描画する。
 * フォーム状態は呼び出し元の useForm が保持し、form.Field を内部で呼び出す。
 * @tanstack/react-form フォーム規約（#262）に準拠。
 */
export function CommunityFormFields({ form }: CommunityFormFieldsProps): ReactElement {
  return (
    <>
      <form.Field
        name="name"
        validators={{
          onSubmit: ({ value }: any) => (!value ? "コミュニティ名は必須です" : undefined),
        }}
      >
        {(field: any) => (
          <TextField
            label="コミュニティ名"
            size="small"
            required
            value={field.state.value ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            slotProps={{ htmlInput: { maxLength: COMMUNITY_NAME_MAX_LENGTH } }}
            error={field.state.meta.errors.length > 0}
            helperText={field.state.meta.errors[0] ?? ""}
          />
        )}
      </form.Field>
      <form.Field
        name="description"
        validators={{
          onSubmit: ({ value }: any) => (!value ? "作風の説明は必須です" : undefined),
        }}
      >
        {(field: any) => (
          <TextField
            label="コミュニティ概要（公開）"
            size="small"
            required
            multiline
            rows={3}
            value={field.state.value ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            slotProps={{ htmlInput: { maxLength: COMMUNITY_DESCRIPTION_MAX_LENGTH } }}
            error={field.state.meta.errors.length > 0}
            helperText={field.state.meta.errors[0] ?? `最大 ${COMMUNITY_DESCRIPTION_MAX_LENGTH} 文字`}
          />
        )}
      </form.Field>
      <form.Field name="generationInstruction">
        {(field: any) => (
          <TextField
            label="生成プロンプト指示（管理者のみ・非公開）定時バッチの生成プロンプトに使用"
            size="small"
            multiline
            rows={4}
            value={field.state.value ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            slotProps={{ htmlInput: { maxLength: COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH } }}
            helperText={`最大 ${COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH} 文字（省略時は概要を使用）`}
          />
        )}
      </form.Field>
    </>
  );
}
