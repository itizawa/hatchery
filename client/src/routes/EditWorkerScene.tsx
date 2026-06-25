import type { WorkerVerbosity } from "@hatchery/common";
import {
  WORKER_DISPLAY_NAME_MAX_LENGTH,
  WORKER_PERSONALITY_MAX_LENGTH,
  WORKER_ROLE_MAX_LENGTH,
} from "@hatchery/common";
import { useForm } from "@tanstack/react-form";
import { Link, useParams } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { useUpdateWorker, useWorkerDetail } from "../api/workers.js";
import { getApiErrorMessage } from "../api/errors.js";
import { useSetWorkerCommunities, useWorkerCommunities } from "../api/workerCommunities.js";
import { WorkerCommunitiesField } from "../components/WorkerCommunitiesField.js";
import { WorkerImageUpload } from "../components/WorkerImageUpload.js";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from "../components/uiParts/index.js";
import { QueryBoundary } from "../components/QueryBoundary.js";

const VERBOSITY_OPTIONS: { value: WorkerVerbosity; label: string }[] = [
  { value: "concise", label: "簡潔" },
  { value: "standard", label: "標準" },
  { value: "detailed", label: "詳細" },
];

type FormValues = {
  displayName: string;
  role: string;
  personality: string;
  verbosity: WorkerVerbosity;
  communityIds: string[];
};

function EditWorkerForm({ workerId }: { workerId: string }): ReactElement {
  const { data: worker } = useWorkerDetail({ workerId });
  const updateMutation = useUpdateWorker();
  const setCommunitiesMutation = useSetWorkerCommunities();
  const workerCommunitiesQuery = useWorkerCommunities(workerId);

  const initialCommunityIds = workerCommunitiesQuery.data ?? [];
  const isInitializing = workerCommunitiesQuery.isLoading;
  const canEditCommunities = workerCommunitiesQuery.isSuccess;
  const isPending = updateMutation.isPending || setCommunitiesMutation.isPending;

  const saveError = updateMutation.error ?? setCommunitiesMutation.error;
  const isSaveError = updateMutation.isError || setCommunitiesMutation.isError;
  const handleErrorClose = (): void => {
    updateMutation.reset();
    setCommunitiesMutation.reset();
  };

  const form = useForm({
    defaultValues: {
      displayName: worker.displayName,
      role: worker.role ?? "",
      personality: worker.personality ?? "",
      verbosity: (worker.verbosity as WorkerVerbosity | undefined) ?? "standard",
      communityIds: initialCommunityIds,
    },
    onSubmit: async ({ value }: { value: FormValues }) => {
      try {
        await updateMutation.mutateAsync({
          id: workerId,
          body: {
            displayName: value.displayName || undefined,
            role: value.role || undefined,
            personality: value.personality || undefined,
            verbosity: value.verbosity,
          },
        });
        if (canEditCommunities) {
          await setCommunitiesMutation.mutateAsync({
            workerId,
            communityIds: value.communityIds,
          });
        }
      } catch {
        // エラー表示は mutation の状態に委ねる
      }
    },
  });

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <WorkerImageUpload
          workerId={workerId}
          displayName={worker.displayName}
          currentImageUrl={worker.imageUrl ?? null}
        />
        <Typography variant="body2" color="text.secondary">
          画像をクリックしてアップロード
        </Typography>
      </Box>
      <Box
        component="form"
        onSubmit={async (e) => {
          e.preventDefault();
          await form.handleSubmit();
        }}
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        <form.Field name="displayName">
          {(field) => (
            <TextField
              label="表示名"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              slotProps={{ htmlInput: { "aria-label": "表示名", maxLength: WORKER_DISPLAY_NAME_MAX_LENGTH } }}
              required
              fullWidth
            />
          )}
        </form.Field>
        <form.Field name="role">
          {(field) => (
            <TextField
              label="役割"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              slotProps={{ htmlInput: { "aria-label": "役割", maxLength: WORKER_ROLE_MAX_LENGTH } }}
              fullWidth
            />
          )}
        </form.Field>
        <form.Field name="personality">
          {(field) => (
            <TextField
              label="性格"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              slotProps={{ htmlInput: { "aria-label": "性格", maxLength: WORKER_PERSONALITY_MAX_LENGTH } }}
              fullWidth
              multiline
              rows={3}
              helperText={`${field.state.value.length}/${WORKER_PERSONALITY_MAX_LENGTH}`}
            />
          )}
        </form.Field>
        <form.Field name="verbosity">
          {(field) => (
            <FormControl fullWidth>
              <InputLabel id="edit-worker-verbosity-label">文章量</InputLabel>
              <Select
                labelId="edit-worker-verbosity-label"
                label="文章量"
                slotProps={{ input: { "aria-label": "文章量" } }}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value as WorkerVerbosity)}
                onBlur={field.handleBlur}
              >
                {VERBOSITY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </form.Field>
        {isInitializing ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            参加コミュニティを読み込み中…
          </Box>
        ) : canEditCommunities ? (
          <form.Field name="communityIds">
            {(field) => (
              <WorkerCommunitiesField
                labelId="edit-worker-communities-label"
                value={field.state.value}
                onChange={(ids) => field.handleChange(ids)}
              />
            )}
          </form.Field>
        ) : (
          <Alert severity="warning">
            参加コミュニティの読み込みに失敗しました。表示名・役割・性格のみ編集できます。
          </Alert>
        )}
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button type="submit" variant="contained" disabled={isPending}>
            保存
          </Button>
        </Box>
      </Box>
      <Snackbar open={isSaveError} autoHideDuration={6000} onClose={handleErrorClose}>
        <Alert severity="error" onClose={handleErrorClose}>
          {getApiErrorMessage(saveError, "ワーカーの更新に失敗しました")}
        </Alert>
      </Snackbar>
    </>
  );
}

/**
 * ワーカー編集ページ（/admin/workers/:workerId/edit）。#888
 * WorkerImageUpload を同一ページに統合。QueryBoundary で not found をハンドリング。
 */
export function EditWorkerScene(): ReactElement {
  const { workerId } = useParams({ from: "/admin/workers/$workerId/edit" });

  return (
    <Box sx={{ p: 3, maxWidth: 560 }}>
      <Box sx={{ mb: 3 }}>
        <Link to="/admin" search={{ tab: "workers" }}>
          ← 一覧に戻る
        </Link>
      </Box>
      <Typography variant="h5" component="h1" gutterBottom>
        ワーカーを編集
      </Typography>
      <QueryBoundary
        errorFallback={() => (
          <Box>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              ワーカーが見つかりません
            </Typography>
            <Link to="/admin" search={{ tab: "workers" }}>
              ワーカー一覧へ戻る
            </Link>
          </Box>
        )}
      >
        <EditWorkerForm workerId={workerId} />
      </QueryBoundary>
    </Box>
  );
}
