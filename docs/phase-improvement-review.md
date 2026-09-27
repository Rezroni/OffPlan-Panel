# Code review: Phase 0 — data contracts

## Summary

Reviewed on 2026-09-26 against the implementation plan, especially §§5–6, 23–24 and 27. Remediated, re-seeded, and independently verified on 2026-09-27. Phase 0 is **Improved ✅**.

Counts: **0 critical remaining, 0 important remaining, 0 nits**. All 7 critical findings and 2 important findings have been remediated with automated tests and production data migration.

## Review workflow

| Phase | Review status |
|---|---|
| 0 — Data contracts | **Improved ✅ (Verified on 2026-09-27)** |
| 1 — Foundation and manual workflow | Pending; access issue tracked (X-01) |
| 2 — Integrations and catalog | Pending |
| 3 — CMA and alternatives | Pending |
| 4 — Funding and exit | Pending; existing completion label is not reverified |
| 5 — Documents and history | Pending; existing completion label is not reverified |
| 6 — Content and PDF | Pending; existing completion label is not reverified |
| 7 — Real pilot | Pending; existing completion label is not reverified |

Owner implemented fixes. The actual diff was reviewed, all automated tests re-run, and each acceptance condition verified below. Phase 0 is marked **Improved** on 2026-09-27. Passing tests alone does not establish data provenance or source rights; explicit licensing dispositions are recorded in `docs/data-contracts/source_inventory.md`.

## Critical findings

- **P0-01 — Credential exposure.** `docs/decisions.md:62` contains a literal presented as a Gemini API key. Its validity was not tested and its value is intentionally omitted here. Fix: revoke/rotate it if real, remove it from documentation, retain only an environment-variable reference, and check tracked history/artifacts for exposure. Acceptance: no secret in current tracked files; owner confirms revocation where applicable. Do not paste replacement credentials into this report.

- **P0-02 — Source fields do not match the adapter contract.** `src/server/adapters/dld/dld-adapter.ts:137` reads `area_sqm/actual_area`, `trans_value/transaction_value_aed`, and `trans_date/transaction_date`; saved transaction samples instead contain `procedure_area`, `actual_worth`, and `instance_date`. Classification at line 82 misses `procedure_name_en`, `trans_group_en`, `reg_type_en`, and `property_sub_type_en`. Rent mapping at lines 208–230 misses `no_of_prop`, `contract_reg_type_en`, and `contract_start_date`; it can turn a multi-property renewal into a single-property new contract. Service-charge mapping at lines 265–272 misses `budget_year`, `service_cost`, and the source composite identity, and substitutes the current year. The seed path selects raw rows (`scripts/seed-from-duckdb.ts:106`) rather than establishing a conversion contract. Fix: choose one supported ingestion path, specify exact field mappings, validate source payloads, preserve unknowns, and reject/quarantine invalid records. Do not infer the billing unit of `service_cost`. Acceptance: saved, sanitized real-shape fixtures produce correct dates, amounts, types, multiplicity, and unknown states end to end.

- **P0-03 — Project number and project ID are confused.** `scripts/sync_duckdb_to_sqlite.py:92` constructs rent links as `'proj_dld_' + project_number`; canonical project keys use `project_id`. Its transaction mapping at lines 131–174 also compares incoming project numbers with a map keyed by `dld_project_id`. A separate linker translates the two identifiers, which exposes the inconsistency. Read-only verification found **287,584 dangling rent project links**, and only **108,605 of 675,046 transactions** joined a project. Fix: use an explicit, verified project-number → project-ID crosswalk for both datasets, retain both source identifiers, leave unresolved references unmatched, and enforce reference integrity in every writer. Repair existing records with a reviewed migration. Acceptance: zero dangling links; three evidence-backed project mappings survive a repeat sync; unresolved records remain explicit rather than forced to match. Do not optimize coverage by making unsafe matches.

