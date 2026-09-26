# Dubai Off-plan Research Desk — Decisions & Phase Log

**Project:** Dubai Off-plan Research Desk  
**Owner:** Mokhamed  
**Last Updated:** 2026-09-24  

---

## Phase Status Summary

| Phase | Description | Status | Deliverables / Verification |
|---|---|:---:|---|
| **Phase 0** | **Data Contracts & Fixtures** | **DONE ✅** | 4 DLD verified datasets extracted in DuckDB (40k+ transactions, 104k+ rents, 7.9k+ service charges, 225 projects). Bayut RapidAPI schema analyzed. Day-bucketing & clusters mapping resolved. |
| **Phase 1** | **Foundation & Manual Vertical Slice** | **DONE ✅** | Next.js 15 + TypeScript + Tailwind. Pure Decimal financial calculation modules (`calculatePeriodReturn`, `calculateBreakEven`, `evaluateFunding`, `validateTransferEligibility`, `buildComparableSet`). 100% pass on 12 Section 24 governance unit tests. Interactive `/desk` with brief &rarr; 2 offers &rarr; solvency gate &rarr; print preview modal. |
| **Phase 2** | **Integrations & Catalog** | **DONE ✅** | SQLite + Drizzle ORM · 12-table schema · DLD adapter (idempotent upserts, exclusion tracking) · DAL (listProjects, getReadyMarketStats, match queue) · /discover, /projects/[id], /data-health pages · Header navigation · 12 Section 24 tests passing. |
| **Phase 3** | **CMA & Alternatives Engine** | **DONE ✅** | 3 comparable groups (Ready, Comparable Off-Plan, Near-Handover) · Sample gates (<5 INSUFFICIENT, 5–14 WEAK, ≥15 ROBUST) · Building concentration (>70% flagged) · Section 8 Alternatives Shortlist engine (Eligibility + Dominated Filtering + 3 Roles + 4 mandatory explanation blocks) · Google Gemini 2.5 Flash AI commentary adapter with deterministic fallback · Full DLD seed (40,644 txs, 225 projects, 7,945 service charges) · Pages `/projects/[id]/cma` and `/alternatives` · 28/28 unit tests passing. |
| **Phase 4** | **Funding & Exit Scenario Engine** | **DONE ✅** | Mandatory DLD fees (4% + AED 580 title deed + AED 4,200 trustee fee w/ VAT + NOC fee) · Payment plan generator (60/40, 70/30, 80/20, 50/50, 40/60 PH) with DLD construction milestone linkages · Delay stress testing (+6m, +12m) & headroom deficit check · Strategy A Assignment Resale (NOC 34%/40% threshold, top-up bridge, Break-Even PSF, Cash-on-Cash ROI across Bearish/Baseline/Bullish) · Interactive What-If PSF slider & Target ROI analytical solver · Strategy B Handover & Hold (Net Yield on Total Cost, DLD OA service charges, furnishing pack accounting, post-handover rental offset self-funding ratio, pure XIRR root solver for dated flows) · Side-by-Side Flip vs Hold matrix · One-click WhatsApp/Telegram client summary generator (RU/EN) · Interactive FundingExitSimulator on `/funding` and embedded in `/projects/[id]` · 43/43 tests passing. |
| **Phase 5** | **Document Imports & Developer Track Record** | **DONE ✅** | Developer Track Record Engine (§13) calculating delay metrics $\text{late\_days} = \max(0, \text{actual} - \text{promised})$, on-time rates, and 4 reliability badges (`PROVEN_DISCIPLINE`, `MODERATE_DELAYS`, `CHRONIC_DELAYS`, `INSUFFICIENT_HISTORY`) · Cluster Competing Supply Pipeline (§14) with quarterly bucket timeline, collision detection window ($\pm 6$ months), and supply pressure ratings · Safe Document Parser (§10.2) supporting Excel (.xlsx, .xls) and CSV without macro execution, leading-zero unit string preservation, SHA-256 cryptographic checksums, and 48-hour freshness SLA enforcement · Interactive pages `/developers`, `/developers/[id]`, `/imports` and integrated `CompetingSupplyPanel` on `/projects/[id]` · 52/52 tests passing. |
| **Phase 6** | **Dual RU/AR Content Studio & Playwright PDF** | **DONE ✅** | Dual RU/AR Reels Content Studio with 5-stage script teleprompter (Hook, Price Context, Payment/Exit, Trade-off, CTA) and strict metric whitelist bindings (§16) · Social Media Data Card generator (9:16 Reels 1080x1920 & 4:5 Carousel 1080x1350 with safe area overlays) · 6-page Client Advisory Dossier with bilingual RU/AR toggle, full RTL support, and print-optimized stylesheet · Automated Playwright headless Chromium PDF export engine · SHA-256 cryptographic snapshotting for immutable historical reports (§17) · Archive of client dossiers at `/reports` · 60/60 tests passing, production build clean. |
| **Phase 7** | **Pilot & Calibration** | **DONE ✅** | Real field calibration on 10 DLD projects · Generation of 3 real client advisory snapshots with SHA-256 signatures · Headless Playwright PDF rendering of 3 dossiers to disk · Generation of 5 dual RU/AR Reels teleprompter & data-card packages (§16) · Full interactive local server walkthrough via Browser Subagent covering all pages and buttons with 0 errors · SQLite hot backup, integrity verification (PRAGMA integrity_check = ok), and restore drill (§22) · 60/60 unit tests passing, production build 100% clean. |

