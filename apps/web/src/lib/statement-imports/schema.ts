import { z } from "zod";
import {
  AMOUNT_MAPPING_MODES,
  CSV_DELIMITERS,
  CURRENCY_MAPPING_MODES,
  SUPPORTED_DATE_FORMATS,
} from "@nodvis/finance-domain";

export const statementImportMappingConfigSchema = z.object({
  dateColumn: z.string().min(1),
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
  descriptionColumn: z.string().min(1),
  sourceRowIdentityColumn: z.string().optional(),
  delimiter: z.enum(CSV_DELIMITERS).default(","),
  hasHeader: z.boolean().default(true),
  headerRowIndex: z.number().int().min(0).default(0),
  skipLeadingRows: z.number().int().min(0).default(0),
});

export type StatementImportMappingConfigInput = z.infer<
  typeof statementImportMappingConfigSchema
>;

export const commitImportBatchSchema = z.object({
  selectedRowIndices: z.array(z.number().int().min(0)),
});

export type CommitImportBatchInput = z.infer<typeof commitImportBatchSchema>;
