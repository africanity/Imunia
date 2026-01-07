import { AlertTriangle, Syringe } from "lucide-react";
import StatCard from "@/app/dashboard/components/StatCard";
import type { StockStats } from "../types";

type StatsCardsProps = {
  stats: StockStats;
  loading: boolean;
};

export function StatsCards({ stats, loading }: StatsCardsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <StatCard
        title="Total de doses"
        value={stats.totalQuantity.toLocaleString("fr-FR")}
        icon={Syringe}
        accent="emerald"
        loading={loading}
      />
      <StatCard
        title="Stocks faibles"
        value={stats.lowStockCount}
        icon={AlertTriangle}
        accent="red"
        loading={loading}
      />
      <StatCard
        title="Lots expirés"
        value={loading ? "…" : stats.expiredLots.toLocaleString("fr-FR")}
        icon={AlertTriangle}
        accent="red"
        loading={loading}
      />
    </div>
  );
}
