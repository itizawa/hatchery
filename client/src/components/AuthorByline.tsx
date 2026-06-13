import { Avatar, Box, Typography } from "./uiParts";
import type { ReactElement } from "react";

import type { components } from "../api/openapi.gen.js";

/** post / comment の発言者の表示用ワーカー情報（#479）。openapi.gen.ts の Post.author_worker と同型。 */
export type AuthorWorker = NonNullable<components["schemas"]["Post"]["author_worker"]>;

interface AuthorBylineProps {
  /** post / comment の生の author 値（id か displayName）。author_worker が無いときのフォールバック表示に使う。 */
  author: string;
  /** server が解決した発言者の表示用ワーカー情報（#479）。未解決のときは undefined。 */
  authorWorker?: AuthorWorker | null;
}

/**
 * post / comment の発言者を「アバター画像 + 表示名」で表示する byline（#479）。
 * - author_worker があれば、アバター（image_url・未設定時は表示名の頭文字フォールバック）+ display_name を表示する。
 * - author_worker が無い（server が解決できなかった）場合は、生の author 文字列をテキスト表示する（破綻しない）。
 */
export const AuthorByline = ({ author, authorWorker }: AuthorBylineProps): ReactElement => {
  if (!authorWorker) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {author}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Avatar
        src={authorWorker.image_url ?? undefined}
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
};
