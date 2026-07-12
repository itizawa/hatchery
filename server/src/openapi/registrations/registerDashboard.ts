import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { DashboardSummarySchema } from "@hatchery/common";

/**
 * サイト全体の定量サマリダッシュボード（認証不要・#1113）の OpenAPI 登録。
 * コミュニティ別内訳配列（DashboardCommunityBreakdownSchema）は個別 component として
 * 登録せず、`DashboardSummarySchema` に inline させる（`registerAdmin.ts` の
 * `CommunityEngagementComponent` と同じ作法）。クエリパラメータ・エラーレスポンスを持たないため
 * `registerHealth` と同様に `ctx` を受け取らない。
 */
export function registerDashboard(registry: OpenAPIRegistry): void {
  const DashboardSummaryComponent = registry.register(
    "DashboardSummary",
    DashboardSummarySchema.openapi({
      description:
        "サイト全体の定量サマリ（コミュニティ数・ワーカー数・投稿数・コメント数・累計閲覧数・累計 vote 数・購読数）とコミュニティ別内訳（view_count 降順）。#1113",
    }),
  );

  registry.registerPath({
    method: "get",
    path: "/api/dashboard",
    summary: "サイト全体の定量サマリダッシュボードを取得（認証不要）（#1113）",
    responses: {
      200: {
        description: "サイト全体サマリ + コミュニティ別内訳（view_count 降順）",
        content: { "application/json": { schema: DashboardSummaryComponent } },
      },
    },
  });
}
