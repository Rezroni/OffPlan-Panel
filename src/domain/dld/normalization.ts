/**
 * DLD Ingestion Normalization & Validation Contract
 * 
 * Strict boundary rules:
 * 1. Exact observed DLD open data schema mapping.
 * 2. Null/unknown state preservation: missing values NEVER defaulted to assumed categories.
 * 3. Studio (0) strictly distinguished from unknown (null).
 * 4. Stable composite identity for all records; zero random UUID fallbacks.
 * 5. Canonical project identity uses DLD project_id ('proj_dld_<project_id>').
 * 6. project_number is resolved via verified crosswalk; unresolved records remain unmatched.
 * 7. Name normalization preserves Unicode (Arabic); duplicate candidates trigger review queue.
 * 8. Service cost billing unit is unassumed; annualChargePerSqft is not inferred without evidence.
 * 9. Multi-property rent contracts correctly flagged (no_of_prop > 1).
 */

import crypto from "crypto";

export const SQM_TO_SQFT = 10.7639104;

// ---------------------------------------------------------------------------
// RAW DLD INTERFACES (Observed from raw Open Data samples)
// ---------------------------------------------------------------------------

export interface RawDldTransaction {
  transaction_id?: string | null;
  procedure_id?: number | string | null;
  trans_group_id?: number | string | null;
  trans_group_ar?: string | null;
  trans_group_en?: string | null;
  procedure_name_ar?: string | null;
  procedure_name_en?: string | null;
  instance_date?: string | null;
  property_type_id?: number | string | null;
  property_type_ar?: string | null;
  property_type_en?: string | null;
  property_sub_type_id?: number | string | null;
  property_sub_type_ar?: string | null;
  property_sub_type_en?: string | null;
  property_usage_ar?: string | null;
  property_usage_en?: string | null;
  reg_type_id?: number | string | null;
  reg_type_ar?: string | null;
  reg_type_en?: string | null;
  area_id?: number | string | null;
  area_name_ar?: string | null;
  area_name_en?: string | null;
  building_name_ar?: string | null;
  building_name_en?: string | null;
  project_number?: number | string | null;
  project_name_ar?: string | null;
  project_name_en?: string | null;
  master_project_en?: string | null;
  master_project_ar?: string | null;
  rooms_ar?: string | null;
  rooms_en?: string | null;
  has_parking?: number | boolean | null;
  procedure_area?: number | string | null;
  actual_worth?: number | string | null;
  meter_sale_price?: number | string | null;
  rent_value?: number | string | null;
  meter_rent_price?: number | string | null;
  [key: string]: unknown;
}

export interface RawDldRentContract {
  contract_id?: string | null;
  line_number?: number | string | null;
  contract_reg_type_id?: number | string | null;
  contract_reg_type_ar?: string | null;
  contract_reg_type_en?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  contract_amount?: number | string | null;
  annual_amount?: number | string | null;
  no_of_prop?: number | string | null;
  actual_area?: number | string | null;
  property_usage_en?: string | null;
  property_usage_ar?: string | null;
  project_number?: number | string | null;
  project_name_ar?: string | null;
  project_name_en?: string | null;
  area_id?: number | string | null;
  area_name_ar?: string | null;
  area_name_en?: string | null;
  ejari_property_sub_type_en?: string | null;
  ejari_property_type_en?: string | null;
  [key: string]: unknown;
}

