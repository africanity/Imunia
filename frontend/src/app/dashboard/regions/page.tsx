"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Plus, RefreshCw, Trash2, Pencil, X, Loader2 } from "lucide-react";
import DashboardShell from "@/app/dashboard/components/DashboardShell";
import StatCard from "@/app/dashboard/components/StatCard";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type Region = {
  id: string;
  name: string;
};

type RegionsResponse =
  | {
      total?: number;
      regions?: { id: string; name: string }[];
    }
  | { id: string; name: string }[];

type RegionDeletionTotals = {
  communes: number;
  districts: number;
  healthCenters: number;
  children: number;
  users: number;
  stockLots: number;
  pendingTransfers: number;
  stockReservations: number;
  records: number;
  scheduledVaccines: number;
  dueVaccines: number;
  lateVaccines: number;
  overdueVaccines: number;
  completedVaccines: number;
};

type RegionDeletionSummary = {
  success: boolean;
  region: Region;
  totals: RegionDeletionTotals;
};

export default function RegionsPage() {
  const { accessToken, user } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentRegionId, setCurrentRegionId] = useState<string | null>(null);
  const [regionNameInput, setRegionNameInput] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Region | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSummary, setDeleteSummary] =
    useState<RegionDeletionSummary | null>(null);
  const [deleteSummaryLoading, setDeleteSummaryLoading] = useState(false);
  const [deleteSummaryError, setDeleteSummaryError] = useState<string | null>(
    null,
  );

  const fetchRegions = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/api/region`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const data: RegionsResponse = await res.json();
      if (Array.isArray(data)) {
        setRegions(data.map((entry) => ({ id: entry.id, name: entry.name })));
      } else {
        const rows = Array.isArray(data.regions) ? data.regions : [];
        setRegions(rows.map((entry) => ({ id: entry.id, name: entry.name })));
      }
    } catch (err) {
      console.error("Erreur chargement régions:", err);
      setError("Impossible de charger les régions");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  const clearDeleteState = useCallback(() => {
    setDeleteSummary(null);
    setDeleteSummaryError(null);
    setDeleteSummaryLoading(false);
  }, []);

  const loadDeleteSummary = useCallback(
    async (regionId: string) => {
      if (!accessToken) {
        return;
      }

      try {
        setDeleteSummaryLoading(true);
        setDeleteSummaryError(null);
        setDeleteSummary(null);

        const res = await fetch(
          `${API_URL}/api/region/${regionId}/delete-summary`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          throw new Error(
            data?.message ? String(data.message) : `status ${res.status}`,
          );
        }

        setDeleteSummary(data as RegionDeletionSummary);
      } catch (err) {
        console.error("Erreur chargement résumé suppression région:", err);
        setDeleteSummaryError(
          "Impossible de charger le détail de la suppression.",
        );
      } finally {
        setDeleteSummaryLoading(false);
      }
    },
    [accessToken],
  );

  const openDeleteModal = (region: Region) => {
    setDeleteTarget(region);
    clearDeleteState();
    loadDeleteSummary(region.id);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    clearDeleteState();
  };

  const resetModal = () => {
    setShowModal(false);
    setModalMode("create");
    setCurrentRegionId(null);
    setRegionNameInput("");
  };

  const openCreateModal = () => {
    setModalMode("create");
    setCurrentRegionId(null);
    setRegionNameInput("");
    setShowModal(true);
  };

  const openEditModal = (region: Region) => {
    setModalMode("edit");
    setCurrentRegionId(region.id);
    setRegionNameInput(region.name);
    setShowModal(true);
  };

  const handleSaveRegion = async () => {
    if (!accessToken || !regionNameInput.trim()) {
      return;
    }

    const isEdit = modalMode === "edit" && currentRegionId;
    const endpoint = isEdit
      ? `${API_URL}/api/region/${currentRegionId}`
      : `${API_URL}/api/region`;
    const method = isEdit ? "PUT" : "POST";

    try {
      setSaving(true);
      setError(null);

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: regionNameInput.trim() }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${res.status}`);
      }

      resetModal();
      await fetchRegions();
    } catch (err) {
      console.error("Erreur sauvegarde région:", err);
      setError("Impossible d'enregistrer la région");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRegion = async () => {
    if (!deleteTarget || !accessToken) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      const res = await fetch(`${API_URL}/api/region/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${res.status}`);
      }

      closeDeleteModal();
      await fetchRegions();
    } catch (err) {
      console.error("Erreur suppression région:", err);
      setError("Impossible de supprimer la région");
    } finally {
      setDeleting(false);
    }
  };

  const regionCards = useMemo(() => {
    if (regions.length === 0 && !loading) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
          <MapPin className="mb-4 h-16 w-16 text-slate-300" />
          <p className="text-lg font-semibold">Aucune région enregistrée</p>
          <p className="mt-1 text-sm text-slate-400">
            Ajoutez votre première région pour commencer.
          </p>
          {user?.role === "NATIONAL" && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Ajouter une région
            </button>
          )}
        </div>
      );
    }

    return regions.map((region, index) => (
      <div
        key={region.id}
        className="hover-lift rounded-3xl border border-slate-200 bg-white p-6 transition"
        style={{ animationDelay: `${index * 40}ms` }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{region.name}</h3>
            <p className="text-sm text-slate-500">Région active</p>
          </div>
        </div>

        {user?.role === "NATIONAL" && (
          <div className="mt-6 flex gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => openEditModal(region)}
              className="flex-1 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-100"
            >
              <span className="flex items-center justify-center gap-2">
                <Pencil className="h-4 w-4" />
                Modifier
              </span>
            </button>
            <button
              type="button"
              onClick={() => openDeleteModal(region)}
              className="flex-1 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
            >
              <span className="flex items-center justify-center gap-2">
                <Trash2 className="h-4 w-4" />
                Supprimer
              </span>
            </button>
          </div>
        )}
      </div>
    ));
  }, [regions, loading, user]);

  const regionDeleteSummaryItems = useMemo(() => {
    if (!deleteSummary) {
      return [];
    }

    const totals = deleteSummary.totals;
    return [
      { label: "Communes", value: totals.communes },
      { label: "Districts", value: totals.districts },
      { label: "Centres", value: totals.healthCenters },
      { label: "Enfants", value: totals.children },
      { label: "Utilisateurs", value: totals.users },
      { label: "Stocks", value: totals.stockLots },
      { label: "Transferts en attente", value: totals.pendingTransfers },
      { label: "Réservations", value: totals.stockReservations },
      { label: "Dossiers", value: totals.records },
      { label: "Vaccins programmés", value: totals.scheduledVaccines },
      { label: "Vaccins à faire", value: totals.dueVaccines },
      { label: "Vaccins en retard", value: totals.lateVaccines },
      { label: "Vaccins manqués", value: totals.overdueVaccines },
      { label: "Vaccins faits", value: totals.completedVaccines },
    ];
  }, [deleteSummary]);

  return (
    <>
      <DashboardShell active="/dashboard/regions">
        <div className="space-y-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Gestion des régions
              </h2>
              <p className="text-sm text-slate-500">
                Configuration des régions administratives pour la couverture vaccinale.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={fetchRegions}
                className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-600"
              >
                <RefreshCw className="h-4 w-4" />
                Actualiser
              </button>
              {user?.role === "NATIONAL" && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter une région
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title="Total des régions"
              value={loading ? "…" : regions.length}
              icon={MapPin}
              accent="blue"
              loading={loading}
            />
          </div>

          {error && (
            <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {regionCards}
          </div>
        </div>
      </DashboardShell>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <MapPin className="h-5 w-5 text-emerald-600" />
                {modalMode === "edit" ? "Modifier la région" : "Nouvelle région"}
              </div>
              <button
                type="button"
                onClick={resetModal}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-4">
              <label className="text-sm font-medium text-slate-600">
                Nom de la région
              </label>
              <input
                type="text"
                value={regionNameInput}
                onChange={(event) => setRegionNameInput(event.target.value)}
                placeholder="Ex : Dakar, Thiès, Saint-Louis…"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={resetModal}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveRegion}
                disabled={saving || !regionNameInput.trim()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-col items-center gap-4 px-6 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Supprimer la région ?
              </h3>
              <p className="text-sm text-slate-500">
                Êtes-vous sûr de vouloir supprimer la région{" "}
                <span className="font-medium text-slate-800">{deleteTarget.name}</span>
                ? Cette action est irréversible.
              </p>
            </div>
            <div className="px-6 pb-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left text-sm text-slate-600">
                {deleteSummaryLoading ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement des éléments impactés…
                  </div>
                ) : deleteSummaryError ? (
                  <div className="space-y-3">
                    <p className="text-red-600">{deleteSummaryError}</p>
                    <button
                      type="button"
                      onClick={() => deleteTarget && loadDeleteSummary(deleteTarget.id)}
                      className="text-sm font-semibold text-emerald-600 transition hover:text-emerald-700"
                    >
                      Réessayer
                    </button>
                  </div>
                ) : deleteSummary ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Éléments impactés
                    </p>
                    <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      {regionDeleteSummaryItems.map((item) => (
                        <li
                          key={item.label}
                          className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                        >
                          <span className="text-slate-500">{item.label}</span>
                          <span className="font-semibold text-slate-900">
                            {item.value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Aucun détail supplémentaire à afficher.
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteRegion}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

