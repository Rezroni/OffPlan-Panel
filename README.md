# OffPlan-Panel — Dubai Off-Plan Real Estate Research & Investment Panel

A full-stack, evidence-based research panel and decision dashboard for Dubai off-plan real estate investment, powered by official **Dubai Land Department (DLD)** open data and real transaction records.

---

## 🚀 Key Features

* **Side-by-Side Offer Comparison**: Compare two off-plan options side by side with customizable payment plans, capital calls, and projected exit returns.
* **Live DLD Project Catalog**: Search over **3,039 verified DLD projects** with real-time construction progress, developer names, expected handover dates, and unit configurations.
* **CMA & Valuation Engine**: Accurate comparative market analysis based on verified transaction facts and real rental yields.
* **Data Health Desk**: Real-time database monitoring tracking:
  * **675,046** verified target sales transactions.
  * **1,541,958** verified residential single-contract rent records.
* **Exit Simulator & XIRR Calculator**: Calculate cash-on-cash returns, annualized XIRR, and resale scenarios factoring in DLD fees, transfer costs, and developer milestones.
* **Developer Track Record**: Analytics on top developers in Dubai (handover timeliness, active vs completed projects, pipeline delivery).
* **Exportable PDF Dossiers**: Generate executive investment summaries for client presentations.

---

## 🛠 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server Components)
- **Language**: TypeScript / Node.js
- **Styling**: Tailwind CSS & Lucide Icons
- **Database**: SQLite (via `better-sqlite3` and [Drizzle ORM](https://orm.drizzle.team/))
- **Data Pipeline**: Python 3.12, DuckDB, Async REST ETL for Dubai Land Department OpenAPI
- **Testing**: Vitest & Playwright

---

## 📁 Project Structure

```text
├── src/
│   ├── app/               # Next.js App Router (pages & API routes)
│   │   ├── api/projects/  # DLD catalog project search & unit sync
│   │   ├── data-health/   # Live data health monitor
│   │   ├── developers/    # Developer track record & analytics
│   │   ├── alternatives/  # Automated project alternative matching
│   │   └── page.tsx       # Main Executive Research Desk & Comparison
│   ├── components/        # UI components (desk, catalog, modals)
│   ├── domain/            # Core business logic (returns, funding, CMA, XIRR)
│   └── server/            # Data access layer (DAL), DLD adapter, DB connection
├── db/
│   ├── schema.ts          # Drizzle ORM schema definitions
│   └── migrations/        # SQL migration files
├── DLD PIPELINE/          # Python ETL pipeline for syncing with DLD OpenAPI
├── scripts/               # Maintenance, calibration, and seeding scripts
└── docs/                  # Architectural documentation and guides
```

---

## ⚙️ Quick Start

### 1. Prerequisites
- Node.js 18+ (Node 20+ recommended)
- Python 3.12 (for DLD pipeline ETL)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Rezroni/OffPlan-Panel.git
cd OffPlan-Panel

# Install Node.js dependencies
npm install

# Setup environment variables
cp .env.example .env.local
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Security & Privacy

* Production database files (`.db`, `.duckdb`) and local secrets (`.env*`) are intentionally excluded via `.gitignore`.
* All API keys must be configured locally in `.env.local`.

---

## 📄 License

Proprietary / All rights reserved.
