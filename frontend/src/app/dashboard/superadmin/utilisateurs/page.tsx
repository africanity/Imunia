"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Plus,
  Filter,
  Search,
  X,
  Loader2,
  Eye,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
} from "lucide-react";
import DashboardShell from "@/app/dashboard/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  agentLevel?: string | null;
  isActive: boolean;
  region?: { id: string; name: string } | null;
  district?: { id: string; name: string } | null;
  healthCenter?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export default function SuperAdminUsersPage() {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("");
  const [selectedHealthCenterId, setSelectedHealthCenterId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // États pour les sections collapsibles
  const [rolesExpanded, setRolesExpanded] = useState<Record<string, boolean>>({
    SUPERADMIN: true,
    NATIONAL: true,
    REGIONAL: true,
    DISTRICT: true,
    "AGENT_ADMIN": true,
    "AGENT_STAFF": true,
  });

  // Modal de création
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    regionId: "",
    districtId: "",
    healthCenterId: "",
    agentLevel: "",
  });
  
  // États pour charger les districts et centres de santé
  const [createDistricts, setCreateDistricts] = useState<{ id: string; name: string }[]>([]);
  const [createHealthCenters, setCreateHealthCenters] = useState<{ id: string; name: string }[]>([]);

  // Modal de modification
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    isActive: true,
    code: "",
    regionId: "",
    districtId: "",
    healthCenterId: "",
    agentLevel: "",
  });
  const [saving, setSaving] = useState(false);
  
  // États pour charger les districts et centres de santé dans le modal d'édition
  const [editDistricts, setEditDistricts] = useState<{ id: string; name: string; regionId?: string }[]>([]);
  const [editHealthCenters, setEditHealthCenters] = useState<{ id: string; name: string; districtId?: string; regionId?: string }[]>([]);
  const [allDistricts, setAllDistricts] = useState<{ id: string; name: string; regionId?: string; commune?: { regionId?: string } }[]>([]);
  const [allHealthCenters, setAllHealthCenters] = useState<{ id: string; name: string; districtId?: string; district?: { id?: string; commune?: { regionId?: string } } }[]>([]);

  // Modal de détails
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Modal de suppression
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteSummary, setDeleteSummary] = useState<any>(null);
  const [deleteSummaryLoading, setDeleteSummaryLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedRole) params.append("role", selectedRole);
      if (selectedRegionId) params.append("regionId", selectedRegionId);
      if (selectedDistrictId) params.append("districtId", selectedDistrictId);
      if (selectedHealthCenterId) params.append("healthCenterId", selectedHealthCenterId);

      const res = await fetch(`${API_URL}/api/superadmin/users?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Erreur chargement utilisateurs:", err);
      setError("Impossible de charger les utilisateurs");
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedRole, selectedRegionId, selectedDistrictId, selectedHealthCenterId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Récupérer toutes les régions pour les filtres
  const [allRegions, setAllRegions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchAllRegions = async () => {
      if (!accessToken) return;
      try {
        const res = await fetch(`${API_URL}/api/region`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const regionsList = Array.isArray(data) ? data : data.regions || [];
          setAllRegions(regionsList.map((r: any) => ({ id: r.id, name: r.name })));
        }
      } catch (err) {
        console.error("Erreur chargement régions:", err);
      }
    };
    fetchAllRegions();
  }, [accessToken]);

  // Charger tous les districts au démarrage (pour permettre la sélection directe)
  useEffect(() => {
    const fetchAllDistricts = async () => {
      if (!accessToken) return;
      try {
        const res = await fetch(`${API_URL}/api/district`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const districtsList = Array.isArray(data) ? data : data.districts || data.items || [];
          setAllDistricts(districtsList.map((d: any) => ({
            id: d.id,
            name: d.name,
            regionId: d.commune?.regionId || d.regionId,
            commune: d.commune,
          })));
        }
      } catch (err) {
        console.error("Erreur chargement tous les districts:", err);
      }
    };
    fetchAllDistricts();
  }, [accessToken]);

  // Charger tous les centres au démarrage (pour permettre la sélection directe)
  useEffect(() => {
    const fetchAllHealthCenters = async () => {
      if (!accessToken) return;
      try {
        const res = await fetch(`${API_URL}/api/healthCenter`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const centersList = Array.isArray(data) ? data : data.healthCenters || data.items || [];
          setAllHealthCenters(centersList.map((c: any) => ({
            id: c.id,
            name: c.name,
            districtId: c.districtId || c.district?.id,
            district: c.district,
            regionId: c.district?.commune?.regionId || c.district?.commune?.region?.id,
          })));
        }
      } catch (err) {
        console.error("Erreur chargement tous les centres:", err);
      }
    };
    fetchAllHealthCenters();
  }, [accessToken]);

  // Charger les districts quand une région est sélectionnée dans le formulaire de création
  useEffect(() => {
    const fetchDistricts = async () => {
      if (!accessToken || !createForm.regionId) {
        setCreateDistricts([]);
        setCreateForm((prev) => ({ ...prev, districtId: "", healthCenterId: "" }));
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/district?regionId=${createForm.regionId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const districtsList = Array.isArray(data) ? data : data.districts || data.items || [];
          setCreateDistricts(districtsList.map((d: any) => ({ id: d.id, name: d.name })));
        }
      } catch (err) {
        console.error("Erreur chargement districts:", err);
        setCreateDistricts([]);
      }
    };
    fetchDistricts();
  }, [accessToken, createForm.regionId]);

  // Charger les centres de santé quand un district est sélectionné dans le formulaire de création
  useEffect(() => {
    const fetchHealthCenters = async () => {
      if (!accessToken || !createForm.districtId) {
        setCreateHealthCenters([]);
        setCreateForm((prev) => ({ ...prev, healthCenterId: "" }));
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/healthCenter?districtId=${createForm.districtId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const centersList = Array.isArray(data) ? data : data.healthCenters || data.items || [];
          setCreateHealthCenters(centersList.map((c: any) => ({ id: c.id, name: c.name })));
        }
      } catch (err) {
        console.error("Erreur chargement centres:", err);
        setCreateHealthCenters([]);
      }
    };
    fetchHealthCenters();
  }, [accessToken, createForm.districtId]);

  // Charger les districts quand une région est sélectionnée dans le formulaire d'édition
  useEffect(() => {
    const fetchEditDistricts = async () => {
      if (!accessToken || !editForm.regionId) {
        // Si on supprime la région, on vide aussi district et centre
        if (!editForm.regionId) {
          setEditDistricts([]);
          setEditForm((prev) => ({ ...prev, districtId: "", healthCenterId: "" }));
        }
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/district?regionId=${editForm.regionId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const districtsList = Array.isArray(data) ? data : data.districts || data.items || [];
          setEditDistricts(districtsList.map((d: any) => ({ id: d.id, name: d.name })));
          
          // Si on avait un district qui n'est plus dans la liste, le vider
          if (editForm.districtId && !districtsList.find((d: any) => d.id === editForm.districtId)) {
            setEditForm((prev) => ({ ...prev, districtId: "", healthCenterId: "" }));
          }
        }
      } catch (err) {
        console.error("Erreur chargement districts:", err);
        setEditDistricts([]);
      }
    };
    fetchEditDistricts();
  }, [accessToken, editForm.regionId]);

  // Charger les centres de santé quand un district est sélectionné dans le formulaire d'édition
  useEffect(() => {
    const fetchEditHealthCenters = async () => {
      if (!accessToken || !editForm.districtId) {
        if (!editForm.districtId) {
          setEditHealthCenters([]);
          setEditForm((prev) => ({ ...prev, healthCenterId: "" }));
        }
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/healthCenter?districtId=${editForm.districtId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const centersList = Array.isArray(data) ? data : data.healthCenters || data.items || [];
          setEditHealthCenters(centersList.map((c: any) => ({ id: c.id, name: c.name })));
          
          // Si on avait un centre qui n'est plus dans la liste, le vider
          if (editForm.healthCenterId && !centersList.find((c: any) => c.id === editForm.healthCenterId)) {
            setEditForm((prev) => ({ ...prev, healthCenterId: "" }));
          }
        }
      } catch (err) {
        console.error("Erreur chargement centres:", err);
        setEditHealthCenters([]);
      }
    };
    fetchEditHealthCenters();
  }, [accessToken, editForm.districtId]);

  // Filtrer les utilisateurs par recherche
  const filteredUsers = users.filter((user) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.firstName.toLowerCase().includes(query) ||
      user.lastName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  // Grouper les utilisateurs par rôle (séparer les agents ADMIN et STAFF)
  const usersByRole = filteredUsers.reduce((acc, user) => {
    if (user.role === "AGENT") {
      // Séparer les agents par niveau
      const agentKey = user.agentLevel === "ADMIN" ? "AGENT_ADMIN" : user.agentLevel === "STAFF" ? "AGENT_STAFF" : "AGENT";
      if (!acc[agentKey]) {
        acc[agentKey] = [];
      }
      acc[agentKey].push(user);
    } else {
      const role = user.role;
      if (!acc[role]) {
        acc[role] = [];
      }
      acc[role].push(user);
    }
    return acc;
  }, {} as Record<string, User[]>);

  const handleCreateUser = async () => {
    if (!accessToken) return;

    try {
      setCreating(true);
      setError(null);

      // Préparer le payload selon le rôle (tous les utilisateurs sont créés avec token d'activation)
      const payload: any = {
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        email: createForm.email,
        role: createForm.role,
      };

      // Ajouter les champs spécifiques selon le rôle
      if (createForm.role === "REGIONAL") {
        payload.regionId = createForm.regionId;
      } else if (createForm.role === "DISTRICT") {
        payload.districtId = createForm.districtId;
      } else if (createForm.role === "AGENT") {
        payload.healthCenterId = createForm.healthCenterId;
        payload.agentLevel = createForm.agentLevel;
      }

      const res = await fetch(`${API_URL}/api/superadmin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `status ${res.status}`);
      }

      setShowCreateModal(false);
      setCreateForm({
        firstName: "",
        lastName: "",
        email: "",
        role: "",
        regionId: "",
        districtId: "",
        healthCenterId: "",
        agentLevel: "",
      });
      setCreateDistricts([]);
      setCreateHealthCenters([]);
      await fetchUsers();
    } catch (err) {
      console.error("Erreur création utilisateur:", err);
      setError(err instanceof Error ? err.message : "Impossible de créer l'utilisateur");
    } finally {
      setCreating(false);
    }
  };

  const handleViewDetails = async (userId: string) => {
    try {
      setDetailsLoading(true);
      const res = await fetch(`${API_URL}/api/superadmin/users/${userId}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const data = await res.json();
      setSelectedUser(data);
      setShowDetailsModal(true);
    } catch (err) {
      console.error("Erreur chargement détails:", err);
      alert("Impossible de charger les détails");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleEdit = async (user: User) => {
    setEditingUser(user);
    const regionId = user.region?.id || "";
    const districtId = user.district?.id || "";
    const healthCenterId = user.healthCenter?.id || "";
    
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      code: "",
      regionId,
      districtId,
      healthCenterId,
      agentLevel: user.agentLevel || "",
    });
    
    // Charger les districts si une région existe
    if (regionId && accessToken) {
      try {
        const res = await fetch(`${API_URL}/api/district?regionId=${regionId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const districtsList = Array.isArray(data) ? data : data.districts || data.items || [];
          setEditDistricts(districtsList.map((d: any) => ({
            id: d.id,
            name: d.name,
            regionId: d.commune?.regionId || d.regionId,
          })));
        }
      } catch (err) {
        console.error("Erreur chargement districts:", err);
      }
    } else {
      setEditDistricts([]);
    }
    
    // Charger les centres si un district existe
    if (districtId && accessToken) {
      try {
        const res = await fetch(`${API_URL}/api/healthCenter?districtId=${districtId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const centersList = Array.isArray(data) ? data : data.healthCenters || data.items || [];
          setEditHealthCenters(centersList.map((c: any) => ({
            id: c.id,
            name: c.name,
            districtId: c.districtId || c.district?.id,
            regionId: c.district?.commune?.regionId || c.district?.commune?.region?.id,
          })));
        }
      } catch (err) {
        console.error("Erreur chargement centres:", err);
      }
    } else {
      setEditHealthCenters([]);
    }
    
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser || !accessToken) return;

    try {
      setSaving(true);
      setError(null);

      // Validation : tous les champs requis doivent être remplis
      if (editForm.role === "REGIONAL" && !editForm.regionId) {
        setError("Veuillez sélectionner une région");
        setSaving(false);
        return;
      }

      if (editForm.role === "DISTRICT") {
        if (!editForm.regionId) {
          setError("Veuillez sélectionner une région");
          setSaving(false);
          return;
        }
        if (!editForm.districtId) {
          setError("Veuillez sélectionner un district");
          setSaving(false);
          return;
        }
      }

      if (editForm.role === "AGENT") {
        if (!editForm.regionId) {
          setError("Veuillez sélectionner une région");
          setSaving(false);
          return;
        }
        if (!editForm.districtId) {
          setError("Veuillez sélectionner un district");
          setSaving(false);
          return;
        }
        if (!editForm.healthCenterId) {
          setError("Veuillez sélectionner un centre de santé");
          setSaving(false);
          return;
        }
      }

      // Seuls les champs d'entité peuvent être modifiés (pas les informations personnelles)
      const payload: any = {};

      // Ajouter les champs d'entité selon le rôle
      if (editForm.role === "REGIONAL") {
        payload.regionId = editForm.regionId;
      } else if (editForm.role === "DISTRICT") {
        payload.regionId = editForm.regionId;
        payload.districtId = editForm.districtId;
      } else if (editForm.role === "AGENT") {
        payload.regionId = editForm.regionId;
        payload.districtId = editForm.districtId;
        payload.healthCenterId = editForm.healthCenterId;
      }

      const res = await fetch(`${API_URL}/api/superadmin/users/${editingUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `status ${res.status}`);
      }

      setShowEditModal(false);
      setEditingUser(null);
      await fetchUsers();
    } catch (err) {
      console.error("Erreur modification utilisateur:", err);
      setError(err instanceof Error ? err.message : "Impossible de modifier l'utilisateur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: User) => {
    setDeletingUser(user);
    setShowDeleteModal(true);

    // Charger le résumé de suppression
    try {
      setDeleteSummaryLoading(true);
      const res = await fetch(`${API_URL}/api/superadmin/users/${user.id}/delete-summary`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setDeleteSummary(data);
      }
    } catch (err) {
      console.error("Erreur chargement résumé:", err);
    } finally {
      setDeleteSummaryLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser || !accessToken) return;

    try {
      setDeleting(true);
      setError(null);

      const res = await fetch(`${API_URL}/api/superadmin/users/${deletingUser.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `status ${res.status}`);
      }

      setShowDeleteModal(false);
      setDeletingUser(null);
      setDeleteSummary(null);
      await fetchUsers();
    } catch (err) {
      console.error("Erreur suppression utilisateur:", err);
      setError(err instanceof Error ? err.message : "Impossible de supprimer l'utilisateur");
    } finally {
      setDeleting(false);
    }
  };

  const roleLabels: Record<string, string> = {
    SUPERADMIN: "Super Administrateurs",
    NATIONAL: "Nationaux",
    REGIONAL: "Régionaux",
    DISTRICT: "Districts",
    AGENT_ADMIN: "Agents Admin",
    AGENT_STAFF: "Agents Staff",
    AGENT: "Agents",
  };

  return (
    <DashboardShell active="/dashboard/superadmin/utilisateurs">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Gestion des utilisateurs</h2>
            <p className="text-sm text-slate-500">
              Gérez tous les utilisateurs de l'application
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Créer un utilisateur
          </button>
        </div>

        {/* Filtres */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-500" />
            <h3 className="text-lg font-semibold text-slate-900">Filtres</h3>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Recherche
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nom, email..."
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">Rôle</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="">Tous les rôles</option>
                <option value="SUPERADMIN">Super Admin</option>
                <option value="NATIONAL">National</option>
                <option value="REGIONAL">Régional</option>
                <option value="DISTRICT">District</option>
                <option value="AGENT">Agent</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">Région</label>
              <select
                value={selectedRegionId}
                onChange={(e) => {
                  setSelectedRegionId(e.target.value);
                  setSelectedDistrictId("");
                  setSelectedHealthCenterId("");
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="">Toutes les régions</option>
                {allRegions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(usersByRole).map(([role, roleUsers]) => (
              <div
                key={role}
                className="rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    setRolesExpanded((prev) => ({
                      ...prev,
                      [role]: !prev[role],
                    }))
                  }
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-lg font-semibold text-slate-900">
                      {roleLabels[role] || role} ({roleUsers.length})
                    </h3>
                  </div>
                  {rolesExpanded[role] ? (
                    <ChevronUp className="h-5 w-5 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-500" />
                  )}
                </button>
                {rolesExpanded[role] && (
                  <div className="border-t border-slate-100 px-6 py-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Nom
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Email
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Entité
                            </th>
                            {(role === "AGENT_ADMIN" || role === "AGENT_STAFF") && (
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Niveau
                              </th>
                            )}
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Statut
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {roleUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50">
                              <td className="px-2 md:px-4 py-4 text-sm font-medium text-slate-900">
                                {user.firstName} {user.lastName}
                              </td>
                              <td className="px-2 md:px-4 py-4 text-sm text-slate-600">{user.email}</td>
                              <td className="px-2 md:px-4 py-4 text-sm text-slate-600">
                                {user.region?.name ||
                                  user.district?.name ||
                                  user.healthCenter?.name ||
                                  "-"}
                              </td>
                              {(role === "AGENT_ADMIN" || role === "AGENT_STAFF") && (
                                <td className="px-2 md:px-4 py-4 text-sm text-slate-600">
                                  <span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 capitalize">
                                    {user.agentLevel || "-"}
                                  </span>
                                </td>
                              )}
                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                    user.isActive
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {user.isActive ? "Actif" : "Inactif"}
                                </span>
                              </td>
                              <td className="px-2 md:px-4 py-4 text-right text-sm">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleViewDetails(user.id)}
                                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200"
                                    title="Voir les détails"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(user)}
                                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200"
                                    title="Modifier"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(user)}
                                    className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                <Users className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-sm font-medium text-slate-900">
                  Aucun utilisateur trouvé
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Aucun utilisateur ne correspond aux filtres sélectionnés.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Modal de création */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-[95vw] md:max-w-md rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">Créer un utilisateur</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setError(null);
                    setCreateForm({
                      firstName: "",
                      lastName: "",
                      email: "",
                      role: "",
                      regionId: "",
                      districtId: "",
                      healthCenterId: "",
                      agentLevel: "",
                    });
                    setCreateDistricts([]);
                    setCreateHealthCenters([]);
                  }}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-6 py-4">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Rôle *</label>
                  <select
                    value={createForm.role === "AGENT" && createForm.agentLevel ? `AGENT_${createForm.agentLevel}` : createForm.role}
                    onChange={(e) => {
                      const selectedValue = e.target.value;
                      let role = selectedValue;
                      let agentLevel = "";
                      
                      // Si c'est un agent, parser la valeur pour extraire le niveau
                      if (selectedValue === "AGENT_ADMIN") {
                        role = "AGENT";
                        agentLevel = "ADMIN";
                      } else if (selectedValue === "AGENT_STAFF") {
                        role = "AGENT";
                        agentLevel = "STAFF";
                      }
                      
                      setCreateForm({
                        firstName: "",
                        lastName: "",
                        email: "",
                        role: role,
                        regionId: "",
                        districtId: "",
                        healthCenterId: "",
                        agentLevel: agentLevel,
                      });
                      setCreateDistricts([]);
                      setCreateHealthCenters([]);
                    }}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    required
                  >
                    <option value="">— Sélectionner un rôle —</option>
                    <option value="SUPERADMIN">Super Admin</option>
                    <option value="NATIONAL">National</option>
                    <option value="REGIONAL">Régional</option>
                    <option value="DISTRICT">District</option>
                    <option value="AGENT_ADMIN">Agent Admin</option>
                    <option value="AGENT_STAFF">Agent Staff</option>
                  </select>
                </div>
                {createForm.role && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-600">
                          Prénom *
                        </label>
                        <input
                          type="text"
                          value={createForm.firstName}
                          onChange={(e) =>
                            setCreateForm({ ...createForm, firstName: e.target.value })
                          }
                          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-600">Nom *</label>
                        <input
                          type="text"
                          value={createForm.lastName}
                          onChange={(e) =>
                            setCreateForm({ ...createForm, lastName: e.target.value })
                          }
                          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">Email *</label>
                      <input
                        type="email"
                        value={createForm.email}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, email: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        required
                      />
                    </div>
                    <div>
                    </div>
                  </>
                )}
                {createForm.role === "REGIONAL" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">
                      Région *
                    </label>
                    <select
                      value={createForm.regionId}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, regionId: e.target.value, districtId: "", healthCenterId: "" })
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      required
                    >
                      <option value="">— Sélectionner une région —</option>
                      {allRegions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {createForm.role === "DISTRICT" && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">
                        Région *
                      </label>
                      <select
                        value={createForm.regionId}
                        onChange={(e) => {
                          setCreateForm({ ...createForm, regionId: e.target.value, districtId: "", healthCenterId: "" });
                        }}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        required
                      >
                        <option value="">— Sélectionner une région —</option>
                        {allRegions.map((region) => (
                          <option key={region.id} value={region.id}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {createForm.regionId && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-600">
                          District *
                        </label>
                        <select
                          value={createForm.districtId}
                          onChange={(e) =>
                            setCreateForm({ ...createForm, districtId: e.target.value, healthCenterId: "" })
                          }
                          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          required
                        >
                          <option value="">— Sélectionner un district —</option>
                          {createDistricts.map((district) => (
                            <option key={district.id} value={district.id}>
                              {district.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
                {createForm.role === "AGENT" && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">
                        Région *
                      </label>
                      <select
                        value={createForm.regionId}
                        onChange={(e) => {
                          setCreateForm({ ...createForm, regionId: e.target.value, districtId: "", healthCenterId: "" });
                        }}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        required
                      >
                        <option value="">— Sélectionner une région —</option>
                        {allRegions.map((region) => (
                          <option key={region.id} value={region.id}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {createForm.regionId && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-600">
                          District *
                        </label>
                        <select
                          value={createForm.districtId}
                          onChange={(e) => {
                            setCreateForm({ ...createForm, districtId: e.target.value, healthCenterId: "" });
                          }}
                          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          required
                        >
                          <option value="">— Sélectionner un district —</option>
                          {createDistricts.map((district) => (
                            <option key={district.id} value={district.id}>
                              {district.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {createForm.districtId && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-600">
                          Centre de santé *
                        </label>
                        <select
                          value={createForm.healthCenterId}
                          onChange={(e) =>
                            setCreateForm({ ...createForm, healthCenterId: e.target.value })
                          }
                          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          required
                        >
                          <option value="">— Sélectionner un centre de santé —</option>
                          {createHealthCenters.map((center) => (
                            <option key={center.id} value={center.id}>
                              {center.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
                {!createForm.role && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                    Veuillez sélectionner un rôle pour continuer.
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setError(null);
                    setCreateForm({
                      firstName: "",
                      lastName: "",
                      email: "",
                      role: "",
                      regionId: "",
                      districtId: "",
                      healthCenterId: "",
                      agentLevel: "",
                    });
                    setCreateDistricts([]);
                    setCreateHealthCenters([]);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleCreateUser}
                  disabled={
                    creating ||
                    !createForm.role ||
                    !createForm.firstName ||
                    !createForm.lastName ||
                    !createForm.email ||
                    (createForm.role === "REGIONAL" && !createForm.regionId) ||
                    (createForm.role === "DISTRICT" && !createForm.districtId) ||
                    (createForm.role === "AGENT" && (!createForm.healthCenterId || !createForm.agentLevel))
                  }
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {creating ? "Création..." : "Créer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de modification */}
        {showEditModal && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-[95vw] md:max-w-md rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">Modifier l'utilisateur</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-6 py-4">
                {/* Informations personnelles - grisées et non modifiables */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">
                      Prénom
                    </label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      disabled
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">Nom</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      disabled
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500"
                  />
                </div>
                <div>
                </div>

                {/* Champs d'entité selon le rôle - toujours affichés et obligatoires */}
                {editForm.role === "REGIONAL" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">
                      Région *
                    </label>
                    <select
                      value={editForm.regionId}
                      onChange={(e) =>
                        setEditForm({ ...editForm, regionId: e.target.value, districtId: "", healthCenterId: "" })
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      required
                    >
                      <option value="">— Sélectionner une région —</option>
                      {allRegions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editForm.role === "DISTRICT" && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">
                        Région *
                      </label>
                      <select
                        value={editForm.regionId}
                        onChange={(e) =>
                          setEditForm({ ...editForm, regionId: e.target.value, districtId: "", healthCenterId: "" })
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        required
                      >
                        <option value="">— Sélectionner une région —</option>
                        {allRegions.map((region) => (
                          <option key={region.id} value={region.id}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">
                        District *
                      </label>
                      <select
                        value={editForm.districtId}
                        onChange={async (e) => {
                          const selectedDistrictId = e.target.value;
                          if (!selectedDistrictId) {
                            setEditForm({ ...editForm, districtId: "", healthCenterId: "" });
                            return;
                          }
                          
                          // Si on sélectionne un district sans avoir de région, auto-remplir la région
                          if (!editForm.regionId) {
                            const selectedDistrict = allDistricts.find((d) => d.id === selectedDistrictId);
                            if (selectedDistrict?.regionId) {
                              setEditForm({ ...editForm, regionId: selectedDistrict.regionId, districtId: selectedDistrictId, healthCenterId: "" });
                              return;
                            }
                          }
                          
                          setEditForm({ ...editForm, districtId: selectedDistrictId, healthCenterId: "" });
                        }}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        required
                      >
                        <option value="">— Sélectionner un district —</option>
                        {editForm.regionId
                          ? editDistricts.map((district) => (
                              <option key={district.id} value={district.id}>
                                {district.name}
                              </option>
                            ))
                          : allDistricts.map((district) => (
                              <option key={district.id} value={district.id}>
                                {district.name}
                              </option>
                            ))}
                      </select>
                    </div>
                  </>
                )}

                {editForm.role === "AGENT" && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">
                        Région *
                      </label>
                      <select
                        value={editForm.regionId}
                        onChange={(e) =>
                          setEditForm({ ...editForm, regionId: e.target.value, districtId: "", healthCenterId: "" })
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        required
                      >
                        <option value="">— Sélectionner une région —</option>
                        {allRegions.map((region) => (
                          <option key={region.id} value={region.id}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">
                        District *
                      </label>
                      <select
                        value={editForm.districtId}
                        onChange={async (e) => {
                          const selectedDistrictId = e.target.value;
                          if (!selectedDistrictId) {
                            setEditForm({ ...editForm, districtId: "", healthCenterId: "" });
                            return;
                          }
                          
                          // Si on sélectionne un district sans avoir de région, auto-remplir la région
                          if (!editForm.regionId) {
                            const selectedDistrict = allDistricts.find((d) => d.id === selectedDistrictId);
                            if (selectedDistrict?.regionId) {
                              setEditForm({ ...editForm, regionId: selectedDistrict.regionId, districtId: selectedDistrictId, healthCenterId: "" });
                              return;
                            }
                          }
                          
                          setEditForm({ ...editForm, districtId: selectedDistrictId, healthCenterId: "" });
                        }}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        required
                      >
                        <option value="">— Sélectionner un district —</option>
                        {editForm.regionId
                          ? editDistricts.map((district) => (
                              <option key={district.id} value={district.id}>
                                {district.name}
                              </option>
                            ))
                          : allDistricts.map((district) => (
                              <option key={district.id} value={district.id}>
                                {district.name}
                              </option>
                            ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">
                        Centre de santé *
                      </label>
                      <select
                        value={editForm.healthCenterId}
                        onChange={async (e) => {
                          const selectedCenterId = e.target.value;
                          if (!selectedCenterId) {
                            setEditForm({ ...editForm, healthCenterId: "" });
                            return;
                          }
                          
                          // Si on sélectionne un centre sans avoir de région/district, auto-remplir
                          if (!editForm.regionId || !editForm.districtId) {
                            const selectedCenter = allHealthCenters.find((c) => c.id === selectedCenterId);
                            if (selectedCenter) {
                              const centerDistrictId = selectedCenter.districtId || selectedCenter.district?.id;
                              const centerRegionId = selectedCenter.district?.commune?.regionId;
                              
                              if (centerDistrictId && centerRegionId) {
                                setEditForm({
                                  ...editForm,
                                  regionId: centerRegionId,
                                  districtId: centerDistrictId,
                                  healthCenterId: selectedCenterId,
                                });
                                return;
                              }
                            }
                          }
                          
                          setEditForm({ ...editForm, healthCenterId: selectedCenterId });
                        }}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        required
                      >
                        <option value="">— Sélectionner un centre —</option>
                        {editForm.districtId
                          ? editHealthCenters.map((center) => (
                              <option key={center.id} value={center.id}>
                                {center.name}
                              </option>
                            ))
                          : allHealthCenters.map((center) => (
                              <option key={center.id} value={center.id}>
                                {center.name}
                              </option>
                            ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Enregistrer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de détails */}
        {showDetailsModal && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-[95vw] md:max-w-2xl rounded-3xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">Détails de l'utilisateur</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedUser(null);
                  }}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-6 py-4">
                {detailsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  </div>
                ) : selectedUser ? (
                  <div className="space-y-6">
                    {/* Informations personnelles */}
                    <div>
                      <h4 className="mb-3 text-sm font-semibold text-slate-600">Informations personnelles</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                          <span className="text-sm text-slate-600">Nom complet</span>
                          <span className="font-semibold text-slate-900">
                            {selectedUser.firstName} {selectedUser.lastName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                          <span className="text-sm text-slate-600">Email</span>
                          <span className="font-semibold text-slate-900">{selectedUser.email}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                          <span className="text-sm text-slate-600">Rôle</span>
                          <span className="font-semibold text-slate-900 capitalize">{selectedUser.role}</span>
                        </div>
                        {selectedUser.agentLevel && (
                          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                            <span className="text-sm text-slate-600">Niveau agent</span>
                            <span className="font-semibold text-slate-900 capitalize">{selectedUser.agentLevel}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                          <span className="text-sm text-slate-600">Statut</span>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              selectedUser.isActive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {selectedUser.isActive ? "Actif" : "Inactif"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Entité associée */}
                    {(selectedUser.region || selectedUser.district || selectedUser.healthCenter) && (
                      <div>
                        <h4 className="mb-3 text-sm font-semibold text-slate-600">Entité associée</h4>
                        <div className="space-y-3">
                          {selectedUser.region && (
                            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                              <span className="text-sm text-slate-600">Région</span>
                              <span className="font-semibold text-slate-900">{selectedUser.region.name}</span>
                            </div>
                          )}
                          {selectedUser.district && (
                            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                              <span className="text-sm text-slate-600">District</span>
                              <span className="font-semibold text-slate-900">{selectedUser.district.name}</span>
                            </div>
                          )}
                          {selectedUser.healthCenter && (
                            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                              <span className="text-sm text-slate-600">Centre de santé</span>
                              <span className="font-semibold text-slate-900">{selectedUser.healthCenter.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Statistiques (si disponibles) */}
                    {selectedUser._count && (
                      <div>
                        <h4 className="mb-3 text-sm font-semibold text-slate-600">Statistiques</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {selectedUser._count.childrens !== undefined && (
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs text-slate-500">Enfants assignés</p>
                              <p className="text-xl font-semibold text-slate-900">{selectedUser._count.childrens || 0}</p>
                            </div>
                          )}
                          {selectedUser._count.records !== undefined && (
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs text-slate-500">Dossiers créés</p>
                              <p className="text-xl font-semibold text-slate-900">{selectedUser._count.records || 0}</p>
                            </div>
                          )}
                          {selectedUser._count.vaccinesCompleted !== undefined && (
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs text-slate-500">Vaccinations administrées</p>
                              <p className="text-xl font-semibold text-slate-900">{selectedUser._count.vaccinesCompleted || 0}</p>
                            </div>
                          )}
                          {selectedUser._count.vaccinesScheduled !== undefined && (
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs text-slate-500">Rendez-vous planifiés</p>
                              <p className="text-xl font-semibold text-slate-900">{selectedUser._count.vaccinesScheduled || 0}</p>
                            </div>
                          )}
                          {selectedUser._count.vaccinesEscalated !== undefined && (
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs text-slate-500">Retards gérés</p>
                              <p className="text-xl font-semibold text-slate-900">{selectedUser._count.vaccinesEscalated || 0}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Dates */}
                    <div>
                      <h4 className="mb-3 text-sm font-semibold text-slate-600">Dates</h4>
                      <div className="space-y-3">
                        {selectedUser.createdAt && (
                          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                            <span className="text-sm text-slate-600">Date de création</span>
                            <span className="font-semibold text-slate-900">
                              {new Date(selectedUser.createdAt).toLocaleDateString("fr-FR", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        )}
                        {selectedUser.updatedAt && (
                          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                            <span className="text-sm text-slate-600">Dernière modification</span>
                            <span className="font-semibold text-slate-900">
                              {new Date(selectedUser.updatedAt).toLocaleDateString("fr-FR", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Aucune donnée disponible</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de suppression */}
        {showDeleteModal && deletingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-[95vw] md:max-w-md rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">Supprimer l'utilisateur</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingUser(null);
                    setDeleteSummary(null);
                    setError(null);
                  }}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-6 py-4">
                {error && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <p className="mb-4 text-sm text-slate-600">
                  Êtes-vous sûr de vouloir supprimer l'utilisateur{" "}
                  <span className="font-semibold text-slate-900">
                    {deletingUser.firstName} {deletingUser.lastName}
                  </span>{" "}
                  ({deletingUser.email}) ? Cette action est irréversible.
                </p>
                {deleteSummaryLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  </div>
                ) : deleteSummary ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-700">
                      Éléments qui seront affectés :
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(deleteSummary.totals || {}).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                        >
                          <span className="text-slate-600 capitalize">
                            {key
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (str) => str.toUpperCase())
                              .trim()}
                          </span>
                          <span className="font-semibold text-slate-900">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingUser(null);
                    setDeleteSummary(null);
                    setError(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
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
                      Supprimer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