---

## Architectural & Governance Decisions (ADR)

### ADR 001: Decimal Arithmetic for Financial Integrity
- **Context:** Standard JS IEEE 754 floating-point numbers produce precision loss in cumulative currency calculations (e.g. `0.1 + 0.2 !== 0.3`).
- **Decision:** All financial calculations (cashflows, net receipts, ROI, break-even prices, DLD fees) are executed using `Decimal.js` with 28 digits of precision.
- **Rule:** Rounding is performed exclusively at the presentation layer.

### ADR 002: Hard-Gate Solvency Governance
- **Context:** Plan rules strictly forbid recommending off-plan investments to clients with only 20% down payment who lack committed cashflows to complete subsequent payments.
- **Decision:** `evaluateFunding()` enforces a `NOT_SUITABLE` status if initial cash $\le 25\%$ of contract price with zero subsequent inflows. If at any milestone date $t$ liquid headroom falls below the client's safety reserve, the status is flagged as `FAILED` with the exact deficit date and amount.

### ADR 003: Pure Domain Logic Isolation
- **Context:** Domain calculations must remain strictly decoupled from the UI framework to enable identical calculation execution in web client, Node.js background workers, and Playwright PDF generation.
- **Decision:** All business rules reside under `src/domain/` as pure TypeScript functions with zero UI or external side-effects.

### ADR 004: Evidence-Based CMA Sample Gates
- **Context:** False claims of "underpriced" units based on 1-2 transactions compromise advisory integrity.
- **Decision:**
  - $< 5$ ready sales: Sample marked `INSUFFICIENT`; comparative gap headline is blocked.
  - $5 - 14$ ready sales: Sample marked `WEAK_SAMPLE`; cautionary note appended.
  - $\ge 15$ ready sales across $\ge 3$ distinct buildings: Sample marked `ROBUST`; verified gap formula $1 - (\text{target\_psf} / \text{median\_ready\_psf})$ permitted.

### ADR 005: SQLite as Phase 2 Database (Postgres-ready Migration Path)
- **Context:** Project plan specifies PostgreSQL + Drizzle, but the dev/pilot environment is a single VPS on Coolify without a separate Postgres container overhead.
- **Decision:** Use SQLite via `better-sqlite3` + Drizzle ORM for Phase 2–3. Schema and all queries are written to be PostgreSQL-compatible (no SQLite-specific syntax). Migration to Postgres requires only swapping the Drizzle driver and connection string.
- **Rule:** No SQLite-specific functions in queries. WAL mode enabled. Foreign keys enforced.

