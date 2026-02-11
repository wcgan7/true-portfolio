import { z } from "zod";

const ingestRowSchema = z.object({
  etfSymbol: z
    .string()
    .trim()
    .min(1, "etfSymbol is required")
    .max(32)
    .transform((value) => value.toUpperCase()),
  constituentSymbol: z
    .string()
    .trim()
    .min(1, "constituentSymbol is required")
    .max(32)
    .transform((value) => value.toUpperCase()),
  weight: z.number().finite().positive("weight must be > 0"),
});

export const ingestEtfConstituentsSchema = z.object({
  asOfDate: z.coerce.date(),
  source: z.string().trim().min(1).max(64).default("curated_manual"),
  replaceExistingAsOfDate: z.boolean().default(true),
  rows: z.array(ingestRowSchema).min(1, "rows must contain at least one item"),
});

export type IngestEtfConstituentsInput = z.infer<typeof ingestEtfConstituentsSchema>;
