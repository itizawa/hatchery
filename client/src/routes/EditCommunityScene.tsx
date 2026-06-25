import { useForm } from "@tanstack/react-form";
import { Link, useParams } from "@tanstack/react-router";
import type { ReactElement } from "react";

import type { AdminCommunity, UpdateCommunityInput } from "@hatchery/common";
import { useCommunities, useUpdateCommunity } from "../api/communities.js";
import { getApiErrorMessage } from "../api/errors.js";
import { CommunityFormFields } from "../components/CommunityFormFields.js";
import { CommunityImageUpload } from "../components/CommunityImageUpload.js";
import { Alert, Box, Button, Snackbar, Typography } from "../components/uiParts/index.js";

function EditCommunityForm({ community }: { community: AdminCommunity }): ReactElement {
  const updateMutation = useUpdateCommunity();
  const isPending = updateMutation.isPending;
  const handleErrorClose = (): void => { updateMutation.reset(); };

  const form = useForm({
    defaultValues: {
      name: community.name,
      description: community.description,
      generationInstruction: community.generationInstruction ?? "",
    } as UpdateCommunityInput,
    onSubmit: async ({ value }) => {
      try {
        await updateMutation.mutateAsync({ id: community.id, input: value });
      } catch {
        // エラー表示は mutation の状態に委ねる
      }
    },
  });

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          slug
        </Typography>
        <Typography variant="body1" sx={{ fontFamily: "monospace" }}>
          {community.slug}
        </Typography>
      </Box>
      <Box sx={{ mb: 2, display: "flex", gap: 2 }}>
        <CommunityImageUpload
          communityId={community.id}
          kind="cover"
          name="coverUrl"
          currentImageUrl={community.coverUrl ?? null}
        />
        <CommunityImageUpload
          communityId={community.id}
          kind="icon"
          name="iconUrl"
          currentImageUrl={community.iconUrl ?? null}
        />
      </Box>
      <Box
        component="form"
        onSubmit={async (e) => {
          e.preventDefault();
          await form.handleSubmit();
        }}
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <CommunityFormFields form={form} />
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button type="submit" variant="contained" disabled={isPending}>
            保存
          </Button>
        </Box>
      </Box>
      <Snackbar
        open={updateMutation.isError}
        autoHideDuration={6000}
        onClose={handleErrorClose}
      >
        <Alert severity="error" onClose={handleErrorClose}>
          {getApiErrorMessage(updateMutation.error, "コミュニティの更新に失敗しました")}
        </Alert>
      </Snackbar>
    </>
  );
}

/**
 * コミュニティ編集ページ（/admin/communities/:communityId/edit）。#889
 * useCommunities() で全一覧を取得し ID でフィルタ。
 * CommunityFormFields + CommunityImageUpload を同一ページに統合。
 */
export function EditCommunityScene(): ReactElement {
  const { communityId } = useParams({ from: "/admin/communities/$communityId/edit" });
  const { data: communities } = useCommunities();
  const community = communities.find((c) => c.id === communityId);

  if (!community) {
    return (
      <Box sx={{ p: 3, maxWidth: 560 }}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          コミュニティが見つかりません
        </Typography>
        <Link to="/admin" search={{ tab: "communities" }}>
          コミュニティ一覧へ戻る
        </Link>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 560 }}>
      <Box sx={{ mb: 3 }}>
        <Link to="/admin" search={{ tab: "communities" }}>
          ← 一覧に戻る
        </Link>
      </Box>
      <Typography variant="h5" component="h1" gutterBottom>
        コミュニティを編集
      </Typography>
      <EditCommunityForm community={community} />
    </Box>
  );
}
