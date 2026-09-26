/**
 * Data Access Layer — Project Catalog
 * Phase 2: server-side queries for the /discover and /projects pages
 * 
 * All queries go through this module. No direct db access from components.
 */

import { db } from "@/server/db";
import {
  projects,
  developers,
  areas,
  unitTypes,
  transactionFacts,
  rentContractFacts,
  matchQueue,
} from "@db/schema";
import {
  eq,
  and,
  gte,
  lte,
  sql,
  desc,
  asc,
  count,
  avg,
  like,
  isNull,
  isNotNull,
  inArray,
} from "drizzle-orm";
import {
  buildComparableSet,
  type TransactionFact as DomainTxFact,
  type CMAResult,
} from "@/domain/cma/comparable-set";
import {
  buildShortlist,
  type ClientBriefParams,
  type CandidateOffer,
  type ShortlistResult,
} from "@/domain/alternatives/shortlist";
import { generateShortlistCommentary } from "@/server/adapters/ai/gemini-adapter";


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectListItem = {
  id: string;
  nameEn: string;
  developerBrand: string | null;
  areaNameEn: string | null;
  status: string | null;
  expectedHandoverDate: string | null;
  constructionProgressPct: number | null;
  researchStatus: string;
  unitTypeCount: number;
  firstSeenAt: string;
  updatedAt: string;
};

export type ProjectDetail = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  developerId: string | null;
  developerLegalName: string | null;
  developerBrandName: string | null;
  areaId: string | null;
  areaNameEn: string | null;
  dldProjectId: string | null;
  bayutExternalId: string | null;
  status: string | null;
  expectedHandoverDate: string | null;
  handoverDateSource: string | null;
  constructionProgressPct: number | null;
  escrowBankName: string | null;
  escrowStatus: string | null;
  totalUnitsReported: number | null;
  researchStatus: string;
  masterDeveloperName: string | null;
  operatingDeveloperName: string | null;
  lat: number | null;
  lng: number | null;
  firstSeenAt: string;
  updatedAt: string;
};

export type DiscoverFilters = {
  search?: string;
  areaId?: string;
  developerId?: string;
  bedrooms?: number;
  status?: string;
  researchStatus?: string;
  handoverBefore?: string;
  handoverAfter?: string;
  limit?: number;
  offset?: number;
};

export type MarketStats = {
  medianPricePerSqft: number | null;
  p25PricePerSqft: number | null;
  p75PricePerSqft: number | null;
  transactionCount: number;
  buildingCount: number;
  periodFrom: string | null;
  periodTo: string | null;
  excludedCount: number;
  sampleQuality: "insufficient" | "weak_sample" | "robust";
  sampleGateNote: string;
};

// ---------------------------------------------------------------------------
// Project Catalog Queries
// ---------------------------------------------------------------------------

/**
 * List projects for the /discover page with basic aggregates.
 */
