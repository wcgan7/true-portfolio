import { z } from "zod";

const AUDIT_DIMENSIONS = ["holding", "country", "sector", "industry", "currency"] as const;

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

export const auditMetricQuerySchema = z.object({
  metric: z.string().trim().min(1, "metric is required"),
  accountId: z.string().trim().min(1).optional(),
  asOfDate: optionalIsoDate("asOfDate"),
  mode: z
    .string()
    .trim()
    .optional()
    .default("raw")
    .refine((value): value is "raw" | "lookthrough" => value === "raw" || value === "lookthrough", {
      message: "Invalid mode. Use raw or lookthrough.",
    }),
  scopeDimension: z
    .string()
    .trim()
    .optional()
    .refine(
      (value): value is (typeof AUDIT_DIMENSIONS)[number] =>
        value == null || AUDIT_DIMENSIONS.includes(value as (typeof AUDIT_DIMENSIONS)[number]),
      {
        message: "Invalid scopeDimension. Use holding, country, sector, industry, or currency.",
      },
    ),
  scopeSymbol: z.string().trim().min(1).optional(),
}).superRefine((value, ctx) => {
  if ((value.scopeDimension && !value.scopeSymbol) || (!value.scopeDimension && value.scopeSymbol)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scopeDimension and scopeSymbol must be provided together.",
      path: ["scopeDimension"],
    });
  }
});

export type AuditMetricQueryInput = z.infer<typeof auditMetricQuerySchema>;
