import { ArrowRightLeft, PackageOpen, Trash2 } from "lucide-react";
import type { NationalStock } from "../types";

type NationalStocksTableProps = {
  stocks: NationalStock[];
  loading: boolean;
  onOpenLots: (stock: NationalStock) => void;
  onTransfer: (stock: NationalStock) => void;
  onUpdate: (stock: NationalStock) => void;
  onDelete: (stock: NationalStock) => void;
  deletingId: string | null;
};

export function NationalStocksTable({
  stocks,
  loading,
  onOpenLots,
  onTransfer,
  onUpdate,
  onDelete,
  deletingId,
}: NationalStocksTableProps) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Vaccin
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Quantité (national)
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Nombre de lots
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {loading ? (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                Chargement des stocks…
              </td>
            </tr>
          ) : stocks.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                Aucun stock national enregistré pour le moment.
              </td>
            </tr>
          ) : (
            stocks.map((stock) => {
              const lotCount = stock.lotCount ?? 0;
              const expiredLotCount = stock.expiredLotCount ?? 0;
              const expiredQuantity = stock.expiredQuantity ?? 0;
              const totalQuantity = stock.quantity ?? 0;
              const validQuantity = totalQuantity - expiredQuantity;
              const validLotCount = lotCount - expiredLotCount;

              // Vérifier si le stock peut être envoyé
              const canSend = lotCount > 0 && validLotCount > 0 && validQuantity > 0;
              const disabledReason =
                lotCount === 0
                  ? "Aucun lot disponible pour ce vaccin"
                  : validLotCount === 0
                    ? "Tous les lots sont expirés"
                    : validQuantity === 0
                      ? "Toutes les quantités sont expirées"
                      : "";

              return (
                <tr key={stock.id} className="hover:bg-slate-50/80">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{stock.vaccine.name}</div>
                    <div className="text-xs text-slate-500">{stock.vaccine.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">
                      {(stock.quantity ?? 0).toLocaleString("fr-FR")}
                      {expiredQuantity > 0 && (
                        <span className="ml-2 text-sm font-normal text-red-600">
                          ({expiredQuantity.toLocaleString("fr-FR")} expiré
                          {expiredQuantity > 1 ? "s" : ""})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {stock.vaccine.dosesRequired} doses requises
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="font-medium text-slate-700">
                      {lotCount} lot{lotCount > 1 ? "s" : ""}
                      {expiredLotCount > 0 && (
                        <span className="ml-2 text-red-600">
                          - {expiredLotCount} expiré{expiredLotCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenLots(stock)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                      >
                        <PackageOpen className="h-4 w-4" />
                        Lots
                      </button>
                      <div className="relative group">
                        <button
                          type="button"
                          onClick={() => canSend && onTransfer(stock)}
                          disabled={!canSend}
                          className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-50"
                          title={!canSend ? disabledReason : undefined}
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                          Envoyer
                        </button>
                        {!canSend && (
                          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10 w-48 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
                            {disabledReason}
                            <div className="absolute top-full right-4 -mt-1 h-2 w-2 rotate-45 bg-slate-900"></div>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onUpdate(stock)}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-100"
                      >
                        Ajuster
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(stock)}
                        disabled={deletingId === stock.id}
                        className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingId === stock.id ? "Suppression…" : "Supprimer"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