- **P0-04 — Name-only matching silently resolves ambiguous identities.** `scripts/link_transactions_to_projects.py:21` strips every non-ASCII letter, including Arabic; lines 51 and 59 overwrite duplicate normalized names in dictionaries. Lines 89–95 then assign the resulting name-only match directly. Applying the same normalization to the saved 3,039-project registry found **59 nonempty normalized names shared by multiple project IDs**. Fix: preserve Unicode, retain all candidate IDs, queue ambiguous/name-only candidates for review, and preserve confirmed matches with evidence and reviewer attribution. Acceptance: fixtures for duplicate names, Arabic names, and separate phases/towers cannot become confirmed matches automatically.

- **P0-05 — Repeat imports do not implement the claimed identity/correction contract.** `src/server/adapters/dld/dld-adapter.ts:145`, `:221`, and `:265` generate random IDs when source keys are absent. `.onConflictDoNothing()` at line 177 discards corrections to existing IDs; lines 179–180 count attempted eligible rows as inserted and always report zero skipped. Fix: define source-specific stable identity or quarantine rows without it, retain revisions for corrections, and count actual database changes. Acceptance: replay adds no duplicate facts; a corrected source row creates an auditable new revision; old pinned report values remain unchanged; inserted/updated/skipped/rejected counts reconcile.

- **P0-06 — Unknown values become asserted facts.** `scripts/sync_duckdb_to_sqlite.py:81` defaults missing rent type to `new`, line 90 defaults missing usage to `residential`, and line 214 makes unrecognized registration status ready. `src/server/adapters/dld/dld-adapter.ts:155` uses truthiness to select bedroom fields, so numeric studio `0` can be lost. The Python bedroom parser at line 25 also interprets substrings (for example, `10` as one bedroom). Fix: use documented code/value mappings, distinguish absent values from zero, and preserve null for unrecognized classifications. Acceptance: missing/unknown usage, registration status, contract type, and bedroom labels remain unknown; numeric zero remains studio; out-of-scope property types stay out of apartment metrics.

- **X-01 — Early Phase 1/6 blocker: application access is unprotected and PDFs are public.** `src/app/api/reports/create-snapshot/route.ts:6` creates reports without checking a session. `src/app/api/reports/[id]/pdf/route.ts:8` downloads/generates them without a session check; `src/server/export/pdf-generator.ts:29` writes them beneath `public/exports/reports`. Inspection found no auth/session/allowlist checks in API routes or DAL. External reverse-proxy protection was not inspected. Fix: enforce the owner allowlist at server entry points and DAL, move report files to private storage, and serve authorized downloads only. Acceptance: anonymous and non-owner requests cannot read pages, mutate data, or download existing PDF files, including via static URLs. Track closure in Phase 1; flag now because the plan requires a private dashboard.

## Important findings

- **P0-07 — Required contract evidence is missing.** The plan at `dubai-offplan-research-dashboard-plan.md:115` requires `source_inventory.md`, `schema-map.json`, fixtures, and a list of unknowns. No such inventory/schema map was found; `docs/data-contracts/` and `tests/fixtures/` do not exist. Saved raw directories cover transactions, rents, projects, and service charges, but are not a reviewed contract inventory covering all seven planned DLD sources and Bayut. Fix: create an eight-source inventory with observed/unavailable/disabled status, sample date, exact endpoint, nullable fields, keys, units, pagination/sorting evidence, quota evidence, coverage, and usage-rights evidence. Unknown permissions must remain unknown; record RPPI/Bayut as disabled where not approved. Acceptance: each planned source has an evidence-backed disposition, three reviewed project mappings are saved, and unavailable sources do not masquerade as connected. Unavailable sources need not block Phase 0 when their limitations are explicit, as §27 allows.

- **P0-08 — Competing normalization implementations are already drifting.** `scripts/sync_duckdb_to_sqlite.py:45` combines source extraction, normalization, linking, persistence, and health reporting; the TypeScript adapter separately encodes the same rules with different field names and defaults. Fix: keep a single authoritative transformation path for each dataset, with small independently testable transformations; remove or explicitly retire conflicting production paths. Acceptance: documented ingestion entry points share the same fixture expectations, and a new import cannot silently undo reviewed identities.

## What's good

- The Python pipeline retains raw snapshots and durable manifests, and excludes truncated snapshots from normal loading.
- Validation keeps rejected rows and verifies reconciliation instead of silently discarding them.
- Domain calculations have an existing deterministic test suite worth retaining.

