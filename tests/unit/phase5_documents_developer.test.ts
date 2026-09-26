import { describe, it, expect } from "vitest";
import {
  buildDeveloperTrackRecord,
  DeveloperProjectFact,
} from "@/domain/developer/developer-track-record";
import {
  evaluateCompetingSupply,
  CompetingProjectItem,
  getYearQuarter,
} from "@/domain/pipeline/competing-supply";
import {
  parseDeveloperOfferBuffer,
  checkOfferFreshness,
  normalizeBedrooms,
  normalizeAvailability,
} from "@/domain/imports/offer-parser";
import * as XLSX from "xlsx";

describe("Phase 5: Document Imports & Developer Track Record Test Suite (§10, §13, §14)", () => {
  // -------------------------------------------------------------------------
  // 1. Developer Track Record & Construction History (§13)
  // -------------------------------------------------------------------------
  describe("1. Developer Track Record Engine (§13)", () => {
    it("Calculates late_days = max(0, actual - promised), average delay and on-time rate", () => {
      const mockProjects: DeveloperProjectFact[] = [
        {
          projectId: "p1",
          projectName: "Tower One",
          status: "completed",
          originalPromisedDate: "2024-01-01",
          actualHandoverDate: "2024-01-01", // On time (0 days)
        },
        {
          projectId: "p2",
          projectName: "Tower Two",
          status: "completed",
          originalPromisedDate: "2024-06-01",
          actualHandoverDate: "2024-09-01", // ~92 days late (~3 months)
        },
        {
          projectId: "p3",
          projectName: "Tower Three",
          status: "completed",
          originalPromisedDate: "2025-01-01",
          actualHandoverDate: "2024-12-01", // Early delivery: max(0, -31) = 0 late days
        },
      ];

      const record = buildDeveloperTrackRecord("dev-1", "Emaar Properties", "Emaar", mockProjects);

      expect(record.completedProjectsCount).toBe(3);
      expect(record.projectsWithHandoverData).toBe(3);
      expect(record.earlyOrOnTimeCount).toBe(2); // 2 delivered on or before promised
      expect(record.delayedProjectsCount).toBe(1);
      // On-time rate: 2 / 3 = 66.666...%
      expect(record.onTimeDeliveryRatePercent.toFixed(1)).toBe("66.7");
      // Average delay must be >= 0 and reflect the ~1 month average across the 3 projects
      expect(record.averageDelayMonths.toNumber()).toBeGreaterThan(0.5);
      expect(record.averageDelayMonths.toNumber()).toBeLessThan(2.0);
    });

    it("Tracks overdue active projects where current date is past promised handover", () => {
      const mockProjects: DeveloperProjectFact[] = [
        {
          projectId: "p1",
          projectName: "Overdue Residence",
          status: "active",
          originalPromisedDate: "2025-01-01", // Past date relative to 2026-09-24
          actualHandoverDate: null,
          constructionProgressPct: 65,
        },
        {
          projectId: "p2",
          projectName: "Future Residence",
          status: "active",
          originalPromisedDate: "2028-12-01",
          actualHandoverDate: null,
          constructionProgressPct: 20,
        },
      ];

      const record = buildDeveloperTrackRecord(
        "dev-2",
        "Slow Developer LLC",
        null,
        mockProjects,
        "2026-09-24"
      );

      expect(record.activeProjectsCount).toBe(2);
      expect(record.overdueActiveCount).toBe(1);
      expect(record.reliabilityRatingBadge).toBe("INSUFFICIENT_HISTORY"); // < 2 completed projects
    });

    it("Assigns PROVEN_DISCIPLINE badge for developer with high on-time rate and low delay", () => {
      const mockProjects: DeveloperProjectFact[] = [
        { projectId: "p1", projectName: "A", status: "completed", originalPromisedDate: "2024-01-01", actualHandoverDate: "2024-01-01" },
        { projectId: "p2", projectName: "B", status: "completed", originalPromisedDate: "2024-06-01", actualHandoverDate: "2024-06-01" },
        { projectId: "p3", projectName: "C", status: "completed", originalPromisedDate: "2025-01-01", actualHandoverDate: "2025-01-01" },
      ];

      const record = buildDeveloperTrackRecord("dev-3", "Top Tier Dev", "Brand A", mockProjects);
      expect(record.reliabilityRatingBadge).toBe("PROVEN_DISCIPLINE");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Competing Supply & Cluster Pipeline (§14)
  // -------------------------------------------------------------------------
  describe("2. Competing Supply & Handover Collision Engine (§14)", () => {
    it("Converts dates to quarters accurately", () => {
      expect(getYearQuarter("2027-02-15")).toBe("2027-Q1");
      expect(getYearQuarter("2027-05-10")).toBe("2027-Q2");
      expect(getYearQuarter("2027-08-20")).toBe("2027-Q3");
      expect(getYearQuarter("2027-11-01")).toBe("2027-Q4");
    });

    it("Detects handover collision in the +/- 6 months window", () => {
      const targetProjectId = "target-1";
      const targetHandover = "2027-06-01"; // 2027-Q2

      const nearby: CompetingProjectItem[] = [
        // Within 6 months (Collision)
        { id: "comp-1", nameEn: "Adjacent Tower A", expectedHandoverDate: "2027-04-01", constructionProgressPct: 75, totalUnitsReported: 400, status: "active" },
        { id: "comp-2", nameEn: "Adjacent Tower B", expectedHandoverDate: "2027-08-01", constructionProgressPct: 70, totalUnitsReported: 350, status: "active" },
        // Outside 6 months (Safe)
        { id: "comp-3", nameEn: "Far Future Tower", expectedHandoverDate: "2028-12-01", constructionProgressPct: 15, totalUnitsReported: 800, status: "active" },
      ];

      const analysis = evaluateCompetingSupply(targetProjectId, targetHandover, nearby);

      expect(analysis.targetQuarter).toBe("2027-Q2");
      expect(analysis.collisionWindowProjectsCount).toBe(2);
      expect(analysis.collisionWindowUnitsCount).toBe(750); // 400 + 350
      expect(analysis.supplyPressureRisk).toBe("MODERATE_PRESSURE");
    });

    it("Triggers HIGH_COLLISION_RISK when competing supply exceeds 1,500 units in collision window", () => {
      const nearby: CompetingProjectItem[] = [
        { id: "c1", nameEn: "Mega Tower 1", expectedHandoverDate: "2027-05-01", constructionProgressPct: 80, totalUnitsReported: 900, status: "active" },
        { id: "c2", nameEn: "Mega Tower 2", expectedHandoverDate: "2027-07-01", constructionProgressPct: 80, totalUnitsReported: 850, status: "active" },
      ];

      const analysis = evaluateCompetingSupply("target", "2027-06-01", nearby);
      expect(analysis.collisionWindowUnitsCount).toBe(1750);
      expect(analysis.supplyPressureRisk).toBe("HIGH_COLLISION_RISK");
      expect(analysis.supplyNotes).toContain("High delivery concentration");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Excel/CSV Offer Parser & Freshness Gating (§10.2)
  // -------------------------------------------------------------------------
  describe("3. Developer Offer Parser & Freshness Engine (§10.2)", () => {
    it("Normalizes bedroom labels and availability states accurately", () => {
      expect(normalizeBedrooms("Studio")).toBe(0);
      expect(normalizeBedrooms("ST")).toBe(0);
      expect(normalizeBedrooms("1 BR")).toBe(1);
      expect(normalizeBedrooms("2-Bedroom")).toBe(2);
      expect(normalizeBedrooms("3 Bed")).toBe(3);

      expect(normalizeAvailability("Available")).toBe("available");
      expect(normalizeAvailability("Sold Out")).toBe("sold");
      expect(normalizeAvailability("Reserved")).toBe("reserved");
    });

    it("Parses Excel workbook buffer, preserves unit string formatting, and rejects invalid rows", () => {
      // Create a test workbook in memory
      const testData = [
        { "Unit No": "0102", "Bedrooms": "1 BR", "Total Area": 850, "Net Price": 1850000, "Status": "Available" },
        { "Unit No": "0205", "Bedrooms": "2 BR", "Total Area": 1200, "Net Price": 2600000, "Status": "Available" },
        { "Unit No": "INVALID-1", "Bedrooms": "1 BR", "Total Area": 0, "Net Price": 1500000, "Status": "Available" }, // zero area
        { "Unit No": "INVALID-2", "Bedrooms": "2 BR", "Total Area": 950, "Net Price": 0, "Status": "Available" }, // zero price
      ];

      const ws = XLSX.utils.json_to_sheet(testData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventory");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      const parsed = parseDeveloperOfferBuffer(buffer, "Emaar_Inventory.xlsx");

      expect(parsed.totalRowsFound).toBe(4);
      expect(parsed.validUnits.length).toBe(2);
      expect(parsed.invalidRows.length).toBe(2);

      // Verify leading zero preservation on unit number (Section 10.2 rule)
      expect(parsed.validUnits[0].unitNo).toBe("0102");
      expect(parsed.validUnits[0].bedrooms).toBe(1);
      expect(parsed.validUnits[0].netPriceAed).toBe(1850000);
      expect(parsed.validUnits[0].totalAreaSqft).toBe(850);

      // Verify checksum generated
      expect(parsed.fileChecksum.length).toBe(64); // SHA-256 hex string
    });

    it("Section 10.2: Enforces 48-hour offer freshness threshold", () => {
      const now = new Date("2026-09-25T12:00:00Z");

      // 12 hours old -> Fresh
      const freshDate = new Date("2026-09-25T00:00:00Z").toISOString();
      const freshCheck = checkOfferFreshness(freshDate, now);
      expect(freshCheck.isFresh).toBe(true);

      // 72 hours old (3 days) -> Stale, triggers re-confirmation warning
      const staleDate = new Date("2026-09-22T12:00:00Z").toISOString();
      const staleCheck = checkOfferFreshness(staleDate, now);
      expect(staleCheck.isFresh).toBe(false);
      expect(staleCheck.warningNote).toContain(">48 hours");
    });
  });
});
