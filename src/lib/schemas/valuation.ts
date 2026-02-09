import { z } from "zod";

export const recomputeValuationsSchema = z.object({
  accountId: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type RecomputeValuationsInput = z.infer<typeof recomputeValuationsSchema>;
