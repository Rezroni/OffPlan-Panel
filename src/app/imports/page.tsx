/**
 * /imports — Developer Price Lists & Safe Offer Revisions (§10.2)
 * Server Component
 */

import React from "react";
import { Metadata } from "next";
import { listProjects } from "@/server/dal/catalog";
import { listRecentRevisions } from "@/server/dal/imports";
import { ImportsClient } from "@/components/imports/ImportsClient";
import { Header } from "@/components/desk/Header";
import { FileSpreadsheet, ShieldCheck, Clock, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Document Imports & Revisions — Dubai Off-plan Research Desk",
  description:
    "Upload, validate, and track developer price lists and immutable offer revisions with 48h freshness guarantees.",
};

export default async function ImportsPage() {
  const [projectsRes, recentRevisions] = await Promise.all([
    listProjects({ limit: 200 }),
    listRecentRevisions(20),
  ]);

  const projectOptions = projectsRes.items.map((p) => ({
    id: p.id,
    nameEn: p.nameEn,
    developerBrand: p.developerBrand,
  }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-sky-500/20 selection:text-sky-900">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1.5 shadow-2xs">
                <FileSpreadsheet className="h-3 w-3 text-sky-600" />
                Section 10.2 Compliance
              </span>
              <span className="text-xs text-slate-500 font-mono">
                SHA-256 Checksum &bull; Zero-Macro Sandbox
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Developer Price List Imports
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl font-normal leading-relaxed">
              Upload raw Excel (.xlsx) or CSV files directly received from master developers.
              Preserves unit numbers (e.g. leading zero &ldquo;0102&rdquo;), verifies cryptographic integrity, and enforces 48-hour freshness guards.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white p-3.5 rounded-2xl border border-slate-200/90 text-xs shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-xs">Immutable Revisions</div>
                <div className="text-slate-500 text-[10px]">Audit-trailed history</div>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-xs">48h SLA Warning</div>
                <div className="text-slate-500 text-[10px]">Mandatory re-verification</div>
              </div>
            </div>
          </div>
        </div>

        {/* Client Interactive Workspace */}
        <ImportsClient
          projects={projectOptions}
          recentRevisions={recentRevisions}
        />
      </main>
    </div>
  );
}
