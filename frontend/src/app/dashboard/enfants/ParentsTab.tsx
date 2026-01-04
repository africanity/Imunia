"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Baby,
  Search,
  Users,
} from "lucide-react";
import { ParentChild, ParentOverview } from "./types";

const formatChildStatus = (child: ParentChild): string => {
  if (child.status === "A_JOUR") return "À jour";
  return "Pas à jour";
};

type Props = {
  token: string | null;
  apiBase: string;
};

export default function ParentsTab({ token, apiBase }: Props) {
  const [parents, setParents] = useState<ParentOverview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedParent, setSelectedParent] = useState<ParentOverview | null>(null);
  const [selectedChild, setSelectedChild] = useState<ParentChild | null>(null);

  const loadParents = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/children/parents`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `Erreur ${response.status}`);
      }
      const payload = await response.json();
      const data = Array.isArray(payload.data) ? payload.data : [];
      setParents(data as ParentOverview[]);
    } catch (err) {
      console.error("Erreur chargement parents:", err);
      setError(err instanceof Error ? err.message : "Erreur de chargement");
      setParents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredParents = useMemo(() => {
    if (!search) return parents;
    return parents.filter((parent) => {
      const term = search.toLowerCase();
      return (
        parent.parentName.toLowerCase().includes(term) ||
        parent.parentPhone.toLowerCase().includes(term)
      );
    });
  }, [parents, search]);

  const stats = useMemo(() => {
    const totalParents = parents.length;
    const totalChildren = parents.reduce((sum, parent) => sum + parent.childrenCount, 0);
    const avgChildren = totalParents > 0 ? (totalChildren / totalParents).toFixed(1) : "0";
    const maxChildren = parents.reduce((max, parent) => Math.max(max, parent.childrenCount), 0);
    return { totalParents, totalChildren, avgChildren, maxChildren };
  }, [parents]);

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Total parents</p>
              <p className="text-3xl font-semibold text-purple-900">{stats.totalParents}</p>
            </div>
            <Users className="h-10 w-10 text-purple-500" />
          </div>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Total enfants</p>
              <p className="text-3xl font-semibold text-blue-900">{stats.totalChildren}</p>
            </div>
            <Baby className="h-10 w-10 text-blue-500" />
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">Moyenne enfants/parent</p>
              <p className="text-3xl font-semibold text-emerald-900">{stats.avgChildren}</p>
            </div>
            <Baby className="h-10 w-10 text-emerald-500" />
          </div>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">Max enfants</p>
              <p className="text-3xl font-semibold text-orange-900">{stats.maxChildren}</p>
            </div>
            <Baby className="h-10 w-10 text-orange-500" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un parent (nom ou téléphone)"
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-11 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="text-sm text-slate-600">Chargement des parents...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <p className="font-medium text-red-600">{error}</p>
            <button
              type="button"
              onClick={loadParents}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Réessayer
            </button>
          </div>
        </div>
      ) : filteredParents.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="font-medium text-slate-500">Aucun parent trouvé</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredParents.map((parent) => (
            <div
              key={`${parent.parentPhone}-${parent.parentName}`}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              onClick={() => setSelectedParent(parent)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{parent.parentName}</p>
                  <p className="text-xs text-slate-500">{parent.parentPhone || "Numéro non renseigné"}</p>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  {parent.childrenCount} enfant{parent.childrenCount > 1 ? "s" : ""}
                </span>
              </div>
              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>
                  Régions : {parent.regions.length > 0 ? parent.regions.join(", ") : "-"}
                </p>
                <p>
                  Centres : {parent.healthCenters.length > 0 ? parent.healthCenters.join(", ") : "-"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
          <div className="w-full max-w-[95vw] md:max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 text-white">
              <div>
                <h3 className="text-xl font-semibold">{selectedParent.parentName}</h3>
                <p className="text-sm text-purple-100">{selectedParent.parentPhone}</p>
                <p className="text-xs text-purple-100">
                  {selectedParent.childrenCount} enfant{selectedParent.childrenCount > 1 ? "s" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedParent(null)}
                className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 p-6">
              <h4 className="text-sm font-semibold text-slate-900">Enfants associés</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {selectedParent.children.map((child) => (
                  <div
                    key={child.id}
                    onClick={() => {
                      setSelectedChild(child);
                      setSelectedParent(null);
                    }}
                    className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
                        {child.firstName?.[0]}
                        {child.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{child.firstName} {child.lastName}</p>
                        <p className="text-xs text-slate-500">{child.region || "-"}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                      <p>Centre : {child.healthCenter || "-"}</p>
                      <p>
                        Statut :
                        <span className="ml-1 inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {formatChildStatus(child)}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
          <div className="w-full max-w-[95vw] md:max-w-md rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {selectedChild.firstName} {selectedChild.lastName}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedChild(null)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>Région : {selectedChild.region || "-"}</p>
              <p>Centre : {selectedChild.healthCenter || "-"}</p>
              <p>Prochain RDV : {formatDate(selectedChild.nextAppointment)}</p>
              <p>Statut : {formatChildStatus(selectedChild)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const formatDate = (value?: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};








