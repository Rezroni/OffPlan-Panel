"use client";

import React from "react";

type Props = {
  onOpenCase: () => void;
  onNotice: (message: string) => void;
};

export function ResearchWorkspace({ onOpenCase, onNotice }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Research Workspace</h2>
      <p className="text-sm text-slate-500">
        Direct link to official verified DLD projects, construction metrics, and developer discipline.
      </p>
      <div className="pt-2">
        <a
          href="/developers"
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 px-4 py-2 rounded-xl border border-teal-200 hover:bg-teal-100 transition-colors"
        >
          View Developer Track Records &rarr;
        </a>
      </div>
    </div>
  );
}
