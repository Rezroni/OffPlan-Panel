"use client";

import React from "react";
import {
  History,
  TrendingUp,
  TrendingDown,
  Calendar,
  Building,
  Hash,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Tag,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import type { ProjectTransactionItem, ProjectTransactionsResult } from "@/domain/catalog/types";

type Props = {
  bedrooms: number | null;
  projectName: string;
  transactionsResult: ProjectTransactionsResult | null;
  loading?: boolean;
};

const formatAed = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `AED ${m.toFixed(2)}M`;
  }
  if (v >= 1_000) {
    return `AED ${Math.round(v / 1_000)}k`;
  }
  return `AED ${Math.round(v).toLocaleString("en-US")}`;
};

const formatFullAed = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  return `AED ${Math.round(v).toLocaleString("en-US")}`;
};

const formatPsf = (v: number | null | undefined) => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return `${Math.round(v).toLocaleString("en-US")} AED/sqft`;
};

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-AE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const bedroomLabel = (br: number | null | undefined) => {
  if (br === null || br === undefined) return "Format";
  if (br === 0) return "Studio";
  return `${br}BR`;
};

export function RecentTransactionsSection({
  bedrooms,
  projectName,
  transactionsResult,
  loading = false,
}: Props) {
  const brLabel = bedroomLabel(bedrooms);
  const totalCount = transactionsResult?.totalCount ?? 0;
  const transactions = transactionsResult?.transactions ?? [];
  const firstDeal = transactionsResult?.firstDeal;
  const latestDeal = transactionsResult?.latestDeal;
  const priceChangePct = transactionsResult?.priceChangePct;
  const avgPsf = transactionsResult?.avgPricePerSqft;

  // Russian pluralization helper for deals count
  const getDealsPluralRu = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return "сделок";
    if (mod10 === 1) return "сделка";
    if (mod10 >= 2 && mod10 <= 4) return "сделки";
    return "сделок";
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                <History className="h-4 w-4" />
              </div>
              <h2 className="font-bold text-slate-900 text-base">
                DLD Recent Transactions &amp; Price History
              </h2>
            </div>

            {/* Bedroom tag */}
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-white">
              {brLabel}
            </span>

            {/* Dynamic Counter badge */}
            {totalCount > 5 ? (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                Показаны последние 5 из {totalCount} {getDealsPluralRu(totalCount)} DLD
              </span>
            ) : totalCount > 0 ? (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                {totalCount === 1
                  ? "Показана 1 зарегистрированная сделка DLD"
                  : `Показаны все ${totalCount} ${getDealsPluralRu(totalCount)} DLD`}
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                0 сделок в DLD
              </span>
            )}

            {loading && (
              <span className="text-[11px] font-medium text-sky-600 animate-pulse">
                Обновление данных...
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-1">
            Официальные зарегистрированные сделки в Dubai Land Department для планировки{" "}
            <strong className="text-indigo-700 font-semibold">{brLabel}</strong> в проекте{" "}
            <strong className="text-slate-800">{projectName}</strong>
          </p>
        </div>
      </div>

      {/* When deals exist: Summary Metric Strip */}
      {totalCount > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Latest Deal Price */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Последняя цена продажи
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-slate-900 font-mono">
                {formatAed(latestDeal?.transactionValueAed)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 border-t border-slate-200/50">
              <span>{formatDate(latestDeal?.transactionDate)}</span>
              <span className="font-mono">{formatPsf(latestDeal?.pricePerSqftAed)}</span>
            </div>
          </div>

          {/* Card 2: First Oqood Deal Price */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Первая цена Oqood (Launch)
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-slate-900 font-mono">
                {formatAed(firstDeal?.transactionValueAed)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 border-t border-slate-200/50">
              <span>{formatDate(firstDeal?.transactionDate)}</span>
              <span className="font-mono">{formatPsf(firstDeal?.pricePerSqftAed)}</span>
            </div>
          </div>

          {/* Card 3: Price Growth / Capital Appreciation */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Динамика цены (First &rarr; Latest)
            </span>
            <div className="flex items-center gap-1.5">
              {priceChangePct !== null && priceChangePct !== undefined ? (
                <>
                  <span
                    className={`text-lg font-bold font-mono ${
                      priceChangePct > 0
                        ? "text-emerald-700"
                        : priceChangePct < 0
                        ? "text-rose-700"
                        : "text-slate-700"
                    }`}
                  >
                    {priceChangePct > 0 ? `+${priceChangePct}%` : `${priceChangePct}%`}
                  </span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      priceChangePct > 0
                        ? "bg-emerald-100 text-emerald-800"
                        : priceChangePct < 0
                        ? "bg-rose-100 text-rose-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {priceChangePct >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-0.5" />
                    )}
                    {priceChangePct >= 0 ? "Прирост" : "Снижение"}
                  </span>
                </>
              ) : (
                <span className="text-sm font-semibold text-slate-600">—</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 pt-0.5 border-t border-slate-200/50 truncate">
              {firstDeal && latestDeal && firstDeal.transactionValueAed > 0 ? (
                <span>
                  &Delta;{" "}
                  {formatAed(latestDeal.transactionValueAed - firstDeal.transactionValueAed)} c момента старта
                </span>
              ) : (
                <span>1 зафиксированная сделка</span>
              )}
            </div>
          </div>

          {/* Card 4: Average PSF in Project */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Средняя цена за кв. фут
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-slate-900 font-mono">
                {formatPsf(avgPsf)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 border-t border-slate-200/50">
              <span>Всего в реестре:</span>
              <span className="font-semibold text-slate-800">
                {totalCount} {getDealsPluralRu(totalCount)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table / List */}
      {transactions.length > 0 ? (
        <div className="overflow-hidden border border-slate-200 rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Дата сделки</th>
                  <th className="px-4 py-3">Сумма сделки (AED)</th>
                  <th className="px-4 py-3">Цена за кв. фут</th>
                  <th className="px-4 py-3">Площадь</th>
                  <th className="px-4 py-3">Тип сделки</th>
                  <th className="px-4 py-3">Здание / Юнит</th>
                  <th className="px-4 py-3 text-right">DLD Регистрация</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {transactions.map((tx, idx) => {
                  const isPreReg =
                    (tx.transactionType &&
                      tx.transactionType.toLowerCase().includes("pre registration")) ||
                    tx.isOffPlan === true;
                  const isResale =
                    tx.transactionType &&
                    (tx.transactionType.toLowerCase() === "sell" ||
                      tx.transactionType.toLowerCase().includes("resale"));

                  return (
                    <tr
                      key={tx.id || idx}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Date */}
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{formatDate(tx.transactionDate)}</span>
                          {idx === 0 && (
                            <span className="text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded shrink-0">
                              Latest
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Value AED */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-slate-900">
                        <span title={formatFullAed(tx.transactionValueAed)}>
                          {formatFullAed(tx.transactionValueAed)}
                        </span>
                      </td>

                      {/* Price Per Sqft */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-medium text-slate-800">
                        {formatPsf(tx.pricePerSqftAed)}
                      </td>

                      {/* Area */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-slate-900 font-semibold">
                          {tx.areaSqft ? `${Math.round(tx.areaSqft).toLocaleString("en-US")} sqft` : "—"}
                        </div>
                        {tx.areaSqm ? (
                          <div className="text-[10px] text-slate-400">
                            {tx.areaSqm.toFixed(1)} m²
                          </div>
                        ) : null}
                      </td>

                      {/* Type Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isPreReg ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200">
                            <ShieldCheck className="h-3 w-3 text-sky-600" />
                            Oqood (Pre-reg)
                          </span>
                        ) : isResale ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Tag className="h-3 w-3 text-emerald-600" />
                            Secondary (Resale)
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {tx.transactionType || "Sell"}
                          </span>
                        )}
                      </td>

                      {/* Building / Unit */}
                      <td className="px-4 py-3 max-w-xs truncate">
                        <div className="text-slate-800 font-medium truncate" title={tx.buildingNameEn || "—"}>
                          {tx.buildingNameEn || projectName}
                        </div>
                        {tx.unitNo && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Unit: {tx.unitNo}
                          </div>
                        )}
                      </td>

                      {/* DLD Ref */}
                      <td className="px-4 py-3 text-right whitespace-nowrap font-mono text-slate-500 text-[11px]">
                        <span className="bg-slate-100 px-2 py-1 rounded text-[11px] font-mono border border-slate-200">
                          {tx.transactionNo || tx.id}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer notification */}
          <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>
                {totalCount > 5
                  ? `Показаны последние 5 сделок из ${totalCount} зарегистрированных в DLD для ${brLabel}.`
                  : `Отображаются все ${totalCount} сделки, зафиксированные в официальном реестре DLD.`}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Источник: Dubai Land Department (DLD Verified Feed)
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center space-y-2">
          <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
            <History className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">
            Сделок для {brLabel} в DLD пока не найдено
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Для данного формата ({brLabel}) в проекте <strong>{projectName}</strong> в Dubai Land
            Department еще нет зарегистрированных сделок или застройщик еще не открыл первичную
            регистрацию договоров Oqood.
          </p>
        </div>
      )}
    </div>
  );
}
