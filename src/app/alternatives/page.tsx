import { getAlternativesShortlistForClient } from "@/server/dal/catalog";
import { AlternativesClient } from "@/components/alternatives/AlternativesClient";

export const metadata = {
  title: "Alternatives & Shortlist — Dubai Off-plan Research Desk",
  description: "Section 8 shortlist selection with eligibility gates and verified analytical commentary",
};

export default async function AlternativesPage() {
  const result = await getAlternativesShortlistForClient({
    brief: {
      budgetAed: 1800000,
      targetBedrooms: [1],
      preferredAreaName: "Business Bay",
      targetStrategy: "flip",
      maxHandoverYear: 2027,
    },
    withAiCommentary: true,
  });

  const serialized = JSON.parse(JSON.stringify(result));

  return <AlternativesClient initialData={serialized} />;
}
