import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactElement, useState } from "react";

import { COMMUNITY_SLUG_MAX_LENGTH, COMMUNITY_SLUG_REGEX } from "@hatchery/common";
import type { CreateCommunityInput } from "@hatchery/common";

import { useCreateCommunity } from "../api/communities.js";
import { CommunityFormFields } from "../components/CommunityFormFields.js";
import { Alert, Box, Button, TextField, Typography } from "../components/uiParts/index.js";

/**
 * コミュニティ作成ページ（/admin/communities/new）。#889
 * AddCommunityDialog を専用ページに移行。作成成功後に編集ページへ自動遷移する。
 */
export function AddCommunityScene(): ReactElement {
  const navigate = useNavigate();
  const createMutation = useCreateCommunity();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      slug: "",
      name: "",
      description: "",
      generationInstruction: "",
    } as CreateCommunityInput,
    onSubmit: async ({ value }) => {
      setErrorMsg(null);
      try {
        const created = await createMutation.mutateAsync(value);
        await navigate({
          to: "/admin/communities/$id/edit",
          params: { id: created.id },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "作成に失敗しました";
        const isSlugConflict = msg.includes("CommunitySlugAlreadyExists") || msg.includes("409");
        setErrorMsg(isSlugConflict ? "この slug はすでに使用されています" : msg);
      }
    },
  });

  return (
    <Box sx={{ p: 3, maxWidth: 560 }}>
      <Box sx={{ mb: 3 }}>
        <Link to="/admin" search={{ tab: "communities" }}>
          ← 一覧に戻る
        </Link>
      </Box>
      <Typography variant="h5" component="h1" gutterBottom>
        コミュニティを追加
      </Typography>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}
      >
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
              fullWidth
            />
          )}
        </form.Field>
        <CommunityFormFields form={form} />
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button type="submit" variant="contained" disabled={createMutation.isPending}>
            作成
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
