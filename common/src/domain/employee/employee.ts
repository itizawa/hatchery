import { z } from "zod";

export const EMPLOYEE_DISPLAY_NAME_MAX_LENGTH = 50;
export const EMPLOYEE_ROLE_MAX_LENGTH = 50;
/** 画像 URL の最大文字数（#220・#91）。 */
export const EMPLOYEE_IMAGE_URL_MAX_LENGTH = 500;

/**
 * AI 社員。MVP に必要な最小限（id・displayName・role）。
 * キャラクター・バイブルの詳細（語彙の井戸など）は Phase 1 のプロンプト設計 Issue に委ねる（設計書 §7）。
 */
export const EmployeeSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).max(EMPLOYEE_DISPLAY_NAME_MAX_LENGTH),
  role: z.string().min(1).max(EMPLOYEE_ROLE_MAX_LENGTH).optional(),
  // #49: AI 社員（true）とユーザー所有社員（false）を区別する。省略時は false。
  isBot: z.boolean().default(false),
  // #38: AI バッチのプロンプト指針となる性格設定（任意・500 文字以内）。
  personality: z.string().max(500).optional(),
  // #220: 社員の画像 URL（任意）。#204 でアップロード基盤実装後に設定値が入る。
  imageUrl: z.string().url().max(EMPLOYEE_IMAGE_URL_MAX_LENGTH).optional(),
  // #204: GCS アップロード画像のアバター URL（任意）。2048 文字以内。
  avatarUrl: z.string().url().max(2048).optional(),
  // #218: 論理削除日時（任意）。null=有効、値=削除済み（ISO 文字列 or Date）。
  deletedAt: z.union([z.string().datetime(), z.date()]).nullable().optional(),
});

// 出力型（parse 後）を採用し、`isBot` は常に boolean とする（#49）。
// `.default(false)` により parse 時に既定が埋まるため、bot 判定（#48 で利用）を型安全に扱える。
export type Employee = z.infer<typeof EmployeeSchema>;

/** PATCH /employees/:id のリクエストボディ。全フィールド任意（部分更新）。 */
export const UpdateEmployeeSchema = z.object({
  displayName: z.string().min(1).max(EMPLOYEE_DISPLAY_NAME_MAX_LENGTH).optional(),
  role: z.string().min(1).max(EMPLOYEE_ROLE_MAX_LENGTH).optional(),
  personality: z.string().max(500).optional(),
});

export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;

/**
 * POST /admin/employees のリクエストボディ（#217）。
 * displayName は必須。role・personality は任意。
 * isBot は server 側で常に true を付与するためリクエストには含めない。
 */
export const CreateEmployeeSchema = z.object({
  displayName: z.string().min(1).max(EMPLOYEE_DISPLAY_NAME_MAX_LENGTH),
  role: z.string().min(1).max(EMPLOYEE_ROLE_MAX_LENGTH).optional(),
  personality: z.string().max(500).optional(),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;

/**
 * MVP の既定 AI 社員（3 人）。client / server が共有する単一情報源（ADR-0005）。
 * id は既存のドメインロジック・テスト（selectAppearingMembers / message）と整合する haru / ken / mei。
 * 表示名・役割は MVP 暫定で、正典の社員定義（Phase 1 のプロンプト設計）が固まれば差し替える。
 */
export const DEFAULT_EMPLOYEES: readonly Employee[] = [
  { id: "haru", displayName: "haru", role: "ムードメーカー", isBot: true },
  { id: "ken", displayName: "ken", role: "ベテラン", isBot: true },
  { id: "mei", displayName: "mei", role: "新人", isBot: true },
];

/**
 * 論理削除状態を考慮して表示名をフォーマットする（#218）。
 * deletedAt が設定されている（Date または ISO 文字列）場合は `【削除済み】` プレフィックスを付与する。
 * 純粋関数として common に置き、client / server が共有する（ADR-0005）。
 */
export const formatEmployeeDisplayName = (employee: {
  displayName: string;
  deletedAt?: Date | string | null;
}): string => {
  if (employee.deletedAt != null) {
    return `【削除済み】${employee.displayName}`;
  }
  return employee.displayName;
};

/**
 * employee ID → displayName の解決関数を生成する（メッセージの発言者名表示などで共有）。
 * 内部で id→displayName の索引を 1 度だけ構築し、以降の解決を O(1) にする。
 * 未解決の ID は ID をそのままフォールバックとして返す（呼び出し側で表示の破綻を防ぐ）。
 * deletedAt が設定されている社員は `【削除済み】` プレフィックスを付与する（#218）。
 * 純粋関数（React/DOM 非依存）として common に置き、client / server が共有する（ADR-0005）。
 */
export const createDisplayNameResolver = (
  employees: readonly Employee[] = DEFAULT_EMPLOYEES,
): ((employeeId: string) => string) => {
  const displayNameById = new Map(
    employees.map((e) => [e.id, formatEmployeeDisplayName({ displayName: e.displayName, deletedAt: e.deletedAt ?? null })]),
  );
  return (employeeId: string): string => displayNameById.get(employeeId) ?? employeeId;
};

/**
 * employee ID → imageUrl の解決関数を生成する（メッセージのアバター画像表示で利用・#300）。
 * 内部で id→imageUrl の索引を 1 度だけ構築し、以降の解決を O(1) にする。
 * imageUrl が未設定の場合、または未解決の ID の場合は undefined を返す。
 * 純粋関数（React/DOM 非依存）として common に置き、client が共有する（ADR-0005）。
 */
export const createAvatarUrlResolver = (
  employees: readonly Employee[] = DEFAULT_EMPLOYEES,
): ((employeeId: string) => string | undefined) => {
  const imageUrlById = new Map(employees.map((e) => [e.id, e.imageUrl]));
  return (employeeId: string): string | undefined => imageUrlById.get(employeeId);
};

