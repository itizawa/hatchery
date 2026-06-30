import { Alert, Box, Button, Snackbar, TextField, Typography } from "../components/uiParts";

import { useForm } from "@tanstack/react-form";
import { PushSubscribeButton } from "../components/PushSubscribeButton.js";
import { useSearch } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactElement, useEffect, useState } from "react";

import { AVATAR_URL_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH } from "@hatchery/common";
import * as authApi from "../api/auth.js";
import { getApiErrorMessage } from "../api/errors.js";

function validateUrl(value: string): string | undefined {
  if (!value) return undefined;
  try {
    new URL(value);
    return undefined;
  } catch {
    return "有効な URL を入力してください";
  }
}

export const AccountScene = (): ReactElement => {
  // #461: useAuth は useSuspenseQuery 化済み。/account は requireAuth ガード経由で到達するため
  // ここでは authUser は解決済み（AuthUser）。ローディングはルートの Suspense に委譲する。
  const { data: authUser } = authApi.useAuth();
  // 初回ログイン直後（OAuth で新規ユーザー作成）の遷移で `?welcome=1` が付く。表示名設定を促す歓迎表示に使う。
  const { welcome } = useSearch({ from: "/account" });
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof authApi.updateProfile>[0]) => authApi.updateProfile(body),
    onSuccess: (data) => queryClient.setQueryData(authApi.AUTH_ME_QUERY_KEY, data),
  });

  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      displayName: authUser?.displayName ?? "",
      avatarUrl: authUser?.avatarUrl ?? "",
    },
    onSubmit: async ({ value }) => {
      // 失敗フィードバックは updateMutation.isError / error に集約する（独立ローカル state を持たない・#476）。
      // mutateAsync の reject を握りつぶさないよう try/catch するが、catch では何もしない
      // （未処理 Promise rejection を避けるためだけ）。成功 Snackbar は正常系末尾でのみ出し、
      // 失敗時は出さない（保存成否を取り違えないため・#472）。
      try {
        await updateMutation.mutateAsync({
          displayName: value.displayName,
          ...(value.avatarUrl ? { avatarUrl: value.avatarUrl } : {}),
        });
        setSnackbarOpen(true);
      } catch {
        // 表示は updateMutation の状態（error Snackbar）に委ねる。
      }
    },
  });

  // authUser がロードされたらフォームの値を同期する
  useEffect(() => {
    if (authUser) {
      const values = {
        displayName: authUser.displayName,
        avatarUrl: authUser.avatarUrl ?? "",
      };
      form.reset(values);
    }
  }, [authUser]); // form は stable なので依存配列から除外

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 480 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        アカウント設定
      </Typography>

      {welcome && (
        <Alert severity="info" sx={{ mb: 2 }}>
          ようこそ Hatchery へ！まずは表示名を設定しましょう。
        </Alert>
      )}

      <Box
        component="form"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          await form.handleSubmit();
        }}
        sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}
      >
        <form.Field
          name="displayName"
          validators={{
            onChange: ({ value }) => (!value.trim() ? "表示名は必須です" : undefined),
            onBlur: ({ value }) => (!value.trim() ? "表示名は必須です" : undefined),
          }}
        >
          {(field) => (
            <TextField
              label="表示名"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              required
              fullWidth
              size="small"
              slotProps={{ htmlInput: { maxLength: DISPLAY_NAME_MAX_LENGTH } }}
              error={field.state.meta.errors.length > 0}
              helperText={field.state.meta.errors[0] ?? ""}
            />
          )}
        </form.Field>

        <form.Field
          name="avatarUrl"
          validators={{
            onChange: ({ value }) => validateUrl(value),
            onBlur: ({ value }) => validateUrl(value),
          }}
        >
          {(field) => (
            <TextField
              label="プロフィール画像 URL"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              fullWidth
              size="small"
              placeholder="https://example.com/avatar.png"
              slotProps={{ htmlInput: { maxLength: AVATAR_URL_MAX_LENGTH } }}
              error={field.state.meta.errors.length > 0}
              helperText={field.state.meta.errors[0] ?? ""}
            />
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => ({
            displayName: state.values.displayName,
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
            isDirty: !state.isDefaultValue,
          })}
        >
          {({ displayName, canSubmit, isSubmitting, isDirty }) => (
            <Button
              type="submit"
              variant="contained"
              disabled={
                !displayName.trim() ||
                !canSubmit ||
                isSubmitting ||
                updateMutation.isPending ||
                !isDirty
              }
              sx={{ alignSelf: "flex-start" }}
            >
              保存
            </Button>
          )}
        </form.Subscribe>
      </Box>

      <PushSubscribeButton />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setSnackbarOpen(false)}>
          保存しました
        </Alert>
      </Snackbar>

      <Snackbar
        open={updateMutation.isError}
        autoHideDuration={6000}
        onClose={() => updateMutation.reset()}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => updateMutation.reset()}>
          {getApiErrorMessage(updateMutation.error, "プロフィールの更新に失敗しました")}
        </Alert>
      </Snackbar>
    </Box>
  );
};
