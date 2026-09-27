"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { DeveloperListItem } from "@/server/dal/developers";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
  X,
  SlidersHorizontal,
  TrendingUp,
  Award,
  Layers,
} from "lucide-react";

type Props = {
  initialDevelopers: DeveloperListItem[];
};

type BadgeFilter = "ALL" | "PROVEN_DISCIPLINE" | "MODERATE_DELAYS" | "CHRONIC_DELAYS" | "INSUFFICIENT_HISTORY";
type SortOption = "projects_desc" | "ontime_desc" | "delay_asc" | "name_asc";

export function DevelopersListClient({ initialDevelopers }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [badgeFilter, setBadgeFilter] = useState<BadgeFilter>("ALL");
  const [onlyWithProjects, setOnlyWithProjects] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("projects_desc");
  const [visibleCount, setVisibleCount] = useState(36);

  // Global KPIs across the tracked database
  const stats = useMemo(() => {
    const total = initialDevelopers.length;
    const withProjects = initialDevelopers.filter((d) => d.totalProjects > 0);
    const proven = initialDevelopers.filter((d) => d.reliabilityBadge === "PROVEN_DISCIPLINE");
    const totalCompleted = initialDevelopers.reduce((acc, d) => acc + d.completedProjects, 0);
    const totalProjects = initialDevelopers.reduce((acc, d) => acc + d.totalProjects, 0);
    
    // Average on-time rate for developers with completed projects
    const devsWithCompleted = initialDevelopers.filter((d) => d.completedProjects > 0);
    const avgOnTime = devsWithCompleted.length > 0
      ? Math.round(devsWithCompleted.reduce((acc, d) => acc + d.onTimeRatePercent, 0) / devsWithCompleted.length)
      : 0;

    return {
      total,
      activeDevelopers: withProjects.length,
      provenCount: proven.length,
      totalProjects,
      totalCompleted,
      avgOnTime,
    };
  }, [initialDevelopers]);

  // Filtered & Sorted list
  const filteredDevelopers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return initialDevelopers
      .filter((dev) => {
        // Project filter
        if (onlyWithProjects && dev.totalProjects === 0) {
          return false;
        }

        // Reliability badge filter
        if (badgeFilter !== "ALL" && dev.reliabilityBadge !== badgeFilter) {
          return false;
        }

        // Search query filter
        if (query) {
          const matchBrand = (dev.brandName || "").toLowerCase().includes(query);
          const matchLegal = (dev.legalName || "").toLowerCase().includes(query);
          const matchDisplay = (dev.displayName || "").toLowerCase().includes(query);
          const matchDld = (dev.dldDeveloperId || "").toLowerCase().includes(query);
          if (!matchBrand && !matchLegal && !matchDisplay && !matchDld) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "projects_desc":
            if (b.totalProjects !== a.totalProjects) return b.totalProjects - a.totalProjects;
            return a.displayName.localeCompare(b.displayName);
          case "ontime_desc":
            if (b.onTimeRatePercent !== a.onTimeRatePercent) return b.onTimeRatePercent - a.onTimeRatePercent;
            return b.totalProjects - a.totalProjects;
          case "delay_asc":
            if (a.completedProjects === 0 && b.completedProjects > 0) return 1;
            if (b.completedProjects === 0 && a.completedProjects > 0) return -1;
            return a.avgDelayMonths - b.avgDelayMonths;
          case "name_asc":
          default:
            return a.displayName.localeCompare(b.displayName);
        }
      });
  }, [initialDevelopers, searchQuery, badgeFilter, onlyWithProjects, sortBy]);

  const visibleDevelopers = filteredDevelopers.slice(0, visibleCount);

  const getBadgeStyle = (badge: DeveloperListItem["reliabilityBadge"]) => {
    switch (badge) {
      case "PROVEN_DISCIPLINE":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "MODERATE_DELAYS":
        return "bg-sky-50 text-sky-800 border-sky-200";
      case "CHRONIC_DELAYS":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "INSUFFICIENT_HISTORY":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getBadgeIcon = (badge: DeveloperListItem["reliabilityBadge"]) => {
    switch (badge) {
      case "PROVEN_DISCIPLINE":
        return <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />;
      case "MODERATE_DELAYS":
        return <Clock className="h-3 w-3 text-sky-600 shrink-0" />;
      case "CHRONIC_DELAYS":
        return <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />;
      case "INSUFFICIENT_HISTORY":
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 shadow-sm">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Developer Track Record &amp; Construction Discipline
                <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
                  Phase 5 (§13)
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Official DLD project delivery discipline, historical delay metrics, and verified master developer registry.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-600 font-mono bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Tracking <strong className="text-slate-900 font-bold">{stats.total}</strong> developers &bull; <strong className="text-slate-900 font-bold">{stats.activeDevelopers}</strong> active in catalog</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-sky-500" />
            Active Developers
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {stats.activeDevelopers}
            <span className="text-xs font-normal text-slate-400 ml-1.5">of {stats.total}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">With active/completed projects</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-emerald-500" />
            Total Projects Monitored
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {stats.totalProjects.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{stats.totalCompleted.toLocaleString()} completed &amp; handed over</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-emerald-600" />
            Proven Discipline
          </span>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {stats.provenCount}
            <span className="text-xs font-normal text-slate-400 ml-1.5">developers</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">High on-time delivery track record</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-sky-600" />
            Market On-Time Rate
          </span>
          <div className="text-2xl font-black text-sky-700 mt-1">
            {stats.avgOnTime}%
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Based on verified DLD records</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Developer brand name, legal entity, or DLD ID (e.g. Emaar, DAMAC, Sobha, Nshama)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(36);
              }}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-all outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Controls: Scope Switch & Sort */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Scope Toggle */}
            <button
              onClick={() => {
                setOnlyWithProjects(!onlyWithProjects);
                setVisibleCount(36);
              }}
              className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${
                onlyWithProjects
                  ? "bg-sky-50 border-sky-200 text-sky-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>{onlyWithProjects ? "Active Catalog (>0 Proj)" : "All Entities"}</span>
            </button>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-slate-700 font-semibold outline-none cursor-pointer pr-1"
              >
                <option value="projects_desc">Most Projects</option>
                <option value="ontime_desc">Highest On-Time %</option>
                <option value="delay_asc">Lowest Delay</option>
                <option value="name_asc">Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Badge Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 text-[11px] font-semibold mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Filter:
          </span>

          {(
            [
              { key: "ALL", label: "All Statuses" },
              { key: "PROVEN_DISCIPLINE", label: "Proven Discipline", badgeStyle: "text-emerald-700 bg-emerald-50 border-emerald-200" },
              { key: "MODERATE_DELAYS", label: "Moderate Delays", badgeStyle: "text-sky-700 bg-sky-50 border-sky-200" },
              { key: "CHRONIC_DELAYS", label: "Chronic Delays", badgeStyle: "text-amber-700 bg-amber-50 border-amber-200" },
              { key: "INSUFFICIENT_HISTORY", label: "Insufficient History", badgeStyle: "text-slate-600 bg-slate-100 border-slate-200" },
            ] as const
          ).map((item) => {
            const isSelected = badgeFilter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setBadgeFilter(item.key);
                  setVisibleCount(36);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                  isSelected
                    ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </button>
            );
          })}

          <div className="ml-auto text-[11px] text-slate-400 font-mono">
            Showing {visibleDevelopers.length} of {filteredDevelopers.length} developers
          </div>
        </div>
      </div>

      {/* Developers Grid */}
      {visibleDevelopers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleDevelopers.map((dev) => (
            <Link
              key={dev.id}
              href={`/developers/${dev.id}`}
              className="bg-white border border-slate-200/90 hover:border-sky-300 rounded-2xl p-6 transition-all duration-150 group flex flex-col justify-between space-y-5 shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 text-base group-hover:text-sky-600 transition-colors truncate flex items-center gap-1.5" title={dev.displayName}>
                      <span>{dev.displayName}</span>
                      {dev.reliabilityBadge === "PROVEN_DISCIPLINE" && (
                        <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                      )}
                    </h3>

                    {dev.legalName && dev.legalName !== dev.displayName && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5" title={dev.legalName}>
                        <span className="text-slate-400 font-mono">Legal:</span> {dev.legalName}
                      </p>
                    )}

                    {dev.dldDeveloperId && (
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        DLD ID: #{dev.dldDeveloperId}
                      </p>
                    )}
                  </div>

                  <span
                    className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border shrink-0 flex items-center gap-1 ${getBadgeStyle(
                      dev.reliabilityBadge
                    )}`}
                  >
                    {getBadgeIcon(dev.reliabilityBadge)}
                    {dev.reliabilityBadge.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono border-t border-slate-100 pt-4">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 text-[10px] block font-sans font-semibold">Projects</span>
                    <span className="text-slate-900 font-bold text-sm">{dev.totalProjects}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 text-[10px] block font-sans font-semibold">On-Time %</span>
                    <span
                      className={`font-bold text-sm ${
                        dev.onTimeRatePercent >= 70 ? "text-emerald-700" : dev.completedProjects > 0 ? "text-amber-700" : "text-slate-400"
                      }`}
                    >
                      {dev.completedProjects > 0 ? `${dev.onTimeRatePercent}%` : "—"}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-slate-500 text-[10px] block font-sans font-semibold">Avg Delay</span>
                    <span className="text-slate-800 font-bold text-sm">
                      {dev.completedProjects > 0 ? `${dev.avgDelayMonths}m` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-sky-600 group-hover:text-sky-700 font-bold pt-3 border-t border-slate-100">
                <span>View Full Construction Audit</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No developers found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No developer records matched &ldquo;{searchQuery}&rdquo; with the selected filters.
            </p>
          </div>
          <button
            onClick={() => {
              setSearchQuery("");
              setBadgeFilter("ALL");
              setOnlyWithProjects(false);
            }}
            className="text-xs font-semibold px-4 py-2 bg-sky-50 text-sky-700 border border-sky-200 rounded-xl hover:bg-sky-100 transition-colors"
          >
            Clear Search &amp; Filters
          </button>
        </div>
      )}

      {/* Load More Button */}
      {visibleCount < filteredDevelopers.length && (
        <div className="text-center pt-4">
          <button
            onClick={() => setVisibleCount((prev) => prev + 36)}
            className="px-6 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-sm hover:shadow transition-all"
          >
            Load More Developers ({filteredDevelopers.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
