"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  Clock,
  FileDown,
  Pencil,
  Plus,
  Syringe,
  Trash2,
  X,
} from "lucide-react";
import DashboardShell from "@/app/dashboard/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type AgeUnit = "WEEKS" | "MONTHS" | "YEARS";

type CalendarVaccine = {
  id: string;
  name: string;
  description: string;
  dosesRequired: string;
  doseCount: number;
  gender?: string | null;
  firstDoseNumber: number | null;
  lastDoseNumber: number | null;
  doseNumbers?: number[];
};

type CalendarEntry = {
  id: string;
  description: string;
  ageUnit: AgeUnit;
  specificAge: number | null;
  minAge: number | null;
  maxAge: number | null;
  vaccines: CalendarVaccine[];
  targetAgeLabel?: string | null;
  ageRangeLabel?: string | null;
  ageSortWeight?: number | null;
};

type VaccineOption = {
  id: string;
  name: string;
  description: string;
  dosesRequired?: string;
};

type VaccineSelection = {
  key: string;
  vaccineId: string;
  count: string;
};

type DoseWarning = {
  vaccineId: string;
  name: string;
  requiredDoses: number;
  plannedDoses: number;
  missingDoses: number;
};

type EditFormState = {
  id: string;
  description: string;
  ageUnit: AgeUnit;
  specificAge: string;
  minAge: string;
  maxAge: string;
  vaccines: VaccineSelection[];
};

type CalendarResponse =
  | {
      id: string;
      description: string;
      ageUnit: AgeUnit;
      specificAge: number | null;
      minAge: number | null;
      maxAge: number | null;
      vaccines: CalendarVaccine[];
    }[]
  | {
      calendar: {
        id: string;
        description: string;
        ageUnit: AgeUnit;
        specificAge: number | null;
        minAge: number | null;
        maxAge: number | null;
        vaccines: CalendarVaccine[];
      }[];
    };

