import { NextResponse } from "next/server";
import { requireHouseholdAccess } from "@/lib/authorization/household";
import { handleImportRouteError } from "@/lib/statement-imports/error-handler";
import { statementImportMappingConfigSchema } from "@/lib/statement-imports/schema";
import { parseAndPreviewStatementImport } from "@/lib/statement-imports/service";

type RouteContext = {
  params: Promise<{ householdId: string; accountId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { householdId, accountId } = await context.params;
    const authContext = await requireHouseholdAccess(householdId);

    const contentType = request.headers.get("content-type") || "";

    let filename = "statement.csv";
    let fileBytes: Uint8Array;
    let mappingRaw: unknown;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }
      filename = file.name || "statement.csv";
      const arrayBuffer = await file.arrayBuffer();
      fileBytes = new Uint8Array(arrayBuffer);

      const mappingStr = formData.get("mappingConfig");
      if (!mappingStr || typeof mappingStr !== "string") {
        return NextResponse.json(
          { error: "mappingConfig is required" },
          { status: 400 },
        );
      }
      mappingRaw = JSON.parse(mappingStr);
    } else {
      const body = await request.json();
      if (!body) {
        return NextResponse.json({ error: "Empty request body" }, { status: 400 });
      }
      filename = body.filename || "statement.csv";
      if (body.fileBase64) {
        fileBytes = Uint8Array.from(Buffer.from(body.fileBase64, "base64"));
      } else if (body.fileText) {
        fileBytes = new TextEncoder().encode(body.fileText);
      } else {
        return NextResponse.json(
          { error: "fileBase64 or fileText is required" },
          { status: 400 },
        );
      }
      mappingRaw = body.mappingConfig;
    }

    const mapping = statementImportMappingConfigSchema.parse(mappingRaw);

    const result = await parseAndPreviewStatementImport({
      context: authContext,
      accountId,
      sourceFilename: filename,
      fileBytes,
      mapping,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleImportRouteError(error);
  }
}
