import { extendZodWithOpenApi, type OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// このモジュールの top-level で `.openapi(...)` を呼ぶ param 定義が評価される前に、
// zod の `.openapi` 拡張を有効化しておく（import 順序に依存しないよう冪等に呼ぶ・#535）。
extendZodWithOpenApi(z);

/**
 * リソース別登録モジュール間で共有する component / param / レスポンス断片（#535）。
 *
 * `registry.register` は呼び出し順で `components.schemas` の出力順が決まるため、
 * 共有スキーマ component は **登録順序を分割前と一致させる** ために集約点（registry.ts）から
 * 順序どおりに生成し、この `RegistryContext` に詰めて各モジュールへ渡す。
 *
 * 各 `registerXxx(registry, ctx)` は「渡された registry に register / registerPath を呼ぶ副作用関数」。
 */
export interface RegistryContext {
  /** エラー応答 component（`{ error: string }`）への JSON レスポンス断片。 */
  errorJson: { content: { "application/json": { schema: ReturnType<OpenAPIRegistry["register"]> } } };
  /** 認証済みユーザー component。auth で参照する。 */
  AuthUserComponent: ReturnType<OpenAPIRegistry["register"]>;
  /** Worker component。workers / communities（recent-workers）で参照する。 */
  WorkerComponent: ReturnType<OpenAPIRegistry["register"]>;
  /**
   * Post component。communities セクションで register され、その後 feed / posts で参照する。
   * 登録順序を分割前と一致させるため registerCommunities が生成して代入する。
   */
  PostComponent?: ReturnType<OpenAPIRegistry["register"]>;
  /**
   * Comment component。communities セクションで register され、その後 posts で参照する。
   * 登録順序を分割前と一致させるため registerCommunities が生成して代入する。
   */
  CommentComponent?: ReturnType<OpenAPIRegistry["register"]>;
}

/** `/api/workers/{id}` 等の path パラメータ `id`。 */
export const workerPathIdParam = z.string().openapi({ param: { name: "id", in: "path" } });
/** community の slug path パラメータ。 */
export const communitySlugParam = z.string().openapi({ param: { name: "slug", in: "path" } });
/** community の id path パラメータ。 */
export const communityIdParam = z.string().openapi({ param: { name: "id", in: "path" } });
/** post の postId path パラメータ。 */
export const postIdParam = z.string().openapi({ param: { name: "postId", in: "path" } });
/** comment の commentId path パラメータ。 */
export const commentIdParam = z.string().openapi({ param: { name: "commentId", in: "path" } });
