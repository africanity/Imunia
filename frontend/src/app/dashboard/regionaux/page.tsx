"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  MapPin,
  Mail,
  Plus,
  Trash2,
  Users,
  X,
  Pencil,
  Loader2,
} from "lucide-react";
import DashboardShell from "../components/DashboardShell";
import StatCard from "../components/StatCard";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type ScopeOption = {
  id: string;
  name: string;
};

type RawUser = {
  id: string;
  email: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  regionId?: string | null;
  districtId?: string | null;
  healthCenterId?: string | null;
  agentLevel?: string | null;
};

type ManagedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  scopeId: string | null;
  agentLevel?: string | null;
};

type ManagedForm = {
  firstName: string;
  lastName: string;
  email: string;
  scopeId: string;
};

const EMPTY_FORM: ManagedForm = {
  firstName: "",
  lastName: "",
  email: "",
  scopeId: "",
};

type UserDeletionTotals = {
  recordsDeleted: number;
  scheduledPlannerCleared: number;
  completedAdminCleared: number;
  overdueEscalationCleared: number;
  childrenNextAgentCleared: number;
  vaccineRequestsCleared: number;
  pendingTransfersCleared: number;
};

type UserDeletionSummary = {
  success: boolean;
  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    role: string;
  };
  totals: UserDeletionTotals;
};

