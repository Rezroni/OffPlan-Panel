import * as XLSX from "xlsx";
import crypto from "crypto";

export interface ParsedDeveloperOfferRow {
  unitNo: string; // Stored as string to preserve leading zeros e.g. "0102"
  floorNo: number | null;
  bedrooms: number | null; // 0=Studio, 1, 2, 3...
  unitType: string | null;
  view: string | null;
  suiteAreaSqft: number | null;
  balconyAreaSqft: number | null;
  totalAreaSqft: number;
  listPriceAed: number | null;
  discountAed: number | null;
  netPriceAed: number;
  paymentPlanPreset: string | null;
  availability: "available" | "reserved" | "sold" | "unknown";
  validationErrors?: string[];
}

export interface ColumnMappingConfig {
  unitNoCol: string;
  floorCol?: string;
  bedroomsCol?: string;
  typeCol?: string;
  viewCol?: string;
  suiteAreaCol?: string;
  balconyAreaCol?: string;
  totalAreaCol: string;
  listPriceCol?: string;
  discountCol?: string;
  netPriceCol: string;
  planCol?: string;
  availabilityCol?: string;
}

export interface ParseOfferFileResult {
  fileName: string;
  fileChecksum: string;
  fileSizeBytes: number;
  sheetNames: string[];
  selectedSheet: string;
  totalRowsFound: number;
  validUnits: ParsedDeveloperOfferRow[];
  invalidRows: Array<{
    rowNumber: number;
    rawData: Record<string, any>;
    errors: string[];
  }>;
  availableUnitsCount: number;
  priceRange: {
    minNetPriceAed: number;
    maxNetPriceAed: number;
    minPsfAed: number;
    maxPsfAed: number;
  };
}

/**
 * Normalizes bedroom values: "Studio" / "ST" -> 0, "1 BR" / "1 Bed" -> 1, etc.
 */
export function normalizeBedrooms(val: any): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().toLowerCase();
  if (s === "0" || s.includes("studio") || s === "st") return 0;
  const match = s.match(/(\d+)/);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Normalizes availability status: "Available" -> "available", "Sold" -> "sold", etc.
 */
export function normalizeAvailability(val: any): "available" | "reserved" | "sold" | "unknown" {
  if (!val) return "available";
  const s = String(val).trim().toLowerCase();
  if (s.includes("sold") || s === "s") return "sold";
  if (s.includes("book") || s.includes("res") || s.includes("hold")) return "reserved";
  if (s.includes("avail") || s === "a" || s === "open") return "available";
  return "unknown";
}

/**
 * Checks if an offer revision is fresh (received <= 48 hours ago per Section 10.2)
 */
export function checkOfferFreshness(receivedAtIso: string, asOfDate = new Date()): {
  isFresh: boolean;
  ageHours: number;
  warningNote?: string;
} {
  const recTime = new Date(receivedAtIso).getTime();
  const now = asOfDate.getTime();
  const diffHours = (now - recTime) / (1000 * 60 * 60);

  if (diffHours <= 48) {
    return { isFresh: true, ageHours: Math.round(diffHours) };
  }

  return {
    isFresh: false,
    ageHours: Math.round(diffHours),
    warningNote: `Offer pricing was received ${Math.round(diffHours / 24)} days ago (>48 hours). Per desk protocol, live verification with developer sales representative is required before final PDF advisory.`,
  };
}

/**
 * Parses developer Excel/CSV buffer safely without macro execution (Section 10.2)
 */
