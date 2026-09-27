"use client";

import { ExternalLink, Plus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { developerRecords, projectResults } from "./workbench-data";

type Props = { onOpenCase: () => void; onNotice: (message: string) => void };
type ResearchTab = "projects" | "developers" | "health";

export function ResearchCommandDesk({ onOpenCase, onNotice }: Props) {
  const [tab, setTab] = useState<ResearchTab>("projects");
  const [selectedId, setSelectedId] = useState(projectResults[0].id);
  const selectedProject = projectResults.find((project) => project.id === selectedId) ?? projectResults[0];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Research</h1>
        <p className="mt-2 text-sm text-[#536575]">Find evidence first, then add only relevant projects to a client case.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(20rem,.85fr)_minmax(28rem,1.15fr)]">
        <section className="rounded-[10px] border border-[#D7E0E6] bg-white p-4">
          <div className="flex gap-2 border-b border-[#D7E0E6] pb-3">
            {(["projects", "developers", "health"] as const).map((item) => (
              <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-md px-3 py-2 text-sm font-medium ${tab === item ? "bg-[#12212E] text-white" : "text-[#536575] hover:bg-[#F5F7F8]"}`}>
                {item === "health" ? "Market health" : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>

          {tab === "projects" && <ProjectList selectedId={selectedId} onSelect={setSelectedId} onNotice={onNotice} />}
          {tab === "developers" && <DeveloperList onNotice={onNotice} />}
          {tab === "health" && <HealthList onNotice={onNotice} />}
        </section>

        {tab === "projects" && <ProjectDetail project={selectedProject} onOpenCase={onOpenCase} onNotice={onNotice} />}
        {tab === "developers" && <DeveloperDetail onNotice={onNotice} />}
        {tab === "health" && <HealthDetail onNotice={onNotice} />}
      </div>
    </div>
  );
}

function ProjectList({ selectedId, onSelect, onNotice }: { selectedId: string; onSelect: (id: string) => void; onNotice: (message: string) => void }) {
  return <div className="mt-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium uppercase tracking-[.14em] text-[#536575]">12 project results</p><button type="button" onClick={() => onNotice("Advanced filters opened in prototype mode.")} className="inline-flex items-center gap-2 rounded-md border border-[#D7E0E6] px-2.5 py-1.5 text-xs font-medium"><SlidersHorizontal className="h-3.5 w-3.5" />Filters</button></div><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[#E5F3F1] px-2.5 py-1 text-[#0B6E69]">1BR</span><span className="rounded-full bg-[#E5F3F1] px-2.5 py-1 text-[#0B6E69]">≤ AED 2.5M</span></div><div className="mt-4 space-y-2">{projectResults.map((project) => <button key={project.id} type="button" onClick={() => onSelect(project.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === project.id ? "border-[#0B6E69] bg-[#E5F3F1]" : "border-[#D7E0E6] hover:border-[#A9D8D4]"}`}><div className="flex items-start justify-between gap-2"><p className="font-medium">{project.name}</p><span className={`text-xs ${project.status === "Verified" ? "text-[#0B6E69]" : "text-[#B15E16]"}`}>{project.status}</span></div><p className="mt-1 text-xs text-[#536575]">{project.developer} · {project.area}</p><p className="mt-3 text-xs">{project.entry} · {project.handover}</p></button>)}</div></div>;
}

