/**
 * /projects/[id] — Project Detail Page (Server Component)
 */

import {
  getProjectById,
  getProjectUnitTypes,
  getCmaAnalysisForProject,
} from "@/server/dal/catalog";
import { getClusterPipelineAnalysis } from "@/server/dal/pipeline";
import ProjectDetailClient from "@/components/catalog/ProjectDetailClient";
import { notFound } from "next/navigation";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectById(id);
  return {
    title: project
      ? `${project.nameEn} — Dubai Off-plan Research Desk`
      : "Project Not Found",
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const [project, unitTypes, cmaData, pipelineAnalysis] = await Promise.all([
    getProjectById(id),
    getProjectUnitTypes(id),
    getCmaAnalysisForProject({ projectId: id, bedrooms: 1 }),
    getClusterPipelineAnalysis(id),
  ]);

  if (!project) {
    notFound();
  }

  const serializedCma = JSON.parse(JSON.stringify(cmaData.cma));

  return (
    <ProjectDetailClient
      project={project}
      unitTypes={unitTypes}
      initialCma={serializedCma}
      pipelineAnalysis={pipelineAnalysis}
    />
  );
}

