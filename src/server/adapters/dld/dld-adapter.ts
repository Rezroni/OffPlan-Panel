/**
 * DLD Pipeline Adapter — Phase 2
 * 
 * Reads processed data from the DLD PIPELINE DuckDB file and imports
 * it into our SQLite catalog database via Drizzle ORM.
 * 
 * Rules:
 * - Monetary values stored as integers (AED whole units)
 * - Area always normalized to sqft (1 sqm = 10.7639104 sqft)
 * - Studio bedrooms = 0, unknown = null
 * - Duplicate runs are idempotent (upsert by source key)
 * - Exclusion reasons recorded — never silently dropped
 */

import { db } from "@/server/db";
import {
  ingestionRuns,
  transactionFacts,
  rentContractFacts,
  serviceChargeFacts,
  sourceConnections,
  dataHealthChecks,
} from "@db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const SQM_TO_SQFT = 10.7639104;
const DLD_SOURCE_ID = "dld_pipeline_duckdb";

// ---------------------------------------------------------------------------
// Bootstrap source connection record if it doesn't exist
// ---------------------------------------------------------------------------

export async function ensureDldSourceConnection() {
  const existing = await db
    .select()
    .from(sourceConnections)
    .where(eq(sourceConnections.id, DLD_SOURCE_ID))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(sourceConnections).values({
      id: DLD_SOURCE_ID,
      name: "DLD Pipeline (DuckDB)",
      type: "dld_open_api",
      baseUrl: null,
      isActive: true,
      termsNotes:
        "Dubai Open Data — public DLD datasets. " +
        "Transactions: dld_transactions-open. " +
        "Rents: dld_rent_contracts-open. " +
        "Service charges: dld_oa_service_charges-open. " +
        "Commercial use restrictions apply per DLD terms.",
    });
  }
}

// ---------------------------------------------------------------------------
// Helper: parse bedrooms from raw DLD string/number
// Studio → 0, unknown → null
// ---------------------------------------------------------------------------

export function parseBedrooms(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).toLowerCase().trim();
  if (str === "studio" || str === "0" || str === "0 br") return 0;
  const n = parseInt(str, 10);
  if (!isNaN(n) && n >= 0 && n <= 20) return n;
  return null; // Unknown — NOT 0
}

// ---------------------------------------------------------------------------
// Helper: determine if a DLD transaction is residential apartment
// ---------------------------------------------------------------------------

export function classifyTransaction(row: Record<string, unknown>): {
  isOffPlan: boolean | null;
  isResidential: boolean | null;
  isExcluded: boolean;
  exclusionReason: string | null;
} {
  const type = String(row.trans_type_en || row.transaction_type_en || "").toLowerCase();
  const propType = String(row.prop_type_en || row.property_type_en || "").toLowerCase();
  const propSubtype = String(row.prop_sub_type_en || row.property_subtype_en || "").toLowerCase();

  // Exclude non-sale transaction types
  const nonSaleTypes = ["mortgage", "gift", "inheritance", "whole building", "bulk"];
  for (const t of nonSaleTypes) {
    if (type.includes(t)) {
      return { isOffPlan: null, isResidential: null, isExcluded: true, exclusionReason: `non_sale_type:${type}` };
    }
  }

  // Exclude land and commercial
  if (propType.includes("land") || propType.includes("villa land")) {
    return { isOffPlan: null, isResidential: false, isExcluded: true, exclusionReason: "land" };
  }
  if (propSubtype.includes("hotel apartment") === false && propType.includes("hotel")) {
    return { isOffPlan: null, isResidential: false, isExcluded: true, exclusionReason: "hotel_non_apartment" };
  }

  // Classify off-plan vs ready
  let isOffPlan: boolean | null = null;
  if (type.includes("off plan") || type.includes("off-plan")) {
    isOffPlan = true;
  } else if (type.includes("ready") || type.includes("secondary")) {
    isOffPlan = false;
  }

  // Residential check
  const residentialSubtypes = ["apartment", "flat", "studio", "penthouse", "duplex", "hotel apartment"];
  const isResidential = residentialSubtypes.some((s) => propSubtype.includes(s)) ? true : null;

  return { isOffPlan, isResidential, isExcluded: false, exclusionReason: null };
}

