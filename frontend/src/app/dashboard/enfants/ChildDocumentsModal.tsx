"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileImage,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Upload,
  FileText,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type VaccinationProof = {
  id: string;
  title: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
  createdAt: string;
};

type Props = {
  childId: string;
  childName: string;
  token: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function ChildDocumentsModal({
  childId,
  childName,
  token,
  isOpen,
  onClose,
}: Props) {
  const [proofs, setProofs] = useState<VaccinationProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingProof, setViewingProof] = useState<VaccinationProof | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchProofs = useCallback(async () => {
    if (!token || !childId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/api/children/${childId}/vaccination-proofs`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Impossible de charger les documents");
      }

      const data = await response.json();
      setProofs(data?.proofs ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les documents",
      );
    } finally {
      setLoading(false);
    }
  }, [token, childId]);

  useEffect(() => {
    if (isOpen) {
      fetchProofs();
    }
  }, [isOpen, fetchProofs]);

  const handleViewProof = async (proof: VaccinationProof, event?: React.MouseEvent) => {
    console.log("=== handleViewProof appelé ===", proof.id, proof.mimeType);
    
    // Empêcher tout comportement par défaut qui pourrait déclencher un téléchargement
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
    }
    
    // Nettoyer l'ancien blob URL s'il existe (seulement si c'est un blob URL, pas base64)
    if (fileUrl && !fileUrl.startsWith("data:") && !fileUrl.startsWith("http")) {
      window.URL.revokeObjectURL(fileUrl);
    }
    setFileUrl(null);
    
    setViewingProof(proof);
    setLoadingFile(true);
    
    console.log("État mis à jour, loadingFile:", true);
    
    // Pour les images, utiliser l'endpoint base64 qui retourne directement l'image en base64
    // Vérifier aussi l'extension du fichier au cas où le mimeType n'est pas détecté
    if (token && isImage(proof.mimeType, proof.fileName)) {
      try {
        console.log("Chargement image via endpoint base64 pour:", proof.id);
        const response = await fetch(
          `${API_URL}/api/vaccination-proofs/${proof.id}/base64?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            headers: {
              "Accept": "application/json", // Forcer l'acceptation de JSON
            },
          },
        );
        
        console.log("Réponse reçue, status:", response.status, "Content-Type:", response.headers.get("Content-Type"));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Erreur réponse:", errorText);
          const errorData = JSON.parse(errorText).catch(() => ({ message: "Impossible de charger l'image" }));
          throw new Error(errorData?.message || "Impossible de charger l'image");
        }
        
        const contentType = response.headers.get("Content-Type");
        if (!contentType || !contentType.includes("application/json")) {
          console.error("Content-Type inattendu:", contentType);
          throw new Error("Le serveur n'a pas retourné du JSON");
        }
        
        const data = await response.json();
        console.log("Données reçues:", { success: data.success, hasDataUrl: !!data.dataUrl });
        
        if (data.success && data.dataUrl) {
          // L'image est déjà en base64, on peut l'afficher directement
          setFileUrl(data.dataUrl);
          setLoadingFile(false);
        } else {
          throw new Error("Format de réponse invalide");
        }
      } catch (err) {
        console.error("Erreur chargement image:", err);
        alert("Erreur lors du chargement de l'image: " + (err instanceof Error ? err.message : "Erreur inconnue"));
        setLoadingFile(false);
        setViewingProof(null);
      }
    } else if (token) {
      // Pour les PDFs et autres fichiers, créer une URL blob pour affichage dans la modal
      try {
        const response = await fetch(
          `${API_URL}/api/vaccination-proofs/${proof.id}/file`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (response.ok) {
          const blob = await response.blob();
          if (blob.size === 0) {
            throw new Error("Le fichier est vide");
          }
          
          // Créer une URL blob pour afficher dans la modal
          const url = window.URL.createObjectURL(blob);
          setFileUrl(url);
          setLoadingFile(false);
        } else {
          const errorData = await response.json().catch(() => null);
          console.error("Erreur chargement fichier:", errorData);
          alert(errorData?.message || "Impossible de charger le fichier");
          setLoadingFile(false);
          setViewingProof(null);
        }
      } catch (err) {
        console.error("Erreur chargement fichier:", err);
        alert("Erreur lors du chargement du fichier");
        setLoadingFile(false);
        setViewingProof(null);
      }
    }
  };

  const handleCloseViewer = () => {
    setViewingProof(null);
    // Nettoyer les blob URLs pour libérer la mémoire
    if (fileUrl) {
      if (fileUrl.startsWith("blob:")) {
        window.URL.revokeObjectURL(fileUrl);
      }
    }
    setFileUrl(null);
    setLoadingFile(false);
  };

  const handleDownloadProof = async (proof: VaccinationProof) => {
    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/api/vaccination-proofs/${proof.id}/file`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Impossible de télécharger le fichier");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", proof.fileName);
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Impossible de télécharger le fichier",
      );
    }
  };

  const handleDeleteProof = async (proofId: string) => {
    if (!token) return;
    if (
      !window.confirm("Êtes-vous sûr de vouloir supprimer ce document ?")
    ) {
      return;
    }

    try {
      setDeletingId(proofId);
      const res = await fetch(`${API_URL}/api/vaccination-proofs/${proofId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Impossible de supprimer le document");
      }

      await fetchProofs();
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

  const isImage = (mimeType: string | null, fileName?: string) => {
    // Vérifier le mimeType
    if (mimeType?.startsWith("image/")) {
      return true;
    }
    // Si le mimeType n'est pas détecté, vérifier l'extension du fichier
    if (fileName) {
      const extension = fileName.toLowerCase().split(".").pop();
      return ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(extension || "");
    }
    return false;
  };

  const handleUploadFile = async () => {
    if (!uploadFile || !uploadTitle.trim()) {
      setUploadError("Veuillez sélectionner un fichier et saisir un titre");
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", uploadTitle.trim());

      const response = await fetch(
        `${API_URL}/api/children/${childId}/vaccination-proofs/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Impossible d'uploader le document");
      }

      // Réinitialiser le formulaire
      setUploadTitle("");
      setUploadFile(null);
      setShowUploadForm(false);
      
      // Recharger la liste
      await fetchProofs();
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Impossible d'uploader le document",
      );
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-8">
        <div className="relative max-h-[90vh] w-full max-w-[95vw] md:max-w-3xl rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Documents de vaccination
              </h2>
              <p className="text-sm text-slate-500">{childName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Upload className="h-4 w-4" />
                Ajouter un document
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="max-h-[calc(90vh-120px)] overflow-auto p-6">
            {showUploadForm && (
              <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  Ajouter un nouveau document
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Titre du document *
                    </label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="Ex: Certificat de vaccination BCG"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Fichier *
                    </label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Formats acceptés: JPG, PNG, WebP, PDF (max 10MB)
                    </p>
                  </div>
                  {uploadError && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                      {uploadError}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleUploadFile}
                      disabled={uploading || !uploadFile || !uploadTitle.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Upload en cours...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Uploader
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUploadForm(false);
                        setUploadTitle("");
                        setUploadFile(null);
                        setUploadError(null);
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                    onClick={fetchProofs}
                    className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Réessayer
                  </button>
                </div>
              </div>
            ) : proofs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-slate-500">
                <FileImage className="h-16 w-16 text-slate-300" />
                <p className="text-lg font-semibold">Aucun document disponible</p>
                <p className="text-sm text-slate-400">
                  Les parents n'ont pas encore envoyé de documents
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {proofs.map((proof) => (
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
                          {proof.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {proof.fileName} • {formatFileSize(proof.fileSize)} •{" "}
                          {formatDate(proof.uploadedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("Bouton Voir cliqué pour:", proof.id);
                          handleViewProof(proof, e);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        Voir
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
            )}
          </div>
        </div>
      </div>

      {/* Modal de visualisation */}
      {viewingProof && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 px-4 py-8">
          <div className="relative max-h-[90vh] w-full max-w-[95vw] md:max-w-4xl rounded-3xl bg-white shadow-2xl">
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
              {loadingFile ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : fileUrl ? (
                isImage(viewingProof.mimeType, viewingProof.fileName) ? (
                  <div className="flex items-center justify-center">
                    <img
                      src={fileUrl}
                      alt={viewingProof.fileName}
                      className="max-w-full rounded-lg shadow-lg"
                      style={{ maxHeight: "70vh", objectFit: "contain" }}
                      onError={(e) => {
                        console.error("Erreur chargement image:", e);
                        alert("Impossible d'afficher l'image. Le fichier a peut-être été téléchargé au lieu d'être affiché.");
                        setViewingProof(null);
                        setFileUrl(null);
                      }}
                      onLoad={() => {
                        console.log("Image chargée avec succès");
                      }}
                      crossOrigin="anonymous"
                    />
                  </div>
                ) : viewingProof.mimeType === "application/pdf" || viewingProof.fileName.toLowerCase().endsWith(".pdf") ? (
                  <div className="flex items-center justify-center w-full h-full min-h-[60vh]">
                    <iframe
                      src={fileUrl}
                      title={viewingProof.fileName}
                      className="w-full rounded-lg shadow-lg"
                      style={{ minHeight: "60vh", maxHeight: "70vh" }}
                      onError={() => {
                        console.error("Erreur chargement PDF");
                        alert("Impossible d'afficher le PDF");
                        setViewingProof(null);
                        setFileUrl(null);
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <FileText className="h-16 w-16 mb-4 text-slate-300" />
                    <p className="mb-2">Ce type de fichier ne peut pas être affiché directement</p>
                    <p className="text-sm text-slate-400">{viewingProof.fileName}</p>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center py-16 text-slate-500">
                  <p>Impossible de charger le fichier</p>
                </div>
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
    </>
  );
}

