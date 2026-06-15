import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  AppSettingResponseSchema,
  BatchRunLogSchema,
  TokenUsageLogSchema,
  UpdateAppSettingSchema,
} from "@hatchery/common";
import { z } from "zod";

import type { RegistryContext } from "./shared.js";

/**
 * 管理画面 API（#52）・バッチ実行ログ（#75）・トークン使用量ログ（#153）の OpenAPI 登録（#535）。
 */
export function registerAdmin(registry: OpenAPIRegistry, ctx: RegistryContext): void {
  const { errorJson } = ctx;

  // 管理画面 API（#52）。認証必須。
  const AppSettingResponseComponent = registry.register(
    "AppSettingResponse",
    AppSettingResponseSchema.openapi({
      description: "アプリ設定エントリ（API キーはマスク表示）",
    }),
  );

  const UpdateAppSettingComponent = registry.register(
    "UpdateAppSetting",
    UpdateAppSettingSchema.openapi({ description: "設定更新リクエストボディ（key / value）" }),
  );

  registry.registerPath({
    method: "get",
    path: "/api/admin/settings",
    summary: "アプリ設定一覧を取得（認証必須・#52）",
    responses: {
      200: {
        description: "設定一覧（API キーはマスク表示）",
        content: { "application/json": { schema: z.array(AppSettingResponseComponent) } },
      },
      401: { description: "未認証", ...errorJson },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/admin/settings",
    summary: "アプリ設定を更新（認証必須・#52）",
    request: {
      body: { content: { "application/json": { schema: UpdateAppSettingComponent } } },
    },
    responses: {
      200: {
        description: "更新後の設定（API キーはマスク表示）",
        content: { "application/json": { schema: AppSettingResponseComponent } },
      },
      400: { description: "リクエストボディが不正（key 空など）", ...errorJson },
      401: { description: "未認証", ...errorJson },
    },
  });

  // バッチ実行ログ（#75）。認証必須。
  const BatchRunLogComponent = registry.register(
    "BatchRunLog",
    BatchRunLogSchema.openapi({ description: "バッチ実行ログ（成功・失敗）" }),
  );

  registry.registerPath({
    method: "get",
    path: "/api/admin/batch-logs",
    summary: "バッチ実行ログ一覧を取得（認証必須・直近 50 件・executedAt 降順）（#75）",
    responses: {
      200: {
        description: "バッチ実行ログ一覧",
        content: { "application/json": { schema: z.array(BatchRunLogComponent) } },
      },
      401: { description: "未認証", ...errorJson },
    },
  });

  // トークン使用量ログ（#153）。admin ロール必須。
  const TokenUsageLogComponent = registry.register(
    "TokenUsageLog",
    TokenUsageLogSchema.openapi({ description: "AI API トークン使用量ログ（1 呼び出し = 1 レコード）" }),
  );

  const TokenUsageSummaryComponent = registry.register(
    "TokenUsageSummary",
    z.object({
      totalInputTokens: z.number().int().nonnegative(),
      totalOutputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative(),
    }).openapi({ description: "トークン使用量の集計（全期間合計）" }),
  );

  const TokenUsageResponseComponent = registry.register(
    "TokenUsageResponse",
    z.object({
      logs: z.array(TokenUsageLogComponent),
      summary: TokenUsageSummaryComponent,
    }).openapi({ description: "トークン使用量レスポンス（直近 50 件 + 全期間集計）" }),
  );

  registry.registerPath({
    method: "get",
    path: "/api/admin/token-usage",
    summary: "AI トークン使用量を取得（認証必須・admin ロール・直近 50 件 + 集計）（#153）",
    responses: {
      200: {
        description: "トークン使用量一覧と集計",
        content: { "application/json": { schema: TokenUsageResponseComponent } },
      },
      401: { description: "未認証", ...errorJson },
      403: { description: "admin 権限なし", ...errorJson },
    },
  });
}
