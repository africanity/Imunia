"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  X,
  CheckSquare,
  Square,
  ArrowUpDown,
  Eye,
} from "lucide-react";
import DashboardShell from "@/app/dashboard/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type EventLog = {
  id: string;
  type: string;
  subtype: string | null;
  action: string;
  user: {
    id?: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  details: any;
  metadata: any;
  createdAt: string;
};

type EventType = {
  value: string;
  label: string;
  subtypes?: { value: string; label: string }[];
};

const EVENT_TYPES: EventType[] = [
  {
    value: "ENTITY",
    label: "Entités",
    subtypes: [
      { value: "REGION", label: "Région" },
      { value: "DISTRICT", label: "District" },
      { value: "HEALTHCENTER", label: "Centre de santé" },
    ],
  },
  {
    value: "USER",
    label: "Utilisateurs",
    subtypes: [
      { value: "SUPERADMIN", label: "Super Admin" },
      { value: "NATIONAL", label: "National" },
      { value: "REGIONAL", label: "Régional" },
      { value: "DISTRICT", label: "District" },
      { value: "AGENT", label: "Agent" },
    ],
  },
  { value: "VACCINE", label: "Vaccins" },
  { value: "STOCK", label: "Stocks" },
  { value: "LOT", label: "Lots" },
  { value: "VACCINE_CALENDAR", label: "Calendrier vaccinal" },
  { value: "CHILD", label: "Enfants" },
  { value: "APPOINTMENT", label: "Rendez-vous" },
  { value: "CAMPAIGN", label: "Campagnes" },
  { value: "ADVICE", label: "Conseils" },
  { value: "STOCK_TRANSFER", label: "Transfert de stock" },
  { value: "AUTH", label: "Authentification" },
];

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  ACTIVATE: "Activation",
  TRANSFER_SENT: "Envoi",
  TRANSFER_CONFIRMED: "Acceptation",
  TRANSFER_REJECTED: "Refus",
  TRANSFER_CANCELLED: "Annulation",
  COMPLETED: "Effectué",
  LOGIN: "Connexion",
  LOGOUT: "Déconnexion",
};

// Liste de toutes les actions possibles dans le système
const ALL_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "ACTIVATE",
  "TRANSFER_SENT",
  "TRANSFER_CONFIRMED",
  "TRANSFER_REJECTED",
  "TRANSFER_CANCELLED",
  "COMPLETED",
  "LOGIN",
  "LOGOUT",
];

