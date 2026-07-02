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
      >
        {label.charAt(0).toUpperCase()}
      </Avatar>
    );
  }

  // boring-avatars already renders role="img" on its SVG; aria-label spreads to the SVG for accessible name.
  return (
    <Box sx={{ width: size, height: size, display: "inline-flex", flexShrink: 0 }}>
      <BoringAvatar size={size} name={id} variant="beam" aria-label={label} />
    </Box>
  );
};
