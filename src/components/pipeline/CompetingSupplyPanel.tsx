"use client";

import React from "react";
import {
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Layers,
  ArrowRight,
  ShieldAlert,
  Clock,
} from "lucide-react";
import type { CompetingSupplyAnalysis } from "@/domain/pipeline/competing-supply";

interface CompetingSupplyPanelProps {
  analysis: CompetingSupplyAnalysis;
  projectName: string;
}

export function CompetingSupplyPanel({ analysis, projectName }: CompetingSupplyPanelProps) {
  const getRiskBadge = (risk: CompetingSupplyAnalysis["supplyPressureRisk"]) => {
    switch (risk) {
      case "HIGH_COLLISION_RISK":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
            High Collision Risk
          </span>
        );
      case "MODERATE_PRESSURE":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-800">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            Moderate Supply Pressure
          </span>
        );
      case "LOW_PRESSURE":
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Low Supply Pressure
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 lg:p-8 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 shadow-2xs">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Competing Supply &amp; Cluster Collision (§14)
              </h3>
              <p className="text-xs text-slate-500">
                Surrounding cluster delivery schedule &bull; Handover collision detection (&plusmn;6 months)
              </p>
            </div>
          </div>
        </div>

        <div>{getRiskBadge(analysis.supplyPressureRisk)}</div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
        <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-sans font-semibold">
            Target Handover Quarter
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {analysis.targetQuarter}
          </div>
          <span className="text-[11px] text-slate-500 block font-sans mt-0.5">
            Target date: {analysis.targetHandoverDate}
          </span>
        </div>

        <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-sans font-semibold">
            Competing Handover Window (&plusmn;6m)
          </span>
          <div className="text-2xl font-bold text-amber-600 mt-1 tabular-nums">
            {analysis.collisionWindowProjectsCount}{" "}
            <span className="text-xs font-normal text-slate-500 font-sans">projects</span>
          </div>
          <span className="text-[11px] text-slate-500 block font-sans mt-0.5">
            ~{analysis.collisionWindowUnitsCount.toLocaleString()} units completing simultaneously
          </span>
        </div>

        <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-sans font-semibold">
            Total Cluster Pipeline
          </span>
          <div className="text-2xl font-bold text-sky-700 mt-1 tabular-nums">
            {analysis.totalKnownUnitsInPipeline.toLocaleString()}{" "}
            <span className="text-xs font-normal text-slate-500 font-sans">units</span>
          </div>
          <span className="text-[11px] text-slate-500 block font-sans mt-0.5">
            Across {analysis.totalNearbyProjects} observed developments in area
          </span>
        </div>
      </div>

      {/* Narrative Synthesis Banner */}
      <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-4 text-xs text-sky-950 leading-relaxed flex items-start gap-3 shadow-2xs">
        <AlertCircle className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-sky-900 font-semibold">Cluster Supply Dynamics Assessment: </strong>
          <span className="text-sky-900/90">{analysis.supplyNotes}</span>
        </div>
      </div>

      {/* Quarterly Timeline */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-slate-400" />
          Quarterly Completion Schedule (Nearby Cluster)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {analysis.quarterlyTimeline.map((bucket, idx) => (
            <div
              key={idx}
              className={`rounded-xl p-4 border transition-all ${
                bucket.isCollisionWindow
                  ? "bg-amber-50/60 border-amber-300 ring-1 ring-amber-500/20 shadow-xs"
                  : "bg-slate-50/60 border-slate-200/80"
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="font-bold font-mono text-slate-900 text-sm">{bucket.quarter}</span>
                {bucket.isCollisionWindow ? (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                    Collision Window
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-medium">
                    {bucket.projectsCount} project{bucket.projectsCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="py-2 flex justify-between text-xs font-mono">
                <span className="text-slate-500 font-sans">Known Supply:</span>
                <span className="text-slate-900 font-bold tabular-nums">{bucket.totalUnits.toLocaleString()} units</span>
              </div>

              <div className="space-y-1.5 pt-1 text-[11px]">
                {bucket.projects.slice(0, 3).map((p, pIdx) => (
                  <div key={pIdx} className="flex justify-between items-center text-slate-700">
                    <span className="truncate max-w-[160px] font-medium">{p.nameEn}</span>
                    <span className="font-mono text-slate-400 text-[10px]">
                      {p.progressPct !== null ? `${p.progressPct}%` : "DLD active"}
                    </span>
                  </div>
                ))}
                {bucket.projects.length > 3 && (
                  <div className="text-[10px] text-slate-400 italic">
                    +{bucket.projects.length - 3} more developments
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
