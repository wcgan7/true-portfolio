import { z } from "zod";

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

export const valuationsQuerySchema = z.object({
  accountId: z.string().trim().min(1).optional(),
  from: optionalIsoDate("from"),
  to: optionalIsoDate("to"),
});

export type ValuationsQueryInput = z.infer<typeof valuationsQuerySchema>;
