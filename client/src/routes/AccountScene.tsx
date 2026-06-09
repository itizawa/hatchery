import { Alert, Box, Button, Skeleton, Snackbar, TextField, Typography } from "../components/uiParts";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactElement, useEffect, useRef, useState } from "react";

import { AVATAR_URL_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH } from "@hatchery/common";
import * as authApi from "../api/auth.js";

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
  const { data: authUser, isLoading } = authApi.useAuth();
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof authApi.updateProfile>[0]) => authApi.updateProfile(body),
    onSuccess: (data) => queryClient.setQueryData(authApi.AUTH_ME_QUERY_KEY, data),
  });

  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // authUser ロード後の保存済み値を ref で保持（dirty 判定用）
  const savedValuesRef = useRef<{ displayName: string; avatarUrl: string } | null>(null);

  const form = useForm({
    defaultValues: {
      displayName: authUser?.displayName ?? "",
      avatarUrl: authUser?.avatarUrl ?? "",
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync({
        displayName: value.displayName,
        ...(value.avatarUrl ? { avatarUrl: value.avatarUrl } : {}),
      });
      setSnackbarOpen(true);
    },
  });

  // authUser がロードされたらフォームの値を同期する
  useEffect(() => {
    if (authUser) {
      const values = {
        displayName: authUser.displayName,
        avatarUrl: authUser.avatarUrl ?? "",
      };
      savedValuesRef.current = values;
      form.reset(values);
    }
  }, [authUser]); // form は stable なので依存配列から除外

  if (isLoading) {
    return (
      <Box component="section" sx={{ p: 3, maxWidth: 480 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          アカウント設定
        </Typography>
        <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          <Skeleton variant="text" height={40} data-testid="account-scene-skeleton" />
          <Skeleton variant="text" height={40} />
        </Box>
      </Box>
    );
  }

  return (
    <Box component="section" sx={{ p: 3, maxWidth: 480 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        アカウント設定
      </Typography>

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
              inputProps={{ maxLength: DISPLAY_NAME_MAX_LENGTH }}
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
              inputProps={{ maxLength: AVATAR_URL_MAX_LENGTH }}
              error={field.state.meta.errors.length > 0}
              helperText={field.state.meta.errors[0] ?? ""}
            />
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => ({
            displayName: state.values.displayName,
            avatarUrl: state.values.avatarUrl,
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ displayName, avatarUrl, canSubmit, isSubmitting }) => {
            // savedValuesRef との比較で dirty を判定（savedValuesRef は authUser ロード後にセットされる）
            const saved = savedValuesRef.current;
            const isDirty = saved !== null && (displayName !== saved.displayName || avatarUrl !== saved.avatarUrl);
            return (
              <Button
                type="submit"
                variant="contained"
                disabled={!displayName.trim() || !canSubmit || isSubmitting || updateMutation.isPending || !isDirty}
                sx={{ alignSelf: "flex-start" }}
              >
                保存
              </Button>
            );
          }}
        </form.Subscribe>
      </Box>

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
    </Box>
  );
};
