/**
 * /discover — Project Catalog Page (Server Component)
 * Phase 2: reads from SQLite via DAL, passes to client component
 */

import { listProjects, getDataHealthSummary } from "@/server/dal/catalog";
import DiscoverClient from "@/components/catalog/DiscoverClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover Projects — Dubai Off-plan Research Desk",
  description: "Browse Dubai off-plan project catalog with DLD data",
};

// Force dynamic to always read fresh from SQLite
export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const [{ items, total }, dataHealth] = await Promise.all([
    listProjects({ limit: 5000 }),
    getDataHealthSummary(),
  ]);

  return (
    <DiscoverClient
      initialProjects={items}
      total={total}
      dataHealth={dataHealth}
    />
  );
}
