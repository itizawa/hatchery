import { Avatar, Box, Typography } from "./uiParts";
import type { ReactElement } from "react";
import type React from "react";
import { Link as RouterLink } from "@tanstack/react-router";

import type { components } from "../api/openapi.gen.js";
import { resolveWorkerImageUrl } from "@hatchery/common";

/** post / comment の発言者の表示用ワーカー情報（#479）。openapi.gen.ts の Post.author_worker と同型。 */
export type AuthorWorker = NonNullable<components["schemas"]["Post"]["author_worker"]>;

interface AuthorBylineProps {
  /** post / comment の生の author 値（id か displayName）。author_worker が無いときのフォールバック表示に使う。 */
  author: string;
  /** server が解決した発言者の表示用ワーカー情報（#479）。未解決のときは undefined。 */
  authorWorker?: AuthorWorker | null;
  /**
   * ワーカー名・アバタークリック時のコールバック（#929）。
   * 指定時はクリック可能になり、RouterLink でプロフィールページへ遷移する。
   * 未指定時はクリック不可のテキスト表示（後方互換）。
   */
  onWorkerClick?: (e: React.MouseEvent) => void;
}

/**
 * post / comment の発言者を「アバター画像 + 表示名」で表示する byline（#479）。
 * - author_worker があれば、アバター（image_url・未設定時は表示名の頭文字フォールバック）+ display_name を表示する。
 * - onWorkerClick 指定時はクリック可能な RouterLink でプロフィールページへ遷移する（#929）。
 * - author_worker が無い（server が解決できなかった）場合は、生の author 文字列をテキスト表示する（破綻しない）。
 */
export const AuthorByline = ({
  author,
  authorWorker,
  onWorkerClick,
}: AuthorBylineProps): ReactElement => {
  if (!authorWorker) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {author}
      </Typography>
    );
  }

  const inner = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Avatar
        src={resolveWorkerImageUrl({ id: authorWorker.id, imageUrl: authorWorker.image_url })}
        alt={authorWorker.display_name}
        sx={{ width: 24, height: 24, fontSize: "0.7rem" }}
      >
        {authorWorker.display_name.charAt(0).toUpperCase()}
      </Avatar>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {authorWorker.display_name}
      </Typography>
    </Box>
  );

  if (onWorkerClick) {
    return (
      <RouterLink
        to="/workers/$workerId"
        params={{ workerId: authorWorker.id }}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onWorkerClick(e);
        }}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {inner}
      </RouterLink>
    );
  }

  return inner;
};
