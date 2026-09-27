import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import {
  parseBedrooms,
  classifyTransaction,
  normalizeProjectName,
  normalizeTransaction,
  normalizeRentContract,
  normalizeServiceCharge,
  importDldTransactions,
  importDldRentContracts,
  importDldServiceCharges,
  createIngestionRun,
  ensureDldSourceConnection,
  loadProjectCrosswalk,
  type ProjectCrosswalk,
  type RawDldTransaction,
  type RawDldRentContract,
  type RawDldServiceCharge,
} from "../../src/server/adapters/dld/dld-adapter";
import { parseOptionalAedAmount, calculatePayloadChecksum } from "../../src/domain/dld/normalization";

// Helper to initialize an in-memory database with actual migrations
function createTestDatabase(enforceForeignKeys: boolean = true) {
  const sqlite = new Database(":memory:");
  if (enforceForeignKeys) {
    sqlite.pragma("foreign_keys = ON");
  } else {
    sqlite.pragma("foreign_keys = OFF");
  }

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "db/migrations") });
  return { sqlite, db };
}

function resolvePythonBinary(): string {
  const candidates = [
    process.env.PYTHON_PATH,
    path.join(process.cwd(), "DLD PIPELINE", ".venv312", "bin", "python3"),
    path.join(process.cwd(), "DLD PIPELINE", ".venv", "bin", "python3"),
    path.join(process.cwd(), "DLD PIPELINE", ".venv312", "bin", "python"),
    path.join(process.cwd(), "DLD PIPELINE", ".venv", "bin", "python"),
    "python3",
    "python",
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "python3";
}


describe("Phase 0 Data Contract Remediation Suite", () => {
  let fixturesTx: RawDldTransaction[];
  let fixturesRent: RawDldRentContract[];
  let fixturesSc: RawDldServiceCharge[];
  let crosswalk: ProjectCrosswalk;

  beforeEach(() => {
    fixturesTx = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "tests/fixtures/dld_transactions_sanitized.json"), "utf-8")
    );
    fixturesRent = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "tests/fixtures/dld_rent_contracts_sanitized.json"), "utf-8")
    );
    fixturesSc = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "tests/fixtures/dld_service_charges_sanitized.json"), "utf-8")
    );

    crosswalk = {
      projectNumberToProjectId: new Map([
        ["3382", "678813961"],
        ["1897", "83055243"],
        ["2744", "529545309"],
      ]),
      materializedProjectIds: new Set([
        "proj_dld_678813961",
        "proj_dld_83055243",
        "proj_dld_529545309",
      ]),
      registryProjectIds: new Set([
        "678813961",
        "83055243",
        "529545309",
        "900101",
        "900102",
      ]),
      canonicalProjectIds: new Set([
        "proj_dld_678813961",
        "proj_dld_83055243",
        "proj_dld_529545309",
      ]),
      nameToProjectIds: new Map([
        ["eden house the park", ["678813961"]],
        ["azizi aura residences", ["83055243"]],
        ["avenue residence 5", ["529545309"]],
        ["al salam tower 1", ["900101", "900102"]], // Duplicate candidate
      ]),
    };
  });

  // -------------------------------------------------------------------------
  // 1. EXACT FIELD MAPPINGS (P0-02)
  // -------------------------------------------------------------------------
  describe("Exact Observed Field Mappings (P0-02)", () => {
    it("should correctly map observed transaction fields without defaulting", () => {
      const sample = fixturesTx.find((f) => (f as any)._fixture_id === "tx_ready_sale_standard")!;
      const result = normalizeTransaction(sample, crosswalk);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.fact.id).toBe("1-11-2026-26371");
        expect(result.fact.transactionDate).toBe("2026-08-26");
        expect(result.fact.transactionValueAed).toBe(2100000);
        expect(result.fact.areaSqm).toBeCloseTo(160.68);
        expect(result.fact.areaSqft).toBeCloseTo(160.68 * 10.7639104);
        expect(result.fact.pricePerSqftAed).toBeCloseTo(2100000 / (160.68 * 10.7639104));
        expect(result.fact.bedrooms).toBe(2);
        expect(result.fact.isOffPlan).toBe(false);
        expect(result.fact.isResidential).toBe(true);
        expect(result.fact.isExcluded).toBe(false);
      }
    });

    it("should correctly map observed rent contract fields including annual_amount and actual_area", () => {
      const sample = fixturesRent.find((f) => (f as any)._fixture_id === "rent_single_prop_renew")!;
      const result = normalizeRentContract(sample, crosswalk);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.fact.id).toBe("CNT202611001_1");
        expect(result.fact.contractDate).toBe("2025-10-01");
        expect(result.fact.annualRentAed).toBe(95000);
        expect(result.fact.areaSqm).toBe(82.5);
        expect(result.fact.contractType).toBe("renew");
        expect(result.fact.isMultiProperty).toBe(false);
        expect(result.fact.matchedProjectId).toBe("proj_dld_678813961");
      }
    });

    it("should correctly map service charge fields without assuming sqft rate", () => {
      const sample = fixturesSc.find((f) => (f as any)._fixture_id === "sc_azizi_aura_insurance_2022")!;
      const result = normalizeServiceCharge(sample, crosswalk);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.fact.id).toBe("sc_243048329_2022_5_7");
        expect(result.fact.year).toBe(2022);
        expect(result.fact.rawServiceCost).toBe(17.4);
        // Billing unit not assumed: annualChargePerSqft must be null
        expect(result.fact.annualChargePerSqft).toBeNull();
        expect(result.fact.matchedProjectId).toBe("proj_dld_83055243");
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. STUDIO VS ZERO VS NULL (P0-06)
  // -------------------------------------------------------------------------
  describe("Bedroom Semantics: 0/Studio vs Null (P0-06)", () => {
    it("should parse 'Studio' text strictly as 0", () => {
      expect(parseBedrooms("Studio")).toBe(0);
      expect(parseBedrooms("studio")).toBe(0);
      expect(parseBedrooms(null, "استوديو")).toBe(0);
    });

    it("should parse numeric '0' as 0", () => {
      expect(parseBedrooms("0")).toBe(0);
      expect(parseBedrooms(0)).toBe(0);
      expect(parseBedrooms("0 BR")).toBe(0);
    });

    it("should parse '10 B/R' as 10 and avoid matching '1'", () => {
      expect(parseBedrooms("10 B/R")).toBe(10);
      expect(parseBedrooms("10")).toBe(10);
      expect(parseBedrooms("1 B/R")).toBe(1);
    });

    it("should preserve null for unknown or absent bedroom values", () => {
      expect(parseBedrooms(null)).toBeNull();
      expect(parseBedrooms(undefined)).toBeNull();
      expect(parseBedrooms("")).toBeNull();
      expect(parseBedrooms("N/A")).toBeNull();
      expect(parseBedrooms("Commercial")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 3. UNKNOWN CLASSIFICATION PRESERVATION (P0-06)
  // -------------------------------------------------------------------------
  describe("Preservation of Unknown Classifications (P0-06)", () => {
    it("should preserve null when property_usage_en is missing", () => {
      const sample = fixturesTx.find((f) => (f as any)._fixture_id === "tx_unknown_usage_and_reg")!;
      const classification = classifyTransaction(sample);

      expect(classification.isResidential).toBeNull();
      expect(classification.isOffPlan).toBeNull();
      expect(classification.isExcluded).toBe(false);
    });

    it("should preserve null when rent contract_reg_type_en is missing (never default to 'new')", () => {
      const sample = fixturesRent.find((f) => (f as any)._fixture_id === "rent_unknown_contract_type")!;
      const result = normalizeRentContract(sample, crosswalk);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.fact.contractType).toBeNull();
      }
    });

    it("should properly exclude non-sale and commercial land transactions", () => {
      const mortgage = fixturesTx.find((f) => (f as any)._fixture_id === "tx_non_sale_mortgage")!;
      const land = fixturesTx.find((f) => (f as any)._fixture_id === "tx_commercial_land_excluded")!;

      expect(classifyTransaction(mortgage).isExcluded).toBe(true);
      expect(classifyTransaction(mortgage).exclusionReason).toContain("non_sale:mortgage");

      expect(classifyTransaction(land).isExcluded).toBe(true);
      expect(classifyTransaction(land).exclusionReason).toBe("land");
    });
  });

  // -------------------------------------------------------------------------
  // 4. STABLE IDENTITY & ZERO RANDOM UUIDS (P0-05)
  // -------------------------------------------------------------------------
  describe("Stable Identity & Quarantine (P0-05)", () => {
    it("should quarantine transaction row when transaction_id is missing without inventing UUID", () => {
      const invalid = fixturesTx.find((f) => (f as any)._fixture_id === "tx_missing_primary_key_quarantined")!;
      const result = normalizeTransaction(invalid, crosswalk);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.quarantine.rejectionReason).toBe("missing_transaction_id");
        expect(result.quarantine.sourceRecordId).toBeUndefined();
      }
    });

    it("should quarantine rent contract row when contract_id is missing", () => {
      const invalid = fixturesRent.find((f) => (f as any)._fixture_id === "rent_missing_primary_key_quarantined")!;
      const result = normalizeRentContract(invalid, crosswalk);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.quarantine.rejectionReason).toBe("missing_contract_id");
      }
    });

    it("should quarantine service charge when composite keys are missing", () => {
      const invalid = fixturesSc.find((f) => (f as any)._fixture_id === "sc_missing_composite_key_quarantined")!;
      const result = normalizeServiceCharge(invalid, crosswalk);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.quarantine.rejectionReason).toBe("missing_composite_key");
      }
    });

    it("should quarantine records missing their required source date before a database write", () => {
      const transaction = normalizeTransaction({
        transaction_id: "tx_missing_date",
        instance_date: "2026-02-30",
      }, crosswalk);
      const rentContract = normalizeRentContract({
        contract_id: "rent_missing_date",
        line_number: 1,
        contract_start_date: null,
      }, crosswalk);

      expect(transaction).toMatchObject({
        success: false,
        quarantine: { rejectionReason: "missing_or_invalid_instance_date" },
      });
      expect(rentContract).toMatchObject({
        success: false,
        quarantine: { rejectionReason: "missing_or_invalid_contract_start_date" },
      });
    });

    it("should quarantine malformed numeric values instead of persisting NaN", () => {
      const transaction = normalizeTransaction({
        transaction_id: "tx_invalid_amount",
        instance_date: "2026-08-25",
        actual_worth: "not-a-number",
      }, crosswalk);
      const rentContract = normalizeRentContract({
        contract_id: "rent_invalid_amount",
        line_number: 1,
        contract_start_date: "2026-08-25",
        annual_amount: "not-a-number",
      }, crosswalk);
      const serviceCharge = normalizeServiceCharge({
        property_group_id: 100,
        budget_year: 2026,
        usage_id: 1,
        service_category_id: 1,
        service_cost: "17.4 AED",
      }, crosswalk);

      expect(transaction).toMatchObject({
        success: false,
        quarantine: { rejectionReason: "invalid_transaction_numeric_value" },
      });
      expect(rentContract).toMatchObject({
        success: false,
        quarantine: { rejectionReason: "invalid_rent_numeric_value" },
      });
      expect(serviceCharge).toMatchObject({
        success: false,
        quarantine: { rejectionReason: "invalid_service_cost" },
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5. PROJECT ID VS PROJECT NUMBER & DANGLING LINKS (P0-03)
  // -------------------------------------------------------------------------
  describe("Project ID vs Number Crosswalk & Zero Dangling Links (P0-03)", () => {
    it("should map Eden House project_number 3382 to canonical proj_dld_678813961", () => {
      const oqoodSample = fixturesTx.find((f) => (f as any)._fixture_id === "tx_offplan_oqood_eden_house")!;
      const result = normalizeTransaction(oqoodSample, crosswalk);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.fact.matchedProjectId).toBe("proj_dld_678813961");
        expect(result.fact.dldProjectId).toBe("678813961");
        expect(result.fact.matchConfidence).toBe("auto");
      }
    });

    it("should leave unmatched project numbers as null and never create proj_dld_<project_number>", () => {
      const unmappedRow: RawDldTransaction = {
        transaction_id: "tx_unmapped_123",
        instance_date: "2026-08-25",
        actual_worth: 1000000,
        procedure_area: 75.0,
        project_number: 999999, // Does not exist in crosswalk
      };

      const result = normalizeTransaction(unmappedRow, crosswalk);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.fact.matchedProjectId).toBeNull();
        expect(result.fact.matchConfidence).toBe("unmatched");
        expect(result.fact.matchedProjectId).not.toBe("proj_dld_999999");
      }
    });

    it("should not treat a canonical project ID in project_number as a verified crosswalk", () => {
      const transaction = normalizeTransaction({
        transaction_id: "tx_project_id_in_number_field",
        instance_date: "2026-08-25",
        actual_worth: 1000000,
        procedure_area: 75,
        project_number: 678813961,
      }, crosswalk);
      const rentContract = normalizeRentContract({
        contract_id: "rent_project_id_in_number_field",
        line_number: 1,
        contract_start_date: "2026-08-25",
        project_number: 678813961,
      }, crosswalk);

      expect(transaction).toMatchObject({
        success: true,
        fact: { matchedProjectId: null, matchConfidence: "unmatched" },
      });
      expect(rentContract).toMatchObject({
        success: true,
        fact: { matchedProjectId: null, matchConfidence: "unmatched" },
      });
    });
  });

  // -------------------------------------------------------------------------
  // 6. UNICODE & DUPLICATE NAME HANDLING (P0-04)
  // -------------------------------------------------------------------------
  describe("Unicode Retention & Duplicate Name Handling (P0-04)", () => {
    it("should preserve Arabic Unicode letters during normalization", () => {
      const arabicName = "أفينيو ريذدنس 5";
      const norm = normalizeProjectName(arabicName);

      // Must NOT strip Arabic and collapse to '5'
      expect(norm).toContain("أفينيو");
      expect(norm).toContain("5");
      expect(norm).not.toBe("5");
    });

    it("should detect ambiguous names and route to match_queue instead of auto-matching", () => {
      const ambiguousTx: RawDldTransaction = {
        transaction_id: "tx_ambiguous_01",
        instance_date: "2026-08-25",
        actual_worth: 2000000,
        procedure_area: 100.0,
        project_name_en: "Al Salam Tower 1", // Known duplicate name (900101 and 900102)
      };

      const result = normalizeTransaction(ambiguousTx, crosswalk);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.fact.matchedProjectId).toBeNull();
        expect(result.fact.matchConfidence).toBe("needs_review");
        expect(result.fact.needsReviewCandidates).toHaveLength(2);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 7. MULTI-PROPERTY RENT CONTRACTS (P0-02)
  // -------------------------------------------------------------------------
  describe("Multi-Property Rent Multiplicity (P0-02)", () => {
    it("should mark no_of_prop > 1 as isMultiProperty=true", () => {
      const multi = fixturesRent.find((f) => (f as any)._fixture_id === "rent_multi_prop_renewal")!;
      const result = normalizeRentContract(multi, crosswalk);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.fact.isMultiProperty).toBe(true);
        expect(result.fact.annualRentAed).toBe(1118500);
        expect(result.fact.contractType).toBe("renew");
      }
    });

    it("should mark no_of_prop == 1 as isMultiProperty=false", () => {
      const single = fixturesRent.find((f) => (f as any)._fixture_id === "rent_single_prop_renew")!;
      const result = normalizeRentContract(single, crosswalk);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.fact.isMultiProperty).toBe(false);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 8. REPLAY, CORRECTION & AUDIT RECONCILIATION (P0-05)
  // -------------------------------------------------------------------------
  describe("Replay, Correction & Count Reconciliation on Disposable DB (P0-05)", () => {
    it("should reconcile counts, skip duplicate replays, and record revisions on correction", async () => {
      const { db: testDb } = createTestDatabase();
      await ensureDldSourceConnection(testDb);

      const run1 = await createIngestionRun("dld_pipeline_duckdb", { mode: "initial" }, testDb);

      // Seed catalog project for foreign key integrity
      await testDb.insert(schema.projects).values({
        id: "proj_dld_678813961",
        nameEn: "Eden House The Park",
        dldProjectId: "678813961",
      });

      // 1. Initial import: 10 transactions
      const res1 = await importDldTransactions(fixturesTx, run1, { crosswalk, dbClient: testDb });

      expect(res1.fetched).toBe(10);
      expect(res1.inserted).toBe(9); // 9 valid transactions inserted
      expect(res1.quarantined).toBe(1); // 1 corrupt row quarantined
      expect(res1.skipped).toBe(0);
      expect(res1.updated).toBe(0);
      expect(res1.reconciled).toBe(true);

      // Verify revisions table recorded revision 1
      const revsInitial = await testDb.select().from(schema.sourceRecordRevisions);
      expect(revsInitial).toHaveLength(9);
      expect(revsInitial[0].revisionNo).toBe(1);
      expect(revsInitial[0].changeType).toBe("insert");

      // Verify quarantine record
      const quarantined = await testDb.select().from(schema.quarantinedRecords);
      expect(quarantined).toHaveLength(1);
      expect(quarantined[0].rejectionReason).toBe("missing_transaction_id");

      // 2. Replay identical batch in run2: must result in 0 duplicate facts added (all skipped)
      const run2 = await createIngestionRun("dld_pipeline_duckdb", { mode: "replay" }, testDb);
      const res2 = await importDldTransactions(fixturesTx, run2, { crosswalk, dbClient: testDb });

      expect(res2.fetched).toBe(10);
      expect(res2.inserted).toBe(0); // Zero duplicates added!
      expect(res2.skipped).toBe(9); // 9 identical records skipped!
      expect(res2.quarantined).toBe(1);
      expect(res2.reconciled).toBe(true);

      // Facts table count remains unchanged
      const txRowsAfterReplay = await testDb.select().from(schema.transactionFacts);
      expect(txRowsAfterReplay).toHaveLength(9);

      // 3. Pinned Report Snapshot immutability check
      const pinnedPayload = JSON.stringify({
        project: "Eden House",
        medianPsf: 38421,
        transactionsCount: 9,
      });
      await testDb.insert(schema.reportSnapshots).values({
        id: "rep_snap_001",
        projectId: "proj_dld_678813961",
        title: "Pinned Advisory Snapshot v1",
        snapshotHash: "hash_abcdef123456",
        payloadJson: pinnedPayload,
      });

      // 4. Source correction: one record's actual_worth is updated by DLD
      const correctedBatch: RawDldTransaction[] = [
        {
          ...fixturesTx[0],
          actual_worth: 2250000.0, // Corrected from 2100000
        },
      ];

      const run3 = await createIngestionRun("dld_pipeline_duckdb", { mode: "correction" }, testDb);
      const res3 = await importDldTransactions(correctedBatch, run3, { crosswalk, dbClient: testDb });

      expect(res3.fetched).toBe(1);
      expect(res3.inserted).toBe(0);
      expect(res3.updated).toBe(1); // Updated existing record!
      expect(res3.skipped).toBe(0);
      expect(res3.reconciled).toBe(true);

      // Verify updated fact value in table
      const updatedTx = await testDb
        .select()
        .from(schema.transactionFacts)
        .where(eq(schema.transactionFacts.id, "1-11-2026-26371"));
      expect(updatedTx[0].transactionValueAed).toBe(2250000);

      // Verify auditable new revision 2 created
      const revsForTx = await testDb
        .select()
        .from(schema.sourceRecordRevisions)
        .where(eq(schema.sourceRecordRevisions.sourceRecordId, "1-11-2026-26371"));
      expect(revsForTx).toHaveLength(2);
      expect(revsForTx[1].revisionNo).toBe(2);
      expect(revsForTx[1].changeType).toBe("correction");

      // Verify pinned report snapshot is still intact and completely unmodified
      const snapshot = await testDb
        .select()
        .from(schema.reportSnapshots)
        .where(eq(schema.reportSnapshots.id, "rep_snap_001"));
      expect(snapshot[0].payloadJson).toBe(pinnedPayload);
      expect(snapshot[0].snapshotHash).toBe("hash_abcdef123456");
    });
  });

  // -------------------------------------------------------------------------
  // 9. REPRODUCIBLE REPAIR SCRIPT VERIFICATION (P0-03)
  // -------------------------------------------------------------------------
  describe("Reproducible Repair Tool on Disposable Database Copy (P0-03)", () => {
    it("executes python3 scripts/repair_dld_project_links.py, clears dangling links, repairs resolvable, and preserves confirmed matches", () => {
      // 1. Create a disposable database file in scratch directory
      const scratchDir = path.join(process.cwd(), "scratch");
      if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
      const tempDbPath = path.join(scratchDir, `test_repair_${Date.now()}.db`);

      const tempSqlite = new Database(tempDbPath);
      const tempDb = drizzle(tempSqlite, { schema });
      migrate(tempDb, { migrationsFolder: path.join(process.cwd(), "db/migrations") });
      // Disable foreign keys to simulate pre-repair legacy state with dangling links
      tempSqlite.pragma("foreign_keys = OFF");

      // Seed valid canonical projects
      tempSqlite.exec(`
        INSERT INTO project (id, dld_project_id, name_en) VALUES
          ('proj_dld_678813961', '678813961', 'Eden House The Park'),
          ('proj_dld_83055243', '83055243', 'Azizi Aura Residences');
      `);

      // Seed rent contracts:
      // 1. Dangling resolvable link (proj_dld_3382 -> proj_dld_678813961)
      // 2. Dangling unresolvable link (proj_dld_999999 -> null)
      // 3. CONFIRMED link with custom project ID (must NOT be touched or cleared!)
      tempSqlite.exec(`
        INSERT INTO rent_contract_fact (id, contract_date, annual_rent_aed, matched_project_id, match_confidence)
        VALUES
          ('rent_dangling_01', '2025-10-01', 95000, 'proj_dld_3382', 'auto'),
          ('rent_unresolvable_02', '2025-10-01', 50000, 'proj_dld_999999', 'auto'),
          ('rent_confirmed_03', '2025-10-01', 120000, 'proj_confirmed_manual', 'confirmed');
      `);

      // Seed transaction facts:
      // 1. Transaction with resolvable project_number 3382
      // 2. Transaction with CONFIRMED manual match that must never be overwritten
      tempSqlite.exec(`
        INSERT INTO transaction_fact (id, transaction_date, transaction_value_aed, dld_project_id, matched_project_id, match_confidence)
        VALUES
          ('tx_dangling_01', '2025-10-01', 2000000, '3382', 'proj_dld_3382', 'auto'),
          ('tx_confirmed_02', '2025-10-01', 3000000, '3382', 'proj_manual_reviewer_choice', 'confirmed');
      `);

      tempSqlite.close();

      // Test 1: Dry run execution must not mutate database
      const pythonBin = resolvePythonBinary();
      const repairScript = path.join(process.cwd(), "scripts", "repair_dld_project_links.py");

      const dryRunOutput = execFileSync(pythonBin, [repairScript, "--db-path", tempDbPath, "--dry-run"], {
        encoding: "utf-8",
      });
      expect(dryRunOutput).toContain("Running Project Link Repair");

      // Verify dry-run made no changes
      const checkSqlite = new Database(tempDbPath);
      const rent1Before = checkSqlite
        .prepare("SELECT matched_project_id FROM rent_contract_fact WHERE id = 'rent_dangling_01'")
        .get() as { matched_project_id: string };
      expect(rent1Before.matched_project_id).toBe("proj_dld_3382");
      checkSqlite.close();

      // Test 2: Real execution on disposable copy
      const runOutput = execFileSync(pythonBin, [repairScript, "--db-path", tempDbPath], {
        encoding: "utf-8",
      });
      expect(runOutput).toContain("Applied rent contract link repairs");

      // Verify changes on database
      const postSqlite = new Database(tempDbPath);

      // Rent 1: Repaired to canonical proj_dld_678813961
      const repairedRent = postSqlite
        .prepare("SELECT matched_project_id, match_confidence FROM rent_contract_fact WHERE id = 'rent_dangling_01'")
        .get() as { matched_project_id: string; match_confidence: string };
      expect(repairedRent.matched_project_id).toBe("proj_dld_678813961");
      expect(repairedRent.match_confidence).toBe("auto");

      // Rent 2: Unresolvable cleared to null/unmatched
      const unresolvableRent = postSqlite
        .prepare("SELECT matched_project_id, match_confidence FROM rent_contract_fact WHERE id = 'rent_unresolvable_02'")
        .get() as { matched_project_id: string | null; match_confidence: string };
      expect(unresolvableRent.matched_project_id).toBeNull();
      expect(unresolvableRent.match_confidence).toBe("unmatched");

      // Rent 3: Confirmed match preserved untouched
      const confirmedRent = postSqlite
        .prepare("SELECT matched_project_id, match_confidence FROM rent_contract_fact WHERE id = 'rent_confirmed_03'")
        .get() as { matched_project_id: string; match_confidence: string };
      expect(confirmedRent.matched_project_id).toBe("proj_confirmed_manual");
      expect(confirmedRent.match_confidence).toBe("confirmed");

      // Tx 1: Repaired to canonical proj_dld_678813961
      const repairedTx = postSqlite
        .prepare("SELECT matched_project_id, match_confidence FROM transaction_fact WHERE id = 'tx_dangling_01'")
        .get() as { matched_project_id: string; match_confidence: string };
      expect(repairedTx.matched_project_id).toBe("proj_dld_678813961");

      // Tx 2: Confirmed match preserved untouched
      const confirmedTx = postSqlite
        .prepare("SELECT matched_project_id, match_confidence FROM transaction_fact WHERE id = 'tx_confirmed_02'")
        .get() as { matched_project_id: string; match_confidence: string };
      expect(confirmedTx.matched_project_id).toBe("proj_manual_reviewer_choice");
      expect(confirmedTx.match_confidence).toBe("confirmed");

      postSqlite.close();

      // Cleanup temp db file
      try {
        fs.unlinkSync(tempDbPath);
      } catch {}
    });
  });

  // -------------------------------------------------------------------------
  // 10. AED CURRENCY PRECISION POLICY & DECIMAL RENTS
  // -------------------------------------------------------------------------
  describe("AED Currency Precision Policy & Decimal Rents", () => {
    it("preserves valid decimal amounts up to 2 decimal places (fils) without float loss", () => {
      expect(parseOptionalAedAmount(85000.5)).toBe(85000.5);
      expect(parseOptionalAedAmount("85000.50")).toBe(85000.5);
      expect(parseOptionalAedAmount(1234.567)).toBe(1234.57); // rounds to fils
      expect(parseOptionalAedAmount(2500000)).toBe(2500000);
      expect(parseOptionalAedAmount(null)).toBeNull();
      expect(parseOptionalAedAmount(-100)).toBeNull();
    });

    it("normalizes and persists decimal rent contracts without integer truncation", async () => {
      const decimalFixture = fixturesRent.find(
        (f) => (f as any)._fixture_id === "rent_decimal_amount_preserved"
      )!;
      expect(decimalFixture).toBeDefined();

      const norm = normalizeRentContract(decimalFixture, crosswalk);
      expect(norm.success).toBe(true);
      if (norm.success) {
        expect(norm.fact.annualRentAed).toBe(85000.5);
      }

      // Persist in disposable DB
      const { db: testDb } = createTestDatabase();
      await ensureDldSourceConnection(testDb);
      const runId = await createIngestionRun("dld_pipeline_duckdb", { mode: "decimal_test" }, testDb);

      const res = await importDldRentContracts([decimalFixture], runId, { crosswalk, dbClient: testDb });
      expect(res.inserted).toBe(1);

      const persisted = await testDb
        .select({
          id: schema.rentContractFacts.id,
          annualRentAed: schema.rentContractFacts.annualRentAed,
        })
        .from(schema.rentContractFacts)
        .where(eq(schema.rentContractFacts.id, "CNT202611006_1"));

      expect(persisted).toHaveLength(1);
      expect(persisted[0].annualRentAed).toBe(85000.5);
    });
  });

  // -------------------------------------------------------------------------
  // 11. RENT COMPOSITE IDENTITY & MISSING LINE_NUMBER QUARANTINE
  // -------------------------------------------------------------------------
  describe("Rent Composite Identity & Missing line_number Quarantine", () => {
    it("strictly requires line_number and quarantines records when missing (never invents)", async () => {
      const missingLineFixture = fixturesRent.find(
        (f) => (f as any)._fixture_id === "rent_missing_line_number_quarantined"
      )!;
      expect(missingLineFixture).toBeDefined();

      const norm = normalizeRentContract(missingLineFixture, crosswalk);
      expect(norm.success).toBe(false);
      if (!norm.success) {
        expect(norm.quarantine.rejectionReason).toBe("missing_line_number");
      }

      // Check quarantine record in DB
      const { db: testDb } = createTestDatabase();
      await ensureDldSourceConnection(testDb);
      const runId = await createIngestionRun("dld_pipeline_duckdb", { mode: "quarantine_test" }, testDb);

      const res = await importDldRentContracts([missingLineFixture], runId, { crosswalk, dbClient: testDb });
      expect(res.quarantined).toBe(1);
      expect(res.inserted).toBe(0);

      const quarantined = await testDb
        .select()
        .from(schema.quarantinedRecords)
        .where(eq(schema.quarantinedRecords.sourceRunId, runId));

      expect(quarantined).toHaveLength(1);
      expect(quarantined[0].rejectionReason).toBe("missing_line_number");
    });
  });

  // -------------------------------------------------------------------------
  // 12. APARTMENT-ELIGIBLE CLASSIFICATION VS VILLA EXCLUSION
  // -------------------------------------------------------------------------
  describe("Apartment-Eligible Classification vs Villa Exclusion", () => {
    it("classifies apartments as isApartmentEligible=true and villas as isApartmentEligible=false", () => {
      // 1. Villa: honest source fact isResidential=true, but isApartmentEligible=false
      const villaTx: RawDldTransaction = {
        transaction_id: "tx_villa_01",
        instance_date: "2026-08-26",
        actual_worth: 5000000,
        procedure_area: 400.0,
        property_type_en: "Villa",
        property_usage_en: "Residential",
        trans_group_en: "Sales",
        reg_type_en: "Existing Properties",
      };
      const villaClass = classifyTransaction(villaTx);
      expect(villaClass.isResidential).toBe(true);
      expect(villaClass.isApartmentEligible).toBe(false);

      // 2. Townhouse: isResidential=true, isApartmentEligible=false
      const townhouseTx: RawDldTransaction = {
        transaction_id: "tx_th_01",
        instance_date: "2026-08-26",
        actual_worth: 3500000,
        procedure_area: 250.0,
        property_type_en: "Unit",
        property_sub_type_en: "Townhouse",
        property_usage_en: "Residential",
        trans_group_en: "Sales",
      };
      const thClass = classifyTransaction(townhouseTx);
      expect(thClass.isResidential).toBe(true);
      expect(thClass.isApartmentEligible).toBe(false);

      // 3. Flat / Apartment: isResidential=true, isApartmentEligible=true
      const aptTx: RawDldTransaction = {
        transaction_id: "tx_apt_01",
        instance_date: "2026-08-26",
        actual_worth: 1800000,
        procedure_area: 110.0,
        property_type_en: "Unit",
        property_sub_type_en: "Flat",
        property_usage_en: "Residential",
        trans_group_en: "Sales",
      };
      const aptClass = classifyTransaction(aptTx);
      expect(aptClass.isResidential).toBe(true);
      expect(aptClass.isApartmentEligible).toBe(true);

      // 4. Commercial office: isResidential=false, isApartmentEligible=false
      const commTx: RawDldTransaction = {
        transaction_id: "tx_comm_01",
        instance_date: "2026-08-26",
        actual_worth: 1200000,
        procedure_area: 80.0,
        property_type_en: "Unit",
        property_sub_type_en: "Office",
        property_usage_en: "Commercial",
        trans_group_en: "Sales",
      };
      const commClass = classifyTransaction(commTx);
      expect(commClass.isResidential).toBe(false);
      expect(commClass.isApartmentEligible).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 13. CONFIRMED PROJECT MATCH IMMUTABILITY
  // -------------------------------------------------------------------------
  describe("Confirmed Project Match Immutability", () => {
    it("never overwrites confirmed matches during automatic import or correction", async () => {
      const { db: testDb } = createTestDatabase();
      await ensureDldSourceConnection(testDb);

      await testDb.insert(schema.projects).values([
        {
          id: "proj_dld_678813961",
          nameEn: "Eden House The Park",
          dldProjectId: "678813961",
        },
        {
          id: "proj_manual_reviewer_confirmed",
          nameEn: "Reviewer Confirmed Project",
        },
      ]);

      const run1 = await createIngestionRun("dld_pipeline_duckdb", { mode: "confirmed_test" }, testDb);

      // 1. Insert a transaction with a manual/reviewer confirmed match
      await testDb.insert(schema.transactionFacts).values({
        id: "tx_confirmed_test_01",
        sourceRunId: run1,
        transactionDate: "2026-08-26",
        transactionValueAed: 2100000,
        matchedProjectId: "proj_manual_reviewer_confirmed",
        matchConfidence: "confirmed",
      });

      await testDb.insert(schema.sourceRecordRevisions).values({
        id: crypto.randomUUID(),
        sourceConnectionId: "dld_pipeline_duckdb",
        sourceRunId: run1,
        recordType: "transaction",
        sourceRecordId: "tx_confirmed_test_01",
        revisionNo: 1,
        rawPayload: JSON.stringify({ transaction_id: "tx_confirmed_test_01" }),
        payloadChecksum: "chk_rev1",
        changeType: "insert",
      });

      // 2. Incoming update row with project_number 3382 (which would normally auto-match proj_dld_678813961)
      const incomingRow: RawDldTransaction = {
        transaction_id: "tx_confirmed_test_01",
        instance_date: "2026-08-26",
        actual_worth: 2300000, // modified value
        procedure_area: 160.0,
        project_number: 3382,
      };

      const run2 = await createIngestionRun("dld_pipeline_duckdb", { mode: "correction_run" }, testDb);
      const res = await importDldTransactions([incomingRow], run2, { crosswalk, dbClient: testDb });

      expect(res.updated).toBe(1);

      // 3. Verify confirmed match was preserved!
      const fact = await testDb
        .select({
          matchedProjectId: schema.transactionFacts.matchedProjectId,
          matchConfidence: schema.transactionFacts.matchConfidence,
          transactionValueAed: schema.transactionFacts.transactionValueAed,
        })
        .from(schema.transactionFacts)
        .where(eq(schema.transactionFacts.id, "tx_confirmed_test_01"));

      expect(fact).toHaveLength(1);
      expect(fact[0].matchedProjectId).toBe("proj_manual_reviewer_confirmed"); // NOT overwritten by proj_dld_678813961!
      expect(fact[0].matchConfidence).toBe("confirmed"); // Still confirmed!
      expect(fact[0].transactionValueAed).toBe(2300000); // Value was updated
    });
  });

  // -------------------------------------------------------------------------
  // 14. CROSSWALK ERROR HANDLING
  // -------------------------------------------------------------------------
  describe("Crosswalk Error Handling", () => {
    it("fails import with an explicit error when crosswalk loading encounters an error", async () => {
      // Mock dbClient whose select throws
      const failingDbClient = {
        select: () => {
          throw new Error("Simulated database failure during crosswalk load");
        },
      } as any;

      await expect(loadProjectCrosswalk(failingDbClient)).rejects.toThrow(
        "Failed to load materialized projects for crosswalk"
      );
    });
  });

  // -------------------------------------------------------------------------
  // 15. SERVICE CHARGE RAW STORE & AUDIT POLICY
  // -------------------------------------------------------------------------
  describe("Service Charge Raw Store & Audit Policy", () => {
    it("persists raw_service_cost with raw_service_cost_unit='unknown' without converting to area charge", async () => {
      const scFixture = fixturesSc.find(
        (f) => (f as any)._fixture_id === "sc_azizi_aura_insurance_2022"
      )!;
      expect(scFixture).toBeDefined();

      const norm = normalizeServiceCharge(scFixture, crosswalk);
      expect(norm.success).toBe(true);
      if (norm.success) {
        expect(norm.fact.rawServiceCost).toBe(17.4);
        expect(norm.fact.rawServiceCostUnit).toBe("unknown");
        expect(norm.fact.annualChargePerSqft).toBeNull();
        expect(norm.fact.annualChargePerSqm).toBeNull();
      }

      // Persist in disposable DB
      const { db: testDb } = createTestDatabase();
      await ensureDldSourceConnection(testDb);
      await testDb.insert(schema.projects).values({
        id: "proj_dld_83055243",
        nameEn: "Azizi Aura Residences",
        dldProjectId: "83055243",
      });
      const runId = await createIngestionRun("dld_pipeline_duckdb", { mode: "sc_raw_test" }, testDb);

      const res = await importDldServiceCharges([scFixture], runId, { crosswalk, dbClient: testDb });
      expect(res.inserted).toBe(1);

      const persisted = await testDb
        .select({
          rawServiceCost: schema.serviceChargeFacts.rawServiceCost,
          rawServiceCostUnit: schema.serviceChargeFacts.rawServiceCostUnit,
          annualChargePerSqft: schema.serviceChargeFacts.annualChargePerSqft,
        })
        .from(schema.serviceChargeFacts)
        .where(eq(schema.serviceChargeFacts.id, "sc_243048329_2022_5_7"));

      expect(persisted).toHaveLength(1);
      expect(persisted[0].rawServiceCost).toBe(17.4);
      expect(persisted[0].rawServiceCostUnit).toBe("unknown");
      expect(persisted[0].annualChargePerSqft).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 16. UNIQUE REVISION CONSTRAINT
  // -------------------------------------------------------------------------
  describe("Unique Revision Constraint", () => {
    it("enforces uniqueness on (sourceConnectionId, recordType, sourceRecordId, revisionNo)", async () => {
      const { db: testDb } = createTestDatabase();
      await ensureDldSourceConnection(testDb);

      await testDb.insert(schema.sourceRecordRevisions).values({
        id: "rev_01",
        sourceConnectionId: "dld_pipeline_duckdb",
        recordType: "transaction",
        sourceRecordId: "tx_test_100",
        revisionNo: 1,
        rawPayload: "{}",
        payloadChecksum: "chk1",
        changeType: "insert",
      });

      // Inserting the same revisionNo for the same sourceRecordId must throw unique constraint error
      expect(() => {
        testDb.insert(schema.sourceRecordRevisions).values({
          id: "rev_02",
          sourceConnectionId: "dld_pipeline_duckdb",
          recordType: "transaction",
          sourceRecordId: "tx_test_100",
          revisionNo: 1, // Duplicate revision!
          rawPayload: "{}",
          payloadChecksum: "chk2",
          changeType: "correction",
        }).run();
      }).toThrow(/UNIQUE constraint failed/i);
    });
  });

  // -------------------------------------------------------------------------
  // 17. NATIVE DUCKDB/NODE PATH DATE & BIGINT HANDLING
  // -------------------------------------------------------------------------
  describe("Native DuckDB/Node Serialization & Type Conversion (DATE, BIGINT, Structs)", () => {
    it("normalizes transactions with native BigInt IDs, BigInt worth, and Date objects", () => {
      const rawWithNativeTypes: RawDldTransaction = {
        transaction_id: "tx_bigint_01",
        procedure_id: 9988776655443322n as unknown as number,
        procedure_name_en: "Sell",
        instance_date: new Date("2024-05-12T00:00:00.000Z") as unknown as string,
        registration_date: new Date("2024-05-12T00:00:00.000Z") as unknown as string,
        actual_worth: 3500000n as unknown as number,
        procedure_area: 120.5,
        rooms_en: "2 B/R",
        reg_type_en: "Existing Properties",
        property_usage_en: "Residential",
        property_type_en: "Unit",
        property_sub_type_en: "Apartment",
      };

      const res = normalizeTransaction(rawWithNativeTypes, crosswalk);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.fact.transactionDate).toBe("2024-05-12");
        expect(res.fact.registrationDate).toBe("2024-05-12");
        expect(res.fact.transactionValueAed).toBe(3500000);
        expect(res.fact.bedrooms).toBe(2);
        expect(res.fact.isApartmentEligible).toBe(true);
        expect(typeof res.fact.rawChecksum).toBe("string");
      }
    });

    it("normalizes rent contracts with native Date objects, BigInt annual amounts, and DuckDB { days } structs", () => {
      const rawRentNative: RawDldRentContract = {
        contract_id: "CNT99887766",
        line_number: 1n as unknown as number,
        contract_start_date: { days: 19854 } as unknown as string, // 19854 days from 1970-01-01 is 2024-05-11
        contract_end_date: new Date("2025-05-10T00:00:00.000Z") as unknown as string,
        contract_reg_type_en: "Renew",
        annual_amount: 85000n as unknown as number,
        actual_area: 95.0,
        no_of_prop: 1n as unknown as number,
        property_usage_en: "Residential",
        ejari_property_sub_type_en: "1 Bedroom Apartment",
      };

      const res = normalizeRentContract(rawRentNative, crosswalk);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.fact.id).toBe("CNT99887766_1");
        expect(res.fact.contractDate).toMatch(/^2024-05-1/);
        expect(res.fact.endDate).toBe("2025-05-10");
        expect(res.fact.annualRentAed).toBe(85000);
        expect(res.fact.isMultiProperty).toBe(false);
        expect(res.fact.isApartmentEligible).toBe(true);
      }
    });

    it("computes SHA-256 payload checksums with BigInt and Date values without throwing", () => {
      const payload = {
        id: 1234567890123456789n,
        date: new Date("2024-01-15T12:00:00.000Z"),
        cost: 45000n,
        note: "DuckDB native types test",
      };

      expect(() => {
        const hash = calculatePayloadChecksum(payload);
        expect(hash).toHaveLength(64);
      }).not.toThrow();
    });
  });
});


