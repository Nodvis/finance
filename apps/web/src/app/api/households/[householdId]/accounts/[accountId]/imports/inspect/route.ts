import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { handleImportRouteError } from "@/lib/statement-imports/error-handler";
import { inspectCsvFile } from "@/lib/statement-imports/service";
import type { CsvDelimiter, CsvEncoding } from "@nodvis/finance-domain";

type RouteContext = {
  params: Promise<{ householdId: string; accountId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId, accountId } = await context.params;
    await requireHouseholdAccess(householdId);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const encoding = (formData.get("encoding") as CsvEncoding) || undefined;
    const delimiter = (formData.get("delimiter") as CsvDelimiter) || undefined;

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    const result = await inspectCsvFile({
      householdId,
      accountId,
      fileBytes,
      encoding,
      delimiter,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleImportRouteError(error);
  }
}
