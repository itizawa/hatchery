import type { ReactElement } from "react";

import { useOgp } from "../api/ogp.js";
import { Box, Typography } from "./uiParts";

interface OgpCardProps {
  /** OGP を取得・表示する URL。null の場合は何も表示しない。 */
  url: string;
}

/**
 * 指定 URL の OGP メタデータを取得してカード形式で表示するコンポーネント（#515）。
 * - 取得中はカードを表示しない（スケルトン不要）
 * - 取得失敗・OGP 情報なし・title が無い場合はカードを表示しない（リンク表示にフォールバック）
 * - クリックすると元 URL へ新しいタブで遷移する
 */
export const OgpCard = ({ url }: OgpCardProps): ReactElement | null => {
  const { data: ogp } = useOgp(url);

  // データ未取得・title なしはカードを表示しない
  if (!ogp || !ogp.title) {
    return null;
  }

  return (
    <Box
      component="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: "block",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        mt: 1,
        "&:hover": {
          borderColor: "text.secondary",
          bgcolor: "action.hover",
        },
        transition: "border-color 0.15s, background-color 0.15s",
      }}
    >
      <Box sx={{ display: "flex", minHeight: 80 }}>
        {ogp.image && (
          <Box
            component="img"
            src={ogp.image}
            alt={ogp.title ?? "OGP image"}
            sx={{
              width: 120,
              objectFit: "cover",
              flexShrink: 0,
            }}
            onError={(e) => {
              // 画像読み込み失敗時は非表示にする
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <Box sx={{ p: 1, flex: 1, minWidth: 0 }}>
          {ogp.site_name && (
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: "block",
                mb: 0.25,
              }}
            >
              {ogp.site_name}
            </Typography>
          )}
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {ogp.title}
          </Typography>
          {ogp.description && (
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: "-webkit-box",
                mt: 0.25,
                overflow: "hidden",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {ogp.description}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};
