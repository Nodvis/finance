import { z } from "zod";

export const matchTransferSchema = z.object({
  outflowTransactionId: z.string().uuid("Invalid outflow transaction ID"),
  expectedOutflowVersion: z.number().int().positive(),
  inflowTransactionId: z.string().uuid("Invalid inflow transaction ID"),
  expectedInflowVersion: z.number().int().positive(),
  matchedIdentifier: z.string().trim().max(64).optional().nullable(),
  matchConfidence: z.enum(["automatic", "manual"]).optional().default("manual"),
  notes: z.string().trim().max(280).optional().nullable(),
});

export type MatchTransferSchemaInput = z.infer<typeof matchTransferSchema>;