// ---------------------------------------------------------------------------
// Import transactions from DLD PIPELINE output JSON/array
// ---------------------------------------------------------------------------

export type DldTransactionRow = Record<string, unknown>;

export async function importDldTransactions(
  rows: DldTransactionRow[],
  runId: string
): Promise<{ inserted: number; skipped: number; excluded: number }> {
  let inserted = 0;
  let skipped = 0;
  let excluded = 0;

  // Process in batches of 500 to avoid SQLite statement size limits
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map((row) => {
      const classification = classifyTransaction(row);
      const areaSqm = parseFloat(String(row.area_sqm || row.actual_area || 0)) || null;
      const areaSqft = areaSqm ? areaSqm * SQM_TO_SQFT : null;
      const txValue = parseInt(String(row.trans_value || row.transaction_value_aed || 0), 10) || null;
      const pricePerSqft = areaSqft && txValue ? txValue / areaSqft : null;

      if (classification.isExcluded) excluded++;

      return {
        id: String(row.transaction_id || row.trans_id || `tx_${i}_${crypto.randomUUID()}`),
        sourceRunId: runId,
        transactionNo: String(row.trans_no || row.transaction_no || ""),
        transactionDate: String(row.trans_date || row.transaction_date || ""),
        registrationDate: String(row.reg_date || row.registration_date || "") || null,
        areaNameEn: String(row.area_name_en || "") || null,
        buildingNameEn: String(row.building_name_en || row.building_name || "") || null,
        projectNameEn: String(row.project_name_en || row.project_name || "") || null,
        dldProjectId: String(row.project_id || row.dld_project_id || "") || null,
        unitNo: String(row.unit_no || row.unit_number || "") || null,
        bedrooms: parseBedrooms(row.rooms || row.bedrooms || row.no_of_bedrooms),
        areaSqm,
        areaSqft,
        transactionValueAed: txValue,
        pricePerSqftAed: pricePerSqft,
        transactionType: String(row.trans_type_en || row.transaction_type_en || "") || null,
        propertyType: String(row.prop_type_en || row.property_type_en || "") || null,
        propertySubtype: String(row.prop_sub_type_en || row.property_subtype_en || "") || null,
        isOffPlan: classification.isOffPlan,
        isResidential: classification.isResidential,
        isExcluded: classification.isExcluded,
        exclusionReason: classification.exclusionReason,
        matchedProjectId: null,
        matchedBuildingId: null,
        matchConfidence: "unmatched",
      };
    });

    // Upsert — duplicate runs don't create duplicates
    await db
      .insert(transactionFacts)
      .values(values)
      .onConflictDoNothing();

    inserted += values.filter((v) => !v.isExcluded).length;
    skipped += 0; // tracked by onConflictDoNothing result in real impl
  }

  return { inserted, skipped, excluded };
}

// ---------------------------------------------------------------------------
// Import rent contracts from DLD PIPELINE output
// ---------------------------------------------------------------------------

export type DldRentRow = Record<string, unknown>;

