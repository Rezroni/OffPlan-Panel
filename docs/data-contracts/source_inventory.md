# Source Inventory & Data Contract Register

**Phase 0 Review Artifact — Ingestion Contract Boundary & Evidence**  
*Date of Verification:* 2026-09-27  
*Authoritative Ingestion Path:* TypeScript DLD Adapter (`src/server/adapters/dld/dld-adapter.ts`)  
*Authoritative Seed Entrypoint:* `scripts/seed-from-duckdb.ts`  
*Database Engine:* SQLite (`better-sqlite3` + Drizzle ORM) with WAL mode and foreign keys enforced.

---

## 1. Eight-Source Inventory Summary

| # | Dataset / Source ID | Official Designation / Endpoint | Status / Disposition | Primary Key / Composite Grain | Sample Date Verified | Rights & Commercial Clearance |
|---|---|---|---|---|---|---|
| 1 | `dld_transactions-open-api` | Dubai Pulse: `/open/dld/dld_transactions-open` | **Observed & Connected** | `transaction_id` | 2026-08-26 / 2026-09-24 | Dubai Open Data terms; non-exclusive public data. |
| 2 | `dld_rent_contracts-open-api` | Dubai Pulse: `/open/dld/dld_rent_contracts-open` | **Observed & Connected** | `contract_id` + `line_number` | 2025-10 / 2026-09-25 | Dubai Open Data terms; per-unit rent metrics exclude `no_of_prop > 1`. |
| 3 | `dld_projects-open-api` | Dubai Pulse: `/open/dld/dld_projects-open` | **Observed & Connected** | `project_id` | 2026-06-15 / 2026-09-25 | Dubai Open Data terms; canonical ID is `project_id` (`project_number` is external lookup). |
| 4 | `dld_oa_service_charges-open-api` | Dubai Pulse / Mollak: `/open/dld/dld_oa_service_charges-open` | **Observed & Connected** | `(property_group_id, budget_year, usage_id, service_category_id)` | 2026-09-22 / 2026-09-25 | Dubai Open Data terms; `service_cost` billing unit unconfirmed (stored in `raw_service_cost` with unit `'unknown'`). |
| 5 | `dld_developers-open` | Dubai Pulse: `dld_developers-open` | **Observed (Discovered via Projects)** | `developer_id` | 2026-09-25 | Dubai Open Data terms; developer attributes enriched via project registry. |
| 6 | `dld_units-open` | Dubai Pulse: `dld_units-open` | **Observed (Catalog Discovered)** | `property_id` / unit identifier | 2026-09-25 | High volume; fetched on-demand per watchlist project. |
| 7 | `dld_residential_sale_index` (RPPI) | DLD RPPI Published Indices | **Disabled (Unapproved for Commercial Use)** | `(zone_id, index_year, index_month)` | N/A (Inspected 2026-09-26) | **Disabled:** DLD terms restrict commercial predictive calculations without specific clearance; marked inactive. |
| 8 | `docs.bayutapi.com` (Bayut) | Third-Party Aggregator API | **Disabled (Unavailable / Unlicensed)** | `property_id` / `external_id` | N/A (Inspected 2026-09-26) | **Disabled:** Commercial use restricted under Bayut ToU without written contract; quota/tier unknown. No live credentials. |

---

## 2. Source Detailed Profiles

