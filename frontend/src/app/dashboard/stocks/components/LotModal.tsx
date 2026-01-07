import { Trash2 } from "lucide-react";
import type { LotItem, LotModalContext } from "../types";
import { formatExpirationDate, isDateExpired } from "../utils";

type LotModalProps = {
  isOpen: boolean;
  onClose: () => void;
  lotContext: LotModalContext | null;
  lotItems: LotItem[];
  lotTotalRemaining: number;
  lotLoading: boolean;
  lotError: string | null;
  lotDeletingId: string | null;
  onDeleteLot: (lotId: string) => void;
  userRole?: string | null;
  ownerLabel?: string | null;
};

export function LotModal({
  isOpen,
  onClose,
  lotContext,
  lotItems,
  lotTotalRemaining,
  lotLoading,
  lotError,
  lotDeletingId,
  onDeleteLot,
  userRole,
  ownerLabel,
}: LotModalProps) {
  if (!isOpen || !lotContext) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4">
      <div className="w-full max-w-[95vw] md:max-w-4xl rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Lots du vaccin {lotContext.vaccineName}
              {ownerLabel && <span className="text-slate-500"> — {ownerLabel}</span>}
            </h3>
            <p className="text-sm text-slate-500">
              Historique des lots ajoutés et envoyés. Les lots expirés peuvent être retirés pour mettre à jour les stocks.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Fermer
          </button>
        </div>

        {lotError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {lotError}
          </div>
        )}

        <div className="mt-4 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200">
          {lotLoading ? (
            <div className="flex items-center justify-center px-6 py-10 text-sm text-slate-500">
              Chargement des lots…
            </div>
          ) : lotItems.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              Aucun lot enregistré pour ce vaccin.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Lot
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Expiration
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Quantité
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Restant
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Distribué
                  </th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lotItems.map((lot) => {
                  const expired = lot.status === "EXPIRED" || isDateExpired(lot.expiration);
                  return (
                    <tr
                      key={lot.id}
                      className={expired ? "bg-red-50/70 hover:bg-red-50" : "hover:bg-slate-50/80"}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{lot.id}</div>
                        {lot.sourceLotId && (
                          <div className="text-xs text-slate-500">
                            Issu du lot {lot.sourceLotId}
                          </div>
                        )}
                        {lot.derivedCount > 0 && (
                          <div className="text-xs text-slate-400">
                            {lot.derivedCount} lot(s) dérivé(s)
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            expired ? "font-medium text-red-600" : "font-medium text-slate-700"
                          }
                        >
                          {formatExpirationDate(lot.expiration)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {lot.quantity.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {lot.remainingQuantity.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {lot.distributedQuantity.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            expired
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {expired ? "Expiré" : "Valide"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end">
                          {(userRole === "SUPERADMIN" || userRole === "NATIONAL" || expired) && (
                            <button
                              type="button"
                              onClick={() => onDeleteLot(lot.id)}
                              disabled={lotDeletingId === lot.id}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <Trash2 className="h-4 w-4" />
                              {lotDeletingId === lot.id ? "Suppression…" : "Supprimer"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <div>
            Total restant{ownerLabel ? ` dans ${ownerLabel}` : ""} :{" "}
            <span className="font-semibold text-slate-800">
              {lotTotalRemaining.toLocaleString("fr-FR")} dose(s)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
