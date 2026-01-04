"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardShell from "../components/DashboardShell";
import StatCard from "../components/StatCard";
import {
  AlertCircle,
  Loader2,
  MapPinned,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type Region = {
  id: string;
  name: string;
};

type Commune = {
  id: string;
  name: string;
  region?: { id: string; name: string } | null;
};

type CommuneResponse = {
  total?: number;
  items?: Commune[];
} | Commune[];

type CommuneDeletionTotals = {
  districts: number;
  healthCenters: number;
  children: number;
  users: number;
  stockLots: number;
  pendingTransfers: number;
  stockReservations: number;
  vaccineRequests: number;
  records: number;
  scheduledVaccines: number;
  dueVaccines: number;
  lateVaccines: number;
  overdueVaccines: number;
  completedVaccines: number;
};

type CommuneDeletionSummary = {
  success: boolean;
  commune: Commune;
  totals: CommuneDeletionTotals;
};

export default function CommunesPage() {
  const { accessToken, user } = useAuth();

  const [communes, setCommunes] = useState<Commune[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [regionId, setRegionId] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Commune | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSummary, setDeleteSummary] =
    useState<CommuneDeletionSummary | null>(null);
  const [deleteSummaryLoading, setDeleteSummaryLoading] = useState(false);
  const [deleteSummaryError, setDeleteSummaryError] = useState<string | null>(
    null,
  );

  const isRegional = user?.role === "REGIONAL";
  const isNational = user?.role === "NATIONAL";

  const fetchCommunes = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/api/commune`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const payload: CommuneResponse = await res.json();
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.items)
        ? payload.items
        : [];

      setCommunes(items);
    } catch (err) {
      console.error("Erreur chargement communes:", err);
      setError("Impossible de charger les communes");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const fetchRegions = useCallback(async () => {
    if (!accessToken || !isNational) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/region`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const data = await res.json();
      const items: Region[] = Array.isArray(data?.regions)
        ? data.regions
        : Array.isArray(data)
        ? data
        : [];

      setRegions(items.map((entry) => ({ id: entry.id, name: entry.name })));
    } catch (err) {
      console.error("Erreur chargement régions:", err);
    }
  }, [accessToken, isNational]);

  useEffect(() => {
    fetchCommunes();
    fetchRegions();
  }, [fetchCommunes, fetchRegions]);

  const resetModal = () => {
    setShowModal(false);
    setModalMode("create");
    setCurrentId(null);
    setNameInput("");
    setRegionId("");
  };

  const clearDeleteState = useCallback(() => {
    setDeleteSummary(null);
    setDeleteSummaryError(null);
    setDeleteSummaryLoading(false);
  }, []);

  const loadDeleteSummary = useCallback(
    async (communeId: string) => {
      if (!accessToken) {
        return;
      }

      try {
        setDeleteSummaryLoading(true);
        setDeleteSummaryError(null);
        setDeleteSummary(null);

        const res = await fetch(
          `${API_URL}/api/commune/${communeId}/delete-summary`,
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

        setDeleteSummary(data as CommuneDeletionSummary);
      } catch (err) {
        console.error("Erreur chargement résumé suppression commune:", err);
        setDeleteSummaryError(
          "Impossible de charger le détail de la suppression.",
        );
      } finally {
        setDeleteSummaryLoading(false);
      }
    },
    [accessToken],
  );

  const openDeleteModal = useCallback(
    (commune: Commune) => {
      setDeleteTarget(commune);
      clearDeleteState();
      loadDeleteSummary(commune.id);
    },
    [clearDeleteState, loadDeleteSummary],
  );

  const closeDeleteModal = useCallback(() => {
    setDeleteTarget(null);
    clearDeleteState();
  }, [clearDeleteState]);

  const openCreateModal = () => {
    setModalMode("create");
    setCurrentId(null);
    setNameInput("");
    if (isRegional) {
      setRegionId(user?.regionId ?? "");
    } else if (regions.length > 0) {
      setRegionId(regions[0].id);
    }
    setShowModal(true);
  };

  const openEditModal = (commune: Commune) => {
    setModalMode("edit");
    setCurrentId(commune.id);
    setNameInput(commune.name);
    setRegionId(commune.region?.id ?? "");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!accessToken || !nameInput.trim()) {
      return;
    }

    const isEdit = modalMode === "edit" && currentId;
    const endpoint = isEdit
      ? `${API_URL}/api/commune/${currentId}`
      : `${API_URL}/api/commune`;
    const method = isEdit ? "PUT" : "POST";

    const payload: Record<string, string> = { name: nameInput.trim() };

    if (isNational) {
      payload.regionId = regionId;
    }

    try {
      setSaving(true);
      setError(null);

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const message = await res.json().catch(() => null);
        throw new Error(message?.message ?? `status ${res.status}`);
      }

      resetModal();
      await fetchCommunes();
    } catch (err) {
      console.error("Erreur sauvegarde commune:", err);
      setError("Impossible d'enregistrer la commune");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken || !deleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      const res = await fetch(`${API_URL}/api/commune/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const message = await res.json().catch(() => null);
        throw new Error(message?.message ?? `status ${res.status}`);
      }

      closeDeleteModal();
      await fetchCommunes();
    } catch (err) {
      console.error("Erreur suppression commune:", err);
      setError("Impossible de supprimer la commune");
    } finally {
      setDeleting(false);
    }
  };

  const regionOptions = regions.map((region) => (
    <option key={region.id} value={region.id}>
      {region.name}
    </option>
  ));

  const cards = useMemo(() => {
    if (loading) {
      return (
        <div className="col-span-full flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="text-sm text-slate-600">Chargement des communes...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="col-span-full flex items-center justify-center py-16">
          <div className="text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <p className="font-medium text-red-600">{error}</p>
          </div>
        </div>
      );
    }

    if (communes.length === 0) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
          <MapPinned className="mb-4 h-16 w-16 text-slate-300" />
          <p className="text-lg font-semibold">Aucune commune enregistrée</p>
          <p className="mt-1 text-sm text-slate-400">
            Ajoutez votre première commune pour commencer.
          </p>
          {(isRegional || isNational) && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Ajouter une commune
            </button>
          )}
        </div>
      );
    }

    return communes.map((commune, index) => {
      const initials = commune.name.substring(0, 2).toUpperCase();
      
      return (
        <div
          key={commune.id}
          className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-500 text-lg font-bold text-white shadow-sm ring-2 ring-white">
              {initials}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900">{commune.name}</h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                <MapPinned className="h-4 w-4" />
                <span>
                  Région: {commune.region?.name ?? "Non renseignée"}
                </span>
              </div>
            </div>
          </div>

          {(isRegional || isNational) && (
            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => openEditModal(commune)}
                className="rounded-lg bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
                title="Modifier"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openDeleteModal(commune)}
                className="rounded-lg bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      );
    });
  }, [communes, loading, error, isRegional, isNational, openDeleteModal]);

  const communeDeleteSummaryItems = useMemo(() => {
    if (!deleteSummary) {
      return [];
    }

    const totals = deleteSummary.totals;
    return [
      { label: "Districts", value: totals.districts },
      { label: "Centres", value: totals.healthCenters },
      { label: "Enfants", value: totals.children },
      { label: "Utilisateurs", value: totals.users },
      { label: "Stocks", value: totals.stockLots },
      { label: "Transferts en attente", value: totals.pendingTransfers },
      { label: "Réservations", value: totals.stockReservations },
      { label: "Demandes de vaccin", value: totals.vaccineRequests },
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
      <DashboardShell active="/dashboard/communes">
        <div className="space-y-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Gestion des communes</h2>
              <p className="text-sm text-slate-500">
                Administration des communes rattachées aux régions.
              </p>
            </div>
            <div className="flex gap-3">
              {(isRegional || isNational) && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" /> Ajouter une commune
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title="Total des communes"
              value={loading ? "…" : communes.length}
              icon={MapPinned}
              accent="blue"
              loading={loading}
            />
          </div>

          {error && (
            <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{cards}</div>
        </div>
      </DashboardShell>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <MapPinned className="h-5 w-5 text-blue-600" />
                {modalMode === "edit" ? "Modifier la commune" : "Nouvelle commune"}
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
              <div>
                <label className="text-sm font-medium text-slate-600">Nom de la commune</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {isNational && (
                <div>
                  <label className="text-sm font-medium text-slate-600">Région</label>
                  <select
                    value={regionId}
                    onChange={(event) => setRegionId(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">— Sélectionner une région —</option>
                    {regionOptions}
                  </select>
                </div>
              )}
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
                onClick={handleSave}
                disabled={saving || !nameInput.trim() || (isNational && !regionId)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-col items-center gap-4 px-6 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Supprimer la commune ?
              </h3>
              <p className="text-sm text-slate-500">
                Êtes-vous sûr de vouloir supprimer <span className="font-medium text-slate-800">{deleteTarget.name}</span> ?
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
                      onClick={() =>
                        deleteTarget && loadDeleteSummary(deleteTarget.id)
                      }
                      className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
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
                      {communeDeleteSummaryItems.map((item) => (
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
                onClick={handleDelete}
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








