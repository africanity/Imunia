"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardShell from "../components/DashboardShell";
import StatCard from "../components/StatCard";
import { AlertCircle, Building2, MapPin, Plus, RefreshCw, Trash2, X, Pencil, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type HealthCenter = {
  id: string;
  name: string;
  address: string;
  district?: {
    id: string;
    name: string;
    commune?: {
      id: string;
      name: string;
      region?: { id: string; name: string } | null;
    } | null;
  } | null;
};

type HealthCenterResponse = {
  total?: number;
  items?: HealthCenter[];
} | HealthCenter[];

type HealthCenterDeletionTotals = {
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

type HealthCenterDeletionSummary = {
  success: boolean;
  healthCenter: {
    id: string;
    name: string;
    district?: { id: string; name: string } | null;
  };
  totals: HealthCenterDeletionTotals;
};
export default function CentresPage() {
  const { accessToken, user } = useAuth();

  const [centers, setCenters] = useState<HealthCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<HealthCenter | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSummary, setDeleteSummary] =
    useState<HealthCenterDeletionSummary | null>(null);
  const [deleteSummaryLoading, setDeleteSummaryLoading] = useState(false);
  const [deleteSummaryError, setDeleteSummaryError] = useState<string | null>(
    null,
  );

  const isDistrict = user?.role === "DISTRICT";

  const fetchHealthCenters = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/api/healthCenter`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const payload: HealthCenterResponse = await res.json();
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.items)
        ? payload.items
        : [];

      setCenters(items);
    } catch (err) {
      console.error("Erreur chargement centres:", err);
      setError("Impossible de charger les centres de santé");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchHealthCenters();
  }, [fetchHealthCenters]);

  const clearDeleteState = useCallback(() => {
    setDeleteSummary(null);
    setDeleteSummaryError(null);
    setDeleteSummaryLoading(false);
  }, []);

  const loadDeleteSummary = useCallback(
    async (centerId: string) => {
      if (!accessToken) {
        return;
      }

      try {
        setDeleteSummaryLoading(true);
        setDeleteSummaryError(null);
        setDeleteSummary(null);

        const res = await fetch(
          `${API_URL}/api/healthCenter/${centerId}/delete-summary`,
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

        setDeleteSummary(data as HealthCenterDeletionSummary);
      } catch (err) {
        console.error("Erreur résumé suppression centre:", err);
        setDeleteSummaryError(
          "Impossible de charger le détail de la suppression.",
        );
      } finally {
        setDeleteSummaryLoading(false);
      }
    },
    [accessToken],
  );

  const openDeleteModal = (center: HealthCenter) => {
    setDeleteTarget(center);
    clearDeleteState();
    loadDeleteSummary(center.id);
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
    setAddressInput("");
  };

  const openCreateModal = () => {
    setModalMode("create");
    setCurrentId(null);
    setNameInput("");
    setAddressInput("");
    setShowModal(true);
  };

  const openEditModal = (center: HealthCenter) => {
    setModalMode("edit");
    setCurrentId(center.id);
    setNameInput(center.name);
    setAddressInput(center.address);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!accessToken || !nameInput.trim() || !addressInput.trim()) {
      return;
    }

    const isEdit = modalMode === "edit" && currentId;
    const endpoint = isEdit
      ? `${API_URL}/api/healthCenter/${currentId}`
      : `${API_URL}/api/healthCenter`;
    const method = isEdit ? "PUT" : "POST";

    const payload = {
      name: nameInput.trim(),
      address: addressInput.trim(),
    };

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
      await fetchHealthCenters();
    } catch (err) {
      console.error("Erreur sauvegarde centre:", err);
      setError("Impossible d'enregistrer le centre de santé");
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

      const res = await fetch(`${API_URL}/api/healthCenter/${deleteTarget.id}`, {
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
      await fetchHealthCenters();
    } catch (err) {
      console.error("Erreur suppression centre:", err);
      setError("Impossible de supprimer le centre de santé");
    } finally {
      setDeleting(false);
    }
  };

  const cards = useMemo(() => {
    if (loading) {
      return (
        <div className="col-span-full flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="text-sm text-slate-600">Chargement des centres...</p>
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

    if (centers.length === 0) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
          <Building2 className="mb-4 h-16 w-16 text-slate-300" />
          <p className="text-lg font-semibold">Aucun centre de santé enregistré</p>
          <p className="mt-1 text-sm text-slate-400">
            Ajoutez votre premier centre pour commencer.
          </p>
          {isDistrict && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Ajouter un centre
            </button>
          )}
        </div>
      );
    }

    return centers.map((center, index) => (
      <div
        key={center.id}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
        style={{ animationDelay: `${index * 40}ms` }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{center.name}</h3>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <MapPin className="h-4 w-4" /> {center.address}
            </p>
            <p className="text-xs text-slate-400">
              District : {center.district?.name ?? "Non renseigné"}
            </p>
          </div>
          {isDistrict && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openEditModal(center)}
                className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
              >
                <span className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" /> Modifier
                </span>
              </button>
              <button
                type="button"
              onClick={() => openDeleteModal(center)}
                className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" /> Supprimer
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    ));
  }, [centers, loading, error, isDistrict]);

  const healthCenterDeleteSummaryItems = useMemo(() => {
    if (!deleteSummary) {
      return [];
    }

    const totals = deleteSummary.totals;
    return [
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
      <DashboardShell active="/dashboard/centres">
        <div className="space-y-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Gestion des centres de santé</h2>
              <p className="text-sm text-slate-500">
                Administration des centres de santé rattachés à votre district.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={fetchHealthCenters}
                className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:text-blue-600"
              >
                <RefreshCw className="h-4 w-4" /> Actualiser
              </button>
              {isDistrict && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" /> Ajouter un centre
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title="Total des centres"
              value={loading ? "…" : centers.length}
              icon={Building2}
              accent="blue"
              loading={loading}
            />
          </div>

          {error && (
            <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">{cards}</div>
        </div>
      </DashboardShell>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Building2 className="h-5 w-5 text-blue-600" />
                {modalMode === "edit" ? "Modifier le centre" : "Nouveau centre"}
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
                <label className="text-sm font-medium text-slate-600">Nom du centre</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Adresse</label>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(event) => setAddressInput(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
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
                      {healthCenterDeleteSummaryItems.map((item) => (
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
                onClick={resetModal}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !nameInput.trim() || !addressInput.trim()}
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
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-col items-center gap-4 px-6 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Supprimer le centre ?
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
                      {healthCenterDeleteSummaryItems.map((item) => (
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








