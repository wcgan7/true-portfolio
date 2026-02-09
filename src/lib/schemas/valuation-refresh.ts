import { z } from "zod";

export const valuationRefreshSchema = z.object({
  accountId: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  symbols: z.array(z.string().trim().min(1)).optional(),
});

export type ValuationRefreshInput = z.infer<typeof valuationRefreshSchema>;
