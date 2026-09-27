/**
 * Authoritative DLD Pipeline Adapter
 * 
 * Rules:
 * - Single authoritative ingestion contract boundary for DLD open data.
 * - Exact observed DLD open data fields; zero invented default classifications.
 * - Studio = 0, unknown = null.
 * - Monetary values stored as integers (AED whole units).
 * - Area normalized to sqft (1 sqm = 10.7639104 sqft).
 * - Service cost billing unit is unassumed; never defaulted to AED/sqft without evidence.
 * - Zero random UUID fallbacks; invalid records quarantined.
 * - Replay idempotency: identical replays are skipped; corrections create auditable revisions.
 * - Canonical projects use DLD project_id ('proj_dld_<project_id>'); project_number mapped via crosswalk.
 * - Unicode preserved in project names; ambiguous matches sent to match_queue for review.
 */

import { db as defaultDb, type DB } from "@/server/db";
import {
  ingestionRuns,
  transactionFacts,
  rentContractFacts,
  serviceChargeFacts,
  sourceConnections,
  dataHealthChecks,
  sourceRecordRevisions,
  quarantinedRecords,
  matchQueue,
  projects,
} from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  SQM_TO_SQFT,
  parseBedrooms,
  classifyTransaction,
  normalizeProjectName,
  calculatePayloadChecksum,
  normalizeTransaction,
  normalizeRentContract,
  normalizeServiceCharge,
  type RawDldTransaction,
  type RawDldRentContract,
  type RawDldServiceCharge,
  type NormalizedTransactionFact,
  type NormalizedRentContractFact,
  type NormalizedServiceChargeFact,
  type ProjectCrosswalk,
} from "@/domain/dld/normalization";

export {
  SQM_TO_SQFT,
  parseBedrooms,
  classifyTransaction,
  normalizeProjectName,
  calculatePayloadChecksum,
  normalizeTransaction,
  normalizeRentContract,
  normalizeServiceCharge,
  type RawDldTransaction,
  type RawDldRentContract,
  type RawDldServiceCharge,
  type NormalizedTransactionFact,
  type NormalizedRentContractFact,
  type NormalizedServiceChargeFact,
  type ProjectCrosswalk,
};

export const DLD_SOURCE_ID = "dld_pipeline_duckdb";

// ---------------------------------------------------------------------------
// Bootstrap source connection
// ---------------------------------------------------------------------------

