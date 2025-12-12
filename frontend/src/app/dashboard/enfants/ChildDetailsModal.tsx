"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Baby,
  Calendar,
  CalendarPlus,
  FileImage,
  HeartPulse,
  Home,
  Loader2,
  MapPin,
  Phone,
  Stethoscope,
  Syringe,
  User,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Child, VaccinationDetail } from "./types";

const VaccinationRecordModal = dynamic(
  () => import("./VaccinationRecordModal"),
  { ssr: false },
);

const ChildDocumentsModal = dynamic(
  () => import("./ChildDocumentsModal"),
  { ssr: false },
);

const formatDate = (value?: string | null, withTime = false): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR", {
    weekday: withTime ? "long" : undefined,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: withTime ? "2-digit" : undefined,
    minute: withTime ? "2-digit" : undefined,
  });
};

const deriveStatusLabel = (child: Child): string => {
  if (child.status === "A_JOUR") return "À jour";
  if (child.vaccinesLate.length > 0 || child.vaccinesOverdue.length > 0) return "En retard";
  if (child.vaccinesDue.length > 0) return "À faire";
  return "Pas à jour";
};

const computeNextAppointmentFromDetail = (detail: VaccinationDetail | null) => {
  if (!detail) return null;
  const validDates = detail.vaccinations.scheduled
    .map((entry) => {
      if (!entry.scheduledFor) return null;
      const date = new Date(entry.scheduledFor);
      if (Number.isNaN(date.getTime())) return null;
      return date;
    })
    .filter((date): date is Date => !!date)
    .sort((a, b) => a.getTime() - b.getTime());

  if (validDates.length === 0) {
    return null;
  }
  return validDates[0].toISOString();
};

type Props = {
  child: Child;
  token: string;
  apiBase: string;
  onClose: () => void;
  onRefresh?: () => void;
  canSchedule?: boolean;
  canEditVaccinations?: boolean;
};

type ScheduleOption = {
  vaccineId: string;
  vaccineName: string;
  calendarId: string | null;
  label: string;
};

