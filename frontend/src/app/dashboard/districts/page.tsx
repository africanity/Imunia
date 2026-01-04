"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardShell from "../components/DashboardShell";
import StatCard from "../components/StatCard";
import {
  AlertCircle,
  MapPinned,
  Plus,
  Trash2,
  X,
  Pencil,
  Loader2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type Commune = {
  id: string;
  name: string;
};

type District = {
  id: string;
  name: string;
  commune: {
    id: string;
    name: string;
    region?: { id: string; name: string } | null;
  } | null;
};

type DistrictResponse = {
  total?: number;
  items?: District[];
} | District[];

type DistrictDeletionTotals = {
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

type DistrictDeletionSummary = {
  success: boolean;
  district: {
    id: string;
    name: string;
    commune?: { id: string; name: string } | null;
  };
  totals: DistrictDeletionTotals;
};

export default function DistrictsPage() {
  const { accessToken, user } = useAuth();

  const [districts, setDistricts] = useState<District[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [communeId, setCommuneId] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<District | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSummary, setDeleteSummary] =
    useState<DistrictDeletionSummary | null>(null);
  const [deleteSummaryLoading, setDeleteSummaryLoading] = useState(false);
  const [deleteSummaryError, setDeleteSummaryError] = useState<string | null>(
    null,
  );

  const isRegional = user?.role === "REGIONAL";

  const fetchDistricts = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/api/district`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const payload: DistrictResponse = await res.json();
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.items)
        ? payload.items
        : [];

      setDistricts(items);
    } catch (err) {
      console.error("Erreur chargement districts:", err);
      setError("Impossible de charger les districts");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const fetchCommunes = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/commune`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const payload = await res.json();
      const items: Commune[] = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
        ? payload
        : [];

      setCommunes(items.map((item) => ({ id: item.id, name: item.name })));
    } catch (err) {
      console.error("Erreur chargement communes:", err);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchDistricts();
    fetchCommunes();
  }, [fetchDistricts, fetchCommunes]);

  const clearDeleteState = useCallback(() => {
    setDeleteSummary(null);
    setDeleteSummaryError(null);
    setDeleteSummaryLoading(false);
  }, []);

  const loadDeleteSummary = useCallback(
    async (districtId: string) => {
      if (!accessToken) {
        return;
      }

      try {
        setDeleteSummaryLoading(true);
        setDeleteSummaryError(null);
        setDeleteSummary(null);

        const res = await fetch(
          `${API_URL}/api/district/${districtId}/delete-summary`,
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

        setDeleteSummary(data as DistrictDeletionSummary);
      } catch (err) {
        console.error("Erreur chargement résumé suppression district:", err);
        setDeleteSummaryError(
          "Impossible de charger le détail de la suppression.",
        );
      } finally {
        setDeleteSummaryLoading(false);
      }
    },
    [accessToken],
  );

  const openDeleteModal = (district: District) => {
    setDeleteTarget(district);
    clearDeleteState();
    loadDeleteSummary(district.id);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    clearDeleteState();
  };

  const resetModal = () => {
    setShowModal(false);
    setModalMode("create");
    setCurrentId(null);
    setNameInput("");
    setCommuneId("");
    setModalError(null);
  };

  const openCreateModal = () => {
    setModalMode("create");
    setCurrentId(null);
    setNameInput("");
    setCommuneId(communes[0]?.id ?? "");
    setShowModal(true);
  };

  const openEditModal = (district: District) => {
    setModalMode("edit");
    setCurrentId(district.id);
    setNameInput(district.name);
    setCommuneId(district.commune?.id ?? "");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!accessToken || !nameInput.trim()) {
      return;
    }

    const isEdit = modalMode === "edit" && currentId;
    const endpoint = isEdit
      ? `${API_URL}/api/district/${currentId}`
      : `${API_URL}/api/district`;
    const method = isEdit ? "PUT" : "POST";

    const payload: Record<string, string> = {
      name: nameInput.trim(),
    };

    if (isRegional && communeId) {
      payload.communeId = communeId;
    } else if (!isEdit) {
      payload.communeId = communeId;
    }

    try {
      setSaving(true);
      setModalError(null);

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMessage = errorData?.message ?? `Erreur ${res.status}`;
        throw new Error(errorMessage);
      }

      resetModal();
      await fetchDistricts();
    } catch (err) {
      console.error("Erreur sauvegarde district:", err);
      // Utiliser le message d'erreur du backend s'il existe, sinon message générique
      const errorMessage = err instanceof Error && err.message 
        ? err.message 
        : "Impossible d'enregistrer le district";
      setModalError(errorMessage);
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

      const res = await fetch(`${API_URL}/api/district/${deleteTarget.id}`, {
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
      await fetchDistricts();
    } catch (err) {
      console.error("Erreur suppression district:", err);
      setError("Impossible de supprimer le district");
    } finally {
      setDeleting(false);
    }
  };

  const communeOptions = communes.map((commune) => (
    <option key={commune.id} value={commune.id}>
      {commune.name}
    </option>
  ));

  const cards = useMemo(() => {
    if (loading) {
      return (
        <div className="col-span-full flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="text-sm text-slate-600">Chargement des districts...</p>
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

    if (districts.length === 0) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
          <MapPinned className="mb-4 h-16 w-16 text-slate-300" />
          <p className="text-lg font-semibold">Aucun district enregistré</p>
          <p className="mt-1 text-sm text-slate-400">
            Ajoutez votre premier district pour commencer.
          </p>
          {isRegional && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Ajouter un district
            </button>
          )}
        </div>
      );
    }

    return districts.map((district, index) => {
      const initials = district.name.substring(0, 2).toUpperCase();
      const regionName = district.commune?.region?.name ?? null;
      
      return (
        <div
          key={district.id}
          className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-500 text-lg font-bold text-white shadow-sm ring-2 ring-white">
              {initials}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900">{district.name}</h3>
              {regionName && (
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                  <MapPinned className="h-4 w-4" />
                  <span>
                    Région: {regionName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {isRegional && (
            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => openEditModal(district)}
                className="rounded-lg bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
                title="Modifier"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openDeleteModal(district)}
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
  }, [districts, loading, error, isRegional]);

  const districtDeleteSummaryItems = useMemo(() => {
    if (!deleteSummary) {
      return [];
    }

    const totals = deleteSummary.totals;
    return [
      { label: "Centres de santé", value: totals.healthCenters },
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
      <DashboardShell active="/dashboard/districts">
        <div className="space-y-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Gestion des districts</h2>
              <p className="text-sm text-slate-500">
                Administration des districts rattachés à votre région.
              </p>
            </div>
            <div className="flex gap-3">
              {isRegional && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" /> Ajouter un district
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title="Total des districts"
              value={loading ? "…" : districts.length}
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
                {modalMode === "edit" ? "Modifier le district" : "Nouveau district"}
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
              {modalError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{modalError}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-600">Nom du district</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(event) => {
                    setNameInput(event.target.value);
                    setModalError(null);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {isRegional && (
                <div>
                  <label className="text-sm font-medium text-slate-600">Commune associée</label>
                  <select
                    value={communeId}
                    onChange={(event) => {
                      setCommuneId(event.target.value);
                      setModalError(null);
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">— Sélectionner une commune —</option>
                    {communeOptions}
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
                disabled={saving || !nameInput.trim() || (isRegional && !communeId)}
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
                Supprimer le district ?
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
                      onClick={() => deleteTarget && loadDeleteSummary(deleteTarget.id)}
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
                      {districtDeleteSummaryItems.map((item) => (
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
                  <p>Aucun détail supplémentaire à afficher.</p>
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