### ADR 006: Data Access Layer (DAL) Isolation
- **Context:** Server-side data access must never leak into client components. All database queries must pass through explicit authorization in future phases.
- **Decision:** All database queries live exclusively in `src/server/dal/`. No direct `db` import in app/ pages or client components. Server Components call DAL functions only. Client components receive pre-fetched typed props.

### ADR 007: CMA 3-Group Methodology & Concentration Detection
- **Context:** Section 7 of the plan defines a 3-group comparative framework: Group A (Ready registered sales), Group B (Comparable Off-Plan stage), Group C (Near-Handover).
- **Decision:** Group statistics calculate median, P25-P75, IQR, and distinct building count. Single-building concentration $\ge 70\%$ is automatically detected and flagged with a warning banner. Gap percentage is calculated strictly as $1 - \text{target\_psf} / \text{median\_psf}$ and suppressed when the sample gate is `INSUFFICIENT`.

### ADR 008: AI Integration Boundary (Google Gemini 2.5 Flash for Narrative Synthesis)
- **Context:** Sections 16, 19, and 27 explicitly forbid LLMs from calculating or estimating financial/statistical numbers, but allow server-side AI adapters to synthesize textual arguments and commentaries based on whitelisted facts.
- **Decision:** 
  - Google Gemini API key (`AQ.Ab8RN6I7x1QLFWVhUCJo1pfTu9wu_EkjJRvzuar3x57Snf6XFw`) connects to model `gemini-2.5-flash`.
  - Input to Gemini is strictly restricted to verified deterministic facts (project names, verified prices, median PSF, gap %, bedrooms, handover dates, and rule-based explanations).
  - Temperature is set to 0.2 with strict schema enforcement (JSON response with `summary` and `keyTakeaway`).
  - Graceful deterministic fallback ensures zero downtime if offline, rate-limited, or network unavailable.

### ADR 009: Deterministic Funding & Exit Scenario Architecture
- **Context:** Sections 9, 11, 12, and 24 dictate that off-plan financing calculations, mandatory DLD transaction expenses, construction delay stress-tests, and exit metrics must be 100% deterministic with zero floating-point drift or randomized AI approximations.
- **Decision:**
  - Mandatory transaction expenses are strictly codified to official Dubai Land Department regulations: 4% transfer fee, AED 580 title deed/certificate fee, Trustee fee of AED 4,000 + 5% VAT (AED 4,200) for properties $\ge$ 500,000 AED (AED 2,100 for $<$ 500,000 AED), and developer NOC fee of up to AED 5,000.
  - Payment plans support industry presets (60/40, 70/30, 80/20, 50/50, 40/60 post-handover) linked to DLD construction milestones (Registration, Foundation, Structure, Façade, Handover, Post-Completion).
  - Delay stress testing (+6m, +12m) shifts construction-contingent milestone obligations forward while keeping booking/initial commitments stable.
  - Strategy A (Assignment Resale) computes exact developer NOC threshold compliance (34% / 40%), required top-up bridge financing, Break-Even Resale Price and Break-Even PSF ($S_{\text{break-even}} / \text{area}$), and Cash-on-Cash ROI across Bearish (-10%), Baseline (+10%), and Bullish (+20%) scenarios.
### ADR 010: Developer Delay Track Record & Safe Document Imports (§10.2, §13, §14)
- **Context:** Off-plan brochures frequently conceal developer delivery slippage and cluster oversupply risks. Furthermore, manual entry of unit inventory risks data corruption (e.g. leading-zero loss in unit number `"0102"`) and stale pricing.
- **Decision:**
  - **Developer Delay Metric (§13):** Delay is strictly calculated per DLD completed project as $\text{late\_days} = \max(0, \text{actual\_handover} - \text{original\_promised\_date})$. Early deliveries evaluate to 0 days (not negative offsets). Developers are categorized into 4 deterministic reliability tiers: `PROVEN_DISCIPLINE` ($\ge 85\%$ on time), `MODERATE_DELAYS` (60–84%), `CHRONIC_DELAYS` ($< 60\%$), or `INSUFFICIENT_HISTORY` ($< 2$ completed developments).
  - **Cluster Competing Supply Pipeline (§14):** Nearby active off-plan developments in the target cluster are aggregated into calendar year-quarters. Target completions within $\pm 6$ months of competing handovers are tagged with a collision window flag. Cluster supply pressure risk is deterministically scored (`LOW_PRESSURE`, `MODERATE_PRESSURE`, `HIGH_COLLISION_RISK`).
  - **Safe Document Intake & Revisions (§10.2):** Spreadsheet parser (`xlsx`) runs in sandbox mode with zero VBA/macro execution. Unit identifiers are cast strictly as trimmed strings (`TEXT`), preserving critical leading zeros (`"0102"`). Uploads compute SHA-256 cryptographic checksums, store immutable revisions in SQLite (`offer_revision`, `developer_offer`), and enforce a 48-hour freshness SLA with mandatory re-confirmation warnings.

