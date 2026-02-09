import { z } from "zod";

export const refreshPricesSchema = z.object({
  symbols: z.array(z.string().trim().min(1)).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type RefreshPricesInput = z.infer<typeof refreshPricesSchema>;

