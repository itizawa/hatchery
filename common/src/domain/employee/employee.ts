import { z } from "zod";

export const EMPLOYEE_DISPLAY_NAME_MAX_LENGTH = 50;
export const EMPLOYEE_ROLE_MAX_LENGTH = 50;

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
 * employee ID → displayName の解決関数を生成する（メッセージの発言者名表示などで共有）。
 * 内部で id→displayName の索引を 1 度だけ構築し、以降の解決を O(1) にする。
 * 未解決の ID は ID をそのままフォールバックとして返す（呼び出し側で表示の破綻を防ぐ）。
 * 純粋関数（React/DOM 非依存）として common に置き、client / server が共有する（ADR-0005）。
 */
export const createDisplayNameResolver = (
  employees: readonly Employee[] = DEFAULT_EMPLOYEES,
): ((employeeId: string) => string) => {
  const displayNameById = new Map(employees.map((e) => [e.id, e.displayName]));
  return (employeeId: string): string => displayNameById.get(employeeId) ?? employeeId;
};