### 2.1 `dld_transactions-open-api` (Transactions)
- **Endpoint:** `GET /open/dld/dld_transactions-open` (implemented via `urljoin(base_url, "open/dld/dld_transactions-open")` in `DLD PIPELINE/dld/fetch.py:153`)
- **Observed Grain:** One record per registered real estate procedure.
- **Stable Identity:** `transaction_id` (string, e.g., `"1-11-2026-26371"`). Zero random UUID fallbacks.
- **Observed Core Fields:**
  - `actual_worth`: Numeric (AED). Precision: preserved with up to 2 decimal places (fils). Records $\le 0$ quarantined or excluded.
  - `procedure_area`: Numeric (sqm). Normalized to sqft via $\text{sqm} \times 10.7639104$.
  - `instance_date`: ISO-8601 date (`YYYY-MM-DD`).
  - `procedure_name_en`: English procedure description (e.g. `"Sell"`, `"Sell - Pre registration"`).
  - `trans_group_en`: Group classification (`"Sales"`, `"Mortgages"`, etc.). Non-sale types excluded.
  - `reg_type_en`: Registration status (`"Existing Properties"` $\to$ Ready; `"Off-Plan Properties"` $\to$ Off-Plan; missing/unknown $\to$ `null`).
  - `property_type_en` & `property_sub_type_en`: Unit, Land, Building, Flat, Penthouse, Villa, etc.
  - `property_usage_en`: `"Residential"` vs `"Commercial"` (missing/unknown preserved as `null`).
  - `project_number`: External project number (e.g. `3382`). Crosswalked to canonical DLD `project_id`.
  - `rooms_en` & `rooms_ar`: Bedroom indicators. `"Studio"` or `"0"` $\to 0$; word-boundary digits $\to 1\dots 20$; unknown $\to \text{null}$.
- **Apartment Eligibility Classification:**
  - Villas and townhouses retain source honesty as `is_residential = true`, but are classified as `is_apartment_eligible = false`.
  - Flats, apartments, studios, penthouses, duplexes, and hotel apartments are tagged `is_apartment_eligible = true`.
  - Apartment metric queries in `catalog.ts` strictly filter `is_apartment_eligible = true`, ensuring 84,762 villa transactions in the source data do not distort apartment PSF medians.
- **Rate Limit & Scheduling:** Enforced at `MIN_REQUEST_INTERVAL_S = 1.1` in `fetch.py:21` (yielding $\approx 0.91$ requests/sec max rate).
- **Replay & Correction Rule:** Replayed records with identical payload checksum are counted as `skipped` (0 duplicate facts). Changed records create an auditable `source_record_revision`. Fact and revision writes are atomic. Confirmed matches are never overwritten by auto-correction.

### 2.2 `dld_rent_contracts-open-api` (Ejari Contracts)
- **Endpoint:** `GET /open/dld/dld_rent_contracts-open` (implemented in `fetch.py:153`)
- **Observed Grain:** One record per Ejari contract line item. Verified 100% presence of `line_number` across all 4,316,962 rows in source DuckDB.
- **Stable Identity:** Strictly composite of `contract_id` + `line_number` (e.g. `"CNT2116542913_55"`).
  - If `line_number` is missing, the record is **quarantined** with rejection reason `missing_line_number`; line numbers are never invented or defaulted.
- **Observed Core Fields & AED Precision Policy:**
  - `annual_amount`: Numeric (AED). **AED Precision Policy:** The valid source dataset contains 248,123 decimal `annual_amount` records with 2 decimal places (fils: 1 AED = 100 fils). Schema stores `annual_rent_aed` as SQLite `REAL` and parser preserves up to 2 decimal places (`Math.round(val * 100) / 100`), preventing integer truncation and float precision loss.
  - `actual_area`: Numeric (sqm). Normalized to sqft.
  - `contract_start_date` & `contract_end_date`: ISO-8601 dates.
  - `contract_reg_type_en`: `"Renew"` $\to$ `renew`; `"New"` $\to$ `new`; missing $\to \text{null}$. Never defaulted.
  - `no_of_prop`: Property count. $> 1 \to \text{isMultiProperty}=\text{true}$; $= 1 \to \text{false}$; missing $\to \text{null}$.
  - `project_number`: Crosswalked to canonical `project_id`. **Dangling links prevented by checking against materialized SQLite projects (`materializedProjectIds`). Unresolvable or unmaterialized IDs remain unmatched.**
  - `property_usage_en`: Preserved as observed; never assumed `"residential"` when absent.

