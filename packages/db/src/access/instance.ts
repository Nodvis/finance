import { eq } from "drizzle-orm";

import { getDb } from "../client";
import { instanceState } from "../schema/instance";

export async function isInstanceInitialized(): Promise<boolean> {
  const [state] = await getDb()
    .select({ initializedAt: instanceState.initializedAt })
    .from(instanceState)
    .where(eq(instanceState.id, 1))
    .limit(1);

  return state?.initializedAt !== null && state?.initializedAt !== undefined;
}

export class InstanceAlreadyInitializedError extends Error {
  constructor() {
    super("The Nodvis Finance instance has already been initialized");
    this.name = "InstanceAlreadyInitializedError";
  }
}