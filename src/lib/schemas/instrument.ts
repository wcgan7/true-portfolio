import { z } from "zod";

export const createInstrumentSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Symbol is required")
    .max(32)
    .regex(/^[A-Za-z0-9._-]+$/, "Symbol contains unsupported characters")
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1, "Name is required").max(120),
  kind: z.enum(["CASH", "STOCK", "ETF", "OPTION", "CUSTOM"]),
  currency: z.literal("USD").default("USD"),
});

export type CreateInstrumentInput = z.infer<typeof createInstrumentSchema>;