export default function CalendrierVaccinalPage() {
  const DAYS_PER_WEEK = 7;
  const DAYS_PER_MONTH = 30.4375;
  const DAYS_PER_YEAR = 365.25;

  const normalizeAgeToDays = useCallback((value: number | string | null, unit: AgeUnit) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return null;
    }
    switch (unit) {
      case "WEEKS":
        return numeric * DAYS_PER_WEEK;
      case "MONTHS":
        return numeric * DAYS_PER_MONTH;
      case "YEARS":
        return numeric * DAYS_PER_YEAR;
      default:
        return numeric;
    }
  }, []);

  const formatDaysLabel = useCallback((days: number | null) => {
    if (days === null || days === undefined) {
      return null;
    }
    let remaining = Math.max(0, Math.round(days));
    const years = Math.floor(remaining / DAYS_PER_YEAR);
    remaining -= years * DAYS_PER_YEAR;
    const months = Math.floor(remaining / DAYS_PER_MONTH);
    remaining -= months * DAYS_PER_MONTH;
    const weeks = Math.floor(remaining / DAYS_PER_WEEK);
    const parts: string[] = [];
    if (years) parts.push(`${years} an${years > 1 ? "s" : ""}`);
    if (months) parts.push(`${months} mois`);
    if (weeks) parts.push(`${weeks} semaine${weeks > 1 ? "s" : ""}`);
    if (!parts.length) return "0 semaine";
    return parts.join(" ");
  }, []);

  const buildAgeRangeLabel = useCallback(
    (minAge: number | null, maxAge: number | null, unit: AgeUnit) => {
      const minLabel = formatDaysLabel(normalizeAgeToDays(minAge, unit));
      const maxLabel = formatDaysLabel(normalizeAgeToDays(maxAge, unit));
      if (minLabel && maxLabel) return `${minLabel} - ${maxLabel}`;
      if (minLabel) return `À partir de ${minLabel}`;
      if (maxLabel) return `Jusqu'à ${maxLabel}`;
      return null;
    },
    [formatDaysLabel, normalizeAgeToDays],
  );
  const { accessToken, user } = useAuth();
  const isNational = user?.role === "NATIONAL";

  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [vaccines, setVaccines] = useState<VaccineOption[]>([]);
  const [doseWarnings, setDoseWarnings] = useState<DoseWarning[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warningsLoading, setWarningsLoading] = useState(false);
  const [warningsError, setWarningsError] = useState<string | null>(null);

  const [ageUnit, setAgeUnit] = useState<AgeUnit>("MONTHS");
  const [specificAge, setSpecificAge] = useState<string>("");
  const [minAge, setMinAge] = useState<string>("");
  const [maxAge, setMaxAge] = useState<string>("");
  const [selectedVaccines, setSelectedVaccines] = useState<VaccineSelection[]>([]);
  const [description, setDescription] = useState<string>("");
  const targetAgePreview = useMemo(
    () => formatDaysLabel(normalizeAgeToDays(Number(specificAge), ageUnit)),
    [specificAge, ageUnit, formatDaysLabel, normalizeAgeToDays],
  );

  const rangeAgePreview = useMemo(
    () => buildAgeRangeLabel(
      Number(minAge),
      Number(maxAge),
      ageUnit,
    ),
    [minAge, maxAge, ageUnit, buildAgeRangeLabel],
  );

  const [createOpen, setCreateOpen] = useState(false);

  const createEmptyEditForm = (): EditFormState => ({
    id: "",
    description: "",
    ageUnit: "MONTHS",
    specificAge: "",
    minAge: "",
    maxAge: "",
    vaccines: [],
  });

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>(() => createEmptyEditForm());
  const [editError, setEditError] = useState<string | null>(null);
  const editTargetAgePreview = useMemo(
    () =>
      formatDaysLabel(
        normalizeAgeToDays(
          Number(editForm.specificAge),
          editForm.ageUnit,
        ),
      ),
    [editForm.specificAge, editForm.ageUnit, formatDaysLabel, normalizeAgeToDays],
  );

  const editRangeAgePreview = useMemo(
    () =>
      buildAgeRangeLabel(
        Number(editForm.minAge),
        Number(editForm.maxAge),
        editForm.ageUnit,
      ),
    [editForm.minAge, editForm.maxAge, editForm.ageUnit, buildAgeRangeLabel],
  );

  const [pdfLoading, setPdfLoading] = useState(false);
  const [warningModalOpen, setWarningModalOpen] = useState(false);

  const fetchCalendar = useCallback(async () => {
    if (!accessToken) {
      setEntries([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/vaccine/calendar`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const data: CalendarResponse = await response.json();
      const list = Array.isArray(data) ? data : data?.calendar ?? [];

      const mapped: CalendarEntry[] = list.map((entry) => {
        const specificAge =
          entry.specificAge != null ? Number(entry.specificAge) : null;
        const minAge = entry.minAge != null ? Number(entry.minAge) : null;
        const maxAge = entry.maxAge != null ? Number(entry.maxAge) : null;
        const targetAgeLabel =
          entry.targetAgeLabel ??
          formatDaysLabel(normalizeAgeToDays(specificAge, entry.ageUnit));
        const ageRangeLabel =
          entry.ageRangeLabel ??
          buildAgeRangeLabel(minAge, maxAge, entry.ageUnit);
        const ageSortWeight =
          typeof entry.ageSortWeight === "number"
            ? entry.ageSortWeight
            : normalizeAgeToDays(specificAge, entry.ageUnit) ??
              normalizeAgeToDays(minAge, entry.ageUnit) ??
              normalizeAgeToDays(maxAge, entry.ageUnit) ??
              0;

        return {
          id: entry.id,
          description: entry.description,
          ageUnit: entry.ageUnit,
          specificAge,
          minAge,
          maxAge,
          targetAgeLabel,
          ageRangeLabel,
          ageSortWeight,
          vaccines: (entry.vaccines ?? []).map((vaccine) => ({
            id: vaccine.id,
            name: vaccine.name,
            description: vaccine.description,
            dosesRequired: vaccine.dosesRequired,
            gender: vaccine.gender ?? null,
            doseCount:
              vaccine.doseCount != null ? Number(vaccine.doseCount) : 0,
            firstDoseNumber:
              vaccine.firstDoseNumber != null
                ? Number(vaccine.firstDoseNumber)
                : null,
            lastDoseNumber:
              vaccine.lastDoseNumber != null
                ? Number(vaccine.lastDoseNumber)
                : null,
            doseNumbers: Array.isArray(vaccine.doseNumbers)
              ? vaccine.doseNumbers
                  .map((value) =>
                    typeof value === "number" ? value : Number(value),
                  )
                  .filter((value) => Number.isFinite(value))
                  .sort((a, b) => a - b)
              : [],
          })),
        };
      });

      setEntries(mapped);
    } catch (err) {
      console.error("Erreur chargement calendrier:", err);
      setEntries([]);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger le calendrier vaccinal"
      );
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    buildAgeRangeLabel,
    formatDaysLabel,
    normalizeAgeToDays,
  ]);

  const fetchVaccines = useCallback(async () => {
    if (!isNational || !accessToken) {
      setVaccines([]);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/vaccine`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const data = await response.json();
      const list = Array.isArray(data) ? data : data?.vaccines ?? [];

      const mapped: VaccineOption[] = list.map(
        (v: {
          id: string;
          name: string;
          description?: string;
          dosesRequired?: string;
        }) => ({
          id: v.id,
          name: v.name,
          description: v.description ?? "",
          dosesRequired: v.dosesRequired ?? "1",
        })
      );

      setVaccines(mapped);
    } catch (err) {
      console.error("Erreur chargement vaccins:", err);
      setVaccines([]);
    }
  }, [accessToken, isNational]);

  useEffect(() => {
    fetchCalendar();
    fetchVaccines();
  }, [fetchCalendar, fetchVaccines]);

  const fetchDoseWarnings = useCallback(async () => {
    if (!isNational || !accessToken) {
      setDoseWarnings([]);
      setWarningsError(null);
      return;
    }

    try {
      setWarningsLoading(true);
      setWarningsError(null);
      const response = await fetch(
        `${API_URL}/api/vaccine/calendar/dose-warnings`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }
      const payload = await response.json();
      const list: DoseWarning[] = Array.isArray(payload?.warnings)
        ? payload.warnings
        : [];
      setDoseWarnings(list);
    } catch (err) {
      console.error("Erreur chargement alertes doses:", err);
      setDoseWarnings([]);
      setWarningsError(
        err instanceof Error
          ? err.message
          : "Impossible de vérifier la couverture des doses.",
      );
    } finally {
      setWarningsLoading(false);
    }
  }, [accessToken, isNational]);

  useEffect(() => {
    fetchDoseWarnings();
  }, [fetchDoseWarnings]);

  const createSelectionKey = useCallback(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `selection-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, []);

  const resetForm = () => {
    setAgeUnit("MONTHS");
    setSpecificAge("");
    setMinAge("");
    setMaxAge("");
    setSelectedVaccines([]);
    setDescription("");
  };

  const translateUnit = (unit: AgeUnit) => {
    switch (unit) {
      case "WEEKS":
        return "semaines";
      case "MONTHS":
        return "mois";
      case "YEARS":
        return "ans";
      default:
        return unit.toLowerCase();
    }
  };

  const handleCreateVaccineSelect = useCallback(
    (value: string) => {
      if (!value) return;
      setSelectedVaccines((prev) => {
        if (prev.some((selection) => selection.vaccineId === value)) {
          setError("Ce vaccin est déjà configuré pour cette fenêtre.");
          return prev;
        }
        setError(null);
        return [
          ...prev,
          {
            key: createSelectionKey(),
            vaccineId: value,
            count: "1",
          },
        ];
      });
    },
    [createSelectionKey],
  );

  const handleCreateCountChange = (selectionKey: string, newCount: string) => {
    const sanitized = newCount.replace(/[^\d]/g, "");
    setSelectedVaccines((prev) =>
      prev.map((selection) =>
        selection.key === selectionKey
          ? { ...selection, count: sanitized || "1" }
          : selection,
      ),
    );
  };

  const handleRemoveSelectedVaccine = (selectionKey: string) => {
    setSelectedVaccines((prev) =>
      prev.filter((selection) => selection.key !== selectionKey),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isNational || !accessToken) return;

    if (!specificAge.trim()) {
      setError("Veuillez saisir l'âge ciblé.");
      return;
    }

    if (!minAge.trim() || !maxAge.trim()) {
      setError("Veuillez saisir les âges minimum et maximum.");
      return;
    }

    const specificAgeValue = Number(specificAge);
    const minAgeValue = Number(minAge);
    const maxAgeValue = Number(maxAge);

    if (Number.isNaN(specificAgeValue)) {
      setError("L'âge ciblé doit être un nombre valide.");
      return;
    }

    if (Number.isNaN(minAgeValue) || Number.isNaN(maxAgeValue)) {
      setError("Les âges minimum et maximum doivent être des nombres valides.");
      return;
    }

    if (minAgeValue > maxAgeValue) {
      setError("L'âge minimum doit être inférieur ou égal à l'âge maximum.");
      return;
    }

    if (selectedVaccines.length === 0) {
      setError("Veuillez sélectionner au moins un vaccin.");
      return;
    }

    if (selectedVaccines.some((item) => !item.count.trim())) {
      setError("Veuillez indiquer le nombre de doses pour chaque vaccin.");
      return;
    }

    if (
      selectedVaccines.some(
        (item) => Number(item.count) <= 0 || Number.isNaN(Number(item.count)),
      )
    ) {
      setError("Chaque vaccin doit avoir au moins une dose sur cette fenêtre.");
      return;
    }

    const payload = {
      description: description.trim(),
      ageUnit,
      specificAge: specificAgeValue,
      minAge: minAgeValue,
      maxAge: maxAgeValue,
      vaccine: selectedVaccines.map((item) => ({
        id: item.vaccineId,
        doses: Number(item.count),
      })),
    };

    try {
      setError(null);

      const response = await fetch(`${API_URL}/api/vaccine/calendar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      await fetchCalendar();
      await fetchDoseWarnings();
      resetForm();
      setCreateOpen(false);
    } catch (err) {
      console.error("Erreur enregistrement calendrier:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer l'entrée du calendrier"
      );
    }
  };

  const handleEdit = (entry: CalendarEntry) => {
    if (!isNational) return;
    setEditForm({
      id: entry.id,
      description: entry.description ?? "",
      ageUnit: entry.ageUnit,
      specificAge: entry.specificAge != null ? String(entry.specificAge) : "",
      minAge: entry.minAge != null ? String(entry.minAge) : "",
      maxAge: entry.maxAge != null ? String(entry.maxAge) : "",
      vaccines: entry.vaccines.map((vaccine) => ({
        key: createSelectionKey(),
        vaccineId: vaccine.id,
        count:
          vaccine.doseCount != null ? String(vaccine.doseCount) : "1",
      })),
    });
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleEditVaccineSelect = (value: string) => {
    if (!value) return;
    setEditForm((prev) => {
      if (prev.vaccines.some((selection) => selection.vaccineId === value)) {
        setEditError("Ce vaccin est déjà configuré pour cette fenêtre.");
        return prev;
      }
      setEditError(null);
      return {
        ...prev,
        vaccines: [
          ...prev.vaccines,
          { key: createSelectionKey(), vaccineId: value, count: "1" },
        ],
      };
    });
  };

  const handleEditVaccineRemove = (selectionKey: string) => {
    setEditForm((prev) => ({
      ...prev,
      vaccines: prev.vaccines.filter((selection) => selection.key !== selectionKey),
    }));
  };

  const handleEditDoseChange = (selectionKey: string, newCount: string) => {
    const sanitized = newCount.replace(/[^\d]/g, "");
    setEditForm((prev) => ({
      ...prev,
      vaccines: prev.vaccines.map((selection) =>
        selection.key === selectionKey
          ? { ...selection, count: sanitized || "1" }
          : selection,
      ),
    }));
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditError(null);
    setEditForm(createEmptyEditForm());
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isNational || !accessToken) return;

    if (!editForm.id) {
      setEditError("Élément introuvable.");
      return;
    }

    if (!editForm.specificAge.trim()) {
      setEditError("Veuillez saisir l'âge ciblé.");
      return;
    }

    if (!editForm.minAge.trim() || !editForm.maxAge.trim()) {
      setEditError("Veuillez saisir les âges minimum et maximum.");
      return;
    }

    if (editForm.vaccines.length === 0) {
      setEditError("Veuillez sélectionner au moins un vaccin.");
      return;
    }

    if (editForm.vaccines.some((item) => !item.count.trim())) {
      setEditError("Veuillez indiquer le nombre de doses pour chaque vaccin.");
      return;
    }

    if (
      editForm.vaccines.some(
        (item) => Number(item.count) <= 0 || Number.isNaN(Number(item.count)),
      )
    ) {
      setEditError(
        "Chaque vaccin doit avoir au moins une dose sur cette fenêtre.",
      );
      return;
    }

    const specificAgeValue = Number(editForm.specificAge);
    const minAgeValue = Number(editForm.minAge);
    const maxAgeValue = Number(editForm.maxAge);

    if (Number.isNaN(specificAgeValue)) {
      setEditError("L'âge ciblé doit être un nombre valide.");
      return;
    }

    if (Number.isNaN(minAgeValue) || Number.isNaN(maxAgeValue)) {
      setEditError(
        "Les âges minimum et maximum doivent être des nombres valides."
      );
      return;
    }

    if (minAgeValue > maxAgeValue) {
      setEditError("L'âge minimum doit être inférieur ou égal à l'âge maximum.");
      return;
    }

    const payload = {
      description: editForm.description.trim(),
      ageUnit: editForm.ageUnit,
      specificAge: specificAgeValue,
      minAge: minAgeValue,
      maxAge: maxAgeValue,
      vaccine: editForm.vaccines.map((item) => ({
        id: item.vaccineId,
        doses: Number(item.count),
      })),
    };

    try {
      setEditError(null);
      const response = await fetch(
        `${API_URL}/api/vaccine/calendar/${editForm.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      await fetchCalendar();
      await fetchDoseWarnings();
      closeEditModal();
    } catch (err) {
      console.error("Erreur mise à jour calendrier:", err);
      setEditError(
        err instanceof Error
          ? err.message
          : "Impossible de mettre à jour l'entrée du calendrier"
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!isNational || !accessToken) return;
    if (!window.confirm("Confirmer la suppression ?")) return;

    try {
      const response = await fetch(`${API_URL}/api/vaccine/calendar/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      await fetchDoseWarnings();
    } catch (err) {
      console.error("Erreur suppression calendrier:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de supprimer l'entrée du calendrier"
      );
    }
  };

  const handleDownloadPdf = async () => {
    if (!accessToken) return;

    try {
      setPdfLoading(true);
      const response = await fetch(
        `${API_URL}/api/vaccine/calendar/download-pdf`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "calendrier-vaccinal.pdf";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Erreur téléchargement PDF:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de télécharger le PDF"
      );
    } finally {
      setPdfLoading(false);
    }
  };

  const totalEntries = useMemo(() => entries.length, [entries]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const weightA = a.ageSortWeight ?? 0;
      const weightB = b.ageSortWeight ?? 0;
      if (weightA === weightB) {
        return (a.id ?? "").localeCompare(b.id ?? "");
      }
      return weightA - weightB;
    });
  }, [entries]);

  return (
    <DashboardShell active="/dashboard/calendrier">
      <div className="space-y-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Calendrier vaccinal national
            </h2>
            <p className="text-sm text-slate-500">
              Configuration et suivi du programme vaccinal.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            <FileDown className="h-4 w-4" />
            {pdfLoading ? "Téléchargement..." : "Exporter PDF"}
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
                  <Syringe className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">
                    Vaccins configurés
                  </p>
                  <p className="text-3xl font-semibold text-blue-600">
                    {totalEntries}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {isNational && warningsError && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <span>{warningsError}</span>
              </div>
              <button
                type="button"
                onClick={fetchDoseWarnings}
                disabled={warningsLoading}
                className="rounded-full border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
              >
                {warningsLoading ? "Analyse..." : "Réessayer"}
              </button>
            </div>
          </div>
        )}

        {isNational && !warningsError && doseWarnings.length > 0 && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <span>
                  {doseWarnings.length} vaccin
                  {doseWarnings.length > 1 ? "s" : ""} n&apos;ont pas toutes les
                  doses planifiées dans le calendrier.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWarningModalOpen(true)}
                disabled={warningsLoading}
                className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
              >
                {warningsLoading ? "Analyse..." : "Voir la liste"}
              </button>
            </div>
          </div>
        )}

        {isNational && (
          <div className="rounded-3xl border border-slate-200 bg-white p-0 shadow-sm">
            <button
              type="button"
              onClick={() => setCreateOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-3xl border-b border-slate-100 bg-white px-6 py-4 text-left transition hover:bg-slate-50"
            >
              <span className="text-lg font-semibold text-slate-900">
                Ajouter une entrée au calendrier
              </span>
              <ChevronDown
                className={`h-5 w-5 text-slate-500 transition-transform ${
                  createOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {createOpen ? (
              <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Unité
                    </label>
                    <select
                      value={ageUnit}
                      onChange={(event) =>
                        setAgeUnit(event.target.value.toUpperCase() as AgeUnit)
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="WEEKS">Semaines</option>
                      <option value="MONTHS">Mois</option>
                      <option value="YEARS">Années</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Âge ciblé
                    </label>
                    <input
                      type="number"
                      value={specificAge}
                      onChange={(event) => setSpecificAge(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  <p className="text-xs text-slate-500">
                    {targetAgePreview ?? "—"}
                  </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Âge minimum
                    </label>
                    <input
                      type="number"
                      value={minAge}
                      onChange={(event) => setMinAge(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Âge maximum
                    </label>
                    <input
                      type="number"
                      value={maxAge}
                      onChange={(event) => setMaxAge(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  <p className="text-xs text-slate-500">
                    {rangeAgePreview ?? "—"}
                  </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-600">
                    Vaccins concernés
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      value=""
                      onChange={(event) =>
                        handleCreateVaccineSelect(event.target.value)
                      }
                    >
                      <option value="">Sélectionner un vaccin</option>
                      {vaccines.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {selectedVaccines.length === 0 ? (
                        <p className="text-slate-400">
                          Aucun vaccin sélectionné pour le moment.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {selectedVaccines.map((selection) => {
                            const option = vaccines.find(
                              (candidate) => candidate.id === selection.vaccineId
                            );
                            if (!option) return null;
                            const totalDoses = Number(
                              option.dosesRequired ?? "1",
                            );
                            return (
                              <div
                                key={selection.key}
                                className="rounded-lg bg-white px-3 py-2 shadow-sm"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-slate-800">
                                      {option.name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {Number.isNaN(totalDoses)
                                        ? "Dose totale inconnue"
                                        : `${totalDoses} dose(s) au total`}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveSelectedVaccine(selection.key)
                                    }
                                    className="text-xs font-semibold text-red-500 transition hover:text-red-600"
                                  >
                                    Retirer
                                  </button>
                                </div>
                                <div className="mt-2 space-y-1">
                                  <label className="text-xs font-medium text-slate-500">
                                    Nombre de doses sur cette fenêtre
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={selection.count}
                                    onChange={(event) =>
                                      handleCreateCountChange(
                                        selection.key,
                                        event.target.value,
                                      )
                                    }
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Ajoutez une note pour préciser cette étape vaccinale."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setCreateOpen(false);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            ) : (
              <div className="px-6 py-5 text-sm text-slate-500">
                Cliquez pour déplier et ajouter un nouveau vaccin au calendrier.
              </div>
            )}
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Clock className="h-4 w-4 text-blue-600" />
            Programme de vaccination
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
                <p className="text-sm text-slate-500">
                  Chargement du calendrier...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
                <p className="font-medium text-red-600">
                  {error}
                </p>
              </div>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-slate-500">
              <Calendar className="h-16 w-16 text-slate-300" />
              <p className="text-lg font-semibold">
                Aucun calendrier configuré
              </p>
              <p className="text-sm text-slate-400">
                Ajoutez une première entrée pour démarrer.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-blue-50"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Syringe className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        {entry.targetAgeLabel && (
                          <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            {`Âge cible : ${entry.targetAgeLabel}`}
                          </span>
                        )}
                        {entry.ageRangeLabel && (
                          <span className="ml-2 inline-block rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                            {`Tranche : ${entry.ageRangeLabel}`}
                          </span>
                        )}
                        <h5 className="mt-2 text-base font-semibold text-slate-900">
                          {entry.vaccines.length === 0
                            ? "Aucun vaccin associé"
                            : entry.vaccines
                                .map((v) =>
                                  (() => {
                                    const countLabel = `${v.doseCount ?? 0} dose(s)`;
                                    if (
                                      v.firstDoseNumber != null &&
                                      v.lastDoseNumber != null &&
                                      v.doseCount > 0
                                    ) {
                                      const range =
                                        v.firstDoseNumber === v.lastDoseNumber
                                          ? `Dose ${v.firstDoseNumber}`
                                          : `Doses ${v.firstDoseNumber}-${v.lastDoseNumber}`;
                                      return `${v.name} (${countLabel}, ${range})`;
                                    }
                                    return `${v.name} (${countLabel})`;
                                  })(),
                                )
                                .join(", ")}
                        </h5>
                        {entry.description && (
                          <p className="mt-1 text-sm text-slate-600">
                            {entry.description}
                          </p>
                        )}
                      </div>
                      {isNational && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(entry)}
                            className="rounded-xl border border-blue-200 bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {isNational && warningModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 px-4 py-8">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Couverture des doses
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Vaccins partiellement planifiés
                </h3>
                <p className="text-sm text-slate-500">
                  Un vaccin peut avoir moins de fenêtres que son nombre total de doses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWarningModalOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 space-y-3 overflow-y-auto pr-1 max-h-[60vh] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70">
              {doseWarnings.map((warning) => (
                <div
                  key={warning.vaccineId}
                  className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-semibold text-slate-900">
                      {warning.name}
                    </p>
                    <span className="text-sm font-semibold text-amber-700">
                      - {warning.missingDoses} dose
                      {warning.missingDoses > 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {warning.plannedDoses} dose
                    {warning.plannedDoses > 1 ? "s" : ""} planifiée
                    {warning.plannedDoses > 1 ? "s" : ""} sur{" "}
                    {warning.requiredDoses} attendue
                    {warning.requiredDoses > 1 ? "s" : ""}.
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Cette alerte est informative : toutes les doses n&apos;ont pas besoin
              d&apos;être ajoutées au calendrier, mais cela facilite le suivi des enfants.
            </p>
          </div>
        </div>
      )}
      {isNational && editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur px-4 py-8">
          <form
            onSubmit={handleEditSubmit}
            className="relative flex h-[90vh] max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl"
          >
            {/* Header fixe */}
            <div className="flex-shrink-0 border-b border-slate-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Modifier le calendrier vaccinal
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Ajustez les informations puis enregistrez vos modifications.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-shrink-0 rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {editError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">
                  {editError}
                </div>
              )}
            </div>

            {/* Contenu scrollable */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600">
                    Unité
                  </label>
                  <select
                    value={editForm.ageUnit}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        ageUnit: event.target.value.toUpperCase() as AgeUnit,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="WEEKS">Semaines</option>
                    <option value="MONTHS">Mois</option>
                    <option value="YEARS">Années</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600">
                    Âge ciblé
                  </label>
                  <input
                    type="number"
                    value={editForm.specificAge}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        specificAge: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    required
                  />
                  <p className="text-xs text-slate-500">
                    {editTargetAgePreview ?? "—"}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600">
                    Âge minimum
                  </label>
                  <input
                    type="number"
                    value={editForm.minAge}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        minAge: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600">
                    Âge maximum
                  </label>
                  <input
                    type="number"
                    value={editForm.maxAge}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        maxAge: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    required
                  />
                  <p className="text-xs text-slate-500">
                    {editRangeAgePreview ?? "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-600">
                  Vaccins concernés
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value=""
                    onChange={(event) => handleEditVaccineSelect(event.target.value)}
                  >
                    <option value="">Sélectionner un vaccin</option>
                    {vaccines.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {editForm.vaccines.length === 0 ? (
                      <p className="text-slate-400">
                        Aucun vaccin sélectionné pour le moment.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {editForm.vaccines.map((selection) => {
                          const vaccine = vaccines.find(
                            (candidate) => candidate.id === selection.vaccineId
                          );
                          if (!vaccine) return null;
                          const totalDoses = Number(
                            vaccine.dosesRequired ?? "1",
                          );

                          return (
                            <div
                              key={selection.key}
                              className="rounded-lg bg-white px-3 py-2 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-slate-800">
                                    {vaccine.name}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {Number.isNaN(totalDoses)
                                      ? "Dose totale inconnue"
                                      : `${totalDoses} dose(s) au total`}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleEditVaccineRemove(selection.key)
                                  }
                                  className="text-xs font-semibold text-red-500 transition hover:text-red-600"
                                >
                                  Retirer
                                </button>
                              </div>
                              <div className="mt-2 space-y-1">
                                <label className="text-xs font-medium text-slate-500">
                                  Nombre de doses sur cette fenêtre
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={selection.count}
                                  onChange={(event) =>
                                    handleEditDoseChange(
                                      selection.key,
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">
                  Description (optionnel)
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Informations complémentaires..."
                />
              </div>
              </div>
            </div>

            {/* Footer fixe */}
            <div className="flex-shrink-0 border-t border-slate-200 p-6">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <Pencil className="h-4 w-4" />
                  Mettre à jour
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </DashboardShell>
  );
}

