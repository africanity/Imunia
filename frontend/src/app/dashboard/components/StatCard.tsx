"use client";

import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "emerald" | "blue" | "purple" | "red" | "orange";
  loading?: boolean;
};

const accentClasses: Record<
  NonNullable<StatCardProps["accent"]>,
  { bg: string; ring: string; icon: string }
> = {
  emerald: {
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/30",
    icon: "text-emerald-600",
  },
  blue: {
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/30",
    icon: "text-blue-600",
  },
  purple: {
    bg: "bg-purple-500/10",
    ring: "ring-purple-500/30",
    icon: "text-purple-600",
  },
  red: {
    bg: "bg-red-500/10",
    ring: "ring-red-500/30",
    icon: "text-red-600",
  },
  orange: {
    bg: "bg-orange-500/10",
    ring: "ring-orange-500/30",
    icon: "text-orange-600",
  },
};

export default function StatCard({
  title,
  value,
  icon: Icon,
  accent = "emerald",
  loading = false,
}: StatCardProps) {
  const accentCfg = accentClasses[accent];
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {loading ? (
              <span className="animate-pulse text-slate-300">•••</span>
            ) : (
              value
            )}
          </p>
        </div>
        <div
          className={`rounded-2xl p-3 ${accentCfg.bg} ring-4 ${accentCfg.ring}`}
        >
          <Icon className={`h-6 w-6 ${accentCfg.icon}`} />
        </div>
      </div>
    </div>
  );
}

