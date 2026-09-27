"use client";

import React from "react";
import type { WorkspaceId, CaseStage } from "./workbench-types";

type Props = {
  onOpenWorkspace: (workspace: WorkspaceId) => void;
  onStageChange: (stage: CaseStage) => void;
  onNotice: (message: string) => void;
};

export function OverviewWorkspace({ onOpenWorkspace, onNotice }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Workbench Overview</h2>
      <p className="text-sm text-slate-500">
        Unified workspace for managing investor cases, off-plan research, and dossier studio.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <button
          onClick={() => onOpenWorkspace("research")}
          className="p-4 bg-white border border-slate-200 rounded-xl text-left hover:border-teal-500 transition-colors shadow-xs"
        >
          <h3 className="font-bold text-slate-900">Project & Developer Research</h3>
          <p className="text-xs text-slate-500 mt-1">Explore verified DLD data catalog.</p>
        </button>
        <button
          onClick={() => onOpenWorkspace("cases")}
          className="p-4 bg-white border border-slate-200 rounded-xl text-left hover:border-teal-500 transition-colors shadow-xs"
        >
          <h3 className="font-bold text-slate-900">Client Cases</h3>
          <p className="text-xs text-slate-500 mt-1">Manage investment briefs & comparisons.</p>
        </button>
        <button
          onClick={() => onOpenWorkspace("studio")}
          className="p-4 bg-white border border-slate-200 rounded-xl text-left hover:border-teal-500 transition-colors shadow-xs"
        >
          <h3 className="font-bold text-slate-900">Studio & Documents</h3>
          <p className="text-xs text-slate-500 mt-1">Generate dossiers and video scripts.</p>
        </button>
      </div>
    </div>
  );
}
