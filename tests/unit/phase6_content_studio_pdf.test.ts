/**
 * Unit Tests — Phase 6: Dual RU/AR Content Studio & Playwright PDF Export (§16, §17, §18)
 */

import { describe, it, expect } from "vitest";
import {
  generateReelsScript,
  buildStudioMetricsManifest,
  generateReportSnapshotHash,
  formatAedLocale,
  formatPercentLocale,
  StudioProjectFacts,
  SOCIAL_CARD_SPECS,
} from "@/domain/content/content-studio";

const MOCK_FACTS: StudioProjectFacts = {
  projectId: "proj_dld_529545309",
  dldProjectId: "529545309",
  projectNameEn: "Avenue Residence 5",
  projectNameAr: "أفينيو ريزيدنس 5",
  developerBrand: "Nabni Real Estate",
  developerBrandAr: "نبني العقارية",
  areaNameEn: "Al Furjan",
  areaNameAr: "الفرجان",
  bedrooms: 1,
  areaSqft: 850,
  priceAed: 1800000,
  pricePsfAed: 2118,
  handoverDate: "2026-12-01",
  cmaReadyMedianPsf: 2450,
  cmaGapReadyPct: 13.6,
  cmaSampleStatus: "ROBUST",
  developerOnTimePct: 88,
  developerAvgDelayDays: 25,
  developerReliabilityBadge: "PROVEN_DISCIPLINE",
  flipBreakEvenPsf: 2280,
  flipBaselineRoiPct: 24.5,
  holdNetYieldPct: 7.25,
  competingCollisionCount: 3,
  competingSupplyRisk: "MODERATE_PRESSURE",
  agentName: "Mokhamed",
};

describe("Phase 6 — Content Studio & Dual RU/AR Parity (§16)", () => {
  it("generates exact 5-stage Reels script matching §16 timeline specifications", () => {
    const script = generateReelsScript(MOCK_FACTS);

    expect(script.blocks).toHaveLength(5);
    expect(script.blocks[0].timingSeconds).toBe("0–5s");
    expect(script.blocks[1].timingSeconds).toBe("5–20s");
    expect(script.blocks[2].timingSeconds).toBe("20–40s");
    expect(script.blocks[3].timingSeconds).toBe("40–55s");
    expect(script.blocks[4].timingSeconds).toBe("55–75s");
  });

  it("enforces numeric parity: RU and AR manifests contain identical numbers without drift", () => {
    const manifest = buildStudioMetricsManifest(MOCK_FACTS);

    // Price parity
    expect(manifest.METRIC_TARGET_PRICE_AED.value).toBe(1800000);
    expect(manifest.METRIC_TARGET_PRICE_AED.formattedRu).toContain("1");
    expect(manifest.METRIC_TARGET_PRICE_AED.formattedAr).toContain("د.إ");

    // PSF parity
    expect(manifest.METRIC_TARGET_PSF_AED.value).toBe(2118);
    expect(manifest.METRIC_TARGET_PSF_AED.formattedRu).toBe("2118 AED/ft²");
    expect(manifest.METRIC_TARGET_PSF_AED.formattedAr).toBe("2118 د.إ/قدم²");

    // CMA gap parity
    expect(manifest.METRIC_CMA_GAP_READY_PCT.value).toBe(13.6);
    expect(manifest.METRIC_CMA_GAP_READY_PCT.formattedRu).toBe("13.6%");
    expect(manifest.METRIC_CMA_GAP_READY_PCT.formattedAr).toBe("%13.6");

    // Break-even PSF parity
    expect(manifest.METRIC_BREAK_EVEN_RESALE_PSF.value).toBe(2280);
    expect(manifest.METRIC_BREAK_EVEN_RESALE_PSF.formattedRu).toBe("2280 AED/ft²");
    expect(manifest.METRIC_BREAK_EVEN_RESALE_PSF.formattedAr).toBe("2280 د.إ/قدم²");

    // ROI parity
    expect(manifest.METRIC_FLIP_BASELINE_ROI_PCT.value).toBe(24.5);
    expect(manifest.METRIC_FLIP_BASELINE_ROI_PCT.formattedRu).toBe("24.5%");
    expect(manifest.METRIC_FLIP_BASELINE_ROI_PCT.formattedAr).toBe("%24.5");
  });

  it("binds every spoken numeric claim to whitelisted Metric IDs (§16)", () => {
    const script = generateReelsScript(MOCK_FACTS);
    const validMetricIds = Object.keys(script.metricsManifest);

    for (const block of script.blocks) {
      for (const mId of block.referencedMetricIds) {
        expect(validMetricIds).toContain(mId);
      }
    }

    // Stage 2 (Price & CMA) must bind target price and CMA gap
    expect(script.blocks[1].referencedMetricIds).toContain("METRIC_TARGET_PRICE_AED");
    expect(script.blocks[1].referencedMetricIds).toContain("METRIC_CMA_GAP_READY_PCT");

    // Stage 3 (Payment & Exit) must bind break-even PSF and ROI
    expect(script.blocks[2].referencedMetricIds).toContain("METRIC_BREAK_EVEN_RESALE_PSF");
    expect(script.blocks[2].referencedMetricIds).toContain("METRIC_FLIP_BASELINE_ROI_PCT");
  });

  it("trade-off stage 4 dynamically reflects competing cluster supply collisions without exaggeration", () => {
    const script = generateReelsScript(MOCK_FACTS);
    const tradeOffBlock = script.blocks[3];

    expect(tradeOffBlock.textRu).toContain("3 проектах");
    expect(tradeOffBlock.textAr).toContain("3 مشاريع");
    expect(tradeOffBlock.referencedMetricIds).toContain("METRIC_COMPETING_COLLISION_COUNT");
  });

  it("call to action stage 5 includes project code for lead qualification", () => {
    const script = generateReelsScript(MOCK_FACTS);
    const ctaBlock = script.blocks[4];

    expect(ctaBlock.textRu).toContain("DLD-529545309");
    expect(ctaBlock.textAr).toContain("DLD-529545309");
  });

  it("generates deterministic SHA-256 hash for immutable report snapshots (§17)", () => {
    const payloadA = { a: 1, b: "test", c: [1, 2] };
    const payloadB = { c: [1, 2], b: "test", a: 1 }; // different key insertion order

    const hashA = generateReportSnapshotHash(payloadA);
    const hashB = generateReportSnapshotHash(payloadB);

    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies social data card dimension specifications and safe area boundaries (§16.2)", () => {
    const reelsSpec = SOCIAL_CARD_SPECS.REELS_9_16;
    expect(reelsSpec.width).toBe(1080);
    expect(reelsSpec.height).toBe(1920);
    expect(reelsSpec.safeArea.top).toBe(220);
    expect(reelsSpec.safeArea.bottom).toBe(280);

    const carouselSpec = SOCIAL_CARD_SPECS.CAROUSEL_4_5;
    expect(carouselSpec.width).toBe(1080);
    expect(carouselSpec.height).toBe(1350);
  });

  it("formats locale currencies and percentages accurately", () => {
    expect(formatAedLocale(2500000, "ru")).toBe("2 500 000 AED");
    expect(formatAedLocale(2500000, "ar")).toContain("د.إ");
    expect(formatPercentLocale(8.5, "ru")).toBe("8.5%");
    expect(formatPercentLocale(8.5, "ar")).toBe("%8.5");
    expect(formatPercentLocale(null, "ru")).toBe("—");
  });
});
