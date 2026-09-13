import { z } from "zod";
import { moneySchema } from "./schema";

export const splitTransactionSchema = z.object({
  expectedVersion: z.number().int().min(1),
  allocations: z.array(z.object({ categoryId: z.string().uuid(), amount: moneySchema })).min(2),
});
export type SplitTransactionInput = z.infer<typeof splitTransactionSchema>;