export interface RawDldServiceCharge {
  project_id?: number | string | null;
  project_name?: string | null;
  property_group_id?: number | string | null;
  property_group_name_en?: string | null;
  master_community_id?: number | string | null;
  master_community_name_en?: string | null;
  budget_year?: number | string | null;
  service_cost?: number | string | null;
  service_category_id?: number | string | null;
  service_category_name_en?: string | null;
  usage_id?: number | string | null;
  usage_name_en?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// NORMALIZED TARGET FACT INTERFACES
// ---------------------------------------------------------------------------

export interface NormalizedTransactionFact {
  id: string;
  transactionNo: string | null;
  transactionDate: string;
  registrationDate: string | null;
  areaNameEn: string | null;
  buildingNameEn: string | null;
  projectNameEn: string | null;
  dldProjectId: string | null;
  unitNo: string | null;
  bedrooms: number | null;
  areaSqm: number | null;
  areaSqft: number | null;
  transactionValueAed: number | null;
  pricePerSqftAed: number | null;
  transactionType: string | null;
  propertyType: string | null;
  propertySubtype: string | null;
  isOffPlan: boolean | null;
  isResidential: boolean | null;
  isApartmentEligible: boolean | null;
  isExcluded: boolean;
  exclusionReason: string | null;
  matchedProjectId: string | null;
  matchedBuildingId: string | null;
  matchConfidence: "confirmed" | "auto" | "unmatched" | "needs_review";
  rawChecksum: string;
  needsReviewCandidates?: string[];
}

export interface NormalizedRentContractFact {
  id: string;
  contractDate: string;
  startDate: string | null;
  endDate: string | null;
  contractType: "new" | "renew" | null;
  areaNameEn: string | null;
  buildingNameEn: string | null;
  unitNo: string | null;
  bedrooms: number | null;
  areaSqm: number | null;
  areaSqft: number | null;
  annualRentAed: number | null;
  propertyUsage: string | null;
  isResidential: boolean | null;
  isApartmentEligible: boolean | null;
  isMultiProperty: boolean | null;
  isExcluded: boolean;
  exclusionReason: string | null;
  matchedProjectId: string | null;
  matchConfidence: "confirmed" | "auto" | "unmatched" | "needs_review";
  rawChecksum: string;
}

export interface NormalizedServiceChargeFact {
  id: string;
  year: number;
  buildingNameEn: string | null;
  areaNameEn: string | null;
  annualChargePerSqft: number | null;
  annualChargePerSqm: number | null;
  chargeCategory: string | null;
  matchedProjectId: string | null;
  matchedBuildingId: string | null;
  rawServiceCost: number;
  rawServiceCostUnit: string;
  rawChecksum: string;
}

export interface QuarantineRecord {
  recordType: "transaction" | "rent_contract" | "service_charge";
  sourceRecordId?: string | null;
  rejectionReason: string;
  rawPayload: Record<string, unknown>;
}

export interface ProjectCrosswalk {
  /** Map DLD project_number -> DLD project_id (e.g. "3382" -> "678813961") */
  projectNumberToProjectId: Map<string, string>;
  /** Set of project primary keys materialized in SQLite (e.g. "proj_dld_678813961") */
  materializedProjectIds: Set<string>;
  /** Set of valid DLD project IDs in the official registry */
  registryProjectIds: Set<string>;
  /** Alias/fallback for backwards compatibility */
  canonicalProjectIds: Set<string>;
  /** Map normalized project name -> array of candidate project_ids */
  nameToProjectIds: Map<string, string[]>;
}

// ---------------------------------------------------------------------------
// PARSERS & HELPERS
// ---------------------------------------------------------------------------

/**
 * Parse bedrooms strictly distinguishing 0 (Studio) from null (Unknown).
 * Uses exact word boundaries to avoid substring false positives (e.g., 10 matching 1).
 */
export function parseBedrooms(roomsEn: unknown, roomsAr?: unknown): number | null {
  for (const raw of [roomsEn, roomsAr]) {
    if (raw === null || raw === undefined) continue;
    const s = String(raw).trim().toLowerCase();
    if (!s || s === "na" || s === "none" || s === "null" || s === "غير معرف") continue;

    // Studio check: must return numeric 0
    if (s === "studio" || s === "0" || s === "0 br" || s === "0 b/r" || s.includes("استوديو")) {
      return 0;
    }

    // Exact number extraction
    const m = s.match(/\b(\d+)\b/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 0 && n <= 20) return n;
    }

    // Arabic words
    if (s.includes("غرفتان") || s.includes("غرفتين")) return 2;
    if (s.includes("غرفة")) return 1;
    if (s.includes("ثلاث")) return 3;
    if (s.includes("اربع") || s.includes("أربع")) return 4;
    if (s.includes("خمس")) return 5;
    if (s.includes("ست")) return 6;
  }
  return null; // Unknown: NEVER 0
}

/**
 * Normalizes project names while strictly retaining Unicode letters (including Arabic).
 * Prevents collapsing distinct Arabic names into lone numbers or empty strings.
 */
