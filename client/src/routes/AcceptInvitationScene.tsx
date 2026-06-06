import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { type ReactElement, useEffect, useState } from "react";

import { useAuth } from "../api/auth.js";
import { useAcceptInvitation, useInvitation } from "../api/invitations.js";

const INVALID_STATUS_MESSAGES = {
  used: "この招待リンクは使用済みです。",
  expired: "この招待リンクは期限切れです。",
  revoked: "この招待リンクは無効化されています。",
} as const;

export const AcceptInvitationScene = (): ReactElement => {
  const { token } = useParams({ strict: false });
  const safeToken = token ?? "";
  const navigate = useNavigate();
  const { data: user, isLoading: isAuthLoading } = useAuth();
  const { data: invitation, isLoading: isInvitationLoading } = useInvitation(safeToken);
  const acceptMutation = useAcceptInvitation(safeToken);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && user) {
      void navigate({ to: "/" });
    }
  }, [user, isAuthLoading, navigate]);

  const form = useForm({
    defaultValues: { id: "", displayName: "", password: "" },
    onSubmit: async ({ value }) => {
      setApiError(null);
      try {
        await acceptMutation.mutateAsync(value);
        await navigate({ to: "/" });
      } catch (err) {
        const e = err as { status?: number; message?: string };
        if (e.status === 409) {
          setApiError("この ID は既に使われています");
        } else {
          setApiError("この招待は使用できません");
        }
      }
    },
  });

  if (isAuthLoading || isInvitationLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!invitation || invitation.status !== "active") {
    const message =
      invitation && invitation.status in INVALID_STATUS_MESSAGES
        ? INVALID_STATUS_MESSAGES[invitation.status as keyof typeof INVALID_STATUS_MESSAGES]
        : "この招待リンクは見つかりません。";

    return (
      <Box sx={{ maxWidth: 400, mx: "auto", mt: 8, p: 4 }}>
        <Typography variant="body1" color="error" gutterBottom>
          {message}
        </Typography>
        <Link to="/login">ログインページへ</Link>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={async (e) => {
        e.preventDefault();
        await form.handleSubmit();
      }}
      sx={{ maxWidth: 400, mx: "auto", mt: 8, p: 4, display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Typography variant="h5" component="h1" gutterBottom>
        新規登録
      </Typography>
      {apiError && (
        <Typography color="error" variant="body2">
          {apiError}
        </Typography>
      )}
      <form.Field
        name="id"
        validators={{
          onSubmit: ({ value }) => (!value ? "ログイン ID は必須です" : undefined),
        }}
      >
        {(field) => (
          <TextField
            label="ログイン ID"
            inputProps={{ "aria-label": "ログイン ID", maxLength: 50 }}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            required
            error={field.state.meta.errors.length > 0}
            helperText={field.state.meta.errors[0] ?? ""}
          />
        )}
      </form.Field>
      <form.Field
        name="displayName"
        validators={{
          onSubmit: ({ value }) => (!value ? "表示名は必須です" : undefined),
        }}
      >
        {(field) => (
          <TextField
            label="表示名"
            inputProps={{ "aria-label": "表示名", maxLength: 100 }}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            required
            error={field.state.meta.errors.length > 0}
            helperText={field.state.meta.errors[0] ?? ""}
          />
        )}
      </form.Field>
      <form.Field
        name="password"
        validators={{
          onSubmit: ({ value }) => (value.length < 8 ? "パスワードは 8 文字以上です" : undefined),
        }}
      >
        {(field) => (
          <TextField
            label="パスワード"
            type="password"
            inputProps={{ "aria-label": "パスワード", maxLength: 100 }}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            required
            error={field.state.meta.errors.length > 0}
            helperText={field.state.meta.errors[0] ?? ""}
          />
        )}
      </form.Field>
      <Button type="submit" variant="contained" fullWidth disabled={acceptMutation.isPending}>
        登録
      </Button>
    </Box>
  );
};
