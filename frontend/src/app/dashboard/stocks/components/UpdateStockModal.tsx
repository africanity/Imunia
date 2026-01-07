import { FormEvent } from "react";
import type { LotItem } from "../types";
import { formatExpirationDate } from "../utils";

type UpdateStockModalProps = {
  isOpen: boolean;
  onClose: () => void;
  vaccineName: string;
  currentQuantity: number;
  updateMode: "add" | "reduce";
  onModeChange: (mode: "add" | "reduce") => void;
  // Mode "add"
  addQuantity: string;
  onAddQuantityChange: (value: string) => void;
  addExpiration: string;
  onAddExpirationChange: (value: string) => void;
  addQuantityError: string | null;
  onAddSubmit: (event: FormEvent) => void;
  // Mode "reduce"
  reduceQuantity: string;
  onReduceQuantityChange: (value: string) => void;
  reduceRemaining: number;
  reduceLots: LotItem[];
  reduceLoading: boolean;
  reduceError: string | null;
  selectedLotId: string | null;
  onLotSelect: (lotId: string) => void;
  onReduceSubmit: (event: FormEvent) => void;
  updating: boolean;
};

export function UpdateStockModal({
  isOpen,
  onClose,
  vaccineName,
  currentQuantity,
  updateMode,
  onModeChange,
  addQuantity,
  onAddQuantityChange,
  addExpiration,
  onAddExpirationChange,
  addQuantityError,
  onAddSubmit,
  reduceQuantity,
  onReduceQuantityChange,
  reduceRemaining,
  reduceLots,
  reduceLoading,
  reduceError,
  selectedLotId,
  onLotSelect,
  onReduceSubmit,
  updating,
}: UpdateStockModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[95vw] md:max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Ajuster le stock — {vaccineName}
          </h3>

          <div className="mt-6 flex flex-col gap-4 md:flex-row">
            <button
              type="button"
              onClick={() => onModeChange("add")}
              className={`flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-medium transition ${
                updateMode === "add"
                  ? "border-blue-300 bg-blue-50 text-blue-700 shadow"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Ajouter au stock
            </button>
            <button
              type="button"
              onClick={() => onModeChange("reduce")}
              className={`flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-medium transition ${
                updateMode === "reduce"
                  ? "border-orange-300 bg-orange-50 text-orange-700 shadow"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Diminuer
            </button>
          </div>

          {updateMode === "reduce" ? (
            <form onSubmit={onReduceSubmit} className="mt-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">
                  Quantité à diminuer
                </label>
                <input
                  value={reduceQuantity}
                  onChange={(event) => onReduceQuantityChange(event.target.value)}
                  type="number"
                  min="1"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  required
                  disabled={updating}
                />
                <p className="text-xs text-slate-500">
                  Quantité totale disponible : {reduceRemaining.toLocaleString("fr-FR")} doses
                </p>
              </div>

              {reduceLoading ? (
                <div className="text-center py-4 text-slate-500">
                  Chargement des lots...
                </div>
              ) : reduceLots.length === 0 ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  Aucun lot disponible avec une quantité restante.
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">
                    Choisir le lot dans lequel diminuer
                  </label>
                  <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-3">
                    {reduceLots.map((lot) => (
                      <button
                        key={lot.id}
                        type="button"
                        onClick={() => onLotSelect(lot.id)}
                        className={`w-full text-left p-3 rounded-lg border transition ${
                          selectedLotId === lot.id
                            ? "border-orange-500 bg-orange-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-slate-900">
                              Lot expirant le {formatExpirationDate(lot.expiration)}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Quantité disponible : {lot.remainingQuantity.toLocaleString("fr-FR")} doses
                            </div>
                          </div>
                          {selectedLotId === lot.id && (
                            <div className="text-orange-600">✓</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {reduceError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {reduceError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                  disabled={updating}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={updating || !selectedLotId || !reduceQuantity || reduceLots.length === 0}
                  className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-60"
                >
                  {updating ? "Diminution…" : "Diminuer"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={onAddSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600">
                    Quantité actuelle
                  </label>
                  <input
                    value={currentQuantity.toLocaleString("fr-FR")}
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600">
                    Quantité à ajouter
                  </label>
                  <input
                    value={addQuantity}
                    onChange={(event) => onAddQuantityChange(event.target.value)}
                    type="number"
                    min="1"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">
                  Date d&apos;expiration du lot ajouté
                </label>
                <input
                  type="date"
                  value={addExpiration}
                  onChange={(event) => onAddExpirationChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              {addQuantityError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {addQuantityError}
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
                  disabled={updating}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {updating ? "Ajout…" : "Ajouter"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
