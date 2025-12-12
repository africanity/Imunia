"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Syringe,
  Trash2,
  X,
} from "lucide-react";
import type { AgeUnit, VaccinationDetail } from "./types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  detail: VaccinationDetail;
  childId: string;
  apiBase: string;
  token: string | null;
  canEdit?: boolean;
  onRefresh?: () => void | Promise<void>;
  inline?: boolean; // Nouveau prop pour afficher sans overlay
};

const sectionClasses = "rounded-2xl border border-slate-200 bg-white p-4";

type ManualBucket = "due" | "late" | "overdue" | "completed";

type VaccineOption = {
  id: string;
  name: string;
  dosesRequired?: string;
};

type CalendarVaccineInfo = {
  id: string;
  name: string;
  doseNumbers: number[]; // Les numéros de doses disponibles dans cette fenêtre
};

type CalendarOption = {
  id: string;
  label: string;
  vaccineIds: string[];
  vaccines: CalendarVaccineInfo[]; // Informations détaillées sur les vaccins et leurs doses
};

type ManualEntry = {
  bucket: ManualBucket;
  id: string;
  vaccineId: string;
  vaccineName: string;
  calendarId: string | null;
  calendarDescription?: string | null;
  ageUnit?: AgeUnit | null;
  specificAge?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  dose: number;
  scheduledFor?: string | null;
  dueDate?: string | null;
  administeredAt?: string | null;
  administeredByName?: string | null;
};

type ManualEditorState = {
  open: boolean;
  mode: "create" | "edit";
  bucket: ManualBucket | null;
  entry: ManualEntry | null;
};

const BUCKET_META: Record<
  ManualBucket,
  {
    label: string;
    dateLabel: string;
    dateField: "scheduledFor" | "dueDate" | "administeredAt";
    requireCalendar: boolean;
  }
> = {
  due: {
    label: "vaccin à faire",
    dateLabel: "Date prévue",
    dateField: "scheduledFor",
    requireCalendar: true,
  },
  late: {
    label: "vaccin en retard",
    dateLabel: "Date limite",
    dateField: "dueDate",
    requireCalendar: true,
  },
  overdue: {
    label: "rendez-vous manqué",
    dateLabel: "Date limite",
    dateField: "dueDate",
    requireCalendar: true,
  },
  completed: {
    label: "vaccin administré",
    dateLabel: "Date d'administration",
    dateField: "administeredAt",
    requireCalendar: false,
  },
};

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

const toInputValue = (value?: string | null): string => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 16);
};

const formatAgeWindow = (entry: {
  specificAge?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  ageUnit?: string | null;
}) => {
  if (entry.specificAge != null && entry.ageUnit) {
    return `${entry.specificAge} ${entry.ageUnit.toLowerCase()}`;
  }
  if (
    entry.minAge != null &&
    entry.maxAge != null &&
    entry.ageUnit
  ) {
    return `${entry.minAge}-${entry.maxAge} ${entry.ageUnit.toLowerCase()}`;
  }
  return null;
};

const buildCalendarLabel = (item: any) => {
  const ageLabel =
    item?.targetAgeLabel ??
    item?.ageRangeLabel ??
    formatAgeWindow({
      specificAge: item?.specificAge ?? null,
      minAge: item?.minAge ?? null,
      maxAge: item?.maxAge ?? null,
      ageUnit: item?.ageUnit ?? null,
    }) ??
    "Calendrier";
  return item?.description
    ? `${ageLabel} • ${item.description}`
    : ageLabel;
};

const prepareManualEntry = (
  bucket: ManualBucket,
  entry: {
    id: string;
    vaccineId: string;
    vaccineName: string;
    calendarId?: string | null;
    calendarDescription?: string | null;
    ageUnit?: AgeUnit | null;
    specificAge?: number | null;
    minAge?: number | null;
    maxAge?: number | null;
    dose: number;
    scheduledFor?: string | null;
    dueDate?: string | null;
    administeredAt?: string | null;
    administeredByName?: string | null;
  },
): ManualEntry => ({
  bucket,
  id: entry.id,
  vaccineId: entry.vaccineId,
  vaccineName: entry.vaccineName,
  calendarId: entry.calendarId ?? null,
  calendarDescription: entry.calendarDescription ?? null,
  ageUnit: entry.ageUnit ?? null,
  specificAge: entry.specificAge ?? null,
  minAge: entry.minAge ?? null,
  maxAge: entry.maxAge ?? null,
  dose: entry.dose,
  scheduledFor: entry.scheduledFor ?? null,
  dueDate: entry.dueDate ?? null,
  administeredAt: entry.administeredAt ?? null,
  administeredByName: entry.administeredByName ?? null,
});

const getEntryDateValue = (
  bucket: ManualBucket,
  entry?: ManualEntry | null,
) => {
  if (!entry) {
    return "";
  }
  switch (bucket) {
    case "due":
      return toInputValue(entry.scheduledFor);
    case "late":
    case "overdue":
      return toInputValue(entry.dueDate);
    case "completed":
      return toInputValue(entry.administeredAt);
    default:
      return "";
  }
};

