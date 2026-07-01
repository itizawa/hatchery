import BoringAvatar from "boring-avatars";
import type { ReactElement } from "react";

import { Avatar, Box } from "./uiParts/index.js";

interface WorkerAvatarProps {
  id: string;
  imageUrl?: string | null;
  size?: number;
  alt?: string;
  displayName?: string;
}

/**
 * ワーカーのアバターを表示するコンポーネント（#1015）。
 * - imageUrl が非 null → MUI Avatar（img タグ・src 付き）
 * - imageUrl が null/undefined → boring-avatars npm パッケージで SVG をクライアントレンダリング
 *   source.boringavatars.com は外部サービスのため廃止。
 */
export const WorkerAvatar = ({
  id,
  imageUrl,
  size = 40,
  alt,
  displayName,
}: WorkerAvatarProps): ReactElement => {
  const label = alt ?? displayName ?? id;

  if (imageUrl) {
    return (
      <Avatar
        src={imageUrl}
        alt={label}
        sx={{ width: size, height: size }}
      />
    );
  }

  return (
    <Box
      role="img"
      aria-label={label}
      sx={{ width: size, height: size, display: "inline-flex", flexShrink: 0 }}
    >
      <BoringAvatar size={size} name={id} variant="beam" />
    </Box>
  );
};
