"use client";

import { X } from "lucide-react";

interface AppointmentCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  affectedAppointments: number;
  actionType: "delete" | "reduce" | "deleteStock" | "deleteLot" | "deleteVaccine";
  isLoading?: boolean;
  entityName?: string;
}

export function AppointmentCancellationModal({
  isOpen,
  onClose,
  onConfirm,
  affectedAppointments,
  actionType,
  isLoading = false,
  entityName,
}: AppointmentCancellationModalProps) {
  if (!isOpen) return null;

  const getActionText = () => {
    switch (actionType) {
      case "deleteVaccine":
        return "supprimer ce vaccin";
      case "deleteStock":
        return "supprimer ce stock";
      case "deleteLot":
        return "supprimer ce lot";
      case "reduce":
        return "réduire ce lot";
      default:
        return "effectuer cette action";
    }
  };

  const getTitle = () => {
    switch (actionType) {
      case "deleteVaccine":
        return "Suppression du vaccin";
      case "deleteStock":
        return "Suppression du stock";
      case "deleteLot":
        return "Suppression du lot";
      case "reduce":
        return "Réduction du lot";
      default:
        return "Action requise";
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-amber-50 to-amber-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {getTitle()}
            </h3>
            {entityName && (
              <p className="text-sm text-slate-600 mt-1">{entityName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex-shrink-0 rounded-full bg-amber-100 p-3">
              <svg
                className="h-6 w-6 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 mb-2">
                Attention : Cette action annulera {affectedAppointments} rendez-vous
                {affectedAppointments > 1 ? "s" : ""}.
              </p>
              <p className="text-sm text-slate-600">
                Si vous confirmez {getActionText()}, {affectedAppointments} rendez-vous
                {affectedAppointments > 1 ? " seront" : " sera"} automatiquement annulé
                {affectedAppointments > 1 ? "s" : ""} et les parents seront notifiés par
                l&apos;application mobile.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
            >
              {isLoading ? "Traitement..." : "Confirmer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
