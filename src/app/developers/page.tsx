import React from "react";
import { Header } from "@/components/desk/Header";
import { listDevelopers, DeveloperListItem } from "@/server/dal/developers";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Search,
} from "lucide-react";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developer Track Record — Dubai Off-plan Research Desk",
  description: "Phase 5 Developer Delivery Discipline: on-time completion rates, average delay history, and DLD verified track record.",
};

export default async function DevelopersPage() {
  const developers = await listDevelopers();

  const getBadgeStyle = (badge: DeveloperListItem["reliabilityBadge"]) => {
    switch (badge) {
      case "PROVEN_DISCIPLINE":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "MODERATE_DELAYS":
        return "bg-sky-50 text-sky-800 border-sky-200";
      case "CHRONIC_DELAYS":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "INSUFFICIENT_HISTORY":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-20">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 shadow-sm">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Developer Track Record &amp; Construction Discipline
                  <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
                    Phase 5 (§13)
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Historical delay metrics based on verified DLD project records: max(0, actual - promised)
                </p>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-600 font-mono bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            Tracking <strong className="text-slate-900 font-bold">{developers.length}</strong> master developers &amp; brands
          </div>
        </div>

        {/* Developers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {developers.map((dev) => (
            <Link
              key={dev.id}
              href={`/developers/${dev.id}`}
              className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-6 transition-all duration-150 group flex flex-col justify-between space-y-5 shadow-sm hover:shadow-md"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base group-hover:text-sky-700 transition-colors">
                      {dev.brandName || dev.legalName}
                    </h3>
                    {dev.brandName && dev.brandName !== dev.legalName && (
                      <p className="text-[11px] text-slate-500 truncate max-w-[220px] mt-0.5">
                        Legal: {dev.legalName}
                      </p>
                    )}
                  </div>

                  <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full border shrink-0 ${getBadgeStyle(dev.reliabilityBadge)}`}>
                    {dev.reliabilityBadge.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono border-t border-slate-100 pt-4">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 text-[10px] block font-sans font-semibold">Projects</span>
                    <span className="text-slate-900 font-bold text-sm">{dev.totalProjects}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 text-[10px] block font-sans font-semibold">On-Time %</span>
                    <span className={`font-bold text-sm ${dev.onTimeRatePercent >= 70 ? "text-emerald-700" : "text-amber-700"}`}>
                      {dev.completedProjects > 0 ? `${dev.onTimeRatePercent}%` : "—"}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 text-[10px] block font-sans font-semibold">Avg Delay</span>
                    <span className="text-slate-800 font-bold text-sm">
                      {dev.completedProjects > 0 ? `${dev.avgDelayMonths}m` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-sky-600 group-hover:text-sky-800 font-bold pt-3 border-t border-slate-100">
                <span>View Full Construction Audit</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