export function normalizeProjectName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Classify transaction: off-plan vs ready, residential vs non-residential,
 * apartment-eligible vs non-apartment, exclusions.
 * Preserves null when source data is absent/unknown; never forces defaults.
 */
export function classifyTransaction(row: RawDldTransaction): {
  isOffPlan: boolean | null;
  isResidential: boolean | null;
  isApartmentEligible: boolean | null;
  isExcluded: boolean;
  exclusionReason: string | null;
} {
  const transGroup = String(row.trans_group_en || "").toLowerCase();
  const procName = String(row.procedure_name_en || "").toLowerCase();
  const regType = String(row.reg_type_en || "").toLowerCase();
  const propType = String(row.property_type_en || "").toLowerCase();
  const propSubtype = String(row.property_sub_type_en || "").toLowerCase();
  const propUsage = String(row.property_usage_en || "").toLowerCase();

  // Exclude non-sale transactions
  const nonSaleKeywords = ["mortgage", "gift", "inheritance", "whole building", "bulk"];
  for (const kw of nonSaleKeywords) {
    if (transGroup.includes(kw) || procName.includes(kw)) {
      return {
        isOffPlan: null,
        isResidential: null,
        isApartmentEligible: false,
        isExcluded: true,
        exclusionReason: `non_sale:${kw}`,
      };
    }
  }

  // Exclude land and pure commercial
  if (propType.includes("land") || propSubtype.includes("land")) {
    return {
      isOffPlan: null,
      isResidential: false,
      isApartmentEligible: false,
      isExcluded: true,
      exclusionReason: "land",
    };
  }

  if (propUsage.includes("commercial") || propUsage.includes("industrial")) {
    return {
      isOffPlan: null,
      isResidential: false,
      isApartmentEligible: false,
      isExcluded: true,
      exclusionReason: "commercial_usage",
    };
  }

  // Classify Off-Plan vs Ready
  let isOffPlan: boolean | null = null;
  if (regType.includes("off-plan") || regType.includes("off plan") || procName.includes("pre registration")) {
    isOffPlan = true;
  } else if (regType.includes("existing") || regType.includes("ready") || procName === "sell") {
    isOffPlan = false;
  }

  // Classify Residential (honest source fact: villas ARE residential)
  let isResidential: boolean | null = null;
  if (propUsage === "residential") {
    isResidential = true;
  } else if (propSubtype) {
    const resSubtypes = ["apartment", "flat", "studio", "penthouse", "duplex", "hotel apartment", "villa", "townhouse"];
    if (resSubtypes.some((st) => propSubtype.includes(st))) {
      isResidential = true;
    } else if (["office", "shop", "retail", "warehouse"].some((st) => propSubtype.includes(st))) {
      isResidential = false;
    }
  }

  // Classify Apartment Eligible:
  // Strictly separates apartments from villas/townhouses/commercial to protect apartment metrics.
  let isApartmentEligible: boolean | null = null;
  const isVillaOrTownhouse =
    propType.includes("villa") ||
    propSubtype.includes("villa") ||
    propSubtype.includes("townhouse") ||
    propSubtype.includes("compound") ||
    propSubtype.includes("mansion");

  const isNonApartmentType =
    propType.includes("land") ||
    propSubtype.includes("land") ||
    propType.includes("building") ||
    propSubtype.includes("building") ||
    ["office", "shop", "retail", "warehouse", "hotel room", "workshop", "showroom", "show rooms", "clinic", "gym"].some(
      (st) => propSubtype.includes(st)
    );

  if (isVillaOrTownhouse || isNonApartmentType) {
    isApartmentEligible = false;
  } else if (isResidential === true) {
    const aptSubtypes = ["flat", "apartment", "studio", "penthouse", "duplex", "loft", "hotel apartment"];
    if (aptSubtypes.some((st) => propSubtype.includes(st))) {
      isApartmentEligible = true;
    } else if (!propSubtype && propType === "unit") {
      isApartmentEligible = null;
    } else if (propSubtype) {
      isApartmentEligible = false;
    }
  } else if (isResidential === false) {
    isApartmentEligible = false;
  }

  return {
    isOffPlan,
    isResidential,
    isApartmentEligible,
    isExcluded: false,
    exclusionReason: null,
  };
}

