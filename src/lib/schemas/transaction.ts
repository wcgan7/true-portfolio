import { z } from "zod";

const positiveNumber = z.number().finite().positive();
const nonNegativeNumber = z.number().finite().nonnegative();

export const transactionTypeSchema = z.enum([
  "BUY",
  "SELL",
  "DIVIDEND",
  "FEE",
  "DEPOSIT",
  "WITHDRAWAL",
]);

export const createTransactionSchema = z
  .object({
    accountId: z.string().min(1),
    instrumentId: z.string().min(1).optional(),
    type: transactionTypeSchema,
    tradeDate: z.coerce.date(),
    settleDate: z.coerce.date().optional(),
    quantity: positiveNumber.optional(),
    price: positiveNumber.optional(),
    amount: positiveNumber.optional(),
    feeAmount: nonNegativeNumber.optional().default(0),
    notes: z.string().max(500).optional(),
    externalRef: z.string().max(120).optional(),
  })
  .superRefine((input, ctx) => {
    const isTrade = input.type === "BUY" || input.type === "SELL";
    const isCashEvent = !isTrade;

    if (input.settleDate && input.settleDate < input.tradeDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["settleDate"],
        message: "settleDate must be on or after tradeDate",
      });
    }

    if (isTrade) {
      if (!input.instrumentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["instrumentId"],
          message: `${input.type} requires instrumentId`,
        });
      }
      if (input.quantity == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["quantity"],
          message: `${input.type} requires quantity`,
        });
      }
      if (input.price == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["price"],
          message: `${input.type} requires price`,
        });
      }
      if (input.amount != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message: `${input.type} does not accept amount`,
        });
      }
      return;
    }

    if (isCashEvent) {
      if (input.amount == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message: `${input.type} requires amount`,
        });
      }
      if (input.quantity != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["quantity"],
          message: `${input.type} does not accept quantity`,
        });
      }
      if (input.price != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["price"],
          message: `${input.type} does not accept price`,
        });
      }
      if (input.instrumentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["instrumentId"],
          message: `${input.type} does not accept instrumentId`,
        });
      }
    }
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