export default function ManagedUsersPage() {
  const { accessToken, user } = useAuth();

  const isNational = user?.role === "NATIONAL";
  const isRegional = user?.role === "REGIONAL";
  const isDistrict = user?.role === "DISTRICT";
  const isAgentAdmin = user?.role === "AGENT" && user?.agentLevel === "ADMIN";

  const config = useMemo(() => {
    if (isNational) {
      return {
        mode: "national" as const,
        title: "Gestion des régionaux",
        description: "Administration des utilisateurs responsables des régions.",
        createLabel: "Ajouter un régional",
        emptyLabel: "Aucun régional enregistré",
        scopeLabel: "Région",
        scopeApiPath: "region",
        usersApiPath: "regional",
        expectedRole: "REGIONAL",
        expectedAgentLevel: undefined,
        activePath: "/dashboard/regionaux",
        statsTitle: "Total régionaux",
        canManage: true,
        showScopeSelect: true,
        scopeField: "regionId" as const,
        defaultScopeId: undefined,
        defaultScopeName: undefined,
      };
    }

    if (isRegional) {
      return {
        mode: "regional" as const,
        title: "Gestion des agents de district",
        description: "Administration des administrateurs de district pour votre région.",
        createLabel: "Ajouter un agent de district",
        emptyLabel: "Aucun agent de district enregistré",
        scopeLabel: "District",
        scopeApiPath: "district",
        usersApiPath: "district",
        expectedRole: "DISTRICT",
        expectedAgentLevel: undefined,
        activePath: "/dashboard/regionaux",
        statsTitle: "Total agents de district",
        canManage: true,
        showScopeSelect: true,
        scopeField: "districtId" as const,
        defaultScopeId: undefined,
        defaultScopeName: undefined,
      };
    }

    if (isDistrict) {
      return {
        mode: "district" as const,
        title: "Gestion des agents",
        description: "Administration des agents de santé rattachés à vos centres.",
        createLabel: "Ajouter un agent",
        emptyLabel: "Aucun agent enregistré",
        scopeLabel: "Centre de santé",
        scopeApiPath: "healthCenter",
        usersApiPath: "agent-admin",
        expectedRole: "AGENT",
        expectedAgentLevel: "ADMIN" as const,
        activePath: "/dashboard/agents",
        statsTitle: "Total agents",
        canManage: true,
        showScopeSelect: true,
        scopeField: "healthCenterId" as const,
        defaultScopeId: undefined,
        defaultScopeName: undefined,
      };
    }

    if (isAgentAdmin) {
      return {
        mode: "agentAdmin" as const,
        title: "Gestion de l'équipe",
        description: "Administrez les agents staff de votre centre de santé.",
        createLabel: "Ajouter un agent staff",
        emptyLabel: "Aucun agent staff enregistré",
        scopeLabel: null,
        scopeApiPath: null,
        usersApiPath: "agent-staff",
        expectedRole: "AGENT",
        expectedAgentLevel: "STAFF" as const,
        activePath: "/dashboard/equipe",
        statsTitle: "Total agents staff",
        canManage: true,
        showScopeSelect: false,
        scopeField: "healthCenterId" as const,
        defaultScopeId: user?.healthCenterId ?? "",
        defaultScopeName: user?.healthCenterName ?? "Votre centre de santé",
      };
    }

    return {
      mode: "unsupported" as const,
      title: "Gestion des utilisateurs",
      description: "Votre rôle ne permet pas d’accéder à cette section.",
      createLabel: "",
      emptyLabel: "Aucun utilisateur",
      scopeLabel: null,
      scopeApiPath: null,
      usersApiPath: "",
      expectedRole: "",
      expectedAgentLevel: undefined,
      activePath: "/dashboard",
      statsTitle: "Total utilisateurs",
      canManage: false,
      showScopeSelect: false,
      scopeField: "healthCenterId" as const,
      defaultScopeId: "",
      defaultScopeName: "",
    };
  }, [isNational, isRegional, isDistrict, isAgentAdmin, user?.healthCenterId, user?.healthCenterName]);

  const title = config.title;
  const description = config.description;
  const createLabel = config.createLabel;
  const emptyLabel = config.emptyLabel;
  const scopeLabel = config.scopeLabel;
  const scopeApiPath = config.scopeApiPath;
  const usersApiPath = config.usersApiPath;
  const expectedRole = config.expectedRole;
  const expectedAgentLevel = config.expectedAgentLevel;
  const activePath = config.activePath;
  const statsTitle = config.statsTitle;
  const canManage = config.canManage;
  const showScopeSelect = config.showScopeSelect;
  const scopeField = config.scopeField;
  const defaultScopeId = config.defaultScopeId ?? "";
  const defaultScopeName = config.defaultScopeName ?? "";

  const isUnsupported = config.mode === "unsupported";

  const [scopes, setScopes] = useState<ScopeOption[]>([]);
  const [usersList, setUsersList] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [form, setForm] = useState<ManagedForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSummary, setDeleteSummary] =
    useState<UserDeletionSummary | null>(null);
  const [deleteSummaryLoading, setDeleteSummaryLoading] = useState(false);
  const [deleteSummaryError, setDeleteSummaryError] = useState<string | null>(
    null,
  );

  const fallbackScopeName = defaultScopeName || "Votre centre de santé";

  const editTitle =
    config.mode === "national"
      ? "Modifier le régional"
      : config.mode === "regional"
      ? "Modifier l'agent de district"
      : config.mode === "district"
      ? "Modifier l'agent"
      : "Modifier l'agent staff";

  const createTitle =
    config.mode === "national"
      ? "Nouveau régional"
      : config.mode === "regional"
      ? "Nouvel agent de district"
      : config.mode === "district"
      ? "Nouvel agent"
      : "Nouvel agent staff";

  // En mode édition, tous les rôles (National, Regional, District, AgentAdmin) ne peuvent modifier que l'entité
  // Les informations personnelles sont grisées
  const disableIdentityFields = formMode === "edit";

  useEffect(() => {
    if (!showScopeSelect) {
      if (defaultScopeId) {
        setScopes([{ id: defaultScopeId, name: fallbackScopeName }]);
      } else {
        setScopes([]);
      }
    }
  }, [showScopeSelect, defaultScopeId, fallbackScopeName]);

  const fetchScopes = useCallback(async () => {
    if (!accessToken || !showScopeSelect || !scopeApiPath) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/${scopeApiPath}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const payload = await res.json();
      const items: ScopeOption[] = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.regions)
        ? payload.regions
        : Array.isArray(payload)
        ? payload
        : [];

      setScopes(items.map((entry: any) => ({ id: entry.id, name: entry.name })));
    } catch (err) {
      console.error("Erreur chargement", scopeApiPath, err);
      const scopeLabelForErrors = scopeLabel ?? "affectations";
      setError((prev) => prev ?? `Impossible de charger les ${scopeLabelForErrors.toLowerCase()}s`);
    }
  }, [accessToken, scopeApiPath, scopeLabel, showScopeSelect]);

  const fetchUsers = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    if (!expectedRole) {
      setUsersList([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/api/users`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const data: RawUser[] = await res.json();

      const filtered = data.filter((entry) => {
        if (entry.role !== expectedRole) {
          return false;
        }
        if (expectedAgentLevel) {
          return entry.agentLevel === expectedAgentLevel;
        }
        return true;
      });

      const items = filtered.map<ManagedUser>((entry) => {
        const rawScopeId =
          scopeField === "regionId"
            ? entry.regionId ?? null
            : scopeField === "districtId"
            ? entry.districtId ?? null
            : entry.healthCenterId ?? null;

        const normalizedScopeId = showScopeSelect
          ? rawScopeId
          : defaultScopeId || rawScopeId || null;

        return {
          id: entry.id,
          email: entry.email,
          firstName: entry.firstName ?? "",
          lastName: entry.lastName ?? "",
          scopeId: normalizedScopeId,
          agentLevel: entry.role === "AGENT" ? entry.agentLevel ?? undefined : undefined,
        };
      });

      setUsersList(items);
    } catch (err) {
      console.error("Erreur chargement utilisateurs:", err);
      setError("Impossible de charger les utilisateurs");
    } finally {
      setLoading(false);
    }
  }, [accessToken, expectedRole, expectedAgentLevel, scopeField, showScopeSelect, defaultScopeId]);

  useEffect(() => {
    fetchScopes();
    fetchUsers();
  }, [fetchScopes, fetchUsers]);

  const clearDeleteState = useCallback(() => {
    setDeleteSummary(null);
    setDeleteSummaryError(null);
    setDeleteSummaryLoading(false);
  }, []);

  const loadDeleteSummary = useCallback(
    async (userId: string) => {
      if (!accessToken) {
        return;
      }

      try {
        setDeleteSummaryLoading(true);
        setDeleteSummaryError(null);
        setDeleteSummary(null);

        const res = await fetch(
          `${API_URL}/api/users/${userId}/delete-summary`,
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
        setDeleteSummary(data as UserDeletionSummary);
      } catch (err) {
        console.error("Erreur résumé suppression utilisateur:", err);
        setDeleteSummaryError(
          "Impossible de charger le détail de la suppression.",
        );
      } finally {
        setDeleteSummaryLoading(false);
      }
    },
    [accessToken],
  );

  const openDeleteModal = (userToDelete: ManagedUser) => {
    setDeleteTarget(userToDelete);
    clearDeleteState();
    loadDeleteSummary(userToDelete.id);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    clearDeleteState();
  };

  const openCreateModal = () => {
    setFormMode("create");
    setCurrentId(null);
    setForm({
      ...EMPTY_FORM,
      scopeId: showScopeSelect ? scopes[0]?.id ?? "" : defaultScopeId,
    });
    setShowFormModal(true);
  };

  const openEditModal = (userToEdit: ManagedUser) => {
    setFormMode("edit");
    setCurrentId(userToEdit.id);
    setForm({
      firstName: userToEdit.firstName,
      lastName: userToEdit.lastName,
      email: userToEdit.email,
      scopeId: userToEdit.scopeId ?? (showScopeSelect ? "" : defaultScopeId),
    });
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setFormMode("create");
    setCurrentId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!accessToken) return;

    const isEdit = formMode === "edit" && currentId;

    const targetScopeId = showScopeSelect ? form.scopeId.trim() : defaultScopeId;

    if (showScopeSelect) {
      if (!targetScopeId) {
        const scopeLabelForErrors = scopeLabel ?? "élément";
        setModalError(`Veuillez sélectionner un ${scopeLabelForErrors.toLowerCase()}.`);
        return;
      }
    } else if (!targetScopeId) {
      setModalError("Votre compte n'est pas rattaché à un centre de santé.");
      return;
    }

    if (!isEdit) {
      if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
        setModalError("Veuillez renseigner le prénom, nom et email");
        return;
      }
    }

    const endpoint = isEdit
      ? `${API_URL}/api/users/${usersApiPath}/${currentId}`
      : `${API_URL}/api/users/${usersApiPath}`;
    const method = isEdit ? "PUT" : "POST";

    const payload = isEdit
      ? {
          [scopeField]: targetScopeId,
        }
      : {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          [scopeField]: targetScopeId,
        };

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

      closeFormModal();
      await fetchUsers();
    } catch (err) {
      console.error("Erreur sauvegarde utilisateur:", err);
      // Utiliser le message d'erreur du backend s'il existe, sinon message générique
      const errorMessage = err instanceof Error && err.message 
        ? err.message 
        : "Impossible d'enregistrer l'utilisateur";
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

      const res = await fetch(`${API_URL}/api/users/${usersApiPath}/${deleteTarget.id}`, {
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
      await fetchUsers();
    } catch (err) {
      console.error("Erreur suppression utilisateur:", err);
      setError("Impossible de supprimer l'utilisateur");
    } finally {
      setDeleting(false);
    }
  };

  const scopeMap = useMemo(() => {
    const map = scopes.reduce<Record<string, string>>((acc, scope) => {
      acc[scope.id] = scope.name;
      return acc;
    }, {});

    if (!showScopeSelect && defaultScopeId) {
      map[defaultScopeId] = fallbackScopeName;
    }

    return map;
  }, [scopes, showScopeSelect, defaultScopeId, fallbackScopeName]);

  const displayScopeLabel =
    scopeLabel ??
    (scopeField === "regionId"
      ? "Région"
      : scopeField === "districtId"
      ? "District"
      : "Centre de santé");

  const cards = useMemo(() => {
    if (loading) {
      return (
        <div className="col-span-full flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="text-sm text-slate-600">Chargement...</p>
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

    if (usersList.length === 0) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
          <Users className="mb-4 h-16 w-16 text-slate-300" />
          <p className="text-lg font-semibold">{emptyLabel}</p>
          <p className="mt-1 text-sm text-slate-400">
            Ajoutez votre premier utilisateur pour commencer.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              {createLabel}
            </button>
          )}
        </div>
      );
    }

    return usersList.map((item, index) => {
      const initials = `${item.firstName.charAt(0) ?? ""}${item.lastName.charAt(0) ?? ""}`.trim() || "U";
      const scopeName =
        item.scopeId != null
          ? scopeMap[item.scopeId] ??
            (showScopeSelect ? "Non assigné" : fallbackScopeName)
          : showScopeSelect
          ? "Non assigné"
          : fallbackScopeName;

      return (
        <div
          key={item.id}
          className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-500 text-lg font-bold text-white shadow-sm ring-2 ring-white">
              {initials}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900">
                {item.firstName || item.lastName ? `${item.firstName} ${item.lastName}`.trim() : item.email}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="h-4 w-4" />
                <span>
                  {displayScopeLabel}: {scopeName}
                </span>
              </div>
              {item.agentLevel && (
                <p className="text-xs uppercase text-slate-400">Niveau : {item.agentLevel}</p>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="truncate">{item.email}</span>
            </div>
          </div>

          {canManage && (
            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => openEditModal(item)}
                className="rounded-lg bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
                title="Modifier"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openDeleteModal(item)}
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
  }, [
    loading,
    error,
    usersList,
    emptyLabel,
    createLabel,
    canManage,
    showScopeSelect,
    scopeMap,
    displayScopeLabel,
    fallbackScopeName,
  ]);

  const userDeleteSummaryItems = useMemo(() => {
    if (!deleteSummary) {
      return [];
    }

    const totals = deleteSummary.totals;
    return [
      { label: "Dossiers enregistrés", value: totals.recordsDeleted },
      {
        label: "Rendez-vous planifiés",
        value: totals.scheduledPlannerCleared,
        hint: "Le planificateur sera retiré",
      },
      {
        label: "Vaccins administrés",
        value: totals.completedAdminCleared,
        hint: "L'agent sera retiré des fiches",
      },
      {
        label: "Vaccins manqués",
        value: totals.overdueEscalationCleared,
        hint: "L'agent escaladé sera retiré",
      },
      {
        label: "Enfants suivis",
        value: totals.childrenNextAgentCleared,
        hint: "L'agent référent sera retiré",
      },
      {
        label: "Demandes vaccins planifiées",
        value: totals.vaccineRequestsCleared,
      },
      {
        label: "Transferts en attente confirmés",
        value: totals.pendingTransfersCleared,
      },
    ];
  }, [deleteSummary]);

  if (isUnsupported) {
    return (
      <DashboardShell active={activePath}>
        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-700">
          Vous n&apos;avez pas accès à cette section.
        </div>
      </DashboardShell>
    );
  }

  return (
    <>
      <DashboardShell active={activePath}>
        <div className="space-y-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-500">{description}</p>
            </div>
            <div className="flex gap-3">
              {canManage && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" /> {createLabel}
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title={statsTitle}
              value={loading ? "…" : usersList.length}
              icon={Users}
              accent="blue"
              loading={loading}
            />
          </div>

          {error && !loading && (
            <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">{cards}</div>
        </div>
      </DashboardShell>

      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-lg rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Users className="h-5 w-5 text-blue-600" />
                {formMode === "edit" ? editTitle : createTitle}
              </div>
              <button
                type="button"
                onClick={closeFormModal}
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-600">Prénom</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, firstName: event.target.value }));
                      setModalError(null);
                    }}
                    disabled={disableIdentityFields}
                    className={`mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                      disableIdentityFields ? "bg-slate-100 text-slate-500" : ""
                    }`}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Nom</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, lastName: event.target.value }));
                      setModalError(null);
                    }}
                    disabled={disableIdentityFields}
                    className={`mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                      disableIdentityFields ? "bg-slate-100 text-slate-500" : ""
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-600">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, email: event.target.value }));
                      setModalError(null);
                    }}
                    disabled={disableIdentityFields}
                    className={`mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                      disableIdentityFields ? "bg-slate-100 text-slate-500" : ""
                    }`}
                  />
                </div>
              </div>

              {showScopeSelect ? (
                <div>
                  <label className="text-sm font-medium text-slate-600">
                    {scopeLabel ?? "Affectation"}
                  </label>
                  <select
                    value={form.scopeId}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, scopeId: event.target.value }));
                      setModalError(null);
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">— Sélectionner —</option>
                    {scopes.map((scope) => (
                      <option key={scope.id} value={scope.id}>
                        {scope.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Centre de santé
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">{fallbackScopeName}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
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
                Supprimer cet utilisateur ?
              </h3>
              <p className="text-sm text-slate-500">
                Êtes-vous sûr de vouloir supprimer {deleteTarget.firstName || deleteTarget.lastName ? `${deleteTarget.firstName} ${deleteTarget.lastName}`.trim() : deleteTarget.email} ?
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
                      onClick={() => loadDeleteSummary(deleteTarget.id)}
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
                    <ul className="mt-2 space-y-2 text-sm">
                      {userDeleteSummaryItems.map((item) => (
                        <li
                          key={item.label}
                          className="flex flex-col rounded-lg bg-white px-3 py-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">{item.label}</span>
                            <span className="font-semibold text-slate-900">
                              {item.value}
                            </span>
                          </div>
                          {item.hint && (
                            <span className="text-xs text-slate-400">{item.hint}</span>
                          )}
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
