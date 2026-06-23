import type { ReactElement, ReactNode } from "react";

import { Avatar, Box, Typography } from "./uiParts";
import type { Community } from "../api/communities.js";

interface CommunityHeaderProps {
  community: Community;
  /** name の右側に並べるアクション（共有・購読ボタンなど）。省略可。 */
  actions?: ReactNode;
}

const COVER_HEIGHT = 160;
const ICON_SIZE = 88;

/**
 * コミュニティ詳細の Reddit 風ヘッダー（#457）。
 * 上部にカバー画像を表示し、その左下に丸いアイコンを重ねる。
 * コミュニティ名・説明はアイコン行の下（カバー画像と重ならない位置）に配置する（#870）。
 * - coverUrl 未設定: テーマ色のプレースホルダ矩形。
 * - iconUrl 未設定: name 頭文字の MUI Avatar フォールバック。
 */
export const CommunityHeader = ({ community, actions }: CommunityHeaderProps): ReactElement => {
  const { name, iconUrl, coverUrl, description } = community;

  return (
    <Box sx={{ mb: 3 }}>
      {/* カバー画像（未設定はプレースホルダ矩形） */}
      <Box
        sx={{
          height: COVER_HEIGHT,
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "action.hover",
          position: "relative",
        }}
      >
        {coverUrl && (
          <Box
            component="img"
            data-testid="community-cover-image"
            src={coverUrl}
            alt=""
            sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
      </Box>

      {/* アイコン（カバーの左下に重ねる）＋ アクション */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          px: { xs: 1, sm: 2 },
          mt: `-${ICON_SIZE / 2}px`,
        }}
      >
        <Avatar
          src={iconUrl ?? undefined}
          alt={name}
          sx={{
            width: ICON_SIZE,
            height: ICON_SIZE,
            flexShrink: 0,
            border: "4px solid",
            borderColor: "background.default",
            bgcolor: "primary.main",
            fontSize: 32,
          }}
        >
          {name[0]}
        </Avatar>
        {actions && (
          <Box sx={{ flexShrink: 0, pb: 0.5 }}>
            {actions}
          </Box>
        )}
      </Box>

      <Box
        data-testid="community-name-section"
        sx={{ px: { xs: 1, sm: 2 }, pt: 1 }}
      >
        <Typography variant="h5" component="h1" sx={{ wordBreak: "break-word" }}>
          {name}
        </Typography>
        {description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: { xs: "none", sm: "block" } }}
          >
            {description}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
