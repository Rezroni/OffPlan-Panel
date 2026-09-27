import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "db", "offplan.db");

describe("DLD Oqood & Title Deed System-wide Pricing & Matching", () => {
  const db = new Database(DB_PATH, { readonly: true });

  it("should have transaction_fact linked to canonical projects with high coverage (>80%)", () => {
    const totalRow = db.prepare("SELECT count(*) as total FROM transaction_fact").get() as { total: number };
    const matchedRow = db.prepare(`
      SELECT count(*) as matched 
      FROM transaction_fact t 
      JOIN project p ON t.matched_project_id = p.id
    `).get() as { matched: number };

    expect(totalRow.total).toBeGreaterThan(400000);
    expect(matchedRow.matched).toBeGreaterThan(350000);
    const coverage = (matchedRow.matched / totalRow.total) * 100;
    expect(coverage).toBeGreaterThan(80.0);
  });

  it("should correctly link Eden House The Park (proj_dld_678813961) to its registered Oqood deals", () => {
    const txRow = db.prepare(`
      SELECT count(*) as cnt 
      FROM transaction_fact 
      WHERE matched_project_id = 'proj_dld_678813961'
        AND is_off_plan = 1
        AND is_excluded = 0
    `).get() as { cnt: number };

    expect(txRow.cnt).toBeGreaterThanOrEqual(280);
  });

  it("should have populated unit_type with dld_oqood_verified for Eden House The Park", () => {
    const units = db.prepare(`
      SELECT bedrooms, unit_type_label, net_price_aed, price_source, price_as_of
      FROM unit_type
      WHERE project_id = 'proj_dld_678813961'
      ORDER BY bedrooms ASC
    `).all() as Array<{
      bedrooms: number;
      unit_type_label: string;
      net_price_aed: number;
      price_source: string;
      price_as_of: string;
    }>;

    expect(units.length).toBeGreaterThanOrEqual(5);

    // Studio check
    const studio = units.find((u) => u.bedrooms === 0);
    expect(studio).toBeDefined();
    expect(studio?.price_source).toBe("dld_oqood_verified");
    expect(studio?.net_price_aed).toBeGreaterThan(1800000);
    expect(studio?.unit_type_label).toContain("Oqood deals");

    // 1BR check: must reflect real luxury Canal price (~3.6M AED), NOT 1.8M
    const oneBr = units.find((u) => u.bedrooms === 1);
    expect(oneBr).toBeDefined();
    expect(oneBr?.price_source).toBe("dld_oqood_verified");
    expect(oneBr?.net_price_aed).toBeGreaterThan(2500000);
    expect(oneBr?.unit_type_label).toContain("Oqood deals");

    // 2BR check: must be > 4.5M AED
    const twoBr = units.find((u) => u.bedrooms === 2);
    expect(twoBr).toBeDefined();
    expect(twoBr?.price_source).toBe("dld_oqood_verified");
    expect(twoBr?.net_price_aed).toBeGreaterThan(4500000);

    // 3BR check: must be > 7.5M AED
    const threeBr = units.find((u) => u.bedrooms === 3);
    expect(threeBr).toBeDefined();
    expect(threeBr?.price_source).toBe("dld_oqood_verified");
    expect(threeBr?.net_price_aed).toBeGreaterThan(7500000);
  });

  it("should distinguish Oqood (Sell - Pre registration) from Title Deed (Sell) in transaction_fact", () => {
    const oqoodSample = db.prepare(`
      SELECT count(*) as cnt 
      FROM transaction_fact 
      WHERE is_off_plan = 1 AND transaction_type LIKE '%Pre registration%'
    `).get() as { cnt: number };

    const titleDeedSample = db.prepare(`
      SELECT count(*) as cnt 
      FROM transaction_fact 
      WHERE is_off_plan = 0 AND is_residential = 1 AND is_excluded = 0
    `).get() as { cnt: number };

    expect(oqoodSample.cnt).toBeGreaterThan(100000);
    expect(titleDeedSample.cnt).toBeGreaterThan(50000);
  });

  it("should separate Operating Developer (H&H) from Master Developer/Landowner (Meraas) for Eden House", () => {
    const proj = db.prepare(`
      SELECT p.name_en, p.operating_developer_name, p.master_developer_name, d.brand_name
      FROM project p
      LEFT JOIN developer d ON p.developer_id = d.id
      WHERE p.id = 'proj_dld_678813961'
    `).get() as {
      name_en: string;
      operating_developer_name: string;
      master_developer_name: string;
      brand_name: string;
    };

    expect(proj).toBeDefined();
    expect(proj.operating_developer_name).toBe("H&H Development");
    expect(proj.master_developer_name).toBe("Meraas Properties LLC");
    expect(proj.brand_name).toBe("H&H Development");
  });
});