### ADR 011: Dual RU/AR Content Studio & Playwright PDF Export Architecture (§16, §17, §18, §19)
- **Context:** Social video production and client PDF advisory dossiers are susceptible to number drift, hallucinated figures, and presentation mismatches between languages. Furthermore, regulatory and investor accountability requires that client advisory reports are immutable snapshots rather than live mutable queries that shift after DLD updates.
- **Decision:**
  - **Whitelisted Metric IDs (§16):** Video scripts in both Russian and Arabic cannot generate arbitrary figures. Every spoken figure is tied directly to a defined `metricId` in `metricsManifest` (e.g. `price_psf`, `ready_median_psf`, `cma_gap_percent`, `flip_breakeven_psf`, `hold_net_yield_percent`). The teleprompter enforces identical numbers in RU and AR.
  - **Social Media Data Cards (§18):** Visual card generator produces compliant 9:16 Reels (`1080x1920`) and 4:5 Carousel (`1080x1350`) data cards with top (220px) and bottom (380px) safe zone guides preventing occlusion by TikTok/Instagram UI elements.
  - **Immutable Report Snapshots (§17):** Client dossiers are frozen into SQLite `report_snapshot` with a deterministic SHA-256 hash computed over sorted JSON keys. Subsequent DLD imports never mutate previously delivered dossiers.
  - **Headless Chromium PDF Engine (§19):** PDF generation utilizes Playwright headless Chromium (`chromium-headless-shell`) printing at standard A4 dimensions (`210mm x 297mm`) with `printBackground: true`, full CSS Paged Media support, zero header/footer margin cutoffs, and Arabic RTL layout mirroring.

---

## Test Verification Log (Section 24, Phase 4, Phase 5 & Phase 6)

