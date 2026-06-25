import { useForm } from "@tanstack/react-form";
import { Link, useParams } from "@tanstack/react-router";
import { type ReactElement, useEffect } from "react";

import type { UpdateCommunityInput } from "@hatchery/common";

import { useAdminCommunityById, useUpdateCommunity } from "../api/communities.js";
import { getApiErrorMessage } from "../api/errors.js";
import { CommunityFormFields } from "../components/CommunityFormFields.js";
import { CommunityImageUpload } from "../components/CommunityImageUpload.js";
import { QueryBoundary } from "../components/QueryBoundary.js";
import {
  Alert,
  Box,
  Button,
  Snackbar,
  Typography,
} from "../components/uiParts/index.js";

function EditCommunityForm({ communityId }: { communityId: string }): ReactElement {
  const { data: community } = useAdminCommunityById({ id: communityId });
  const updateMutation = useUpdateCommunity();

  const form = useForm({
    defaultValues: {
      name: community.name,
      description: community.description,
      generationInstruction: community.generationInstruction ?? "",
    } as UpdateCommunityInput,
    onSubmit: async ({ value }) => {
      try {
        await updateMutation.mutateAsync({ id: communityId, input: value });
      } catch {
        // エラー表示は updateMutation の状態に委ねる
      }
    },
  });

  // community.id 変化時のみフォームを再同期（同一 id での再フェッチはユーザー編集中の値を保持）。
  useEffect(() => {
    void form.setFieldValue("name", community.name);
    void form.setFieldValue("description", community.description);
    void form.setFieldValue("generationInstruction", community.generationInstruction ?? "");
  }, [community.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          カバー画像（ヘッダー）
        </Typography>
        <CommunityImageUpload
          communityId={communityId}
          kind="cover"
          name={community.name}
          currentImageUrl={community.coverUrl ?? null}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
          <CommunityImageUpload
            communityId={communityId}
            kind="icon"
            name={community.name}
            currentImageUrl={community.iconUrl ?? null}
          />
          <Typography variant="caption" color="text.secondary">
            アイコン画像（クリックして変更）
          </Typography>
        </Box>
      </Box>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <CommunityFormFields form={form} />
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button type="submit" variant="contained" disabled={updateMutation.isPending}>
            保存
          </Button>
        </Box>
      </Box>
      <Snackbar
        open={updateMutation.isError}
        autoHideDuration={6000}
        onClose={() => updateMutation.reset()}
      >
        <Alert severity="error" onClose={() => updateMutation.reset()}>
          {getApiErrorMessage(updateMutation.error, "コミュニティの更新に失敗しました")}
        </Alert>
      </Snackbar>
    </>
  );
}

/**
 * コミュニティ編集ページ（/admin/communities/:id/edit）。#889
 * EditCommunityDialog を専用ページに移行。CommunityImageUpload を同一ページに統合。
 */
export function EditCommunityScene(): ReactElement {
  const { id } = useParams({ from: "/admin/communities/$id/edit" });

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
      <QueryBoundary
        errorFallback={() => (
          <Box>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              コミュニティが見つかりません
            </Typography>
            <Link to="/admin" search={{ tab: "communities" }}>
              コミュニティ一覧へ戻る
            </Link>
          </Box>
        )}
      >
        <EditCommunityForm communityId={id} />
      </QueryBoundary>
    </Box>
  );
}
