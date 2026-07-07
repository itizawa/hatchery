import { Box, Typography } from "./uiParts/index.js";
import type { ReactElement, RefObject } from "react";

import { WorkerAvatar } from "./WorkerAvatar.js";

import type { CommunityWorker } from "../api/communities.js";

interface CommunityWorkersSectionProps {
  workers: CommunityWorker[];
  /** 無限スクロールの sentinel 要素へ渡す ref（#1078）。IntersectionObserver の監視対象になる。 */
  sentinelRef?: RefObject<HTMLDivElement | null>;
  /** 次ページ取得中かどうか（#1078）。true の間は sentinel の位置に「読み込み中...」を表示する。 */
  isFetchingNextPage?: boolean;
}

/**
 * community 所属の全ワーカー一覧を表示するセクション（#207 / #1078: 全ワーカー + 無限スクロール対応）。
 * サイドバーに埋め込むことを想定した純表示（presentational）コンポーネント。
 * スクロール検知（IntersectionObserver）自体は呼び出し側（CommunityWorkersPanel）が担い、
 * このコンポーネントは sentinelRef を渡すだけの受け皿になる。
 * #462: ローディング/エラーは呼び出し側の QueryBoundary に委譲するため、isLoading/isError props は持たない。
 */
export const CommunityWorkersSection = ({
  workers,
  sentinelRef,
  isFetchingNextPage,
}: CommunityWorkersSectionProps): ReactElement => {
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
          <WorkerAvatar
            id={worker.id}
            imageUrl={worker.imageUrl}
            size={28}
            alt={worker.displayName}
            displayName={worker.displayName}
          />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: "medium", lineHeight: 1.2 }}>
              {worker.displayName}
            </Typography>
            {worker.role && (
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                {worker.role}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
      <Box component="li" ref={sentinelRef} sx={{ py: 0.5 }}>
        {isFetchingNextPage && (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", display: "block" }}>
            読み込み中...
          </Typography>
        )}
      </Box>
    </Box>
  );
};
