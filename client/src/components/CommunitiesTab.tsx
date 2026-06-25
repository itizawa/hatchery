/**
 * 管理画面コミュニティタブ（#310 / #833 / #889）。
 * admin が community の一覧表示を行う。
 * #889: 作成・編集を専用ページ（/admin/communities/new・/admin/communities/:id/edit）へ移行。
 * 「コミュニティを追加」ボタン→ /admin/communities/new ナビゲーション、
 * 「編集」ボタン→ /admin/communities/:id/edit ナビゲーション。
 */
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

import { type ReactElement } from "react";
import { Link } from "@tanstack/react-router";

import type { AdminCommunity } from "@hatchery/common";
import { useCommunities } from "../api/communities.js";
import { QueryBoundary } from "./QueryBoundary.js";

interface CommunityRowProps {
  community: AdminCommunity;
}

function CommunityRow({ community }: CommunityRowProps): ReactElement {
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
          component={Link}
          to="/admin/communities/$id/edit"
          params={{ id: community.id }}
        >
          編集
        </Button>
      </TableCell>
    </TableRow>
  );
}

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
 * 「コミュニティを追加」ボタンは /admin/communities/new へのリンク。
 */
export function CommunitiesTab(): ReactElement {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="small"
          component={Link}
          to="/admin/communities/new"
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
    </Box>
  );
}
