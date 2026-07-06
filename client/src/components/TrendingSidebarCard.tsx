import { Box, Divider, Typography } from "./uiParts";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement } from "react";

import type { TrendingItem } from "@hatchery/common";
import { sidebarCardOuterBoxSx, sidebarListItemSx, sidebarListItemTitleSx } from "./sidebarCardSx.js";

interface TrendingSidebarCardProps {
  items: TrendingItem[];
}

/**
 * ランキング画面右サイドバー用の直近7日高評価 Post/Comment 一覧カード（#1065）。
 * post アイテムは post 詳細へ、comment アイテムは post 詳細の該当コメント位置
 * （`#comment-<id>`・PostThreadScene.tsx のスクロール処理と対応）へ遷移する。
 * 投票ボタンは表示しない（読み取り専用）。
 */
export const TrendingSidebarCard = ({ items }: TrendingSidebarCardProps): ReactElement => {
  return (
    <Box sx={sidebarCardOuterBoxSx}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: "bold" }}>
        直近7日の高評価
      </Typography>
      <Divider sx={{ mb: 1.5 }} />
      {items.length === 0 ? (
        <Typography data-testid="trending-sidebar-empty" variant="body2" color="text.secondary">
          まだ評価の高い投稿がありません。
        </Typography>
      ) : (
        <Box
          component="ul"
          sx={{ listStyle: "none", p: 0, m: 0, display: "flex", flexDirection: "column", gap: 1.5 }}
        >
          {items.map((item) => (
            <Box component="li" key={`${item.type}-${item.id}`} sx={sidebarListItemSx}>
              <RouterLink
                to="/posts/$postId"
                params={{ postId: item.post_id }}
                hash={item.type === "comment" ? `comment-${item.id}` : undefined}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <Typography variant="body2" sx={sidebarListItemTitleSx}>
                  {item.excerpt}
                </Typography>
              </RouterLink>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {item.type === "comment" ? "コメント" : "投稿"}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  ·
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: item.net_score >= 0 ? "success.main" : "error.main" }}
                >
                  {item.net_score >= 0 ? `+${item.net_score}` : `${item.net_score}`}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
