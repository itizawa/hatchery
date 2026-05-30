import { z } from "zod";

import { MessageSchema } from "./message.js";

/**
 * 1 定時で生成される 1 シーン（複数社員の掛け合い）。
 * concept.md「出力フォーマット」の JSON と構造・フィールド名を一致させ、
 * 生成 JSON をそのまま parse できるようにする。messages は 1 件以上。
 */
export const SceneSchema = z.object({
  scene: z.string().min(1),
  messages: z.array(MessageSchema).min(1),
});

export type Scene = z.infer<typeof SceneSchema>;