// Fonction pour obtenir la couleur du badge selon l'action
const getActionBadgeColor = (action: string): string => {
  switch (action) {
    case "CREATE":
    case "ACTIVATE":
    case "TRANSFER_CONFIRMED":
    case "COMPLETED":
    case "LOGIN":
      return "bg-emerald-100 text-emerald-700";
    case "UPDATE":
      return "bg-blue-100 text-blue-700";
    case "DELETE":
    case "TRANSFER_REJECTED":
      return "bg-red-100 text-red-700";
    case "TRANSFER_CANCELLED":
    case "LOGOUT":
      return "bg-orange-100 text-orange-700";
    case "TRANSFER_SENT":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

// Mapping des types techniques vers des libellés lisibles
const OWNER_TYPE_LABELS: Record<string, string> = {
  NATIONAL: "National",
  REGIONAL: "Régional",
  DISTRICT: "District",
  HEALTHCENTER: "Centre de santé",
};

// Fonction pour rendre une valeur de manière lisible pour les détails (user-friendly)
const renderUserFriendlyValue = (value: any, key: string = "", parentKey: string = ""): JSX.Element | null => {
  if (value === null || value === undefined) {
    return null; // Ne pas afficher les valeurs null
  }

  // Ignorer les IDs techniques sauf si c'est nécessaire
  if (key.toLowerCase().endsWith("id") && typeof value === "string" && value.length > 20) {
    return null; // Ignorer les UUIDs
  }

  // Transformer les clés techniques en libellés lisibles
  const getLabel = (k: string): string => {
    const labelMap: Record<string, string> = {
      fromType: "Depuis",
      toType: "Vers",
      fromId: "ID expéditeur",
      toId: "ID destinataire",
      fromName: "Expéditeur",
      toName: "Destinataire",
      vaccineId: "ID vaccin",
      vaccineName: "Vaccin",
      quantity: "Quantité",
      delta: "Variation",
      expiration: "Date d'expiration",
      lotExpiration: "Date d'expiration du lot",
      scheduledFor: "Date prévue",
      dose: "Dose",
      notes: "Notes",
      title: "Titre",
      description: "Description",
      startDate: "Date de début",
      endDate: "Date de fin",
      regionId: "Région (ID)",
      regionName: "Région",
      districtId: "District (ID)",
      districtName: "District",
      healthCenterId: "Centre de santé (ID)",
      healthCenterName: "Centre de santé",
      firstName: "Prénom",
      lastName: "Nom",
      email: "Email",
      gender: "Genre",
      birthDate: "Date de naissance",
      name: "Nom",
      category: "Catégorie",
      ageUnit: "Unité d'âge",
      minAge: "Âge minimum",
      maxAge: "Âge maximum",
      specificAge: "Âge spécifique",
      isActive: "Actif",
      dosesRequired: "Doses requises",
      vaccineCalendarId: "Calendrier vaccinal",
      childId: "ID enfant",
      cancelledAppointments: "Rendez-vous annulés",
      affectedChildIds: "Enfants affectés",
      affectedVaccineIds: "Vaccins affectés",
      cascadeSummary: "Résumé des suppressions",
    };
    return labelMap[k] || k;
  };

  // Transformer les valeurs techniques en libellés
  const getReadableValue = (val: any, k: string): string | JSX.Element => {
    // Types d'entités
    if ((k === "fromType" || k === "toType" || k === "entityType") && typeof val === "string") {
      return OWNER_TYPE_LABELS[val] || val;
    }

    // Booléens
    if (typeof val === "boolean") {
      return val ? "Oui" : "Non";
    }

    // Dates
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
      try {
        const date = new Date(val);
        return date.toLocaleString("fr-FR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return val;
      }
    }

    // Dates simples (sans heure)
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      try {
        const date = new Date(val);
        return date.toLocaleDateString("fr-FR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch {
        return val;
      }
    }

    // Unités d'âge
    if (k === "ageUnit" && typeof val === "string") {
      const ageUnitMap: Record<string, string> = {
        WEEKS: "Semaines",
        MONTHS: "Mois",
        YEARS: "Années",
      };
      return ageUnitMap[val] || val;
    }

    // Genre
    if (k === "gender" && typeof val === "string") {
      const genderMap: Record<string, string> = {
        M: "Masculin",
        F: "Féminin",
      };
      return genderMap[val] || val;
    }

    // Nombres
    if (typeof val === "number") {
      return val.toLocaleString("fr-FR");
    }

    return val;
  };

  if (typeof value === "boolean") {
    const label = getLabel(key);
    const readableValue = getReadableValue(value, key);
    return (
      <div key={key}>
        <span className="font-medium text-slate-600">{label}:</span>{" "}
        <span className="text-slate-700">{readableValue}</span>
      </div>
    );
  }

  if (typeof value === "number") {
    const label = getLabel(key);
    const readableValue = getReadableValue(value, key);
    return (
      <div key={key}>
        <span className="font-medium text-slate-600">{label}:</span>{" "}
        <span className="text-slate-700">{readableValue}</span>
      </div>
    );
  }

  if (typeof value === "string") {
    const label = getLabel(key);
    const readableValue = getReadableValue(value, key);
    return (
      <div key={key}>
        <span className="font-medium text-slate-600">{label}:</span>{" "}
        <span className="text-slate-700">{readableValue}</span>
      </div>
    );
  }

  if (Array.isArray(value)) {
    // Pour les tableaux, afficher le nombre d'éléments
    if (value.length === 0) return null;
    const label = getLabel(key);
    return (
      <div key={key}>
        <span className="font-medium text-slate-600">{label}:</span>{" "}
        <span className="text-slate-700">{value.length} élément(s)</span>
      </div>
    );
  }

  if (typeof value === "object") {
    // Gestion spéciale pour les objets before/after (modifications)
    if ("before" in value && "after" in value) {
      const beforeItems = Object.entries(value.before || {})
        .map(([k, v]) => renderUserFriendlyValue(v, k, "before"))
        .filter(Boolean);
      const afterItems = Object.entries(value.after || {})
        .map(([k, v]) => renderUserFriendlyValue(v, k, "after"))
        .filter(Boolean);

      if (beforeItems.length === 0 && afterItems.length === 0) return null;

      return (
        <div key={key} className="space-y-4">
          {beforeItems.length > 0 && (
            <div>
              <div className="mb-2 font-semibold text-red-600">Avant:</div>
              <div className="ml-4 space-y-1">{beforeItems}</div>
            </div>
          )}
          {afterItems.length > 0 && (
            <div>
              <div className="mb-2 font-semibold text-emerald-600">Après:</div>
              <div className="ml-4 space-y-1">{afterItems}</div>
            </div>
          )}
        </div>
      );
    }

    // Pour les autres objets, rendre récursivement mais ignorer les objets trop techniques
    // D'abord, chercher les paires ID/Nom pour les combiner
    const entries = Object.entries(value);
    const processedKeys = new Set<string>();
    const items: (JSX.Element | null)[] = [];
    
    // Traiter les paires ID/Nom ensemble (ex: regionId + regionName, healthCenterId + healthCenterName)
    entries.forEach(([k, v]) => {
      if (processedKeys.has(k) || v === null || v === undefined) return;
      
      // Gérer spécifiquement fromType/fromName et toType/toName
      if (k === "fromType") {
        const fromName = (value as any)["fromName"];
        if (fromName && typeof fromName === "string") {
          // Afficher le nom exact
          items.push(
            <div key={k}>
              <span className="font-medium text-slate-600">Depuis:</span>{" "}
              <span className="text-slate-700">{fromName}</span>
            </div>
          );
          processedKeys.add("fromType");
          processedKeys.add("fromName");
          return;
        }
        // Si pas de nom, ne pas afficher le type seul (il sera ignoré)
        processedKeys.add("fromType");
        return;
      }
      
      if (k === "toType") {
        const toName = (value as any)["toName"];
        if (toName && typeof toName === "string") {
          // Afficher le nom exact
          items.push(
            <div key={k}>
              <span className="font-medium text-slate-600">Vers:</span>{" "}
              <span className="text-slate-700">{toName}</span>
            </div>
          );
          processedKeys.add("toType");
          processedKeys.add("toName");
          return;
        }
        // Si pas de nom, ne pas afficher le type seul (il sera ignoré)
        processedKeys.add("toType");
        return;
      }
      
      // Ignorer fromName et toName si fromType/toType ont déjà été traités
      if ((k === "fromName" && processedKeys.has("fromType")) || 
          (k === "toName" && processedKeys.has("toType"))) {
        return;
      }
      
      // Si c'est un ID d'entité, chercher le nom correspondant
      if (k.endsWith("Id") && typeof v === "string") {
        const entityType = k.replace("Id", "");
        const nameKey = `${entityType}Name`;
        let nameValue = (value as any)[nameKey];
        
        // Si pas de nom spécifique, chercher un champ "name" au même niveau
        if (!nameValue && (value as any)["name"] && typeof (value as any)["name"] === "string") {
          nameValue = (value as any)["name"];
        }
        
        if (nameValue && typeof nameValue === "string") {
          // Afficher le nom au lieu de l'ID
          const label = getLabel(nameKey) || getLabel(k).replace(" (ID)", "");
          items.push(
            <div key={k}>
              <span className="font-medium text-slate-600">{label}:</span>{" "}
              <span className="text-slate-700">{nameValue}</span>
            </div>
          );
          processedKeys.add(k);
          processedKeys.add(nameKey);
          if ((value as any)["name"] === nameValue) {
            processedKeys.add("name");
          }
          return;
        }
        
        // Si c'est un UUID, l'ignorer
        if (v.length > 20) {
          processedKeys.add(k);
          return;
        }
      }
      
      // Pour firstName/lastName, les combiner en "Nom complet"
      if (k === "firstName") {
        const lastName = (value as any)["lastName"];
        if (lastName && typeof lastName === "string") {
          const fullName = `${v} ${lastName}`;
          items.push(
            <div key="fullName">
              <span className="font-medium text-slate-600">Nom complet:</span>{" "}
              <span className="text-slate-700">{fullName}</span>
            </div>
          );
          processedKeys.add("firstName");
          processedKeys.add("lastName");
          return;
        }
      }
      
      if (processedKeys.has(k)) return;
      
      // Ignorer lastName si firstName a déjà été traité
      if (k === "lastName" && processedKeys.has("firstName")) return;
      
      // Si c'est un champ "name" qui a déjà été utilisé avec un ID, l'ignorer
      if (k === "name" && processedKeys.has("name")) return;
      
      // Traiter normalement les autres entrées
      const rendered = renderUserFriendlyValue(v, k, key);
      if (rendered) {
        items.push(rendered);
      }
      processedKeys.add(k);
    });

    const filteredItems = items.filter(Boolean);
    if (filteredItems.length === 0) return null;

    // Si on est au niveau racine et que la clé est vide, ne pas créer de conteneur supplémentaire
    if (!key) {
      return (
        <>
          {items}
        </>
      );
    }

    return (
      <div key={key} className="space-y-1">
        {items}
      </div>
    );
  }

  return null;
};

// Fonction pour rendre une valeur de manière lisible (version technique pour métadonnées)
const renderValue = (value: any, key: string = ""): JSX.Element => {
  if (value === null || value === undefined) {
    return <span className="text-slate-400">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-blue-600">{value ? "true" : "false"}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-purple-600">{value}</span>;
  }
  if (typeof value === "string") {
    // Si c'est une date ISO
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      try {
        const date = new Date(value);
        return <span className="text-indigo-600">{date.toLocaleString("fr-FR")}</span>;
      } catch {
        return <span className="text-slate-700">{value}</span>;
      }
    }
    return <span className="text-slate-700">{value}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="ml-4 list-disc space-y-1">
        {value.map((item, index) => (
          <li key={index}>{renderValue(item, `${key}[${index}]`)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    // Gestion spéciale pour les objets before/after (modifications)
    if ("before" in value && "after" in value) {
      return (
        <div className="ml-4 space-y-3 border-l-2 border-slate-200 pl-4">
          <div>
            <span className="font-semibold text-red-600">Avant:</span>
            <div className="ml-2 mt-1">{renderValue(value.before, `${key}.before`)}</div>
          </div>
          <div>
            <span className="font-semibold text-emerald-600">Après:</span>
            <div className="ml-2 mt-1">{renderValue(value.after, `${key}.after`)}</div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="ml-4 space-y-2 border-l-2 border-slate-200 pl-4">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <span className="font-medium text-slate-600">{k}:</span>{" "}
            <span className="ml-1">{renderValue(v, k)}</span>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(value)}</span>;
};

export default function JournalPage() {
  const { accessToken, user } = useAuth();
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventLog | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Filtres
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [subtypeFilter, setSubtypeFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  // États pour les filtres collapsibles
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (typeFilter) params.append("type", typeFilter);
      if (subtypeFilter) params.append("subtype", subtypeFilter);
      if (actionFilter) params.append("action", actionFilter);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      if (date) params.append("date", date);
      params.append("sortOrder", sortOrder);
      params.append("page", page.toString());
      params.append("limit", limit.toString());

      const response = await fetch(`${API_URL}/api/event-logs?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      setEvents(data.events || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error("Erreur chargement événements:", err);
      setError(err instanceof Error ? err.message : "Impossible de charger les événements");
    } finally {
      setLoading(false);
    }
  }, [accessToken, typeFilter, subtypeFilter, actionFilter, dateFrom, dateTo, date, sortOrder, page]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDelete = async (eventId: string) => {
    if (!accessToken) return;

    if (!confirm("Êtes-vous sûr de vouloir supprimer cet événement ?")) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/event-logs/${eventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Impossible de supprimer l'événement");
      }

      await fetchEvents();
      setSelectedEvents(new Set());
    } catch (err) {
      console.error("Erreur suppression événement:", err);
      alert(err instanceof Error ? err.message : "Impossible de supprimer l'événement");
    }
  };

  const handleDeleteMultiple = async () => {
    if (!accessToken || selectedEvents.size === 0) return;

    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedEvents.size} événement(s) ?`)) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`${API_URL}/api/event-logs`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ ids: Array.from(selectedEvents) }),
      });

      if (!response.ok) {
        throw new Error("Impossible de supprimer les événements");
      }

      await fetchEvents();
      setSelectedEvents(new Set());
    } catch (err) {
      console.error("Erreur suppression événements:", err);
      alert(err instanceof Error ? err.message : "Impossible de supprimer les événements");
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectEvent = (eventId: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedEvents.size === events.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(events.map((e) => e.id)));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getAvailableSubtypes = () => {
    if (!typeFilter) return [];
    const eventType = EVENT_TYPES.find((t) => t.value === typeFilter);
    return eventType?.subtypes || [];
  };

  const getAvailableActions = () => {
    // Retourner toutes les actions possibles, pas seulement celles présentes dans les événements chargés
    return ALL_ACTIONS;
  };

  // Vérifier l'accès
  if (user?.role !== "SUPERADMIN" && user?.role !== "NATIONAL") {
    return (
      <DashboardShell active="/dashboard/journal">
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-900">Accès refusé</p>
            <p className="mt-2 text-slate-600">Vous n'avez pas accès à cette page.</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell active="/dashboard/journal">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Journal d'événements</h1>
        <p className="text-slate-600">Historique complet de toutes les actions du système</p>
      </div>

      {/* Filtres */}
      <div className="mb-6 rounded-3xl border-2 border-slate-300 bg-white shadow-md">
        <button
          type="button"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="flex w-full items-center justify-between rounded-t-3xl px-6 py-4 text-left transition-colors hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <Filter className="h-6 w-6 text-emerald-600" />
            <span className="text-lg font-bold text-slate-900">Filtres</span>
          </div>
          {filtersExpanded ? (
            <ChevronUp className="h-6 w-6 text-slate-600" />
          ) : (
            <ChevronDown className="h-6 w-6 text-slate-600" />
          )}
        </button>

        {filtersExpanded && (
          <div className="border-t border-slate-200 px-6 py-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Type */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setSubtypeFilter("");
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="">Tous les types</option>
                  {EVENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sous-type */}
              {getAvailableSubtypes().length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Sous-type</label>
                  <select
                    value={subtypeFilter}
                    onChange={(e) => {
                      setSubtypeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Tous</option>
                    {getAvailableSubtypes().map((subtype) => (
                      <option key={subtype.value} value={subtype.value}>
                        {subtype.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Action</label>
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="">Toutes les actions</option>
                  {getAvailableActions().map((action) => (
                    <option key={action} value={action}>
                      {ACTION_LABELS[action] || action}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tri */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Ordre</label>
                <select
                  value={sortOrder}
                  onChange={(e) => {
                    setSortOrder(e.target.value as "asc" | "desc");
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="desc">Plus récent au plus ancien</option>
                  <option value="asc">Plus ancien au plus récent</option>
                </select>
              </div>

              {/* Date précise */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Date précise</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setDateFrom("");
                    setDateTo("");
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* Date du */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Du</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setDate("");
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* Date au */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Au</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setDate("");
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            </div>

            {/* Bouton réinitialiser */}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setTypeFilter("");
                  setSubtypeFilter("");
                  setActionFilter("");
                  setDateFrom("");
                  setDateTo("");
                  setDate("");
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions en masse */}
      {selectedEvents.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="text-sm font-medium text-emerald-900">
            {selectedEvents.size} événement(s) sélectionné(s)
          </span>
          <button
            type="button"
            onClick={handleDeleteMultiple}
            disabled={deleting}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Suppression...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Supprimer la sélection
              </>
            )}
          </button>
        </div>
      )}

      {/* Tableau des événements */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center">
            <p className="font-medium text-rose-600">{error}</p>
            <button
              type="button"
              onClick={fetchEvents}
              className="mt-4 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100"
            >
              Réessayer
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-4 font-medium text-slate-900">Aucun événement trouvé</p>
            <p className="mt-2 text-sm text-slate-600">
              {typeFilter || actionFilter || dateFrom || dateTo || date
                ? "Aucun événement ne correspond aux filtres sélectionnés"
                : "Le journal est vide"}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="flex items-center"
                      >
                        {selectedEvents.size === events.length ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Date & Heure
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Utilisateur
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Entité
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Détails
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSelectEvent(event.id)}
                          className="flex items-center"
                        >
                          {selectedEvents.has(event.id) ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatDate(event.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="font-medium text-slate-900">
                            {EVENT_TYPES.find((t) => t.value === event.type)?.label || event.type}
                          </div>
                          {event.subtype && (
                            <div className="text-xs text-slate-500">
                              {EVENT_TYPES.find((t) => t.value === event.type)
                                ?.subtypes?.find((s) => s.value === event.subtype)?.label ||
                                event.subtype}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getActionBadgeColor(event.action)}`}>
                          {ACTION_LABELS[event.action] || event.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div>
                          <div className="font-medium">
                            {event.user.firstName} {event.user.lastName}
                          </div>
                          <div className="text-xs text-slate-500">{event.user.email}</div>
                          <div className="text-xs text-slate-500 capitalize">{event.user.role}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {event.entityName ? (
                          <div>
                            <div className="font-medium">{event.entityName}</div>
                            {event.entityType && (
                              <div className="text-xs text-slate-500">{event.entityType}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {event.details || event.metadata ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEvent(event);
                              setShowDetailsModal(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-emerald-600 transition hover:bg-emerald-50"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="text-sm font-medium">Voir détails</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(event.id)}
                          className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                <div className="text-sm text-slate-600">
                  Page {page} sur {totalPages} ({total} événement(s) au total)
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de détails */}
      {showDetailsModal && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    Détails de l'événement
                  </h3>
                  <p className="text-sm text-slate-500">
                    {EVENT_TYPES.find((t) => t.value === selectedEvent.type)?.label || selectedEvent.type} - {ACTION_LABELS[selectedEvent.action] || selectedEvent.action}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedEvent(null);
                }}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Informations générales */}
                <div>
                  <h4 className="mb-3 font-semibold text-slate-800 border-b border-slate-200 pb-2">
                    Informations générales
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-slate-600">Date:</span>
                      <span className="ml-2 text-slate-700">{formatDate(selectedEvent.createdAt)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-slate-600">Type:</span>
                      <span className="ml-2 text-slate-700">
                        {EVENT_TYPES.find((t) => t.value === selectedEvent.type)?.label || selectedEvent.type}
                      </span>
                    </div>
                    {selectedEvent.subtype && (
                      <div>
                        <span className="font-medium text-slate-600">Sous-type:</span>
                        <span className="ml-2 text-slate-700">{selectedEvent.subtype}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-slate-600">Action:</span>
                      <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getActionBadgeColor(selectedEvent.action)}`}>
                        {ACTION_LABELS[selectedEvent.action] || selectedEvent.action}
                      </span>
                    </div>
                    {selectedEvent.entityName && (
                      <div className="col-span-2">
                        <span className="font-medium text-slate-600">Entité concernée:</span>
                        <span className="ml-2 text-slate-700">{selectedEvent.entityName}</span>
                        {selectedEvent.entityType && (
                          <span className="ml-2 text-xs text-slate-500">({selectedEvent.entityType})</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Utilisateur */}
                <div>
                  <h4 className="mb-3 font-semibold text-slate-800 border-b border-slate-200 pb-2">
                    Utilisateur
                  </h4>
                  <div className="text-sm text-slate-700">
                    <div>
                      <span className="font-medium">{selectedEvent.user.firstName} {selectedEvent.user.lastName}</span>
                    </div>
                    <div className="text-slate-500">{selectedEvent.user.email}</div>
                    <div className="text-slate-500 capitalize">{selectedEvent.user.role}</div>
                  </div>
                </div>

                {/* Détails */}
                {selectedEvent.details && (
                  <div>
                    <h4 className="mb-3 font-semibold text-slate-800 border-b border-slate-200 pb-2">
                      Détails
                    </h4>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                      <div className="space-y-2 text-slate-700">
                        {/* Vérifier si c'est un objet before/after direct */}
                        {selectedEvent.details && typeof selectedEvent.details === "object" && !Array.isArray(selectedEvent.details) && "before" in selectedEvent.details && "after" in selectedEvent.details ? (
                          renderUserFriendlyValue(selectedEvent.details, "")
                        ) : typeof selectedEvent.details === "object" && !Array.isArray(selectedEvent.details) ? (
                          Object.entries(selectedEvent.details).map(([key, value]) => 
                            renderUserFriendlyValue(value, key)
                          ).filter(Boolean)
                        ) : (
                          <div>{String(selectedEvent.details)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Métadonnées */}
                {selectedEvent.metadata && (
                  <div>
                    <h4 className="mb-3 font-semibold text-slate-800 border-b border-slate-200 pb-2">
                      Métadonnées
                    </h4>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                      <div className="space-y-2 text-slate-700">{renderValue(selectedEvent.metadata)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedEvent(null);
                }}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

