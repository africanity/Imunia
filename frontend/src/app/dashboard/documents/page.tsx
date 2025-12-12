"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileImage,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
  Search,
  X,
} from "lucide-react";
import DashboardShell from "@/app/dashboard/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type VaccinationProof = {
  id: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: string;
  createdAt: string;
};

type ChildWithProofs = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  healthCenter: string;
  district: string;
  region: string;
  proofs: VaccinationProof[];
};

export default function DocumentsPage() {
  const { accessToken, user } = useAuth();
  const [children, setChildren] = useState<ChildWithProofs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [viewingProof, setViewingProof] = useState<VaccinationProof | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchChildren = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Récupérer la liste des enfants
      const childrenRes = await fetch(`${API_URL}/api/children`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!childrenRes.ok) {
        throw new Error("Impossible de charger la liste des enfants");
      }

      const childrenData = await childrenRes.json();
      const childrenList = Array.isArray(childrenData)
        ? childrenData
        : childrenData?.items ?? childrenData?.children ?? [];

      // Pour chaque enfant, récupérer ses preuves
      const childrenWithProofs = await Promise.all(
        childrenList.map(async (child: any) => {
          try {
            const proofsRes = await fetch(
              `${API_URL}/api/children/${child.id}/vaccination-proofs`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              },
            );

            if (!proofsRes.ok) {
              return {
                ...child,
                proofs: [],
              };
            }

            const proofsData = await proofsRes.json();
            const proofs = proofsData?.proofs ?? [];

            // Debug: log pour vérifier les preuves
            if (proofs.length > 0) {
              console.log(`Enfant ${child.id} a ${proofs.length} preuve(s)`, proofs);
            }

            return {
              ...child,
              proofs,
            };
          } catch {
            return {
              ...child,
              proofs: [],
            };
          }
        }),
      );

      // Debug: log pour vérifier les données
      console.log("Enfants avec preuves:", childrenWithProofs);
      console.log("Enfants avec preuves (filtrés):", childrenWithProofs.filter(c => c.proofs.length > 0));

      setChildren(childrenWithProofs);
    } catch (err) {
      console.error("Erreur lors du chargement des documents:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les documents",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  const handleViewProof = (proof: VaccinationProof) => {
    setViewingProof(proof);
  };

  const handleCloseViewer = () => {
    setViewingProof(null);
  };

  const handleDownloadProof = (proof: VaccinationProof) => {
    if (!accessToken) return;

    const url = `${API_URL}/api/vaccination-proofs/${proof.id}/file`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", proof.fileName);
    link.setAttribute(
      "target",
      "_blank",
    );
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteProof = async (proofId: string) => {
    if (!accessToken) return;
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) {
      return;
    }

    try {
      setDeletingId(proofId);
      const res = await fetch(
        `${API_URL}/api/vaccination-proofs/${proofId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Impossible de supprimer le document");
      }

      await fetchChildren();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Impossible de supprimer le document",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Taille inconnue";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isImage = (mimeType: string | null) => {
    return mimeType?.startsWith("image/") ?? false;
  };

  const filteredChildren = children.filter((child) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      child.firstName.toLowerCase().includes(term) ||
      child.lastName.toLowerCase().includes(term) ||
      child.name.toLowerCase().includes(term) ||
      child.healthCenter.toLowerCase().includes(term)
    );
  });

  const childrenWithProofs = filteredChildren.filter(
    (child) => child.proofs.length > 0,
  );

  return (
    <DashboardShell active="/dashboard/documents">
      <div className="space-y-6">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-blue-800 px-8 py-6 text-white shadow-lg">
          <h1 className="text-3xl font-bold">Documents de vaccination</h1>
          <p className="mt-2 text-blue-100">
            Visualisez et gérez les preuves de vaccination envoyées par les
            parents
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un enfant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-10 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
                <p className="font-medium text-red-600">{error}</p>
                <button
                  type="button"
                  onClick={fetchChildren}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Réessayer
                </button>
              </div>
            </div>
          ) : childrenWithProofs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-slate-500">
              <FileImage className="h-16 w-16 text-slate-300" />
              <p className="text-lg font-semibold">
                {searchTerm
                  ? "Aucun document trouvé"
                  : "Aucun document disponible"}
              </p>
              <p className="text-sm text-slate-400">
                {searchTerm
                  ? "Essayez avec un autre terme de recherche"
                  : "Les parents n'ont pas encore envoyé de documents"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {childrenWithProofs.map((child) => (
                <div
                  key={child.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {child.name}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {child.healthCenter} • {child.district} • {child.region}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      {child.proofs.length} document
                      {child.proofs.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {child.proofs.map((proof) => (
                      <div
                        key={proof.id}
                        className="group relative rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 rounded-lg bg-blue-100 p-2">
                            <FileImage className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {proof.fileName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatFileSize(proof.fileSize)} •{" "}
                              {formatDate(proof.uploadedAt)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewProof(proof)}
                            className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                          >
                            {isImage(proof.mimeType) ? "Voir" : "Télécharger"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadProof(proof)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            title="Télécharger"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProof(proof.id)}
                            disabled={deletingId === proof.id}
                            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            title="Supprimer"
                          >
                            {deletingId === proof.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de visualisation */}
      {viewingProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-8">
          <div className="relative max-h-[90vh] w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Document
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {viewingProof.fileName}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseViewer}
                className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-120px)] overflow-auto p-6">
              {isImage(viewingProof.mimeType) ? (
                <img
                  src={`${API_URL}/api/vaccination-proofs/${viewingProof.id}/file`}
                  alt={viewingProof.fileName}
                  className="mx-auto max-w-full rounded-lg shadow-lg"
                  style={{ maxHeight: "70vh" }}
                  onError={(e) => {
                    // Si l'image ne charge pas (problème d'auth), afficher un message
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="flex flex-col items-center justify-center py-16 text-slate-500">
                          <p class="font-medium">Impossible de charger l'image</p>
                          <button onclick="window.location.reload()" class="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                            Réessayer
                          </button>
                        </div>
                      `;
                    }
                  }}
                />
              ) : (
                <iframe
                  src={`${API_URL}/api/vaccination-proofs/${viewingProof.id}/file`}
                  className="h-[70vh] w-full rounded-lg border border-slate-200"
                  title={viewingProof.fileName}
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => handleDownloadProof(viewingProof)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                Télécharger
              </button>
              <button
                type="button"
                onClick={handleCloseViewer}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
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