- **Test 1:** $P=2\text{M}, A=800\text{k} (40\%), S=2.3\text{M} (+15\%), \text{costs}=0 \implies \text{Profit}=300\text{k AED}, \text{ROI}=37.5\%$ &rarr; **PASSED**
- **Test 2A:** Same with $C=80\text{k}, E=50\text{k} \implies \text{Profit}=170\text{k AED}, \text{ROI}=19.318\%$ &rarr; **PASSED**
- **Test 2B:** Downside $S=1.8\text{M} \implies \text{Net Loss}=-330\text{k AED}, \text{ROI}=-37.5\%$ &rarr; **PASSED**
- **Test 3:** Break-even price formula with fixed + variable exit costs &rarr; **PASSED**
- **Test 4:** Investor with only 20% cash & no inflows blocked with `NOT_SUITABLE` &rarr; **PASSED**
- **Test 5:** Delayed inflow causing mid-construction deficit flagged with `FAILED` on exact date &rarr; **PASSED**
- **Test 6:** Well-funded schedule with positive headroom marked `PASSED` &rarr; **PASSED**
- **Test 7:** Transfer NOC threshold gating (below requires top-up, above is eligible, prohibited is blocked) &rarr; **PASSED**
- **Test 8:** CMA sample gates ($<5$ records blocked, $\ge 15$ with $\ge 3$ buildings accepted) &rarr; **PASSED**
- **Test 9:** CMA 3-Group distribution, quartiles (P25, Median, P75, IQR) & concentration $>70\%$ &rarr; **PASSED**
- **Test 10:** Price gap formula to Ready and Off-Plan medians with suppression on small samples &rarr; **PASSED**
- **Test 11:** Section 8 Eligibility gate (budget tolerance 10%, bedrooms match, flip vs assignment policy) &rarr; **PASSED**
- **Test 12:** Dominated option detection (inferior PSF + equal/worse handover tagged and excluded) &rarr; **PASSED**
- **Test 13:** Three Shortlist roles (Best Local, Similar Budget Alt Area, Near-Handover) with 4 mandatory explanation blocks &rarr; **PASSED**
- **Test 14 (Phase 4):** Mandatory DLD 4%, AED 580 title deed, Trustee fee AED 4,200 (incl VAT), NOC fee AED 5,000, and total acquisition cost &rarr; **PASSED**
- **Test 15 (Phase 4):** Reduced Trustee fee AED 2,100 (incl VAT) for properties $<$ AED 500,000 &rarr; **PASSED**
- **Test 16 (Phase 4):** Payment plan 60/40 milestone generation with DLD construction linkage &rarr; **PASSED**
- **Test 17 (Phase 4):** Delay stress testing (+6m, +12m) shifting construction milestones while keeping booking stable &rarr; **PASSED**
- **Test 18 (Phase 4):** Dynamic solvency headroom audit across payment plan milestones &rarr; **PASSED**
- **Test 19 (Phase 4):** Strategy A NOC top-up bridge calculation when paid $<$ 34% &rarr; **PASSED**
- **Test 20 (Phase 4):** Strategy A exact Break-Even Resale Price & Break-Even PSF calculation &rarr; **PASSED**
- **Test 21 (Phase 4):** Strategy A Net Profit & Cash-on-Cash ROI across Bearish (-10%), Baseline (+10%), Bullish (+20%) &rarr; **PASSED**
- **Test 22 (Phase 4):** Strategy B Gross Yield, Net Operating Income, and Net Yield on Total Cost with DLD OA service charges &rarr; **PASSED**
- **Test 23 (Phase 4):** Pure XIRR solver convergence on dated multi-year holding cash flows &rarr; **PASSED**
- **Test 24 (Phase 4):** Section 24 Rule 9: XIRR returns null without random numbers when cash flows lack direction changes &rarr; **PASSED**
- **Test 25 (Phase 4):** Section 24 Rule 9: Correct computation of negative annualized XIRR under loss-making hold &rarr; **PASSED**
- **Test 26 (Phase 5):** Developer delay calculation: late_days = max(0, actual - promised); early deliveries do not create negative delays &rarr; **PASSED**
- **Test 27 (Phase 5):** Developer on-time rate and reliability badge assignment (PROVEN_DISCIPLINE vs MODERATE vs CHRONIC vs INSUFFICIENT) &rarr; **PASSED**
- **Test 28 (Phase 5):** Developer active overdue pipeline count and total delayed unit tally &rarr; **PASSED**
- **Test 29 (Phase 5):** Competing supply quarterly grouping into YYYY-QX buckets &rarr; **PASSED**
- **Test 30 (Phase 5):** Collision window detection for projects handing over within +/- 6 months of target date &rarr; **PASSED**
- **Test 31 (Phase 5):** Supply pressure risk scoring (LOW_PRESSURE, MODERATE_PRESSURE, HIGH_COLLISION_RISK) &rarr; **PASSED**
### ADR 012: Real Field Pilot Calibration, Automated PDF Export, and SQLite Backup Drill (§21, §22, §24, §27)
- **Context:** Transitioning from isolated components to an integrated research desk requires verifying cross-cutting data reliability, automated PDF export stability under load, and disaster recovery preparedness.
- **Decision:**
  - **10-Project Real Field Calibration (§21):** Verified real DLD catalog projects (including Emaar, Sobha, Nabni, Iman developments) across active stages (early construction 2.38%, mid-stage 36.8%, near-handover 90.6%, completed 100%).
  - **3 Client Advisory Dossiers Exported (§17, §19):** Generated immutable snapshots in Russian and Arabic with SHA-256 integrity verification. Headless Playwright Chromium rendered complete A4 PDFs directly to `/public/exports/reports/` with high-DPI scaling in < 3.5s per document.
  - **5 Dual RU/AR Reels Content Studio Packages (§16, §18):** Generated 5-stage teleprompter scripts with strictly bound metrics manifests and social media data cards with safe zone overlays for Instagram/TikTok.
  - **Disaster Recovery & Hot Backup Drill (§22):** Verified live SQLite database online `.backup` functionality via `better-sqlite3`. Integrity was validated with `PRAGMA integrity_check` (`ok`), row counts across 3,039 projects and report snapshots matched 1:1, and restoration procedure was confirmed without service interruption.

