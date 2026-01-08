import { FormEvent } from "react";
import type { VaccineInfo } from "../types";

type CreateStockModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  availableVaccines: VaccineInfo[];
  selectedVaccineId: string;
  onVaccineChange: (vaccineId: string) => void;
  creating: boolean;
  title?: string;
  description?: string;
};

export function CreateStockModal({
  isOpen,
  onClose,
  onSubmit,
  availableVaccines,
  selectedVaccineId,
  onVaccineChange,
  creating,
  title = "Créer un stock",
  description = "Sélectionnez un vaccin qui n'a pas encore de stock.",
}: CreateStockModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[95vw] md:max-w-lg rounded-3xl bg-white shadow-2xl">
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>

          <select
            value={selectedVaccineId}
            onChange={(event) => onVaccineChange(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            required
          >
            <option value="">— Sélectionner un vaccin —</option>
            {availableVaccines.map((vaccine) => (
              <option key={vaccine.id} value={vaccine.id}>
                {vaccine.name}
              </option>
            ))}
          </select>

          {availableVaccines.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Tous les vaccins possèdent déjà un stock.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={creating || availableVaccines.length === 0}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {creating ? "Création…" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
