import { z } from "zod";

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Account name is required").max(120),
  baseCurrency: z.literal("USD").default("USD"),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

