import { FormEvent } from "react";
import type { Region, DistrictOption, HealthCenterOption } from "../types";

type TransferModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  vaccineName: string;
  // Pour NATIONAL -> REGIONAL
  regions?: Region[];
  selectedRegionId?: string;
  onRegionChange?: (regionId: string) => void;
  // Pour REGIONAL -> DISTRICT
  districts?: DistrictOption[];
  selectedDistrictId?: string;
  onDistrictChange?: (districtId: string) => void;
  // Pour DISTRICT -> HEALTHCENTER
  healthCenters?: HealthCenterOption[];
  selectedHealthCenterId?: string;
  onHealthCenterChange?: (healthCenterId: string) => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  error: string | null;
  loading: boolean;
  pendingCreation: boolean;
  onCreateClick?: () => void;
  transferType: "national-to-regional" | "regional-to-district" | "district-to-healthcenter";
};

export function TransferModal({
  isOpen,
  onClose,
  onSubmit,
  vaccineName,
  regions,
  selectedRegionId,
  onRegionChange,
  districts,
  selectedDistrictId,
  onDistrictChange,
  healthCenters,
  selectedHealthCenterId,
  onHealthCenterChange,
  quantity,
  onQuantityChange,
  error,
  loading,
  pendingCreation,
  onCreateClick,
  transferType,
}: TransferModalProps) {
  if (!isOpen) return null;

  const getDestinationLabel = () => {
    switch (transferType) {
      case "national-to-regional":
        return "Région";
      case "regional-to-district":
        return "District";
      case "district-to-healthcenter":
        return "Centre de santé";
    }
  };

  const getDestinationOptions = () => {
    switch (transferType) {
      case "national-to-regional":
        return regions?.map((region) => (
          <option key={region.id} value={region.id}>
            {region.name}
          </option>
        ));
      case "regional-to-district":
        return districts?.map((district) => (
          <option key={district.id} value={district.id}>
            {district.name}
          </option>
        ));
      case "district-to-healthcenter":
        return healthCenters?.map((hc) => (
          <option key={hc.id} value={hc.id}>
            {hc.name}
          </option>
        ));
    }
  };

  const getSelectedId = () => {
    switch (transferType) {
      case "national-to-regional":
        return selectedRegionId;
      case "regional-to-district":
        return selectedDistrictId;
      case "district-to-healthcenter":
        return selectedHealthCenterId;
    }
  };

  const handleDestinationChange = (value: string) => {
    switch (transferType) {
      case "national-to-regional":
        onRegionChange?.(value);
        break;
      case "regional-to-district":
        onDistrictChange?.(value);
        break;
      case "district-to-healthcenter":
        onHealthCenterChange?.(value);
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[95vw] md:max-w-lg rounded-3xl bg-white shadow-2xl">
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Envoyer du stock — {vaccineName}
          </h3>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">{getDestinationLabel()}</label>
            <select
              value={getSelectedId() || ""}
              onChange={(event) => handleDestinationChange(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              required
            >
              <option value="">— Sélectionner une {getDestinationLabel().toLowerCase()} —</option>
              {getDestinationOptions()}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">
              Quantité à envoyer
            </label>
            <input
              value={quantity}
              onChange={(event) => onQuantityChange(event.target.value)}
              type="number"
              min="1"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              required
            />
          </div>

          {error && (
            <div
              className={`rounded-xl border p-3 text-sm ${
                pendingCreation
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {error}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            {pendingCreation && onCreateClick && (
              <button
                type="button"
                onClick={onCreateClick}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
              >
                Créer le stock {getDestinationLabel().toLowerCase()}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Transfert…" : "Envoyer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
