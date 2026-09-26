import { notFound } from "next/navigation";
import { getCmaAnalysisForProject } from "@/server/dal/catalog";
import { CmaAnalysisClient } from "@/components/cma/CmaAnalysisClient";

export const metadata = {
  title: "CMA 3-Group Analysis — Dubai Off-plan Research Desk",
  description: "Comparative market analysis across Ready, Off-Plan, and Near-Handover cohorts",
};

export default async function ProjectCmaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const analysis = await getCmaAnalysisForProject({ projectId: id, bedrooms: 1 });

  if (!analysis.project) {
    notFound();
  }

  // Convert Decimal objects to plain numbers/strings for serializing to client component
  const serialized = JSON.parse(JSON.stringify(analysis));

  return <CmaAnalysisClient initialData={serialized} />;
}
