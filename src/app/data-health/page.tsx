/**
 * /data-health — Source & Match Queue Page
 */

import { getPendingMatches, getDataHealthSummary } from "@/server/dal/catalog";
import DataHealthClient from "@/components/catalog/DataHealthClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Health — Dubai Off-plan Research Desk",
};

export const dynamic = "force-dynamic";

export default async function DataHealthPage() {
  const [pendingMatches, summary] = await Promise.all([
    getPendingMatches(50),
    getDataHealthSummary(),
  ]);

  return (
    <DataHealthClient
      pendingMatches={pendingMatches}
      summary={summary}
    />
  );
}
