"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ShieldCheck,
  FileText,
  Search,
  Activity,
  Layers,
  Calculator,
  FileSpreadsheet,
  Video,
  Sparkles,
  Menu,
  X,
  User,
  Clock,
} from "lucide-react";

interface HeaderProps {
  onOpenPrintPreview?: () => void;
  activePhase?: string;
}

const NAV_ITEMS = [
  { href: "/", label: "Desk", icon: ShieldCheck },
  { href: "/discover", label: "Catalog", icon: Search },
  { href: "/studio", label: "Studio", icon: Video },
  { href: "/reports", label: "Dossiers", icon: FileText },
  { href: "/developers", label: "Developers", icon: Building2 },
  { href: "/imports", label: "Imports", icon: FileSpreadsheet },
  { href: "/alternatives", label: "Alternatives", icon: Layers },
  { href: "/funding", label: "Funding & Exit", icon: Calculator },
  { href: "/data-health", label: "Data Health", icon: Activity },
];

export function Header({ onOpenPrintPreview, activePhase }: HeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 py-2.5 no-print transition-all shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <Link href="/" className="flex items-center space-x-3 group shrink-0">
          <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm ring-1 ring-slate-800/10 group-hover:scale-105 transition-all">
            <Building2 className="h-5 w-5 text-sky-400 font-bold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                OffPlan<span className="text-sky-600">Desk</span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  DLD Verified
                </span>
              </h1>
            </div>
            <p className="text-[10px] text-slate-500 hidden sm:block truncate font-medium">
              DuckDB Analytics &bull; 48h SLA &bull; Dual RU/AR Studio
            </p>
          </div>
        </Link>

        {/* Desktop Navigation Dock */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-white text-sky-700 shadow-sm border border-slate-200/70"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-sky-600" : "text-slate-500"}`} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          {/* Analyst profile chip */}
          <div className="hidden xl:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div className="w-6 h-6 rounded-lg bg-sky-600 flex items-center justify-center text-white text-[11px] font-bold">
              M
            </div>
            <div className="text-left">
              <div className="text-slate-900 font-semibold text-[11px] leading-tight">Mokhamed</div>
              <div className="text-[9px] text-slate-500 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Desk Analyst
              </div>
            </div>
          </div>

          {/* PDF Button — shown when onOpenPrintPreview is passed */}
          {onOpenPrintPreview && (
            <button
              onClick={onOpenPrintPreview}
              className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm ring-1 ring-slate-900/10 transition-all active:scale-95"
            >
              <FileText className="h-4 w-4 text-sky-400" />
              <span className="hidden sm:inline">Generate Client PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-1.5 pb-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                  isActive
                    ? "bg-sky-50 text-sky-700 border border-sky-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
