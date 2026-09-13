import "server-only";
import { isPersonInHousehold, listBudgetsByHousehold, createBudgetInDb, archiveBudgetInDb, updateBudgetInDb } from "@nodvis/finance-db";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import type { z } from "zod";
import type { budgetQuerySchema, createBudgetSchema } from "./schema";
export class BudgetAccessDeniedError extends Error {}
async function auth(c: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">) { if (!(await isPersonInHousehold(c.householdId, c.personId))) throw new BudgetAccessDeniedError("Household access denied"); }
export async function listHouseholdBudgets(c: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">, q: z.infer<typeof budgetQuerySchema>) { await auth(c); return (await listBudgetsByHousehold(c.householdId, q.month, q.includeArchived)).map(serializeBudget); }
export async function createHouseholdBudget(c: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">, input: z.infer<typeof createBudgetSchema>) { await auth(c); return serializeBudget(await createBudgetInDb(c.householdId, { ...input, limitAmountMinor: BigInt(input.limitAmountMinor) })); }
export async function archiveHouseholdBudget(c: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">, id: string, version: number) { await auth(c); await archiveBudgetInDb(c.householdId, id, version); }
export async function updateHouseholdBudget(c: Pick<AuthorizedHouseholdUserContext, "householdId" | "personId">, id: string, input: {version:number; month?: string | undefined; limitAmountMinor?: string | undefined}) { await auth(c); const changes={...(input.month ? {month:input.month}:{}),...(input.limitAmountMinor ? {limitAmountMinor:BigInt(input.limitAmountMinor)}:{})}; return serializeBudget(await updateBudgetInDb(c.householdId,id,input.version,changes)); }
function serializeBudget(b: Awaited<ReturnType<typeof listBudgetsByHousehold>>[number]) { return { ...b, limitAmountMinor: b.limitAmountMinor.toString(), spentAmountMinor: b.spentAmountMinor.toString(), remainingAmountMinor: b.remainingAmountMinor.toString() }; }
