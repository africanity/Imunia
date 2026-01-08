import { PackageOpen } from "lucide-react";
import type { PendingTransfer } from "../types";

type PendingTransfersAlertProps = {
  transfers: PendingTransfer[];
  onViewClick: () => void;
};

export function PendingTransfersAlert({ transfers, onViewClick }: PendingTransfersAlertProps) {
  if (transfers.length === 0) return null;

  return (
    <div className="rounded-3xl border border-blue-200 bg-blue-50/80 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
            <PackageOpen className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">
              {transfers.length} envoi{transfers.length > 1 ? "s" : ""} en attente de confirmation
            </p>
            <p className="text-xs text-blue-700">Veuillez confirmer ou refuser les transferts reçus</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onViewClick}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Voir les envois
        </button>
      </div>
    </div>
  );
}
