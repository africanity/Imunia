"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  Eye,
  FileText,
  Filter,
  MapPin,
  Megaphone,
  Pencil,
  Plus,
  Search,
  TrendingUp,
  Trash2,
  Video,
  X,
} from "lucide-react";
import DashboardShell from "@/app/dashboard/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";

interface Media {
  url: string;
  type: "video" | "pdf";
  title: string;
}

// Fonction pour convertir une URL YouTube en URL d'embed
const convertYouTubeUrlToEmbed = (url: string): string => {
  if (!url) return url;

  // Si c'est déjà une URL d'embed, la retourner telle quelle
  if (url.includes("youtube.com/embed/")) {
    return url;
  }

  // Extraire l'ID de la vidéo depuis différents formats d'URL YouTube
  let videoId = "";

  // Format: https://www.youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) {
    videoId = watchMatch[1];
  }
  // Format: https://youtu.be/VIDEO_ID
  else if (url.includes("youtu.be/")) {
    const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch) {
      videoId = shortMatch[1];
    }
  }
  // Format: https://www.youtube.com/v/VIDEO_ID
  else if (url.includes("youtube.com/v/")) {
    const vMatch = url.match(/youtube\.com\/v\/([^?&]+)/);
    if (vMatch) {
      videoId = vMatch[1];
    }
  }

  // Si on a trouvé un ID, construire l'URL d'embed
  if (videoId) {
    // Nettoyer l'ID (enlever les paramètres supplémentaires)
    videoId = videoId.split("&")[0].split("?")[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }

  // Si on n'a pas pu extraire l'ID, retourner l'URL originale
  return url;
};

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  regionId: string;
  region: {
    id: string;
    name: string;
  };
  medias: Media[];
  createdAt: string;
  updatedAt: string;
}

