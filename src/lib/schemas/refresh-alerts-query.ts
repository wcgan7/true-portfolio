import { z } from "zod";

export const refreshAlertsQuerySchema = z.object({
  lookbackHours: z.coerce.number().finite("Invalid lookbackHours query param.").optional().default(24),
});

export type RefreshAlertsQueryInput = z.infer<typeof refreshAlertsQuerySchema>;
