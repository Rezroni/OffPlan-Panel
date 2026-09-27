import React from "react";
import { Header } from "@/components/desk/Header";
import { getDeveloperById } from "@/server/dal/developers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  ShieldCheck,
  TrendingUp,
  Percent,
} from "lucide-react";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getDeveloperById(id);
  const name = data
    ? data.developer.displayName || data.developer.brandName || data.developer.legalName
    : "Developer Not Found";
  return {
    title: `${name} Track Record — Dubai Off-plan Desk`,
  };
}

export default async function DeveloperDetailPage({ params }: Props) {
  const { id } = await params;
  const data = await getDeveloperById(id);

  if (!data) {
    notFound();
  }

  const { developer, trackRecord } = data;
  const displayName = developer.displayName || developer.brandName || developer.legalName;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-sky-500/20 selection:text-sky-900">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <Link
          href="/developers"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-sky-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Developers List</span>
        </Link>

        {/* Developer Header */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 lg:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 shadow-xs">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  {displayName}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Legal Entity: <span className="text-slate-800 font-semibold">{developer.legalName}</span>
                  {developer.dldDeveloperId && (
                    <span> &bull; DLD Developer ID: <strong className="text-sky-700 font-mono">{developer.dldDeveloperId}</strong></span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Execution Status</span>
              <span className="font-bold text-sky-700 text-sm">
                {trackRecord.reliabilityRatingBadge.replace("_", " ")}
              </span>
            </div>
          </div>
        </div>

        {/* Track Record Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-sans font-semibold">
              On-Time Delivery Rate
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1.5 tabular-nums">
              {trackRecord.completedProjectsCount > 0
                ? `${trackRecord.onTimeDeliveryRatePercent.toFixed(0)}%`
                : "—"}
            </div>
            <span className="text-[11px] text-slate-500 block font-sans mt-1">
              {trackRecord.earlyOrOnTimeCount} of {trackRecord.projectsWithHandoverData} completed projects
            </span>
          </div>

          <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-sans font-semibold">
              Average Handover Delay
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5 tabular-nums">
              {trackRecord.completedProjectsCount > 0
                ? `${trackRecord.averageDelayMonths.toFixed(1)}m`
                : "—"}
            </div>
            <span className="text-[11px] text-slate-500 block font-sans mt-1">
              Median: {trackRecord.medianDelayMonths.toFixed(1)}m &bull; Max: {trackRecord.maxDelayMonths.toFixed(1)}m
            </span>
          </div>

          <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-sans font-semibold">
              Active Under Construction
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-sky-600 mt-1.5 tabular-nums">
              {trackRecord.activeProjectsCount}
            </div>
            <span className="text-[11px] text-slate-500 block font-sans mt-1">
              Current live off-plan developments
            </span>
          </div>

          <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-sans font-semibold">
              Overdue Active Projects
            </span>
            <div className={`text-2xl sm:text-3xl font-bold mt-1.5 tabular-nums ${trackRecord.overdueActiveCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {trackRecord.overdueActiveCount}
            </div>
            <span className="text-[11px] text-slate-500 block font-sans mt-1">
              Past promised handover date
            </span>
          </div>
        </div>

        {/* Narrative Review Banner */}
        <div className="bg-amber-50/80 border border-amber-200/80 p-5 rounded-2xl text-xs text-amber-950 leading-relaxed flex items-start gap-3.5 shadow-xs">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-900 font-bold text-sm block mb-0.5">Developer Track Record Evaluation (§13)</strong>
            <span className="text-amber-800 leading-normal">{trackRecord.reliabilityNotes}</span>
          </div>
        </div>

        {/* Project-by-Project Audit Table */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-sky-600" />
            Project Execution &amp; Handover History ({trackRecord.projectHistory.length} Developments)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/80 font-semibold">
                  <th className="py-3 px-4 rounded-l-lg">Project Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Promised Handover</th>
                  <th className="py-3 px-4">Actual / Current Handover</th>
                  <th className="py-3 px-4 text-right">Delay (Months)</th>
                  <th className="py-3 px-4">Escrow Status</th>
                  <th className="py-3 px-4 text-right rounded-r-lg">Construction %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {trackRecord.projectHistory.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900">
                      <Link href={`/projects/${p.projectId}`} className="hover:text-sky-600 transition-colors">
                        {p.projectName}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${
                        p.status === "completed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-sky-50 text-sky-700 border-sky-200"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.originalPromisedDate || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.actualHandoverDate || "Under construction"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.delayMonths !== null ? (
                        p.delayMonths === 0 ? (
                          <span className="text-emerald-600 font-bold">On Schedule</span>
                        ) : (
                          <span className="text-amber-600 font-bold">+{p.delayMonths}m</span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-500">
                      {p.escrowBankName ? `${p.escrowBankName} (${p.escrowStatus})` : p.escrowStatus}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 font-bold">
                      {p.constructionProgressPct !== null ? `${p.constructionProgressPct}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
