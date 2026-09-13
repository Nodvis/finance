import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { handleImportRouteError } from "@/lib/statement-imports/error-handler";
import { statementImportMappingConfigSchema } from "@/lib/statement-imports/schema";
import {
  ImportMappingValidationError,
  parseAndPreviewStatementImport,
} from "@/lib/statement-imports/service";

type RouteContext = {
  params: Promise<{ householdId: string; accountId: string }>;
};

function validationError(code: "IMPORT_FILE_INVALID" | "IMPORT_MAPPING_INVALID") {
  return NextResponse.json({ error: code, code }, { status: 400 });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId, accountId } = await context.params;
    const authContext = await requireHouseholdAccess(householdId);

    const contentType = request.headers.get("content-type") || "";

    let filename = "statement.csv";
    let fileBytes: Uint8Array;
    let mappingRaw: unknown;
    let autoCommitSafe = false;
    let requestedLocale: string | null = null;

    if (contentType.includes("multipart/form-data")) {
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
        return validationError("IMPORT_FILE_INVALID");
      }
      filename = file.name || "statement.csv";
      const arrayBuffer = await file.arrayBuffer();
      fileBytes = new Uint8Array(arrayBuffer);

      const mappingStr = formData.get("mappingConfig");
      if (!mappingStr || typeof mappingStr !== "string") {
        return validationError("IMPORT_MAPPING_INVALID");
      }
      try {
        mappingRaw = JSON.parse(mappingStr);
      } catch {
        return NextResponse.json(
          { error: "IMPORT_MAPPING_INVALID", code: "IMPORT_MAPPING_INVALID" },
          { status: 400 },
        );
      }
      const autoVal = formData.get("autoCommitSafe") ?? formData.get("autoProcessSafe");
      if (autoVal === "true" || autoVal === "1") {
        autoCommitSafe = true;
      }
      const localeValue = formData.get("locale");
      if (typeof localeValue === "string") requestedLocale = localeValue;
    } else {
      let body: any;
      try {
        body = await request.json();
      } catch {
        throw new ImportMappingValidationError("Invalid JSON request body");
      }
      if (!body || typeof body !== "object") {
        return validationError("IMPORT_FILE_INVALID");
      }
      filename = body.filename || "statement.csv";
      if (body.fileBase64) {
        fileBytes = Uint8Array.from(Buffer.from(body.fileBase64, "base64"));
      } else if (body.fileText) {
        fileBytes = new TextEncoder().encode(body.fileText);
      } else {
        return validationError("IMPORT_FILE_INVALID");
      }
      mappingRaw = body.mappingConfig;
      if (body.autoCommitSafe === true || body.autoProcessSafe === true) {
        autoCommitSafe = true;
      }
      if (typeof body.locale === "string") requestedLocale = body.locale;
    }

    const mapping = statementImportMappingConfigSchema.parse(mappingRaw);

    const result = await parseAndPreviewStatementImport({
      context: authContext,
      accountId,
      sourceFilename: filename,
      fileBytes,
      mapping,
      autoCommitSafe,
      locale: requestedLocale?.toLowerCase().startsWith("pl")
        ? "pl-PL"
        : "en-US",
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleImportRouteError(error);
  }
}
