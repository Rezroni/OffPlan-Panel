"use client";

import React, { useState } from "react";
import { User, Wallet, Plus, Trash2, ShieldAlert, Target, Coins, ShieldCheck, ArrowUpRight } from "lucide-react";
import { formatAED } from "@/lib/decimal";
import { ClientFundingProfile } from "@/domain/funding/evaluate-funding";

interface ClientBriefSectionProps {
  client: ClientFundingProfile & {
    clientName: string;
    targetBudget: number;
    bedrooms: string;
    targetCommunity: string;
    strategy: "flip" | "rental";
  };
  onChange: (updated: any) => void;
}

export function ClientBriefSection({ client, onChange }: ClientBriefSectionProps) {
  const [newInflowDate, setNewInflowDate] = useState("");
  const [newInflowAmount, setNewInflowAmount] = useState("");
  const [newInflowLabel, setNewInflowLabel] = useState("");

  const handleAddInflow = () => {
    if (!newInflowDate || !newInflowAmount) return;
    const updatedInflows = [
      ...client.plannedInflows,
      {
        date: newInflowDate,
        amount: Number(newInflowAmount),
        label: newInflowLabel || "Planned Cash Inflow",
      },
    ].sort((a, b) => a.date.localeCompare(b.date));

    onChange({ ...client, plannedInflows: updatedInflows });
    setNewInflowDate("");
    setNewInflowAmount("");
    setNewInflowLabel("");
  };

  const handleRemoveInflow = (index: number) => {
    const updated = client.plannedInflows.filter((_, i) => i !== index);
    onChange({ ...client, plannedInflows: updated });
  };

  const totalInflows = client.plannedInflows.reduce((a, b) => a + Number(b.amount), 0);
  const totalDeployable = Number(client.initialLiquidCash) + totalInflows - Number(client.requiredReserve);

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200/80 gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="h-11 w-11 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0">
            <User className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                Step 1 &bull; Solvency Gate
              </span>
              <span className="text-xs font-mono text-slate-500">Section 24 Rule 3</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              Investor Brief &amp; Capital Schedule
            </h2>
          </div>
        </div>

        {/* Investment Strategy Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80 shrink-0">
          <button
            onClick={() => onChange({ ...client, strategy: "flip" })}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${
              client.strategy === "flip"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Pre-Handover Flip
          </button>
          <button
            onClick={() => onChange({ ...client, strategy: "rental" })}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${
              client.strategy === "rental"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Post-Handover Hold
          </button>
        </div>
      </div>

      {/* Investor Profile Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 block">Investor Name / Account</label>
          <input
            type="text"
            value={client.clientName}
            onChange={(e) => onChange({ ...client, clientName: e.target.value })}
            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 shadow-sm"
            placeholder="e.g. VIP Investor - Alexander K."
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Target Budget</span>
            <span className="text-[10px] text-slate-500 font-mono">Max Acquisition</span>
          </label>
          <div className="relative">
            <input
              type="number"
              value={client.targetBudget}
              onChange={(e) => onChange({ ...client, targetBudget: Number(e.target.value) })}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono font-medium focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 shadow-sm"
            />
            <span className="absolute right-3.5 top-2.5 text-[10px] font-bold text-slate-400 uppercase">AED</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-emerald-800 flex items-center justify-between">
            <span>Available Liquid Cash</span>
            <span className="text-[10px] text-emerald-600 font-mono">Day 0 Ready</span>
          </label>
          <div className="relative">
            <input
              type="number"
              value={Number(client.initialLiquidCash)}
              onChange={(e) => onChange({ ...client, initialLiquidCash: Number(e.target.value) })}
              className="w-full bg-emerald-50/30 border border-emerald-300 rounded-xl px-4 py-2.5 text-xs text-emerald-700 font-mono font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
            />
            <span className="absolute right-3.5 top-2.5 text-[10px] font-bold text-emerald-600 uppercase">AED</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-amber-800 flex items-center justify-between">
            <span>Required Reserve Buffer</span>
            <span className="text-[10px] text-amber-600 font-mono">Protected</span>
          </label>
          <div className="relative">
            <input
              type="number"
              value={Number(client.requiredReserve)}
              onChange={(e) => onChange({ ...client, requiredReserve: Number(e.target.value) })}
              className="w-full bg-amber-50/30 border border-amber-300 rounded-xl px-4 py-2.5 text-xs text-amber-800 font-mono font-bold focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-sm"
            />
            <span className="absolute right-3.5 top-2.5 text-[10px] font-bold text-amber-600 uppercase">AED</span>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5 p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
        <div className="flex items-center justify-between px-3">
          <span className="text-xs text-slate-500 font-medium">Total Planned Inflows:</span>
          <span className="text-xs font-mono font-bold text-emerald-700">{formatAED(totalInflows)}</span>
        </div>
        <div className="flex items-center justify-between px-3 border-t sm:border-t-0 sm:border-l border-slate-200/80 pt-2 sm:pt-0">
          <span className="text-xs text-slate-500 font-medium">Net Deployable Capital:</span>
          <span className={`text-xs font-mono font-bold ${totalDeployable > 0 ? "text-sky-700" : "text-rose-600"}`}>
            {formatAED(totalDeployable)}
          </span>
        </div>
        <div className="flex items-center justify-between px-3 border-t sm:border-t-0 sm:border-l border-slate-200/80 pt-2 sm:pt-0">
          <span className="text-xs text-slate-500 font-medium">Solvency Hard Gate:</span>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Active Check
          </span>
        </div>
      </div>

      {/* Planned Future Cash Inflows */}
      <div className="mt-6 pt-6 border-t border-slate-200/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-800 tracking-wide uppercase">
              Committed Future Cash Inflows (Milestone Funding)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {client.plannedInflows.length} Scheduled Inflow{client.plannedInflows.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-2.5 mb-4 max-h-52 overflow-y-auto pr-1">
          {client.plannedInflows.length === 0 ? (
            <div className="text-xs text-slate-600 p-4 bg-amber-50/50 rounded-xl border border-amber-200 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-800 font-semibold block mb-0.5">Section 24 Hard Gate Warning:</strong>
                <span>No future inflows declared. If initial cash is under 25% or cannot satisfy subsequent DLD construction milestones, the engine will mark this offer as <strong>NOT SUITABLE</strong>.</span>
              </div>
            </div>
          ) : (
            client.plannedInflows.map((inf, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-white border border-slate-200/90 hover:border-slate-300 px-4 py-3 rounded-xl text-xs shadow-sm transition-all duration-150"
              >
                <div className="flex items-center space-x-4">
                  <span className="font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md text-[11px] font-semibold">{inf.date}</span>
                  <span className="text-slate-900 font-semibold">{inf.label}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="font-mono font-bold text-emerald-700 text-xs">{formatAED(inf.amount)}</span>
                  <button
                    onClick={() => handleRemoveInflow(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Remove inflow"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add inflow form */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
          <input
            type="date"
            placeholder="Date"
            value={newInflowDate}
            onChange={(e) => setNewInflowDate(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
          />
          <input
            type="text"
            placeholder="Description (e.g. Q1 Dividend)"
            value={newInflowLabel}
            onChange={(e) => setNewInflowLabel(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
          />
          <input
            type="number"
            placeholder="Amount (AED)"
            value={newInflowAmount}
            onChange={(e) => setNewInflowAmount(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-emerald-700 font-mono font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
          />
          <button
            onClick={handleAddInflow}
            className="flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Inflow</span>
          </button>
        </div>
      </div>
    </div>
  );
}
