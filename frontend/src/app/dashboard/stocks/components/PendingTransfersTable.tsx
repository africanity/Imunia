import { CheckCircle, X } from "lucide-react";
import type { PendingTransfer } from "../types";
import { formatEntityName } from "../utils";

type PendingTransfersTableProps = {
  transfers: PendingTransfer[];
  loading: boolean;
  onConfirm: (transferId: string) => void;
  onReject: (transferId: string) => void;
  confirmingId: string | null;
  rejectingId: string | null;
  isReceived?: boolean;
};

export function PendingTransfersTable({
  transfers,
  loading,
  onConfirm,
  onReject,
  confirmingId,
  rejectingId,
  isReceived = false,
}: PendingTransfersTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></div>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
        <p className="mt-4 text-sm font-medium text-slate-900">
          Aucun envoi {isReceived ? "en attente" : "en cours"}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {isReceived
            ? "Vous n'avez aucun transfert en attente de confirmation."
            : "Vous n'avez aucun transfert en attente de confirmation."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-hidden rounded-2xl md:rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
              Vaccin
            </th>
            <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
              {isReceived ? "Expéditeur" : "Destinataire"}
            </th>
            <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
              Quantité
            </th>
            <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
              Date d&apos;envoi
            </th>
            <th className="px-2 md:px-6 py-1.5 md:py-3 text-right text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {transfers.map((transfer) => {
            const sentDate = new Date(transfer.createdAt);
            return (
              <tr key={transfer.id} className="hover:bg-slate-50">
                <td className="px-2 md:px-6 py-2 md:py-4">
                  <div className="text-xs md:text-sm font-medium text-slate-900">
                    {transfer.vaccine?.name ?? "Vaccin inconnu"}
                  </div>
                </td>
                <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-700">
                  {isReceived
                    ? formatEntityName(transfer.fromType, transfer.fromName)
                    : formatEntityName(transfer.toType, transfer.toName)}
                </td>
                <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-700">
                  {transfer.quantity.toLocaleString("fr-FR")} doses
                </td>
                <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-600">
                  {sentDate.toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-2 md:px-6 py-2 md:py-4">
                  <div className="flex justify-end gap-1 md:gap-2">
                    {isReceived ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onReject(transfer.id)}
                          disabled={rejectingId === transfer.id}
                          className="flex items-center gap-1 md:gap-2 rounded-lg md:rounded-xl border border-red-200 bg-red-50 px-2 md:px-4 py-1 md:py-2 text-[10px] md:text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                        >
                          {rejectingId === transfer.id ? (
                            <>
                              <div className="h-3 w-3 md:h-4 md:w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                              <span className="hidden sm:inline">Refus...</span>
                              <span className="sm:hidden">...</span>
                            </>
                          ) : (
                            <>
                              <X className="h-3 w-3 md:h-4 md:w-4" />
                              <span className="hidden sm:inline">Refuser</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onConfirm(transfer.id)}
                          disabled={confirmingId === transfer.id}
                          className="flex items-center gap-1 md:gap-2 rounded-lg md:rounded-xl bg-emerald-600 px-2 md:px-4 py-1 md:py-2 text-[10px] md:text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {confirmingId === transfer.id ? (
                            <>
                              <div className="h-3 w-3 md:h-4 md:w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              <span className="hidden sm:inline">Confirmation...</span>
                              <span className="sm:hidden">...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3 md:h-4 md:w-4" />
                              <span className="hidden sm:inline">Confirmer</span>
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onReject(transfer.id)}
                        disabled={rejectingId === transfer.id}
                        className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        {rejectingId === transfer.id ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                            Annulation...
                          </>
                        ) : (
                          <>
                            <X className="h-4 w-4" />
                            Annuler
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
