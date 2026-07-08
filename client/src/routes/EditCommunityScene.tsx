import { useForm } from "@tanstack/react-form";
import { Link, useParams } from "@tanstack/react-router";
import { type ReactElement, useEffect, useRef } from "react";

import type { AdminCommunity, UpdateCommunityInput } from "@hatchery/common";
import { useCommunities, useUpdateCommunity } from "../api/communities.js";
import { useCommunityWorkerAssignments, useSetCommunityWorkerAssignments } from "../api/communityWorkers.js";
import { getApiErrorMessage } from "../api/errors.js";
import { CommunityFormFields } from "../components/CommunityFormFields.js";
import { CommunityImageUpload } from "../components/CommunityImageUpload.js";
import { CommunityWorkersField } from "../components/CommunityWorkersField.js";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Snackbar,
  Switch,
  Typography,
} from "../components/uiParts/index.js";

function EditCommunityForm({ community }: { community: AdminCommunity }): ReactElement {
  const updateMutation = useUpdateCommunity();
  const isPending = updateMutation.isPending;

  const form = useForm({
    defaultValues: {
      name: community.name,
      description: community.description,
      generationInstruction: community.generationInstruction ?? "",
      feedUrl: community.feedUrl ?? null,
      generationPaused: community.generationPaused ?? false,
    } as UpdateCommunityInput,
    onSubmit: async ({ value }) => {
      try {
        await updateMutation.mutateAsync({ id: community.id, input: value });
      } catch {
        // エラー表示は updateMutation の状態に委ねる
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
          name={community.name}
          currentImageUrl={community.coverUrl ?? null}
        />
        <CommunityImageUpload
          communityId={community.id}
          kind="icon"
          name={community.name}
          currentImageUrl={community.iconUrl ?? null}
        />
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
        <form.Field name="generationPaused">
          {(field) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.state.value ?? false}
                  onChange={(e) => field.handleChange(e.target.checked)}
                />
              }
              label="生成停止"
            />
          )}
        </form.Field>
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button type="submit" variant="contained" disabled={isPending}>
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

type CommunityWorkersFormValues = { workerIds: string[] };

/**
 * コミュニティの所属ワーカー編集セクション（#1079）。
 * `EditCommunityForm`（コミュニティ本体の編集）とは独立した保存単位（受け入れ条件 7）。
 * 現在の所属ワーカーを初期値として反映し、独自の保存ボタンで PUT する。
 */
function CommunityWorkersEditSection({ communityId }: { communityId: string }): ReactElement {
  const workersQuery = useCommunityWorkerAssignments(communityId);
  const setWorkersMutation = useSetCommunityWorkerAssignments();

  const form = useForm({
    defaultValues: { workerIds: [] } as CommunityWorkersFormValues,
    onSubmit: async ({ value }: { value: CommunityWorkersFormValues }) => {
      try {
        await setWorkersMutation.mutateAsync({ communityId, workerIds: value.workerIds });
      } catch {
        // エラー表示は setWorkersMutation の状態に委ねる
      }
    },
  });

  // useCommunityWorkerAssignments は通常の useQuery（Suspense 外）のため初回は undefined。
  // 所属ワーカーが解決したら一度だけフォームフィールドを同期する。以降のバックグラウンド再取得
  // （ウィンドウフォーカス復帰・保存成功後の invalidateQueries 等）で編集中の選択を上書きしない。
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    if (workersQuery.data !== undefined && !hasHydratedRef.current) {
      hasHydratedRef.current = true;
      void form.setFieldValue(
        "workerIds",
        workersQuery.data.map((w) => w.id),
      );
    }
  }, [workersQuery.data]);

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="subtitle1" gutterBottom>
        所属ワーカー
      </Typography>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        {workersQuery.isLoading ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            所属ワーカーを読み込み中…
          </Box>
        ) : workersQuery.isSuccess ? (
          <form.Field name="workerIds">
            {(field) => (
              <CommunityWorkersField
                labelId="edit-community-workers-label"
                value={field.state.value}
                onChange={(ids) => field.handleChange(ids)}
              />
            )}
          </form.Field>
        ) : (
          <Alert severity="warning">所属ワーカーの読み込みに失敗しました。</Alert>
        )}
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            type="submit"
            variant="contained"
            disabled={!workersQuery.isSuccess || setWorkersMutation.isPending}
          >
            所属ワーカーを保存
          </Button>
        </Box>
      </Box>
      <Snackbar
        open={setWorkersMutation.isError}
        autoHideDuration={6000}
        onClose={() => setWorkersMutation.reset()}
      >
        <Alert severity="error" onClose={() => setWorkersMutation.reset()}>
          {getApiErrorMessage(setWorkersMutation.error, "所属ワーカーの更新に失敗しました")}
        </Alert>
      </Snackbar>
    </Box>
  );
}

/**
 * コミュニティ編集ページ（/admin/communities/$communityId/edit）。#889
 * useCommunities() で一覧を取得し ID でフィルタ。
 * CommunityFormFields + CommunityImageUpload + 所属ワーカー編集（#1079）を同一ページに統合。
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
      <CommunityWorkersEditSection communityId={community.id} />
    </Box>
  );
}