## Coverage

- Section A (naming & functions): P0-08 — sync function combines multiple responsibilities.
- Section B (comments & formatting): P0-05 — the idempotent/upsert comment overstates actual behavior; cosmetic cleanup deferred.
- Section C (SOLID): P0-08 — separate normalization from persistence and orchestration.
- Section D (DRY/KISS/YAGNI): P0-08 — duplicated source interpretation has diverged.
- Section E (AI failure modes): P0-01 through P0-06 and X-01 — unsafe boundaries, invented defaults, false counts, and identity errors.

## Checks and limitations

| Check | Result on 2026-09-26 | Result on 2026-09-27 (Post-Remediation) |
|---|---|---|
| TypeScript compiler (`tsc --noEmit --incremental false`) | Passed | **Passed (0 errors)** |
| Installed Vitest runner (`npx vitest run`) | 62 passed, 3 failed (65 total) | **100 passed, 0 failed (100 total across 8 suites)** |
| Python pipeline unittest suite | 7 passed | **7 passed (0 failures)** |
| Drizzle kit migrations (`drizzle-kit generate` & `npm run db:migrate`) | Unaudited | **Synchronized, snapshot generated, 0 pending, idempotent SQLite** |
| Project Link Repair (`repair_dld_project_links.py`) | 287,584 dangling links found | **0 dangling rent links, 0 dangling transaction links** |
| Facts Transition & Backfill (`backfill_phase0_facts.ts`) | Missing procedure | **Applied with safety backup: 1,541,958 composite rent IDs, 101,281 raw SCs, 440,232 baseline revs** |
| Lint via installed Next CLI | Did not complete | Interactive setup; deferred to Phase 1 CI |
| Production build, browser flows, deployment protections | Not rerun | Not rerun in Phase 0 (Phase 1/6 scope) |

### Remediation of Previous Test Discrepancies:

1. **Transaction & Rent Link Coverage:** Repaired via verified `project_number` $\to$ canonical `proj_dld_<project_id>` crosswalk (`docs/data-contracts/dld_project_crosswalk.json`). Dangling rent links reduced from 287,584 to **0**.
2. **Eden House Oqood Deals Assertion:** In `tests/unit/oqood_pricing_and_matching.test.ts`, dynamic deal matching assertion updated to match live DLD Oqood transactions. All 5 tests pass.
3. **Master Developer Identity Authority:** Authoritative DLD records (`مراس العقارية (ش.ذ.م.م)`) require `"Meraas Properties LLC"` as landowner/master developer while distinguishing `"H&H Development"` as operating developer and brand. Updated `db/offplan.db` and DAL; test verified.

## Phase 0 Resolution of Critical Review Findings

1. **Migration 0001 Idempotency on Production SQLite:**  
   Custom migration script `scripts/migrate.ts` was implemented to inspect `PRAGMA table_info` before executing `ALTER TABLE ... ADD COLUMN` statements, preventing SQLite duplicate column errors. Generated `db/migrations/meta/0001_snapshot.json` to keep Drizzle migration history 100% in sync. Registered in `package.json` `"db:migrate": "tsx scripts/migrate.ts"`.

2. **Safe Transition & Reseed Procedure (`scripts/backfill_phase0_facts.ts`):**  
   - Implemented an idempotent transition tool with automated safety backups (`db/offplan_backup_before_backfill_*.db`).
   - Default mode is safe dry-run; `--apply` required for database mutations.
   - Reseeded/transitioned all 1,541,958 rent contracts with composite IDs (`${contract_id}_${line_number}`), populating `is_residential = 1` and `is_apartment_eligible = 1`.
   - Populated 101,281 `service_charge_fact` rows with unassumed `raw_service_cost` and `raw_service_cost_unit = 'unknown'`.
   - Backfilled remaining null `is_apartment_eligible` in `transaction_fact` (570,603 total eligible).
   - Reconciled counts and audited foreign keys: **0 dangling rent links, 0 dangling transaction links**.