function ProjectDetail({ project, onOpenCase, onNotice }: { project: (typeof projectResults)[number]; onOpenCase: () => void; onNotice: (message: string) => void }) {
  return <section className="rounded-[10px] border border-[#D7E0E6] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium text-[#0B6E69]">{project.developer} · verified DLD record</p><h2 className="mt-2 text-2xl font-semibold">{project.name}</h2><p className="mt-1 text-sm text-[#536575]">{project.area}</p></div><div className="flex gap-2"><button type="button" onClick={() => onNotice("Full analysis opened in prototype mode.")} className="rounded-lg border border-[#D7E0E6] px-3 py-2 text-sm font-medium">Open analysis</button><button type="button" onClick={onOpenCase} className="inline-flex items-center gap-2 rounded-lg bg-[#0B6E69] px-3 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4" />Add to case</button></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="CMA conclusion" value={project.discount} /><Metric label="Entry threshold" value={project.entry} /><Metric label="NOC policy" value={project.noc} /></div><div className="mt-6 grid gap-5 md:grid-cols-2"><InfoBlock title="Construction & delivery" rows={[["Estimated handover", project.handover], ["Current progress", project.construction], ["Evidence date", "DLD inspector · Oct 12"]]} /><InfoBlock title="Developer reliability" rows={[["Track record", "Tier 1 Prime"], ["Average delay", "2.4 months"], ["Active projects", "14"]]} /></div><InfoBlock title="Payment schedule" rows={[["Booking deposit", "20% · on booking"], ["Foundation completion", "10% · Apr 2027"], ["Structure milestone", "10% · Oct 2027"], ["Handover", "60% · Dec 2028"]]} /></section>;
}

function DeveloperList({ onNotice }: { onNotice: (message: string) => void }) { return <div className="mt-4 space-y-2">{developerRecords.map((record) => <button key={record.id} type="button" onClick={() => onNotice(`${record.name} selected for due diligence.`)} className="w-full rounded-lg border border-[#D7E0E6] p-3 text-left hover:border-[#A9D8D4]"><p className="font-medium">{record.name}</p><p className="mt-1 text-xs text-[#536575]">{record.discipline} · {record.onTime}</p></button>)}</div>; }
function DeveloperDetail({ onNotice }: { onNotice: (message: string) => void }) { return <section className="rounded-[10px] border border-[#D7E0E6] bg-white p-5"><p className="text-xs font-medium text-[#0B6E69]">Developer profile</p><h2 className="mt-2 text-2xl font-semibold">Emaar Properties</h2><div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="Delivery record" value="86% on time" /><Metric label="Average delay" value="2.4 months" /><Metric label="Active projects" value="14" /></div><a href="/developers" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#2E5FA7] hover:underline">Open classic track records <ExternalLink className="h-4 w-4" /></a><button type="button" onClick={() => onNotice("Developer evidence saved to the active case.")} className="mt-5 block rounded-lg bg-[#0B6E69] px-3 py-2 text-sm font-medium text-white">Save evidence to case</button></section>; }
function HealthList({ onNotice }: { onNotice: (message: string) => void }) { return <div className="mt-4 space-y-2"><button type="button" onClick={() => onNotice("Downtown market health opened.")} className="w-full rounded-lg border border-[#D7E0E6] p-3 text-left"><p className="font-medium">Downtown Dubai</p><p className="mt-1 text-xs text-[#0B6E69]">Verified sample healthy · 31 transactions</p></button><button type="button" onClick={() => onNotice("Creek Harbour market health opened.")} className="w-full rounded-lg border border-[#D7E0E6] p-3 text-left"><p className="font-medium">Dubai Creek Harbour</p><p className="mt-1 text-xs text-[#0B6E69]">Verified sample healthy · 26 transactions</p></button></div>; }
function HealthDetail({ onNotice }: { onNotice: (message: string) => void }) { return <section className="rounded-[10px] border border-[#D7E0E6] bg-white p-5"><p className="text-xs font-medium text-[#0B6E69]">Market health</p><h2 className="mt-2 text-2xl font-semibold">Evidence coverage</h2><div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="Verified projects" value="48" /><Metric label="Fresh DLD records" value="412" /><Metric label="Needs mapping" value="2" /></div><button type="button" onClick={() => onNotice("Data-health queue opened in prototype mode.")} className="mt-6 rounded-lg border border-[#D7E0E6] px-3 py-2 text-sm font-medium">Review data-health queue</button></section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-[#F5F7F8] p-3"><p className="text-xs text-[#536575]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function InfoBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) { return <section className="mt-6"><h3 className="text-sm font-semibold">{title}</h3><dl className="mt-3 divide-y divide-[#E9EEF1] rounded-lg border border-[#D7E0E6]">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 p-3 text-sm"><dt className="text-[#536575]">{label}</dt><dd className="text-right font-medium">{value}</dd></div>)}</dl></section>; }
