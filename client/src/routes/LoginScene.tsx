import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useState } from "react";

import { AUTH_ME_QUERY_KEY, login } from "../api/auth.js";

export const LoginScene = (): ReactElement => {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login({ id, password });
      await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      await navigate({ to: "/" });
    } catch {
      setError("ID またはパスワードが正しくありません");
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ maxWidth: 400, mx: "auto", mt: 8, p: 4, display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Typography variant="h5" component="h1" gutterBottom>
        ログイン
      </Typography>
      {error && (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      )}
      <TextField
        label="ID"
        id="login-id"
        inputProps={{ "aria-label": "ID" }}
        value={id}
        onChange={(e) => setId(e.target.value)}
        required
        autoFocus
      />
      <TextField
        label="パスワード"
        id="login-password"
        inputProps={{ "aria-label": "パスワード" }}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" variant="contained" fullWidth>
        ログイン
      </Button>
    </Box>
  );
};
