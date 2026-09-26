/**
 * /reports/[id] — Client Advisory Dossier View & Print/Export Target (§17)
 * Server Component
 */

import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReportSnapshotById } from "@/server/dal/reports";
import { ReportDossierView } from "@/components/reports/ReportDossierView";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string; locale?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const snapshot = await getReportSnapshotById(id);

  if (!snapshot) {
    return {
      title: "Dossier Not Found — Dubai Off-plan Research Desk",
    };
  }

  return {
    title: `${snapshot.title} — Evidence-Based Client Advisory Dossier`,
    description: "Verified Dubai Land Department due-diligence report with CMA, funding, and exit models.",
  };
}

export default async function ReportSnapshotPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { print } = await searchParams;
  const snapshot = await getReportSnapshotById(id);

  if (!snapshot) {
    notFound();
  }

  const isPrintMode = print === "true" || print === "1";

  return (
    <ReportDossierView
      snapshot={snapshot}
      isPrintMode={isPrintMode}
    />
  );
}
