import { describe, it, expect } from "vitest";
import {
  evaluateCandidateEligibility,
  markDominatedOptions,
  buildShortlist,
  type CandidateOffer,
  type ClientBriefParams,
} from "@/domain/alternatives/shortlist";

describe("Phase 3: Section 8 Alternatives & Shortlist Engine", () => {
  const sampleBrief: ClientBriefParams = {
    budgetAed: 1600000,
    targetBedrooms: [1],
    preferredAreaId: "area_bb",
    preferredAreaName: "Business Bay",
    targetStrategy: "flip",
    maxHandoverYear: 2027,
  };

  const createOffer = (overrides: Partial<CandidateOffer>): CandidateOffer => ({
    id: "off_1",
    projectId: "proj_1",
    projectName: "Tower One",
    areaId: "area_bb",
    areaName: "Business Bay",
    developerName: "Developer Alpha",
    bedrooms: 1,
    areaSqft: 750,
    priceAed: 1500000,
    pricePerSqftAed: 2000,
    expectedHandoverYear: 2026,
    expectedHandoverDate: "2026-12-31",
    constructionProgressPct: 40,
    assignmentPolicy: "allowed",
    minPaidPctForNoc: 34,
    readyMedianPsfArea: 2400,
    ...overrides,
  });

  describe("1. Eligibility Evaluation (§8)", () => {
    it("passes qualifying candidate", () => {
      const offer = createOffer({});
      const elig = evaluateCandidateEligibility(offer, sampleBrief);
      expect(elig.status).toBe("passed");
      expect(elig.reasons).toContain("All eligibility criteria passed");
    });

    it("fails when price exceeds budget by >10%", () => {
      // Budget is 1.6M, +10% ceiling is 1.76M. Offer at 1.85M should fail.
      const offer = createOffer({ priceAed: 1850000 });
      const elig = evaluateCandidateEligibility(offer, sampleBrief);
      expect(elig.status).toBe("failed");
      expect(elig.reasons[0]).toContain("exceeds budget ceiling");
    });

    it("fails when bedroom count does not match client brief", () => {
      const offer = createOffer({ bedrooms: 2 });
      const elig = evaluateCandidateEligibility(offer, sampleBrief);
      expect(elig.status).toBe("failed");
      expect(elig.reasons[0]).toContain("does not match requested room count");
    });

    it("excludes from flip strategy if developer PROHIBITS assignment", () => {
      const offer = createOffer({ assignmentPolicy: "prohibited" });
      const elig = evaluateCandidateEligibility(offer, sampleBrief);
      expect(elig.status).toBe("failed");
      expect(elig.reasons[0]).toContain("Assignment is PROHIBITED");
    });

    it("returns needs_verification if assignment policy is UNKNOWN for flip", () => {
      const offer = createOffer({ assignmentPolicy: "unknown" });
      const elig = evaluateCandidateEligibility(offer, sampleBrief);
      expect(elig.status).toBe("needs_verification");
      expect(elig.reasons[0]).toContain("Assignment policy is UNKNOWN");
    });

    it("fails if completion year exceeds client horizon", () => {
      const offer = createOffer({ expectedHandoverYear: 2029 });
      const elig = evaluateCandidateEligibility(offer, sampleBrief);
      expect(elig.status).toBe("failed");
      expect(elig.reasons[0]).toContain("exceeds client deadline");
    });
  });

  describe("2. Dominated Option Detection (§8)", () => {
    it("marks option as dominated if same cluster has cheaper PSF with equal/earlier handover", () => {
      const cheapOffer = createOffer({
        id: "cheap_1",
        projectName: "Efficient Tower",
        pricePerSqftAed: 1900,
        expectedHandoverYear: 2026,
      });

      const expensiveOffer = createOffer({
        id: "exp_1",
        projectName: "Overpriced Tower",
        pricePerSqftAed: 2200, // >5% more expensive
        expectedHandoverYear: 2026,
      });

      const evaluations = markDominatedOptions([
        { candidate: cheapOffer, eligibility: { status: "passed", reasons: [] } },
        { candidate: expensiveOffer, eligibility: { status: "passed", reasons: [] } },
      ]);

      const expEval = evaluations.find((e) => e.candidate.id === "exp_1");
      expect(expEval?.isDominated).toBe(true);
      expect(expEval?.dominatedReason).toContain('Dominated by "Efficient Tower"');

      const cheapEval = evaluations.find((e) => e.candidate.id === "cheap_1");
      expect(cheapEval?.isDominated).toBe(false);
    });
  });

  describe("3. Three Shortlist Roles & 4 Mandatory Explanations (§8)", () => {
    it("builds 3 distinct shortlist roles with complete explanations", () => {
      const candidates = [
        // Role 1 candidate: Best local in Business Bay
        createOffer({
          id: "local_1",
          projectName: "Prime Business Bay",
          areaId: "area_bb",
          areaName: "Business Bay",
          priceAed: 1550000,
          pricePerSqftAed: 2050,
          expectedHandoverYear: 2027,
        }),
        // Role 2 candidate: Alternative Area (Downtown / JVT)
        createOffer({
          id: "alt_1",
          projectName: "JVT Panorama",
          areaId: "area_jvt",
          areaName: "Jumeirah Village Triangle",
          priceAed: 1500000,
          pricePerSqftAed: 1750,
          expectedHandoverYear: 2027,
        }),
        // Role 3 candidate: Near handover
        createOffer({
          id: "near_1",
          projectName: "Creek Fast Track",
          areaId: "area_creek",
          areaName: "Dubai Creek Harbour",
          priceAed: 1600000,
          pricePerSqftAed: 2150,
          expectedHandoverYear: 2025,
          constructionProgressPct: 85,
        }),
      ];

      const result = buildShortlist(sampleBrief, candidates);

      expect(result.eligibleCount).toBe(3);
      expect(result.shortlist.length).toBe(3);

      const roles = result.shortlist.map((s) => s.explanation.role);
      expect(roles).toContain("BEST_LOCAL");
      expect(roles).toContain("SIMILAR_BUDGET_ALT_AREA");
      expect(roles).toContain("NEAR_HANDOVER");

      // Verify the 4 mandatory explanation blocks for each shortlisted item
      for (const item of result.shortlist) {
        const exp = item.explanation;
        expect(exp.whyItFits.length).toBeGreaterThanOrEqual(2); // 2-3 measurable arguments
        expect(exp.tradeOff).toBeTruthy(); // substantive compromise
        expect(exp.disqualificationTriggers.length).toBeGreaterThanOrEqual(2); // risk triggers
        expect(exp.factsToVerify.length).toBeGreaterThanOrEqual(2); // concrete missing facts
      }
    });
  });
});
