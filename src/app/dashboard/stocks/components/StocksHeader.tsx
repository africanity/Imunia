import { Plus } from "lucide-react";

type Tab = "stocks" | "pending-received" | "pending-sent" | "history";

type StocksHeaderProps = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onCreateClick: () => void;
  showCreateButton?: boolean;
  title: string;
  description: string;
  userRole?: string | null;
};

export function StocksHeader({
  activeTab,
  onTabChange,
  onCreateClick,
  showCreateButton = false,
  title,
  description,
  userRole,
}: StocksHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {userRole !== "SUPERADMIN" && (
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      )}

      {/* Boutons d'action et onglets */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {/* Bouton Nouveau lot */}
        {showCreateButton && activeTab === "stocks" && (
          <button
            type="button"
            onClick={onCreateClick}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Nouveau lot
          </button>
        )}

        {/* Onglets */}
        <div className="border-b border-slate-200 md:border-b-0">
          <nav className="-mb-px flex space-x-4">
            <button
              type="button"
              onClick={() => onTabChange("stocks")}
              className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                activeTab === "stocks"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              Stocks
            </button>
            <button
              type="button"
              onClick={() => onTabChange("pending-sent")}
              className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                activeTab === "pending-sent"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              Envois en cours
            </button>
            <button
              type="button"
              onClick={() => onTabChange("history")}
              className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                activeTab === "history"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              Historique
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