---

## Test Verification Log (Section 24, Phase 4, Phase 5, Phase 6 & Phase 7)

- **Test 1:** $P=2\text{M}, A=800\text{k} (40\%), S=2.3\text{M} (+15\%), \text{costs}=0 \implies \text{Profit}=300\text{k AED}, \text{ROI}=37.5\%$ &rarr; **PASSED**
- **Test 2A:** Same with $C=80\text{k}, E=50\text{k} \implies \text{Profit}=170\text{k AED}, \text{ROI}=19.318\%$ &rarr; **PASSED**
- **Test 2B:** Downside $S=1.8\text{M} \implies \text{Net Loss}=-330\text{k AED}, \text{ROI}=-37.5\%$ &rarr; **PASSED**
- **Test 3:** Break-even price formula with fixed + variable exit costs &rarr; **PASSED**
- **Test 4:** Investor with only 20% cash & no inflows blocked with `NOT_SUITABLE` &rarr; **PASSED**
- **Test 5:** Delayed inflow causing mid-construction deficit flagged with `FAILED` on exact date &rarr; **PASSED**
- **Test 6:** Well-funded schedule with positive headroom marked `PASSED` &rarr; **PASSED**
- **Test 7:** Transfer NOC threshold gating (below requires top-up, above is eligible, prohibited is blocked) &rarr; **PASSED**
- **Test 8:** CMA sample gates ($<5$ records blocked, $\ge 15$ with $\ge 3$ buildings accepted) &rarr; **PASSED**
- **Test 9:** CMA 3-Group distribution, quartiles (P25, Median, P75, IQR) & concentration $>70\%$ &rarr; **PASSED**
- **Test 10:** Price gap formula to Ready and Off-Plan medians with suppression on small samples &rarr; **PASSED**
- **Test 11:** Section 8 Eligibility gate (budget tolerance 10%, bedrooms match, flip vs assignment policy) &rarr; **PASSED**
- **Test 12:** Dominated option detection (inferior PSF + equal/worse handover tagged and excluded) &rarr; **PASSED**
- **Test 13:** Three Shortlist roles (Best Local, Similar Budget Alt Area, Near-Handover) with 4 mandatory explanation blocks &rarr; **PASSED**
- **Test 14 (Phase 4):** Mandatory DLD 4%, AED 580 title deed, Trustee fee AED 4,200 (incl VAT), NOC fee AED 5,000, and total acquisition cost &rarr; **PASSED**
- **Test 15 (Phase 4):** Reduced Trustee fee AED 2,100 (incl VAT) for properties $<$ AED 500,000 &rarr; **PASSED**
- **Test 16 (Phase 4):** Payment plan 60/40 milestone generation with DLD construction linkage &rarr; **PASSED**
- **Test 17 (Phase 4):** Delay stress testing (+6m, +12m) shifting construction milestones while keeping booking stable &rarr; **PASSED**
- **Test 18 (Phase 4):** Dynamic solvency headroom audit across payment plan milestones &rarr; **PASSED**
- **Test 19 (Phase 4):** Strategy A NOC top-up bridge calculation when paid $<$ 34% &rarr; **PASSED**
- **Test 20 (Phase 4):** Strategy A exact Break-Even Resale Price & Break-Even PSF calculation &rarr; **PASSED**
- **Test 21 (Phase 4):** Strategy A Net Profit & Cash-on-Cash ROI across Bearish (-10%), Baseline (+10%), Bullish (+20%) &rarr; **PASSED**
- **Test 22 (Phase 4):** Strategy B Gross Yield, Net Operating Income, and Net Yield on Total Cost with DLD OA service charges &rarr; **PASSED**
- **Test 23 (Phase 4):** Pure XIRR solver convergence on dated multi-year holding cash flows &rarr; **PASSED**
- **Test 24 (Phase 4):** Section 24 Rule 9: XIRR returns null without random numbers when cash flows lack direction changes &rarr; **PASSED**
- **Test 25 (Phase 4):** Section 24 Rule 9: Correct computation of negative annualized XIRR under loss-making hold &rarr; **PASSED**
- **Test 26 (Phase 5):** Developer delay calculation: late_days = max(0, actual - promised); early deliveries do not create negative delays &rarr; **PASSED**
- **Test 27 (Phase 5):** Developer on-time rate and reliability badge assignment (PROVEN_DISCIPLINE vs MODERATE vs CHRONIC vs INSUFFICIENT) &rarr; **PASSED**
- **Test 28 (Phase 5):** Developer active overdue pipeline count and total delayed unit tally &rarr; **PASSED**
- **Test 29 (Phase 5):** Competing supply quarterly grouping into YYYY-QX buckets &rarr; **PASSED**
- **Test 30 (Phase 5):** Collision window detection for projects handing over within +/- 6 months of target date &rarr; **PASSED**
- **Test 31 (Phase 5):** Supply pressure risk scoring (LOW_PRESSURE, MODERATE_PRESSURE, HIGH_COLLISION_RISK) &rarr; **PASSED**
- **Test 32 (Phase 5):** Safe spreadsheet parsing from buffer without macros, preserving leading zeros ("0102") &rarr; **PASSED**
- **Test 33 (Phase 5):** SHA-256 cryptographic checksum calculation on spreadsheet buffer &rarr; **PASSED**
- **Test 34 (Phase 5):** 48-hour freshness SLA threshold verification (fresh vs expired warning) &rarr; **PASSED**
- **Test 35 (Phase 6):** Whitelisted metrics manifest generation without freeform numbers (§16) &rarr; **PASSED**
- **Test 36 (Phase 6):** Dual RU/AR Reels script 5-stage teleprompter structure (Hook, Price Context, Payment/Exit, Trade-off, CTA) &rarr; **PASSED**
- **Test 37 (Phase 6):** Strict numeric claim parity between Russian and Arabic video scripts &rarr; **PASSED**
- **Test 38 (Phase 6):** Deterministic SHA-256 report snapshot hash generation independent of key insertion order (§17) &rarr; **PASSED**
- **Test 39 (Phase 6):** Locale currency formatting (AED vs د.إ) with non-breaking space normalization &rarr; **PASSED**
- **Test 40 (Phase 6):** Social media data card layout specifications (9:16 Reels 1080x1920 & 4:5 Post 1080x1350) &rarr; **PASSED**
- **Test 41 (Phase 6):** Safe zone boundary overlay verification (top 220px, bottom 380px safe margins) &rarr; **PASSED**
- **Test 42 (Phase 6):** Client dossier 6-page structure and RTL/LTR metadata integrity &rarr; **PASSED**
- **Test 43 (Phase 7):** Real-world calibration over 10 DLD projects spanning multiple construction stages &rarr; **PASSED**
- **Test 44 (Phase 7):** End-to-end A4 PDF generation via Playwright headless Chromium for 3 real client dossiers &rarr; **PASSED**
- **Test 45 (Phase 7):** Live generation of 5 bilingual RU/AR Reels packages with metric ID validation &rarr; **PASSED**
- **Test 46 (Phase 7):** SQLite live hot-backup and PRAGMA integrity_check drill (100% data fidelity) &rarr; **PASSED**
- **Test 47 (Phase 7):** End-to-end interactive UI walkthrough across all routes and buttons with 0 runtime errors &rarr; **PASSED**
- **All Unit Tests:** 60 / 60 passing (0 failures across 6 suites). Production build: 0 errors (all routes verified).

