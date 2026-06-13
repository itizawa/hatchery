import { Avatar, Box, Typography } from "./uiParts/index.js";
import type { ReactElement } from "react";

import type { RecentWorker } from "../api/communities.js";

interface RecentWorkersSectionProps {
  workers: RecentWorker[];
}

/**
 * community に最近投稿したワーカー一覧を表示するセクション（#207）。
 * サイドバーに埋め込むことを想定した純表示（presentational）コンポーネント。
 * #462: ローディング/エラーは呼び出し側の QueryBoundary に委譲するため、isLoading/isError props は持たない。
 */
export const RecentWorkersSection = ({ workers }: RecentWorkersSectionProps): ReactElement => {
  if (workers.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        まだ投稿がありません
      </Typography>
    );
  }

  return (
    <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, display: "flex", flexDirection: "column", gap: 1 }}>
      {workers.map((worker) => (
        <Box component="li" key={worker.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Avatar
            src={worker.imageUrl ?? undefined}
            alt={worker.displayName}
            sx={{ width: 28, height: 28, fontSize: "0.75rem" }}
          >
            {worker.displayName.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight="medium" lineHeight={1.2}>
              {worker.displayName}
            </Typography>
            {worker.role && (
              <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
                {worker.role}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
};
