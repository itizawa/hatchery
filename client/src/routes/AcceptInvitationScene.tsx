import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useForm } from "@tanstack/react-form";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import {
  ACCEPT_INVITATION_DISPLAY_NAME_MAX_LENGTH,
  ACCEPT_INVITATION_ID_MAX_LENGTH,
  ACCEPT_INVITATION_PASSWORD_MAX_LENGTH,
  ACCEPT_INVITATION_PASSWORD_MIN_LENGTH,
} from "@hatchery/common";

import { useAuth } from "../api/auth.js";
import { ApiError, useAcceptInvitation, useInvitation } from "../api/invitations.js";
import type { InvitationStatus } from "@hatchery/common";

function InvalidMessage({ status }: { status: InvitationStatus | "notfound" | "error" }): ReactElement {
  const messages: Record<InvitationStatus | "notfound" | "error", string> = {
    used: "この招待リンクはすでに使用済みです。",
    expired: "この招待リンクは有効期限が切れています。",
    revoked: "この招待リンクは無効化されています。",
    active: "招待リンクが無効です。",
    notfound: "このリンクは無効です。招待リンクが正しいか確認してください。",
    error: "サーバーエラーが発生しました。しばらく待ってから再度お試しください。",
  };

  return (
    <Box sx={{ maxWidth: 400, mx: "auto", mt: 8, p: 4, display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h5" component="h1">
        招待リンクエラー
      </Typography>
      <Typography color="text.secondary">{messages[status]}</Typography>
      <Link href="/login" underline="hover">
        ログインページへ
      </Link>
    </Box>
  );
}

export function AcceptInvitationScene(): ReactElement {
  const { token } = useParams({ strict: false });
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: currentUser, isLoading: isAuthLoading } = useAuth();
  const { data: invitation, isLoading: isInvitationLoading, isError: isInvitationError } = useInvitation(token ?? "");
  const acceptMutation = useAcceptInvitation(token ?? "");

  useEffect(() => {
    if (!isAuthLoading && currentUser) {
      void navigate({ to: "/" });
    }
  }, [currentUser, isAuthLoading, navigate]);

  const form = useForm({
    defaultValues: { id: "", displayName: "", password: "" },
    onSubmit: async ({ value }) => {
      setApiError(null);
      try {
        await acceptMutation.mutateAsync(value);
        await navigate({ to: "/" });
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const errDetail = (err.body as { error?: string } | undefined)?.error?.toLowerCase() ?? "";
          if (errDetail.includes("user id") || errDetail.includes("already exists")) {
            setApiError("このIDは既に使われています");
          } else {
            setApiError("招待リンクが無効になりました");
          }
        } else {
          setApiError("エラーが発生しました。もう一度お試しください。");
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

  if (isInvitationError) {
    return <InvalidMessage status="error" />;
  }

  if (invitation === null) {
    return <InvalidMessage status="notfound" />;
  }

  if (invitation && invitation.status !== "active") {
    return <InvalidMessage status={invitation.status} />;
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
        ユーザー登録
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
            id="accept-id"
            inputProps={{ "aria-label": "ログイン ID", maxLength: ACCEPT_INVITATION_ID_MAX_LENGTH }}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            autoFocus
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
            id="accept-display-name"
            inputProps={{ "aria-label": "表示名", maxLength: ACCEPT_INVITATION_DISPLAY_NAME_MAX_LENGTH }}
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
          onSubmit: ({ value }) =>
            !value
              ? "パスワードは必須です"
              : value.length < ACCEPT_INVITATION_PASSWORD_MIN_LENGTH
                ? `パスワードは ${ACCEPT_INVITATION_PASSWORD_MIN_LENGTH} 文字以上にしてください`
                : undefined,
        }}
      >
        {(field) => (
          <TextField
            label="パスワード"
            id="accept-password"
            inputProps={{ "aria-label": "パスワード", maxLength: ACCEPT_INVITATION_PASSWORD_MAX_LENGTH }}
            type="password"
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            required
            error={field.state.meta.errors.length > 0}
            helperText={field.state.meta.errors[0] ?? ""}
          />
        )}
      </form.Field>
      <Button type="submit" variant="contained" fullWidth disabled={form.state.isSubmitting || acceptMutation.isPending}>
        登録する
      </Button>
    </Box>
  );
}