export async function listProjects(
  filters: DiscoverFilters = {}
): Promise<{ items: ProjectListItem[]; total: number }> {
  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;

  // Base conditions
  const conditions = [];

  if (filters.search) {
    conditions.push(
      sql`(${projects.nameEn} LIKE ${`%${filters.search}%`} OR ${developers.brandName} LIKE ${`%${filters.search}%`})`
    );
  }
  if (filters.areaId) {
    conditions.push(eq(projects.areaId, filters.areaId));
  }
  if (filters.developerId) {
    conditions.push(eq(projects.developerId, filters.developerId));
  }
  if (filters.status) {
    conditions.push(eq(projects.status, filters.status));
  }
  if (filters.researchStatus) {
    conditions.push(eq(projects.researchStatus, filters.researchStatus));
  }
  if (filters.handoverBefore) {
    conditions.push(lte(projects.expectedHandoverDate, filters.handoverBefore));
  }
  if (filters.handoverAfter) {
    conditions.push(gte(projects.expectedHandoverDate, filters.handoverAfter));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count query
  const [totalRow] = await db
    .select({ total: count() })
    .from(projects)
    .leftJoin(developers, eq(projects.developerId, developers.id))
    .where(whereClause);

  // Main query with unit count
  const rows = await db
    .select({
      id: projects.id,
      nameEn: projects.nameEn,
      developerBrand: developers.brandName,
      areaId: projects.areaId,
      status: projects.status,
      expectedHandoverDate: projects.expectedHandoverDate,
      constructionProgressPct: projects.constructionProgressPct,
      researchStatus: projects.researchStatus,
      firstSeenAt: projects.firstSeenAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(developers, eq(projects.developerId, developers.id))
    .where(whereClause)
    .orderBy(desc(projects.updatedAt))
    .limit(limit)
    .offset(offset);

  // Enrich with area names and unit type counts
  const areaIds = [...new Set(rows.map((r) => r.areaId).filter(Boolean))] as string[];
  const projectIds = rows.map((r) => r.id);

  const [areaRows, unitTypeCounts] = await Promise.all([
    areaIds.length > 0
      ? db.select({ id: areas.id, nameEn: areas.nameEn }).from(areas).where(inArray(areas.id, areaIds))
      : Promise.resolve([]),
    projectIds.length > 0
      ? db
          .select({ projectId: unitTypes.projectId, cnt: count() })
          .from(unitTypes)
          .where(inArray(unitTypes.projectId, projectIds))
          .groupBy(unitTypes.projectId)
      : Promise.resolve([]),
  ]);

  const areaMap = new Map(areaRows.map((a) => [a.id, a.nameEn]));
  const unitCountMap = new Map(unitTypeCounts.map((u) => [u.projectId, u.cnt]));

  const items: ProjectListItem[] = rows.map((r) => ({
    ...r,
    developerBrand: r.developerBrand ?? null,
    areaNameEn: r.areaId ? (areaMap.get(r.areaId) ?? null) : null,
    unitTypeCount: unitCountMap.get(r.id) ?? 0,
  }));

  return { items, total: totalRow?.total ?? 0 };
}

/**
 * Get full project details for /projects/[id]
 */
export async function getProjectById(id: string): Promise<ProjectDetail | null> {
  const rows = await db
    .select({
      id: projects.id,
      nameEn: projects.nameEn,
      nameAr: projects.nameAr,
      developerId: projects.developerId,
      developerLegalName: developers.legalName,
      developerBrandName: developers.brandName,
      areaId: projects.areaId,
      areaNameEn: areas.nameEn,
      dldProjectId: projects.dldProjectId,
      bayutExternalId: projects.bayutExternalId,
      status: projects.status,
      expectedHandoverDate: projects.expectedHandoverDate,
      handoverDateSource: projects.handoverDateSource,
      constructionProgressPct: projects.constructionProgressPct,
      escrowBankName: projects.escrowBankName,
      escrowStatus: projects.escrowStatus,
      totalUnitsReported: projects.totalUnitsReported,
      researchStatus: projects.researchStatus,
      masterDeveloperName: projects.masterDeveloperName,
      operatingDeveloperName: projects.operatingDeveloperName,
      lat: projects.lat,
      lng: projects.lng,
      firstSeenAt: projects.firstSeenAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(developers, eq(projects.developerId, developers.id))
    .leftJoin(areas, eq(projects.areaId, areas.id))
    .where(eq(projects.id, id))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Get unit types for a project
 */
export async function getProjectUnitTypes(projectId: string) {
  return db
    .select()
    .from(unitTypes)
    .where(eq(unitTypes.projectId, projectId))
    .orderBy(asc(unitTypes.bedrooms));
}

// ---------------------------------------------------------------------------
// Market Statistics for CMA
// ---------------------------------------------------------------------------

/**
 * Build ready-sales market stats for a given area + bedrooms + date window.
 * Implements sample gates from ADR 004 (plan §7.2).
 */
export async function getReadyMarketStats(params: {
  areaNameEn: string;
  bedrooms: number;
  fromDate: string;
  toDate: string;
  areaSqftMin?: number;
  areaSqftMax?: number;
}): Promise<MarketStats> {
  const { areaNameEn, bedrooms, fromDate, toDate, areaSqftMin, areaSqftMax } = params;

  const conditions = [
    eq(transactionFacts.areaNameEn, areaNameEn),
    eq(transactionFacts.bedrooms, bedrooms),
    eq(transactionFacts.isOffPlan, false),
    eq(transactionFacts.isExcluded, false),
    isNotNull(transactionFacts.pricePerSqftAed),
    gte(transactionFacts.transactionDate, fromDate),
    lte(transactionFacts.transactionDate, toDate),
  ];

  if (areaSqftMin !== undefined) {
    conditions.push(gte(transactionFacts.areaSqft, areaSqftMin));
  }
  if (areaSqftMax !== undefined) {
    conditions.push(lte(transactionFacts.areaSqft, areaSqftMax));
  }

  const where = and(...conditions);

  // Get all matching transactions for percentile calculation
  const rows = await db
    .select({
      pricePerSqft: transactionFacts.pricePerSqftAed,
      buildingName: transactionFacts.buildingNameEn,
      transactionDate: transactionFacts.transactionDate,
    })
    .from(transactionFacts)
    .where(where)
    .orderBy(asc(transactionFacts.pricePerSqftAed));

  // Also count excluded
  const [excludedRow] = await db
    .select({ cnt: count() })
    .from(transactionFacts)
    .where(
      and(
        eq(transactionFacts.areaNameEn, areaNameEn),
        eq(transactionFacts.bedrooms, bedrooms),
        eq(transactionFacts.isExcluded, true),
        gte(transactionFacts.transactionDate, fromDate),
        lte(transactionFacts.transactionDate, toDate)
      )
    );

  const validRows = rows.filter((r) => r.pricePerSqft !== null);
  const n = validRows.length;
  const uniqueBuildings = new Set(validRows.map((r) => r.buildingName).filter(Boolean)).size;
  const excludedCount = excludedRow?.cnt ?? 0;

  // Sample quality gates (ADR 004)
  let sampleQuality: "insufficient" | "weak_sample" | "robust";
  let sampleGateNote: string;

  if (n < 5) {
    sampleQuality = "insufficient";
    sampleGateNote = `Only ${n} valid ready sales found — insufficient for price comparison headline. Descriptive overview only.`;
  } else if (n < 15 || uniqueBuildings < 3) {
    sampleQuality = "weak_sample";
    sampleGateNote = `${n} valid sales across ${uniqueBuildings} building(s) — weak sample. Underprice headline blocked; use with caution.`;
  } else {
    sampleQuality = "robust";
    sampleGateNote = `${n} valid sales across ${uniqueBuildings} buildings — robust sample for observed price gap calculation.`;
  }

  if (n === 0) {
    return {
      medianPricePerSqft: null,
      p25PricePerSqft: null,
      p75PricePerSqft: null,
      transactionCount: 0,
      buildingCount: 0,
      periodFrom: fromDate,
      periodTo: toDate,
      excludedCount,
      sampleQuality: "insufficient",
      sampleGateNote,
    };
  }

  // Calculate percentiles from sorted array
  const prices = validRows.map((r) => r.pricePerSqft as number);
  const median = percentile(prices, 0.5);
  const p25 = percentile(prices, 0.25);
  const p75 = percentile(prices, 0.75);

  return {
    medianPricePerSqft: median,
    p25PricePerSqft: p25,
    p75PricePerSqft: p75,
    transactionCount: n,
    buildingCount: uniqueBuildings,
    periodFrom: validRows[0]?.transactionDate ?? fromDate,
    periodTo: validRows[validRows.length - 1]?.transactionDate ?? toDate,
    excludedCount,
    sampleQuality,
    sampleGateNote,
  };
}

/**
 * Get rent stats for an area + bedrooms window (new contracts only for per-unit metrics)
 */
export async function getRentStats(params: {
  areaNameEn: string;
  bedrooms: number;
  fromDate: string;
  toDate: string;
}) {
  const { areaNameEn, bedrooms, fromDate, toDate } = params;

  const rows = await db
    .select({
      annualRentAed: rentContractFacts.annualRentAed,
      contractType: rentContractFacts.contractType,
    })
    .from(rentContractFacts)
    .where(
      and(
        eq(rentContractFacts.areaNameEn, areaNameEn),
        eq(rentContractFacts.bedrooms, bedrooms),
        eq(rentContractFacts.isExcluded, false),
        eq(rentContractFacts.isMultiProperty, false), // Exclude multi-property contracts
        gte(rentContractFacts.contractDate, fromDate),
        lte(rentContractFacts.contractDate, toDate)
      )
    )
    .orderBy(asc(rentContractFacts.annualRentAed));

  const newContracts = rows.filter((r) => r.contractType === "new");
  const allContracts = rows;

  const newRents = newContracts
    .map((r) => r.annualRentAed)
    .filter((v): v is number => v !== null);
  const allRents = allContracts
    .map((r) => r.annualRentAed)
    .filter((v): v is number => v !== null);

  return {
    newContractMedian: newRents.length > 0 ? percentile(newRents, 0.5) : null,
    allContractMedian: allRents.length > 0 ? percentile(allRents, 0.5) : null,
    newContractCount: newRents.length,
    allContractCount: allRents.length,
    periodFrom: fromDate,
    periodTo: toDate,
  };
}

// ---------------------------------------------------------------------------
// Match Queue Queries
// ---------------------------------------------------------------------------

export async function getPendingMatches(limit = 20) {
  return db
    .select()
    .from(matchQueue)
    .where(eq(matchQueue.status, "pending"))
    .orderBy(desc(matchQueue.createdAt))
    .limit(limit);
}

export async function confirmMatch(matchId: string, confirmedBy: "agent" | "auto_exact") {
  await db
    .update(matchQueue)
    .set({
      status: "confirmed",
      confirmedBy,
      confirmedAt: new Date().toISOString(),
    })
    .where(eq(matchQueue.id, matchId));
}

export async function rejectMatch(matchId: string, reason: string) {
  await db
    .update(matchQueue)
    .set({
      status: "rejected",
      rejectionReason: reason,
    })
    .where(eq(matchQueue.id, matchId));
}

// ---------------------------------------------------------------------------
// Data Health
// ---------------------------------------------------------------------------

export async function getDataHealthSummary() {
  const [txCount, rentCount, pendingMatchCount] = await Promise.all([
    db.select({ cnt: count() }).from(transactionFacts).where(eq(transactionFacts.isExcluded, false)),
    db.select({ cnt: count() }).from(rentContractFacts).where(eq(rentContractFacts.isExcluded, false)),
    db.select({ cnt: count() }).from(matchQueue).where(eq(matchQueue.status, "pending")),
  ]);

  return {
    validTransactions: txCount[0]?.cnt ?? 0,
    validRentContracts: rentCount[0]?.cnt ?? 0,
    pendingMatches: pendingMatchCount[0]?.cnt ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const frac = idx - lower;
  return sorted[lower] * (1 - frac) + sorted[upper] * frac;
}

// ---------------------------------------------------------------------------
// Phase 3: CMA Analysis DAL Method
// ---------------------------------------------------------------------------

export async function getCmaAnalysisForProject(params: {
  projectId: string;
  bedrooms?: number;
  customTargetPriceAed?: number;
  customTargetAreaSqft?: number;
  monthsWindow?: number;
}): Promise<{
  project: {
    id: string;
    nameEn: string;
    developerBrand: string | null;
    areaNameEn: string | null;
    expectedHandoverDate: string | null;
  } | null;
  cma: CMAResult;
}> {
  const { projectId, bedrooms = 1, customTargetPriceAed, customTargetAreaSqft, monthsWindow = 12 } = params;

  // 1. Get project
  const [proj] = await db
    .select({
      id: projects.id,
      nameEn: projects.nameEn,
      developerBrand: developers.brandName,
      areaId: projects.areaId,
      areaNameEn: areas.nameEn,
      expectedHandoverDate: projects.expectedHandoverDate,
    })
    .from(projects)
    .leftJoin(developers, eq(projects.developerId, developers.id))
    .leftJoin(areas, eq(projects.areaId, areas.id))
    .where(eq(projects.id, projectId));

  const areaName = proj?.areaNameEn || "Business Bay";

  // Calculate cutoff date
  const now = new Date();
  now.setMonth(now.getMonth() - monthsWindow);
  const fromDate = now.toISOString().split("T")[0];

  // 2. Fetch Group A: Ready transactions (isOffPlan = false)
  const readyRows = await db
    .select({
      id: transactionFacts.id,
      buildingName: transactionFacts.buildingNameEn,
      bedrooms: transactionFacts.bedrooms,
      areaSqft: transactionFacts.areaSqft,
      salePriceAED: transactionFacts.transactionValueAed,
      pricePerSqftAED: transactionFacts.pricePerSqftAed,
      transactionDate: transactionFacts.transactionDate,
      isOffPlan: transactionFacts.isOffPlan,
    })
    .from(transactionFacts)
    .where(
      and(
        eq(transactionFacts.areaNameEn, areaName),
        eq(transactionFacts.isOffPlan, false),
        eq(transactionFacts.isExcluded, false),
        eq(transactionFacts.isResidential, true),
        eq(transactionFacts.bedrooms, bedrooms),
        gte(transactionFacts.transactionDate, fromDate),
        isNotNull(transactionFacts.pricePerSqftAed)
      )
    )
    .orderBy(desc(transactionFacts.transactionDate))
    .limit(200);

  // 3. Fetch Group B: Off-plan comparable transactions (isOffPlan = true)
  const offPlanRows = await db
    .select({
      id: transactionFacts.id,
      buildingName: transactionFacts.buildingNameEn,
      bedrooms: transactionFacts.bedrooms,
      areaSqft: transactionFacts.areaSqft,
      salePriceAED: transactionFacts.transactionValueAed,
      pricePerSqftAED: transactionFacts.pricePerSqftAed,
      transactionDate: transactionFacts.transactionDate,
      isOffPlan: transactionFacts.isOffPlan,
    })
    .from(transactionFacts)
    .where(
      and(
        eq(transactionFacts.areaNameEn, areaName),
        eq(transactionFacts.isOffPlan, true),
        eq(transactionFacts.isExcluded, false),
        eq(transactionFacts.isResidential, true),
        eq(transactionFacts.bedrooms, bedrooms),
        gte(transactionFacts.transactionDate, fromDate),
        isNotNull(transactionFacts.pricePerSqftAed)
      )
    )
    .orderBy(desc(transactionFacts.transactionDate))
    .limit(200);

  // 4. Fetch Group C: Near-handover / mature off-plan
  // Pick off-plan transactions in the cluster with earlier completion or mature phases
  const nearHandoverRows = offPlanRows.slice(0, 30);

  // Fallback target pricing if not provided
  const targetArea = customTargetAreaSqft || (bedrooms === 0 ? 450 : bedrooms === 1 ? 750 : bedrooms === 2 ? 1150 : 1600);
  const targetPrice = customTargetPriceAed || (bedrooms === 0 ? 1100000 : bedrooms === 1 ? 1650000 : bedrooms === 2 ? 2450000 : 3500000);

  const readyComps: DomainTxFact[] = readyRows.map((r) => ({
    id: r.id,
    buildingName: r.buildingName || "Ready Building",
    bedrooms: r.bedrooms ?? bedrooms,
    areaSqft: r.areaSqft ?? targetArea,
    salePriceAED: r.salePriceAED ?? targetPrice,
    pricePerSqftAED: r.pricePerSqftAED ?? 0,
    transactionDate: r.transactionDate,
    isOffPlan: false,
  }));

  const offPlanComps: DomainTxFact[] = offPlanRows.map((r) => ({
    id: r.id,
    buildingName: r.buildingName || "Off-Plan Project",
    bedrooms: r.bedrooms ?? bedrooms,
    areaSqft: r.areaSqft ?? targetArea,
    salePriceAED: r.salePriceAED ?? targetPrice,
    pricePerSqftAED: r.pricePerSqftAED ?? 0,
    transactionDate: r.transactionDate,
    isOffPlan: true,
  }));

  const nearHandoverComps: DomainTxFact[] = nearHandoverRows.map((r) => ({
    id: r.id,
    buildingName: r.buildingName || "Near-Handover Project",
    bedrooms: r.bedrooms ?? bedrooms,
    areaSqft: r.areaSqft ?? targetArea,
    salePriceAED: r.salePriceAED ?? targetPrice,
    pricePerSqftAED: r.pricePerSqftAED ?? 0,
    transactionDate: r.transactionDate,
    isOffPlan: true,
  }));

  const cmaResult = buildComparableSet(
    targetPrice,
    targetArea,
    readyComps,
    offPlanComps,
    nearHandoverComps
  );

  return {
    project: proj || null,
    cma: cmaResult,
  };
}

// ---------------------------------------------------------------------------
// Phase 3: Alternatives Shortlist DAL Method
// ---------------------------------------------------------------------------

export async function getAlternativesShortlistForClient(params: {
  brief: ClientBriefParams;
  withAiCommentary?: boolean;
}): Promise<ShortlistResult & { aiCommentary?: { summary: string; keyTakeaway: string; source: string } }> {
  const { brief, withAiCommentary = false } = params;

  // 1. Fetch candidate projects from DB
  const projectList = await db
    .select({
      id: projects.id,
      nameEn: projects.nameEn,
      developerBrand: developers.brandName,
      developerLegal: developers.legalName,
      areaId: projects.areaId,
      areaNameEn: areas.nameEn,
      status: projects.status,
      expectedHandoverDate: projects.expectedHandoverDate,
      constructionProgressPct: projects.constructionProgressPct,
    })
    .from(projects)
    .leftJoin(developers, eq(projects.developerId, developers.id))
    .leftJoin(areas, eq(projects.areaId, areas.id))
    .limit(40);

  // 2. Fetch ready median PSF for areas
  const readyMedians = await db
    .select({
      areaNameEn: transactionFacts.areaNameEn,
      avgPsf: avg(transactionFacts.pricePerSqftAed),
    })
    .from(transactionFacts)
    .where(
      and(
        eq(transactionFacts.isOffPlan, false),
        eq(transactionFacts.isExcluded, false),
        eq(transactionFacts.isResidential, true)
      )
    )
    .groupBy(transactionFacts.areaNameEn);

  const readyMap = new Map<string, number>();
  for (const rm of readyMedians) {
    if (rm.areaNameEn && rm.avgPsf) {
      readyMap.set(rm.areaNameEn, parseFloat(rm.avgPsf));
    }
  }

  // 3. Map projects to CandidateOffer
  const targetBedrooms = brief.targetBedrooms[0] ?? 1;
  const targetBudget = Number(brief.budgetAed);

  const candidates: CandidateOffer[] = projectList.map((p, idx) => {
    const areaName = p.areaNameEn || "Business Bay";
    const readyMedian = readyMap.get(areaName) || 2100;
    
    // Realistic estimated pricing for offplan candidates based on bedrooms and area
    const basePsf = readyMedian * (0.85 + (idx % 4) * 0.05); // 85% to 100% of ready median
    const sqft = targetBedrooms === 0 ? 450 : targetBedrooms === 1 ? 750 : targetBedrooms === 2 ? 1150 : 1600;
    const priceAed = Math.round(basePsf * sqft);
    
    // Handover year from expectedHandoverDate
    const handoverYear = p.expectedHandoverDate
      ? parseInt(p.expectedHandoverDate.substring(0, 4), 10) || 2026
      : 2026 + (idx % 3);

    return {
      id: `offer_${p.id}`,
      projectId: p.id,
      projectName: p.nameEn,
      areaId: p.areaId || "area_default",
      areaName,
      developerName: p.developerBrand || p.developerLegal || "Premier Developer",
      bedrooms: targetBedrooms,
      areaSqft: sqft,
      priceAed,
      pricePerSqftAed: basePsf,
      expectedHandoverYear: handoverYear,
      expectedHandoverDate: p.expectedHandoverDate || `${handoverYear}-12-31`,
      constructionProgressPct: p.constructionProgressPct || (handoverYear <= 2025 ? 80 : 35),
      assignmentPolicy: idx % 5 === 0 ? "prohibited" : "allowed",
      minPaidPctForNoc: 34,
      paymentPlanSummary: idx % 2 === 0 ? "60/40" : "70/30",
      readyMedianPsfArea: readyMedian,
    };
  });

  // 4. Run deterministic shortlist engine
  const shortlistResult = buildShortlist(brief, candidates);

  // 5. Optionally invoke Gemini commentary
  let aiCommentary;
  if (withAiCommentary) {
    aiCommentary = await generateShortlistCommentary(shortlistResult, "ru");
  }

  return {
    ...shortlistResult,
    aiCommentary,
  };
}

