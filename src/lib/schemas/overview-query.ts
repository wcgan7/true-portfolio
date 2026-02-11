import { z } from "zod";

const VALID_MODES = ["raw", "lookthrough"] as const;
const VALID_PERIODS = ["since_inception", "ytd", "custom"] as const;
const VALID_ASSET_KINDS = ["CASH", "STOCK", "ETF", "OPTION", "CUSTOM"] as const;

function optionalIsoDate(field: string) {
  return z.string().trim().min(1).optional().transform((value, ctx) => {
    if (!value) {
      return undefined;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid ${field}. Expected ISO date.`,
      });
      return z.NEVER;
    }
    return parsed;
  });
}

export const overviewQuerySchema = z.object({
  accountId: z.string().trim().min(1).optional(),
  asOfDate: optionalIsoDate("asOfDate"),
  mode: z
    .string()
    .trim()
    .optional()
    .default("raw")
    .refine((value): value is (typeof VALID_MODES)[number] => VALID_MODES.includes(value as (typeof VALID_MODES)[number]), {
      message: "Invalid mode. Use raw or lookthrough.",
    }),
  period: z
    .string()
    .trim()
    .optional()
    .default("since_inception")
    .refine(
      (value): value is (typeof VALID_PERIODS)[number] =>
        VALID_PERIODS.includes(value as (typeof VALID_PERIODS)[number]),
      {
        message: "Invalid period. Use since_inception, ytd, or custom.",
      },
    ),
  assetKinds: z
    .array(z.string())
    .optional()
    .default([])
    .transform((values) => values.map((value) => value.trim().toUpperCase()))
    .superRefine((values, ctx) => {
      for (const value of values) {
        if (!VALID_ASSET_KINDS.includes(value as (typeof VALID_ASSET_KINDS)[number])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid assetKind. Use CASH, STOCK, ETF, OPTION, or CUSTOM.",
          });
          return;
        }
      }
    }),
  currencies: z
    .array(z.string())
    .optional()
    .default([])
    .transform((values) => values.map((value) => value.trim().toUpperCase()))
    .superRefine((values, ctx) => {
      for (const value of values) {
        if (!/^[A-Z]{3}$/.test(value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid currency. Expected 3-letter code like USD.",
          });
          return;
        }
      }
    }),
  from: optionalIsoDate("from"),
  to: optionalIsoDate("to"),
});

export type OverviewQueryInput = z.infer<typeof overviewQuerySchema>;
