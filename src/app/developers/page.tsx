import React from "react";
import { Header } from "@/components/desk/Header";
import { listDevelopers } from "@/server/dal/developers";
import { DevelopersListClient } from "@/components/developers/DevelopersListClient";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developer Track Record — Dubai Off-plan Research Desk",
  description: "Phase 5 Developer Delivery Discipline: on-time completion rates, average delay history, and DLD verified track record.",
};

export default async function DevelopersPage() {
  const developers = await listDevelopers();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-20">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <DevelopersListClient initialDevelopers={developers} />
      </main>
    </div>
  );
}
