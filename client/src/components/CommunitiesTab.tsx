/**
 * 管理画面コミュニティタブ（#310 / #833）。
 * admin が community の作成・編集・一覧表示を行う。
 * #833: 作成・編集をワーカー管理と同じモーダルダイアログ方式に統一した。
 * 作成は「コミュニティを追加」ボタン → AddCommunityDialog、編集は一覧行の「編集」ボタン →
 * EditCommunityDialog で行う（旧インライン CreateCommunityForm / EditCommunityForm は廃止）。
 */
import {
  Alert,
  Box,
  Button,
  Skeleton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "./uiParts";

import { type ReactElement, useState } from "react";

import type { AdminCommunity } from "@hatchery/common";
import { useCommunities } from "../api/communities.js";
import { AddCommunityDialog } from "./AddCommunityDialog.js";
import { EditCommunityDialog } from "./EditCommunityDialog.js";
import { QueryBoundary } from "./QueryBoundary.js";

/** コミュニティ一覧テーブル行（編集ダイアログの開閉を持つ）。 */
interface CommunityRowProps {
  community: AdminCommunity;
}

function CommunityRow({ community }: CommunityRowProps): ReactElement {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <TableRow>
      <TableCell sx={{ fontFamily: "monospace" }}>{community.slug}</TableCell>
      <TableCell>{community.name}</TableCell>
      <TableCell sx={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {community.description}
      </TableCell>
      <TableCell>
        <Button size="small" variant="outlined" onClick={() => setDialogOpen(true)}>
          編集
        </Button>
        <EditCommunityDialog
          community={community}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
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
 * 管理画面コミュニティタブ（#310 / #833）。
 * 「コミュニティを追加」ボタンで作成ダイアログを開き、一覧は Suspense 化（#462）して
 * 局所 QueryBoundary（fallback=スケルトン）で包む。作成成功時に成功スナックバーを表示する。
 */
export function CommunitiesTab(): ReactElement {
  const [addOpen, setAddOpen] = useState(false);
  const [createdSnackbarOpen, setCreatedSnackbarOpen] = useState(false);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="contained" size="small" onClick={() => setAddOpen(true)}>
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

      <AddCommunityDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => setCreatedSnackbarOpen(true)}
      />
      <Snackbar
        open={createdSnackbarOpen}
        autoHideDuration={3000}
        onClose={() => setCreatedSnackbarOpen(false)}
      >
        <Alert severity="success" onClose={() => setCreatedSnackbarOpen(false)}>
          コミュニティを作成しました
        </Alert>
      </Snackbar>
    </Box>
  );
}
