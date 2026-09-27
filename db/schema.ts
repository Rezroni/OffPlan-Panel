/**
 * Dubai Off-plan Research Desk — Database Schema v1
 * Phase 2: SQLite (better-sqlite3) + Drizzle ORM
 * 
 * Groups: Sources → Geography → Catalog → Market Facts → Match Queue
 * 
 * Design rules:
 * - All monetary amounts stored as INTEGER (fils/cents) or REAL with explicit unit
 * - All dates stored as TEXT ISO-8601
 * - Nullable means "unknown", NOT 0 or empty string
 * - source_key always preserved as original string
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// SOURCES
// ---------------------------------------------------------------------------

export const sourceConnections = sqliteTable("source_connection", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),            // "dld_transactions", "bayut_rapidapi", "developer_excel"
  type: text("type").notNull(),            // "dld_open_api" | "bayut_api" | "manual_import"
  baseUrl: text("base_url"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  termsNotes: text("terms_notes"),         // ToU snapshot / applicable restrictions
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const ingestionRuns = sqliteTable("ingestion_run", {
  id: text("id").primaryKey(),
  sourceConnectionId: text("source_connection_id").notNull()
    .references(() => sourceConnections.id),
  status: text("status").notNull(),        // "running" | "done" | "failed" | "quarantined"
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  recordsFetched: integer("records_fetched"),
  recordsInserted: integer("records_inserted"),
  recordsUpdated: integer("records_updated"),
  recordsSkipped: integer("records_skipped"),
  recordsQuarantined: integer("records_quarantined"),
  errorMessage: text("error_message"),
  filterParams: text("filter_params"),     // JSON: {from, to, districts, ...}
  checksum: text("checksum"),
}, (t) => [
  index("idx_ingestion_source").on(t.sourceConnectionId),
  index("idx_ingestion_status").on(t.status),
]);

export const sourceRecordRevisions = sqliteTable("source_record_revision", {
  id: text("id").primaryKey(),
  sourceConnectionId: text("source_connection_id").notNull()
    .references(() => sourceConnections.id),
  sourceRunId: text("source_run_id").references(() => ingestionRuns.id),
  recordType: text("record_type").notNull(), // "transaction" | "rent_contract" | "service_charge"
  sourceRecordId: text("source_record_id").notNull(),
  revisionNo: integer("revision_no").notNull().default(1),
  rawPayload: text("raw_payload").notNull(),
  payloadChecksum: text("payload_checksum").notNull(),
  changeType: text("change_type").notNull(), // "insert" | "correction" | "superseded"
  recordedAt: text("recorded_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index("idx_src_rev_record").on(t.recordType, t.sourceRecordId),
  index("idx_src_rev_run").on(t.sourceRunId),
  index("idx_src_rev_checksum").on(t.payloadChecksum),
  uniqueIndex("idx_src_rev_unique").on(t.sourceConnectionId, t.recordType, t.sourceRecordId, t.revisionNo),
]);

export const quarantinedRecords = sqliteTable("quarantined_record", {
  id: text("id").primaryKey(),
  sourceConnectionId: text("source_connection_id").notNull()
    .references(() => sourceConnections.id),
  sourceRunId: text("source_run_id").references(() => ingestionRuns.id),
  recordType: text("record_type").notNull(),
  rawPayload: text("raw_payload").notNull(),
  rejectionReason: text("rejection_reason").notNull(),
  quarantinedAt: text("quarantined_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index("idx_quarantine_run").on(t.sourceRunId),
  index("idx_quarantine_type").on(t.recordType),
]);

// ---------------------------------------------------------------------------
// GEOGRAPHY
// ---------------------------------------------------------------------------

export const areas = sqliteTable("area", {
  id: text("id").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar"),
  dldCode: text("dld_code"),               // DLD area_name_en or area_code
  parentAreaId: text("parent_area_id"),    // master community → community
  lat: real("lat"),
  lng: real("lng"),
  coordPrecision: text("coord_precision"), // "centroid" | "building" | "unknown"
  coordSource: text("coord_source"),
}, (t) => [
  index("idx_area_dld_code").on(t.dldCode),
]);

// ---------------------------------------------------------------------------
// CATALOG: Developers, Projects, Buildings, Unit Types
// ---------------------------------------------------------------------------

export const developers = sqliteTable("developer", {
  id: text("id").primaryKey(),
  legalName: text("legal_name").notNull(),
  brandName: text("brand_name"),           // Marketing brand (may differ from legal)
  dldDeveloperId: text("dld_developer_id"), // External DLD key
  sourceRunId: text("source_run_id").references(() => ingestionRuns.id),
  firstSeenAt: text("first_seen_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index("idx_developer_dld_id").on(t.dldDeveloperId),
]);

export const projects = sqliteTable("project", {
  id: text("id").primaryKey(),
  developerId: text("developer_id").references(() => developers.id),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar"),
  areaId: text("area_id").references(() => areas.id),
  dldProjectId: text("dld_project_id"),     // External DLD key
  bayutExternalId: text("bayut_external_id"),
  status: text("status"),                   // "active" | "completed" | "suspended" | "unknown"
  // Expected handover — NOTE: this is DLD's expected date, NOT original promise
  expectedHandoverDate: text("expected_handover_date"),
  handoverDateSource: text("handover_date_source"), // "dld" | "developer_doc" | "manual"
  constructionProgressPct: real("construction_progress_pct"), // 0–100 as reported
  escrowBankName: text("escrow_bank_name"),
  escrowAccountNo: text("escrow_account_no"),
  escrowStatus: text("escrow_status"),      // "verified_active" | "reported" | "unknown"
  totalUnitsReported: integer("total_units_reported"),
  lat: real("lat"),
  lng: real("lng"),
  // Research status
  researchStatus: text("research_status").notNull().default("discovered"),
  // "discovered" | "mapped" | "analysed" | "editorial_reviewed" | "content_ready"
  propertyType: text("property_type").default("apartment"), // "apartment" | "villa" | "both" | "land"
  dldProjectNumber: text("dld_project_number"), // e.g. "3416", "3859", "4430"
  masterDeveloperName: text("master_developer_name"),
  operatingDeveloperName: text("operating_developer_name"),
  sourceRunId: text("source_run_id").references(() => ingestionRuns.id),
  firstSeenAt: text("first_seen_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index("idx_project_developer").on(t.developerId),
  index("idx_project_area").on(t.areaId),
  index("idx_project_dld_id").on(t.dldProjectId),
  index("idx_project_dld_number").on(t.dldProjectNumber),
  index("idx_project_property_type").on(t.propertyType),
  index("idx_project_status").on(t.status),
]);

export const buildings = sqliteTable("building", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  nameEn: text("name_en").notNull(),
  phaseName: text("phase_name"),
  dldBuildingId: text("dld_building_id"),
  totalFloors: integer("total_floors"),
  lat: real("lat"),
  lng: real("lng"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index("idx_building_project").on(t.projectId),
]);

export const unitTypes = sqliteTable("unit_type", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  buildingId: text("building_id").references(() => buildings.id),
  bedrooms: integer("bedrooms"),           // 0=Studio, 1,2,3… null=unknown
  unitTypeLabel: text("unit_type_label"),  // "1BR Corner", "2BR Sea View"
  areaSqftMin: real("area_sqft_min"),
  areaSqftMax: real("area_sqft_max"),
  areaType: text("area_type"),             // "internal" | "gross" | "with_balcony" | "unknown"
  // Price — from developer docs, NOT DLD transaction
  listPriceAed: integer("list_price_aed"),
  netPriceAed: integer("net_price_aed"),   // After confirmed discount/waiver
  priceSource: text("price_source"),       // "developer_doc" | "bayut" | "manual"
  priceAsOf: text("price_as_of"),
  assignmentPolicy: text("assignment_policy"), // "allowed" | "prohibited" | "conditional" | "unknown"
  minPaidPctForNoc: real("min_paid_pct_for_noc"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index("idx_unit_type_project").on(t.projectId),
  index("idx_unit_type_bedrooms").on(t.bedrooms),
]);

// ---------------------------------------------------------------------------
// MATCH QUEUE — project source matching review
// ---------------------------------------------------------------------------

export const matchQueue = sqliteTable("match_queue", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("pending"),
  // "pending" | "confirmed" | "rejected" | "needs_review"
  candidateType: text("candidate_type").notNull(), // "project" | "developer" | "building"
  internalId: text("internal_id"),        // Our project/developer ID (if exists)
  externalSource: text("external_source").notNull(), // "dld" | "bayut"
  externalKey: text("external_key").notNull(),
  externalName: text("external_name"),
  matchScore: real("match_score"),        // 0–1 confidence
  matchReason: text("match_reason"),      // "name+area+developer" | "dld_id" | "manual"
  rejectionReason: text("rejection_reason"),
  confirmedBy: text("confirmed_by"),      // "agent" | "auto_exact"
  confirmedAt: text("confirmed_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index("idx_match_status").on(t.status),
  index("idx_match_external").on(t.externalSource, t.externalKey),
  uniqueIndex("idx_match_unique").on(t.externalSource, t.externalKey, t.candidateType),
]);

// ---------------------------------------------------------------------------
// MARKET FACTS — DLD Transactions, Rent Contracts, Service Charges
// ---------------------------------------------------------------------------

export const transactionFacts = sqliteTable("transaction_fact", {
  id: text("id").primaryKey(),             // dld_transaction_id as string
  sourceRunId: text("source_run_id").references(() => ingestionRuns.id),
  // Core identifiers
  transactionNo: text("transaction_no"),
  transactionDate: text("transaction_date").notNull(),
  registrationDate: text("registration_date"),
  // Property
  areaNameEn: text("area_name_en"),
  buildingNameEn: text("building_name_en"),
  projectNameEn: text("project_name_en"),
  dldProjectId: text("dld_project_id"),
  unitNo: text("unit_no"),
  // Unit characteristics (raw from DLD)
  bedrooms: integer("bedrooms"),           // 0=Studio, null=unknown
  areaSqm: real("area_sqm"),
  areaSqft: real("area_sqft"),             // Derived: sqm * 10.7639104
  // Financial
  transactionValueAed: integer("transaction_value_aed"),
  pricePerSqftAed: real("price_per_sqft_aed"),
  // Classification
  transactionType: text("transaction_type"), // raw DLD value — do NOT interpret as ready/offplan without verification
  propertyType: text("property_type"),
  propertySubtype: text("property_subtype"),
  // Flags — populated during normalization
  isOffPlan: integer("is_off_plan", { mode: "boolean" }),    // null = uncertain
  isResidential: integer("is_residential", { mode: "boolean" }),
  isApartmentEligible: integer("is_apartment_eligible", { mode: "boolean" }),
  isExcluded: integer("is_excluded", { mode: "boolean" }).default(false),
  exclusionReason: text("exclusion_reason"),
  // Matched to catalog
  matchedProjectId: text("matched_project_id").references(() => projects.id),
  matchedBuildingId: text("matched_building_id").references(() => buildings.id),
  matchConfidence: text("match_confidence"), // "confirmed" | "auto" | "unmatched"
}, (t) => [
  index("idx_tx_date").on(t.transactionDate),
  index("idx_tx_area").on(t.areaNameEn),
  index("idx_tx_project_dld").on(t.dldProjectId),
  index("idx_tx_matched_project").on(t.matchedProjectId),
  index("idx_tx_bedrooms_date").on(t.bedrooms, t.transactionDate),
  index("idx_tx_apt_metrics").on(t.isApartmentEligible, t.isOffPlan, t.areaNameEn, t.bedrooms, t.transactionDate),
]);

export const rentContractFacts = sqliteTable("rent_contract_fact", {
  id: text("id").primaryKey(),
  sourceRunId: text("source_run_id").references(() => ingestionRuns.id),
  contractDate: text("contract_date").notNull(),    // Registration date (≠ contract start)
  startDate: text("start_date"),
  endDate: text("end_date"),
  contractType: text("contract_type"),              // "new" | "renew"
  areaNameEn: text("area_name_en"),
  buildingNameEn: text("building_name_en"),
  unitNo: text("unit_no"),
  bedrooms: integer("bedrooms"),
  areaSqm: real("area_sqm"),
  areaSqft: real("area_sqft"),
  annualRentAed: real("annual_rent_aed"),           // Explicit AED precision policy: preserves decimal amounts without float loss
  propertyUsage: text("property_usage"),
  isResidential: integer("is_residential", { mode: "boolean" }),
  isApartmentEligible: integer("is_apartment_eligible", { mode: "boolean" }),
  isMultiProperty: integer("is_multi_property", { mode: "boolean" }), // Multi-property contracts excluded from per-unit metrics
  isExcluded: integer("is_excluded", { mode: "boolean" }).default(false),
  exclusionReason: text("exclusion_reason"),
  matchedProjectId: text("matched_project_id").references(() => projects.id),
  matchConfidence: text("match_confidence"),
}, (t) => [
  index("idx_rent_date").on(t.contractDate),
  index("idx_rent_area").on(t.areaNameEn),
  index("idx_rent_bedrooms").on(t.bedrooms),
  index("idx_rent_matched_project").on(t.matchedProjectId),
]);

export const serviceChargeFacts = sqliteTable("service_charge_fact", {
  id: text("id").primaryKey(),
  sourceRunId: text("source_run_id").references(() => ingestionRuns.id),
  year: integer("year").notNull(),
  buildingNameEn: text("building_name_en"),
  areaNameEn: text("area_name_en"),
  annualChargePerSqft: real("annual_charge_per_sqft"),
  annualChargePerSqm: real("annual_charge_per_sqm"),
  chargeCategory: text("charge_category"),
  matchedProjectId: text("matched_project_id").references(() => projects.id),
  matchedBuildingId: text("matched_building_id").references(() => buildings.id),
  rawServiceCost: real("raw_service_cost"),
  rawServiceCostUnit: text("raw_service_cost_unit").default("unknown"),
}, (t) => [
  index("idx_sc_year").on(t.year),
  index("idx_sc_matched_project").on(t.matchedProjectId),
]);

// ---------------------------------------------------------------------------
// DATA HEALTH / FRESHNESS TRACKING
// ---------------------------------------------------------------------------

export const dataHealthChecks = sqliteTable("data_health_check", {
  id: text("id").primaryKey(),
  sourceConnectionId: text("source_connection_id").notNull()
    .references(() => sourceConnections.id),
  checkedAt: text("checked_at").notNull().default(sql`(datetime('now'))`),
  totalRecords: integer("total_records"),
  oldestRecord: text("oldest_record"),
  newestRecord: text("newest_record"),
  coverageNotes: text("coverage_notes"),
  status: text("status").notNull(), // "ok" | "stale" | "missing" | "schema_drift"
});

// ---------------------------------------------------------------------------
// DEVELOPER DOCUMENT IMPORTS & OFFER REVISIONS (§10.2)
// ---------------------------------------------------------------------------

export const offerRevisions = sqliteTable("offer_revision", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  buildingId: text("building_id").references(() => buildings.id),
  fileName: text("file_name").notNull(),
  fileChecksum: text("file_checksum").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  sheetName: text("sheet_name"),
  receivedAt: text("received_at").notNull(),
  confirmedAt: text("confirmed_at"),
  confirmedBy: text("confirmed_by"), // "agent:Mokhamed"
  revisionNo: integer("revision_no").notNull().default(1),
  totalUnitsParsed: integer("total_units_parsed").notNull().default(0),
  totalUnitsAvailable: integer("total_units_available").notNull().default(0),
  status: text("status").notNull().default("confirmed"), // "confirmed" | "draft" | "stale" | "superseded"
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index("idx_offer_rev_project").on(t.projectId),
  index("idx_offer_rev_checksum").on(t.fileChecksum),
  index("idx_offer_rev_status").on(t.status),
]);

export const developerOffers = sqliteTable("developer_offer", {
  id: text("id").primaryKey(),
  revisionId: text("revision_id").notNull().references(() => offerRevisions.id),
  projectId: text("project_id").notNull().references(() => projects.id),
  unitNo: text("unit_no").notNull(), // Preserved as string e.g. "0102"
  floorNo: integer("floor_no"),
  bedrooms: integer("bedrooms"), // 0=Studio, 1, 2, 3...
  unitType: text("unit_type"), // "Apartment", "Penthouse"
  view: text("view"), // "Sea View", "Park", "Burj Khalifa"
  suiteAreaSqft: real("suite_area_sqft"),
  balconyAreaSqft: real("balcony_area_sqft"),
  totalAreaSqft: real("total_area_sqft").notNull(),
  listPriceAed: integer("list_price_aed"),
  discountAed: integer("discount_aed"),
  netPriceAed: integer("net_price_aed").notNull(),
  paymentPlanPreset: text("payment_plan_preset"), // e.g. "60/40"
  availability: text("availability").notNull().default("available"), // "available" | "reserved" | "sold" | "unknown"
  firstSeenAt: text("first_seen_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index("idx_dev_offer_rev").on(t.revisionId),
  index("idx_dev_offer_project").on(t.projectId),
  index("idx_dev_offer_bedrooms").on(t.bedrooms),
  index("idx_dev_offer_availability").on(t.availability),
]);

// ---------------------------------------------------------------------------
// PHASE 6: REPORTS & CONTENT STUDIO (§16, §17, §18, §20)
// ---------------------------------------------------------------------------

export const reportSnapshots = sqliteTable("report_snapshot", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  unitTypeId: text("unit_type_id"),
  title: text("title").notNull(),
  locale: text("locale").notNull().default("ru"), // "ru" | "ar" | "en"
  snapshotHash: text("snapshot_hash").notNull(), // SHA-256 of payloadJson
  status: text("status").notNull().default("draft"), // "draft" | "approved" | "exported" | "sent"
  payloadJson: text("payload_json").notNull(), // Immutable JSON payload of all analysis & scenario data
  pdfPath: text("pdf_path"),
  pdfSizeBytes: integer("pdf_size_bytes"),
  generatedBy: text("generated_by").notNull().default("agent:Mokhamed"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index("idx_report_snap_project").on(t.projectId),
  index("idx_report_snap_hash").on(t.snapshotHash),
  index("idx_report_snap_status").on(t.status),
]);

export const contentBriefs = sqliteTable("content_brief", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  topic: text("topic").notNull(),
  targetAudience: text("target_audience"),
  hookRu: text("hook_ru"),
  hookAr: text("hook_ar"),
  scriptJson: text("script_json").notNull(), // DualReelsScript serialized
  status: text("status").notNull().default("draft"), // "draft" | "approved" | "published"
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index("idx_content_brief_project").on(t.projectId),
]);
