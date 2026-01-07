"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Syringe, Trash2, Pencil } from "lucide-react";
import DashboardShell from "@/app/dashboard/components/DashboardShell";
import StatCard from "@/app/dashboard/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { AppointmentCancellationModal } from "@/app/dashboard/components/AppointmentCancellationModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type StockSummary = {
  national: number;
  regional: number;
  district: number;
  healthCenter: number;
};

type Vaccine = {
  id: string;
  name: string;
  description: string;
  dosesRequired: string;
  stock?: Partial<StockSummary> | null;
};

type VaccinesResponse =
  | {
      total?: number;
      vaccines?: Vaccine[];
    }
  | Vaccine[];

export default function VaccinsPage() {
  const { accessToken, user } = useAuth();
  const isNational = user?.role === "NATIONAL";
  const isSuperAdmin = user?.role === "SUPERADMIN";
  const canManage = isNational || isSuperAdmin;
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", dosesRequired: "", gender: "" });
  const [saving, setSaving] = useState(false);

  const [stockModalId, setStockModalId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const [cancellationModalData, setCancellationModalData] = useState<{
    actionType: "deleteVaccine";
    affectedAppointments: number;
    entityName: string;
    onConfirm: () => void;
  } | null>(null);

  const loadVaccines = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/vaccine`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }

      const data: VaccinesResponse = await response.json();
      if (Array.isArray(data)) {
        setVaccines(data);
      } else {
        setVaccines(Array.isArray(data.vaccines) ? data.vaccines : []);
      }
    } catch (err) {
      console.error("Erreur chargement vaccins:", err);
      setError("Impossible de charger les vaccins");
      setVaccines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVaccines();
  }, [accessToken]);

  const totalVaccines = useMemo(() => vaccines.length, [vaccines]);

  const openCreateModal = () => {
    if (!canManage) return;
    setModalMode("create");
    setEditingId(null);
    setForm({ name: "", description: "", dosesRequired: "", gender: "" });
    setModalOpen(true);
  };

  const openEditModal = (vaccine: Vaccine) => {
    if (!canManage) return;
    setModalMode("edit");
    setEditingId(vaccine.id);
    setForm({
      name: vaccine.name,
      description: vaccine.description,
      dosesRequired: vaccine.dosesRequired,
      gender: (vaccine as any).gender || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm({ name: "", description: "", dosesRequired: "", gender: "" });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage || !accessToken) return;

    if (!form.name.trim() || !form.description.trim() || !form.dosesRequired.trim()) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const method = modalMode === "edit" && editingId ? "PUT" : "POST";
      const url =
        modalMode === "edit" && editingId
          ? `${API_URL}/api/vaccine/${editingId}`
          : `${API_URL}/api/vaccine`;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          dosesRequired: form.dosesRequired.trim(),
          gender: form.gender || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      closeModal();
      await loadVaccines();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Impossible d'enregistrer le vaccin");
      }
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async () => {
    if (!canManage || !accessToken || !deletingId) return;

    try {
      setDeleting(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/vaccine/${deletingId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      setDeletingId(null);
      await loadVaccines();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Impossible de supprimer le vaccin");
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = async () => {
    if (!canManage || !accessToken || !deletingId) return;

    // Confirmation simple, l'impact a déjà été vérifié au clic
    await performDelete();
  };

  const getStockSummary = (vaccine: Vaccine): StockSummary => ({
    national: vaccine.stock?.national ?? 0,
    regional: vaccine.stock?.regional ?? 0,
    district: vaccine.stock?.district ?? 0,
    healthCenter: vaccine.stock?.healthCenter ?? 0,
  });

  return (
    <DashboardShell active="/dashboard/vaccins">
      <div className="space-y-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Vaccins</h2>
            <p className="text-sm text-slate-500">
              Inventaire des vaccins et gestion des stocks.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Nouveau vaccin
            </button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title="Total des vaccins"
            value={loading ? "…" : totalVaccines}
            icon={Syringe}
            accent="emerald"
            loading={loading}
          />
        </div>

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading && vaccines.length === 0 ? (
            <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
              Chargement des vaccins…
            </div>
          ) : vaccines.length === 0 ? (
            <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
              Aucun vaccin enregistré pour le moment.
            </div>
          ) : (
            vaccines.map((vaccine) => (
              <div
                key={vaccine.id}
                className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {vaccine.dosesRequired} doses requises
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">
                      {vaccine.name}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {vaccine.description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStockModalId(vaccine.id)}
                    className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Voir les stocks
                  </button>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(vaccine)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          // Vérifier l'impact avant d'afficher la popup
                          if (!accessToken) return;
                          
                          try {
                            const impactResponse = await fetch(
                              `${API_URL}/api/vaccine/${vaccine.id}/impact`,
                              {
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${accessToken}`,
                                },
                              }
                            );

                            if (impactResponse.ok) {
                              const impactData = await impactResponse.json();
                              if (impactData.willCancelAppointments && impactData.affectedAppointments > 0) {
                                // Afficher directement la modal de warning
                                setCancellationModalData({
                                  actionType: "deleteVaccine",
                                  affectedAppointments: impactData.affectedAppointments,
                                  entityName: impactData.vaccineName || vaccine.name,
                                  onConfirm: async () => {
                                    setCancellationModalOpen(false);
                                    setDeletingId(vaccine.id);
                                    await performDelete();
                                  },
                                });
                                setCancellationModalOpen(true);
                                return;
                              }
                            }
                          } catch (err) {
                            console.error("Erreur vérification impact:", err);
                            // En cas d'erreur, continuer avec la popup classique
                          }

                          // Si pas d'impact ou erreur, afficher la popup classique
                          setDeletingId(vaccine.id);
                        }}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {canManage && modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-lg rounded-3xl bg-white shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                {modalMode === "edit" ? "Modifier le vaccin" : "Nouveau vaccin"}
              </h3>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">Nom</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">Doses requises</label>
                <input
                  value={form.dosesRequired}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, dosesRequired: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">
                  Genre (optionnel)
                </label>
                <select
                  value={form.gender}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, gender: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="">Pour garçons et filles</option>
                  <option value="M">Garçons uniquement</option>
                  <option value="F">Filles uniquement</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Si vide, le vaccin est pour tous. Sinon, spécifiez le genre cible.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {stockModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-xl rounded-3xl bg-white shadow-2xl">
            <div className="space-y-5 p-6">
              {(() => {
                const vaccine = vaccines.find((item) => item.id === stockModalId);
                if (!vaccine) return null;

                const stock = getStockSummary(vaccine);

                return (
                  <>
                    <div className="space-y-1 text-center">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {vaccine.name}
                      </h3>
                      <p className="text-sm text-slate-500">
                        Répartition des stocks par niveau
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-emerald-500">
                          Stock national
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-emerald-700">
                          {stock.national.toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-blue-500">
                          Stock régional
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-blue-700">
                          {stock.regional.toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-orange-500">
                          Stock district
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-orange-600">
                          {stock.district.toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-purple-500">
                          Stock centres de santé
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-purple-600">
                          {stock.healthCenter.toLocaleString("fr-FR")}
                        </p>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setStockModalId(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {canManage && deletingId && !cancellationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="space-y-4 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Supprimer le vaccin ?
              </h3>
              <p className="text-sm text-slate-600">
                Cette action est irréversible. Le vaccin et ses données associées seront supprimés.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
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
                  {deleting ? "Suppression…" : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'annulation de rendez-vous */}
      {cancellationModalData && (
        <AppointmentCancellationModal
          isOpen={cancellationModalOpen}
          onClose={() => {
            setCancellationModalOpen(false);
            setCancellationModalData(null);
            setDeletingId(null);
          }}
          onConfirm={cancellationModalData.onConfirm}
          affectedAppointments={cancellationModalData.affectedAppointments}
          actionType={cancellationModalData.actionType}
          entityName={cancellationModalData.entityName}
          isLoading={deleting}
        />
      )}
    </DashboardShell>
  );
}