export default function CampagnesPage() {
  const { accessToken, user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [previewMedia, setPreviewMedia] = useState<Media | null>(null);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>(
    [],
  );

  const [form, setForm] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    regionId: "",
  });

  const [mediaForm, setMediaForm] = useState({
    url: "",
    type: "video" as "video" | "pdf",
    title: "",
  });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaInputType, setMediaInputType] = useState<"url" | "file">("url");

  const fetchRegions = useCallback(async () => {
    if (!accessToken || user?.role !== "NATIONAL") return;

    try {
      const response = await fetch(`${API_URL}/api/region`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRegions(Array.isArray(data.regions) ? data.regions : []);
      }
    } catch (err) {
      console.error("Erreur chargement régions:", err);
    }
  }, [accessToken, user]);

  const fetchCampaigns = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/campaigns`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const errorMessage =
          payload?.message || payload?.error || `Erreur ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : []);
    } catch (err) {
      console.error("Erreur chargement campagnes:", err);
      setError(
        err instanceof Error ? err.message : "Erreur de chargement",
      );
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchCampaigns();
    void fetchRegions();
  }, [fetchCampaigns, fetchRegions]);

  const saveCampaign = async () => {
    if (!accessToken) {
      setError("Non authentifié");
      return;
    }

    if (!form.title || !form.startDate || !form.endDate) {
      setError("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (user?.role === "NATIONAL" && !form.regionId) {
      setError("Veuillez sélectionner une région");
      return;
    }

    const method = editCampaign ? "PUT" : "POST";
    const url = editCampaign
      ? `${API_URL}/api/campaigns/${editCampaign.id}`
      : `${API_URL}/api/campaigns`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? `Erreur ${response.status}`);
      }

      await fetchCampaigns();
      setShowModal(false);
      setEditCampaign(null);
      setForm({
        title: "",
        description: "",
        startDate: "",
        endDate: "",
        regionId: "",
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    }
  };

  const deleteCampaign = async () => {
    if (!accessToken || !deleteId) return;

    try {
      const response = await fetch(`${API_URL}/api/campaigns/${deleteId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? `Erreur ${response.status}`);
      }

      await fetchCampaigns();
      setDeleteId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la suppression");
    }
  };

  const addMedia = async (campaignId: string) => {
    if (!accessToken) {
      setError("Non authentifié");
      return;
    }

    // Vérifier qu'on a un titre
    if (!mediaForm.title.trim()) {
      setError("Veuillez entrer un titre pour le média");
      return;
    }

    // Vérifier qu'on a soit une URL soit un fichier
    if (mediaInputType === "url" && !mediaForm.url) {
      setError("Veuillez entrer une URL");
      return;
    }

    if (mediaInputType === "file" && !mediaFile) {
      setError("Veuillez sélectionner un fichier");
      return;
    }

    try {
      const formData = new FormData();

      // Toujours ajouter le titre
      formData.append("title", mediaForm.title.trim());

      if (mediaInputType === "file" && mediaFile) {
        // Upload de fichier
        formData.append("file", mediaFile);
      } else {
        // Upload d'URL
        formData.append("url", mediaForm.url);
        formData.append("type", mediaForm.type);
      }

      const response = await fetch(`${API_URL}/api/campaigns/${campaignId}/medias`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          // Ne pas mettre Content-Type pour FormData, le navigateur le fera automatiquement
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? `Erreur ${response.status}`);
      }

      await fetchCampaigns();
      setShowMediaModal(null);
      setMediaForm({ url: "", type: "video", title: "" });
      setMediaFile(null);
      setMediaInputType("url");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'ajout du média");
    }
  };

  const removeMedia = async (campaignId: string, url: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_URL}/api/campaigns/${campaignId}/medias`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? `Erreur ${response.status}`);
      }

      await fetchCampaigns();
      setPreviewMedia((prev) => (prev && prev.url === url ? null : prev));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la suppression du média");
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.description &&
        c.description.toLowerCase().includes(search.toLowerCase()));
    const matchRegion =
      regionFilter === "all" || c.regionId === regionFilter;
    return matchSearch && matchRegion;
  });

  const activeCampaigns = campaigns.filter(
    (c) => new Date(c.endDate) >= new Date() && new Date(c.startDate) <= new Date(),
  ).length;
  const completedCampaigns = campaigns.filter(
    (c) => new Date(c.endDate) < new Date(),
  ).length;
  const upcomingCampaigns = campaigns.filter(
    (c) => new Date(c.startDate) > new Date(),
  ).length;

  const canManage = user?.role === "NATIONAL" || user?.role === "REGIONAL";

  return (
    <DashboardShell active="/dashboard/campagnes">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold mb-2">Campagnes de Vaccination</h1>
          <p className="text-blue-100">
            Gérez vos campagnes de vaccination et partagez des informations avec les parents
          </p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Actives</p>
                <p className="text-2xl font-bold text-green-600">{activeCampaigns}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">À venir</p>
                <p className="text-2xl font-bold text-blue-600">{upcomingCampaigns}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Terminées</p>
                <p className="text-2xl font-bold text-gray-600">{completedCampaigns}</p>
              </div>
              <div className="bg-gray-100 p-3 rounded-full">
                <Calendar className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {canManage && (
          <div className="bg-white p-4 rounded-lg shadow-sm flex flex-wrap gap-4 items-center">
            <button
              onClick={() => {
                setShowModal(true);
                setEditCampaign(null);
                setForm({
                  title: "",
                  description: "",
                  startDate: "",
                  endDate: "",
                  regionId: user?.role === "REGIONAL" ? user.regionId || "" : "",
                });
                setError(null);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              Nouvelle campagne
            </button>

            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {user?.role === "NATIONAL" && (
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Toutes les régions</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
              <p className="text-sm text-slate-600">Chargement des campagnes...</p>
            </div>
          </div>
        ) : filteredCampaigns.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredCampaigns.map((c) => {
              const isActive =
                new Date(c.endDate) >= new Date() &&
                new Date(c.startDate) <= new Date();
              const isUpcoming = new Date(c.startDate) > new Date();

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-gray-900">{c.title}</h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            isActive
                              ? "bg-green-100 text-green-700"
                              : isUpcoming
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {isActive
                            ? "✅ Active"
                            : isUpcoming
                            ? "🕒 À venir"
                            : "✔️ Terminée"}
                        </span>
                      </div>
                      {c.description && (
                        <p className="text-gray-600 text-sm mb-2">{c.description}</p>
                      )}

                      <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(c.startDate).toLocaleDateString("fr-FR")} -{" "}
                            {new Date(c.endDate).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{c.region.name}</span>
                        </div>
                      </div>

                      {c.medias && Array.isArray(c.medias) && c.medias.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs text-gray-500 mb-1">
                            Médias ({c.medias.length})
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {c.medias.map((m, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <button
                                  onClick={() => setPreviewMedia(m)}
                                  className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 transition"
                                  title={m.title || (m.type === "video" ? "Vidéo" : "PDF")}
                                >
                                  {m.type === "video" ? (
                                    <Video size={12} />
                                  ) : (
                                    <FileText size={12} />
                                  )}
                                  <span className="max-w-[150px] truncate">
                                    {m.title || (m.type === "video" ? `Vidéo ${i + 1}` : `PDF ${i + 1}`)}
                                  </span>
                                </button>
                                {canManage && (
                                  <button
                                    onClick={() => removeMedia(c.id, m.url)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <button
                        onClick={() => {
                          setEditCampaign(c);
                          setForm({
                            title: c.title,
                            description: c.description || "",
                            startDate: c.startDate.split("T")[0],
                            endDate: c.endDate.split("T")[0],
                            regionId: c.regionId,
                          });
                          setShowModal(true);
                          setError(null);
                        }}
                        className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded flex items-center justify-center gap-2 hover:bg-blue-100 transition"
                      >
                        <Pencil size={16} />
                        Modifier
                      </button>
                      <button
                        onClick={() => {
                          setShowMediaModal(c.id);
                          setMediaForm({ url: "", type: "video", title: "" });
                          setMediaFile(null);
                          setMediaInputType("url");
                          setError(null);
                        }}
                        className="flex-1 px-3 py-2 bg-green-50 text-green-600 rounded flex items-center justify-center gap-2 hover:bg-green-100 transition"
                      >
                        <Plus size={16} />
                        Média
                      </button>
                      <button
                        onClick={() => {
                          setDeleteId(c.id);
                          setError(null);
                        }}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded flex items-center justify-center hover:bg-red-100 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="col-span-full text-center py-12 bg-white rounded-lg border-2 border-dashed">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Aucune campagne trouvée</p>
          </div>
        )}

        {/* Modal Create/Edit */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">
                {editCampaign ? "Modifier la Campagne" : "Nouvelle Campagne"}
              </h2>
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Titre *"
                className="border w-full p-2 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description"
                className="border w-full p-2 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                placeholder="Date de début *"
                className="border w-full p-2 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                placeholder="Date de fin *"
                className="border w-full p-2 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {user?.role === "NATIONAL" && (
                <select
                  value={form.regionId}
                  onChange={(e) => setForm({ ...form, regionId: e.target.value })}
                  className="border w-full p-2 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sélectionner une région *</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditCampaign(null);
                    setForm({
                      title: "",
                      description: "",
                      startDate: "",
                      endDate: "",
                      regionId: "",
                    });
                    setError(null);
                  }}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={saveCampaign}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  {editCampaign ? "Mettre à jour" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Delete */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">Confirmer la suppression ?</h2>
              <p className="mb-4 text-gray-600">
                Voulez-vous vraiment supprimer cette campagne ?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={deleteCampaign}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Add Media */}
        {showMediaModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">Ajouter un média</h2>
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}

              {/* Choix entre URL et fichier */}
              <div className="mb-4 flex gap-2 border-b pb-3">
                <button
                  type="button"
                  onClick={() => {
                    setMediaInputType("url");
                    setMediaFile(null);
                    setError(null);
                  }}
                  className={`flex-1 px-4 py-2 rounded transition ${
                    mediaInputType === "url"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Lien (URL)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMediaInputType("file");
                    setMediaForm({ ...mediaForm, url: "" });
                    setError(null);
                  }}
                  className={`flex-1 px-4 py-2 rounded transition ${
                    mediaInputType === "file"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Fichier
                </button>
              </div>

              {/* Champ titre - toujours visible */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre du média <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={mediaForm.title}
                  onChange={(e) =>
                    setMediaForm({ ...mediaForm, title: e.target.value })
                  }
                  placeholder="Titre du média"
                  className="border w-full p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {mediaInputType === "url" ? (
                <>
                  <input
                    value={mediaForm.url}
                    onChange={(e) =>
                      setMediaForm({ ...mediaForm, url: e.target.value })
                    }
                    placeholder="Lien (YouTube, PDF...)"
                    className="border w-full p-2 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={mediaForm.type}
                    onChange={(e) =>
                      setMediaForm({
                        ...mediaForm,
                        type: e.target.value as "video" | "pdf",
                      })
                    }
                    className="border w-full p-2 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="video">Vidéo</option>
                    <option value="pdf">PDF</option>
                  </select>
                </>
              ) : (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sélectionner un fichier (Vidéo: MP4, MOV, AVI, WEBM ou PDF)
                  </label>
                  <input
                    type="file"
                    accept="video/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setMediaFile(file);
                      // Pré-remplir le titre avec le nom du fichier (sans extension) si le titre est vide
                      if (file && !mediaForm.title.trim()) {
                        const fileName = file.name;
                        const nameWithoutExt = fileName.substring(
                          0,
                          fileName.lastIndexOf("."),
                        );
                        setMediaForm({ ...mediaForm, title: nameWithoutExt });
                      }
                      setError(null);
                    }}
                    className="border w-full p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {mediaFile && (
                    <p className="mt-2 text-sm text-gray-600">
                      Fichier sélectionné : {mediaFile.name} (
                      {(mediaFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowMediaModal(null);
                    setMediaForm({ url: "", type: "video" });
                    setMediaFile(null);
                    setMediaInputType("url");
                    setError(null);
                  }}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={() => addMedia(showMediaModal)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Preview Media */}
        {previewMedia && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-5xl h-[80vh] relative flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  {previewMedia.title || (previewMedia.type === "video" ? "Vidéo" : "PDF")}
                </h3>
                <button
                  onClick={() => setPreviewMedia(null)}
                  className="text-gray-600 bg-white rounded-full p-2 hover:bg-gray-100 transition"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {previewMedia.type === "video" ? (
                  previewMedia.url.startsWith("/uploads/") ? (
                    <video
                      src={`${API_URL}${previewMedia.url}`}
                      controls
                      className="w-full h-full rounded"
                    >
                      Votre navigateur ne supporte pas la lecture de vidéos.
                    </video>
                  ) : (
                    <iframe
                      src={convertYouTubeUrlToEmbed(previewMedia.url)}
                      className="w-full h-full rounded"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      title={previewMedia.title || "Video player"}
                    />
                  )
                ) : (
                  <embed
                    src={
                      previewMedia.url.startsWith("/uploads/")
                        ? `${API_URL}${previewMedia.url}`
                        : previewMedia.url
                    }
                    type="application/pdf"
                    className="w-full h-full rounded"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

