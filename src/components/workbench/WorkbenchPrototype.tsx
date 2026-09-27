"use client";

import { Bell, BriefcaseBusiness, FileText, LayoutDashboard, Menu, MonitorPlay, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { CasesWorkspace } from "./CasesWorkspace";
import { OverviewWorkspace } from "./OverviewWorkspace";
import { ResearchCommandDesk } from "./ResearchCommandDesk";
import { StudioDocumentsWorkspace } from "./StudioDocumentsWorkspace";
import type { CaseStage, WorkspaceId } from "./workbench-types";

const navigationItems: Array<{ id: WorkspaceId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "research", label: "Research", icon: Search },
  { id: "cases", label: "Cases", icon: BriefcaseBusiness },
  { id: "studio", label: "Studio", icon: MonitorPlay },
  { id: "documents", label: "Documents", icon: FileText },
];

export function WorkbenchPrototype() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>("overview");
  const [activeCaseStage, setActiveCaseStage] = useState<CaseStage>("brief");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notice, setNotice] = useState("Prototype mode: existing production data remains untouched.");

  const openWorkspace = (workspace: WorkspaceId) => {
    setActiveWorkspace(workspace);
    setIsMobileMenuOpen(false);
  };

  const openNewCase = () => {
    setActiveCaseStage("brief");
    openWorkspace("cases");
    setNotice("New case opened. Complete the brief before comparing offers.");
  };

  const showNotice = (message: string) => setNotice(message);

  return (
    <div className="min-h-screen bg-[#F5F7F8] text-[#12212E]">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[#D7E0E6] bg-white px-3 sm:px-5">
        <button onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)} className="rounded-lg p-2 text-[#536575] md:hidden" aria-label="Open workbench navigation">
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex shrink-0 items-center gap-2 font-semibold"><span className="grid h-6 w-6 place-items-center rounded bg-[#12212E] text-xs text-white">D</span>OffPlan Desk</div>
        <label className="relative ml-2 hidden max-w-lg flex-1 sm:block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#536575]" />
          <input className="w-full rounded-lg border border-[#D7E0E6] bg-[#F5F7F8] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#0B6E69]" placeholder="Search projects, developers, or client cases" />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => showNotice("No unread notifications in this prototype.")} className="rounded-lg p-2 text-[#536575]" aria-label="Show notifications"><Bell className="h-5 w-5" /></button>
          <button onClick={openNewCase} className="inline-flex items-center gap-2 rounded-lg bg-[#0B6E69] px-3 py-2 text-sm font-medium text-white hover:bg-[#095A56]"><Plus className="h-4 w-4" />New case</button>
        </div>
      </header>

      <div className="flex">
        <aside className={`${isMobileMenuOpen ? "fixed inset-x-0 top-14 z-20 block" : "hidden"} min-h-[calc(100vh-3.5rem)] w-56 shrink-0 border-r border-[#D7E0E6] bg-white p-3 md:sticky md:top-14 md:block`}>
          <nav className="space-y-1">
            {navigationItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => openWorkspace(id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium ${activeWorkspace === id ? "bg-[#E5F3F1] text-[#0B6E69]" : "text-[#536575] hover:bg-[#F5F7F8] hover:text-[#12212E]"}`}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </nav>
          <div className="mt-8 border-t border-[#D7E0E6] pt-4 text-xs text-[#536575]"><p className="font-medium text-[#12212E]">Mokhamed</p><p>Desk analyst</p><a href="/" className="mt-3 inline-block text-[#2E5FA7] hover:underline">Return to classic Desk</a></div>
        </aside>

        <main suppressHydrationWarning className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {activeWorkspace === "overview" && <OverviewWorkspace onOpenWorkspace={openWorkspace} onStageChange={setActiveCaseStage} onNotice={showNotice} />}
          {activeWorkspace === "research" && <ResearchCommandDesk onOpenCase={() => openWorkspace("cases")} onNotice={showNotice} />}
          {activeWorkspace === "cases" && <CasesWorkspace activeStage={activeCaseStage} onStageChange={setActiveCaseStage} onNotice={showNotice} />}
          {(activeWorkspace === "studio" || activeWorkspace === "documents") && <StudioDocumentsWorkspace workspace={activeWorkspace} onNotice={showNotice} />}
          <p className="mt-6 text-xs text-[#536575]" role="status">{notice}</p>
        </main>
      </div>
    </div>
  );
}
