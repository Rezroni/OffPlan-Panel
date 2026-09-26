import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/server/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // If specific project ID is requested, return full details, unit types, and ready comps
    if (id) {
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
          coalesce(d.brand_name, d.legal_name, 'Developer') as developerName,
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
          WHERE area_name_en = ? AND is_off_plan = 0 AND is_excluded = 0 AND is_residential = 1
          ORDER BY transaction_date DESC
          LIMIT 25
        `).all(project.areaName);
      }

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
          WHERE is_off_plan = 0 AND is_excluded = 0 AND is_residential = 1 AND price_per_sqft_aed > 1200
          ORDER BY transaction_date DESC
          LIMIT 20
        `).all();
        readyComps = fallbackComps;
      }

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
    }

    // Otherwise, list projects matching search / area
    const q = searchParams.get("q") || searchParams.get("search") || "";
    const area = searchParams.get("area") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "40", 10), 100);

    const conditions: string[] = [];
    const params: any[] = [];

    if (q.trim()) {
      const wildcard = `%${q.trim()}%`;
      conditions.push(`(
        p.name_en LIKE ? OR 
        d.brand_name LIKE ? OR 
        d.legal_name LIKE ? OR 
        a.name_en LIKE ? OR 
        p.dld_project_id LIKE ?
      )`);
      params.push(wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    if (area.trim()) {
      conditions.push(`a.name_en = ?`);
      params.push(area.trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT 
        p.id,
        p.name_en as nameEn,
        p.dld_project_id as dldProjectId,
        p.status,
        p.expected_handover_date as expectedHandoverDate,
        p.construction_progress_pct as constructionProgressPct,
        coalesce(d.brand_name, d.legal_name, 'Developer') as developerName,
        coalesce(a.name_en, 'Dubai') as areaName,
        min(u.list_price_aed) as minPriceAed,
        max(u.list_price_aed) as maxPriceAed,
        min(u.area_sqft_min) as minAreaSqft,
        max(u.area_sqft_max) as maxAreaSqft,
        count(u.id) as unitCount
      FROM project p
      LEFT JOIN developer d ON p.developer_id = d.id
      LEFT JOIN area a ON p.area_id = a.id
      LEFT JOIN unit_type u ON p.id = u.project_id
      ${whereClause}
      GROUP BY p.id
      ORDER BY 
        CASE WHEN p.status = 'active' THEN 0 ELSE 1 END,
        CASE WHEN p.expected_handover_date > '2025' THEN 0 ELSE 1 END,
        CASE WHEN count(u.id) > 0 THEN 0 ELSE 1 END,
        p.construction_progress_pct DESC
      LIMIT ?
    `;

    params.push(limit);

    const rows = sqlite.prepare(query).all(...params);

    const popularAreas = [
      "Downtown Dubai",
      "Business Bay",
      "Dubai Creek Harbour",
      "Dubai Marina",
      "Palm Jumeirah",
      "Jumeirah Village Circle",
      "Al Khairan First",
      "Al Barsha South Fifth",
      "Wadi Al Safa 3"
    ];

    return NextResponse.json({
      items: rows,
      popularAreas,
    });
  } catch (error: any) {
    console.error("Error in /api/projects:", error);
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 });
  }
}
