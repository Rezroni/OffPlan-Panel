import React from "react";
import { Header } from "@/components/desk/Header";
import { FundingExitSimulator } from "@/components/funding/FundingExitSimulator";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Funding & Exit Scenario Engine — Dubai Off-plan Research Desk",
  description: "Phase 4 Funding and Exit Engine: DLD transaction costs, payment plan stress testing, Break-Even PSF, Assignment Resale, and Handover & Hold XIRR.",
};

export default function FundingPage() {
  return (
    <div className="min-h-screen bg-[#080B11] text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <FundingExitSimulator
          initialPrice={2200000}
          initialAreaSqft={900}
          projectName="Dubai Off-Plan Investment Simulation"
          unitLabel="2-Bedroom Premium Suite"
          handoverDate="2028-12-01"
          assignmentPolicy="allowed"
          minPaidPctForNoc={34}
        />
      </main>
    </div>
  );
}
