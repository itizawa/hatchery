import {
  // auth（ログイン / プロフィール更新）
  LoginRequestSchema,
  UpdateProfileSchema,
  // community（旧 channel）の作成 / 更新
  CreateCommunitySchema,
  UpdateCommunitySchema,
  // worker（旧 employee）の作成 / 更新
  CreateWorkerSchema,
  UpdateWorkerSchema,
  // appSetting（管理者の設定更新）
  UpdateAppSettingSchema,
  // invitation（招待リンク発行 / 受諾）
  CreateInvitationSchema,
  AcceptInvitationSchema,
} from "@hatchery/common";

import { extractFieldSpecs } from "./extractFieldSpecs.js";
import type { FormSpec } from "./types.js";

/**
 * 抽出対象の入力系スキーマ定義（Issue #201）。
 *
 * Issue 本文の AC #2 はリネーム前のスキーマ名（channel/employee/message）を列挙しているが、
 * 現行コードでは community/worker 等にリネーム済みのため、
 * 「実際にユーザーが入力するフォームの入力系スキーマ」という意図に従って現行名で採用する。
 *
 * ここで列挙したスキーマから extractFieldSpecs で項目一覧を生成するため、
 * 一覧は常に Zod 定義（正本）に追従し drift しない。
 */
const FORM_SOURCES = [
  {
    id: "LoginRequestSchema",
    title: "ログイン（LoginScene）",
    description: "ログイン画面で入力する ID とパスワード。",
    schema: LoginRequestSchema,
  },
  {
    id: "UpdateProfileSchema",
    title: "プロフィール更新（AccountScene / PATCH /auth/me）",
    description: "アカウント設定画面で更新する表示名・アバター URL。",
    schema: UpdateProfileSchema,
  },
  {
    id: "CreateCommunitySchema",
    title: "コミュニティ作成（管理）",
    description: "管理者が community を新規作成する際の入力。",
    schema: CreateCommunitySchema,
  },
  {
    id: "UpdateCommunitySchema",
    title: "コミュニティ更新（管理）",
    description: "管理者が community の name / description を編集する際の入力。",
    schema: UpdateCommunitySchema,
  },
  {
    id: "CreateWorkerSchema",
    title: "ワーカー作成（管理）",
    description: "管理者がワーカー（旧 employee）を新規作成する際の入力。",
    schema: CreateWorkerSchema,
  },
  {
    id: "UpdateWorkerSchema",
    title: "ワーカー更新（管理）",
    description: "管理者がワーカーの表示名・役割・性格を編集する際の入力。",
    schema: UpdateWorkerSchema,
  },
  {
    id: "UpdateAppSettingSchema",
    title: "アプリ設定更新（管理）",
    description: "管理者がアプリ設定（key / value）を更新する際の入力。",
    schema: UpdateAppSettingSchema,
  },
  {
    id: "CreateInvitationSchema",
    title: "招待リンク発行（管理）",
    description: "管理者が招待リンクを発行する際の入力（有効期限・メモ）。",
    schema: CreateInvitationSchema,
  },
  {
    id: "AcceptInvitationSchema",
    title: "招待受諾・ユーザー登録",
    description: "招待リンクから新規ユーザーが登録する際の入力。",
    schema: AcceptInvitationSchema,
  },
] as const;

/**
 * 生成由来の画面項目一覧。各エントリの `fields` は extractFieldSpecs により
 * Zod スキーマから抽出されるため、Zod を変更すると一覧も自動で追従する。
 */
export const FORM_SPECS: FormSpec[] = FORM_SOURCES.map((src) => ({
  id: src.id,
  title: src.title,
  description: src.description,
  fields: extractFieldSpecs(src.schema),
}));
