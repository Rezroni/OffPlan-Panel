import { describe, it, expect } from "vitest";
import { generateDossierSynthesis } from "@/server/adapters/ai/gemini-adapter";

describe("Dossier Analytical Synthesis & Market Rationale Engine", () => {
  it("correctly identifies new-build premium (+45.6%) over legacy ready stock and off-plan discount", async () => {
    // Danub Viewz 2 scenario
    const input = {
      projectName: "Viewz 2 By Danube",
      developerName: "Danube Properties",
      areaName: "Al Thanyah Fifth",
      bedrooms: 0,
      unitPriceAed: 1050000,
      unitAreaSqft: 435,
      unitPsf: 2416,
      readyMedianPsf: 1659,
      readyDealsCount: 143,
      gapToReadyPercent: -45.6, // Target is 45.6% more expensive than ready median
      offPlanMedianPsf: 2658,
      offPlanDealsCount: 89,
      gapToOffPlanPercent: 9.1,  // Target is 9.1% cheaper than off-plan peers
      nearHandoverMedianPsf: 1367,
      nearHandoverDealsCount: 100,
      nocThresholdPercent: 34,
      breakEvenPsfAed: 2602,
      competingCollisionCount: 4,
    };

    const result = await generateDossierSynthesis(input, "ru");

    expect(result.executiveSummary).toBeDefined();
    // Must NOT say "ниже медианы вторичного" when gapToReady is negative!
    expect(result.executiveSummary).not.toContain("-45.6% ниже");
    expect(result.executiveSummary).not.toContain("45.6% ниже медианы вторичного");
    // Must mention the premium over secondary market or new-build premium
    expect(result.executiveSummary).toMatch(/(преми|дороже|выше)/i);
    // Must mention NOC 34% and break-even 2602
    expect(result.executiveSummary).toContain("34%");
    expect(result.executiveSummary).toContain("2602");

    // CMA Rationale must explain the generational age gap
    expect(result.cmaRationale).toBeDefined();
    expect(result.riskAndStressTest).toBeDefined();
  });

  it("correctly identifies genuine discount when target is below ready median", async () => {
    const input = {
      projectName: "Value Project",
      developerName: "Emaar",
      areaName: "Downtown Dubai",
      bedrooms: 1,
      unitPriceAed: 1800000,
      unitAreaSqft: 800,
      unitPsf: 2250,
      readyMedianPsf: 2500,
      readyDealsCount: 50,
      gapToReadyPercent: 10.0, // Target is 10% cheaper than ready median
      offPlanMedianPsf: 2700,
      offPlanDealsCount: 30,
      gapToOffPlanPercent: 16.7,
      nearHandoverMedianPsf: 2600,
      nearHandoverDealsCount: 20,
      nocThresholdPercent: 40,
      breakEvenPsfAed: 2420,
    };

    const result = await generateDossierSynthesis(input, "ru");
    expect(result.executiveSummary).toContain("10.0% ниже");
  });
});
