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
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 lg:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-sky-600" />
              Upload Developer Price List / Inventory Sheet (§10.2)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Supports .xlsx, .xls, and .csv. Safe server extraction with SHA-256 checksum and 48-hour freshness gating.
            </p>
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-slate-500 font-semibold">Target Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-600 transition-colors font-medium"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameEn} ({p.developerBrand || "Developer"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <label className="border-2 border-dashed border-slate-200 hover:border-sky-500/50 rounded-2xl p-10 flex flex-col items-center justify-center gap-3.5 cursor-pointer transition-all bg-slate-50/50 hover:bg-slate-50 group">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="p-4 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 group-hover:scale-105 transition-transform shadow-2xs">
            <Upload className="h-8 w-8" />
          </div>
          <div className="text-center space-y-1">
            <span className="text-sm font-bold text-slate-900 block group-hover:text-sky-600 transition-colors">
              {file ? file.name : "Click to select or drag and drop developer price list"}
            </span>
            <span className="text-xs text-slate-500 block font-normal">
              Excel (.xlsx, .xls) or CSV files up to 25MB
            </span>
          </div>
        </label>

        {parsing && (
          <div className="py-6 flex items-center justify-center gap-2 text-sky-600 text-xs font-semibold">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Extracting sheet rows, checking unit formats, and calculating file checksum...
          </div>
        )}

        {parseError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <strong className="block text-rose-900 font-bold mb-0.5">Import Error</strong>
              {parseError}
            </div>
          </div>
        )}

        {confirmSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <strong className="block text-emerald-900 font-bold mb-0.5">Revision Stored Successfully</strong>
              {confirmSuccess}
            </div>
          </div>
        )}

        {/* PARSED PREVIEW */}
        {parseResult && (
          <div className="space-y-6 pt-5 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Document Preview &amp; Verification
                </span>
                <p className="text-xs text-slate-700 mt-1">
                  Target: <strong className="text-slate-900">{selectedProject?.nameEn}</strong> &bull; Sheet: <span className="font-mono text-sky-700 font-semibold">{parseResult.selectedSheet}</span>
                </p>
                <p className="text-[10px] text-slate-500 font-mono truncate max-w-md">
                  SHA-256: {parseResult.fileChecksum}
                </p>
              </div>

              <button
                onClick={handleConfirmRevision}
                disabled={confirming || parseResult.validUnits.length === 0}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
              >
                {confirming ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {confirming ? "Confirming..." : `Confirm & Save Revision (${parseResult.validUnits.length} Units)`}
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80">
                <span className="text-[10px] text-slate-500 font-sans block font-semibold">Total Rows Read</span>
                <span className="text-slate-900 font-bold text-xl mt-0.5 block tabular-nums">{parseResult.totalRowsFound}</span>
              </div>
              <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80">
                <span className="text-[10px] text-slate-500 font-sans block font-semibold">Valid Units</span>
                <span className="text-emerald-700 font-bold text-xl mt-0.5 block tabular-nums">{parseResult.validUnits.length}</span>
              </div>
              <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80">
                <span className="text-[10px] text-slate-500 font-sans block font-semibold">Available Units</span>
                <span className="text-sky-700 font-bold text-xl mt-0.5 block tabular-nums">{parseResult.availableUnitsCount}</span>
              </div>
              <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80">
                <span className="text-[10px] text-slate-500 font-sans block font-semibold">Price Range</span>
                <span className="text-slate-900 font-bold text-xs truncate block mt-1">
                  {formatAED(parseResult.priceRange.minNetPriceAed)}–{formatAED(parseResult.priceRange.maxNetPriceAed)}
                </span>
              </div>
            </div>

            {/* Units Preview Table */}
            <div className="overflow-x-auto max-h-80 border border-slate-200/80 rounded-xl bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 font-bold text-slate-500 text-[10px] uppercase tracking-wider">
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
                <tbody className="divide-y divide-slate-100 font-mono">
                  {parseResult.validUnits.slice(0, 20).map((u, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3.5 text-slate-900 font-bold">{u.unitNo}</td>
                      <td className="py-2.5 px-3.5 font-sans text-slate-700 font-medium">
                        {u.bedrooms === 0 ? "Studio" : `${u.bedrooms}BR`}
                      </td>
                      <td className="py-2.5 px-3.5 font-sans text-slate-500">{u.view || "Standard"}</td>
                      <td className="py-2.5 px-3.5 text-right text-slate-700">{u.totalAreaSqft}</td>
                      <td className="py-2.5 px-3.5 text-right text-emerald-700 font-bold">
                        {formatAED(u.netPriceAed)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-slate-500">
                        {formatAED(Math.round(u.netPriceAed / u.totalAreaSqft))}
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-sans">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${
                          u.availability === "available"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
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
              <p className="text-xs text-slate-500 italic text-center">
                Showing first 20 rows of {parseResult.validUnits.length} parsed inventory lots.
              </p>
            )}
          </div>
        )}
      </div>

      {/* RECENT REVISIONS HISTORY */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 lg:p-8 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-sky-600" />
          Confirmed Offer Revisions &amp; 48h Freshness Tracker (§10.2)
        </h3>

        {revisions.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No offer revisions confirmed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/80 font-semibold">
                  <th className="py-3 px-3.5 rounded-l-lg">Revision</th>
                  <th className="py-3 px-3.5">File Name</th>
                  <th className="py-3 px-3.5">Received At</th>
                  <th className="py-3 px-3.5 text-right">Units Parsed</th>
                  <th className="py-3 px-3.5 text-right">Available Lots</th>
                  <th className="py-3 px-3.5">Confirmed By</th>
                  <th className="py-3 px-3.5 text-center rounded-r-lg">48h Freshness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {revisions.map((rev) => (
                  <tr key={rev.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3.5 text-sky-700 font-bold">Rev #{rev.revisionNo}</td>
                    <td className="py-3 px-3.5 text-slate-900 font-sans font-semibold">{rev.fileName}</td>
                    <td className="py-3 px-3.5 text-slate-600">
                      {new Date(rev.receivedAt).toLocaleDateString("en-AE")}
                    </td>
                    <td className="py-3 px-3.5 text-right text-slate-700">{rev.totalUnitsParsed}</td>
                    <td className="py-3 px-3.5 text-right text-emerald-700 font-bold">{rev.totalUnitsAvailable}</td>
                    <td className="py-3 px-3.5 font-sans text-slate-500">{rev.confirmedBy || "agent"}</td>
                    <td className="py-3 px-3.5 text-center font-sans">
                      {rev.isFresh ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Fresh ({rev.ageHours}h)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title={rev.freshnessWarning}>
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
