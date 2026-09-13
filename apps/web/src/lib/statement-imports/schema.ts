import { z } from "zod";
import {
  AMOUNT_MAPPING_MODES,
  CSV_DELIMITERS,
  CURRENCY_MAPPING_MODES,
  SUPPORTED_DATE_FORMATS,
} from "@nodvis/finance-domain";

export const statementImportMappingConfigSchema = z.object({
  dateColumn: z.string().default(""),
  dateFallbackColumn: z.string().optional(),
  dateFormat: z.enum(SUPPORTED_DATE_FORMATS).default("auto"),
  timezone: z.string().default("UTC"),
  amountMode: z.enum(AMOUNT_MAPPING_MODES).default("signed"),
  amountColumn: z.string().optional(),
  invertAmount: z.boolean().default(false),
  debitColumn: z.string().optional(),
  creditColumn: z.string().optional(),
  currencyMode: z.enum(CURRENCY_MAPPING_MODES).default("account"),
  currencyColumn: z.string().optional(),
  fixedCurrency: z.string().optional(),
  descriptionColumn: z.string().default(""),
  sourceRowIdentityColumn: z.string().optional(),
  authoritativeIdColumn: z.string().optional(),
  sourceNamespace: z.string().optional(),
  sourceAccountId: z.string().optional(),
  sourceAccountIdColumn: z.string().optional(),
  delimiter: z.enum(CSV_DELIMITERS).default(","),
  hasHeader: z.boolean().default(true),
  headerRowIndex: z.number().int().min(0).default(0),
  skipLeadingRows: z.number().int().min(0).default(0),
  encoding: z.enum(["utf-8", "windows-1250", "iso-8859-2", "ascii"]).optional(),
  headerSignature: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

export type StatementImportMappingConfigInput = z.infer<
  typeof statementImportMappingConfigSchema
>;

export const commitImportBatchSchema = z
  .object({
    selectedRowIndices: z.array(z.number().int().min(0)).optional(),
    safeOnly: z.boolean().optional(),
  })
  .refine(
    (data) => data.safeOnly === true || (Array.isArray(data.selectedRowIndices) && data.selectedRowIndices.length > 0),
    {
      message: "Either safeOnly must be true or selectedRowIndices must contain at least one row",
    },
  );

export type CommitImportBatchInput = z.infer<typeof commitImportBatchSchema>;

export const createStatementImportProfileSchema = z.object({
  name: z.string().trim().min(1).max(160),
  mappingConfig: statementImportMappingConfigSchema,
  autoProcessSafe: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  accountId: z.string().uuid().nullable().optional(),
});

export type CreateStatementImportProfileInput = z.infer<
  typeof createStatementImportProfileSchema
>;

export const updateStatementImportProfileSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  mappingConfig: statementImportMappingConfigSchema.optional(),
  autoProcessSafe: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  accountId: z.string().uuid().nullable().optional(),
});

export type UpdateStatementImportProfileInput = z.infer<
  typeof updateStatementImportProfileSchema
>;
