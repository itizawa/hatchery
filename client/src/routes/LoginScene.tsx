import { Box, Button, TextField, Typography } from "../components/uiParts";

import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useState } from "react";

import { AUTH_ME_QUERY_KEY, login } from "../api/auth.js";

export const LoginScene = (): ReactElement => {
  const [apiError, setApiError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: { id: "", password: "" },
    onSubmit: async ({ value }) => {
      setApiError(null);
      try {
        await login({ id: value.id, password: value.password });
        await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
        await navigate({ to: "/" });
      } catch {
        setApiError("ID またはパスワードが正しくありません");
      }
    },
  });

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
        ログイン
      </Typography>
      {apiError && (
        <Typography color="error" variant="body2">
          {apiError}
        </Typography>
      )}
      <form.Field
        name="id"
        validators={{
          onSubmit: ({ value }) => (!value ? "ID は必須です" : undefined),
        }}
      >
        {(field) => (
          <TextField
            label="ID"
            id="login-id"
            inputProps={{ "aria-label": "ID" }}
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
        name="password"
        validators={{
          onSubmit: ({ value }) => (!value ? "パスワードは必須です" : undefined),
        }}
      >
        {(field) => (
          <TextField
            label="パスワード"
            id="login-password"
            inputProps={{ "aria-label": "パスワード" }}
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
      <Button type="submit" variant="contained" fullWidth>
        ログイン
      </Button>
    </Box>
  );
};
