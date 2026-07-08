/**
 * コミュニティフォームの共通フィールド群（#595）。
 * CreateCommunityForm / EditCommunityForm の両方が共有する
 * name / description / generationInstruction の 3 フィールドを描画する。
 * form を props として受け取り、内部で form.Field を呼び出す。
 */

import type { ReactElement } from "react";

import {
  type DeepValue,
  type FormAsyncValidateOrFn,
  type FormValidateOrFn,
  type ReactFormExtendedApi,
  type Updater,
} from "@tanstack/react-form";

import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_FEED_URL_MAX_LENGTH,
  COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
} from "@hatchery/common";

import { TextField } from "./uiParts/index.js";
import { validateUrl } from "../utils/validateUrl.js";

/**
 * CommunityFormFields が使用するフォームデータの最小インターフェース（#736）。
 * CreateCommunityInput / UpdateCommunityInput の共通フィールド。
 * UpdateCommunityInput では name / description が optional（string | undefined）なため optional にする。
 * generationInstruction のみ nullable（string | null | undefined）。
 */
interface CommunityFormData {
  name?: string | undefined;
  description?: string | undefined;
  generationInstruction?: string | null | undefined;
  feedUrl?: string | null | undefined;
}

interface CommunityFormFieldsProps<
  TData extends CommunityFormData,
  TOnMount extends undefined | FormValidateOrFn<TData>,
  TOnChange extends undefined | FormValidateOrFn<TData>,
  TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TData>,
  TOnBlur extends undefined | FormValidateOrFn<TData>,
  TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TData>,
  TOnSubmit extends undefined | FormValidateOrFn<TData>,
  TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TData>,
  TOnDynamic extends undefined | FormValidateOrFn<TData>,
  TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TData>,
  TOnServer extends undefined | FormAsyncValidateOrFn<TData>,
  TSubmitMeta,
> {
  form: ReactFormExtendedApi<
    TData,
    TOnMount,
    TOnChange,
    TOnChangeAsync,
    TOnBlur,
    TOnBlurAsync,
    TOnSubmit,
    TOnSubmitAsync,
    TOnDynamic,
    TOnDynamicAsync,
    TOnServer,
    TSubmitMeta
  >;
}

/**
 * コミュニティフォームの共通フィールド群（#595）。
 * name・description・generationInstruction の 3 フィールドを描画する。
 * フォーム状態は呼び出し元の useForm が保持し、form.Field を内部で呼び出す。
 * @tanstack/react-form フォーム規約（#262）に準拠。
 * ジェネリクス制約により CreateCommunityInput / UpdateCommunityInput の両方に対応（#736）。
 */
export function CommunityFormFields<
  TData extends CommunityFormData,
  TOnMount extends undefined | FormValidateOrFn<TData>,
  TOnChange extends undefined | FormValidateOrFn<TData>,
  TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TData>,
  TOnBlur extends undefined | FormValidateOrFn<TData>,
  TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TData>,
  TOnSubmit extends undefined | FormValidateOrFn<TData>,
  TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TData>,
  TOnDynamic extends undefined | FormValidateOrFn<TData>,
  TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TData>,
  TOnServer extends undefined | FormAsyncValidateOrFn<TData>,
  TSubmitMeta,
>({
  form,
}: CommunityFormFieldsProps<
  TData,
  TOnMount,
  TOnChange,
  TOnChangeAsync,
  TOnBlur,
  TOnBlurAsync,
  TOnSubmit,
  TOnSubmitAsync,
  TOnDynamic,
  TOnDynamicAsync,
  TOnServer,
  TSubmitMeta
>): ReactElement {
  return (
    <>
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) => (!value ? "コミュニティ名は必須です" : undefined),
        }}
      >
        {(field) => (
          <TextField
            label="コミュニティ名"
            size="small"
            required
            value={field.state.value ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              // e.target.value は string であり、TData["name"] のサブタイプ（string | undefined）に
              // 代入可能だが、TypeScript は DeepValue ジェネリクス経由では推論できないため
              // unknown 経由でのアサーションで補助する（any は使わない）
              field.handleChange(e.target.value as unknown as Updater<DeepValue<TData, "name">>)
            }
            onBlur={field.handleBlur}
            slotProps={{ htmlInput: { maxLength: COMMUNITY_NAME_MAX_LENGTH } }}
            error={field.state.meta.errors.length > 0}
            helperText={String(field.state.meta.errors[0] ?? "")}
          />
        )}
      </form.Field>
      <form.Field
        name="description"
        validators={{
          onChange: ({ value }) => (!value ? "作風の説明は必須です" : undefined),
        }}
      >
        {(field) => (
          <TextField
            label="コミュニティ概要（公開）"
            size="small"
            required
            multiline
            rows={3}
            value={field.state.value ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              field.handleChange(
                e.target.value as unknown as Updater<DeepValue<TData, "description">>,
              )
            }
            onBlur={field.handleBlur}
            slotProps={{ htmlInput: { maxLength: COMMUNITY_DESCRIPTION_MAX_LENGTH } }}
            error={field.state.meta.errors.length > 0}
            helperText={String(field.state.meta.errors[0] ?? `最大 ${COMMUNITY_DESCRIPTION_MAX_LENGTH} 文字`)}
          />
        )}
      </form.Field>
      <form.Field name="generationInstruction">
        {(field) => (
          <TextField
            label="生成プロンプト指示（管理者のみ・非公開）定時バッチの生成プロンプトに使用"
            size="small"
            multiline
            rows={4}
            value={field.state.value ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              field.handleChange(
                e.target.value as unknown as Updater<DeepValue<TData, "generationInstruction">>,
              )
            }
            onBlur={field.handleBlur}
            slotProps={{ htmlInput: { maxLength: COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH } }}
            helperText={`最大 ${COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH} 文字（省略時は概要を使用）`}
          />
        )}
      </form.Field>
      <form.Field
        name="feedUrl"
        validators={{
          onChange: ({ value }) => validateUrl((value as string) ?? ""),
        }}
      >
        {(field) => (
          <TextField
            label="外部フィード URL（管理者のみ・非公開）RSS/Atom を post 定時バッチに注入"
            size="small"
            value={field.state.value ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              field.handleChange(
                (e.target.value === "" ? null : e.target.value) as unknown as Updater<
                  DeepValue<TData, "feedUrl">
                >,
              )
            }
            onBlur={field.handleBlur}
            slotProps={{ htmlInput: { maxLength: COMMUNITY_FEED_URL_MAX_LENGTH } }}
            error={field.state.meta.errors.length > 0}
            helperText={String(
              field.state.meta.errors[0] ??
                `最大 ${COMMUNITY_FEED_URL_MAX_LENGTH} 文字（任意・RSS/Atom フィード URL）`,
            )}
          />
        )}
      </form.Field>
    </>
  );
}
