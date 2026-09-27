# Page dependency trees

## `/` — Executive Research Desk
Entry: `src/app/page.tsx`
- `src/components/desk/Header.tsx`
- `src/components/desk/ClientBriefSection.tsx`
  - `src/domain/funding/evaluate-funding.ts`
  - `src/lib/decimal.ts`
- `src/components/desk/OfferComparisonSection.tsx`
  - `src/components/desk/ProjectSelectModal.tsx`
  - `src/domain/cma/comparable-set.ts`
  - `src/domain/exit/transfer-eligibility.ts`
  - `src/domain/funding/evaluate-funding.ts`
  - `src/domain/returns/calculate-period-return.ts`
  - `src/lib/decimal.ts`
- `src/components/desk/FundingTimelineSection.tsx`
- `src/components/desk/ExitScenariosSection.tsx`
- `src/components/desk/PrintPreviewModal.tsx`
- `src/app/globals.css`

## `/discover` — Project Catalog
Entry: `src/app/discover/page.tsx`
- `src/components/catalog/DiscoverClient.tsx`
  - `src/components/desk/Header.tsx`
- `src/server/dal/catalog.ts`
- `src/app/globals.css`

## `/projects/[id]` — Project Intelligence
Entry: `src/app/projects/[id]/page.tsx`
- `src/components/catalog/ProjectDetailClient.tsx`
  - `src/components/desk/Header.tsx`
  - `src/components/funding/FundingExitSimulator.tsx`
    - `src/domain/funding/evaluate-funding.ts`
    - `src/domain/funding/payment-plan-generator.ts`
    - `src/domain/funding/transaction-costs.ts`
    - `src/domain/exit/exit-scenario-engine.ts`
    - `src/domain/returns/calculate-rental-scenario.ts`
    - `src/lib/decimal.ts`
  - `src/components/pipeline/CompetingSupplyPanel.tsx`
- `src/server/dal/catalog.ts`
- `src/server/dal/pipeline.ts`
- `src/app/globals.css`

## `/projects/[id]/cma` — CMA Analysis
Entry: `src/app/projects/[id]/cma/page.tsx`
- `src/components/cma/CmaAnalysisClient.tsx`
- `src/domain/cma/comparable-set.ts`
- `src/server/dal/catalog.ts`
- `src/app/globals.css`

## `/developers` and `/developers/[id]`
- `src/app/developers/page.tsx`
  - `src/components/desk/Header.tsx`
  - `src/server/dal/developers.ts`
- `src/app/developers/[id]/page.tsx`
  - `src/components/desk/Header.tsx`
  - `src/server/dal/developers.ts`
- `src/app/globals.css`

## `/imports`
Entry: `src/app/imports/page.tsx`
- `src/components/desk/Header.tsx`
- `src/components/imports/ImportsClient.tsx`
  - `src/domain/imports/offer-parser.ts`
  - `src/lib/decimal.ts`
- `src/server/dal/catalog.ts`
- `src/server/dal/imports.ts`
- `src/app/globals.css`

## `/alternatives`
Entry: `src/app/alternatives/page.tsx`
- `src/components/alternatives/AlternativesClient.tsx`
  - `src/components/desk/Header.tsx`
  - `src/domain/alternatives/shortlist.ts`
- `src/server/dal/catalog.ts`
- `src/app/globals.css`

## `/funding`
Entry: `src/app/funding/page.tsx`
- `src/components/desk/Header.tsx`
- `src/components/funding/FundingExitSimulator.tsx`
  - `src/domain/funding/evaluate-funding.ts`
  - `src/domain/funding/payment-plan-generator.ts`
  - `src/domain/funding/transaction-costs.ts`
  - `src/domain/exit/exit-scenario-engine.ts`
  - `src/domain/returns/calculate-rental-scenario.ts`
  - `src/lib/decimal.ts`
- `src/app/globals.css`

## `/data-health`
Entry: `src/app/data-health/page.tsx`
- `src/components/catalog/DataHealthClient.tsx`
  - `src/components/desk/Header.tsx`
- `src/server/dal/catalog.ts`
- `src/app/globals.css`

## `/studio`
Entry: `src/app/studio/page.tsx`
- `src/components/desk/Header.tsx`
- `src/components/studio/ReelsStudioClient.tsx`
  - `src/domain/content/content-studio.ts`
  - `src/lib/decimal.ts`
- `src/server/dal/catalog.ts`
- `src/server/dal/developers.ts`
- `src/server/dal/pipeline.ts`
- `src/app/globals.css`

## `/reports` and `/reports/[id]`
- `src/app/reports/page.tsx`
  - `src/components/desk/Header.tsx`
  - `src/server/dal/reports.ts`
- `src/app/reports/[id]/page.tsx`
  - `src/components/reports/ReportDossierView.tsx`
  - `src/server/dal/reports.ts`
- `src/app/globals.css`
