import { Search } from "lucide-react";
import type { TransferHistoryItem } from "../types";
import { formatEntityName } from "../utils";

type HistoryTableProps = {
  history: TransferHistoryItem[];
  loading: boolean;
  filters: {
    vaccineId: string;
    fromType: string;
    toType: string;
    sentStartDate: string;
    sentEndDate: string;
    confirmedStartDate: string;
    confirmedEndDate: string;
    search: string;
  };
  onFiltersChange: (filters: HistoryTableProps["filters"]) => void;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onFilter: () => void;
};

export function HistoryTable({
  history,
  loading,
  filters,
  onFiltersChange,
  page,
  totalPages,
  total,
  onPageChange,
  onFilter,
}: HistoryTableProps) {
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Historique des envois</h3>
          <p className="text-sm text-slate-500">Tous les transferts de stock confirmés</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="w-[180px]">
            <label className="mb-1 block text-xs font-medium text-slate-600">Rechercher</label>
            <input
              type="text"
              placeholder="Rechercher..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          {/* Bloc Date d'envoi */}
          <div className="w-[280px] rounded-xl border-2 border-blue-200 bg-blue-50/30 p-3">
            <label className="mb-2 block text-xs font-semibold text-blue-700">Date d&apos;envoi</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Du</label>
                <input
                  type="date"
                  value={filters.sentStartDate}
                  onChange={(e) => handleFilterChange("sentStartDate", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Au</label>
                <input
                  type="date"
                  value={filters.sentEndDate}
                  onChange={(e) => handleFilterChange("sentEndDate", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            </div>
          </div>

          {/* Bloc Date de confirmation/annulation */}
          <div className="w-[280px] rounded-xl border-2 border-green-200 bg-green-50/30 p-3">
            <label className="mb-2 block text-xs font-semibold text-green-700">
              Date de confirmation/annulation
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Du</label>
                <input
                  type="date"
                  value={filters.confirmedStartDate}
                  onChange={(e) => handleFilterChange("confirmedStartDate", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Au</label>
                <input
                  type="date"
                  value={filters.confirmedEndDate}
                  onChange={(e) => handleFilterChange("confirmedEndDate", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            </div>
          </div>

          <div className="w-[140px]">
            <label className="mb-1 block text-xs font-medium text-slate-600">Expéditeur</label>
            <select
              value={filters.fromType}
              onChange={(e) => handleFilterChange("fromType", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">Tous expéditeurs</option>
              <option value="NATIONAL">National</option>
              <option value="REGIONAL">Régional</option>
              <option value="DISTRICT">District</option>
              <option value="HEALTHCENTER">Centre de santé</option>
            </select>
          </div>
          <div className="w-[140px]">
            <label className="mb-1 block text-xs font-medium text-slate-600">Destinataire</label>
            <select
              value={filters.toType}
              onChange={(e) => handleFilterChange("toType", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">Tous destinataires</option>
              <option value="REGIONAL">Régional</option>
              <option value="DISTRICT">District</option>
              <option value="HEALTHCENTER">Centre de santé</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={onFilter}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              <Search className="h-4 w-4" />
              Filtrer
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
          <p className="mt-4 text-sm font-medium text-slate-900">Aucun historique</p>
          <p className="mt-2 text-sm text-slate-500">Aucun transfert confirmé pour le moment.</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Vaccin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Expéditeur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Destinataire
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Quantité
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Date envoi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Confirmation/annulation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Expiration lot
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {history.map((item) => {
                  const sentDate = new Date(item.sentAt);
                  const confirmedDate = item.confirmedAt ? new Date(item.confirmedAt) : null;
                  const expirationDate = item.lotExpiration ? new Date(item.lotExpiration) : null;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-900">{item.vaccineName}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {formatEntityName(item.fromType, item.fromName)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {formatEntityName(item.toType, item.toName)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {item.quantity.toLocaleString("fr-FR")} doses
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {sentDate.toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {confirmedDate
                          ? confirmedDate.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {expirationDate
                          ? expirationDate.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            item.status === "CONFIRMED"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {item.status === "CONFIRMED" ? "Confirmé" : "Annulé"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-6 py-4">
              <div className="text-sm text-slate-700">
                Page {page} sur {totalPages} ({total} résultats)
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