const normalizeDateForSubmit = (value: string) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString();
};

const resolveEntryDate = (entry: ManualEntry) => {
  if (entry.bucket === "completed") {
    return entry.administeredAt ?? null;
  }
  if (entry.bucket === "due") {
    return entry.scheduledFor ?? null;
  }
  return entry.dueDate ?? null;
};

const getCalendarHint = (entry: ManualEntry) => {
  if (entry.calendarDescription) {
    return entry.calendarDescription;
  }
  const ageLabel = formatAgeWindow({
    specificAge: entry.specificAge ?? null,
    minAge: entry.minAge ?? null,
    maxAge: entry.maxAge ?? null,
    ageUnit: entry.ageUnit ?? null,
  });
  if (ageLabel) {
    return ageLabel;
  }
  if (entry.calendarId) {
    return `Calendrier ${entry.calendarId.slice(0, 8)}…`;
  }
  return null;
};

function VaccinationRecordModal({
  isOpen,
  onClose,
  detail,
  childId,
  apiBase,
  token,
  canEdit = false,
  onRefresh,
  inline = false,
}: Props) {
  if (!isOpen) return null;

  const { vaccinations } = detail;
  const canEditBuckets = Boolean(canEdit && token);
  const [editorState, setEditorState] = useState<ManualEditorState>({
    open: false,
    mode: "create",
    bucket: null,
    entry: null,
  });
  const [formValues, setFormValues] = useState({
    vaccineId: "",
    calendarId: "",
    dose: "1",
    date: "",
  });
  const [managerOpen, setManagerOpen] = useState(inline); // Si inline, ouvrir directement le manager
  const [expandedSections, setExpandedSections] = useState<Set<"due" | "late" | "completed">>(
    new Set(["due", "late", "completed"]), // Toutes les sections ouvertes par défaut
  );
  const [referenceData, setReferenceData] = useState<{
    vaccines: VaccineOption[];
    calendars: CalendarOption[];
  }>({ vaccines: [], calendars: [] });
  const [referenceLoaded, setReferenceLoaded] = useState(false);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchReferenceData = useCallback(async () => {
    if (!token) {
      setReferenceError("Authentification requise pour éditer le carnet.");
      return;
    }

    setReferenceLoading(true);
    setReferenceError(null);
    try {
      const [vaccinesRes, calendarsRes] = await Promise.all([
        fetch(`${apiBase}/api/vaccine`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`${apiBase}/api/vaccine/calendar`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (!vaccinesRes.ok) {
        const payload = await vaccinesRes.json().catch(() => null);
        throw new Error(payload?.message ?? "Impossible de charger les vaccins.");
      }

      if (!calendarsRes.ok) {
        const payload = await calendarsRes.json().catch(() => null);
        throw new Error(payload?.message ?? "Impossible de charger les calendriers.");
      }

      const vaccinesPayload = await vaccinesRes.json();
      const calendarsPayload = await calendarsRes.json();

      const vaccinesList: VaccineOption[] = (Array.isArray(vaccinesPayload?.vaccines)
        ? vaccinesPayload.vaccines
        : Array.isArray(vaccinesPayload)
          ? vaccinesPayload
          : []
      )
        .filter(
          (item: any): item is VaccineOption =>
            typeof item?.id === "string" && typeof item?.name === "string",
        )
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          dosesRequired: item.dosesRequired,
        }));

      const calendarsList: CalendarOption[] = (Array.isArray(calendarsPayload)
        ? calendarsPayload
        : []
      )
        .filter((item) => typeof item?.id === "string")
        .map((item) => ({
          id: item.id,
          label: buildCalendarLabel(item),
          vaccineIds: Array.isArray(item?.vaccines)
            ? item.vaccines
                .map((v: any) => v?.id)
                .filter((id: unknown): id is string => typeof id === "string")
            : [],
          vaccines: Array.isArray(item?.vaccines)
            ? item.vaccines
                .filter((v: any) => v?.id && Array.isArray(v?.doseNumbers))
                .map((v: any) => ({
                  id: v.id,
                  name: v.name || "",
                  doseNumbers: Array.isArray(v.doseNumbers)
                    ? v.doseNumbers.filter((d: any) => typeof d === "number" && d > 0)
                    : [],
                }))
            : [],
        }));

      setReferenceData({ vaccines: vaccinesList, calendars: calendarsList });
      setReferenceLoaded(true);
    } catch (error) {
      setReferenceError(
        error instanceof Error
          ? error.message
          : "Impossible de charger les données de référence.",
      );
    } finally {
      setReferenceLoading(false);
    }
  }, [apiBase, token]);

  useEffect(() => {
    if (!isOpen) {
      setEditorState({
        open: false,
        mode: "create",
        bucket: null,
        entry: null,
      });
      setFormError(null);
      setFormSubmitting(false);
    }
  }, [isOpen]);

  const closeEditor = useCallback(() => {
    setEditorState({
      open: false,
      mode: "create",
      bucket: null,
      entry: null,
    });
    setFormValues({
      vaccineId: "",
      calendarId: "",
      dose: "1",
      date: "",
    });
    setFormError(null);
  }, []);

  useEffect(() => {
    if (!managerOpen && editorState.open) {
      closeEditor();
    }
  }, [closeEditor, editorState.open, managerOpen]);

  useEffect(() => {
    if (
      isOpen &&
      canEditBuckets &&
      token &&
      !referenceLoaded &&
      !referenceLoading
    ) {
      fetchReferenceData();
    }
  }, [
    canEditBuckets,
    fetchReferenceData,
    isOpen,
    referenceLoaded,
    referenceLoading,
    token,
  ]);

  const handleOpenEditor = useCallback(
    (bucket: ManualBucket, mode: "create" | "edit", entry?: ManualEntry) => {
      if (!canEditBuckets) {
        return;
      }
      if (!token) {
        setActionError(
          "Authentification requise pour modifier le carnet de vaccination.",
        );
        return;
      }
      if (!referenceLoaded && !referenceLoading) {
        fetchReferenceData();
      }
      setEditorState({
        open: true,
        mode,
        bucket,
        entry: entry ?? null,
      });
      setFormValues({
        vaccineId: entry?.vaccineId ?? "",
        calendarId: entry?.calendarId ?? "",
        dose: entry?.dose ? String(entry.dose) : "1",
        date: getEntryDateValue(bucket, entry ?? null),
      });
      setFormError(null);
    },
    [
      canEditBuckets,
      fetchReferenceData,
      referenceLoaded,
      referenceLoading,
      token,
    ],
  );

  const handleFormValueChange = useCallback(
    (field: "vaccineId" | "calendarId" | "dose" | "date", value: string) => {
      setFormValues((prev) => {
        const next = { ...prev, [field]: value };
        
        // Si la fenêtre change, vérifier si le vaccin sélectionné est toujours valide
        if (field === "calendarId") {
          if (value && prev.vaccineId) {
            const selectedCalendar = referenceData.calendars.find(
              (cal) => cal.id === value,
            );
            if (
              selectedCalendar &&
              selectedCalendar.vaccineIds.length > 0 &&
              !selectedCalendar.vaccineIds.includes(prev.vaccineId)
            ) {
              // Le vaccin n'est plus valide, le réinitialiser
              next.vaccineId = "";
              next.dose = "1";
            }
          } else if (!value) {
            // Si on enlève la fenêtre, on peut garder le vaccin mais réinitialiser la dose
            next.dose = "1";
          }
        }
        
        // Si le vaccin change, réinitialiser la dose
        if (field === "vaccineId") {
          next.dose = "1";
        }
        
        return next;
      });
    },
    [referenceData.calendars],
  );

  // Filtrer les calendriers basés sur le vaccin sélectionné (si aucun vaccin n'est sélectionné, tous les calendriers sont disponibles)
  const filteredCalendars = useMemo(() => {
    if (!referenceData.calendars.length) {
      return [];
    }
    if (!formValues.vaccineId) {
      return referenceData.calendars;
    }
    return referenceData.calendars.filter(
      (calendar) =>
        calendar.vaccineIds.length === 0 ||
        calendar.vaccineIds.includes(formValues.vaccineId),
    );
  }, [formValues.vaccineId, referenceData.calendars]);

  // Filtrer les vaccins basés sur la fenêtre sélectionnée (si une fenêtre est sélectionnée)
  const filteredVaccines = useMemo(() => {
    if (!formValues.calendarId) {
      // Si aucune fenêtre n'est sélectionnée, tous les vaccins sont disponibles
      return referenceData.vaccines;
    }
    const selectedCalendar = referenceData.calendars.find(
      (cal) => cal.id === formValues.calendarId,
    );
    if (!selectedCalendar || selectedCalendar.vaccineIds.length === 0) {
      // Si la fenêtre n'a pas de vaccins spécifiques, tous les vaccins sont disponibles
      return referenceData.vaccines;
    }
    // Filtrer pour ne garder que les vaccins de cette fenêtre
    return referenceData.vaccines.filter((vaccine) =>
      selectedCalendar.vaccineIds.includes(vaccine.id),
    );
  }, [formValues.calendarId, referenceData.calendars, referenceData.vaccines]);

  // Filtrer les doses disponibles basées sur la fenêtre et le vaccin sélectionnés
  const availableDoses = useMemo(() => {
    const selectedVaccine = referenceData.vaccines.find(
      (v) => v.id === formValues.vaccineId,
    );
    if (!selectedVaccine) {
      return [];
    }

    const maxDoses = selectedVaccine.dosesRequired
      ? Number(selectedVaccine.dosesRequired)
      : 1;
    if (!Number.isFinite(maxDoses) || maxDoses <= 0) {
      return [1];
    }

    // Si une fenêtre est sélectionnée, filtrer les doses selon cette fenêtre
    if (formValues.calendarId) {
      const selectedCalendar = referenceData.calendars.find(
        (cal) => cal.id === formValues.calendarId,
      );
      if (selectedCalendar) {
        const vaccineInfo = selectedCalendar.vaccines.find(
          (v) => v.id === formValues.vaccineId,
        );
        if (vaccineInfo && vaccineInfo.doseNumbers.length > 0) {
          // Retourner uniquement les doses disponibles dans cette fenêtre
          return vaccineInfo.doseNumbers;
        }
      }
    }

    // Si aucune fenêtre n'est sélectionnée ou si le vaccin n'est pas dans la fenêtre,
    // retourner toutes les doses possibles (1 à maxDoses)
    return Array.from({ length: maxDoses }, (_, i) => i + 1);
  }, [
    formValues.calendarId,
    formValues.vaccineId,
    referenceData.calendars,
    referenceData.vaccines,
  ]);

  // Effet pour valider et réinitialiser la dose si elle n'est plus disponible
  useEffect(() => {
    if (formValues.vaccineId && formValues.dose && availableDoses.length > 0) {
      const doseValue = Number(formValues.dose);
      if (!availableDoses.includes(doseValue)) {
        // La dose sélectionnée n'est plus disponible, réinitialiser à la première dose disponible
        setFormValues((prev) => ({
          ...prev,
          dose: String(availableDoses[0]),
        }));
      }
    }
  }, [availableDoses, formValues.vaccineId, formValues.dose]);

  const handleEditorSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!editorState.bucket) {
        return;
      }
      if (!token) {
        setFormError("Authentification requise.");
        return;
      }

      const meta = BUCKET_META[editorState.bucket];
      const payload: Record<string, unknown> = {};
      if (!formValues.vaccineId) {
        setFormError("Veuillez sélectionner un vaccin.");
        return;
      }
      payload.vaccineId = formValues.vaccineId;

      const doseValue = Number(formValues.dose || "1");
      if (!Number.isFinite(doseValue) || doseValue <= 0) {
        setFormError("La dose doit être un nombre positif.");
        return;
      }
      
      // Si une fenêtre est sélectionnée, valider que la dose est dans les doses disponibles
      if (formValues.calendarId && formValues.vaccineId) {
        const selectedCalendar = referenceData.calendars.find(
          (cal) => cal.id === formValues.calendarId,
        );
        if (selectedCalendar) {
          const vaccineInfo = selectedCalendar.vaccines.find(
            (v) => v.id === formValues.vaccineId,
          );
          if (vaccineInfo && vaccineInfo.doseNumbers.length > 0) {
            if (!vaccineInfo.doseNumbers.includes(doseValue)) {
              setFormError(
                `La dose ${doseValue} n'est pas disponible dans la fenêtre sélectionnée. Doses disponibles : ${vaccineInfo.doseNumbers.join(", ")}.`,
              );
              return;
            }
          }
        }
      }
      
      payload.dose = doseValue;

      // La fenêtre est maintenant optionnelle pour tous les buckets
      // Si une fenêtre est sélectionnée, on l'ajoute au payload
      if (formValues.calendarId) {
        payload.vaccineCalendarId = formValues.calendarId;
      }

      const normalizedDate = normalizeDateForSubmit(formValues.date);
      if (!normalizedDate) {
        setFormError(`${meta.dateLabel} est requise.`);
        return;
      }
      payload[meta.dateField] = normalizedDate;

      const url =
        editorState.mode === "edit" && editorState.entry
          ? `${apiBase}/api/children/${childId}/vaccinations/${editorState.bucket}/${editorState.entry.id}`
          : `${apiBase}/api/children/${childId}/vaccinations/${editorState.bucket}`;

      setFormSubmitting(true);
      setFormError(null);
      try {
        const res = await fetch(url, {
          method: editorState.mode === "edit" ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.message ?? "Impossible d'enregistrer les modifications.");
        }

        await onRefresh?.();
        closeEditor();
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : "Impossible d'enregistrer les modifications.",
        );
      } finally {
        setFormSubmitting(false);
      }
    },
    [
      apiBase,
      childId,
      closeEditor,
      editorState.bucket,
      editorState.entry,
      editorState.mode,
      formValues.calendarId,
      formValues.date,
      formValues.dose,
      formValues.vaccineId,
      referenceData.calendars,
      onRefresh,
      token,
    ],
  );

  const handleDeleteEntry = useCallback(
    async (entry: ManualEntry) => {
      if (!canEditBuckets || !token) {
        setActionError("Authentification requise pour supprimer une entrée.");
        return;
      }
      setActionLoadingId(entry.id);
      setActionError(null);
      try {
        const res = await fetch(
          `${apiBase}/api/children/${childId}/vaccinations/${entry.bucket}/${entry.id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            data?.message ?? "Impossible de supprimer cette entrée.",
          );
        }
        await onRefresh?.();
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Impossible de supprimer cette entrée.",
        );
      } finally {
        setActionLoadingId(null);
      }
    },
    [apiBase, canEditBuckets, childId, onRefresh, token],
  );

  const dueEntries = useMemo(
    () =>
      vaccinations.due
        .slice()
        .sort((a, b) => {
          const nameDiff = a.vaccineName.localeCompare(b.vaccineName, "fr", {
            sensitivity: "base",
          });
          if (nameDiff !== 0) {
            return nameDiff;
          }
          return (a.dose ?? 0) - (b.dose ?? 0);
        })
        .map((entry) => prepareManualEntry("due", entry)),
    [vaccinations.due],
  );

  const lateEntries = useMemo(
    () => {
      const combined = [
        ...vaccinations.late.map((entry) => prepareManualEntry("late", entry)),
        ...vaccinations.overdue.map((entry) =>
          prepareManualEntry("overdue", entry),
        ),
      ];
      return combined.sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return dateB - dateA;
      });
    },
    [vaccinations.late, vaccinations.overdue],
  );

  const completedEntries = useMemo(
    () =>
      vaccinations.completed
        .slice()
        .sort((a, b) => {
          const dateA = a.administeredAt
            ? new Date(a.administeredAt).getTime()
            : 0;
          const dateB = b.administeredAt
            ? new Date(b.administeredAt).getTime()
            : 0;
          return dateB - dateA;
        })
        .map((entry) => prepareManualEntry("completed", entry)),
    [vaccinations.completed],
  );

  const renderManualEntryCard = (
    entry: ManualEntry,
    options?: { enableActions?: boolean },
  ) => {
    const allowActions = Boolean(
      canEditBuckets && (options?.enableActions ?? true),
    );
    const meta = BUCKET_META[entry.bucket];
    const dateValue = resolveEntryDate(entry);
    const calendarHint = getCalendarHint(entry);
    const loading = actionLoadingId === entry.id;
    return (
      <div
        key={`${entry.bucket}-${entry.id}`}
        className="relative rounded-lg border-2 border-slate-300 bg-white p-3 shadow-sm transition hover:shadow-md"
      >
        {allowActions ? (
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => handleOpenEditor(entry.bucket, "edit", entry)}
              className="rounded-lg bg-blue-100 p-1.5 text-blue-600 transition hover:bg-blue-200"
              aria-label="Modifier l'entrée"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleDeleteEntry(entry)}
              disabled={loading}
              className="rounded-lg bg-red-100 p-1.5 text-red-600 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-70"
              aria-label="Supprimer l'entrée"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        ) : null}
        <div className="pr-16">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-700">
              {meta.label}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              Dose {entry.dose}
            </span>
          </div>
          <p className="mb-1 text-base font-bold text-slate-900">
            {entry.vaccineName}
          </p>
          {calendarHint ? (
            <p className="mb-1 text-xs font-medium text-slate-600">{calendarHint}</p>
          ) : null}
          {dateValue ? (
            <p className="text-xs text-slate-700">
              <span className="font-semibold">{meta.dateLabel} :</span>{" "}
              <span className="font-medium">{formatDate(dateValue)}</span>
            </p>
          ) : null}
          {entry.bucket === "completed" && entry.administeredByName ? (
            <p className="mt-1 text-xs font-medium text-emerald-700">
              Administré par {entry.administeredByName}
            </p>
          ) : null}
        </div>
      </div>
    );
  };

  // Si inline, afficher seulement le contenu de gestion sans overlay
  if (inline) {
    return (
      <div className="w-full space-y-4">
        {actionError ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}
        <div className="space-y-3">
          {/* Vaccins à faire */}
          <section className="rounded-xl border-2 border-blue-300 bg-blue-50 shadow-md overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setExpandedSections((prev) => {
                  const next = new Set(prev);
                  if (next.has("due")) {
                    next.delete("due");
                  } else {
                    next.add("due");
                  }
                  return next;
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedSections((prev) => {
                    const next = new Set(prev);
                    if (next.has("due")) {
                      next.delete("due");
                    } else {
                      next.add("due");
                    }
                    return next;
                  });
                }
              }}
              className="w-full flex items-center justify-between gap-2 p-4 hover:bg-blue-100 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Syringe className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-blue-900">Vaccins à faire</h3>
                <span className="text-xs text-blue-600 font-medium">({dueEntries.length})</span>
              </div>
              <div className="flex items-center gap-2">
                {canEditBuckets && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditor("due", "create");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </button>
                )}
                {expandedSections.has("due") ? (
                  <ChevronUp className="h-5 w-5 text-blue-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-blue-600" />
                )}
              </div>
            </div>
            {expandedSections.has("due") && (
              <div className="px-4 pb-4 space-y-2.5 text-sm">
                {dueEntries.length === 0 ? (
                  <p className="py-4 text-center text-blue-600">Aucune entrée.</p>
                ) : (
                  <div className="space-y-2">
                    {dueEntries.map((entry) => renderManualEntryCard(entry))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Vaccins en retard */}
          <section className="rounded-xl border-2 border-red-300 bg-red-50 shadow-md overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setExpandedSections((prev) => {
                  const next = new Set(prev);
                  if (next.has("late")) {
                    next.delete("late");
                  } else {
                    next.add("late");
                  }
                  return next;
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedSections((prev) => {
                    const next = new Set(prev);
                    if (next.has("late")) {
                      next.delete("late");
                    } else {
                      next.add("late");
                    }
                    return next;
                  });
                }
              }}
              className="w-full flex items-center justify-between gap-2 p-4 hover:bg-red-100 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h3 className="text-base font-bold text-red-900">Vaccins en retard</h3>
                <span className="text-xs text-red-600 font-medium">({lateEntries.length})</span>
              </div>
              <div className="flex items-center gap-2">
                {canEditBuckets && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditor("late", "create");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </button>
                )}
                {expandedSections.has("late") ? (
                  <ChevronUp className="h-5 w-5 text-red-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-red-600" />
                )}
              </div>
            </div>
            {expandedSections.has("late") && (
              <div className="px-4 pb-4 space-y-2.5 text-sm">
                {lateEntries.length === 0 ? (
                  <p className="py-4 text-center text-red-600">Aucune entrée.</p>
                ) : (
                  <div className="space-y-2">
                    {lateEntries.map((entry) => renderManualEntryCard(entry))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Vaccins administrés */}
          <section className="rounded-xl border-2 border-emerald-300 bg-emerald-50 shadow-md overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setExpandedSections((prev) => {
                  const next = new Set(prev);
                  if (next.has("completed")) {
                    next.delete("completed");
                  } else {
                    next.add("completed");
                  }
                  return next;
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedSections((prev) => {
                    const next = new Set(prev);
                    if (next.has("completed")) {
                      next.delete("completed");
                    } else {
                      next.add("completed");
                    }
                    return next;
                  });
                }
              }}
              className="w-full flex items-center justify-between gap-2 p-4 hover:bg-emerald-100 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-emerald-900">Vaccins administrés</h3>
                <span className="text-xs text-emerald-600 font-medium">({completedEntries.length})</span>
              </div>
              <div className="flex items-center gap-2">
                {canEditBuckets && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditor("completed", "create");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </button>
                )}
                {expandedSections.has("completed") ? (
                  <ChevronUp className="h-5 w-5 text-emerald-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-emerald-600" />
                )}
              </div>
            </div>
            {expandedSections.has("completed") && (
              <div className="px-4 pb-4 space-y-2.5 text-sm">
                {completedEntries.length === 0 ? (
                  <p className="py-4 text-center text-emerald-600">Aucune entrée.</p>
                ) : (
                  <div className="space-y-2">
                    {completedEntries.map((entry) => renderManualEntryCard(entry))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Formulaire d'édition (modal même en mode inline) */}
        {canEditBuckets && editorState.open && editorState.bucket ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/70 px-4 py-8">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {editorState.mode === "create" ? "Nouvelle entrée" : "Modifier l'entrée"}
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {detail.child.name} • {BUCKET_META[editorState.bucket].label}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                  aria-label="Fermer le formulaire"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {referenceError ? (
                <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <p className="mb-2">{referenceError}</p>
                  <button
                    type="button"
                    onClick={fetchReferenceData}
                    className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                    disabled={referenceLoading}
                  >
                    Réessayer
                  </button>
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={handleEditorSubmit}>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Vaccin
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    value={formValues.vaccineId}
                    onChange={(event) =>
                      handleFormValueChange("vaccineId", event.target.value)
                    }
                    required
                  >
                    <option value="">Sélectionnez un vaccin</option>
                    {filteredVaccines.map((vaccine) => (
                      <option key={vaccine.id} value={vaccine.id}>
                        {vaccine.name}
                      </option>
                    ))}
                  </select>
                </div>

                {(BUCKET_META[editorState.bucket].requireCalendar ||
                  referenceData.calendars.length > 0) && (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Fenêtre du calendrier
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      value={formValues.calendarId}
                      onChange={(event) =>
                        handleFormValueChange("calendarId", event.target.value)
                      }
                      required={false}
                    >
                      <option value="">Optionnel (modification spécifique à l'enfant)</option>
                      {filteredCalendars.map((calendar) => (
                        <option key={calendar.id} value={calendar.id}>
                          {calendar.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Dose
                    </label>
                    {availableDoses.length > 0 ? (
                      <select
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        value={formValues.dose}
                        onChange={(event) =>
                          handleFormValueChange("dose", event.target.value)
                        }
                        required
                      >
                        <option value="">Sélectionnez une dose</option>
                        {availableDoses.map((dose) => (
                          <option key={dose} value={String(dose)}>
                            Dose {dose}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        value={formValues.dose}
                        onChange={(event) =>
                          handleFormValueChange("dose", event.target.value)
                        }
                        required
                        disabled={!formValues.vaccineId}
                        placeholder={formValues.vaccineId ? "Sélectionnez d'abord un vaccin" : ""}
                      />
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      {BUCKET_META[editorState.bucket].dateLabel}
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      value={formValues.date}
                      onChange={(event) =>
                        handleFormValueChange("date", event.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                {formError ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
                    {formError}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {formSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        {editorState.mode === "create" ? "Ajouter" : "Mettre à jour"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex overflow-y-auto bg-slate-900/70 px-4 py-8">
      <div className="mx-auto flex min-h-full w-full max-w-4xl items-center justify-center">
        <div className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 text-white">
            <div>
              <p className="text-xs uppercase tracking-wide text-purple-100">Carnet de vaccination</p>
              <h2 className="text-xl font-semibold">{detail.child.name}</h2>
              <p className="text-sm text-purple-100">Dernière mise à jour le {formatDate(new Date().toISOString())}</p>
            </div>
            <div className="flex items-center gap-3">
              {canEditBuckets ? (
                <button
                  type="button"
                  onClick={() => setManagerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30"
                >
                  <Pencil className="h-4 w-4" />
                  Modifier
                </button>
              ) : null}
              <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <section className={sectionClasses}>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  <Syringe className="h-4 w-4 text-blue-500" />
                  Vaccins à faire
                </div>
                <div className="space-y-3 text-sm">
                  {vaccinations.due.length === 0 ? (
                    <p className="text-slate-500">Aucun vaccin en attente.</p>
                  ) : (
                    Object.entries(
                      vaccinations.due.reduce<Record<string, { entry: typeof vaccinations.due[number]; doses: number[] }>>(
                        (acc, item) => {
                          if (!acc[item.vaccineId]) {
                            acc[item.vaccineId] = { entry: item, doses: [] };
                          }
                          acc[item.vaccineId].doses.push(item.dose);
                          return acc;
                        },
                        {},
                      ),
                    ).map(([vaccineId, group]) => {
                      const { entry, doses } = group;
                      const doseLabel =
                        doses.length === 1
                          ? `Dose ${doses[0]}`
                          : `Doses ${doses.sort((a, b) => a - b).join(", ")}`;
                      return (
                        <div key={vaccineId} className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                          <p className="font-semibold text-blue-900">{entry.vaccineName}</p>
                          <p className="text-xs text-blue-700">{doseLabel}</p>
                          {entry.specificAge != null ||
                          (entry.minAge != null && entry.maxAge != null) ? (
                            <p className="text-xs text-blue-600">
                              Tranche d&apos;âge recommandée :{" "}
                              {entry.specificAge != null
                                ? `${entry.specificAge} ${entry.ageUnit?.toLowerCase() ?? ""}`
                                : `${entry.minAge ?? "?"} - ${entry.maxAge ?? "?"} ${
                                    entry.ageUnit?.toLowerCase() ?? ""
                                  }`}
                            </p>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className={sectionClasses}>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Vaccins programmés
                </div>
                <div className="space-y-3 text-sm">
                  {vaccinations.scheduled.length === 0 ? (
                    <p className="text-slate-500">Aucun rendez-vous programmé.</p>
                  ) : (
                    Object.entries(
                      vaccinations.scheduled.reduce<
                        Record<string, { entry: typeof vaccinations.scheduled[number]; doses: number[] }>
                      >((acc, item) => {
                        if (!acc[item.vaccineId]) {
                          acc[item.vaccineId] = { entry: item, doses: [] };
                        }
                        acc[item.vaccineId].doses.push(item.dose);
                        return acc;
                      }, {}),
                    ).map(([vaccineId, group]) => {
                      const { entry, doses } = group;
                      const doseLabel =
                        doses.length === 1
                          ? `Dose ${doses[0]}`
                          : `Doses ${doses.sort((a, b) => a - b).join(", ")}`;
                      return (
                        <div key={vaccineId} className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                          <p className="font-semibold text-amber-900">{entry.vaccineName}</p>
                          <p className="text-xs text-amber-700">{doseLabel}</p>
                          <p className="text-xs text-amber-700">Prévu le {formatDate(entry.scheduledFor)}</p>
                          {entry.plannerName && (
                            <p className="text-xs text-amber-600">Planifié par {entry.plannerName}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className={sectionClasses}>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Vaccins en retard
                </div>
                <div className="space-y-3 text-sm">
                  {vaccinations.late.length === 0 && vaccinations.overdue.length === 0 ? (
                    <p className="text-slate-500">Aucun retard signalé.</p>
                  ) : (
                    Object.entries(
                      [...vaccinations.late, ...vaccinations.overdue].reduce<
                        Record<string, { entry: typeof vaccinations.late[number]; doses: Set<number> }>
                      >((acc, item) => {
                        const key = `${item.vaccineId}-${item.calendarId ?? "none"}`;
                        if (!acc[key]) {
                          acc[key] = { entry: item, doses: new Set<number>() };
                        }
                        acc[key].doses.add(item.dose);
                        return acc;
                      }, {}),
                    ).map(([key, group]) => {
                      const { entry, doses } = group;
                      const uniqueDoses = Array.from(doses).sort((a, b) => a - b);
                      const doseLabel =
                        uniqueDoses.length === 1
                          ? `Dose ${uniqueDoses[0]}`
                          : `Doses ${uniqueDoses.join(", ")}`;
                      return (
                        <div key={key} className="rounded-xl border border-red-100 bg-red-50 p-3">
                          <p className="font-semibold text-red-900">{entry.vaccineName}</p>
                          <p className="text-xs text-red-700">{doseLabel}</p>
                          <p className="text-xs text-red-700">Date limite dépassée : {formatDate(entry.dueDate)}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className={sectionClasses}>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Vaccins administrés
                </div>
                <div className="space-y-3 text-sm">
                  {vaccinations.completed.length === 0 ? (
                    <p className="text-slate-500">Aucun vaccin enregistré.</p>
                  ) : (
                    Object.entries(
                      vaccinations.completed.reduce<
                        Record<string, { entry: typeof vaccinations.completed[number]; doses: number[] }>
                      >((acc, item) => {
                        if (!acc[item.vaccineId]) {
                          acc[item.vaccineId] = { entry: item, doses: [] };
                        }
                        acc[item.vaccineId].doses.push(item.dose);
                        return acc;
                      }, {}),
                    ).map(([vaccineId, group]) => {
                      const { entry, doses } = group;
                      const doseLabel =
                        doses.length === 1
                          ? `Dose ${doses[0]}`
                          : `Doses ${doses.sort((a, b) => a - b).join(", ")}`;
                      return (
                        <div key={vaccineId} className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                          <p className="font-semibold text-emerald-900">{entry.vaccineName}</p>
                          <p className="text-xs text-emerald-700">{doseLabel}</p>
                          <p className="text-xs text-emerald-700">Administré le {formatDate(entry.administeredAt)}</p>
                          {entry.administeredByName && (
                            <p className="text-xs text-emerald-600">Par {entry.administeredByName}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {canEditBuckets && managerOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 px-4 py-8">
          <div className="flex w-full max-w-4xl flex-col rounded-3xl bg-white p-6 shadow-2xl md:p-8 lg:p-10 max-h-[85vh]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Gestion manuelle du carnet
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {detail.child.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setManagerOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                aria-label="Fermer la gestion"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError ? (
              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold uppercase tracking-wide text-blue-700">
                  <div className="flex items-center gap-2">
                    <Syringe className="h-4 w-4 text-blue-500" />
                    Vaccins à faire
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenEditor("due", "create")}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter
                  </button>
                </div>
                <div className="space-y-3 text-sm text-blue-900">
                  {dueEntries.length === 0 ? (
                    <p className="text-blue-700">Aucune entrée.</p>
                  ) : (
                    dueEntries.map((entry) => renderManualEntryCard(entry))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-red-200 bg-red-50/80 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold uppercase tracking-wide text-red-700">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Vaccins en retard
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenEditor("late", "create")}
                    className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter
                  </button>
                </div>
                <div className="space-y-3 text-sm text-red-900">
                  {vaccinations.late.length === 0 ? (
                    <p className="text-red-700">Aucune entrée.</p>
                  ) : (
                    vaccinations.late
                      .map((entry) => prepareManualEntry("late", entry))
                      .map((entry) => renderManualEntryCard(entry))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Vaccins administrés
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenEditor("completed", "create")}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter
                  </button>
                </div>
                <div className="space-y-3 text-sm text-emerald-900">
                  {completedEntries.length === 0 ? (
                    <p className="text-emerald-700">Aucune entrée.</p>
                  ) : (
                    completedEntries.map((entry) => renderManualEntryCard(entry))
                  )}
                </div>
              </section>
            </div>
            </div>
          </div>
        </div>
      ) : null}

      {canEditBuckets && editorState.open && editorState.bucket ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/70 px-4 py-8">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {editorState.mode === "create" ? "Nouvelle entrée" : "Modifier l'entrée"}
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {detail.child.name} • {BUCKET_META[editorState.bucket].label}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                aria-label="Fermer le formulaire"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {referenceError ? (
              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p className="mb-2">{referenceError}</p>
                <button
                  type="button"
                  onClick={fetchReferenceData}
                  className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                  disabled={referenceLoading}
                >
                  Réessayer
                </button>
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={handleEditorSubmit}>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Vaccin
                </label>
                <select
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  value={formValues.vaccineId}
                  onChange={(event) =>
                    handleFormValueChange("vaccineId", event.target.value)
                  }
                  required
                >
                  <option value="">Sélectionnez un vaccin</option>
                  {referenceData.vaccines.map((vaccine) => (
                    <option key={vaccine.id} value={vaccine.id}>
                      {vaccine.name}
                    </option>
                  ))}
                </select>
              </div>

              {(BUCKET_META[editorState.bucket].requireCalendar ||
                referenceData.calendars.length > 0) && (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Fenêtre du calendrier
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    value={formValues.calendarId}
                    onChange={(event) =>
                      handleFormValueChange("calendarId", event.target.value)
                    }
                    required={false}
                  >
                    <option value="">Optionnel (modification spécifique à l'enfant)</option>
                    {filteredCalendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Dose
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    value={formValues.dose}
                    onChange={(event) =>
                      handleFormValueChange("dose", event.target.value)
                    }
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    {BUCKET_META[editorState.bucket].dateLabel}
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    value={formValues.date}
                    onChange={(event) =>
                      handleFormValueChange("date", event.target.value)
                    }
                    required
                  />
                </div>
              </div>

              {formError ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {formError}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      {editorState.mode === "create" ? "Ajouter" : "Mettre à jour"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default VaccinationRecordModal;
