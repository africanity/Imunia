"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MapPin,
  Building2,
  Hospital,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Eye,
  X,
  Loader2,
  Filter,
  Save,
  Plus,
} from "lucide-react";
import DashboardShell from "@/app/dashboard/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type Region = {
  id: string;
  name: string;
  _count: {
    communes: number;
    users: number;
    stockREGIONAL: number;
  };
};

type Commune = {
  id: string;
  name: string;
  region: {
    id: string;
    name: string;
  };
  _count: {
    districts: number;
  };
};

type District = {
  id: string;
  name: string;
  commune: {
    id: string;
    name: string;
    region: {
      id: string;
      name: string;
    };
  };
  _count: {
    healthCenters: number;
    users: number;
    stockDISTRICT: number;
  };
};

type HealthCenter = {
  id: string;
  name: string;
  address: string;
  district: {
    id: string;
    name: string;
    commune: {
      id: string;
      name: string;
      region: {
        id: string;
        name: string;
      };
    };
  };
  _count: {
    users: number;
    childrens: number;
    stockHEALTHCENTER: number;
  };
};

type EntityDetails = Region | Commune | District | HealthCenter;

export default function SuperAdminEntitiesPage() {
  const { accessToken } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [healthCenters, setHealthCenters] = useState<HealthCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("");
  const [selectedHealthCenterId, setSelectedHealthCenterId] = useState<string>("");

  // États pour les sections collapsibles
  const [regionsExpanded, setRegionsExpanded] = useState(true);
  const [communesExpanded, setCommunesExpanded] = useState(true);
  const [districtsExpanded, setDistrictsExpanded] = useState(true);
  const [healthCentersExpanded, setHealthCentersExpanded] = useState(true);

  // Modal de détails
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{
    type: "region" | "commune" | "district" | "healthcenter";
    data: EntityDetails | null;
  } | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // États pour modification
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<{
    type: "region" | "commune" | "district" | "healthcenter";
    id: string;
    name: string;
    address?: string;
  } | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [saving, setSaving] = useState(false);

  // États pour suppression
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingEntity, setDeletingEntity] = useState<{
    type: "region" | "commune" | "district" | "healthcenter";
    id: string;
    name: string;
  } | null>(null);
  const [deleteSummary, setDeleteSummary] = useState<any>(null);
  const [deleteSummaryLoading, setDeleteSummaryLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // États pour création
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    entityType: "",
    name: "",
    address: "",
    regionId: "",
    communeId: "",
    districtId: "",
  });
  
  // États pour charger les communes et districts
  const [createCommunes, setCreateCommunes] = useState<{ id: string; name: string }[]>([]);
  const [createDistricts, setCreateDistricts] = useState<{ id: string; name: string }[]>([]);

  const fetchEntities = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedRegionId) params.append("regionId", selectedRegionId);
      if (selectedDistrictId) params.append("districtId", selectedDistrictId);
      if (selectedHealthCenterId) params.append("healthCenterId", selectedHealthCenterId);

      const res = await fetch(`${API_URL}/api/superadmin/entities?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const data = await res.json();
      setRegions(data.regions || []);
      setCommunes(data.communes || []);
      setDistricts(data.districts || []);
      setHealthCenters(data.healthCenters || []);
    } catch (err) {
      console.error("Erreur chargement entités:", err);
      setError("Impossible de charger les entités");
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedRegionId, selectedDistrictId, selectedHealthCenterId]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const handleViewDetails = async (
    type: "region" | "commune" | "district" | "healthcenter",
    id: string,
  ) => {
    try {
      setDetailsLoading(true);
      const res = await fetch(`${API_URL}/api/superadmin/entities/${type}/${id}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const data = await res.json();
      setSelectedEntity({ type, data });
      setShowDetailsModal(true);
    } catch (err) {
      console.error("Erreur chargement détails:", err);
      alert("Impossible de charger les détails");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleEdit = (
    type: "region" | "commune" | "district" | "healthcenter",
    id: string,
    name: string,
    address?: string,
  ) => {
    setEditingEntity({ type, id, name, address });
    setEditName(name);
    setEditAddress(address || "");
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEntity || !editName.trim()) return;

    try {
      setSaving(true);
      const res = await fetch(
        `${API_URL}/api/superadmin/entities/${editingEntity.type}/${editingEntity.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name: editName.trim(),
            ...(editingEntity.type === "healthcenter" && { address: editAddress.trim() }),
          }),
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `status ${res.status}`);
      }

      setShowEditModal(false);
      setEditingEntity(null);
      await fetchEntities();
    } catch (err) {
      console.error("Erreur modification entité:", err);
      alert(err instanceof Error ? err.message : "Impossible de modifier l'entité");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async (
    type: "region" | "commune" | "district" | "healthcenter",
    id: string,
    name: string,
  ) => {
    setDeletingEntity({ type, id, name });
    setShowDeleteModal(true);

    // Charger le résumé de suppression
    try {
      setDeleteSummaryLoading(true);
      const res = await fetch(
        `${API_URL}/api/superadmin/entities/${type}/${id}/delete-summary`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

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
    if (!deletingEntity) return;

    try {
      setDeleting(true);
      const res = await fetch(
        `${API_URL}/api/superadmin/entities/${deletingEntity.type}/${deletingEntity.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `status ${res.status}`);
      }

      setShowDeleteModal(false);
      setDeletingEntity(null);
      setDeleteSummary(null);
      await fetchEntities();
    } catch (err) {
      console.error("Erreur suppression entité:", err);
      alert(err instanceof Error ? err.message : "Impossible de supprimer l'entité");
    } finally {
      setDeleting(false);
    }
  };

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
          setAllRegions(regionsList.map((r: Region) => ({ id: r.id, name: r.name })));
        }
      } catch (err) {
        console.error("Erreur chargement régions:", err);
      }
    };
    fetchAllRegions();
  }, [accessToken]);

  // Charger les communes quand une région est sélectionnée dans le formulaire de création
  useEffect(() => {
    const fetchCommunes = async () => {
      if (!accessToken || !createForm.regionId) {
        setCreateCommunes([]);
        setCreateForm((prev) => ({ ...prev, communeId: "", districtId: "" }));
        return;
      }
      try {
        const params = new URLSearchParams();
        if (createForm.regionId) {
          params.append("regionId", createForm.regionId);
        }
        const res = await fetch(`${API_URL}/api/commune?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const communesList = Array.isArray(data) ? data : data.items || [];
          setCreateCommunes(communesList.map((c: any) => ({ id: c.id, name: c.name })));
        }
      } catch (err) {
        console.error("Erreur chargement communes:", err);
        setCreateCommunes([]);
      }
    };
    fetchCommunes();
  }, [accessToken, createForm.regionId]);

  // Charger les districts pour les centres de santé (pas besoin pour créer un district)

  // Charger les districts pour les centres de santé (filtrés par commune)
  useEffect(() => {
    const fetchDistrictsForHealthCenter = async () => {
      if (!accessToken || !createForm.communeId || createForm.entityType !== "healthcenter") {
        setCreateDistricts([]);
        setCreateForm((prev) => ({ ...prev, districtId: "" }));
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/district?communeId=${createForm.communeId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          const districtsList = Array.isArray(data) ? data : data.items || data.districts || [];
          setCreateDistricts(districtsList.map((d: any) => ({ id: d.id, name: d.name })));
        }
      } catch (err) {
        console.error("Erreur chargement districts:", err);
        setCreateDistricts([]);
      }
    };
    if (createForm.entityType === "healthcenter") {
      fetchDistrictsForHealthCenter();
    }
  }, [accessToken, createForm.communeId, createForm.entityType]);

  const handleCreateEntity = async () => {
    if (!accessToken) return;

    try {
      setCreating(true);
      setError(null);

      let endpoint = "";
      let payload: any = { name: createForm.name.trim() };

      if (createForm.entityType === "region") {
        endpoint = `${API_URL}/api/region`;
      } else if (createForm.entityType === "commune") {
        endpoint = `${API_URL}/api/commune`;
        payload.regionId = createForm.regionId;
      } else if (createForm.entityType === "district") {
        endpoint = `${API_URL}/api/district`;
        payload.communeId = createForm.communeId;
      } else if (createForm.entityType === "healthcenter") {
        endpoint = `${API_URL}/api/healthCenter`;
        payload.address = createForm.address.trim();
        payload.districtId = createForm.districtId;
      }

      const res = await fetch(endpoint, {
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
        entityType: "",
        name: "",
        address: "",
        regionId: "",
        communeId: "",
        districtId: "",
      });
      setCreateCommunes([]);
      setCreateDistricts([]);
      await fetchEntities();
    } catch (err) {
      console.error("Erreur création entité:", err);
      setError(err instanceof Error ? err.message : "Impossible de créer l'entité");
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardShell active="/dashboard/superadmin/entites">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Gestion des entités</h2>
            <p className="text-sm text-slate-500">
              Gérez toutes les régions, districts et centres de santé
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Créer une entité
          </button>
        </div>

        {/* Filtres */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-500" />
            <h3 className="text-lg font-semibold text-slate-900">Filtres</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Région
              </label>
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
            {selectedRegionId && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">
                  District
                </label>
                <select
                  value={selectedDistrictId}
                  onChange={(e) => {
                    setSelectedDistrictId(e.target.value);
                    setSelectedHealthCenterId("");
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="">Tous les districts</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selectedDistrictId && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">
                  Centre de santé
                </label>
                <select
                  value={selectedHealthCenterId}
                  onChange={(e) => setSelectedHealthCenterId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="">Tous les centres</option>
                  {healthCenters.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
          <div className="space-y-6">
            {/* Section Régions */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setRegionsExpanded(!regionsExpanded)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-lg font-semibold text-slate-900">
                    Régions ({regions.length})
                  </h3>
                </div>
                {regionsExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-500" />
                )}
              </button>
              {regionsExpanded && (
                <div className="border-t border-slate-100 px-6 py-4">
                  {regions.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucune région trouvée</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {regions.map((region) => (
                        <div
                          key={region.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="mb-3 flex items-start justify-between">
                            <h4 className="font-semibold text-slate-900">{region.name}</h4>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleViewDetails("region", region.id)}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200"
                                title="Voir les détails"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEdit("region", region.id, region.name)}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200"
                                title="Modifier"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick("region", region.id, region.name)}
                                className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1 text-xs text-slate-600">
                            <p>Communes: {region._count.communes}</p>
                            <p>Utilisateurs: {region._count.users}</p>
                            <p>Stocks: {region._count.stockREGIONAL}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section Communes */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setCommunesExpanded(!communesExpanded)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-orange-600" />
                  <h3 className="text-lg font-semibold text-slate-900">
                    Communes ({communes.length})
                  </h3>
                </div>
                {communesExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-500" />
                )}
              </button>
              {communesExpanded && (
                <div className="border-t border-slate-100 px-6 py-4">
                  {communes.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucune commune trouvée</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {communes.map((commune) => (
                        <div
                          key={commune.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="mb-3 flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-slate-900">{commune.name}</h4>
                              <p className="text-xs text-slate-500">
                                {commune.region.name}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleViewDetails("commune", commune.id)}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200"
                                title="Voir les détails"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEdit("commune", commune.id, commune.name)}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200"
                                title="Modifier"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick("commune", commune.id, commune.name)}
                                className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1 text-xs text-slate-600">
                            <p>Districts: {commune._count.districts}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section Districts */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setDistrictsExpanded(!districtsExpanded)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-slate-900">
                    Districts ({districts.length})
                  </h3>
                </div>
                {districtsExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-500" />
                )}
              </button>
              {districtsExpanded && (
                <div className="border-t border-slate-100 px-6 py-4">
                  {districts.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucun district trouvé</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {districts.map((district) => (
                        <div
                          key={district.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="mb-3 flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-slate-900">{district.name}</h4>
                              <p className="text-xs text-slate-500">
                                {district.commune.region.name} - {district.commune.name}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleViewDetails("district", district.id)}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200"
                                title="Voir les détails"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEdit("district", district.id, district.name)}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200"
                                title="Modifier"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteClick("district", district.id, district.name)
                                }
                                className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1 text-xs text-slate-600">
                            <p>Centres: {district._count.healthCenters}</p>
                            <p>Utilisateurs: {district._count.users}</p>
                            <p>Stocks: {district._count.stockDISTRICT}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section Centres de santé */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setHealthCentersExpanded(!healthCentersExpanded)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <Hospital className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-slate-900">
                    Centres de santé ({healthCenters.length})
                  </h3>
                </div>
                {healthCentersExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-500" />
                )}
              </button>
              {healthCentersExpanded && (
                <div className="border-t border-slate-100 px-6 py-4">
                  {healthCenters.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucun centre de santé trouvé</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {healthCenters.map((center) => (
                        <div
                          key={center.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="mb-3 flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-slate-900">{center.name}</h4>
                              <p className="text-xs text-slate-500">
                                {center.district.commune.region.name} - {center.district.name}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleViewDetails("healthcenter", center.id)}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200"
                                title="Voir les détails"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleEdit("healthcenter", center.id, center.name, center.address)
                                }
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200"
                                title="Modifier"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteClick("healthcenter", center.id, center.name)
                                }
                                className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1 text-xs text-slate-600">
                            <p>Utilisateurs: {center._count.users}</p>
                            <p>Enfants: {center._count.childrens}</p>
                            <p>Stocks: {center._count.stockHEALTHCENTER}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de détails */}
        {showDetailsModal && selectedEntity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-[95vw] md:max-w-2xl rounded-3xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">Détails de l'entité</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedEntity(null);
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
                ) : selectedEntity.data ? (
                  <div className="space-y-6">
                    {/* Nom de l'entité */}
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-slate-600">Nom</h4>
                      <p className="text-lg font-medium text-slate-900">{selectedEntity.data.name}</p>
                    </div>

                    {/* Adresse (si centre de santé) */}
                    {selectedEntity.type === "healthcenter" && "address" in selectedEntity.data && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-slate-600">Adresse</h4>
                        <p className="text-slate-700">{selectedEntity.data.address || "Non renseignée"}</p>
                      </div>
                    )}

                    {/* Hiérarchie */}
                    {selectedEntity.type === "commune" && "region" in selectedEntity.data && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-slate-600">Région</h4>
                        <p className="text-slate-700">{selectedEntity.data.region.name}</p>
                      </div>
                    )}
                    {selectedEntity.type === "district" && "commune" in selectedEntity.data && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-slate-600">Région</h4>
                        <p className="text-slate-700">{selectedEntity.data.commune.region.name}</p>
                      </div>
                    )}
                    {selectedEntity.type === "healthcenter" && "district" in selectedEntity.data && (
                      <>
                        <div>
                          <h4 className="mb-2 text-sm font-semibold text-slate-600">Région</h4>
                          <p className="text-slate-700">{selectedEntity.data.district.commune.region.name}</p>
                        </div>
                        <div>
                          <h4 className="mb-2 text-sm font-semibold text-slate-600">District</h4>
                          <p className="text-slate-700">{selectedEntity.data.district.name}</p>
                        </div>
                      </>
                    )}

                    {/* Statistiques */}
                    {"_count" in selectedEntity.data && (
                      <div>
                        <h4 className="mb-3 text-sm font-semibold text-slate-600">Statistiques</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {selectedEntity.type === "region" && (
                            <>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Communes</p>
                                <p className="text-xl font-semibold text-slate-900">{selectedEntity.data._count.communes || 0}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Utilisateurs</p>
                                <p className="text-xl font-semibold text-slate-900">{selectedEntity.data._count.users || 0}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Stocks</p>
                                <p className="text-xl font-semibold text-slate-900">{selectedEntity.data._count.stockREGIONAL || 0}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Campagnes</p>
                                <p className="text-xl font-semibold text-slate-900">{selectedEntity.data._count.campaigns || 0}</p>
                              </div>
                            </>
                          )}
                          {selectedEntity.type === "commune" && (
                            <>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Districts</p>
                                <p className="text-xl font-semibold text-slate-900">{selectedEntity.data._count.districts || 0}</p>
                              </div>
                            </>
                          )}
                          {selectedEntity.type === "district" && (
                            <>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Centres de santé</p>
                                <p className="text-xl font-semibold text-slate-900">{selectedEntity.data._count.healthCenters || 0}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Utilisateurs</p>
                                <p className="text-xl font-semibold text-slate-900">{selectedEntity.data._count.users || 0}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Stocks</p>
                                <p className="text-xl font-semibold text-slate-900">{selectedEntity.data._count.stockDISTRICT || 0}</p>
                              </div>
                            </>
                          )}
                          {selectedEntity.type === "healthcenter" && (
                            <>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Utilisateurs</p>
                                <p className="text-xl font-semibold text-slate-900">{selectedEntity.data._count.users || 0}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Enfants</p>
                                <p className="text-xl font-semibold text-slate-900">{selectedEntity.data._count.childrens || 0}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Stocks</p>
                                <p className="text-xl font-semibold text-slate-900">{selectedEntity.data._count.stockHEALTHCENTER || 0}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Liste des utilisateurs */}
                    {"users" in selectedEntity.data && selectedEntity.data.users && selectedEntity.data.users.length > 0 && (
                      <div>
                        <h4 className="mb-3 text-sm font-semibold text-slate-600">Utilisateurs ({selectedEntity.data.users.length})</h4>
                        <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Nom</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Email</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Rôle</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Statut</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {selectedEntity.data.users.map((user: any) => (
                                <tr key={user.id}>
                                  <td className="px-4 py-2 text-slate-700">
                                    {user.firstName} {user.lastName}
                                  </td>
                                  <td className="px-4 py-2 text-slate-700">{user.email}</td>
                                  <td className="px-4 py-2 text-slate-700">{user.role}</td>
                                  <td className="px-4 py-2">
                                    <span
                                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                        user.isActive
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-slate-100 text-slate-700"
                                      }`}
                                    >
                                      {user.isActive ? "Actif" : "Inactif"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Aucune donnée disponible</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de modification */}
        {showEditModal && editingEntity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-[95vw] md:max-w-md rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">Modifier l'entité</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingEntity(null);
                  }}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 px-6 py-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Nom</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                {editingEntity.type === "healthcenter" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-600">
                      Adresse
                    </label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingEntity(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving || !editName.trim()}
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

        {/* Modal de suppression */}
        {showDeleteModal && deletingEntity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">Supprimer l'entité</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingEntity(null);
                    setDeleteSummary(null);
                  }}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-6 py-4">
                <p className="mb-4 text-sm text-slate-600">
                  Êtes-vous sûr de vouloir supprimer{" "}
                  <span className="font-semibold text-slate-900">{deletingEntity.name}</span> ?
                  Cette action est irréversible.
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
                          <span className="text-slate-600">{key}</span>
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
                    setDeletingEntity(null);
                    setDeleteSummary(null);
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

        {/* Modal de création */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-[95vw] md:max-w-md rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">Créer une entité</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setError(null);
                    setCreateForm({
                      entityType: "",
                      name: "",
                      address: "",
                      regionId: "",
                      communeId: "",
                      districtId: "",
                    });
                    setCreateCommunes([]);
                    setCreateDistricts([]);
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
                  <label className="mb-2 block text-sm font-medium text-slate-600">
                    Type d'entité *
                  </label>
                  <select
                    value={createForm.entityType}
                    onChange={(e) => {
                      setCreateForm({
                        entityType: e.target.value,
                        name: "",
                        address: "",
                        regionId: "",
                        communeId: "",
                        districtId: "",
                      });
                      setCreateCommunes([]);
                      setCreateDistricts([]);
                    }}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    required
                  >
                    <option value="">— Sélectionner un type —</option>
                    <option value="region">Région</option>
                    <option value="commune">Commune</option>
                    <option value="district">District</option>
                    <option value="healthcenter">Centre de santé</option>
                  </select>
                </div>
                {createForm.entityType && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-600">
                        Nom *
                      </label>
                      <input
                        type="text"
                        value={createForm.name}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, name: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        required
                      />
                    </div>
                    {createForm.entityType === "commune" && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-600">
                          Région *
                        </label>
                        <select
                          value={createForm.regionId}
                          onChange={(e) =>
                            setCreateForm({ ...createForm, regionId: e.target.value })
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
                    {createForm.entityType === "district" && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-600">
                          Région *
                        </label>
                        <select
                          value={createForm.regionId}
                          onChange={(e) => {
                            setCreateForm({
                              ...createForm,
                              regionId: e.target.value,
                              communeId: "",
                              districtId: "",
                            });
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
                        {createForm.regionId && (
                          <div className="mt-4">
                            <label className="mb-2 block text-sm font-medium text-slate-600">
                              Commune *
                            </label>
                            <select
                              value={createForm.communeId}
                              onChange={(e) =>
                                setCreateForm({ ...createForm, communeId: e.target.value, districtId: "" })
                              }
                              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                              required
                            >
                              <option value="">— Sélectionner une commune —</option>
                              {createCommunes.map((commune) => (
                                <option key={commune.id} value={commune.id}>
                                  {commune.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                    {createForm.entityType === "healthcenter" && (
                      <>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-600">
                            Région *
                          </label>
                          <select
                            value={createForm.regionId}
                            onChange={(e) => {
                              setCreateForm({
                                ...createForm,
                                regionId: e.target.value,
                                communeId: "",
                                districtId: "",
                              });
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
                          <div className="mt-4">
                            <label className="mb-2 block text-sm font-medium text-slate-600">
                              Commune *
                            </label>
                            <select
                              value={createForm.communeId}
                              onChange={(e) => {
                                setCreateForm({
                                  ...createForm,
                                  communeId: e.target.value,
                                  districtId: "",
                                });
                              }}
                              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                              required
                            >
                              <option value="">— Sélectionner une commune —</option>
                              {createCommunes.map((commune) => (
                                <option key={commune.id} value={commune.id}>
                                  {commune.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {createForm.communeId && (
                          <div className="mt-4">
                            <label className="mb-2 block text-sm font-medium text-slate-600">
                              District *
                            </label>
                            <select
                              value={createForm.districtId}
                              onChange={(e) =>
                                setCreateForm({ ...createForm, districtId: e.target.value })
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
                        <div className="mt-4">
                          <label className="mb-2 block text-sm font-medium text-slate-600">
                            Adresse *
                          </label>
                          <input
                            type="text"
                            value={createForm.address}
                            onChange={(e) =>
                              setCreateForm({ ...createForm, address: e.target.value })
                            }
                            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            required
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
                {!createForm.entityType && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                    Veuillez sélectionner un type d'entité pour continuer.
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
                      entityType: "",
                      name: "",
                      address: "",
                      regionId: "",
                      communeId: "",
                      districtId: "",
                    });
                    setCreateCommunes([]);
                    setCreateDistricts([]);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleCreateEntity}
                  disabled={
                    creating ||
                    !createForm.entityType ||
                    !createForm.name.trim() ||
                    (createForm.entityType === "commune" && !createForm.regionId) ||
                    (createForm.entityType === "district" && (!createForm.regionId || !createForm.communeId)) ||
                    (createForm.entityType === "healthcenter" && (!createForm.regionId || !createForm.communeId || !createForm.districtId || !createForm.address.trim()))
                  }
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {creating ? "Création..." : "Créer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

