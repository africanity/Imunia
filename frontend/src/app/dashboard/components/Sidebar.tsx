"use client";

import {
  LayoutDashboard,
  Users,
  Calendar,
  Syringe,
  MapPinned,
  Package,
  CalendarCheck,
  Lightbulb,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import LogoPreview from "@/app/components/LogoPreview";
import { useSystemSettings } from "@/contexts/SystemSettingsContext";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useMemo } from "react";

type SidebarProps = {
  active?: string;
};

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Régions", href: "/dashboard/regions", icon: MapPinned },
  { label: "Régionaux", href: "/dashboard/regionaux", icon: Users },
  { label: "Campagnes", href: "/dashboard/campagnes", icon: Calendar },
  { label: "Conseils", href: "/dashboard/conseils", icon: Lightbulb },
  { label: "Stocks & lots", href: "/dashboard/stocks", icon: Package },
  { label: "Vaccins", href: "/dashboard/vaccins", icon: Syringe },
  { label: "Calendrier vaccinal", href: "/dashboard/calendrier", icon: Calendar },
  { label: "Rendez-vous", href: "/dashboard/rendezvous", icon: CalendarCheck },
  { label: "Enfants", href: "/dashboard/enfants", icon: Users },
  { label: "Rapports", href: "/dashboard/rapports", icon: FileText },
];

export default function Sidebar({ active = "/dashboard" }: SidebarProps) {
  const { settings } = useSystemSettings();
  const { user } = useAuth();

  const entries = useMemo<NavItem[]>(() => {
    if (!user) {
      return navItems;
    }

    if (user.role === "REGIONAL") {
      return [
        { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
        { label: "Districts", href: "/dashboard/districts", icon: MapPinned },
        { label: "Communes", href: "/dashboard/communes", icon: MapPinned },
        { label: "Agents de district", href: "/dashboard/regionaux", icon: Users },
        { label: "Campagnes", href: "/dashboard/campagnes", icon: Calendar },
        { label: "Stocks & lots", href: "/dashboard/stocks", icon: Package },
        { label: "Vaccins", href: "/dashboard/vaccins", icon: Syringe },
        { label: "Calendrier vaccinal", href: "/dashboard/calendrier", icon: Calendar },
        { label: "Rendez-vous", href: "/dashboard/rendezvous", icon: CalendarCheck },
        { label: "Enfants", href: "/dashboard/enfants", icon: Users },
        { label: "Rapports", href: "/dashboard/rapports", icon: FileText },
      ];
    }

    if (user.role === "DISTRICT") {
      return [
        { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
        { label: "Centres de santé", href: "/dashboard/centres", icon: MapPinned },
        { label: "Agents", href: "/dashboard/agents", icon: Users },
        { label: "Campagnes", href: "/dashboard/campagnes", icon: Calendar },
        { label: "Stocks & lots", href: "/dashboard/stocks", icon: Package },
        { label: "Vaccins", href: "/dashboard/vaccins", icon: Syringe },
        { label: "Calendrier vaccinal", href: "/dashboard/calendrier", icon: Calendar },
        { label: "Rendez-vous", href: "/dashboard/rendezvous", icon: CalendarCheck },
        { label: "Enfants", href: "/dashboard/enfants", icon: Users },
        { label: "Rapports", href: "/dashboard/rapports", icon: FileText },
      ];
    }

    if (user.role === "AGENT" && user.agentLevel === "ADMIN") {
      return [
        { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
        { label: "Campagnes", href: "/dashboard/campagnes", icon: Calendar },
        { label: "Équipe", href: "/dashboard/equipe", icon: Users },
        { label: "Stocks & lots", href: "/dashboard/stocks", icon: Package },
        { label: "Vaccins", href: "/dashboard/vaccins", icon: Syringe },
        { label: "Calendrier vaccinal", href: "/dashboard/calendrier", icon: Calendar },
        { label: "Rendez-vous", href: "/dashboard/rendezvous", icon: CalendarCheck },
        { label: "Enfants", href: "/dashboard/enfants", icon: Users },
        { label: "Rapports", href: "/dashboard/rapports", icon: FileText },
      ];
    }

    if (user.role === "AGENT") {
      // Pour les agents STAFF, inclure les stocks en lecture seule
      if (user.agentLevel === "STAFF") {
        return [
          { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
          { label: "Rendez-vous", href: "/dashboard/rendezvous", icon: CalendarCheck },
          { label: "Campagnes", href: "/dashboard/campagnes", icon: Calendar },
          { label: "Stocks & lots", href: "/dashboard/stocks", icon: Package },
          { label: "Vaccins", href: "/dashboard/vaccins", icon: Syringe },
          { label: "Calendrier vaccinal", href: "/dashboard/calendrier", icon: Calendar },
          { label: "Enfants", href: "/dashboard/enfants", icon: Users },
          { label: "Rapports", href: "/dashboard/rapports", icon: FileText },
        ];
      }
      // Pour les autres agents (sans niveau spécifique)
      return [
        { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
        { label: "Rendez-vous", href: "/dashboard/rendezvous", icon: CalendarCheck },
        { label: "Campagnes", href: "/dashboard/campagnes", icon: Calendar },
        { label: "Vaccins", href: "/dashboard/vaccins", icon: Syringe },
        { label: "Calendrier vaccinal", href: "/dashboard/calendrier", icon: Calendar },
        { label: "Enfants", href: "/dashboard/enfants", icon: Users },
      ];
    }

    return navItems;
  }, [user]);

  const adminLabel = useMemo(() => {
    if (!user) return "Administration";
    
    switch (user.role) {
      case "NATIONAL":
        return "Administration nationale";
      case "REGIONAL":
        return "Administration régionale";
      case "DISTRICT":
        return "Administration de district";
      case "AGENT":
        return "Centre de santé";
      default:
        return "Administration";
    }
  }, [user]);

  return (
    <aside
      className="fixed left-0 top-0 hidden h-screen w-64 flex-shrink-0 flex-col overflow-y-auto border-r border-slate-800 px-6 py-8 text-white md:flex"
      style={{
        backgroundColor: "var(--sidebar-bg)",
        color: "var(--sidebar-text)",
      }}
    >
      <div className="mb-10 flex items-center gap-3">
        <LogoPreview size="sm" className="!shadow-md" />
        <div>
          <p className="text-lg font-semibold">
            {settings.appName ?? "Imunia"}
          </p>
          <p className="text-xs text-slate-300">{adminLabel}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {entries.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === active;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                  : item.disabled
                    ? "cursor-not-allowed text-slate-500"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
              aria-disabled={item.disabled}
              onClick={(event) => {
                if (item.disabled) {
                  event.preventDefault();
                }
              }}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {item.disabled && (
                <span className="ml-auto text-xs text-slate-500">
                  Bientôt
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

