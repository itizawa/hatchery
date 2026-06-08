import { Alert, Box, Button, Skeleton, Snackbar, TextField, Typography } from "../components/uiParts";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactElement, useEffect, useRef, useState } from "react";

import { DISPLAY_NAME_MAX_LENGTH } from "@hatchery/common";
import * as authApi from "../api/auth.js";

export const AccountScene = (): ReactElement => {
  const { data: authUser, isLoading } = authApi.useAuth();
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof authApi.updateProfile>[0]) => authApi.updateProfile(body),
    onSuccess: (data) => queryClient.setQueryData(authApi.AUTH_ME_QUERY_KEY, data),
  });

  const [displayName, setDisplayName] = useState(authUser?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(authUser?.avatarUrl ?? "");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (authUser && !initialized.current) {
      setDisplayName(authUser.displayName);
      setAvatarUrl(authUser.avatarUrl ?? "");
      initialized.current = true;
    }
  }, [authUser]);

  const handleSubmit = async () => {
    await updateMutation.mutateAsync({
      displayName,
      ...(avatarUrl ? { avatarUrl } : {}),
    });
    setSnackbarOpen(true);
  };

  const isDisabled = displayName.trim() === "" || updateMutation.isPending;

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

      <Box component="form" noValidate sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label="表示名"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          fullWidth
          size="small"
          inputProps={{ maxLength: DISPLAY_NAME_MAX_LENGTH }}
        />
        <TextField
          label="プロフィール画像 URL"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          fullWidth
          size="small"
          placeholder="https://example.com/avatar.png"
        />
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isDisabled}
          sx={{ alignSelf: "flex-start" }}
        >
          保存
        </Button>
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
