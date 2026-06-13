import type { ReactElement, ReactNode } from "react";

import { Avatar, Box, Stack, Typography } from "./uiParts";
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
 * 上部にカバー画像を表示し、その左下に丸いアイコンを重ねて name を並べる。
 * - coverUrl 未設定: テーマ色のプレースホルダ矩形。
 * - iconUrl 未設定: name 頭文字の MUI Avatar フォールバック。
 * いずれの未設定パターンでもレイアウトが崩れない。
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

      {/* アイコン（カバーの左下に重ねる）＋ name ＋ アクション */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 2,
          px: { xs: 1, sm: 2 },
          mt: `-${ICON_SIZE / 2}px`,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="flex-end" sx={{ minWidth: 0 }}>
          <Avatar
            src={iconUrl ?? undefined}
            alt={name}
            sx={{
              width: ICON_SIZE,
              height: ICON_SIZE,
              border: "4px solid",
              borderColor: "background.default",
              bgcolor: "primary.main",
              fontSize: 32,
            }}
          >
            {name[0]}
          </Avatar>
          <Box sx={{ minWidth: 0, pb: 0.5 }}>
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
        </Stack>
        {actions && (
          <Box sx={{ flexShrink: 0, pb: 0.5 }}>
            {actions}
          </Box>
        )}
      </Box>
    </Box>
  );
};
