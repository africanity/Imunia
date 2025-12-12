"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Baby,
  Calendar,
  CheckCircle,
  Filter,
  MapPin,
  Plus,
  Search,
  Syringe,
  Trash2,
  User,
  X,
} from "lucide-react";
import ChildDetailsModal from "./ChildDetailsModal";
import { Child } from "./types";

const formatAgeLabel = (birthDate: string): string => {
  if (!birthDate) return "-";
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "-";
  const now = new Date();
  const diffMs = now.getTime() - birth.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays < 60) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} sem`;
  }
  if (diffDays < 730) {
    const months = Math.floor(diffDays / 30.4375);
    return `${months} mois`;
  }
  const years = Math.floor(diffDays / 365.25);
  return `${years} an${years > 1 ? "s" : ""}`;
};

const formatStatusLabel = (child: Child): string => {
  // Calculer le statut en fonction des données réelles plutôt que du statut stocké
  // pour éviter les incohérences
  if (child.vaccinesLate.length > 0 || child.vaccinesOverdue.length > 0) {
    return "En retard";
  }
  if (child.vaccinesDue.length > 0) {
    return "À faire";
  }
  // Si aucun vaccin en retard, à faire ou overdue, l'enfant est à jour
  return "À jour";
};

const statusBadgeClasses = (label: string): string => {
  switch (label) {
    case "À jour":
      return "bg-emerald-100 text-emerald-700";
    case "En retard":
      return "bg-amber-100 text-amber-700";
    case "À faire":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

const statusFilterOptions: Array<{ value: string; label: string }> = [
  { value: "Tous", label: "Tous les statuts" },
  { value: "À jour", label: "✅ À jour" },
  { value: "En retard", label: "⚠️ En retard" },
  { value: "À faire", label: "🗓️ À faire" },
  { value: "Pas à jour", label: "🔴 Pas à jour" },
];

type Props = {
  children: Child[];
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
  apiBase: string;
  token: string | null;
  regionOptions?: string[];
  role?: string | null;
  agentLevel?: string | null;
  activationFilter?: string;
  onActivationFilterChange?: (filter: string) => void;
};

export default function ChildrenTab({
  children,
  loading,
  error,
  onRefresh,
  apiBase,
  token,
  regionOptions,
  role,
  agentLevel,
  activationFilter = "all",
  onActivationFilterChange,
}: Props) {
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("Toutes");
  const [districtFilter, setDistrictFilter] = useState<string>("Tous");
  const [healthCenterFilter, setHealthCenterFilter] = useState<string>("Tous");
  const [statusFilter, setStatusFilter] = useState<string>("Tous");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const isAgent = role?.toUpperCase() === "AGENT";
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingChildId, setDeletingChildId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    birthPlace: "",
    address: "",
    gender: "M" as "M" | "F",
    emailParent: "",
    phoneParent: "",
    fatherName: "",
    motherName: "",
  });

  const normalizedRole = role?.toUpperCase() ?? "NATIONAL";
  const normalizedAgentLevel = agentLevel?.toUpperCase() ?? null;
  const canEditVaccinations =
    normalizedRole === "AGENT" && normalizedAgentLevel === "ADMIN";
  const showRegionFilter = normalizedRole === "NATIONAL" || normalizedRole === "REGIONAL";
  const showDistrictFilter =
    normalizedRole === "NATIONAL" || normalizedRole === "REGIONAL";
  const showHealthCenterFilter =
    normalizedRole === "NATIONAL" ||
    normalizedRole === "REGIONAL" ||
    normalizedRole === "DISTRICT";

  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setCreateError("Non authentifié");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch(`${apiBase}/api/children`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? `Erreur ${response.status}`);
      }

      setCreateModalOpen(false);
      setFormData({
        firstName: "",
        lastName: "",
        birthDate: "",
        birthPlace: "",
        address: "",
        gender: "M",
        emailParent: "",
        phoneParent: "",
        fatherName: "",
        motherName: "",
      });
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteChild = async (childId: string, childName: string) => {
    if (!token) {
      setDeleteError("Non authentifié");
      return;
    }

    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir supprimer l'enfant "${childName}" ? Cette action est irréversible et supprimera toutes les données associées (vaccinations, rendez-vous, etc.).`
    );

    if (!confirmed) {
      return;
    }

    setDeletingChildId(childId);
    setDeleteError(null);

    try {
      const response = await fetch(`${apiBase}/api/children/${childId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? `Erreur ${response.status}`);
      }

      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erreur lors de la suppression");
    } finally {
      setDeletingChildId(null);
    }
  };

  const derivedRegions = useMemo(() => {
    const values = new Set<string>();
    children.forEach((child) => {
      const name = child.region?.trim();
      if (name) values.add(name);
    });
    return Array.from(values);
  }, [children]);

  const regions = useMemo(() => {
    const values = new Set<string>();
    derivedRegions.forEach((region) => values.add(region.trim()));
    regionOptions?.forEach((name) => {
      const label = name.trim();
      if (label) values.add(label);
    });
    return Array.from(values).sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" })
    );
  }, [derivedRegions, regionOptions]);

  const districts = useMemo(() => {
    const values = new Set<string>();
    children.forEach((child) => {
      const regionMatch =
        !showRegionFilter ||
        regionFilter === "Toutes" ||
        child.region?.trim().localeCompare(regionFilter, "fr", {
          sensitivity: "base",
        }) === 0;

      if (!regionMatch) return;

      const name = child.district?.trim();
      if (name) values.add(name);
    });
    return Array.from(values).sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" })
    );
  }, [children, regionFilter, showRegionFilter]);

  const healthCenters = useMemo(() => {
    const values = new Set<string>();
    children.forEach((child) => {
      const regionMatch =
        !showRegionFilter ||
        regionFilter === "Toutes" ||
        child.region?.trim().localeCompare(regionFilter, "fr", {
          sensitivity: "base",
        }) === 0;
      if (!regionMatch) return;

      const districtMatch =
        !showDistrictFilter ||
        districtFilter === "Tous" ||
        child.district?.trim().localeCompare(districtFilter, "fr", {
          sensitivity: "base",
        }) === 0;
      if (!districtMatch) return;

      const name = child.healthCenter?.trim();
      if (name) values.add(name);
    });
    return Array.from(values).sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" })
    );
  }, [children, regionFilter, districtFilter, showRegionFilter, showDistrictFilter]);

  useEffect(() => {
    if (
      showRegionFilter &&
      regionFilter !== "Toutes" &&
      !regions.includes(regionFilter)
    ) {
      setRegionFilter("Toutes");
    }
  }, [regionFilter, regions, showRegionFilter]);

  useEffect(() => {
    if (
      showDistrictFilter &&
      districtFilter !== "Tous" &&
      !districts.includes(districtFilter)
    ) {
      setDistrictFilter("Tous");
    }
  }, [districtFilter, districts, showDistrictFilter]);

  useEffect(() => {
    if (
      showHealthCenterFilter &&
      healthCenterFilter !== "Tous" &&
      !healthCenters.includes(healthCenterFilter)
    ) {
      setHealthCenterFilter("Tous");
    }
  }, [healthCenterFilter, healthCenters, showHealthCenterFilter]);

  const filteredChildren = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return children
      .filter((child) => {
        const statusLabel = formatStatusLabel(child);
        const matchesSearch =
          normalizedSearch.length === 0 ||
          child.firstName.toLowerCase().startsWith(normalizedSearch) ||
          child.lastName.toLowerCase().startsWith(normalizedSearch) ||
          child.name.toLowerCase().startsWith(normalizedSearch) ||
          (child.parentName ?? "").toLowerCase().startsWith(normalizedSearch) ||
          (child.parentPhone ?? "").startsWith(normalizedSearch);

        const matchesRegion =
          !showRegionFilter ||
          regionFilter === "Toutes" ||
          child.region?.trim().localeCompare(regionFilter, "fr", {
            sensitivity: "base",
          }) === 0;

        const matchesDistrict =
          !showDistrictFilter ||
          districtFilter === "Tous" ||
          child.district?.trim().localeCompare(districtFilter, "fr", {
            sensitivity: "base",
          }) === 0;

        const matchesHealthCenter =
          !showHealthCenterFilter ||
          healthCenterFilter === "Tous" ||
          child.healthCenter?.trim().localeCompare(healthCenterFilter, "fr", {
            sensitivity: "base",
          }) === 0;

        const matchesStatus =
          statusFilter === "Tous" || statusLabel === statusFilter;
        return (
          matchesSearch &&
          matchesRegion &&
          matchesDistrict &&
          matchesHealthCenter &&
          matchesStatus
        );
      })
      .sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return tb - ta;
      });
  }, [
    children,
    search,
    regionFilter,
    districtFilter,
    healthCenterFilter,
    statusFilter,
    showRegionFilter,
    showDistrictFilter,
    showHealthCenterFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredChildren.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filteredChildren.slice(startIndex, startIndex + pageSize);

  const stats = useMemo(() => {
    const total = children.length;
    const upToDate = children.filter((child) => formatStatusLabel(child) === "À jour").length;
    const late = children.filter((child) => formatStatusLabel(child) === "En retard").length;
    const scheduled = children.filter((child) => child.vaccinesScheduled.length > 0 || child.nextAppointment).length;
    return { total, upToDate, late, scheduled };
  }, [children]);

  let locationColumnLabel = "Centre";
  if (normalizedRole === "NATIONAL") {
    locationColumnLabel = "Région";
  } else if (normalizedRole === "REGIONAL") {
    locationColumnLabel = "District";
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 flex-1">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4">
            <p className="text-sm font-medium text-blue-700">Total enfants</p>
            <p className="text-3xl font-semibold text-blue-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
            <p className="text-sm font-medium text-emerald-700">À jour</p>
            <p className="text-3xl font-semibold text-emerald-900">{stats.upToDate}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-sm font-medium text-amber-700">En retard</p>
            <p className="text-3xl font-semibold text-amber-900">{stats.late}</p>
          </div>
          <div className="rounded-2xl border border-purple-200 bg-purple-50/80 p-4">
            <p className="text-sm font-medium text-purple-700">RDV programmés</p>
            <p className="text-3xl font-semibold text-purple-900">{stats.scheduled}</p>
          </div>
        </div>
        {isAgent && (
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="ml-4 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Ajouter un enfant
          </button>
        )}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-5 w-5 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-900">Filtres</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Rechercher un enfant ou parent"
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-11 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {showRegionFilter && (
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <select
                value={regionFilter}
                onChange={(event) => {
                  setRegionFilter(event.target.value);
                  setPage(1);
                }}
                className="w-full appearance-none rounded-xl border border-slate-300 py-2.5 pl-11 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="Toutes">Toutes les régions</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showDistrictFilter && (
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <select
                value={districtFilter}
                onChange={(event) => {
                  setDistrictFilter(event.target.value);
                  setPage(1);
                }}
                className="w-full appearance-none rounded-xl border border-slate-300 py-2.5 pl-11 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="Tous">Tous les districts</option>
                {districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showHealthCenterFilter && (
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <select
                value={healthCenterFilter}
                onChange={(event) => {
                  setHealthCenterFilter(event.target.value);
                  setPage(1);
                }}
                className="w-full appearance-none rounded-xl border border-slate-300 py-2.5 pl-11 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="Tous">Tous les centres</option>
                {healthCenters.map((center) => (
                  <option key={center} value={center}>
                    {center}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <AlertCircle className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="w-full appearance-none rounded-xl border border-slate-300 py-2.5 pl-11 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {onActivationFilterChange && (
            <div className="relative">
              <CheckCircle className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <select
                value={activationFilter}
                onChange={(event) => {
                  onActivationFilterChange(event.target.value);
                  setPage(1);
                }}
                className="w-full appearance-none rounded-xl border border-slate-300 py-2.5 pl-11 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="all">Tous les comptes</option>
                <option value="active">✅ Comptes actifs</option>
                <option value="inactive">⏳ Comptes en attente</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="text-sm text-slate-600">Chargement des enfants...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <p className="font-medium text-red-600">{error}</p>
          </div>
        </div>
      ) : filteredChildren.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Baby className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="font-medium text-slate-500">Aucun enfant trouvé</p>
          </div>
        </div>
      ) : (
        <>
          {deleteError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600">
                    <th className="px-6 py-4">Enfant</th>
                    <th className="px-6 py-4">Âge</th>
                    <th className="px-6 py-4">{locationColumnLabel}</th>
                    <th className="px-6 py-4">Centre</th>
                    <th className="px-6 py-4">Statut</th>
                    {isAgent && <th className="px-6 py-4">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {pageItems.map((child) => {
                    const badge = formatStatusLabel(child);
                    return (
                      <tr
                        key={child.id}
                        className={`cursor-pointer transition hover:bg-blue-50 ${
                          !child.isActive ? "bg-amber-50/50" : ""
                        }`}
                        onClick={() => setSelectedChild(child)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-11 w-11 items-center justify-center rounded-full font-semibold text-white shadow-sm ${
                                child.gender === "F"
                                  ? "bg-gradient-to-br from-pink-400 to-pink-500"
                                  : "bg-gradient-to-br from-blue-400 to-blue-500"
                              }`}
                            >
                              {child.firstName?.[0]}
                              {child.lastName?.[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{child.name}</p>
                              <p className="text-xs text-slate-500">{child.parentName || "Parent inconnu"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{formatAgeLabel(child.birthDate)}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {normalizedRole === "NATIONAL" ? child.region || "-" : child.district || "-"}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{child.healthCenter || "-"}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses(badge)}`}>
                              {badge}
                            </span>
                            {!child.isActive && (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                                ⏳ En attente de vérification
                              </span>
                            )}
                          </div>
                        </td>
                        {isAgent && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {!child.isActive && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // TODO: Ouvrir la page de comparaison
                                    window.location.href = `/dashboard/enfants/verification/${child.id}`;
                                  }}
                                  className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
                                >
                                  Comparer
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChild(child.id, child.name);
                                }}
                                disabled={deletingChildId === child.id}
                                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                              >
                                <Trash2 className="h-4 w-4" />
                                {deletingChildId === child.id ? "Suppression..." : "Supprimer"}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {filteredChildren.length > pageSize && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <p>
                Affichage {startIndex + 1} à {Math.min(startIndex + pageSize, filteredChildren.length)} sur {filteredChildren.length}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={currentPage <= 1}
                >
                  Précédent
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedChild && token && (
        <ChildDetailsModal
          apiBase={apiBase}
          token={token}
          child={selectedChild}
          onClose={() => setSelectedChild(null)}
          onRefresh={onRefresh}
          canSchedule={normalizedRole === "AGENT"}
          canEditVaccinations={canEditVaccinations}
        />
      )}

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Baby className="h-5 w-5 text-blue-600" />
                Ajouter un enfant
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateModalOpen(false);
                  setCreateError(null);
                  setFormData({
                    firstName: "",
                    lastName: "",
                    birthDate: "",
                    birthPlace: "",
                    address: "",
                    gender: "M",
                    emailParent: "",
                    phoneParent: "",
                    fatherName: "",
                    motherName: "",
                  });
                }}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChild} className="space-y-4 px-6 py-6">
              {createError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Date de naissance <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    required
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Lieu de naissance <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.birthPlace}
                    onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Sexe <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as "M" | "F" })}
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Adresse <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Nom du père
                  </label>
                  <input
                    type="text"
                    value={formData.fatherName}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Nom de la mère
                  </label>
                  <input
                    type="text"
                    value={formData.motherName}
                    onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email du parent
                  </label>
                  <input
                    type="email"
                    value={formData.emailParent}
                    onChange={(e) => setFormData({ ...formData, emailParent: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Téléphone du parent <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneParent}
                    onChange={(e) => setFormData({ ...formData, phoneParent: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setCreateError(null);
                    setFormData({
                      firstName: "",
                      lastName: "",
                      birthDate: "",
                      birthPlace: "",
                      address: "",
                      gender: "M",
                      emailParent: "",
                      phoneParent: "",
                      fatherName: "",
                      motherName: "",
                    });
                  }}
                  className="rounded-xl border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? "Création..." : "Créer l'enfant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
