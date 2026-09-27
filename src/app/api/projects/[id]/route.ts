import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/server/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing project ID" }, { status: 400 });
    }

    const project = sqlite.prepare(`
      SELECT 
        p.id,
        p.name_en as nameEn,
        p.dld_project_id as dldProjectId,
        p.status,
        p.expected_handover_date as expectedHandoverDate,
        p.construction_progress_pct as constructionProgressPct,
        p.escrow_bank_name as escrowBankName,
        p.escrow_status as escrowStatus,
        p.total_units_reported as totalUnitsReported,
        coalesce(nullif(d.brand_name, ''), nullif(d.legal_name, ''), 'Developer') as developerName,
        coalesce(a.name_en, 'Dubai') as areaName,
        a.id as areaId
      FROM project p
      LEFT JOIN developer d ON p.developer_id = d.id
      LEFT JOIN area a ON p.area_id = a.id
      WHERE p.id = ?
    `).get(id) as any;

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const unitTypes = sqlite.prepare(`
      SELECT 
        id,
        bedrooms,
        unit_type_label as unitTypeLabel,
        area_sqft_min as areaSqftMin,
        area_sqft_max as areaSqftMax,
        list_price_aed as listPriceAed,
        net_price_aed as netPriceAed,
        assignment_policy as assignmentPolicy,
        min_paid_pct_for_noc as minPaidPctForNoc
      FROM unit_type
      WHERE project_id = ?
      ORDER BY bedrooms ASC
    `).all(id);

    // Fetch real ready sales comps for this area
    let readyComps: any[] = [];
    if (project.areaName) {
      readyComps = sqlite.prepare(`
        SELECT 
          id, 
          building_name_en as buildingName, 
          bedrooms, 
          area_sqft as areaSqft,
          transaction_value_aed as salePriceAED, 
          price_per_sqft_aed as pricePerSqftAED,
          transaction_date as transactionDate, 
          0 as isOffPlan
        FROM transaction_fact
        WHERE area_name_en = ? AND is_off_plan = 0 AND is_excluded = 0 AND is_apartment_eligible = 1
        ORDER BY transaction_date DESC
        LIMIT 25
      `).all(project.areaName);
    }

    // If fewer than 5, fallback to overall prime residential ready sales
    if (readyComps.length < 5) {
      const fallbackComps = sqlite.prepare(`
        SELECT 
          id, 
          building_name_en as buildingName, 
          bedrooms, 
          area_sqft as areaSqft,
          transaction_value_aed as salePriceAED, 
          price_per_sqft_aed as pricePerSqftAED,
          transaction_date as transactionDate, 
          0 as isOffPlan
        FROM transaction_fact
        WHERE is_off_plan = 0 AND is_excluded = 0 AND is_apartment_eligible = 1 AND price_per_sqft_aed > 1200
        ORDER BY transaction_date DESC
        LIMIT 20
      `).all();
      readyComps = fallbackComps;
    }

    // Calculate median PSF
    const validPsfs = readyComps
      .map((c: any) => c.pricePerSqftAED)
      .filter((p: any) => typeof p === "number" && p > 0)
      .sort((a: number, b: number) => a - b);

    let medianPsf = 2400;
    if (validPsfs.length > 0) {
      const mid = Math.floor(validPsfs.length / 2);
      medianPsf =
        validPsfs.length % 2 === 0 && mid > 0
          ? Math.round((validPsfs[mid - 1] + validPsfs[mid]) / 2)
          : Math.round(validPsfs[mid]);
    }

    return NextResponse.json({
      project,
      unitTypes,
      readyComps,
      readyMedianPsf: medianPsf,
    });
  } catch (error: any) {
    console.error("Error fetching project details:", error);
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 });
  }
}
