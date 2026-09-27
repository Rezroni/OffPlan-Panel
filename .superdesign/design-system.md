# OffPlan Desk — Decision Workbench design system

## Product and user

OffPlan Desk is a high-trust decision workbench for a Dubai off-plan investment analyst. Its primary job is to move a client case from intake to evidence-backed recommendation, then to bilingual content and an immutable dossier. It is not a generic SaaS analytics dashboard and should not look like a collection of unrelated KPI cards.

Primary user: a single expert analyst working on desktop for long sessions. Secondary output consumers are investors reading reports and social content in Russian or Arabic.

## Information architecture

Reduce nine equal top-level destinations into five stable workspaces:

1. **Overview** — today’s cases, deadlines, data alerts and recent dossiers.
2. **Research** — Projects, Developers and Market/Data Health as contextual tabs.
3. **Cases** — client brief, compare offers, alternatives and funding/exit analysis in a guided case workspace.
4. **Studio** — RU/AR script and data-card production.
5. **Documents** — immutable dossiers, PDF exports and source imports.

Use a left navigation rail on desktop and a bottom/sheet navigation model on smaller screens. Put global search/command in the top bar. Sub-features are contextual tabs or a step rail, not permanent global navigation.

## Visual direction: Cadastral workbench

The design language borrows from cadastral plans, architectural schedules and investment committee memos: precise alignment, calm white space, plot-line dividers, readable data tables, strong evidence provenance. Avoid faux-luxury gradients, glassmorphism, neon dark dashboards, identical floating cards, emoji, marketing hero sections and decorative AI motifs.

The one memorable device is a **decision ribbon**: a slim persistent horizontal strip that summarizes the active case as `Capital → Solvency → Market gap → Exit`, with each stage clickable and status-aware. Everything else remains restrained.

## Color tokens

- `paper` `#F5F7F8` — cool neutral canvas.
- `surface` `#FFFFFF` — primary panels and sheets.
- `ink` `#12212E` — main text and navigation rail.
- `slate` `#536575` — secondary copy and muted controls.
- `line` `#D7E0E6` — structural dividers.
- `registry` `#0B6E69` — verified/primary action, derived from official registry trust cues.
- `registry-soft` `#E5F3F1` — selected states and verified evidence.
- `signal` `#C9821A` — review required, funding pressure and non-critical risk.
- `risk` `#B6464F` — failed gate and destructive actions.
- `info` `#2E5FA7` — neutral analytical comparison and links.

No purple, magenta, cyan gradients, or black glass panels. Color communicates evidence state only.

## Typography

- UI and narrative: `Instrument Sans`, fallback `Arial, sans-serif`.
- Arabic: `Noto Sans Arabic`, fallback sans-serif.
- Numbers use the same Instrument Sans family with tabular numerals, not a decorative monospace.
- Page title 30/36 semibold; section title 20/26 semibold; body 14/21 regular; labels 12/16 medium; dense table text 13/18.
- Sentence case everywhere. Do not use tracked all-caps eyebrow labels. Avoid unexplained section numbers like “Phase 4” in primary UI; methodology references belong in evidence drawers.

## Layout and spacing

- Desktop shell: 224px left rail, 56px top command bar, fluid content capped at 1440px.
- Core grid: 12 columns, 24px gutters; base spacing unit 4px.
- Page content uses 24–32px outer padding and 16–24px internal gaps.
- Cards exist only for true groups. Prefer sections, split panes and tables with dividers over card grids.
- Corner radii: 8px controls, 10px panels, 999px only for compact status chips.
- Shadows: none on ordinary surfaces; one restrained `0 8px 24px rgba(18,33,46,.10)` for menus, modals and floating drawers.

## Components and interaction

- Primary button: registry green fill; secondary button: white with line border; tertiary: text-only.
- Status chips combine icon + plain-language label: Verified, Needs review, At risk, Failed. Never rely on color alone.
- Tables use sticky headers, resizable density, row selection and a right-side detail drawer.
- Filters appear as a compact query bar; active filters become removable tokens. Advanced filters stay collapsed.
- Forms use clear labels above inputs, help only when needed, formatted AED values, and inline validation.
- Calculators update a pinned result summary and show assumptions in a disclosure panel.
- Empty states explain the next action. Loading uses local skeletons so one module never blocks the whole shell. Errors name what failed and offer Retry.
- All click targets at least 40px, visible keyboard focus, reduced-motion support, AA contrast.

## Motion

Motion is functional: a 160–220ms drawer or disclosure transition, a brief status confirmation, and a single decision-ribbon update when inputs change. No staggered card entrances or ambient pulsing.

## Screen behavior

### Overview
Start with “Continue your work”, not a marketing hero. Show active client cases, the next required decision, time-sensitive data health issues and recent exports. Primary CTA: `New investment case`.

### Research / Projects
Search-first split view: dense results table or list on the left, selected project quick view on the right. Preserve grid/table choice. Project quick view surfaces developer, handover, construction, unit types, evidence freshness and `Open full analysis`.

### Project detail and CMA
Use a stable project identity header and contextual tabs: Overview, Market, Funding, Supply, Evidence. Surface the conclusion first, then supporting comparable groups. Keep filters visible and table provenance easy to inspect.

### Cases
Use a guided but non-blocking workspace: Brief → Compare → Funding → Recommendation. The decision ribbon remains visible. Users may jump between stages without losing entered values.

### Funding & exit
Use a two-pane workbench: editable assumptions on the left; capital timeline, solvency and Flip/Hold comparison on the right. Advanced details are disclosures, not one continuous page.

### Developers
Use a sortable evidence table with clear reliability definitions. Developer detail shows delivery history timeline, active pipeline and related projects.

### Imports and Data Health
Treat both as operations workflows. Imports: Upload → Map → Validate → Confirm. Data Health: issue queue with severity, source, affected entity, proposed match and Approve/Reject actions.

### Studio
Use three panes: project facts, localized script editor, live social-card preview. RU/AR switch changes both script and preview. Copy actions confirm locally.

### Documents
Archive is a searchable table. Dossier view adopts document typography, sticky language/export controls and clear evidence manifest.

## Responsive behavior

Desktop is primary. At 1024–1279px collapse the rail to icons with tooltips. Below 768px convert split views into list → detail navigation, keep the decision ribbon horizontally scrollable, stack forms, and use bottom sheets for filters. No desktop table should merely overflow without an alternate compact row treatment.

## Self-critique against generic dashboard defaults

This system deliberately removes the current generic SaaS-card kit, faux-premium dark gradients, badge noise and nine-item top dock. The architecture is specific to real-estate due diligence: cases, registry evidence, capital gates and immutable dossiers. The decision ribbon is the singular expressive element; other surfaces remain quiet and operational.