export async function ensureDldSourceConnection(dbClient?: DB) {
  const client = dbClient || defaultDb;
  const existing = await client
    .select()
    .from(sourceConnections)
    .where(eq(sourceConnections.id, DLD_SOURCE_ID))
    .limit(1);

  if (existing.length === 0) {
    await client.insert(sourceConnections).values({
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
// Load Project Crosswalk
// ---------------------------------------------------------------------------

export async function loadProjectCrosswalk(dbClient?: DB): Promise<ProjectCrosswalk> {
  const client = dbClient || defaultDb;
  const crosswalk: ProjectCrosswalk = {
    projectNumberToProjectId: new Map<string, string>(),
    materializedProjectIds: new Set<string>(),
    registryProjectIds: new Set<string>(),
    canonicalProjectIds: new Set<string>(),
    nameToProjectIds: new Map<string, string[]>(),
  };

  // 1. Load canonical project rows from SQLite database
  try {
    const existing = await client.select({
      id: projects.id,
      dldProjectId: projects.dldProjectId,
      dldProjectNumber: projects.dldProjectNumber,
      nameEn: projects.nameEn,
      nameAr: projects.nameAr,
    }).from(projects);

    for (const p of existing) {
      crosswalk.materializedProjectIds.add(p.id);
      crosswalk.canonicalProjectIds.add(p.id);
      const pid = p.dldProjectId || (p.id.startsWith("proj_dld_") ? p.id.replace("proj_dld_", "") : null);
      if (pid) {
        if (p.dldProjectNumber) {
          const rawPnum = String(p.dldProjectNumber).split(".")[0].trim();
          if (rawPnum) {
            crosswalk.projectNumberToProjectId.set(rawPnum, pid);
          }
        }
        if (p.nameEn) {
          const norm = normalizeProjectName(p.nameEn);
          if (norm) {
            const list = crosswalk.nameToProjectIds.get(norm) || [];
            if (!list.includes(pid)) list.push(pid);
            crosswalk.nameToProjectIds.set(norm, list);
          }
        }
        if (p.nameAr) {
          const norm = normalizeProjectName(p.nameAr);
          if (norm) {
            const list = crosswalk.nameToProjectIds.get(norm) || [];
            if (!list.includes(pid)) list.push(pid);
            crosswalk.nameToProjectIds.set(norm, list);
          }
        }
      }
    }
  } catch (err) {
    throw new Error(`Failed to load materialized projects for crosswalk: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Load verified registry from tracked JSON or all_dld_projects.json
  const candidateRegistryPaths = [
    path.join(process.cwd(), "docs", "data-contracts", "dld_project_crosswalk.json"),
    path.join(process.cwd(), "DLD PIPELINE", "data", "all_dld_projects.json"),
  ];

  for (const regPath of candidateRegistryPaths) {
    if (fs.existsSync(regPath)) {
      try {
        const raw = fs.readFileSync(regPath, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            const pid = item.project_id ? String(item.project_id).split(".")[0].trim() : null;
            const pnum = item.project_number ? String(item.project_number).split(".")[0].trim() : null;
            if (pid && pnum && !crosswalk.projectNumberToProjectId.has(pnum)) {
              crosswalk.projectNumberToProjectId.set(pnum, pid);
            }
            if (pid) {
              crosswalk.registryProjectIds.add(pid);
              const nameEn = item.project_name_en || item.name_en;
              const nameAr = item.project_name || item.project_name_ar || item.name_ar;
              for (const n of [nameEn, nameAr]) {
                if (n) {
                  const norm = normalizeProjectName(n);
                  if (norm) {
                    const existingList = crosswalk.nameToProjectIds.get(norm) || [];
                    if (!existingList.includes(pid)) existingList.push(pid);
                    crosswalk.nameToProjectIds.set(norm, existingList);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        throw new Error(`Failed to load DLD project registry crosswalk from ${regPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return crosswalk;
}

// ---------------------------------------------------------------------------
// Import Transactions
// ---------------------------------------------------------------------------

export interface ImportSummary {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  quarantined: number;
  excluded: number;
  reconciled: boolean;
}

export async function importDldTransactions(
  rows: RawDldTransaction[],
  runId: string,
  options?: { crosswalk?: ProjectCrosswalk; dbClient?: DB }
): Promise<ImportSummary> {
  const client = options?.dbClient || defaultDb;
  const crosswalk = options?.crosswalk || (await loadProjectCrosswalk(client));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let quarantined = 0;
  let excluded = 0;

  for (const row of rows) {
    const norm = normalizeTransaction(row, crosswalk);
    if (!norm.success) {
      quarantined++;
      await client.insert(quarantinedRecords).values({
        id: crypto.randomUUID(),
        sourceConnectionId: DLD_SOURCE_ID,
        sourceRunId: runId,
        recordType: "transaction",
        rawPayload: JSON.stringify(norm.quarantine.rawPayload),
        rejectionReason: norm.quarantine.rejectionReason,
      });
      continue;
    }

    const fact = norm.fact;
    if (fact.isExcluded) excluded++;

    // Check if fact already exists
    const existing = await client
      .select({
        id: transactionFacts.id,
        sourceRunId: transactionFacts.sourceRunId,
        transactionValueAed: transactionFacts.transactionValueAed,
        areaSqm: transactionFacts.areaSqm,
        matchedProjectId: transactionFacts.matchedProjectId,
        matchConfidence: transactionFacts.matchConfidence,
      })
      .from(transactionFacts)
      .where(eq(transactionFacts.id, fact.id))
      .limit(1);

    if (existing.length === 0) {
      // New insert: atomic transaction across fact, revision, and review queue
      client.transaction((tx) => {
        tx.insert(transactionFacts).values({
          id: fact.id,
          sourceRunId: runId,
          transactionNo: fact.transactionNo,
          transactionDate: fact.transactionDate,
          registrationDate: fact.registrationDate,
          areaNameEn: fact.areaNameEn,
          buildingNameEn: fact.buildingNameEn,
          projectNameEn: fact.projectNameEn,
          dldProjectId: fact.dldProjectId,
          unitNo: fact.unitNo,
          bedrooms: fact.bedrooms,
          areaSqm: fact.areaSqm,
          areaSqft: fact.areaSqft,
          transactionValueAed: fact.transactionValueAed,
          pricePerSqftAed: fact.pricePerSqftAed,
          transactionType: fact.transactionType,
          propertyType: fact.propertyType,
          propertySubtype: fact.propertySubtype,
          isOffPlan: fact.isOffPlan,
          isResidential: fact.isResidential,
          isApartmentEligible: fact.isApartmentEligible,
          isExcluded: fact.isExcluded,
          exclusionReason: fact.exclusionReason,
          matchedProjectId: fact.matchedProjectId,
          matchedBuildingId: fact.matchedBuildingId,
          matchConfidence: fact.matchConfidence,
        }).run();

        // Audit revision 1
        tx.insert(sourceRecordRevisions).values({
          id: crypto.randomUUID(),
          sourceConnectionId: DLD_SOURCE_ID,
          sourceRunId: runId,
          recordType: "transaction",
          sourceRecordId: fact.id,
          revisionNo: 1,
          rawPayload: JSON.stringify(row),
          payloadChecksum: fact.rawChecksum,
          changeType: "insert",
        }).run();

        // Review queue if ambiguous name
        if (fact.matchConfidence === "needs_review") {
          tx
            .insert(matchQueue)
            .values({
              id: crypto.randomUUID(),
              status: "needs_review",
              candidateType: "project",
              internalId: fact.needsReviewCandidates && fact.needsReviewCandidates.length === 1 ? `proj_dld_${fact.needsReviewCandidates[0]}` : null,
              externalSource: "dld",
              externalKey: fact.id,
              externalName: fact.projectNameEn,
              matchScore: fact.needsReviewCandidates && fact.needsReviewCandidates.length === 1 ? 0.75 : 0.5,
              matchReason: fact.needsReviewCandidates && fact.needsReviewCandidates.length === 1 ? "name_only_match" : "ambiguous_name_multiple_candidates",
              rejectionReason: null,
              confirmedBy: null,
            })
            .onConflictDoNothing()
            .run();
        }
      });

      inserted++;
    } else {
      // Existing row: check latest revision checksum to detect identical replay vs correction
      const latestRev = await client
        .select({
          revisionNo: sourceRecordRevisions.revisionNo,
          payloadChecksum: sourceRecordRevisions.payloadChecksum,
        })
        .from(sourceRecordRevisions)
        .where(
          and(
            eq(sourceRecordRevisions.recordType, "transaction"),
            eq(sourceRecordRevisions.sourceRecordId, fact.id)
          )
        )
        .orderBy(desc(sourceRecordRevisions.revisionNo))
        .limit(1);

      const isIdentical = latestRev.length > 0 && latestRev[0].payloadChecksum === fact.rawChecksum;

      if (isIdentical) {
        skipped++;
      } else {
        // Source correction: preserve confirmed match if manually confirmed
        const hasExistingRev = latestRev.length > 0;
        const nextRevNo = hasExistingRev ? latestRev[0].revisionNo + 1 : 2;
        const isConfirmed = existing[0].matchConfidence === "confirmed";
        const targetMatchedProjectId = isConfirmed ? existing[0].matchedProjectId : fact.matchedProjectId;
        const targetMatchConfidence = isConfirmed ? "confirmed" : fact.matchConfidence;

        client.transaction((tx) => {
          // If existing record has no baseline revision, record baseline revision 1 first
          if (!hasExistingRev) {
            tx.insert(sourceRecordRevisions).values({
              id: crypto.randomUUID(),
              sourceConnectionId: DLD_SOURCE_ID,
              sourceRunId: existing[0].sourceRunId || runId,
              recordType: "transaction",
              sourceRecordId: fact.id,
              revisionNo: 1,
              rawPayload: JSON.stringify(existing[0]),
              payloadChecksum: calculatePayloadChecksum(existing[0]),
              changeType: "baseline",
            }).run();
          }

          tx
            .update(transactionFacts)
            .set({
              sourceRunId: runId,
              transactionDate: fact.transactionDate,
              registrationDate: fact.registrationDate,
              areaNameEn: fact.areaNameEn,
              buildingNameEn: fact.buildingNameEn,
              projectNameEn: fact.projectNameEn,
              dldProjectId: fact.dldProjectId,
              bedrooms: fact.bedrooms,
              areaSqm: fact.areaSqm,
              areaSqft: fact.areaSqft,
              transactionValueAed: fact.transactionValueAed,
              pricePerSqftAed: fact.pricePerSqftAed,
              transactionType: fact.transactionType,
              propertyType: fact.propertyType,
              propertySubtype: fact.propertySubtype,
              isOffPlan: fact.isOffPlan,
              isResidential: fact.isResidential,
              isApartmentEligible: fact.isApartmentEligible,
              isExcluded: fact.isExcluded,
              exclusionReason: fact.exclusionReason,
              matchedProjectId: targetMatchedProjectId,
              matchConfidence: targetMatchConfidence,
            })
            .where(eq(transactionFacts.id, fact.id))
            .run();

          tx.insert(sourceRecordRevisions).values({
            id: crypto.randomUUID(),
            sourceConnectionId: DLD_SOURCE_ID,
            sourceRunId: runId,
            recordType: "transaction",
            sourceRecordId: fact.id,
            revisionNo: nextRevNo,
            rawPayload: JSON.stringify(row),
            payloadChecksum: fact.rawChecksum,
            changeType: "correction",
          }).run();

          // Maintain review queue on correction
          if (!isConfirmed) {
            if (targetMatchConfidence === "needs_review") {
              tx
                .insert(matchQueue)
                .values({
                  id: crypto.randomUUID(),
                  status: "needs_review",
                  candidateType: "project",
                  internalId: fact.needsReviewCandidates && fact.needsReviewCandidates.length === 1 ? `proj_dld_${fact.needsReviewCandidates[0]}` : null,
                  externalSource: "dld",
                  externalKey: fact.id,
                  externalName: fact.projectNameEn,
                  matchScore: fact.needsReviewCandidates && fact.needsReviewCandidates.length === 1 ? 0.75 : 0.5,
                  matchReason: fact.needsReviewCandidates && fact.needsReviewCandidates.length === 1 ? "name_only_match" : "ambiguous_name_multiple_candidates",
                  rejectionReason: null,
                  confirmedBy: null,
                })
                .onConflictDoNothing()
                .run();
            } else if (targetMatchConfidence === "auto") {
              tx
                .update(matchQueue)
                .set({ status: "auto_resolved" })
                .where(and(eq(matchQueue.externalKey, fact.id), eq(matchQueue.status, "needs_review")))
                .run();
            }
          }
        });

        updated++;
      }
    }
  }

  const fetched = rows.length;
  const reconciled = fetched === inserted + updated + skipped + quarantined;
  return { fetched, inserted, updated, skipped, quarantined, excluded, reconciled };
}

// ---------------------------------------------------------------------------
// Import Rent Contracts
// ---------------------------------------------------------------------------

export async function importDldRentContracts(
  rows: RawDldRentContract[],
  runId: string,
  options?: { crosswalk?: ProjectCrosswalk; dbClient?: DB }
): Promise<ImportSummary> {
  const client = options?.dbClient || defaultDb;
  const crosswalk = options?.crosswalk || (await loadProjectCrosswalk(client));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let quarantined = 0;
  let excluded = 0;

  for (const row of rows) {
    const norm = normalizeRentContract(row, crosswalk);
    if (!norm.success) {
      quarantined++;
      await client.insert(quarantinedRecords).values({
        id: crypto.randomUUID(),
        sourceConnectionId: DLD_SOURCE_ID,
        sourceRunId: runId,
        recordType: "rent_contract",
        rawPayload: JSON.stringify(norm.quarantine.rawPayload),
        rejectionReason: norm.quarantine.rejectionReason,
      });
      continue;
    }

    const fact = norm.fact;
    if (fact.isExcluded) excluded++;

    const existing = await client
      .select({
        id: rentContractFacts.id,
        sourceRunId: rentContractFacts.sourceRunId,
        matchedProjectId: rentContractFacts.matchedProjectId,
        matchConfidence: rentContractFacts.matchConfidence,
      })
      .from(rentContractFacts)
      .where(eq(rentContractFacts.id, fact.id))
      .limit(1);

    if (existing.length === 0) {
      client.transaction((tx) => {
        tx.insert(rentContractFacts).values({
          id: fact.id,
          sourceRunId: runId,
          contractDate: fact.contractDate,
          startDate: fact.startDate,
          endDate: fact.endDate,
          contractType: fact.contractType,
          areaNameEn: fact.areaNameEn,
          buildingNameEn: fact.buildingNameEn,
          unitNo: fact.unitNo,
          bedrooms: fact.bedrooms,
          areaSqm: fact.areaSqm,
          areaSqft: fact.areaSqft,
          annualRentAed: fact.annualRentAed,
          propertyUsage: fact.propertyUsage,
          isResidential: fact.isResidential,
          isApartmentEligible: fact.isApartmentEligible,
          isMultiProperty: fact.isMultiProperty,
          isExcluded: fact.isExcluded,
          exclusionReason: fact.exclusionReason,
          matchedProjectId: fact.matchedProjectId,
          matchConfidence: fact.matchConfidence,
        }).run();

        tx.insert(sourceRecordRevisions).values({
          id: crypto.randomUUID(),
          sourceConnectionId: DLD_SOURCE_ID,
          sourceRunId: runId,
          recordType: "rent_contract",
          sourceRecordId: fact.id,
          revisionNo: 1,
          rawPayload: JSON.stringify(row),
          payloadChecksum: fact.rawChecksum,
          changeType: "insert",
        }).run();
      });

      inserted++;
    } else {
      const latestRev = await client
        .select({
          revisionNo: sourceRecordRevisions.revisionNo,
          payloadChecksum: sourceRecordRevisions.payloadChecksum,
        })
        .from(sourceRecordRevisions)
        .where(
          and(
            eq(sourceRecordRevisions.recordType, "rent_contract"),
            eq(sourceRecordRevisions.sourceRecordId, fact.id)
          )
        )
        .orderBy(desc(sourceRecordRevisions.revisionNo))
        .limit(1);

      const isIdentical = latestRev.length > 0 && latestRev[0].payloadChecksum === fact.rawChecksum;

      if (isIdentical) {
        skipped++;
      } else {
        const hasExistingRev = latestRev.length > 0;
        const nextRevNo = hasExistingRev ? latestRev[0].revisionNo + 1 : 2;
        const isConfirmed = existing[0].matchConfidence === "confirmed";
        const targetMatchedProjectId = isConfirmed ? existing[0].matchedProjectId : fact.matchedProjectId;
        const targetMatchConfidence = isConfirmed ? "confirmed" : fact.matchConfidence;

        client.transaction((tx) => {
          if (!hasExistingRev) {
            tx.insert(sourceRecordRevisions).values({
              id: crypto.randomUUID(),
              sourceConnectionId: DLD_SOURCE_ID,
              sourceRunId: existing[0].sourceRunId || runId,
              recordType: "rent_contract",
              sourceRecordId: fact.id,
              revisionNo: 1,
              rawPayload: JSON.stringify(existing[0]),
              payloadChecksum: calculatePayloadChecksum(existing[0]),
              changeType: "baseline",
            }).run();
          }

          tx
            .update(rentContractFacts)
            .set({
              sourceRunId: runId,
              contractDate: fact.contractDate,
              startDate: fact.startDate,
              endDate: fact.endDate,
              contractType: fact.contractType,
              areaNameEn: fact.areaNameEn,
              buildingNameEn: fact.buildingNameEn,
              bedrooms: fact.bedrooms,
              areaSqm: fact.areaSqm,
              areaSqft: fact.areaSqft,
              annualRentAed: fact.annualRentAed,
              propertyUsage: fact.propertyUsage,
              isResidential: fact.isResidential,
              isApartmentEligible: fact.isApartmentEligible,
              isMultiProperty: fact.isMultiProperty,
              isExcluded: fact.isExcluded,
              exclusionReason: fact.exclusionReason,
              matchedProjectId: targetMatchedProjectId,
              matchConfidence: targetMatchConfidence,
            })
            .where(eq(rentContractFacts.id, fact.id))
            .run();

          tx.insert(sourceRecordRevisions).values({
            id: crypto.randomUUID(),
            sourceConnectionId: DLD_SOURCE_ID,
            sourceRunId: runId,
            recordType: "rent_contract",
            sourceRecordId: fact.id,
            revisionNo: nextRevNo,
            rawPayload: JSON.stringify(row),
            payloadChecksum: fact.rawChecksum,
            changeType: "correction",
          }).run();

          if (!isConfirmed) {
            if (targetMatchConfidence === "needs_review") {
              tx
                .insert(matchQueue)
                .values({
                  id: crypto.randomUUID(),
                  status: "needs_review",
                  candidateType: "project",
                  internalId: null,
                  externalSource: "dld_rent",
                  externalKey: fact.id,
                  externalName: fact.buildingNameEn,
                  matchScore: 0.5,
                  matchReason: "ambiguous_name_multiple_candidates",
                  rejectionReason: null,
                  confirmedBy: null,
                })
                .onConflictDoNothing()
                .run();
            } else if (targetMatchConfidence === "auto") {
              tx
                .update(matchQueue)
                .set({ status: "auto_resolved" })
                .where(and(eq(matchQueue.externalKey, fact.id), eq(matchQueue.status, "needs_review")))
                .run();
            }
          }
        });

        updated++;
      }
    }
  }

  const fetched = rows.length;
  const reconciled = fetched === inserted + updated + skipped + quarantined;
  return { fetched, inserted, updated, skipped, quarantined, excluded, reconciled };
}

// ---------------------------------------------------------------------------
// Import Service Charges
// ---------------------------------------------------------------------------

export async function importDldServiceCharges(
  rows: RawDldServiceCharge[],
  runId: string,
  options?: { crosswalk?: ProjectCrosswalk; dbClient?: DB }
): Promise<ImportSummary> {
  const client = options?.dbClient || defaultDb;
  const crosswalk = options?.crosswalk || (await loadProjectCrosswalk(client));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let quarantined = 0;
  const excluded = 0;

  for (const row of rows) {
    const norm = normalizeServiceCharge(row, crosswalk);
    if (!norm.success) {
      quarantined++;
      await client.insert(quarantinedRecords).values({
        id: crypto.randomUUID(),
        sourceConnectionId: DLD_SOURCE_ID,
        sourceRunId: runId,
        recordType: "service_charge",
        rawPayload: JSON.stringify(norm.quarantine.rawPayload),
        rejectionReason: norm.quarantine.rejectionReason,
      });
      continue;
    }

    const fact = norm.fact;

    const existing = await client
      .select({ id: serviceChargeFacts.id })
      .from(serviceChargeFacts)
      .where(eq(serviceChargeFacts.id, fact.id))
      .limit(1);

    if (existing.length === 0) {
      client.transaction((tx) => {
        tx.insert(serviceChargeFacts).values({
          id: fact.id,
          sourceRunId: runId,
          year: fact.year,
          buildingNameEn: fact.buildingNameEn,
          areaNameEn: fact.areaNameEn,
          annualChargePerSqft: fact.annualChargePerSqft,
          annualChargePerSqm: fact.annualChargePerSqm,
          chargeCategory: fact.chargeCategory,
          matchedProjectId: fact.matchedProjectId,
          matchedBuildingId: fact.matchedBuildingId,
          rawServiceCost: fact.rawServiceCost,
          rawServiceCostUnit: fact.rawServiceCostUnit,
        }).run();

        tx.insert(sourceRecordRevisions).values({
          id: crypto.randomUUID(),
          sourceConnectionId: DLD_SOURCE_ID,
          sourceRunId: runId,
          recordType: "service_charge",
          sourceRecordId: fact.id,
          revisionNo: 1,
          rawPayload: JSON.stringify(row),
          payloadChecksum: fact.rawChecksum,
          changeType: "insert",
        }).run();
      });

      inserted++;
    } else {
      const latestRev = await client
        .select({
          revisionNo: sourceRecordRevisions.revisionNo,
          payloadChecksum: sourceRecordRevisions.payloadChecksum,
        })
        .from(sourceRecordRevisions)
        .where(
          and(
            eq(sourceRecordRevisions.recordType, "service_charge"),
            eq(sourceRecordRevisions.sourceRecordId, fact.id)
          )
        )
        .orderBy(desc(sourceRecordRevisions.revisionNo))
        .limit(1);

      const isIdentical = latestRev.length > 0 && latestRev[0].payloadChecksum === fact.rawChecksum;

      if (isIdentical) {
        skipped++;
      } else {
        const hasExistingRev = latestRev.length > 0;
        const nextRevNo = hasExistingRev ? latestRev[0].revisionNo + 1 : 2;

        client.transaction((tx) => {
          if (!hasExistingRev) {
            tx.insert(sourceRecordRevisions).values({
              id: crypto.randomUUID(),
              sourceConnectionId: DLD_SOURCE_ID,
              sourceRunId: runId,
              recordType: "service_charge",
              sourceRecordId: fact.id,
              revisionNo: 1,
              rawPayload: JSON.stringify(row),
              payloadChecksum: calculatePayloadChecksum(row),
              changeType: "baseline",
            }).run();
          }

          tx
            .update(serviceChargeFacts)
            .set({
              sourceRunId: runId,
              year: fact.year,
              buildingNameEn: fact.buildingNameEn,
              areaNameEn: fact.areaNameEn,
              annualChargePerSqft: fact.annualChargePerSqft,
              annualChargePerSqm: fact.annualChargePerSqm,
              chargeCategory: fact.chargeCategory,
              matchedProjectId: fact.matchedProjectId,
              rawServiceCost: fact.rawServiceCost,
              rawServiceCostUnit: fact.rawServiceCostUnit,
            })
            .where(eq(serviceChargeFacts.id, fact.id))
            .run();

          tx.insert(sourceRecordRevisions).values({
            id: crypto.randomUUID(),
            sourceConnectionId: DLD_SOURCE_ID,
            sourceRunId: runId,
            recordType: "service_charge",
            sourceRecordId: fact.id,
            revisionNo: nextRevNo,
            rawPayload: JSON.stringify(row),
            payloadChecksum: fact.rawChecksum,
            changeType: "correction",
          }).run();
        });

        updated++;
      }
    }
  }

  const fetched = rows.length;
  const reconciled = fetched === inserted + updated + skipped + quarantined;
  return { fetched, inserted, updated, skipped, quarantined, excluded, reconciled };
}

// ---------------------------------------------------------------------------
// Run Management
// ---------------------------------------------------------------------------

export async function createIngestionRun(
  sourceId: string,
  filterParams: Record<string, unknown>,
  dbClient?: DB
): Promise<string> {
  const client = dbClient || defaultDb;
  const runId = `run_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await client.insert(ingestionRuns).values({
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
  counts: { fetched: number; inserted: number; updated?: number; skipped: number; quarantined?: number },
  error?: string,
  dbClient?: DB
) {
  const client = dbClient || defaultDb;
  await client
    .update(ingestionRuns)
    .set({
      status: error ? "failed" : "done",
      completedAt: new Date().toISOString(),
      recordsFetched: counts.fetched,
      recordsInserted: counts.inserted,
      recordsUpdated: counts.updated ?? 0,
      recordsSkipped: counts.skipped,
      recordsQuarantined: counts.quarantined ?? 0,
      errorMessage: error ?? null,
    })
    .where(eq(ingestionRuns.id, runId));
}

export async function recordHealthCheck(
  sourceId: string,
  stats: {
    totalRecords: number;
    oldestRecord?: string;
    newestRecord?: string;
    status: "ok" | "stale" | "missing" | "schema_drift";
    notes?: string;
  },
  dbClient?: DB
) {
  const client = dbClient || defaultDb;
  await client.insert(dataHealthChecks).values({
    id: crypto.randomUUID(),
    sourceConnectionId: sourceId,
    totalRecords: stats.totalRecords,
    oldestRecord: stats.oldestRecord ?? null,
    newestRecord: stats.newestRecord ?? null,
    status: stats.status,
    coverageNotes: stats.notes ?? null,
  });
}
