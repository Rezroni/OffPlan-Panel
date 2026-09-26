"use client";

import React, { useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  FileText,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building,
} from "lucide-react";
import { formatAED } from "@/lib/decimal";
import type { ParseOfferFileResult } from "@/domain/imports/offer-parser";

interface ProjectOption {
  id: string;
  nameEn: string;
  developerBrand: string | null;
}

interface RecentRevision {
  id: string;
  projectId: string;
  fileName: string;
  revisionNo: number;
  totalUnitsParsed: number;
  totalUnitsAvailable: number;
  receivedAt: string;
  confirmedBy: string | null;
  isFresh: boolean;
  ageHours: number;
  freshnessWarning?: string;
}

interface ImportsClientProps {
  projects: ProjectOption[];
  recentRevisions: RecentRevision[];
}

export function ImportsClient({ projects, recentRevisions: initialRevs }: ImportsClientProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || "");
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParseOfferFileResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<RecentRevision[]>(initialRevs);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;
    setFile(uploaded);
    setParseError(null);
    setConfirmSuccess(null);
    setParsing(true);

    try {
      const formData = new FormData();
      formData.append("file", uploaded);

      const res = await fetch("/api/imports/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to parse document");
      }

      setParseResult(data.result);
    } catch (err: any) {
      setParseError(err?.message || "Error reading Excel/CSV file");
      setParseResult(null);
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmRevision = async () => {
    if (!parseResult || !selectedProjectId) return;
    setConfirming(true);
    setParseError(null);

    try {
      const res = await fetch("/api/imports/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          fileName: parseResult.fileName,
          fileChecksum: parseResult.fileChecksum,
          fileSizeBytes: parseResult.fileSizeBytes,
          sheetName: parseResult.selectedSheet,
          receivedAt: new Date().toISOString(),
          confirmedBy: "agent:Mokhamed",
          notes: "Direct developer inventory spreadsheet import",
          units: parseResult.validUnits,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to store revision");
      }

      setConfirmSuccess(`Successfully recorded immutable Offer Revision! Stored ${data.unitsSaved} live inventory units.`);
      setParseResult(null);
      setFile(null);
    } catch (err: any) {
      setParseError(err?.message || "Failed to save revision");
    } finally {
      setConfirming(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-6">
      {/* Upload Box */}
      <div className="luxury-card rounded-3xl p-6 lg:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div>
            <h2 className="text-base font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-amber-400" />
              Upload Developer Price List / Inventory Sheet (§10.2)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Supports .xlsx, .xls, and .csv. Safe server extraction with SHA-256 checksum and 48-hour freshness gating.
            </p>
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-400 font-semibold">Target Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-black/40 border border-white/[0.1] rounded-2xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400 transition-colors font-medium"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.nameEn} ({p.developerBrand || "Developer"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <label className="border-2 border-dashed border-white/[0.12] hover:border-amber-400/50 rounded-3xl p-10 flex flex-col items-center justify-center gap-3.5 cursor-pointer transition-all hover:bg-white/[0.02] group">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="p-4 rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-400/20 group-hover:scale-105 transition-transform shadow-sm shadow-amber-400/10">
            <Upload className="h-8 w-8" />
          </div>
          <div className="text-center space-y-1">
            <span className="text-sm font-bold text-white block group-hover:text-amber-400 transition-colors">
              {file ? file.name : "Click to select or drag and drop developer price list"}
            </span>
            <span className="text-xs text-slate-400 block font-normal">
              Excel (.xlsx, .xls) or CSV files up to 25MB
            </span>
          </div>
        </label>

        {parsing && (
          <div className="py-6 flex items-center justify-center gap-2 text-amber-400 text-xs font-semibold">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Extracting sheet rows, checking unit formats, and calculating file checksum...
          </div>
        )}

        {parseError && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-xs text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <strong className="block text-rose-200 font-bold mb-0.5">Import Error</strong>
              {parseError}
            </div>
          </div>
        )}

        {confirmSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-xs text-emerald-300 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
            <div>
              <strong className="block text-emerald-200 font-bold mb-0.5">Revision Stored Successfully</strong>
              {confirmSuccess}
            </div>
          </div>
        )}

        {/* PARSED PREVIEW */}
        {parseResult && (
          <div className="space-y-6 pt-5 border-t border-white/[0.08]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Document Preview &amp; Verification
                </span>
                <p className="text-xs text-slate-300 mt-1">
                  Target: <strong className="text-white">{selectedProject?.nameEn}</strong> &bull; Sheet: <span className="font-mono text-amber-300">{parseResult.selectedSheet}</span>
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate max-w-md">
                  SHA-256: {parseResult.fileChecksum}
                </p>
              </div>

              <button
                onClick={handleConfirmRevision}
                disabled={confirming || parseResult.validUnits.length === 0}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
              >
                {confirming ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {confirming ? "Confirming..." : `Confirm & Save Revision (${parseResult.validUnits.length} Units)`}
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-black/30 rounded-2xl p-4 border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 font-sans block font-semibold">Total Rows Read</span>
                <span className="text-white font-black text-xl mt-0.5 block">{parseResult.totalRowsFound}</span>
              </div>
              <div className="bg-black/30 rounded-2xl p-4 border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 font-sans block font-semibold">Valid Units</span>
                <span className="text-emerald-400 font-black text-xl mt-0.5 block">{parseResult.validUnits.length}</span>
              </div>
              <div className="bg-black/30 rounded-2xl p-4 border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 font-sans block font-semibold">Available Units</span>
                <span className="text-amber-400 font-black text-xl mt-0.5 block">{parseResult.availableUnitsCount}</span>
              </div>
              <div className="bg-black/30 rounded-2xl p-4 border border-white/[0.06]">
                <span className="text-[10px] text-slate-400 font-sans block font-semibold">Price Range</span>
                <span className="text-slate-200 font-bold text-xs truncate block mt-1">
                  {formatAED(parseResult.priceRange.minNetPriceAed)}–{formatAED(parseResult.priceRange.maxNetPriceAed)}
                </span>
              </div>
            </div>

            {/* Units Preview Table */}
            <div className="overflow-x-auto max-h-80 border border-white/[0.08] rounded-2xl bg-black/20">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-black/80 backdrop-blur-md border-b border-white/[0.08] font-bold text-slate-400 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5">Unit #</th>
                    <th className="py-3 px-3.5">Bedrooms</th>
                    <th className="py-3 px-3.5">View</th>
                    <th className="py-3 px-3.5 text-right">Area Sqft</th>
                    <th className="py-3 px-3.5 text-right">Net Price (AED)</th>
                    <th className="py-3 px-3.5 text-right">PSF (AED)</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] font-mono">
                  {parseResult.validUnits.slice(0, 20).map((u, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3.5 text-white font-black">{u.unitNo}</td>
                      <td className="py-2.5 px-3.5 font-sans text-slate-300 font-medium">
                        {u.bedrooms === 0 ? "Studio" : `${u.bedrooms}BR`}
                      </td>
                      <td className="py-2.5 px-3.5 font-sans text-slate-400">{u.view || "Standard"}</td>
                      <td className="py-2.5 px-3.5 text-right text-slate-300">{u.totalAreaSqft}</td>
                      <td className="py-2.5 px-3.5 text-right text-emerald-400 font-bold">
                        {formatAED(u.netPriceAed)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-slate-400">
                        {formatAED(Math.round(u.netPriceAed / u.totalAreaSqft))}
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-sans">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${
                          u.availability === "available"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-white/[0.04] text-slate-400 border-white/[0.06]"
                        }`}>
                          {u.availability}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parseResult.validUnits.length > 20 && (
              <p className="text-xs text-slate-400 italic text-center">
                Showing first 20 rows of {parseResult.validUnits.length} parsed inventory lots.
              </p>
            )}
          </div>
        )}
      </div>

      {/* RECENT REVISIONS HISTORY */}
      <div className="luxury-card rounded-3xl p-6 lg:p-8 shadow-2xl space-y-4">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400" />
          Confirmed Offer Revisions &amp; 48h Freshness Tracker (§10.2)
        </h3>

        {revisions.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No offer revisions confirmed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-wider text-slate-400 bg-black/30 font-bold">
                  <th className="py-3 px-3.5">Revision</th>
                  <th className="py-3 px-3.5">File Name</th>
                  <th className="py-3 px-3.5">Received At</th>
                  <th className="py-3 px-3.5 text-right">Units Parsed</th>
                  <th className="py-3 px-3.5 text-right">Available Lots</th>
                  <th className="py-3 px-3.5">Confirmed By</th>
                  <th className="py-3 px-3.5 text-center">48h Freshness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] font-mono">
                {revisions.map((rev) => (
                  <tr key={rev.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-3.5 text-amber-400 font-black">Rev #{rev.revisionNo}</td>
                    <td className="py-3 px-3.5 text-white font-sans font-semibold">{rev.fileName}</td>
                    <td className="py-3 px-3.5 text-slate-300">
                      {new Date(rev.receivedAt).toLocaleDateString("en-AE")}
                    </td>
                    <td className="py-3 px-3.5 text-right text-slate-300">{rev.totalUnitsParsed}</td>
                    <td className="py-3 px-3.5 text-right text-emerald-400 font-black">{rev.totalUnitsAvailable}</td>
                    <td className="py-3 px-3.5 font-sans text-slate-400">{rev.confirmedBy || "agent"}</td>
                    <td className="py-3 px-3.5 text-center font-sans">
                      {rev.isFresh ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Fresh ({rev.ageHours}h)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20" title={rev.freshnessWarning}>
                          Reverify (&gt;48h)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