export async function importDldRentContracts(
  rows: DldRentRow[],
  runId: string
): Promise<{ inserted: number; excluded: number }> {
  let inserted = 0;
  let excluded = 0;

  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map((row) => {
      const areaSqm = parseFloat(String(row.area_sqm || row.actual_area || 0)) || null;
      const areaSqft = areaSqm ? areaSqm * SQM_TO_SQFT : null;
      const annualRent = parseInt(String(row.annual_amount || row.annual_rent_aed || 0), 10) || null;

      // Multi-property contracts: flag but don't exclude — exclude from per-unit metrics at query time
      const isMultiProperty =
        parseInt(String(row.no_of_properties || "1"), 10) > 1 ? true : false;

      let isExcluded = false;
      let exclusionReason: string | null = null;

      if (!annualRent || annualRent <= 0) {
        isExcluded = true;
        exclusionReason = "zero_or_null_rent";
        excluded++;
      }

      return {
        id: String(row.contract_id || row.ejari_id || `rent_${i}_${crypto.randomUUID()}`),
        sourceRunId: runId,
        contractDate: String(row.contract_date || row.ejari_date || ""),
        startDate: String(row.start_date || "") || null,
        endDate: String(row.end_date || "") || null,
        contractType: String(row.contract_type || row.is_new || "new").toLowerCase() === "new" ? "new" : "renew",
        areaNameEn: String(row.area_name_en || "") || null,
        buildingNameEn: String(row.building_name_en || "") || null,
        unitNo: String(row.unit_no || "") || null,
        bedrooms: parseBedrooms(row.rooms || row.bedrooms || row.no_of_rooms),
        areaSqm,
        areaSqft,
        annualRentAed: annualRent,
        isMultiProperty,
        isExcluded,
        exclusionReason,
        matchedProjectId: null,
        matchConfidence: "unmatched",
      };
    });

    await db.insert(rentContractFacts).values(values).onConflictDoNothing();
    inserted += values.filter((v) => !v.isExcluded).length;
  }

  return { inserted, excluded };
}

// ---------------------------------------------------------------------------
// Import service charges from DLD PIPELINE output
// ---------------------------------------------------------------------------

export type DldServiceChargeRow = Record<string, unknown>;

export async function importDldServiceCharges(
  rows: DldServiceChargeRow[],
  runId: string
): Promise<{ inserted: number }> {
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map((row) => ({
      id: String(row.id || `sc_${i}_${crypto.randomUUID()}`),
      sourceRunId: runId,
      year: parseInt(String(row.year || row.service_charge_year || new Date().getFullYear()), 10),
      buildingNameEn: String(row.building_name_en || row.building_name || "") || null,
      areaNameEn: String(row.area_name_en || "") || null,
      annualChargePerSqft: parseFloat(String(row.amount_per_sqft || row.charge_per_sqft || 0)) || null,
      annualChargePerSqm: parseFloat(String(row.amount_per_sqm || row.charge_per_sqm || 0)) || null,
      chargeCategory: String(row.charge_category || row.category || "") || null,
      matchedProjectId: null,
      matchedBuildingId: null,
    }));

    await db.insert(serviceChargeFacts).values(values).onConflictDoNothing();
    inserted += values.length;
  }

  return { inserted };
}

// ---------------------------------------------------------------------------
// Create an ingestion run record
// ---------------------------------------------------------------------------

export async function createIngestionRun(
  sourceId: string,
  filterParams: Record<string, unknown>
): Promise<string> {
  const runId = crypto.randomUUID();
  await db.insert(ingestionRuns).values({
    id: runId,
    sourceConnectionId: sourceId,
    status: "running",
    startedAt: new Date().toISOString(),
    filterParams: JSON.stringify(filterParams),
  });
  return runId;
}

export async function completeIngestionRun(
  runId: string,
  counts: { fetched: number; inserted: number; skipped: number },
  error?: string
) {
  await db
    .update(ingestionRuns)
    .set({
      status: error ? "failed" : "done",
      completedAt: new Date().toISOString(),
      recordsFetched: counts.fetched,
      recordsInserted: counts.inserted,
      recordsSkipped: counts.skipped,
      errorMessage: error ?? null,
    })
    .where(eq(ingestionRuns.id, runId));
}

// ---------------------------------------------------------------------------
// Data health check summary
// ---------------------------------------------------------------------------

export async function recordHealthCheck(
  sourceId: string,
  stats: {
    totalRecords: number;
    oldestRecord?: string;
    newestRecord?: string;
    status: "ok" | "stale" | "missing" | "schema_drift";
    notes?: string;
  }
) {
  await db.insert(dataHealthChecks).values({
    id: crypto.randomUUID(),
    sourceConnectionId: sourceId,
    totalRecords: stats.totalRecords,
    oldestRecord: stats.oldestRecord ?? null,
    newestRecord: stats.newestRecord ?? null,
    status: stats.status,
    coverageNotes: stats.notes ?? null,
  });
}
