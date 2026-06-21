import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "./uiParts";

import { useForm } from "@tanstack/react-form";
import { type ReactElement, useState } from "react";

import { COMMUNITY_SLUG_MAX_LENGTH, COMMUNITY_SLUG_REGEX } from "@hatchery/common";
import type { CreateCommunityInput } from "@hatchery/common";

import { useCreateCommunity } from "../api/communities.js";
import { CommunityFormFields } from "./CommunityFormFields.js";

interface AddCommunityDialogProps {
  /** ダイアログの開閉状態 */
  open: boolean;
  /** ダイアログを閉じるコールバック */
  onClose: () => void;
  /** 作成成功時のコールバック（成功スナックバー表示などに使う・任意） */
  onCreated?: () => void;
}

/**
 * 管理画面のコミュニティタブでコミュニティを新規作成するモーダル（#833）。
 * ワーカー管理（AddWorkerDialog）と同じモーダル方式に統一する。
 * フォームは @tanstack/react-form の useForm を使用（useState によるフォーム管理禁止）。
 * name / description / generationInstruction は CommunityFormFields を継続利用する（#595）。
 * 各入力に inputProps.maxLength を設定し、サーバー側 Zod と二重防御する（#91）。
 */
export function AddCommunityDialog({ open, onClose, onCreated }: AddCommunityDialogProps): ReactElement {
  const createMutation = useCreateCommunity();
  // エラー表示文言はフォームフィールドではないため useState で保持してよい（CLAUDE.md フォーム規約は
  // フィールド/ダーティの自前管理を禁止するもの）。409 を slug 重複文言へ変換するため必要。
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { slug: "", name: "", description: "", generationInstruction: "" } as CreateCommunityInput,
    onSubmit: async ({ value }) => {
      setErrorMsg(null);
      try {
        await createMutation.mutateAsync(value);
        form.reset();
        onCreated?.();
        onClose();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "作成に失敗しました";
        // slug 重複は server が ConflictError("CommunitySlugAlreadyExists") を 409 で返す
        // （errorHandler が { error: "CommunitySlugAlreadyExists" } を返すため message にそのトークンが乗る）。
        // ボディに error が無いフォールバック時は "(409)" が付くため "409" も拾う。
        const isSlugConflict = msg.includes("CommunitySlugAlreadyExists") || msg.includes("409");
        setErrorMsg(isSlugConflict ? "この slug はすでに使用されています" : msg);
      }
    },
  });

  const handleClose = (): void => {
    // 送信中は閉じない（保留中の作成が完了した際に onCreated/onClose が二重発火するのを防ぐ）。
    if (createMutation.isPending) return;
    form.reset();
    setErrorMsg(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>コミュニティを追加</DialogTitle>
      <Box
        component="form"
        onSubmit={async (e) => {
          e.preventDefault();
          await form.handleSubmit();
        }}
      >
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {errorMsg && (
            <Alert severity="error" onClose={() => setErrorMsg(null)}>
              {errorMsg}
            </Alert>
          )}
          <form.Field
            name="slug"
            validators={{
              onSubmit: ({ value }) => {
                if (!value) return "slug は必須です";
                if (!COMMUNITY_SLUG_REGEX.test(value))
                  return "slug は小文字英数字とハイフンのみ（先頭末尾は英数字）";
                return undefined;
              },
            }}
          >
            {(field) => (
              <TextField
                label="slug（URL 識別子）"
                size="small"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                slotProps={{ htmlInput: { maxLength: COMMUNITY_SLUG_MAX_LENGTH, autoComplete: "off" } }}
                error={field.state.meta.errors.length > 0}
                helperText={
                  field.state.meta.errors[0] ?? "小文字英数字とハイフンのみ（例: tech-news）"
                }
              />
            )}
          </form.Field>
          <CommunityFormFields form={form} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={createMutation.isPending}>
            キャンセル
          </Button>
          <Button type="submit" variant="contained" disabled={createMutation.isPending}>
            作成
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
