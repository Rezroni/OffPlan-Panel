# OffPlan Desk — UX/UI redesign v2

## Product idea

OffPlan Desk should feel like an investment workspace, not an admin dashboard. The interface must help an analyst move through one clear loop:

1. Find a market or project worth investigating.
2. Test price, liquidity, developer, delivery, and exit risk.
3. Turn the conclusion into a client-ready decision.

The redesign uses a calm editorial visual language inspired by private banking research terminals: warm paper surfaces, deep forest navigation, restrained color, strong data typography, and generous spacing. Color communicates meaning instead of decorating every card.

## Information architecture

### Primary navigation

- **Overview** — daily brief, market pulse, work queue, recent decisions.
- **Research** — unified search across areas, projects, developers, sales, rents, and service charges.
- **Projects** — saved projects, comparisons, project analysis, CMA, funding, and exit scenarios.
- **Clients** — client briefs, suitability, recommendations, dossiers, and follow-ups.

### Secondary tools

- **Content Studio** — Reels and bilingual content generated from approved facts.
- **Data Quality** — DLD sync, imports, unmatched records, freshness, and validation.

This replaces nine equal navigation items with four user goals and two operational tools.

## Core screens

### 1. Overview

- One sentence describing today’s market condition.
- Four restrained dataset/market indicators with source and freshness.
- Opportunity watchlist ranked by decision relevance.
- Client and analyst work queue.
- Alerts only when an action is required.

### 2. Research

- Global command/search field accepts project, area, developer, client, or DLD ID.
- Filter drawer uses plain language: budget, bedrooms, handover, area, strategy, construction stage.
- Table is the default professional view; visual cards are an optional browsing mode.
- Saved searches and comparison tray persist across sessions.

### 3. Project workspace

- Persistent project header with verdict, evidence strength, freshness, and primary action.
- Tabs: Overview, Market evidence, Cash flow, Risks, Documents.
- A sticky decision rail shows recommendation, confidence, open evidence gaps, and client fit.
- CMA, funding, exit, developer history, and supply pipeline become parts of one analysis rather than separate destinations.

### 4. Client workspace

- Brief and constraints first.
- Shortlist with explicit reasons for inclusion and rejection.
- Suitability and liquidity warnings before return projections.
- One route from approved analysis to immutable dossier and social content.

### 5. Data Quality

- Operational screen for analysts, visually separated from client/research work.
- Source health, last successful sync, rejected rows, unmatched entities, and retry actions.
- Technical details expand on demand instead of occupying the main navigation.

## Visual system

- **Palette:** warm stone canvas, ivory work surfaces, forest navigation, moss positive states, ochre warnings, brick critical states.
- **Typography:** editorial serif for conclusions and section headlines; precise grotesk for controls and data; tabular figures for metrics.
- **Density:** compact tables, spacious decision summaries. No universal card grid.
- **Shape:** 14–22px radii for major surfaces, smaller radii for controls. Pills only for filters and status.
- **Elevation:** nested surfaces and soft ambient separation; no strong black shadows or glowing borders.
- **Motion:** 500–700ms weighted transitions using transform and opacity. Reduced-motion preference is respected.
- **Icons:** thin, custom line icons used only where they improve scanning.

## UX rules

- Every screen has one primary action.
- Every financial conclusion names its source date and evidence strength.
- Unknown data is shown as unknown; zero is never used as a substitute.
- Risk color is reserved for risk. Research status uses neutral text.
- “DLD verified” appears beside the relevant fact, not as a global marketing badge.
- English, Russian, and Arabic layouts use the same information hierarchy; Arabic receives native RTL mirroring.
- Keyboard search and command palette are first-class desktop controls.
- Mobile collapses to a bottom navigation with Overview, Research, Projects, and Clients.

## Delivery plan after approval

1. **Foundation:** tokens, typography, app shell, navigation, responsive behavior, accessibility states.
2. **Research:** unified search, filters, saved comparisons, catalog table/card modes.
3. **Decision workspace:** project header, evidence tabs, CMA, funding/exit, risks, developer and pipeline views.
4. **Clients and output:** brief, shortlist, dossier flow, reports, content handoff.
5. **Operations:** imports and data health consolidated into Data Quality.
6. **Hardening:** visual regression, keyboard/VoiceOver pass, responsive tests, performance and production build.

## Prototype scope

The prototype is intentionally separate from the production routes. Its controls demonstrate hierarchy and interaction direction; they do not write data.

- `offplan-v2.html` — daily Overview and mobile direction.
- `workspace-v2.html?view=research` — unified DLD research and comparison tray.
- `workspace-v2.html?view=projects` — active project research board.
- `workspace-v2.html?view=project` — project decision workspace with CMA evidence and verdict rail.
- `workspace-v2.html?view=clients` — client brief, suitability and shortlist.
- `workspace-v2.html?view=studio` — RU/AR content workflow, social preview and locked facts manifest.
- `workspace-v2.html?view=quality` — source health, accepted/rejected rows and issue queue.

The prototype uses verified pipeline totals where source coverage is shown. Market and offer figures inside illustrative decision screens demonstrate the planned hierarchy and must be bound to live DAL queries during implementation.
