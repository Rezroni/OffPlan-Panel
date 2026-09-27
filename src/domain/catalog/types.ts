/**
 * Shared Domain Types for Project Catalog & Transactions
 * Client-safe: Contains pure type definitions only, no server/database dependencies.
 */

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

export type UnitTypeItem = {
  id: string;
  projectId: string;
  buildingId: string | null;
  bedrooms: number | null;
  unitTypeLabel: string | null;
  areaSqftMin: number | null;
  areaSqftMax: number | null;
  areaType: string | null;
  listPriceAed: number | null;
  netPriceAed: number | null;
  priceSource: string | null;
  priceAsOf: string | null;
  assignmentPolicy: string | null;
  minPaidPctForNoc: number | null;
  updatedAt: string;
  // Enriched fields:
  firstPriceAed?: number | null;
  firstDealDate?: string | null;
  latestPriceAed?: number | null;
  latestDealDate?: string | null;
  dealCount?: number;
  priceChangePct?: number | null;
};

export type ProjectTransactionItem = {
  id: string;
  transactionNo: string | null;
  transactionDate: string;
  transactionValueAed: number;
  pricePerSqftAed: number | null;
  areaSqft: number | null;
  areaSqm: number | null;
  transactionType: string | null;
  isOffPlan: boolean | null;
  unitNo: string | null;
  buildingNameEn: string | null;
  bedrooms: number | null;
};

export type ProjectTransactionsResult = {
  transactions: ProjectTransactionItem[];
  totalCount: number;
  firstDeal: {
    transactionDate: string;
    transactionValueAed: number;
    pricePerSqftAed: number | null;
    transactionType: string | null;
  } | null;
  latestDeal: {
    transactionDate: string;
    transactionValueAed: number;
    pricePerSqftAed: number | null;
    transactionType: string | null;
  } | null;
  priceChangePct: number | null;
  avgPricePerSqft: number | null;
  minPriceAed: number | null;
  maxPriceAed: number | null;
};

export type UnitResaleStep = {
  id: string;
  transactionNo: string | null;
  transactionDate: string;
  transactionValueAed: number;
  pricePerSqftAed: number | null;
  transactionType: string | null;
  isOffPlan: boolean | null;
  propertySubtype?: string | null;
  stepIndex: number;
  priceChangeFromPreviousAed?: number;
  priceChangeFromPreviousPct?: number;
  daysFromPrevious?: number;
};

export type UnitResaleChain = {
  id: string;
  fingerprintKey: string;
  buildingNameEn: string;
  propertySubtype?: string | null;
  propertyType?: "residential" | "commercial";
  bedrooms: number | null;
  areaSqm: number;
  areaSqft: number;
  totalTransactions: number;
  firstDate: string;
  firstPriceAed: number;
  firstPricePerSqftAed: number | null;
  latestDate: string;
  latestPriceAed: number;
  latestPricePerSqftAed: number | null;
  netPriceChangeAed: number;
  netPriceChangePct: number;
  holdingDays: number;
  holdingMonths: number;
  annualizedRoiPct: number;
  confidenceScore: number; // 100, 98, 90, 75
  confidenceLabel: string;
  confidenceTier: "guaranteed" | "high" | "probable" | "stack";
  transactions: UnitResaleStep[];
};

export type ProjectResaleChainsResult = {
  chains: UnitResaleChain[];
  totalChains: number;
  guaranteedCount: number;
  highCount: number;
  avgHoldingMonths: number | null;
  avgNetProfitAed: number | null;
  avgPriceChangePct: number | null;
  maxAppreciationPct: number | null;
};
