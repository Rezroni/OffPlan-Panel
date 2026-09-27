# Route map

Framework: Next.js 15 App Router. Root layout: `src/app/layout.tsx`.

| URL | Entry | Main rendered component | Purpose |
|---|---|---|---|
| `/` | `src/app/page.tsx` | inline dashboard + desk sections | Investor brief, two-offer comparison, solvency, funding timeline, exit scenarios, PDF preview |
| `/discover` | `src/app/discover/page.tsx` | `DiscoverClient` | Search/filter/paginate DLD project catalog, grid/table modes |
| `/projects/[id]` | `src/app/projects/[id]/page.tsx` | `ProjectDetailClient` | Project overview, unit types, live CMA summary, funding/exit simulator, supply risk |
| `/projects/[id]/cma` | `src/app/projects/[id]/cma/page.tsx` | `CmaAnalysisClient` | Full 3-group CMA with bedroom and transaction-window filters |
| `/developers` | `src/app/developers/page.tsx` | inline server page | Developer delivery discipline and reliability cards |
| `/developers/[id]` | `src/app/developers/[id]/page.tsx` | inline server page | Developer track record, metrics, pipeline, linked projects |
| `/imports` | `src/app/imports/page.tsx` | `ImportsClient` | Upload, parse, verify, and confirm developer inventory revisions |
| `/alternatives` | `src/app/alternatives/page.tsx` | `AlternativesClient` | Budget/strategy/bedroom-driven shortlist and alternative roles |
| `/funding` | `src/app/funding/page.tsx` | `FundingExitSimulator` | Standalone fees, payment plan, solvency, assignment, rental and XIRR simulator |
| `/data-health` | `src/app/data-health/page.tsx` | `DataHealthClient` | DLD dataset health, match queue, approve/reject workflows |
| `/studio` | `src/app/studio/page.tsx` | `ReelsStudioClient` | RU/AR scripts, per-stage copy, 9:16/4:5 data cards, safe-area overlays, dossier generation |
| `/reports` | `src/app/reports/page.tsx` | inline server page | Immutable dossier archive and PDF links |
| `/reports/[id]` | `src/app/reports/[id]/page.tsx` | `ReportDossierView` | Localized dossier viewer, print/PDF, evidence manifest |

API routes support project search, CMA refresh, import parse/confirm, report creation/PDF, studio script generation, unit sync, and shortlist generation under `src/app/api/`.
