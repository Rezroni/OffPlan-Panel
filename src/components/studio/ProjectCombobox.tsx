"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { Search, ChevronDown, Check, Building2, MapPin, Calendar, Loader2, X, Sparkles } from "lucide-react";

export interface ProjectOptionItem {
  id: string;
  nameEn: string;
  developerBrand?: string | null;
  developerName?: string | null;
  areaName?: string | null;
  expectedHandoverDate?: string | null;
  dldProjectId?: string | null;
}

interface ProjectComboboxProps {
  selectedProjectId: string;
  selectedProjectName?: string;
  selectedDeveloper?: string | null;
  initialProjects?: ProjectOptionItem[];
  onSelectProject: (projectId: string) => void;
  disabled?: boolean;
}

export function ProjectCombobox({
  selectedProjectId,
  selectedProjectName,
  selectedDeveloper,
  initialProjects = [],
  onSelectProject,
  disabled = false,
}: ProjectComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProjectOptionItem[]>(initialProjects);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
      setSearchResults(initialProjects);
      setHighlightedIndex(-1);
    }
  }, [isOpen, initialProjects]);

  // Live debounced search across all 3,000+ projects
  useEffect(() => {
    if (!isOpen) return;

    if (!searchQuery.trim()) {
      setSearchResults(initialProjects);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/projects?q=${encodeURIComponent(searchQuery.trim())}&limit=35`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) {
            setSearchResults(
              data.items.map((item: any) => ({
                id: item.id,
                nameEn: item.nameEn,
                developerName: item.developerName,
                developerBrand: item.developerName,
                areaName: item.areaName,
                expectedHandoverDate: item.expectedHandoverDate,
                dldProjectId: item.dldProjectId,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to search projects:", err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, initialProjects]);

  const handleSelect = (project: ProjectOptionItem) => {
    onSelectProject(project.id);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === "Enter" && highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
      e.preventDefault();
      handleSelect(searchResults[highlightedIndex]);
    }
  };

  const currentDisplayTitle = selectedProjectName || "Выберите проект из базы DLD";
  const currentDisplayDev = selectedDeveloper || null;

  return (
    <div ref={containerRef} className="relative w-full sm:w-96 text-xs">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full bg-slate-50 hover:bg-white border rounded-xl px-3.5 py-2.5 text-left flex items-center justify-between gap-2 shadow-2xs transition-all ${
          isOpen
            ? "border-sky-500 ring-2 ring-sky-500/15 bg-white"
            : "border-slate-200 hover:border-slate-300"
        } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200/80 flex items-center justify-center shrink-0 text-sky-700">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 truncate tracking-tight text-xs">
              {currentDisplayTitle}
            </div>
            {currentDisplayDev && (
              <div className="text-[10px] text-slate-500 font-medium truncate">
                {currentDisplayDev}
              </div>
            )}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-sky-600" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-full min-w-[320px] sm:min-w-[420px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Input Box */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Поиск среди 3,000+ проектов (название, застройщик, район, DLD ID)..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-slate-400">
              <span>
                {isSearching
                  ? "Поиск по DuckDB / DLD..."
                  : searchQuery
                  ? `Найдено проектов: ${searchResults.length}`
                  : "Популярные проекты Dubai Off-Plan"}
              </span>
              {isSearching && <Loader2 className="h-3 w-3 animate-spin text-sky-600" />}
            </div>
          </div>

          {/* Results List */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-72 overflow-y-auto divide-y divide-slate-100/80 p-1.5 focus:outline-none"
          >
            {searchResults.length === 0 && !isSearching ? (
              <li className="p-6 text-center text-slate-500">
                <Building2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <div className="font-semibold text-xs text-slate-700">Проект не найден</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Попробуйте другое ключевое слово (например, Emaar, Sobha, Damac или район)
                </div>
              </li>
            ) : (
              searchResults.map((proj, idx) => {
                const isSelected = proj.id === selectedProjectId;
                const isHighlighted = idx === highlightedIndex;
                const dev = proj.developerBrand || proj.developerName || "Dubai Developer";

                return (
                  <li
                    key={proj.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(proj)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-sky-50/80 text-sky-950 font-semibold"
                        : isHighlighted
                        ? "bg-slate-100/80 text-slate-900"
                        : "hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs truncate text-slate-900">
                          {proj.nameEn}
                        </span>
                        {proj.dldProjectId && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">
                            #{proj.dldProjectId}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] text-slate-500">
                        <span className="font-medium text-slate-700">{dev}</span>
                        {proj.areaName && (
                          <>
                            <span>&bull;</span>
                            <span className="flex items-center gap-0.5 text-slate-500">
                              <MapPin className="h-2.5 w-2.5 text-slate-400" />
                              {proj.areaName}
                            </span>
                          </>
                        )}
                        {proj.expectedHandoverDate && (
                          <>
                            <span>&bull;</span>
                            <span className="flex items-center gap-0.5 text-slate-500 font-mono">
                              <Calendar className="h-2.5 w-2.5 text-slate-400" />
                              {proj.expectedHandoverDate.slice(0, 7)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
