import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Typography,
} from "./uiParts";

import { useForm } from "@tanstack/react-form";
import type { ReactElement } from "react";

import type { AdminCommunity, UpdateCommunityInput } from "@hatchery/common";

import { useUpdateCommunity } from "../api/communities.js";
import { getApiErrorMessage } from "../api/errors.js";
import { CommunityFormFields } from "./CommunityFormFields.js";
import { CommunityImageUpload } from "./CommunityImageUpload.js";

interface EditCommunityDialogProps {
  /** 編集対象のコミュニティ */
  community: AdminCommunity;
  /** ダイアログの開閉状態 */
  open: boolean;
  /** ダイアログを閉じるコールバック */
  onClose: () => void;
}

/**
 * 管理画面のコミュニティタブでコミュニティを編集するモーダル（#833）。
 * ワーカー管理（EditWorkerDialog）と同じモーダル方式に統一する。
 * name / description / generationInstruction は CommunityFormFields を継続利用（#595）。
 * カバー・アイコン画像の CommunityImageUpload をダイアログ内に取り込む（#457）。
 * フォーム状態は @tanstack/react-form を使用（CLAUDE.md フォーム規約）。
 * 各入力に inputProps.maxLength を設定し、サーバー側 Zod と二重防御する（#91）。
 */
export function EditCommunityDialog({ community, open, onClose }: EditCommunityDialogProps): ReactElement {
  const updateMutation = useUpdateCommunity();

  const form = useForm({
    defaultValues: {
      name: community.name,
      description: community.description,
      generationInstruction: community.generationInstruction ?? "",
    } as UpdateCommunityInput,
    onSubmit: async ({ value }) => {
      try {
        await updateMutation.mutateAsync({ id: community.id, input: value });
        onClose();
      } catch {
        // エラー表示は updateMutation の状態（isError / error）に委ねる（#476）。
        // mutateAsync の reject を握り潰さないため catch するが、ここでは何もしない。
      }
    },
  });

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>コミュニティ編集</DialogTitle>
        <Box
          component="form"
          onSubmit={async (e) => {
            e.preventDefault();
            await form.handleSubmit();
          }}
        >
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
              {/* アイコン・カバー画像のアップロード（#457）。フォーム送信とは独立した即時アップロード。 */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  カバー画像（ヘッダー）
                </Typography>
                <CommunityImageUpload
                  communityId={community.id}
                  kind="cover"
                  name={community.name}
                  currentImageUrl={community.coverUrl ?? null}
                />
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
                  <CommunityImageUpload
                    communityId={community.id}
                    kind="icon"
                    name={community.name}
                    currentImageUrl={community.iconUrl ?? null}
                  />
                  <Typography variant="caption" color="text.secondary">
                    アイコン画像（クリックして変更）
                  </Typography>
                </Box>
              </Box>
              <CommunityFormFields form={form} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={updateMutation.isPending}>
              キャンセル
            </Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending}>
              保存
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Snackbar open={updateMutation.isError} autoHideDuration={6000} onClose={() => updateMutation.reset()}>
        <Alert severity="error" onClose={() => updateMutation.reset()}>
          {getApiErrorMessage(updateMutation.error, "コミュニティの更新に失敗しました")}
        </Alert>
      </Snackbar>
    </>
  );
}
