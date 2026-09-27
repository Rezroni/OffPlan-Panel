"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/desk/Header";
import {
  Search,
  Building2,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  ChevronRight,
  ChevronLeft,
  Database,
  Layers,
  MapPin,
  Sparkles,
  LayoutGrid,
  List,
  ArrowRight,
  ExternalLink,
  Home,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectListItem = {
  id: string;
  nameEn: string;
  developerBrand: string | null;
  areaNameEn: string | null;
  status: string | null;
  propertyType?: string;
  dldProjectNumber?: string | null;
  expectedHandoverDate: string | null;
  constructionProgressPct: number | null;
  researchStatus: string;
  unitTypeCount: number;
  firstSeenAt: string;
  updatedAt: string;
};

type Props = {
  initialProjects: ProjectListItem[];
  total: number;
  dataHealth: {
    validTransactions: number;
    validRentContracts: number;
    pendingMatches: number;
  };
};

// ---------------------------------------------------------------------------
// Property Type Badge
// ---------------------------------------------------------------------------

function PropertyTypeBadge({ type }: { type?: string }) {
  const t = (type || "apartment").toLowerCase();
  if (t === "villa") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
        <Home className="h-2.5 w-2.5 text-amber-600" />
        Виллы &amp; таунхаусы
      </span>
    );
  }
  if (t === "both") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
        <Layers className="h-2.5 w-2.5 text-purple-600" />
        Смешанный (Apts + Villas)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
      <Building2 className="h-2.5 w-2.5 text-sky-600" />
      Квартиры
    </span>
  );
}

// ---------------------------------------------------------------------------
// Research Status Badge
// ---------------------------------------------------------------------------

function ResearchStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; label: string }> = {
    discovered: { color: "bg-slate-100 text-slate-700 border-slate-200", label: "Discovered" },
    mapped: { color: "bg-sky-50 text-sky-700 border-sky-200", label: "Mapped" },
    analysed: { color: "bg-purple-50 text-purple-700 border-purple-200", label: "Analysed" },
    editorial_reviewed: { color: "bg-amber-50 text-amber-800 border-amber-200", label: "Reviewed" },
    content_ready: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Ready" },
  };
  const cfg = configs[status] ?? configs.discovered;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Project Status Dot
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: string | null }) {
  const color =
    status === "active" ? "bg-emerald-500" :
    status === "completed" ? "bg-sky-500" :
    status === "suspended" ? "bg-rose-500" :
    "bg-slate-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

// ---------------------------------------------------------------------------
// Progress Bar
// ---------------------------------------------------------------------------

function ProgressBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400 text-xs italic">unknown</span>;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
        <div
          className="bg-gradient-to-r from-sky-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-600 font-mono font-bold tabular-nums w-9 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project Card (Grid View)
// ---------------------------------------------------------------------------

function ProjectCard({ project }: { project: ProjectListItem }) {
  return (
    <div className="group bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-5 sm:p-6 transition-all duration-150 shadow-sm hover:shadow-md flex flex-col justify-between space-y-4">
      <div>
        {/* Top bar with status and tags */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StatusDot status={project.status} />
              <Link
                href={`/projects/${project.id}`}
                className="font-bold text-slate-900 text-base leading-tight truncate group-hover:text-sky-700 transition-colors block"
              >
                {project.nameEn}
              </Link>
              {project.dldProjectNumber && (
                <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  #{project.dldProjectNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate font-medium">
              {project.developerBrand ?? "Developer unknown"}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <ResearchStatusBadge status={project.researchStatus} />
          </div>
        </div>

        {/* Property Type Badge */}
        <div className="flex items-center gap-2 mb-2">
          <PropertyTypeBadge type={project.propertyType} />
        </div>

        {/* Location & Handover */}
        <div className="flex items-center gap-2.5 my-3 text-xs text-slate-500">
          {project.areaNameEn && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg">
              <MapPin className="h-3 w-3 text-sky-600 shrink-0" />
              <span className="truncate max-w-[130px] font-medium text-slate-700">{project.areaNameEn}</span>
            </div>
          )}
          {project.expectedHandoverDate && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg">
              <Calendar className="h-3 w-3 text-slate-500 shrink-0" />
              <span className="font-mono text-slate-700">
                {new Date(project.expectedHandoverDate).toLocaleDateString("en-AE", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Construction Progress */}
        <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-100">
          <div className="flex justify-between text-[11px] text-slate-500 font-medium">
            <span>Construction Milestone</span>
            <span className="text-slate-800 font-bold capitalize">{project.status ?? "off-plan"}</span>
          </div>
          <ProgressBar value={project.constructionProgressPct} />
        </div>
      </div>

      {/* Card Footer with Unit count & Action */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          <strong className="text-slate-900 font-mono">{project.unitTypeCount}</strong> registered unit types
        </span>
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-800 group-hover:translate-x-0.5 transition-all"
        >
          <span>Analyze</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Discover Page Component
// ---------------------------------------------------------------------------

export default function DiscoverClient({ initialProjects, total, dataHealth }: Props) {
  const [search, setSearch] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<"all" | "apartment" | "villa">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(30);
  const [page, setPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Extract unique areas
  const uniqueAreas = useMemo(() => {
    const set = new Set<string>();
    for (const p of initialProjects) {
      if (p.areaNameEn) set.add(p.areaNameEn);
    }
    return Array.from(set).sort();
  }, [initialProjects]);

  // Dynamic counts for property types
  const counts = useMemo(() => {
    let apt = 0;
    let villa = 0;
    for (const p of initialProjects) {
      const pt = (p.propertyType || "apartment").toLowerCase();
      if (pt === "villa" || pt === "both") villa++;
      if (pt === "apartment" || pt === "both") apt++;
    }
    return { all: initialProjects.length, apartment: apt, villa };
  }, [initialProjects]);

  // Client-side filtering across ALL loaded projects
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cleanQ = q.replace(/^#/, "");
    return initialProjects.filter((p) => {
      const pt = (p.propertyType || "apartment").toLowerCase();
      const matchPropType =
        propertyTypeFilter === "all" ||
        (propertyTypeFilter === "villa" && (pt === "villa" || pt === "both")) ||
        (propertyTypeFilter === "apartment" && (pt === "apartment" || pt === "both"));

      const matchSearch =
        !q ||
        p.nameEn.toLowerCase().includes(q) ||
        (p.developerBrand ?? "").toLowerCase().includes(q) ||
        (p.areaNameEn ?? "").toLowerCase().includes(q) ||
        (p.dldProjectNumber && p.dldProjectNumber.toLowerCase().includes(cleanQ)) ||
        p.id.toLowerCase().includes(cleanQ);

      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchArea = areaFilter === "all" || p.areaNameEn === areaFilter;

      return matchPropType && matchSearch && matchStatus && matchArea;
    });
  }, [initialProjects, search, propertyTypeFilter, statusFilter, areaFilter]);

  // Reset page when filters change
  const handleFilterChange = (setter: (v: any) => void, val: any) => {
    setter(val);
    setPage(1);
  };

  // Pagination calculation
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;

  const paginatedProjects = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Global Unified Navigation Header */}
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Search Banner */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200/80">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  Dubai Land Department Verified Catalog
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                  DuckDB Real-Time Sync
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Leads &amp; Off-Plan Property Intelligence
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Explore Dubai off-plan projects registered with DLD, analyze 3-group CMA benchmarks, verify escrow bank accounts, and calculate contractor delay discipline.
              </p>
            </div>

            {/* Quick Stats Pill Strip */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs">
                <div className="text-[10px] uppercase font-bold text-slate-500">Total Projects</div>
                <div className="text-lg font-bold font-mono text-slate-900">{total.toLocaleString()}</div>
              </div>
              <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs">
                <div className="text-[10px] uppercase font-bold text-slate-500">Verified Sales</div>
                <div className="text-lg font-bold font-mono text-emerald-700">{dataHealth.validTransactions.toLocaleString()}</div>
              </div>
              <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs">
                <div className="text-[10px] uppercase font-bold text-slate-500">Rent Records</div>
                <div className="text-lg font-bold font-mono text-sky-700">{dataHealth.validRentContracts.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Property Type Switcher: «Все» / «Квартиры» / «Виллы и таунхаусы» */}
          <div className="pt-6 pb-2 border-b border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80 shadow-inner gap-1.5">
                <button
                  type="button"
                  onClick={() => handleFilterChange(setPropertyTypeFilter, "all")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    propertyTypeFilter === "all"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-slate-500" />
                  <span>Все</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    propertyTypeFilter === "all" ? "bg-slate-100 text-slate-800" : "bg-slate-200/60 text-slate-500"
                  }`}>
                    {counts.all.toLocaleString()}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFilterChange(setPropertyTypeFilter, "apartment")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    propertyTypeFilter === "apartment"
                      ? "bg-white text-sky-800 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5 text-sky-600" />
                  <span>Квартиры</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    propertyTypeFilter === "apartment" ? "bg-sky-50 text-sky-700" : "bg-slate-200/60 text-slate-500"
                  }`}>
                    {counts.apartment.toLocaleString()}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFilterChange(setPropertyTypeFilter, "villa")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    propertyTypeFilter === "villa"
                      ? "bg-white text-amber-800 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  <Home className="h-3.5 w-3.5 text-amber-600" />
                  <span>Виллы и таунхаусы</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    propertyTypeFilter === "villa" ? "bg-amber-50 text-amber-800" : "bg-slate-200/60 text-slate-500"
                  }`}>
                    {counts.villa.toLocaleString()}
                  </span>
                </button>
              </div>

              <div className="text-xs text-slate-500 font-medium hidden sm:flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span>Фильтр по типу объекта</span>
              </div>
            </div>
          </div>

          {/* Search Input Bar */}
          <div className="pt-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск по названию, застройщику, району или DLD #номеру (напр. #4430, #3859, Danube)..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Area Filter */}
              <select
                value={areaFilter}
                onChange={(e) => handleFilterChange(setAreaFilter, e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3.5 py-3 text-xs text-slate-700 focus:outline-none focus:border-sky-500 max-w-[200px] shadow-sm"
              >
                <option value="all">Все районы ({uniqueAreas.length})</option>
                {uniqueAreas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3.5 py-3 text-xs text-slate-700 focus:outline-none focus:border-sky-500 shadow-sm"
              >
                <option value="all">Все статусы</option>
                <option value="active">Active (Off-Plan)</option>
                <option value="completed">Completed</option>
                <option value="suspended">Suspended</option>
              </select>

              {/* Page Size */}
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-300 rounded-xl px-3 py-3 text-xs text-slate-700 focus:outline-none focus:border-sky-500 shadow-sm"
              >
                <option value={15}>15 / стр</option>
                <option value={30}>30 / стр</option>
                <option value={60}>60 / стр</option>
                <option value={120}>120 / стр</option>
              </select>

              {/* View Mode Switcher (Grid vs Table) */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === "grid"
                      ? "bg-white text-slate-900 font-bold shadow-sm border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === "table"
                      ? "bg-white text-slate-900 font-bold shadow-sm border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Table View"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 pb-2 border-b border-slate-200">
          <div>
            Показано{" "}
            <strong className="text-slate-900 font-mono">
              {filtered.length > 0 ? (page - 1) * pageSize + 1 : 0}–
              {Math.min(page * pageSize, filtered.length)}
            </strong>{" "}
            из <strong className="text-slate-900 font-mono">{filtered.length.toLocaleString()}</strong> проектов
            {filtered.length < total && ` (отфильтровано из ${total.toLocaleString()})`}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 shadow-sm transition-colors text-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1 rounded-lg bg-white text-xs text-slate-800 font-mono font-bold border border-slate-200 shadow-sm">
                Стр {page} из {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 shadow-sm transition-colors text-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Projects View */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 text-center py-20 text-slate-500 space-y-3 shadow-sm">
            <Building2 className="h-12 w-12 mx-auto mb-2 text-slate-400" />
            <p className="text-lg font-bold text-slate-900">Проекты не найдены</p>
            <p className="text-xs text-slate-500">Попробуйте изменить поисковый запрос или фильтры районов/типов.</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {paginatedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase font-bold tracking-wider text-slate-600 bg-slate-50">
                    <th className="py-3.5 px-5">Название проекта</th>
                    <th className="py-3.5 px-5">Тип</th>
                    <th className="py-3.5 px-5">Застройщик</th>
                    <th className="py-3.5 px-5">Район</th>
                    <th className="py-3.5 px-5">Статус</th>
                    <th className="py-3.5 px-5">Прогресс</th>
                    <th className="py-3.5 px-5">Сдача</th>
                    <th className="py-3.5 px-5">Юниты</th>
                    <th className="py-3.5 px-5 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedProjects.map((project) => (
                    <tr key={project.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                            (project.propertyType || "apartment") === "villa" ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-sky-50 border-sky-200 text-sky-600"
                          }`}>
                            {(project.propertyType || "apartment") === "villa" ? (
                              <Home className="h-4 w-4" />
                            ) : (
                              <Building2 className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/projects/${project.id}`}
                                className="font-bold text-slate-900 group-hover:text-sky-700 transition-colors block text-sm"
                              >
                                {project.nameEn}
                              </Link>
                              {project.dldProjectNumber && (
                                <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                                  #{project.dldProjectNumber}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{project.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <PropertyTypeBadge type={project.propertyType} />
                      </td>
                      <td className="py-3.5 px-5 text-slate-700 font-medium">
                        {project.developerBrand ?? "Unknown Developer"}
                      </td>
                      <td className="py-3.5 px-5 text-slate-600">
                        {project.areaNameEn ?? "Dubai"}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                          <StatusDot status={project.status} />
                          <span className="capitalize">{project.status ?? "off-plan"}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-5 min-w-[120px]">
                        <ProgressBar value={project.constructionProgressPct} />
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-700">
                        {project.expectedHandoverDate
                          ? new Date(project.expectedHandoverDate).toLocaleDateString("en-AE", {
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-900">
                        {project.unitTypeCount}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <Link
                          href={`/projects/${project.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold transition-all shadow-sm"
                        >
                          <span>Анализ</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bottom Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-6 pb-12">
            <button
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-xs font-bold text-slate-700 shadow-sm transition-all"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500 px-3 font-mono">
              Page <strong className="text-slate-900">{page}</strong> of <strong className="text-slate-900">{totalPages}</strong>
            </span>
            <button
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-xs font-bold text-slate-700 shadow-sm transition-all"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
