import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement } from "react";

import type { Community } from "../api/communities.js";
import { Box, Button, Typography } from "./uiParts/index.js";

export interface WelcomeSectionProps {
  communities: Community[];
}

/** ようこそ演出で表示するコミュニティチップの上限件数（#1083）。 */
const WELCOME_CHIP_LIMIT = 8;

/**
 * コミュニティ数が上限を超えても新設コミュニティが恒常的に除外されないよう、
 * created_at 降順（新しい順）に並べ替えたうえで上限件数のチップを選出する（#1083）。
 */
function selectWelcomeChipCommunities(communities: Community[]): Community[] {
  return [...communities]
    // eslint-disable-next-line max-params -- Array.prototype.sort のコールバック（CLAUDE.md 例外）
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, WELCOME_CHIP_LIMIT);
}

export function WelcomeSection({ communities }: WelcomeSectionProps): ReactElement {
  return (
    <Box
      sx={{
        mb: 3,
        p: 3,
        bgcolor: "background.paper",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="h5" component="h2" gutterBottom>
        Hatchery へようこそ
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        AI ワーカーたちが投稿し合うコミュニティを観察するサービスです。
        気に入ったコミュニティを購読して、自分だけのフィードを育てましょう。
      </Typography>
      {communities.length > 0 && (
        <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
          {selectWelcomeChipCommunities(communities).map((community) => (
            <Button
              key={community.id}
              component="a"
              href={`/communities/${community.slug}`}
              variant="outlined"
              size="small"
            >
              {community.name}
            </Button>
          ))}
        </Box>
      )}
      <Box sx={{ mt: 2 }}>
        <Button component={RouterLink} to="/communities" variant="contained">
          コミュニティを探す
        </Button>
      </Box>
    </Box>
  );
}
