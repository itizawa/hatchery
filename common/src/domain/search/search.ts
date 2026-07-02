import { z } from "zod";

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