export default function ChildDetailsModal({
  child,
  token,
  apiBase,
  onClose,
  onRefresh,
  canSchedule = false,
  canEditVaccinations = false,
}: Props) {
  const [detail, setDetail] = useState<VaccinationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecord, setShowRecord] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleOptions, setScheduleOptions] = useState<ScheduleOption[]>([]);
  const [selectedVaccineId, setSelectedVaccineId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [currentNextAppointment, setCurrentNextAppointment] = useState<string | null>(
    child.nextAppointment ?? null,
  );

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiBase}/api/children/${child.id}/vaccinations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `Erreur ${response.status}`);
      }

      const payload: VaccinationDetail = await response.json();
      setDetail(payload);
      const computedNext = computeNextAppointmentFromDetail(payload);
      setCurrentNextAppointment(computedNext ?? null);
    } catch (err) {
      console.error("Erreur chargement vaccination detail:", err);
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [apiBase, child.id, token]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleRecordRefresh = useCallback(async () => {
    await fetchDetail();
    if (onRefresh) {
      onRefresh();
    }
  }, [fetchDetail, onRefresh]);

  useEffect(() => {
    if (!detail) {
      setScheduleOptions([]);
      setSelectedVaccineId(null);
      return;
    }

    const optionMap = new Map<string, ScheduleOption>();
    const pushOption = (
      vaccineId: string,
      vaccineName: string,
      calendarId: string | null,
      contextLabel?: string | null,
    ) => {
      if (!vaccineId || !vaccineName) return;
      const existing = optionMap.get(vaccineId);
      const label =
        contextLabel && contextLabel.trim().length > 0
          ? `${vaccineName} • ${contextLabel}`
          : vaccineName;

      if (!existing) {
        optionMap.set(vaccineId, {
          vaccineId,
          vaccineName,
          calendarId,
          label,
        });
      } else if (!existing.calendarId && calendarId) {
        existing.calendarId = calendarId;
      }
    };

    detail.vaccinations.due.forEach((entry) =>
      pushOption(
        entry.vaccineId,
        entry.vaccineName,
        entry.calendarId ?? null,
        `dose ${entry.dose} à faire`,
      ),
    );

    detail.vaccinations.late.forEach((entry) =>
      pushOption(
        entry.vaccineId,
        entry.vaccineName,
        entry.calendarId ?? null,
        `dose ${entry.dose} en retard`,
      ),
    );

    detail.vaccinations.overdue.forEach((entry) =>
      pushOption(
        entry.vaccineId,
        entry.vaccineName,
        entry.calendarId ?? null,
        `dose ${entry.dose} manquée`,
      ),
    );

    detail.vaccinations.scheduled.forEach((entry) =>
      pushOption(
        entry.vaccineId,
        entry.vaccineName,
        entry.calendarId ?? null,
        `dose ${entry.dose} programmée`,
      ),
    );

    detail.vaccinations.completed.forEach((entry) =>
      pushOption(
        entry.vaccineId,
        entry.vaccineName,
        entry.calendarId ?? null,
        `dose ${entry.dose} administrée`,
      ),
    );

    const options = Array.from(optionMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "fr", { sensitivity: "base" }),
    );

    setScheduleOptions(options);
    if (options.length === 0) {
      setSelectedVaccineId(null);
      return;
    }

    setSelectedVaccineId((current) =>
      current && options.some((option) => option.vaccineId === current)
        ? current
        : options[0].vaccineId,
    );
  }, [detail]);

  const statusLabel = useMemo(() => deriveStatusLabel(child), [child]);

  const dueEntries = detail?.vaccinations?.due ?? [];
  const sortedDueEntries = useMemo(
    () => [...dueEntries].sort((a, b) => (a.dose ?? 1) - (b.dose ?? 1)),
    [dueEntries],
  );

  const dueCount = detail ? detail.vaccinations.due.length : child.vaccinesDue.length;

  const handleOpenSchedule = () => {
    if (scheduleOptions.length === 0) {
      setScheduleError("Aucun vaccin disponible pour la programmation. Vérifiez que l'enfant a des vaccins à faire ou en retard.");
      return;
    }
    if (!selectedVaccineId) {
      setSelectedVaccineId(scheduleOptions[0].vaccineId);
    }
    setScheduleDate("");
    setScheduleError(null);
    setShowScheduleModal(true);
  };

  const handleCloseSchedule = () => {
    setShowScheduleModal(false);
    setScheduleDate("");
    setScheduleError(null);
    setScheduleSubmitting(false);
  };

  const handleSubmitSchedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedVaccineId) {
      setScheduleError("Sélectionnez un vaccin à programmer.");
      return;
    }

    const selectedOption = scheduleOptions.find(
      (option) => option.vaccineId === selectedVaccineId,
    );
    if (!selectedOption) {
      setScheduleError("Vaccin introuvable.");
      return;
    }

    if (!scheduleDate) {
      setScheduleError("Choisissez une date et une heure.");
      return;
    }

    const scheduledFor = new Date(scheduleDate);
    if (Number.isNaN(scheduledFor.getTime())) {
      setScheduleError("La date sélectionnée est invalide.");
      return;
    }

    try {
      setScheduleSubmitting(true);
      setScheduleError(null);

      const response = await fetch(`${apiBase}/api/vaccine/scheduled`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          childId: child.id,
          vaccineId: selectedOption.vaccineId,
          vaccineCalendarId: selectedOption.calendarId,
          scheduledFor: scheduledFor.toISOString(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const errorMessage = payload?.message ?? `Erreur ${response.status}: Impossible de programmer le rendez-vous.`;
        console.error("Erreur programmation vaccin:", {
          status: response.status,
          payload,
          childId: child.id,
          vaccineId: selectedOption.vaccineId,
        });
        throw new Error(errorMessage);
      }

      await fetchDetail();
      await onRefresh?.();
      handleCloseSchedule();
    } catch (err) {
      console.error("schedule vaccine error", err);
      setScheduleError(
        err instanceof Error ? err.message : "Impossible de programmer le rendez-vous.",
      );
    } finally {
      setScheduleSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-3 text-white flex-shrink-0">
          <div>
            <p className="text-xs uppercase tracking-wide text-blue-100">Dossier médical</p>
            <h2 className="text-lg font-semibold">{child.name}</h2>
            <p className="text-xs text-blue-100">{statusLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1">
          <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <User className="h-3.5 w-3.5 text-blue-500" />
              Informations de l'enfant
            </h3>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 flex-shrink-0">
                <Baby className="h-6 w-6 text-blue-600" />
              </div>
              <div className="space-y-0.5 text-sm text-slate-600">
                <p>
                  <span className="inline-block w-24 text-slate-500 text-xs">Nom</span>
                  <span className="font-medium text-slate-900">{child.name}</span>
                </p>
                <p>
                  <span className="inline-block w-24 text-slate-500 text-xs">Naissance</span>
                  <span className="font-medium text-slate-900">{formatDate(child.birthDate)}</span>
                </p>
                <p>
                  <span className="inline-block w-24 text-slate-500 text-xs">Genre</span>
                  <span className="font-medium text-slate-900">{child.gender === "M" ? "Garçon" : "Fille"}</span>
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Home className="h-3.5 w-3.5 text-blue-500" />
              Responsable légal
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs uppercase text-slate-400">Parent</p>
                  <p className="font-medium text-slate-900 truncate">{child.parentName || "Non renseigné"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs uppercase text-slate-400">Téléphone</p>
                  <p className="font-medium text-slate-900">{child.parentPhone || "Non renseigné"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 md:col-span-2">
                <MapPin className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs uppercase text-slate-400">Adresse</p>
                  <p className="font-medium text-slate-900">{child.address || "Non renseignée"}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Stethoscope className="h-3.5 w-3.5 text-blue-500" />
              Suivi vaccinal
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 flex-shrink-0">
                      <Syringe className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex flex-1 items-start justify-between gap-2 text-xs text-slate-600 min-w-0">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">Vaccins à faire</p>
                        <p>
                          {dueCount > 0
                            ? `${dueCount} vaccin(s) à administrer`
                            : "Aucun vaccin à administrer"}
                        </p>
                        {sortedDueEntries.length > 0 && (
                          <p className="mt-1 text-xs text-blue-600">
                            Prochaine dose : dose {sortedDueEntries[0].dose}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 flex-shrink-0">
                      <Calendar className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="text-xs text-slate-600 min-w-0">
                      <p className="font-semibold text-slate-900">Prochain rendez-vous</p>
                      {currentNextAppointment ? (
                        <p className="text-xs">{formatDate(currentNextAppointment, true)}</p>
                      ) : (
                        <p className="text-xs text-slate-500">Non planifié</p>
                      )}
                      {canSchedule && (
                        <div className="mt-1.5">
                          {scheduleOptions.length > 0 ? (
                            <button
                              type="button"
                              onClick={handleOpenSchedule}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                            >
                              <CalendarPlus className="h-3.5 w-3.5" />
                              Programmer
                            </button>
                          ) : (
                            <p className="text-xs text-slate-400">
                              Aucun vaccin à programmer
                            </p>
                          )}
                          {scheduleError && scheduleOptions.length === 0 && (
                            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-600">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {scheduleError}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={() => setShowDocumentsModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            disabled={loading || !!error}
          >
            <FileImage className="h-3.5 w-3.5" />
            Documents
          </button>
          <button
            type="button"
            onClick={() => setShowRecord(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
            disabled={loading || !!error}
          >
            <Syringe className="h-3.5 w-3.5" />
            Carnet complet
          </button>
        </div>
      </div>

      {showDocumentsModal && (
        <ChildDocumentsModal
          childId={child.id}
          childName={child.name}
          token={token}
          isOpen={showDocumentsModal}
          onClose={() => setShowDocumentsModal(false)}
        />
      )}

      {detail && showRecord && (
        <VaccinationRecordModal
          isOpen={showRecord}
          onClose={() => setShowRecord(false)}
          detail={detail}
          childId={child.id}
          apiBase={apiBase}
          token={token}
          canEdit={canEditVaccinations}
          onRefresh={handleRecordRefresh}
        />
      )}

      {showScheduleModal && scheduleOptions.length > 0 && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-blue-500">
                  Programmer un rendez-vous
                </p>
                <h3 className="text-lg font-semibold text-slate-900">{child.name}</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseSchedule}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSchedule} className="space-y-4">
              <div>
                <label
                  htmlFor="vaccineSelect"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Choisissez le vaccin à programmer
                </label>
                <select
                  id="vaccineSelect"
              value={selectedVaccineId ?? ""}
              onChange={(event) => setSelectedVaccineId(event.target.value || null)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
              {selectedVaccineId == null && (
                    <option value="" disabled>
                      Sélectionnez un vaccin
                    </option>
                  )}
              {scheduleOptions.map((option) => (
                <option key={option.vaccineId} value={option.vaccineId}>
                  {option.label}
                </option>
              ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="scheduleDate"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Date et heure du rendez-vous
                </label>
                <input
                  id="scheduleDate"
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(event) => setScheduleDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  min={new Date().toISOString().slice(0, 16)}
                  required
                />
              </div>

              {scheduleError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {scheduleError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseSchedule}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={scheduleSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {scheduleSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Programmation…
                    </>
                  ) : (
                    <>
                      <CalendarPlus className="h-4 w-4" />
                      Confirmer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

