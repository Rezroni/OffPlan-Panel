"use client";

import React from "react";
import type { WorkspaceId } from "./workbench-types";

type Props = {
  workspace: WorkspaceId;
  onNotice: (message: string) => void;
};

export function StudioDocumentsWorkspace({ workspace, onNotice }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Studio &amp; Documents</h2>
      <p className="text-sm text-slate-500">
        Active Workspace: <strong className="text-teal-700 uppercase font-mono">{workspace}</strong>
      </p>
      <div className="flex gap-3 pt-2">
        <a
          href="/studio"
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 px-4 py-2 rounded-xl border border-teal-200 hover:bg-teal-100 transition-colors"
        >
          Open Script Studio &rarr;
        </a>
        <a
          href="/reports"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          Open Dossier Reports &rarr;
        </a>
      </div>
    </div>
  );
}