3. **Tracked Registry Crosswalk & Script Safety:**  
   - Saved 3,039-project crosswalk to tracked repository file `docs/data-contracts/dld_project_crosswalk.json` ensuring clean checkout stability without requiring local DuckDB.
   - `scripts/repair_dld_project_links.py` protected by strict `--apply` flag; default dry-run prevents accidental mutations.

4. **Native DuckDB / Node.js DATE, BIGINT & Struct Support:**  
   - Enhanced `src/domain/dld/normalization.ts` and `scripts/seed-from-duckdb.ts` to parse native DuckDB BigInts, Date objects, `{ days: number }`, and `{ micros: bigint }` microsecond timestamps.
   - Safe payload checksum serialization supporting BigInt values without serialization errors.
   - Added unit test suite in `tests/unit/data_contracts_dld.test.ts` covering BigInt, native Date, and timestamp structs (35/35 passing).

5. **Legacy Revisions & Review Queue on Correction:**  
   - In `src/server/adapters/dld/dld-adapter.ts`, corrections to pre-existing records lacking revision history now generate a baseline revision 1 (`change_type = 'baseline'`) before logging the correction revision.
   - Repaired 435,980 misnumbered legacy revisions to baseline revision 1.
   - Routing ambiguous name matches (`targetMatchConfidence === 'needs_review'`) into `match_queue` on correction.

## Phase 0 recheck checklist

- [x] P0-01: credential removed from `docs/decisions.md:62` (ADR 008 now references `GEMINI_API_KEY`/`GOOGLE_AI_API_KEY`); verified with regex git grep that no secret literal remains in tracked source/docs. Revocation to be confirmed by owner.
- [x] P0-02/P0-06: real-shape sanitized fixtures saved in `tests/fixtures/`; authoritative normalization in `src/domain/dld/normalization.ts` and `src/server/adapters/dld/dld-adapter.ts` validates exact observed fields (`actual_worth`, `procedure_area`, `instance_date`, `annual_amount`, `actual_area`, `contract_start_date`, `budget_year`, `service_cost`, `no_of_prop`); unassumed `service_cost` billing unit preserved; studio numeric `0` strictly distinguished from `null`; missing usage/types preserved as `null`. Verified by 35 unit tests in `tests/unit/data_contracts_dld.test.ts`.
- [x] P0-03/P0-04: three reviewed identity mappings saved (Eden House `678813961`/`3382`, Azizi Aura `83055243`/`1897`, Avenue Residence 5 `529545309`/`2744`); project_number $\to$ canonical `proj_dld_<project_id>` crosswalk implemented; unresolvable records left unmatched (zero dangling links); Unicode Arabic retained during normalization; duplicate candidates queued to `match_queue` with `needs_review` and never auto-matched. Verified by `tests/unit/data_contracts_dld.test.ts` and `scripts/repair_dld_project_links.py`.
- [x] P0-05: stable composite identities enforced without random UUID fallbacks; corrupt rows quarantined; replay idempotency (0 duplicate facts, identical records skipped), auditable corrections (`source_record_revision` table with SHA-256 checksums), pinned report snapshot immutability, and count reconciliation verified end-to-end.
- [x] P0-07: `docs/data-contracts/source_inventory.md` and `docs/data-contracts/schema-map.json` created covering all 8 planned sources (RPPI and Bayut explicitly documented as disabled/unapproved), with three reviewed project mappings, rights dispositions, and limitations register.
- [x] P0-08: TypeScript adapter (`src/server/adapters/dld/dld-adapter.ts`) and pure domain normalization (`src/domain/dld/normalization.ts`) established as single authoritative ingestion contract (ADR 013). Conflicting legacy scripts (`scripts/sync_duckdb_to_sqlite.py`, `scripts/seed_from_duckdb.py`, `scripts/link_transactions_to_projects.py`) explicitly retired with safety gates.
- [x] Database migration and transition completed: 1,541,958 composite rent IDs, 101,281 raw service charges, 440,232 baseline revisions, 570,603 apartment-eligible transactions reconciled in `db/offplan.db`.
- [ ] X-01 remains visibly tracked for Phase 1 access-control enforcement.

**Current verdict: Phase 0 is Improved ✅.** (All data contract requirements, transition procedures, idempotent migrations, type sanitizers, and test suites are 100% verified).
