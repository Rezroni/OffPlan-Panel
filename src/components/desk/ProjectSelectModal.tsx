"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  Building2,
  Check,
  Sparkles,
  ChevronRight,
  Sliders,
  Calendar,
  MapPin,
  Layers,
  RefreshCw,
  Award,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { formatAED, formatSqft } from "@/lib/decimal";
import { OfferData } from "./OfferComparisonSection";
import { TransactionFact } from "@/domain/cma/comparable-set";

interface ProjectSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetOptionIndex: 0 | 1; // 0 for Option A, 1 for Option B
  currentOffer: OfferData;
  onApplyOffer: (index: 0 | 1, updatedOffer: OfferData) => void;
}

interface ProjectSummaryItem {
  id: string;
  nameEn: string;
  dldProjectId: string | null;
  status: string | null;
  expectedHandoverDate: string | null;
  constructionProgressPct: number | null;
  developerName: string;
  areaName: string;
  minPriceAed: number | null;
  maxPriceAed: number | null;
  minAreaSqft: number | null;
  maxAreaSqft: number | null;
  unitCount: number;
}

export function ProjectSelectModal({
  isOpen,
  onClose,
  targetOptionIndex,
  currentOffer,
  onApplyOffer,
}: ProjectSelectModalProps) {
  const [activeTab, setActiveTab] = useState<"catalog" | "manual">("catalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [popularAreas, setPopularAreas] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);

  // Selected project in catalog step
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectDetail, setSelectedProjectDetail] = useState<any | null>(null);
  const [selectedUnitType, setSelectedUnitType] = useState<any | null>(null);

  // Configurable fields before applying
  const [configuredPrice, setConfiguredPrice] = useState<number>(currentOffer.contractPrice);
  const [configuredArea, setConfiguredArea] = useState<number>(currentOffer.areaSqft);
  const [configuredHandover, setConfiguredHandover] = useState<string>(currentOffer.expectedHandover);
  const [configuredNocPct, setConfiguredNocPct] = useState<number>(currentOffer.minPaidPercentForNoc || 34);
  const [configuredProjectName, setConfiguredProjectName] = useState<string>(currentOffer.projectName);
  const [configuredDeveloper, setConfiguredDeveloper] = useState<string>(currentOffer.developerName);
  const [configuredCommunity, setConfiguredCommunity] = useState<string>(currentOffer.community);
  const [configuredUnitTypeLabel, setConfiguredUnitTypeLabel] = useState<string>(currentOffer.unitType);

  // Ready sales comps
  const [readyComps, setReadyComps] = useState<TransactionFact[]>(currentOffer.cmaReadySales);
  const [readyMedianPsf, setReadyMedianPsf] = useState<number>(2400);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setConfiguredPrice(currentOffer.contractPrice);
      setConfiguredArea(currentOffer.areaSqft);
      setConfiguredHandover(currentOffer.expectedHandover);
      setConfiguredNocPct(currentOffer.minPaidPercentForNoc || 34);
      setConfiguredProjectName(currentOffer.projectName);
      setConfiguredDeveloper(currentOffer.developerName);
      setConfiguredCommunity(currentOffer.community);
      setConfiguredUnitTypeLabel(currentOffer.unitType);
      setReadyComps(currentOffer.cmaReadySales);
      setSelectedProjectId(null);
      setSelectedProjectDetail(null);
      setSelectedUnitType(null);
      fetchProjects("", selectedArea);
    }
  }, [isOpen, currentOffer]);

  // Fetch projects list with search & area filter
  const fetchProjects = async (q: string, area: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (area) params.set("area", area);
      params.set("limit", "25");

      const res = await fetch(`/api/projects?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.items || []);
        if (data.popularAreas) {
          setPopularAreas(data.popularAreas);
        }
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchProjects(searchQuery, selectedArea);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedArea, isOpen]);

  // When a project is clicked, fetch its details and unit types
  const handleSelectProject = async (proj: ProjectSummaryItem) => {
    setSelectedProjectId(proj.id);
    setIsFetchingDetail(true);
    try {
      const res = await fetch(`/api/projects?id=${proj.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedProjectDetail(data);

        // Prepopulate fields
        setConfiguredProjectName(data.project.nameEn);
        setConfiguredDeveloper(data.project.developerName || "Developer");
        setConfiguredCommunity(data.project.areaName || "Dubai");

        // Format handover
        let handover = "2028-12";
        if (data.project.expectedHandoverDate && data.project.expectedHandoverDate.length >= 7) {
          handover = data.project.expectedHandoverDate.substring(0, 7);
        }
        setConfiguredHandover(handover);

        // Pick initial unit type if available
        if (data.unitTypes && data.unitTypes.length > 0) {
          // Prefer 1BR or first available
          const preferred =
            data.unitTypes.find((u: any) => u.bedrooms === 1) || data.unitTypes[0];
          setSelectedUnitType(preferred);
          setConfiguredUnitTypeLabel(preferred.unitTypeLabel || `${preferred.bedrooms || 1} Bedroom`);
          setConfiguredArea(preferred.areaSqftMin || 750);
          setConfiguredPrice(preferred.netPriceAed || preferred.listPriceAed || 1500000);
          setConfiguredNocPct(preferred.minPaidPctForNoc ? Math.round(preferred.minPaidPctForNoc) : 34);
        } else {
          // If no unit types in DB, estimate sensible defaults
          const estArea = proj.minAreaSqft || 750;
          const estPsf = data.readyMedianPsf ? Math.round(data.readyMedianPsf * 0.9) : 2100;
          const estPrice = proj.minPriceAed || estArea * estPsf;

          setSelectedUnitType(null);
          setConfiguredUnitTypeLabel("1 Bedroom Residence");
          setConfiguredArea(estArea);
          setConfiguredPrice(estPrice);
          setConfiguredNocPct(34);
        }

        if (data.readyComps && data.readyComps.length > 0) {
          setReadyComps(data.readyComps);
        }
        if (data.readyMedianPsf) {
          setReadyMedianPsf(data.readyMedianPsf);
        }
      }
    } catch (err) {
      console.error("Failed to load project details:", err);
    } finally {
      setIsFetchingDetail(false);
    }
  };

  // Change selected unit type
  const handleUnitTypeChange = (u: any) => {
    setSelectedUnitType(u);
    setConfiguredUnitTypeLabel(u.unitTypeLabel || `${u.bedrooms || 1} Bedroom`);
    if (u.areaSqftMin) setConfiguredArea(u.areaSqftMin);
    if (u.netPriceAed || u.listPriceAed) {
      setConfiguredPrice(u.netPriceAed || u.listPriceAed);
    }
    if (u.minPaidPctForNoc) {
      setConfiguredNocPct(Math.round(u.minPaidPctForNoc));
    }
  };

  // Generate milestone schedule
  const generateMilestones = (price: number, handoverDate: string) => {
    const handoverYear = parseInt(handoverDate.slice(0, 4), 10) || 2028;
    const handoverMonth = handoverDate.slice(5, 7) || "12";

    const booking = Math.round(price * 0.20);
    const m1 = Math.round(price * 0.10);
    const m2 = Math.round(price * 0.10);
    const onHandover = price - booking - m1 - m2;

    const interimYear = Math.max(2027, Math.min(handoverYear - 1, 2027));

    return [
      {
        date: "2026-10-01",
        amount: booking,
        percent: 20,
        description: "Booking Deposit (20%)",
      },
      {
        date: `${interimYear}-04-01`,
        amount: m1,
        percent: 10,
        description: "Foundation Milestone (10%)",
      },
      {
        date: `${interimYear}-10-01`,
        amount: m2,
        percent: 10,
        description: "Superstructure Milestone (10%)",
      },
      {
        date: `${handoverYear}-${handoverMonth}-01`,
        amount: onHandover,
        percent: 60,
        description: "On Handover (60%)",
      },
    ];
  };

  // Generate fees
  const generateFees = (price: number) => {
    const dldFee = Math.round(price * 0.04);
    const admin = 4000;
    return [
      {
        date: "2026-10-01",
        amount: dldFee + admin,
        description: `DLD 4% (${(dldFee / 1000).toFixed(0)}k) + Oqood/Admin (4k)`,
      },
    ];
  };

  // Apply and save
  const handleApply = () => {
    const finalPrice = Number(configuredPrice) || 1500000;
    const finalArea = Number(configuredArea) || 750;
    const finalHandover = configuredHandover || "2028-12";

    const updated: OfferData = {
      id: targetOptionIndex === 0 ? "offer-a" : "offer-b",
      projectName: configuredProjectName || "Selected Off-Plan Project",
      developerName: configuredDeveloper || "Developer",
      community: configuredCommunity || "Dubai",
      unitType: configuredUnitTypeLabel || "1 Bedroom",
      areaSqft: finalArea,
      contractPrice: finalPrice,
      expectedHandover: finalHandover,
      assignmentPolicy: "allowed",
      minPaidPercentForNoc: Number(configuredNocPct) || 34,
      paymentMilestones: generateMilestones(finalPrice, finalHandover),
      fees: generateFees(finalPrice),
      cmaReadySales: readyComps.length > 0 ? readyComps : currentOffer.cmaReadySales,
    };

    onApplyOffer(targetOptionIndex, updated);
    onClose();
  };

  if (!isOpen) return null;

  const optionLabel = targetOptionIndex === 0 ? "Option A" : "Option B";
  const currentPsf = configuredArea > 0 ? Math.round(configuredPrice / configuredArea) : 0;
  const spreadVsReady =
    readyMedianPsf > 0 && currentPsf > 0
      ? (((currentPsf - readyMedianPsf) / readyMedianPsf) * 100).toFixed(1)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white text-slate-900 w-full max-w-5xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col relative">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/80">
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                  {optionLabel} Configurator
                </span>
                <span className="text-xs text-slate-500 font-mono">DLD Database (3,039 Projects)</span>
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                Выбор проекта из базы DLD для {optionLabel}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveTab("catalog")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "catalog"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Каталог DLD
              </button>
              <button
                onClick={() => setActiveTab("manual")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "manual"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Ручная настройка
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "catalog" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Search & Project List (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по названию (Address, Creek, Emaar, Sobha, Danube...)"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Area Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                  <button
                    onClick={() => setSelectedArea("")}
                    className={`px-3 py-1 rounded-xl whitespace-nowrap transition-all font-semibold ${
                      selectedArea === ""
                        ? "bg-sky-50 text-sky-700 border border-sky-200 font-bold"
                        : "bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200"
                    }`}
                  >
                    Все районы
                  </button>
                  {popularAreas.map((area) => (
                    <button
                      key={area}
                      onClick={() => setSelectedArea(area === selectedArea ? "" : area)}
                      className={`px-3 py-1 rounded-xl whitespace-nowrap transition-all font-semibold ${
                        selectedArea === area
                          ? "bg-sky-50 text-sky-700 border border-sky-200 font-bold"
                          : "bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200"
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>

                {/* Project List */}
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {isLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
                      <RefreshCw className="h-6 w-6 animate-spin text-sky-600" />
                      <span className="text-xs">Поиск проектов в базе DLD...</span>
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Проекты не найдены. Попробуйте изменить поисковый запрос.
                    </div>
                  ) : (
                    projects.map((proj) => {
                      const isProjSelected = selectedProjectId === proj.id;
                      return (
                        <div
                          key={proj.id}
                          onClick={() => handleSelectProject(proj)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
                            isProjSelected
                              ? "bg-sky-50/60 border-sky-500 ring-1 ring-sky-500/20 shadow-sm"
                              : "bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300 shadow-sm"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                  {proj.developerName}
                                </span>
                                {proj.dldProjectId && (
                                  <span className="text-[9px] font-mono text-slate-500">
                                    DLD #{proj.dldProjectId}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                                {proj.nameEn}
                              </h4>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-sky-600" />
                                  {proj.areaName}
                                </span>
                                {proj.expectedHandoverDate && (
                                  <span>&bull; Сдача: {proj.expectedHandoverDate.substring(0, 7)}</span>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {proj.minPriceAed ? (
                                <>
                                  <div className="text-xs font-mono font-bold text-slate-900">
                                    от {formatAED(proj.minPriceAed)}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    {proj.unitCount} {proj.unitCount === 1 ? "юнит" : "планировок"}
                                  </div>
                                </>
                              ) : (
                                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  DLD Active
                                </span>
                              )}

                              {proj.constructionProgressPct !== null && (
                                <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] font-mono text-slate-500">
                                  <span>{proj.constructionProgressPct.toFixed(0)}% готово</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Project Configuration & Unit Selector (5 cols) */}
              <div className="lg:col-span-5 bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div className="flex items-center space-x-2">
                      <Sliders className="h-4 w-4 text-sky-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Параметры юнита для {optionLabel}
                      </span>
                    </div>
                    {isFetchingDetail && (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-600" />
                    )}
                  </div>

                  {selectedProjectDetail ? (
                    <div className="mt-4 space-y-4">
                      {/* Project Header Info */}
                      <div>
                        <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">
                          Выбранный объект
                        </span>
                        <h3 className="text-base font-black text-slate-900 mt-0.5">
                          {configuredProjectName}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {configuredDeveloper} &bull; {configuredCommunity}
                        </p>
                      </div>

                      {/* Unit Types Selector (if available) */}
                      {selectedProjectDetail.unitTypes && selectedProjectDetail.unitTypes.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-slate-700">
                            Планировка из базы DLD Oqood:
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {selectedProjectDetail.unitTypes.map((u: any) => {
                              const isSelected = selectedUnitType?.id === u.id;
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => handleUnitTypeChange(u)}
                                  className={`p-2 rounded-xl text-left border transition-all text-xs ${
                                    isSelected
                                      ? "bg-white border-2 border-sky-600 text-slate-900 font-bold shadow-sm"
                                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                                  }`}
                                >
                                  <div className="font-bold text-[11px] truncate">
                                    {u.unitTypeLabel || `${u.bedrooms || 1}BR`}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    {u.listPriceAed ? formatAED(u.listPriceAed) : "Рыночная"}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Pricing & Area Inputs */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">
                            Контрактная цена (AED)
                          </label>
                          <input
                            type="number"
                            value={configuredPrice}
                            onChange={(e) => setConfiguredPrice(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">
                            Площадь (sq.ft)
                          </label>
                          <input
                            type="number"
                            value={configuredArea}
                            onChange={(e) => setConfiguredArea(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                          />
                        </div>
                      </div>

                      {/* Handover & NOC Inputs */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">
                            Срок сдачи (ГГГГ-ММ)
                          </label>
                          <input
                            type="text"
                            value={configuredHandover}
                            onChange={(e) => setConfiguredHandover(e.target.value)}
                            placeholder="2028-12"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">
                            NOC Порог переуступки (%)
                          </label>
                          <input
                            type="number"
                            value={configuredNocPct}
                            onChange={(e) => setConfiguredNocPct(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                          />
                        </div>
                      </div>

                      {/* Live DLD Benchmark Card */}
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5 shadow-sm">
                        <div className="flex items-center justify-between text-slate-600 text-[11px]">
                          <span>Цена за кв. фут:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatAED(currentPsf)}/sqft
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 text-[11px]">
                          <span>Медиана готового рынка ({configuredCommunity}):</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatAED(readyMedianPsf)}/sqft
                          </span>
                        </div>
                        {spreadVsReady && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                            <span className="text-slate-600">Дисконт к готовому:</span>
                            <span
                              className={`font-mono font-bold ${
                                Number(spreadVsReady) <= 0
                                  ? "text-emerald-700"
                                  : "text-amber-700"
                              }`}
                            >
                              {Number(spreadVsReady) <= 0
                                ? `${Math.abs(Number(spreadVsReady))}% Discount`
                                : `+${spreadVsReady}% Premium`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-500 space-y-2">
                      <Layers className="h-8 w-8 mx-auto text-slate-400" />
                      <p className="text-xs">
                        Выберите проект из списка слева, чтобы подтянуть данные из реестра DLD.
                      </p>
                    </div>
                  )}
                </div>

                {/* Apply Button */}
                <button
                  type="button"
                  disabled={!selectedProjectDetail}
                  onClick={handleApply}
                  className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-sm ${
                    selectedProjectDetail
                      ? "bg-slate-900 hover:bg-slate-800 text-white active:scale-95 cursor-pointer"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Применить для {optionLabel}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Tab 2: Manual Edit Form */
            <div className="max-w-2xl mx-auto space-y-5 py-2">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Здесь вы можете вручную отредактировать любые параметры карточки {optionLabel} (название, цену, сроки сдачи, застройщика).
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Название проекта</label>
                  <input
                    type="text"
                    value={configuredProjectName}
                    onChange={(e) => setConfiguredProjectName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Застройщик</label>
                  <input
                    type="text"
                    value={configuredDeveloper}
                    onChange={(e) => setConfiguredDeveloper(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Район / Community</label>
                  <input
                    type="text"
                    value={configuredCommunity}
                    onChange={(e) => setConfiguredCommunity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Тип юнита (Unit Type)</label>
                  <input
                    type="text"
                    value={configuredUnitTypeLabel}
                    onChange={(e) => setConfiguredUnitTypeLabel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Контрактная цена (AED)</label>
                  <input
                    type="number"
                    value={configuredPrice}
                    onChange={(e) => setConfiguredPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Площадь (sq.ft)</label>
                  <input
                    type="number"
                    value={configuredArea}
                    onChange={(e) => setConfiguredArea(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Срок сдачи (ГГГГ-ММ)</label>
                  <input
                    type="text"
                    value={configuredHandover}
                    onChange={(e) => setConfiguredHandover(e.target.value)}
                    placeholder="2028-12"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Порог NOC (%)</label>
                  <input
                    type="number"
                    value={configuredNocPct}
                    onChange={(e) => setConfiguredNocPct(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
                >
                  Сохранить для {optionLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
