import { requireHouseholdAccess } from "@/lib/authorization/household";
import { listTransactionsQuerySchema } from "@/lib/transactions/schema";
import { exportManualTransactionsToCsv } from "@/lib/transactions/service";
import { handleRouteError } from "../route";

type RouteContext = {
  params: Promise<{ householdId: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { householdId } = await context.params;
    const access = await requireHouseholdAccess(householdId);

    const url = new URL(request.url);
    const queryParams: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryParams[key] = value;
    }

    const locale = queryParams.locale ?? "en";
    const parsedQuery = listTransactionsQuerySchema.parse(queryParams);
    const csvContent = await exportManualTransactionsToCsv(
      access,
      parsedQuery,
      locale,
    );

    const todayStr = new Date().toISOString().split("T")[0];
    const filename = `transactions-${todayStr}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