export function parseDeveloperOfferBuffer(
  buffer: Buffer,
  fileName: string,
  mapping?: Partial<ColumnMappingConfig>,
  sheetName?: string
): ParseOfferFileResult {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false });

  const sheetNames = workbook.SheetNames;
  const selectedSheet = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const worksheet = workbook.Sheets[selectedSheet];

  // Convert to JSON objects
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  // Auto-detect columns if mapping not explicitly provided
  const sample = rawRows[0] || {};
  const keys = Object.keys(sample);

  const findCol = (terms: string[]): string => {
    for (const term of terms) {
      const found = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(term));
      if (found) return found;
    }
    return "";
  };

  const colMap: ColumnMappingConfig = {
    unitNoCol: mapping?.unitNoCol || findCol(["unitno", "unit", "aptno", "apartment", "lot"]),
    floorCol: mapping?.floorCol || findCol(["floor", "level"]),
    bedroomsCol: mapping?.bedroomsCol || findCol(["bed", "br", "type", "layout"]),
    typeCol: mapping?.typeCol || findCol(["propertytype", "unittype", "category"]),
    viewCol: mapping?.viewCol || findCol(["view", "orientation", "facing"]),
    suiteAreaCol: mapping?.suiteAreaCol || findCol(["suitearea", "internal", "builtup"]),
    balconyAreaCol: mapping?.balconyAreaCol || findCol(["balcony", "terrace"]),
    totalAreaCol: mapping?.totalAreaCol || findCol(["totalarea", "area", "size", "sqft"]),
    listPriceCol: mapping?.listPriceCol || findCol(["originalprice", "listprice", "price"]),
    discountCol: mapping?.discountCol || findCol(["discount", "waiver"]),
    netPriceCol: mapping?.netPriceCol || findCol(["netprice", "finalprice", "sellingprice", "amount", "price"]),
    planCol: mapping?.planCol || findCol(["paymentplan", "plan", "terms"]),
    availabilityCol: mapping?.availabilityCol || findCol(["status", "availability"]),
  };

  const validUnits: ParsedDeveloperOfferRow[] = [];
  const invalidRows: ParseOfferFileResult["invalidRows"] = [];

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let minPsf = Infinity;
  let maxPsf = -Infinity;

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2; // header is row 1
    const errors: string[] = [];

    // Unit number must exist and be preserved as string (e.g. "0102")
    const rawUnit = colMap.unitNoCol ? String(row[colMap.unitNoCol] || "").trim() : `ROW-${rowNum}`;
    if (!rawUnit) {
      errors.push("Missing unit identifier");
    }

    // Total Area
    const rawArea = colMap.totalAreaCol ? parseFloat(String(row[colMap.totalAreaCol]).replace(/[^0-9.]/g, "")) : 0;
    if (isNaN(rawArea) || rawArea <= 0) {
      errors.push("Invalid or zero total area sqft");
    }

    // Net Price
    const rawNet = colMap.netPriceCol ? parseFloat(String(row[colMap.netPriceCol]).replace(/[^0-9.]/g, "")) : 0;
    if (isNaN(rawNet) || rawNet <= 0) {
      errors.push("Invalid or missing net price AED");
    }

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber: rowNum,
        rawData: row,
        errors,
      });
      return;
    }

    // Optional fields
    const floorNo = colMap.floorCol && row[colMap.floorCol] ? parseInt(String(row[colMap.floorCol]), 10) : null;
    const bedrooms = colMap.bedroomsCol ? normalizeBedrooms(row[colMap.bedroomsCol]) : null;
    const unitType = colMap.typeCol ? String(row[colMap.typeCol] || "").trim() || null : null;
    const view = colMap.viewCol ? String(row[colMap.viewCol] || "").trim() || null : null;
    const suiteArea = colMap.suiteAreaCol ? parseFloat(String(row[colMap.suiteAreaCol]).replace(/[^0-9.]/g, "")) || null : null;
    const balconyArea = colMap.balconyAreaCol ? parseFloat(String(row[colMap.balconyAreaCol]).replace(/[^0-9.]/g, "")) || null : null;
    const listPrice = colMap.listPriceCol ? parseFloat(String(row[colMap.listPriceCol]).replace(/[^0-9.]/g, "")) || rawNet : rawNet;
    const discount = colMap.discountCol ? parseFloat(String(row[colMap.discountCol]).replace(/[^0-9.]/g, "")) || 0 : 0;
    const plan = colMap.planCol ? String(row[colMap.planCol] || "").trim() || null : null;
    const availability = colMap.availabilityCol ? normalizeAvailability(row[colMap.availabilityCol]) : "available";

    const psf = rawArea > 0 ? rawNet / rawArea : 0;
    if (rawNet < minPrice) minPrice = rawNet;
    if (rawNet > maxPrice) maxPrice = rawNet;
    if (psf > 0 && psf < minPsf) minPsf = psf;
    if (psf > maxPsf) maxPsf = psf;

    validUnits.push({
      unitNo: rawUnit,
      floorNo: isNaN(floorNo as number) ? null : floorNo,
      bedrooms,
      unitType,
      view,
      suiteAreaSqft: suiteArea,
      balconyAreaSqft: balconyArea,
      totalAreaSqft: rawArea,
      listPriceAed: Math.round(listPrice),
      discountAed: Math.round(discount),
      netPriceAed: Math.round(rawNet),
      paymentPlanPreset: plan,
      availability,
    });
  });

  const availableCount = validUnits.filter((u) => u.availability === "available").length;

  return {
    fileName,
    fileChecksum: hash,
    fileSizeBytes: buffer.length,
    sheetNames,
    selectedSheet,
    totalRowsFound: rawRows.length,
    validUnits,
    invalidRows,
    availableUnitsCount: availableCount,
    priceRange: {
      minNetPriceAed: isFinite(minPrice) ? minPrice : 0,
      maxNetPriceAed: isFinite(maxPrice) ? maxPrice : 0,
      minPsfAed: isFinite(minPsf) ? Math.round(minPsf) : 0,
      maxPsfAed: isFinite(maxPsf) ? Math.round(maxPsf) : 0,
    },
  };
}
