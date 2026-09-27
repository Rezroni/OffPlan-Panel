"use client";

import React from "react";
import type { CaseStage } from "./workbench-types";

type Props = {
  activeStage: CaseStage;
  onStageChange: (stage: CaseStage) => void;
  onNotice: (message: string) => void;
};

export function CasesWorkspace({ activeStage, onStageChange, onNotice }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Client Cases & Alternatives</h2>
      <p className="text-sm text-slate-500">
        Active Stage: <strong className="text-teal-700 uppercase font-mono">{activeStage}</strong>
      </p>
      <div className="pt-2">
        <a
          href="/alternatives"
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 px-4 py-2 rounded-xl border border-teal-200 hover:bg-teal-100 transition-colors"
        >
          Open Alternatives Shortlist &rarr;
        </a>
      </div>
    </div>
  );
}
