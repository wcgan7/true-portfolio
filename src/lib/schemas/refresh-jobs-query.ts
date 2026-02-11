import { z } from "zod";

const VALID_STATUSES = ["RUNNING", "SUCCEEDED", "FAILED", "SKIPPED_CONFLICT"] as const;
const VALID_TRIGGERS = ["MANUAL", "SCHEDULED"] as const;

function optionalFiniteNumber(field: string) {
  return z.coerce.number().finite(`Invalid ${field} query param.`).optional();
}

function optionalUpperEnum<T extends readonly string[]>(
  values: T,
  message: string,
) {
  return z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .superRefine((value, ctx) => {
      if (value && !values.includes(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message,
        });
      }
    });
}

export const refreshJobsQuerySchema = z.object({
  limit: optionalFiniteNumber("limit").default(20),
  offset: optionalFiniteNumber("offset").default(0),
  status: optionalUpperEnum(VALID_STATUSES, "Invalid status query param."),
  trigger: optionalUpperEnum(VALID_TRIGGERS, "Invalid trigger query param."),
});

export type RefreshJobsQueryInput = z.infer<typeof refreshJobsQuerySchema>;
