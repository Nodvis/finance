import { z } from "zod";

import { calendarDateSchema } from "@/lib/obligations/schema";

export const forecastQuerySchema = z.object({
  horizon: z.enum(["7", "30"]).default("7"),
  asOf: calendarDateSchema.optional(),
});

export type ForecastQuery = z.infer<typeof forecastQuerySchema>;
