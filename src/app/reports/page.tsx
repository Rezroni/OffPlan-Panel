/**
 * /reports — Client Advisory Reports Archive (§17, §18)
 * Server Component
 */

import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/desk/Header";
import { listRecentReportSnapshots } from "@/server/dal/reports";
import {
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Lock,
  Building2,
  Clock,
  Printer,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client Advisory Reports Archive — Dubai Off-plan Research Desk",
  description:
    "Audit-trailed immutable client dossiers and Playwright PDF exports generated from verified DLD data.",
};

export default async function ReportsArchivePage() {
  const reports = await listRecentReportSnapshots(50);

  const totalDossiers = reports.length;
  const approvedDossiers = reports.filter(r => r.status === "APPROVED" || r.status === "GENERATED").length;
  const uniqueProjects = new Set(reports.map(r => r.projectId)).size;

  return (
    <div className="min-h-screen bg-[#080B11] text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-amber-400/10 text-amber-400 border border-amber-400/20 flex items-center gap-1.5 shadow-sm shadow-amber-400/10">
                <FileText className="h-3 w-3" />
                Section 17 &amp; 18 Compliance
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Immutable SHA-256 Snapshots &bull; Playwright PDF Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Client Advisory Dossiers Archive
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl font-normal leading-relaxed">
              Every exported PDF is cryptographically tied to a deterministic analysis snapshot.
              Once generated and approved, client dossiers remain completely immutable to prevent unrecorded data drift.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-semibold border border-white/[0.1] transition-all"
            >
              <Building2 className="h-3.5 w-3.5 text-amber-400" />
              <span>Project Catalog</span>
            </Link>
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-extrabold shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            >
              <span>Content Studio</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>

        {/* Quick KPI Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="luxury-card p-5 rounded-3xl relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Total Immutable Dossiers</span>
              <FileText className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-white tracking-tight">{totalDossiers}</div>
            <div className="text-[11px] text-slate-400 mt-1">Audit-trailed cryptographic snapshots</div>
          </div>

          <div className="luxury-card p-5 rounded-3xl relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Approved &amp; Certified</span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400 tracking-tight">{approvedDossiers}</div>
            <div className="text-[11px] text-slate-400 mt-1">Ready for high-net-worth client delivery</div>
          </div>

          <div className="luxury-card p-5 rounded-3xl relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Unique Projects Analyzed</span>
              <Building2 className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-3xl font-black text-white tracking-tight">{uniqueProjects}</div>
            <div className="text-[11px] text-slate-400 mt-1">DLD registered off-plan developments</div>
          </div>
        </div>

        {/* Reports Table / List */}
        {reports.length === 0 ? (
          <div className="luxury-card rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto text-amber-400">
              <FileText className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-white">No Client Dossiers Generated Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Select any project from the catalog or run a scenario in the Funding Simulator to generate a verified 6-page Client Advisory Dossier.
            </p>
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all"
            >
              Browse Projects in Catalog
            </Link>
          </div>
        ) : (
          <div className="luxury-card rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/40 border-b border-white/[0.08] text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Project &amp; Report Title</th>
                    <th className="px-6 py-4">Locale</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">SHA-256 Checksum</th>
                    <th className="px-6 py-4">Created</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {reports.map((r) => (
                    <tr key={r.id} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">
                          {r.title}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1">
                          <Building2 className="h-3 w-3 text-amber-400" />
                          <span className="font-medium text-slate-300">{r.projectName || "Dubai Off-Plan"}</span>
                          <span className="text-slate-600">&bull;</span>
                          <span className="font-mono text-slate-500">{r.id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-white/[0.06] text-slate-300 border border-white/[0.1]">
                          {r.locale}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/10">
                          <ShieldCheck className="h-3 w-3" />
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                        {r.snapshotHash.slice(0, 16)}...
                      </td>
                      <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-slate-300 font-medium">{new Date(r.createdAt).toLocaleDateString("en-AE")}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/reports/${r.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 hover:text-white font-semibold transition-all border border-white/[0.08]"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>View</span>
                          </Link>
                          <a
                            href={`/api/reports/${r.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold transition-all shadow-sm shadow-amber-400/10 active:scale-95"
                          >
                            <Download className="h-3 w-3" />
                            <span>PDF</span>
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
