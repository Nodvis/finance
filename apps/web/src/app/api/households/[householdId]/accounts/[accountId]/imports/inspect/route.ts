import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { handleImportRouteError } from "@/lib/statement-imports/error-handler";
import { inspectCsvFile } from "@/lib/statement-imports/service";
import {
  CSV_DELIMITERS,
  CSV_ENCODINGS,
  type CsvDelimiter,
  type CsvEncoding,
} from "@nodvis/finance-domain";

type RouteContext = {
  params: Promise<{ householdId: string; accountId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId, accountId } = await context.params;
    await requireHouseholdAccess(householdId);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "MULTIPART_PARSE_INVALID", code: "MULTIPART_PARSE_INVALID" },
        { status: 400 },
      );
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "IMPORT_FILE_INVALID", code: "IMPORT_FILE_INVALID" },
        { status: 400 },
      );
    }

    const rawEncoding = formData.get("encoding");
    const rawDelimiter = formData.get("delimiter");
    const encodingResult = rawEncoding ? z.enum(CSV_ENCODINGS).safeParse(rawEncoding) : null;
    const delimiterResult = rawDelimiter ? z.enum(CSV_DELIMITERS).safeParse(rawDelimiter) : null;
    if (encodingResult && !encodingResult.success) {
      return NextResponse.json({ error: "IMPORT_ENCODING_INVALID", code: "IMPORT_ENCODING_INVALID" }, { status: 400 });
    }
    if (delimiterResult && !delimiterResult.success) {
      return NextResponse.json({ error: "IMPORT_DELIMITER_INVALID", code: "IMPORT_DELIMITER_INVALID" }, { status: 400 });
    }
    const encoding = encodingResult?.success ? encodingResult.data as CsvEncoding : undefined;
    const delimiter = delimiterResult?.success ? delimiterResult.data as CsvDelimiter : undefined;

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    const result = await inspectCsvFile({
      householdId,
      accountId,
      fileBytes,
      ...(encoding ? { encoding } : {}),
      ...(delimiter ? { delimiter } : {}),
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleImportRouteError(error);
  }
}