### 2.3 `dld_projects-open-api` (Projects Registry)
- **Endpoint:** `GET /open/dld/dld_projects-open` (implemented in `fetch.py:153`)
- **Observed Grain:** Master registry of 3,039 DLD registered developments.
- **Stable Identity:** `project_id` (numeric primary key, e.g. `678813961`).
- **Canonical Key:** `proj_dld_<project_id>`.
- **Observed Core Fields:**
  - `project_id`: Unique integer key.
  - `project_number`: External registration number (1-to-1 crosswalk with `project_id` in 3,039 observed projects).
  - `project_name` & `project_name_en`: Arabic and English project titles.
  - `developer_id` & `developer_name`: Official legal developer entity.
  - `master_developer_name`: Landowner / master developer (e.g. Meraas for Eden House).
  - `project_status`: `"ACTIVE"`, `"COMPLETED"`, etc.
  - `percent_completed`: Construction progress (0–100%).
  - `no_of_units`: Registered unit count.
- **Name Matching Discipline:** Normalization retains Unicode characters (including Arabic `\u0600-\u06FF`). 59 project names share identical normalized titles across different project IDs; all ambiguous name matches are routed to `match_queue` with status `needs_review` and are never auto-assigned to market facts.

### 2.4 `dld_oa_service_charges-open-api` (Mollak / OA Service Charges)
- **Endpoint:** `GET /open/dld/dld_oa_service_charges-open` (implemented in `fetch.py:153`)
- **Observed Grain:** Annual approved service fee schedule per property group and cost category.
- **Stable Identity:** `(property_group_id, budget_year, usage_id, service_category_id)`.
- **Observed Core Fields & Raw Store Policy:**
  - `property_group_id`: External Mollak property group identifier.
  - `project_id`: Direct DLD `project_id` (e.g. `83055243`).
  - `budget_year`: Approved schedule year (e.g. `2022`). Never substituted with current year.
  - `service_cost`: Stated fee rate (e.g. `17.4`).
  - `service_category_name_en`: Cost center (e.g. `"Insurance"`, `"Cleaning Services"`).
  - `usage_name_en`: Property usage (e.g. `"Residential"`, `"Parking"`).
- **Raw Store & Unit Limitation:** The open data payload specifies `service_cost` as a raw numeric value without explicit dimensional units. The schema persists `raw_service_cost` (`real`) with explicit `raw_service_cost_unit` (`text`, default `"unknown"`). The contract strictly forbids converting `service_cost` into an area charge (`annual_charge_per_sqft` or `annual_charge_per_sqm`) without verified dimensional evidence.

### 2.5 `dld_developers-open` (Developers)
- **Status:** Observed via DLD project registry records. Contains `developer_id`, `developer_number`, and `developer_name`. Discovered legal entities are separated from marketing brand names in `developer` table.

### 2.6 `dld_units-open` (Units)
- **Status:** Available on Dubai Pulse; high record count ($> 1\text{M}$ rows). Utilized on-demand for specific project unit breakdown verification (e.g., Eden House 550 units).

### 2.7 `dld_residential_sale_index` (RPPI)
- **Status:** **Disabled.** Commercial use is restricted under official DLD terms. Not wired to automated calculations.

### 2.8 `docs.bayutapi.com` (Bayut)
- **Status:** **Disabled / Unavailable.** Unlicensed third-party aggregator; public Terms of Use forbid commercial exploitation without explicit written licensing. Account quotas and live endpoints are not connected.

---

## 3. Reviewed Project Mapping Examples

The following three projects have been verified end-to-end between raw DLD open data payloads, the project registry, and the SQLite catalog:

### Example 1: Eden House The Park
- **Canonical ID:** `proj_dld_678813961`
- **DLD Project ID:** `678813961`
- **DLD Project Number:** `3382`
- **Name (Arabic):** `ايدن هاوس ذا بارك`
- **Name (English):** `Eden House The Park`
- **Master Developer / Landowner:** `مراس العقارية (ش.ذ.م.م)` (`Meraas Properties LLC`)
- **Operating Developer:** `H&H Development`
- **Area:** `Al Wasl` (ID: 349) / Dubai Water Canal
- **Registered Units:** 550
- **Crosswalk Evidence:** Incoming transactions and rent contracts carrying `project_number: 3382` map unambiguously to `proj_dld_678813961`.