/**
 * Computes deterministic SHA-256 checksum for audit and change detection.
 */
export function calculatePayloadChecksum(payload: unknown): string {
  const replacer = (_key: string, value: unknown) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload, replacer)).digest("hex");
}

export function parseRequiredIsoDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object" && value !== null) {
    if ("days" in value && typeof (value as { days: number }).days === "number") {
      const d = new Date((value as { days: number }).days * 86400000);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    }
    if ("micros" in value && typeof (value as { micros: bigint | number }).micros !== "undefined") {
      const ms = Number(BigInt((value as any).micros) / 1000n);
      const d = new Date(ms);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    }
  }

  const date = String(value).trim();
  if (!date) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
    const datePart = date.slice(0, 10);
    const parsed = new Date(`${datePart}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== datePart ? null : datePart;
  }

  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function parseOptionalIsoDate(value: unknown): string | null {
  if (!hasProvidedValue(value)) return null;
  return parseRequiredIsoDate(value);
}

function hasProvidedValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function parseOptionalFiniteNumber(value: unknown): number | null {
  if (!hasProvidedValue(value)) return null;
  if (typeof value === "bigint") {
    if (value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(value);
    }
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalWholeNumber(value: unknown): number | null {
  if (!hasProvidedValue(value)) return null;
  if (typeof value === "bigint") {
    if (value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(value);
    }
    return null;
  }
  const parsed = parseOptionalFiniteNumber(value);
  return parsed !== null && Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Monetary AED precision policy:
 * DLD reports monetary amounts in AED, which may include up to 2 decimal places (fils: 1 AED = 100 fils).
 * Amounts are normalized to 2 decimal places using Math.round(val * 100) / 100 to eliminate binary
 * float representation noise while preserving valid decimal amounts without truncation or float loss.
 * Rejects negative numbers or non-finite values.
 */
export function parseOptionalAedAmount(value: unknown): number | null {
  const parsed = parseOptionalFiniteNumber(value);
  if (parsed === null || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

export function isProjectMaterialized(crosswalk: ProjectCrosswalk | undefined, canonicalPk: string): boolean {
  if (!crosswalk) return false;
  const set = crosswalk.materializedProjectIds ?? crosswalk.canonicalProjectIds;
  return set ? set.has(canonicalPk) : false;
}

// ---------------------------------------------------------------------------
// NORMALIZATION TRANSFORMATION FUNCTIONS
// ---------------------------------------------------------------------------

export type TransactionNormalizationResult =
  | { success: true; fact: NormalizedTransactionFact }
  | { success: false; quarantine: QuarantineRecord };

export function normalizeTransaction(
  row: RawDldTransaction,
  crosswalk?: ProjectCrosswalk
): TransactionNormalizationResult {
  const txId = row.transaction_id ? String(row.transaction_id).trim() : null;
  if (!txId) {
    return {
      success: false,
      quarantine: {
        recordType: "transaction",
        rejectionReason: "missing_transaction_id",
        rawPayload: row as Record<string, unknown>,
      },
    };
  }

  const instanceDate = parseRequiredIsoDate(row.instance_date);
  if (!instanceDate) {
    return {
      success: false,
      quarantine: {
        recordType: "transaction",
        sourceRecordId: txId,
        rejectionReason: "missing_or_invalid_instance_date",
        rawPayload: row as Record<string, unknown>,
      },
    };
  }

  const classification = classifyTransaction(row);

  const areaSqm = parseOptionalFiniteNumber(row.procedure_area);
  const actualWorth = parseOptionalAedAmount(row.actual_worth);
  if ((hasProvidedValue(row.procedure_area) && areaSqm === null) ||
      (hasProvidedValue(row.actual_worth) && actualWorth === null)) {
    return {
      success: false,
      quarantine: {
        recordType: "transaction",
        sourceRecordId: txId,
        rejectionReason: "invalid_transaction_numeric_value",
        rawPayload: row as Record<string, unknown>,
      },
    };
  }
  const areaSqft = areaSqm && areaSqm > 0 ? areaSqm * SQM_TO_SQFT : null;

  const pricePerSqftAed = areaSqft && areaSqft > 0 && actualWorth && actualWorth > 0
    ? actualWorth / areaSqft
    : null;

  let isExcluded = classification.isExcluded;
  let exclusionReason = classification.exclusionReason;

  if (!isExcluded) {
    if (actualWorth === null || actualWorth <= 0 || areaSqm === null || areaSqm <= 0) {
      isExcluded = true;
      exclusionReason = "missing_or_non_positive_price_or_area";
    }
  }

  // Project linking: never assign an unavailable database project ID
  let matchedProjectId: string | null = null;
  let matchConfidence: "confirmed" | "auto" | "unmatched" | "needs_review" = "unmatched";
  let dldProjectId: string | null = null;
  let needsReviewCandidates: string[] | undefined = undefined;

  const rawProjectNum = row.project_number !== null && row.project_number !== undefined
    ? String(row.project_number).split(".")[0].trim()
    : null;

  if (crosswalk) {
    if (rawProjectNum && crosswalk.projectNumberToProjectId.has(rawProjectNum)) {
      const canonicalPid = crosswalk.projectNumberToProjectId.get(rawProjectNum)!;
      const canonicalPk = `proj_dld_${canonicalPid}`;
      dldProjectId = canonicalPid;
      if (isProjectMaterialized(crosswalk, canonicalPk)) {
        matchedProjectId = canonicalPk;
        matchConfidence = "auto";
      } else {
        matchedProjectId = null;
        matchConfidence = "unmatched";
      }
    }

    if (!matchedProjectId) {
      // Name-only fallback check
      const rawName = row.project_name_en || row.project_name_ar;
      if (rawName) {
        const normName = normalizeProjectName(rawName);
        const candidates = crosswalk.nameToProjectIds.get(normName);
        if (candidates && candidates.length === 1) {
          // Single match by name only: route to review, do NOT auto-confirm
          matchConfidence = "needs_review";
          needsReviewCandidates = [candidates[0]];
        } else if (candidates && candidates.length > 1) {
          // Ambiguous: multiple candidates share this name
          matchConfidence = "needs_review";
          needsReviewCandidates = candidates;
        }
      }
    }
  }

  const bedrooms = parseBedrooms(row.rooms_en, row.rooms_ar);

  const fact: NormalizedTransactionFact = {
    id: txId,
    transactionNo: txId,
    transactionDate: instanceDate,
    registrationDate: instanceDate,
    areaNameEn: row.area_name_en ? String(row.area_name_en).trim() : null,
    buildingNameEn: row.building_name_en ? String(row.building_name_en).trim() : null,
    projectNameEn: row.project_name_en ? String(row.project_name_en).trim() : null,
    dldProjectId,
    unitNo: null,
    bedrooms,
    areaSqm,
    areaSqft,
    transactionValueAed: actualWorth,
    pricePerSqftAed,
    transactionType: row.procedure_name_en ? String(row.procedure_name_en).trim() : null,
    propertyType: row.property_type_en ? String(row.property_type_en).trim() : null,
    propertySubtype: row.property_sub_type_en ? String(row.property_sub_type_en).trim() : null,
    isOffPlan: classification.isOffPlan,
    isResidential: classification.isResidential,
    isApartmentEligible: classification.isApartmentEligible,
    isExcluded,
    exclusionReason,
    matchedProjectId,
    matchedBuildingId: null,
    matchConfidence,
    rawChecksum: calculatePayloadChecksum(row),
    needsReviewCandidates,
  };

  return { success: true, fact };
}

export type RentNormalizationResult =
  | { success: true; fact: NormalizedRentContractFact }
  | { success: false; quarantine: QuarantineRecord };

export function normalizeRentContract(
  row: RawDldRentContract,
  crosswalk?: ProjectCrosswalk
): RentNormalizationResult {
  const contractId = row.contract_id ? String(row.contract_id).trim() : null;
  if (!contractId) {
    return {
      success: false,
      quarantine: {
        recordType: "rent_contract",
        rejectionReason: "missing_contract_id",
        rawPayload: row as Record<string, unknown>,
      },
    };
  }

  // Composite identity strictly requires line_number: contract_id + line_number
  const lineNo =
    row.line_number !== null && row.line_number !== undefined && String(row.line_number).trim() !== ""
      ? String(row.line_number).trim()
      : null;
  if (!lineNo) {
    return {
      success: false,
      quarantine: {
        recordType: "rent_contract",
        sourceRecordId: contractId,
        rejectionReason: "missing_line_number",
        rawPayload: row as Record<string, unknown>,
      },
    };
  }
  const stableId = `${contractId}_${lineNo}`;

  const contractStartDate = parseRequiredIsoDate(row.contract_start_date);
  if (!contractStartDate) {
    return {
      success: false,
      quarantine: {
        recordType: "rent_contract",
        sourceRecordId: stableId,
        rejectionReason: "missing_or_invalid_contract_start_date",
        rawPayload: row as Record<string, unknown>,
      },
    };
  }

  const areaSqm = parseOptionalFiniteNumber(row.actual_area);
  const annualRentSource = hasProvidedValue(row.annual_amount) ? row.annual_amount : row.contract_amount;
  const annualRent = parseOptionalAedAmount(annualRentSource);
  if ((hasProvidedValue(row.actual_area) && areaSqm === null) ||
      (hasProvidedValue(annualRentSource) && annualRent === null)) {
    return {
      success: false,
      quarantine: {
        recordType: "rent_contract",
        sourceRecordId: contractId,
        rejectionReason: "invalid_rent_numeric_value",
        rawPayload: row as Record<string, unknown>,
      },
    };
  }
  const areaSqft = areaSqm && areaSqm > 0 ? areaSqm * SQM_TO_SQFT : null;

  // Multi-property check
  let isMultiProperty: boolean | null = null;
  const propertyCount = parseOptionalWholeNumber(row.no_of_prop);
  if (propertyCount !== null) {
    isMultiProperty = propertyCount > 1;
  }

  // Contract type: preserve null if unrecognized
  let contractType: "new" | "renew" | null = null;
  const regType = String(row.contract_reg_type_en || "").toLowerCase();
  if (regType.includes("renew")) {
    contractType = "renew";
  } else if (regType.includes("new")) {
    contractType = "new";
  }

  // Rent classification
  const rawUsage = row.property_usage_en ? String(row.property_usage_en).trim() : null;
  const propUsage = rawUsage ? rawUsage.toLowerCase() : "";
  const propType = String(row.ejari_property_type_en || "").toLowerCase();
  const propSubtype = String(row.ejari_property_sub_type_en || "").toLowerCase();

  let isResidential: boolean | null = null;
  if (propUsage === "residential") {
    isResidential = true;
  } else if (propUsage.includes("commercial") || propUsage.includes("industrial")) {
    isResidential = false;
  } else if (["office", "shop", "warehouse", "labor camp"].some((t) => propType.includes(t) || propSubtype.includes(t))) {
    isResidential = false;
  } else if (["flat", "apartment", "studio"].some((t) => propType.includes(t) || propSubtype.includes(t))) {
    isResidential = true;
  }

  let isApartmentEligible: boolean | null = null;
  if (propType.includes("villa") || propSubtype.includes("villa") || propType.includes("labor camp") || propSubtype.includes("labor camp")) {
    isApartmentEligible = false;
  } else if (isResidential === true) {
    if (["flat", "studio", "apartment", "penthouse", "duplex"].some((t) => propType.includes(t) || propSubtype.includes(t))) {
      isApartmentEligible = true;
    } else {
      isApartmentEligible = false;
    }
  } else if (isResidential === false) {
    isApartmentEligible = false;
  }

  let isExcluded = false;
  let exclusionReason: string | null = null;

  if (annualRent === null || annualRent <= 0) {
    isExcluded = true;
    exclusionReason = "zero_or_null_rent";
  }

  // Project linking: never assign an unavailable database project ID
  let matchedProjectId: string | null = null;
  let matchConfidence: "confirmed" | "auto" | "unmatched" | "needs_review" = "unmatched";

  const rawProjectNum = row.project_number !== null && row.project_number !== undefined
    ? String(row.project_number).split(".")[0].trim()
    : null;

  if (crosswalk && rawProjectNum) {
    if (crosswalk.projectNumberToProjectId.has(rawProjectNum)) {
      const canonicalPid = crosswalk.projectNumberToProjectId.get(rawProjectNum)!;
      const canonicalPk = `proj_dld_${canonicalPid}`;
      if (isProjectMaterialized(crosswalk, canonicalPk)) {
        matchedProjectId = canonicalPk;
        matchConfidence = "auto";
      } else {
        matchedProjectId = null;
        matchConfidence = "unmatched";
      }
    }
  }

  const bedrooms = parseBedrooms(row.ejari_property_sub_type_en);

  const fact: NormalizedRentContractFact = {
    id: stableId,
    contractDate: contractStartDate,
    startDate: contractStartDate,
    endDate: parseOptionalIsoDate(row.contract_end_date),
    contractType,
    areaNameEn: row.area_name_en ? String(row.area_name_en).trim() : null,
    buildingNameEn: row.project_name_en ? String(row.project_name_en).trim() : null,
    unitNo: null,
    bedrooms,
    areaSqm,
    areaSqft,
    annualRentAed: annualRent,
    propertyUsage: rawUsage,
    isResidential,
    isApartmentEligible,
    isMultiProperty,
    isExcluded,
    exclusionReason,
    matchedProjectId,
    matchConfidence,
    rawChecksum: calculatePayloadChecksum(row),
  };

  return { success: true, fact };
}

export type ServiceChargeNormalizationResult =
  | { success: true; fact: NormalizedServiceChargeFact }
  | { success: false; quarantine: QuarantineRecord };

export function normalizeServiceCharge(
  row: RawDldServiceCharge,
  crosswalk?: ProjectCrosswalk
): ServiceChargeNormalizationResult {
  const propertyGroupNumber = parseOptionalWholeNumber(row.property_group_id);
  const budgetYear = parseOptionalWholeNumber(row.budget_year);
  const usageNumber = parseOptionalWholeNumber(row.usage_id);
  const categoryNumber = parseOptionalWholeNumber(row.service_category_id);
  const propGroupId = propertyGroupNumber === null ? null : String(propertyGroupNumber);
  const usageId = usageNumber === null ? null : String(usageNumber);
  const categoryId = categoryNumber === null ? null : String(categoryNumber);

  // Composite key validation
  if (!propGroupId || !budgetYear || isNaN(budgetYear) || !usageId || !categoryId) {
    return {
      success: false,
      quarantine: {
        recordType: "service_charge",
        rejectionReason: "missing_composite_key",
        rawPayload: row as Record<string, unknown>,
      },
    };
  }

  const rawCost = parseOptionalFiniteNumber(row.service_cost);

  if (rawCost === null || rawCost < 0) {
    return {
      success: false,
      quarantine: {
        recordType: "service_charge",
        rejectionReason: "invalid_service_cost",
        rawPayload: row as Record<string, unknown>,
      },
    };
  }

  const stableId = `sc_${propGroupId}_${budgetYear}_${usageId}_${categoryId}`;

  // Project ID in service charges is already the DLD project_id: never assign if not materialized in DB
  let matchedProjectId: string | null = null;
  const rawPid = row.project_id !== null && row.project_id !== undefined
    ? String(row.project_id).split(".")[0].trim()
    : null;

  if (rawPid) {
    const canonicalPk = `proj_dld_${rawPid}`;
    if (isProjectMaterialized(crosswalk, canonicalPk)) {
      matchedProjectId = canonicalPk;
    }
  }

  const fact: NormalizedServiceChargeFact = {
    id: stableId,
    year: budgetYear,
    buildingNameEn: row.property_group_name_en ? String(row.property_group_name_en).trim() : (row.project_name ? String(row.project_name).trim() : null),
    areaNameEn: row.master_community_name_en ? String(row.master_community_name_en).trim() : null,
    // Note: Do not assume service_cost is AED/sqft or AED/sqm. Preserve null for inferred units.
    annualChargePerSqft: null,
    annualChargePerSqm: null,
    chargeCategory: row.service_category_name_en ? String(row.service_category_name_en).trim() : null,
    matchedProjectId,
    matchedBuildingId: null,
    rawServiceCost: rawCost,
    rawServiceCostUnit: "unknown",
    rawChecksum: calculatePayloadChecksum(row),
  };

  return { success: true, fact };
}
