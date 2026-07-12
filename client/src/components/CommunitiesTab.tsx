/**
 * 管理画面コミュニティタブ（#310 / #833 / #889）。
 * admin が community の作成・編集・一覧表示を行う。
 * #889: 作成・編集をダイアログからページ遷移に移行した。
 */
import { useNavigate, useSearch } from "@tanstack/react-router";
import { type ReactElement } from "react";

import {
  Box,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "./uiParts";

import type { AdminCommunity } from "@hatchery/common";
import { useCommunities } from "../api/communities.js";
import { useSavedFlagSnackbar } from "../hooks/useSavedFlagSnackbar.js";
import { QueryBoundary } from "./QueryBoundary.js";
import { SavedFlagSnackbar } from "./SavedFlagSnackbar.js";

/** コミュニティ一覧テーブル行（編集ページへ遷移するボタンを持つ）。 */
interface CommunityRowProps {
  community: AdminCommunity;
}

function CommunityRow({ community }: CommunityRowProps): ReactElement {
  const navigate = useNavigate();

  return (
    <TableRow>
      <TableCell sx={{ fontFamily: "monospace" }}>{community.slug}</TableCell>
      <TableCell>{community.name}</TableCell>
      <TableCell sx={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {community.description}
      </TableCell>
      <TableCell>
        <Button
          size="small"
          variant="outlined"
          onClick={() =>
            void navigate({
              to: "/admin/communities/$communityId/edit",
              params: { communityId: community.id },
            })
          }
        >
          編集
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** コミュニティ一覧テーブル本体（#310）。useCommunities は Suspense 化済み（#462）。 */
function CommunityListPanel(): ReactElement {
  const { data: communities } = useCommunities();

  if (communities.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        コミュニティがありません。
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>slug</TableCell>
          <TableCell>名前</TableCell>
          <TableCell>概要（公開）</TableCell>
          <TableCell>操作</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {communities.map((community) => (
          <CommunityRow key={community.id} community={community} />
        ))}
      </TableBody>
    </Table>
  );
}

/** コミュニティ一覧のローディングスケルトン（Suspense fallback）。 */
function CommunityListSkeleton(): ReactElement {
  return (
    <Box>
      {/* eslint-disable-next-line max-params */}
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height={32}
          data-testid="communities-skeleton-item"
          sx={{ my: 0.5 }}
        />
      ))}
    </Box>
  );
}

/**
 * 管理画面コミュニティタブ（#310 / #833 / #889）。
 * 「コミュニティを追加」ボタンで作成ページへ遷移し、一覧は Suspense 化（#462）して
 * 局所 QueryBoundary（fallback=スケルトン）で包む。
 */
export function CommunitiesTab(): ReactElement {
  const navigate = useNavigate();
  const { communitySaved } = useSearch({ from: "/admin" });
  // #1081: コミュニティ編集の保存成功後に付与される一時フラグ。検知したら
  // Snackbar を表示しつつ URL から即座に除去し、再訪問時の再表示を防ぐ（#1080 と同じ共通フック）。
  const { open: showSavedSnackbar, close: closeSavedSnackbar } = useSavedFlagSnackbar({
    flag: !!communitySaved,
    flagKey: "communitySaved",
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="small"
          onClick={() => void navigate({ to: "/admin/communities/new" })}
        >
          コミュニティを追加
        </Button>
      </Box>

      <Box>
        <Typography variant="subtitle1" gutterBottom>
          コミュニティ一覧
        </Typography>
        <QueryBoundary fallback={<CommunityListSkeleton />}>
          <CommunityListPanel />
        </QueryBoundary>
      </Box>
      <SavedFlagSnackbar
        open={showSavedSnackbar}
        onClose={closeSavedSnackbar}
        message="コミュニティを保存しました"
      />
    </Box>
  );
}
