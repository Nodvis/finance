import { z } from "zod";

export const recordBalanceObservationSchema = z.object({
  subjectType: z.enum(["account", "liability"]),
  subjectId: z.string().uuid(),
  amountNatural: z.string().trim().min(1),
  observedAt: z.string().trim().min(1),
  note: z.string().max(280).optional().nullable(),
});

export type RecordBalanceObservationInput = z.infer<typeof recordBalanceObservationSchema>;

const isoDateTime = z.string().datetime({ offset: true });

export const netWorthQuerySchema = z
  .object({
    asOf: isoDateTime.optional(),
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
  })
  .refine(
    (value) =>
      !value.from || !value.to || new Date(value.from).getTime() <= new Date(value.to).getTime(),
    { message: "from must not be later than to", path: ["from"] },
  );

export type NetWorthQuery = z.infer<typeof netWorthQuerySchema>;
