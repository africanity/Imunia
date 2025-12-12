"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Lightbulb, Trash2, Pencil } from "lucide-react";
import DashboardShell from "@/app/dashboard/components/DashboardShell";
import StatCard from "@/app/dashboard/components/StatCard";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type Advice = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  ageUnit: "WEEKS" | "MONTHS" | "YEARS" | null;
  minAge: number | null;
  maxAge: number | null;
  specificAge: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type AdviceResponse = {
  total: number;
  items: Advice[];
};

export default function ConseilsPage() {
  const { accessToken, user } = useAuth();
  const isNational = user?.role === "NATIONAL";
  const [advice, setAdvice] = useState<Advice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "",
    ageUnit: "" as "WEEKS" | "MONTHS" | "YEARS" | "",
    minAge: "",
    maxAge: "",
    specificAge: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAdvice = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/advice`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }

      const data: AdviceResponse = await response.json();
      setAdvice(data.items || []);
    } catch (err) {
      console.error("Erreur chargement conseils:", err);
      setError("Impossible de charger les conseils");
      setAdvice([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdvice();
  }, [accessToken]);

  const totalAdvice = useMemo(() => advice.length, [advice]);
  const activeAdvice = useMemo(() => advice.filter((a) => a.isActive).length, [advice]);

  const openCreateModal = () => {
    if (!isNational) return;
    setModalMode("create");
    setEditingId(null);
    setForm({
      title: "",
      content: "",
      category: "",
      ageUnit: "",
      minAge: "",
      maxAge: "",
      specificAge: "",
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (item: Advice) => {
    if (!isNational) return;
    setModalMode("edit");
    setEditingId(item.id);
    setForm({
      title: item.title,
      content: item.content,
      category: item.category || "",
      ageUnit: item.ageUnit || "",
      minAge: item.minAge?.toString() || "",
      maxAge: item.maxAge?.toString() || "",
      specificAge: item.specificAge?.toString() || "",
      isActive: item.isActive,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !isNational) return;

    try {
      setSaving(true);

      const payload: any = {
        title: form.title,
        content: form.content,
        category: form.category || null,
        ageUnit: form.ageUnit || null,
        isActive: form.isActive,
      };

      // Gestion de l'âge : soit specificAge, soit minAge/maxAge
      if (form.specificAge) {
        payload.specificAge = parseInt(form.specificAge);
        payload.minAge = null;
        payload.maxAge = null;
      } else if (form.minAge && form.maxAge) {
        payload.minAge = parseInt(form.minAge);
        payload.maxAge = parseInt(form.maxAge);
        payload.specificAge = null;
      } else {
        payload.minAge = null;
        payload.maxAge = null;
        payload.specificAge = null;
      }

      const url = modalMode === "edit" && editingId
        ? `${API_URL}/api/advice/${editingId}`
        : `${API_URL}/api/advice`;

      const method = modalMode === "edit" ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      await loadAdvice();
      closeModal();
    } catch (err: any) {
      console.error("Erreur sauvegarde conseil:", err);
      setError(err.message || "Impossible de sauvegarder le conseil");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken || !isNational || !deletingId) return;

    try {
      setDeleting(true);

      const response = await fetch(`${API_URL}/api/advice/${deletingId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      await loadAdvice();
      setDeletingId(null);
    } catch (err: any) {
      console.error("Erreur suppression conseil:", err);
      setError(err.message || "Impossible de supprimer le conseil");
    } finally {
      setDeleting(false);
    }
  };

  const getCategoryLabel = (category: string | null) => {
    switch (category) {
      case "vaccination":
        return "Vaccination";
      case "nutrition":
        return "Nutrition";
      case "hygiene":
        return "Hygiène";
      case "development":
        return "Développement";
      case "safety":
        return "Sécurité";
      default:
        return "Général";
    }
  };

  const getAgeLabel = (item: Advice) => {
    if (item.specificAge !== null && item.ageUnit) {
      const unit = item.ageUnit === "WEEKS" ? "semaines" : item.ageUnit === "MONTHS" ? "mois" : "ans";
      return `${item.specificAge} ${unit}`;
    }
    if (item.minAge !== null && item.maxAge !== null && item.ageUnit) {
      const unit = item.ageUnit === "WEEKS" ? "semaines" : item.ageUnit === "MONTHS" ? "mois" : "ans";
      return `${item.minAge}-${item.maxAge} ${unit}`;
    }
    return "Tous les âges";
  };

  return (
    <DashboardShell active="/dashboard/conseils">
      <div className="space-y-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Conseils de santé</h2>
            <p className="text-sm text-slate-500">
              Gestion des conseils de santé pour les parents.
            </p>
          </div>

          {isNational && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Nouveau conseil
            </button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title="Total des conseils"
            value={loading ? "…" : totalAdvice}
            icon={Lightbulb}
            accent="emerald"
            loading={loading}
          />
          <StatCard
            title="Conseils actifs"
            value={loading ? "…" : activeAdvice}
            icon={Lightbulb}
            accent="blue"
            loading={loading}
          />
        </div>

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading && advice.length === 0 ? (
            <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
              Chargement des conseils…
            </div>
          ) : advice.length === 0 ? (
            <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
              Aucun conseil enregistré pour le moment.
            </div>
          ) : (
            advice.map((item) => (
              <div
                key={item.id}
                className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {item.category && (
                        <span className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">
                          {getCategoryLabel(item.category)}
                        </span>
                      )}
                      {!item.isActive && (
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                          Inactif
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-600 mb-3 line-clamp-3">
                      {item.content}
                    </p>
                    <p className="text-xs text-slate-500">
                      👶 {getAgeLabel(item)}
                    </p>
                  </div>
                </div>

                {isNational && (
                  <div className="mt-6 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      <Pencil className="h-4 w-4 inline mr-1" />
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(item.id)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {isNational && modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                {modalMode === "edit" ? "Modifier le conseil" : "Nouveau conseil"}
              </h3>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">Titre *</label>
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">Contenu *</label>
                <textarea
                  value={form.content}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, content: event.target.value }))
                  }
                  required
                  rows={6}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600">Catégorie</label>
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, category: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Aucune</option>
                    <option value="vaccination">Vaccination</option>
                    <option value="nutrition">Nutrition</option>
                    <option value="hygiene">Hygiène</option>
                    <option value="development">Développement</option>
                    <option value="safety">Sécurité</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600">Unité d'âge</label>
                  <select
                    value={form.ageUnit}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, ageUnit: event.target.value as any }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Aucune</option>
                    <option value="WEEKS">Semaines</option>
                    <option value="MONTHS">Mois</option>
                    <option value="YEARS">Ans</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Âge ciblé</label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Âge spécifique</label>
                    <input
                      type="number"
                      value={form.specificAge}
                      onChange={(event) => {
                        setForm((prev) => ({
                          ...prev,
                          specificAge: event.target.value,
                          minAge: "",
                          maxAge: "",
                        }));
                      }}
                      placeholder="Ex: 6"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500">Âge minimum</label>
                      <input
                        type="number"
                        value={form.minAge}
                        onChange={(event) => {
                          setForm((prev) => ({
                            ...prev,
                            minAge: event.target.value,
                            specificAge: "",
                          }));
                        }}
                        placeholder="Min"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Âge maximum</label>
                      <input
                        type="number"
                        value={form.maxAge}
                        onChange={(event) => {
                          setForm((prev) => ({
                            ...prev,
                            maxAge: event.target.value,
                            specificAge: "",
                          }));
                        }}
                        placeholder="Max"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Utilisez soit un âge spécifique, soit une plage (min-max)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-600">
                  Actif
                </label>
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

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Supprimer le conseil
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Êtes-vous sûr de vouloir supprimer ce conseil ? Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={deleting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
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
      )}
    </DashboardShell>
  );
}


