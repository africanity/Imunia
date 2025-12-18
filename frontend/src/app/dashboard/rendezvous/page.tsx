"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Calendar, CalendarCheck, Loader2, Pencil, Search, Trash2, X } from "lucide-react";
import DashboardShell from "../components/DashboardShell";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type ScheduledEntry = {
  id: string;
  scheduledFor: string;
  dose: number;
  region: string | null;
  district: string | null;
  healthCenter: string | null;
  child: {
    id: string;
    firstName: string;
    lastName: string;
    gender?: string | null;
    birthDate?: string | null;
    healthCenter?: {
      id: string;
      name: string;
    } | null;
  } | null;
  vaccine: {
    id: string;
    name: string;
    dosesRequired?: string;
  } | null;
  vaccineCalendar: {
    id: string;
    description: string | null;
    ageUnit: string | null;
    minAge: number | null;
    maxAge: number | null;
    specificAge: number | null;
  } | null;
  administeredBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

type ScheduleOption = {
  vaccineId: string;
  calendarId: string | null;
  dose: number;
  label: string;
};

const formatDateTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};


type VaccineRequest = {
  id: string;
  childId: string;
  vaccineId: string;
  vaccineCalendarId: string | null;
  dose: number;
  status: "PENDING" | "SCHEDULED" | "CANCELLED";
  requestedAt: string;
  scheduledFor: string | null;
  scheduledById: string | null;
  appointmentId: string | null;
  notes: string | null;
  child: {
    id: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    gender: string;
    healthCenter: {
      id: string;
      name: string;
      address: string;
    };
  };
  vaccine: {
    id: string;
    name: string;
    description: string;
    dosesRequired: string;
  };
  vaccineCalendar: {
    id: string;
    description: string;
  } | null;
  scheduledBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

export default function RendezvousPage() {
  const { accessToken, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"appointments" | "requests">("appointments");
  const [entries, setEntries] = useState<ScheduledEntry[]>([]);
  const [requests, setRequests] = useState<VaccineRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ScheduledEntry | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editVaccineId, setEditVaccineId] = useState<string>("");
  const [editAdministeredById, setEditAdministeredById] = useState<string | null>(null);
  const [editOptionsLoading, setEditOptionsLoading] = useState(false);
  const [editOptions, setEditOptions] = useState<ScheduleOption[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ScheduledEntry | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [scheduleRequestId, setScheduleRequestId] = useState<string | null>(null);
  const [scheduleRequestDate, setScheduleRequestDate] = useState<string>("");
  const [scheduleRequestLoading, setScheduleRequestLoading] = useState(false);
  const [agents, setAgents] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; agentLevel: string | null }>>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [search, setSearch] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("Toutes");
  const [districtFilter, setDistrictFilter] = useState<string>("Tous");
  const [healthCenterFilter, setHealthCenterFilter] = useState<string>("Tous");
  const [allRegions, setAllRegions] = useState<string[]>([]);
 
   const normalizedRole = (user?.role ?? "").toUpperCase();
  const showRegionFilter = normalizedRole === "NATIONAL";
  const showDistrictFilter = normalizedRole === "NATIONAL" || normalizedRole === "REGIONAL";
  const showHealthCenterFilter =
    normalizedRole === "NATIONAL" ||
    normalizedRole === "REGIONAL" ||
    normalizedRole === "DISTRICT";
  const canManage = normalizedRole === "AGENT";
  const normalizedSearch = search.trim().toLowerCase();
 
  const fetchScheduled = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/vaccine/scheduled`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      const rawItems = Array.isArray(data?.items) ? data.items : [];
      const apiRegions = Array.isArray(data?.regions) ? data.regions : [];
      const items: ScheduledEntry[] = rawItems.map((item: any) => ({
        ...item,
        dose: item.dose ?? 1,
        region: item.region ?? null,
        district: item.district ?? null,
        healthCenter: item.healthCenter ?? item.child?.healthCenter?.name ?? null,
        vaccine: item.vaccine ?? null,
      }));
      setEntries(items);
      if (normalizedRole === "NATIONAL" && apiRegions.length > 0) {
        setAllRegions(
          apiRegions
            .map((region: any) => region?.name)
            .filter((name: string | undefined) => typeof name === "string")
            .sort((a: string, b: string) => a.localeCompare(b, "fr", { sensitivity: "base" })),
        );
      } else if (normalizedRole !== "NATIONAL") {
        setAllRegions([]);
      }
    } catch (err) {
      console.error("Erreur chargement rendez-vous:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les rendez-vous programmés.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, normalizedRole]);

  const fetchRequests = useCallback(async () => {
    if (!accessToken) {
      setRequestsLoading(false);
      return;
    }
    try {
      setRequestsLoading(true);
      const response = await fetch(`${API_URL}/api/vaccine-requests?status=PENDING`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (err) {
      console.error("Erreur chargement demandes:", err);
    } finally {
      setRequestsLoading(false);
    }
  }, [accessToken]);

  // Charger les agents du centre de santé
  const fetchAgents = useCallback(async () => {
    if (!accessToken || !canManage) return;
    setLoadingAgents(true);
    try {
      const response = await fetch(`${API_URL}/api/users/health-center/agents`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("Erreur chargement agents:", response.status);
        return;
      }

      const data = await response.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erreur chargement agents:", err);
    } finally {
      setLoadingAgents(false);
    }
  }, [accessToken, canManage]);

  const handleScheduleRequest = async (requestId: string) => {
    if (!accessToken || !scheduleRequestDate) return;

    try {
      setScheduleRequestLoading(true);
      const date = new Date(scheduleRequestDate);
      if (Number.isNaN(date.getTime())) {
        setError("Date invalide.");
        return;
      }

      const response = await fetch(`${API_URL}/api/vaccine-requests/${requestId}/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          scheduledFor: date.toISOString(),
          administeredById: selectedAgentId || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Impossible de programmer le rendez-vous.");
      }

      await fetchScheduled();
      await fetchRequests();
      setScheduleRequestId(null);
      setScheduleRequestDate("");
      setSelectedAgentId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la programmation");
    } finally {
      setScheduleRequestLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduled();
    if (canManage) {
      fetchRequests();
      fetchAgents();
    }
  }, [fetchScheduled, fetchRequests, fetchAgents, canManage]);

  useEffect(() => {
    if (!editTarget) {
      setEditDate("");
      setEditVaccineId("");
      setEditAdministeredById(null);
      setEditOptions([]);
      setEditOptionsLoading(false);
    } else {
      setEditAdministeredById(editTarget.administeredBy?.id ?? null);
    }
  }, [editTarget]);

  const regions = useMemo(() => {
    if (normalizedRole === "NATIONAL" && allRegions.length > 0) {
      return allRegions;
    }
    const values = new Set<string>();
    entries.forEach((entry) => {
      const name = entry.region?.trim();
      if (name && name.length > 0) {
        values.add(name);
      }
    });
    return Array.from(values).sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" }),
    );
  }, [allRegions, entries, normalizedRole]);

  const districts = useMemo(() => {
    const values = new Set<string>();
    entries.forEach((entry) => {
      const regionMatches =
        !showRegionFilter ||
        regionFilter === "Toutes" ||
        (entry.region ?? "").localeCompare(regionFilter, "fr", {
          sensitivity: "base",
        }) === 0;
      if (!regionMatches) return;
      const name = entry.district?.trim();
      if (name && name.length > 0) {
        values.add(name);
      }
    });
    return Array.from(values).sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" }),
    );
  }, [entries, regionFilter, showRegionFilter]);

  const healthCenters = useMemo(() => {
    const values = new Set<string>();
    entries.forEach((entry) => {
      const regionMatches =
        !showRegionFilter ||
        regionFilter === "Toutes" ||
        (entry.region ?? "").localeCompare(regionFilter, "fr", {
          sensitivity: "base",
        }) === 0;
      if (!regionMatches) return;
      const districtMatches =
        !showDistrictFilter ||
        districtFilter === "Tous" ||
        (entry.district ?? "").localeCompare(districtFilter, "fr", {
          sensitivity: "base",
        }) === 0;
      if (!districtMatches) return;
      const name = entry.healthCenter?.trim();
      if (name && name.length > 0) {
        values.add(name);
      }
    });
    return Array.from(values).sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" }),
    );
  }, [entries, regionFilter, districtFilter, showRegionFilter, showDistrictFilter]);

  const handleRegionChange = (value: string) => {
    setRegionFilter(value);
    setDistrictFilter("Tous");
    setHealthCenterFilter("Tous");
  };

  const handleDistrictChange = (value: string) => {
    setDistrictFilter(value);
    setHealthCenterFilter("Tous");
  };

  const handleHealthCenterChange = (value: string) => {
    setHealthCenterFilter(value);
  };

  useEffect(() => {
    if (
      showRegionFilter &&
      regionFilter !== "Toutes" &&
      !regions.some(
        (region) =>
          region.localeCompare(regionFilter, "fr", { sensitivity: "base" }) === 0,
      )
    ) {
      setRegionFilter("Toutes");
    }
  }, [regions, regionFilter, showRegionFilter]);

  useEffect(() => {
    if (
      showDistrictFilter &&
      districtFilter !== "Tous" &&
      !districts.some(
        (district) =>
          district.localeCompare(districtFilter, "fr", { sensitivity: "base" }) === 0,
      )
    ) {
      setDistrictFilter("Tous");
    }
  }, [districts, districtFilter, showDistrictFilter]);

  useEffect(() => {
    if (
      showHealthCenterFilter &&
      healthCenterFilter !== "Tous" &&
      !healthCenters.some(
        (center) =>
          center.localeCompare(healthCenterFilter, "fr", { sensitivity: "base" }) === 0,
      )
    ) {
      setHealthCenterFilter("Tous");
    }
  }, [healthCenters, healthCenterFilter, showHealthCenterFilter]);

  const filteredEntries = useMemo(() => {
     return entries.filter((entry) => {
       const regionMatches =
         !showRegionFilter ||
         regionFilter === "Toutes" ||
         (entry.region ?? "").localeCompare(regionFilter, "fr", {
           sensitivity: "base",
         }) === 0;
 
       if (!regionMatches) return false;
 
       const districtMatches =
         !showDistrictFilter ||
         districtFilter === "Tous" ||
         (entry.district ?? "").localeCompare(districtFilter, "fr", {
           sensitivity: "base",
         }) === 0;
 
       if (!districtMatches) return false;
 
       const healthCenterMatches =
         !showHealthCenterFilter ||
         healthCenterFilter === "Tous" ||
         (entry.healthCenter ?? "").localeCompare(healthCenterFilter, "fr", {
           sensitivity: "base",
         }) === 0;
 
      if (!healthCenterMatches) return false;

      const childFirst = (entry.child?.firstName ?? "").toLowerCase();
      const childLast = (entry.child?.lastName ?? "").toLowerCase();
      const combinedName = `${childFirst} ${childLast}`.trim();
      const vaccineName = (entry.vaccine?.name ?? "").toLowerCase();
      const healthCenterName = (entry.healthCenter ?? "").toLowerCase();
      const regionName = (entry.region ?? "").toLowerCase();
      const districtName = (entry.district ?? "").toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        childFirst.startsWith(normalizedSearch) ||
        childLast.startsWith(normalizedSearch) ||
        combinedName.includes(normalizedSearch) ||
        vaccineName.includes(normalizedSearch) ||
        healthCenterName.includes(normalizedSearch) ||
        regionName.includes(normalizedSearch) ||
        districtName.includes(normalizedSearch) ||
        entry.id.toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) return false;

      return true;
    });
  }, [
    entries,
    regionFilter,
    districtFilter,
    healthCenterFilter,
    showRegionFilter,
    showDistrictFilter,
    showHealthCenterFilter,
    normalizedSearch,
  ]);

  const handleComplete = useCallback(
    async (entryId: string) => {
      if (!accessToken || !canManage) return;
      setCompletingId(entryId);
      try {
        const response = await fetch(
          `${API_URL}/api/vaccine/scheduled/${entryId}/complete`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ notes: "" }),
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? "Impossible de valider le vaccin.");
        }

        setEntries((current) => current.filter((item) => item.id !== entryId));
      } catch (err) {
        console.error("Erreur validation vaccin:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de marquer le vaccin comme effectué.",
        );
      } finally {
        setCompletingId(null);
      }
    },
    [accessToken, canManage],
  );

  const openEditModal = useCallback(
    async (entry: ScheduledEntry) => {
      if (!canManage || !accessToken || !entry.child?.id) {
        setEditError("Impossible de récupérer les informations de ce rendez-vous.");
        setEditTarget(null);
        setEditDate("");
        setEditVaccineId("");
        return;
      }

      try {
        setEditOptionsLoading(true);
        setEditError(null);
        const response = await fetch(
          `${API_URL}/api/children/${entry.child.id}/vaccinations`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(
            payload?.message ?? "Impossible de charger les vaccins disponibles.",
          );
        }

        type VaccinationList = {
          vaccinations: {
            due: Array<{
              vaccineId: string;
              vaccineName: string;
              calendarId: string | null;
              dose: number;
            }>;
            late: Array<{
              vaccineId: string;
              vaccineName: string;
              calendarId: string | null;
              dose: number;
            }>;
            overdue: Array<{
              vaccineId: string;
              vaccineName: string;
              calendarId: string | null;
              dose: number;
            }>;
            scheduled: Array<{
              vaccineId: string;
              vaccineName: string;
              calendarId: string | null;
              dose: number;
            }>;
            completed: Array<{
              vaccineId: string;
              vaccineName: string;
              calendarId: string | null;
              dose: number;
            }>;
          };
        };

        const detail: VaccinationList = await response.json();

        const completedDosesByVaccine = detail.vaccinations.completed.reduce<
          Record<string, Set<number>>
        >((acc, entry) => {
          if (!acc[entry.vaccineId]) {
            acc[entry.vaccineId] = new Set();
          }
          acc[entry.vaccineId].add(entry.dose);
          return acc;
        }, {});

        const optionMap = new Map<string, ScheduleOption>();
        const pushOption = (
          vaccineId: string,
          vaccineName: string,
          calendarId: string | null,
          context: string,
          dose: number,
        ) => {
          if (!vaccineId || !vaccineName) return;
          const completedSet = completedDosesByVaccine[vaccineId] ?? new Set<number>();
          const maxCompletedDose = completedSet.size > 0 ? Math.max(...completedSet) : 0;
          const nextAllowedDose = maxCompletedDose + 1;
          if (dose !== nextAllowedDose) {
            return;
          }
          if (!optionMap.has(vaccineId)) {
            optionMap.set(vaccineId, {
              vaccineId,
              calendarId,
              dose,
              label:
                context && context.trim().length > 0
                  ? `${vaccineName} • ${context}`
                  : vaccineName,
            });
          }
        };

        detail.vaccinations.due.forEach((item) =>
          pushOption(
            item.vaccineId,
            item.vaccineName,
            item.calendarId,
            `dose ${item.dose} à faire`,
            item.dose,
          ),
        );
        detail.vaccinations.late.forEach((item) =>
          pushOption(
            item.vaccineId,
            item.vaccineName,
            item.calendarId,
            `dose ${item.dose} en retard`,
            item.dose,
          ),
        );
        detail.vaccinations.overdue.forEach((item) =>
          pushOption(
            item.vaccineId,
            item.vaccineName,
            item.calendarId,
            `dose ${item.dose} manquée`,
            item.dose,
          ),
        );
        detail.vaccinations.scheduled.forEach((item) =>
          pushOption(
            item.vaccineId,
            item.vaccineName,
            item.calendarId,
            `dose ${item.dose} programmée`,
            item.dose,
          ),
        );
        detail.vaccinations.completed.forEach((item) =>
          pushOption(
            item.vaccineId,
            item.vaccineName,
            item.calendarId,
            `dose ${item.dose} administrée`,
            item.dose,
          ),
        );

        const options = Array.from(optionMap.values()).sort((a, b) =>
          a.label.localeCompare(b.label, "fr", { sensitivity: "base" }),
        );

        setEditOptions(options);
        if (options.length === 0) {
          setEditVaccineId("");
        } else {
          const matchingOption = options.find(
            (option) =>
              option.vaccineId === entry.vaccine?.id && option.dose === entry.dose,
          );
          const defaultOption = matchingOption ?? options[0];
          setEditVaccineId(defaultOption?.vaccineId ?? "");
        }
        const initialValue = new Date(entry.scheduledFor)
          .toISOString()
          .slice(0, 16);
        setEditDate(initialValue);
        setEditTarget(entry);
      } catch (err) {
        console.error("Erreur chargement options rendez-vous:", err);
        setEditError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les vaccins disponibles.",
        );
        setEditTarget(null);
      } finally {
        setEditOptionsLoading(false);
      }
    },
    [accessToken, canManage],
  );

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white/70 px-6 py-10 text-slate-600 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement des rendez-vous…
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-start gap-3 rounded-3xl border border-rose-200 bg-rose-50/80 p-6 text-sm text-rose-600">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Erreur lors du chargement</p>
            <p className="mt-1 text-rose-500/80">{error}</p>
            <button
              type="button"
              onClick={fetchScheduled}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }

    if (entries.length === 0) {
      return (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 text-sm text-emerald-700">
          Aucun rendez-vous n&apos;est programmé pour le moment.
        </div>
      );
    }

    if (filteredEntries.length === 0) {
      return (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-500">
          Aucun rendez-vous ne correspond aux filtres sélectionnés.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filteredEntries.map((entry) => {
          const childName = entry.child
            ? `${entry.child.firstName ?? ""} ${entry.child.lastName ?? ""}`.trim()
            : "Enfant inconnu";
          const healthCenterName =
            entry.child?.healthCenter?.name ?? "Centre non renseigné";
          const vaccineName = entry.vaccine?.name ?? "Vaccin inconnu";
          const doseLabel = `Dose ${entry.dose ?? 1}${
            entry.vaccine?.dosesRequired ? ` / ${entry.vaccine.dosesRequired}` : ""
          }`;
          const agentName = entry.administeredBy
            ? `${entry.administeredBy.firstName} ${entry.administeredBy.lastName}`.trim()
            : null;

          return (
            <div
              key={entry.id}
              className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-wide text-slate-500">
                    Rendez-vous programmé
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    {childName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {vaccineName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{doseLabel}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Centre de santé : {healthCenterName}
                  </p>
                  {agentName && (
                    <p className="mt-1 text-sm text-slate-600">
                      Agent : <span className="font-medium">{agentName}</span>
                    </p>
                  )}
                </div>
                <div className="text-right text-sm text-slate-600">
                  <p className="font-medium text-slate-900">
                    {formatDateTime(entry.scheduledFor)}
                  </p>
                  {entry.child?.birthDate && (
                    <p className="mt-1 text-xs text-slate-500">
                      Né(e) le{" "}
                      {new Intl.DateTimeFormat("fr-FR").format(
                        new Date(entry.child.birthDate),
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <CalendarCheck className="h-4 w-4 text-emerald-500" />
                  <span>ID rendez-vous : {entry.id}</span>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(entry)}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      <Pencil className="h-4 w-4" />
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCancelError(null);
                        setCancelTarget(entry);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => handleComplete(entry.id)}
                      disabled={completingId === entry.id}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {completingId === entry.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Validation…
                        </>
                      ) : (
                        <>
                          <CalendarCheck className="h-4 w-4" />
                          Marquer effectué
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs italic text-slate-400">
                    Lecture seule
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [
    canManage,
    entries,
    filteredEntries,
    error,
    loading,
    completingId,
    fetchScheduled,
    handleComplete,
  ]);

  return (
    <DashboardShell active="/dashboard/rendezvous">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-500">
            Suivi vaccinal
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Rendez-vous et demandes
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {activeTab === "appointments"
              ? "Consultez les vaccinations planifiées et marquez-les comme effectuées après administration."
              : "Gérez les demandes de vaccination des parents"}
          </p>
        </div>
        {activeTab === "appointments" && (
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
            {filteredEntries.length} rendez-vous à traiter
          </div>
        )}
      </div>

      {/* Onglets */}
      {canManage && (
        <div className="mb-6 flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("appointments")}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === "appointments"
                ? "border-b-2 border-emerald-500 text-emerald-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Rendez-vous programmés
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === "requests"
                ? "border-b-2 border-emerald-500 text-emerald-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Demandes en attente
            {requests.length > 0 && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {requests.length}
              </span>
            )}
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="flex min-w-[220px] flex-col text-xs">
          <span className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
            Recherche
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un enfant, vaccin ou centre"
              className="w-full rounded-xl border border-slate-200 px-4 py-2 pl-9 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
        </div>
        {showRegionFilter && (
          <div className="flex flex-col text-xs">
            <span className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
              Région
            </span>
            <select
              value={regionFilter}
              onChange={(event) => handleRegionChange(event.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="Toutes">Toutes les régions</option>
              {regions.length === 0 ? (
                <option value="" disabled>
                  Aucune région disponible
                </option>
              ) : (
                regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
        {showDistrictFilter && (
          <div className="flex flex-col text-xs">
            <span className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
              District
            </span>
            <select
              value={districtFilter}
              onChange={(event) => handleDistrictChange(event.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="Tous">Tous les districts</option>
              {districts.length === 0 ? (
                <option value="" disabled>
                  Aucun district disponible
                </option>
              ) : (
                districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
        {showHealthCenterFilter && (
          <div className="flex flex-col text-xs">
            <span className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
              Centre de santé
            </span>
            <select
              value={healthCenterFilter}
              onChange={(event) => handleHealthCenterChange(event.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="Tous">Tous les centres</option>
              {healthCenters.length === 0 ? (
                <option value="" disabled>
                  Aucun centre disponible
                </option>
              ) : (
                healthCenters.map((center) => (
                  <option key={center} value={center}>
                    {center}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
      </div>
      {activeTab === "requests" ? (
        <div className="space-y-4">
          {error && (
            <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                <div className="flex-1">
                  <p className="font-semibold">Erreur</p>
                  <p className="mt-1">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="flex-shrink-0 rounded-full p-1 text-red-600 transition hover:bg-red-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          {requestsLoading ? (
            <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white/70 px-6 py-10 text-slate-600 shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
              Chargement des demandes…
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-500">
              Aucune demande en attente.
            </div>
          ) : (
            requests.map((request) => {
              const childName = `${request.child.firstName} ${request.child.lastName}`.trim();
              const vaccineName = request.vaccine.name;
              const doseLabel = `Dose ${request.dose} / ${request.vaccine.dosesRequired}`;
              const requestedDate = new Date(request.requestedAt);

              return (
                <div
                  key={request.id}
                  className="rounded-3xl border border-blue-200 bg-blue-50/80 p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-wide text-blue-600">
                        Demande de vaccination
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-900">{childName}</h2>
                      <p className="mt-1 text-sm text-slate-600">{vaccineName}</p>
                      <p className="mt-1 text-xs text-slate-500">{doseLabel}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Centre de santé : {request.child.healthCenter.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Demandé le{" "}
                        {new Intl.DateTimeFormat("fr-FR", {
                          dateStyle: "long",
                          timeStyle: "short",
                        }).format(requestedDate)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 space-y-3">
                    <div className="flex-1">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Date et heure du rendez-vous
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduleRequestId === request.id ? scheduleRequestDate : ""}
                        onChange={(e) => {
                          setScheduleRequestId(request.id);
                          setScheduleRequestDate(e.target.value);
                        }}
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Agent qui administrera le vaccin (optionnel)
                      </label>
                      {loadingAgents ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Chargement des agents...
                        </div>
                      ) : (
                        <select
                          value={scheduleRequestId === request.id ? (selectedAgentId ?? "") : ""}
                          onChange={(e) => {
                            setScheduleRequestId(request.id);
                            setSelectedAgentId(e.target.value || null);
                          }}
                          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        >
                          <option value="">Aucun agent spécifié</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.firstName} {agent.lastName}
                              {agent.agentLevel === "ADMIN" ? " (Admin)" : ""}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleScheduleRequest(request.id)}
                      disabled={
                        scheduleRequestLoading ||
                        scheduleRequestId !== request.id ||
                        !scheduleRequestDate
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {scheduleRequestLoading && scheduleRequestId === request.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Programmation…
                        </>
                      ) : (
                        <>
                          <CalendarCheck className="h-4 w-4" />
                          Programmer
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <>
          {content}
          {editTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-blue-500">Modifier le rendez-vous</p>
              <h3 className="text-lg font-semibold text-slate-900">
                {`${editTarget.child?.firstName ?? ""} ${editTarget.child?.lastName ?? ""}`.trim() ||
                  "Enfant"}
              </h3>
            </div>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!accessToken || !editTarget) return;
                if (!editDate) {
                  setEditError("Choisissez une date et une heure.");
                  return;
                }
                const date = new Date(editDate);
                if (Number.isNaN(date.getTime())) {
                  setEditError("Date invalide.");
                  return;
                }
                if (!editVaccineId) {
                  setEditError("Sélectionnez un vaccin.");
                  return;
                }
                const selectedOption = editOptions.find(
                  (option) => option.vaccineId === editVaccineId,
                );
                if (!selectedOption) {
                  setEditError("Sélectionnez un vaccin valide.");
                  return;
                }
                try {
                  setEditLoading(true);
                  setEditError(null);
                  const response = await fetch(
                    `${API_URL}/api/vaccine/scheduled/${editTarget.id}`,
                    {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                      },
                      body: JSON.stringify({
                        scheduledFor: date.toISOString(),
                        vaccineId: editVaccineId,
                        vaccineCalendarId: selectedOption.calendarId,
                        administeredById: editAdministeredById || null,
                      }),
                    },
                  );
                  if (!response.ok) {
                    const payload = await response.json().catch(() => null);
                    throw new Error(
                      payload?.message ?? "Impossible de modifier le rendez-vous.",
                    );
                  }
                  await fetchScheduled();
                  setEditTarget(null);
                  setEditDate("");
                  setEditVaccineId("");
                  setEditError(null);
                } catch (err) {
                  console.error("Erreur modification rendez-vous:", err);
                  setEditError(
                    err instanceof Error
                      ? err.message
                      : "Impossible de modifier le rendez-vous.",
                  );
                } finally {
                  setEditLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vaccin
                </label>
                {editOptionsLoading ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement des vaccins…
                  </div>
                ) : editOptions.length === 0 ? (
                  <p className="mt-2 text-xs text-red-500">
                    Aucun vaccin disponible pour ce rendez-vous.
                  </p>
                ) : (
                  <select
                    value={editVaccineId}
                    onChange={(event) => setEditVaccineId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    required
                  >
                    <option value="">— Sélectionner un vaccin —</option>
                    {editOptions.map((option) => (
                      <option key={option.vaccineId} value={option.vaccineId}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nouvelle date et heure
                </label>
                <input
                  type="datetime-local"
                  value={editDate}
                  onChange={(event) => setEditDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  min={new Date().toISOString().slice(0, 16)}
                  required
                />
              </div>
              {canManage && agents.length > 0 && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Agent qui va administrer le vaccin
                  </label>
                  <select
                    value={editAdministeredById || ""}
                    onChange={(event) => setEditAdministeredById(event.target.value || null)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="">— Aucun agent sélectionné —</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.firstName} {agent.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {editError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{editError}</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditTarget(null);
                    setEditDate("");
                    setEditVaccineId("");
                    setEditError(null);
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editLoading || editOptionsLoading || editOptions.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {editLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Modification…
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4" />
                      Reprogrammer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-red-500">Annuler le rendez-vous</p>
              <h3 className="text-lg font-semibold text-slate-900">
                {`${cancelTarget.child?.firstName ?? ""} ${cancelTarget.child?.lastName ?? ""}`.trim() ||
                  "Enfant"}
              </h3>
            </div>
            <p className="text-sm text-slate-600">
              Voulez-vous vraiment annuler ce rendez-vous prévu le{" "}
              {formatDateTime(cancelTarget.scheduledFor)} ?
            </p>
            {cancelError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{cancelError}</p>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelError(null);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={cancelLoading}
                onClick={async () => {
                  if (!accessToken || !cancelTarget) return;
                  try {
                    setCancelLoading(true);
                    setCancelError(null);
                    const response = await fetch(
                      `${API_URL}/api/vaccine/scheduled/${cancelTarget.id}`,
                      {
                        method: "DELETE",
                        headers: {
                          Authorization: `Bearer ${accessToken}`,
                        },
                      },
                    );
                    if (!response.ok) {
                      const payload = await response.json().catch(() => null);
                      throw new Error(
                        payload?.message ?? "Impossible d'annuler le rendez-vous.",
                      );
                    }
                    await fetchScheduled();
                    setCancelTarget(null);
                    setCancelError(null);
                  } catch (err) {
                    console.error("Erreur annulation rendez-vous:", err);
                    setCancelError(
                      err instanceof Error
                        ? err.message
                        : "Impossible d'annuler le rendez-vous.",
                    );
                  } finally {
                    setCancelLoading(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {cancelLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Annulation…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Confirmer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </DashboardShell>
  );
}