### Example 2: Azizi Aura Residences
- **Canonical ID:** `proj_dld_83055243`
- **DLD Project ID:** `83055243`
- **DLD Project Number:** `1897`
- **Property Group ID:** `243048329`
- **Name (Arabic):** `عزيزي أورا ريزيدنزس`
- **Name (English):** `Azizi Aura Residences`
- **Master Developer:** `ليمتلس ش .ذ.م.م` (`Limitless LLC`)
- **Operating Developer:** `Azizi Developments`
- **Master Community:** `Downtown Jebel Ali` (ID: 122)
- **Area:** `Jabal Ali Industrial Second` (ID: 396)
- **Status:** `COMPLETED` (100.0%)
- **Crosswalk Evidence:** Service charge records from Mollak open data directly specify `project_id: 83055243` and `property_group_id: 243048329`.

### Example 3: Avenue Residence 5
- **Canonical ID:** `proj_dld_529545309`
- **DLD Project ID:** `529545309`
- **DLD Project Number:** `2744`
- **Name (Arabic):** `أفينيو ريذدنس 5`
- **Name (English):** `Avenue Residence 5`
- **Developer:** `الفرجان ( ش.ذ.م.م )` (Developer ID: 7904755, Developer No: 951)
- **Master Developer:** `الفرجان ( ش.ذ.م.م )`
- **Area:** `Jabal Ali First` (ID: 445) / Al Furjan
- **Status:** `ACTIVE` (90.6%)
- **Registered Units:** 85
- **Crosswalk Evidence:** First record in `dld_projects-open-api` raw snapshot. `project_number: 2744` resolves to `project_id: 529545309`.

---

## 4. Limitations & Unknowns Register

1. **Service Charge Billing Unit Unstated:**
   - Raw `service_cost` values lack unit designations in open data payloads.
   - *Mitigation:* The contract adapter stores raw `service_cost` in `raw_service_cost` with unit `'unknown'`, and leaves `annual_charge_per_sqft` as `null` unless explicit schedule documentation confirms the metric.
2. **Missing Centroid Precision for Sub-Projects:**
   - DLD open data provides community-level centroids (`area_id`) but lacks verified building coordinates for many projects.
   - *Mitigation:* `coord_precision` is tagged `'centroid'` or `'unknown'` rather than interpolating building locations.
3. **Ambiguous Name Normalization:**
   - Stripping non-ASCII characters collapses distinct Arabic project names into lone numbers (e.g. 30 different projects collapsing to `"5"` or `"2"`).
   - *Mitigation:* Normalization preserves Unicode letters. 59 duplicate names identified in the registry are barred from automatic linking and routed to `match_queue`.
4. **Multi-Property Rental Distortion:**
   - Bulk corporate lease renewals (e.g. `no_of_prop: 122` under a single contract of AED 1,118,500) distort single-unit rent medians if included naively.
   - *Mitigation:* `is_multi_property` flag is computed directly from `no_of_prop > 1`. CMA rent calculations query `is_multi_property = 0` only.
5. **Dangling Project Foreign Keys in Legacy Imports:**
   - Legacy sync scripts constructed links as `'proj_dld_' + project_number`, producing 287,584 dangling references in un-migrated databases.
   - *Mitigation:* Authoritative adapter enforces canonical `dld_project_id` lookup checked against materialized SQLite project records; legacy scripts are retired with safety gates; reproducible repair tool (`scripts/repair_dld_project_links.py`) clears dangling keys while preserving manually confirmed links.
6. **RPPI and Third-Party Data Licensing:**
   - RPPI and Bayut are marked disabled in data health registers; no commercial advisory relies on unapproved scrapers or restricted public indices.
