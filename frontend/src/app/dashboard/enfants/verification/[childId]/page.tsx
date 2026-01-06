"use client";

import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Syringe, Pencil, FileImage, Download, X, Plus, Trash2, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import DashboardShell from "@/app/dashboard/components/DashboardShell";

const VaccinationRecordModal = dynamic(
  () => import("../../VaccinationRecordModal"),
  { ssr: false },
);


const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

const isImage = (mimeType: string | null, fileName: string) => {
  if (mimeType && mimeType.startsWith("image/")) return true;
  const ext = fileName?.toLowerCase().split(".").pop();
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "");
};

export default function VerificationPage() {
  const { accessToken, user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const childId = params?.childId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [requestingPhotos, setRequestingPhotos] = useState(false);
  const [child, setChild] = useState<any>(null);
  const [proofs, setProofs] = useState<any[]>([]);
  const [proofsLoading, setProofsLoading] = useState(true);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  
  // États pour la gestion manuelle du carnet
  const [editorState, setEditorState] = useState<{
    open: boolean;
    mode: "create" | "edit";
    bucket: "due" | "late" | "overdue" | "completed" | null;
    entry: any | null;
  }>({
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
  const [referenceData, setReferenceData] = useState<{
    vaccines: Array<{ id: string; name: string; dosesRequired?: string }>;
    calendars: Array<{ id: string; label: string; vaccineIds: string[] }>;
  }>({ vaccines: [], calendars: [] });
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    // Ne pas charger si on n'a pas encore le childId
    if (!childId) {
      setError("ID enfant manquant");
      setLoading(false);
      return;
    }

    // Attendre que le token soit chargé depuis les cookies
    if (accessToken === null) {
      // Le AuthContext va gérer la redirection si nécessaire
      // Ne pas afficher d'erreur pendant le chargement
      return;
    }

    if (!accessToken) {
      setError("Authentification requise");
      setLoading(false);
      return;
    }

    // Charger les données de l'enfant
    const loadChild = async () => {
      try {
        const response = await fetch(`${API_URL}/api/children/${childId}/vaccinations`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Erreur lors du chargement des données");
        }

        const data = await response.json();
        setChild(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    loadChild();
  }, [accessToken, childId]);

  // Charger les preuves de vaccination et les images
  useEffect(() => {
    if (!accessToken || !childId) return;

    const loadProofs = async () => {
      try {
        setProofsLoading(true);
        const response = await fetch(`${API_URL}/api/children/${childId}/vaccination-proofs`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const proofsList = data?.proofs ?? [];
          setProofs(proofsList);

          // Si pas d'images, terminer le chargement immédiatement
          const imageProofs = proofsList.filter((proof: any) => isImage(proof.mimeType, proof.fileName));
          if (imageProofs.length === 0) {
            setProofsLoading(false);
            return;
          }

          // Charger toutes les images en parallèle avec timeout
          const imagePromises = imageProofs.map(async (proof: any) => {
            try {
              // Ajouter un timeout de 10 secondes par image
              const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Timeout")), 10000)
              );

              const fetchPromise = fetch(
                `${API_URL}/api/vaccination-proofs/${proof.id}/base64?token=${encodeURIComponent(accessToken)}`,
                {
                  method: "GET",
                  headers: {
                    "Accept": "application/json",
                  },
                },
              );

              const imgResponse = await Promise.race([fetchPromise, timeoutPromise]);

              if (imgResponse.ok) {
                const imgData = await imgResponse.json();
                if (imgData.success && imgData.dataUrl) {
                  return { id: proof.id, url: imgData.dataUrl, error: false };
                }
              }
              return { id: proof.id, error: true };
            } catch (err) {
              console.error(`Erreur chargement image ${proof.id}:`, err);
              return { id: proof.id, error: true };
            }
          });

          const imageResults = await Promise.all(imagePromises);
          const urlsMap: Record<string, string> = {};
          const errorsMap: Record<string, boolean> = {};
          imageResults.forEach((result) => {
            if (result.error) {
              errorsMap[result.id] = true;
            } else if (result.url) {
              urlsMap[result.id] = result.url;
            }
          });
          setImageUrls(urlsMap);
          setImageErrors(errorsMap);
        } else {
          // Si la réponse n'est pas OK, arrêter le chargement
          setProofs([]);
        }
      } catch (err) {
        console.error("Erreur chargement preuves:", err);
      } finally {
        setProofsLoading(false);
      }
    };

    loadProofs();
  }, [accessToken, childId]);

  const handleActivate = async () => {
    if (!accessToken || !childId) return;

    setActivating(true);
    try {
      const response = await fetch(`${API_URL}/api/children/${childId}/activate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message ?? "Erreur lors de l'activation");
      }

      // Recharger les données de l'enfant pour mettre à jour l'affichage
      const childResponse = await fetch(`${API_URL}/api/children/${childId}/vaccinations`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (childResponse.ok) {
        const childData = await childResponse.json();
        setChild(childData);
      }

      // Rediriger vers la page des enfants avec un paramètre pour forcer le rechargement
      router.push("/dashboard/enfants?refresh=true");
      // Forcer le rechargement de la page pour mettre à jour la liste
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'activation");
    } finally {
      setActivating(false);
    }
  };

  const handleRequestPhotos = async () => {
    if (!accessToken || !childId) return;

    setRequestingPhotos(true);
    try {
      const response = await fetch(`${API_URL}/api/children/${childId}/request-photos`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message ?? "Erreur lors de la demande");
      }

      // Rediriger vers la page des enfants
      router.push("/dashboard/enfants");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la demande");
    } finally {
      setRequestingPhotos(false);
    }
  };

  // Si pas de token, ne rien afficher (AuthContext va rediriger)
  if (!accessToken) {
    return (
      <DashboardShell active="/dashboard/enfants">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="text-sm text-slate-600">Chargement...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (loading) {
    return (
      <DashboardShell active="/dashboard/enfants">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="text-sm text-slate-600">Chargement...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error && !child) {
    return (
      <DashboardShell active="/dashboard/enfants">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <p className="font-medium text-red-600">{error}</p>
            <button
              onClick={() => router.push("/dashboard/enfants")}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Retour
            </button>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell active="/dashboard/enfants">
      <div className="bg-slate-50 p-6">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard/enfants")}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-5 w-5" />
            Retour
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRequestPhotos}
              disabled={requestingPhotos}
              className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
            >
              <XCircle className="h-5 w-5" />
              {requestingPhotos ? "Envoi..." : "Demander de nouvelles photos"}
            </button>
            <button
              onClick={handleActivate}
              disabled={activating}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              <CheckCircle className="h-5 w-5" />
              {activating ? "Activation..." : "Activer le compte"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Colonne gauche : Gestion manuelle du carnet */}
          {child && accessToken && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Gestion manuelle du carnet</h2>
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                <VaccinationRecordModal
                  isOpen={true}
                  onClose={() => {}}
                  detail={child}
                  childId={childId}
                  apiBase={API_URL}
                  token={accessToken}
                  canEdit={true}
                  inline={true}
                  onRefresh={async () => {
                    // Recharger les données
                    const response = await fetch(`${API_URL}/api/children/${childId}/vaccinations`, {
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                      },
                    });
                    if (response.ok) {
                      const data = await response.json();
                      setChild(data);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Colonne droite : Images uploadées */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Photos du carnet physique</h2>
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
              {proofsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                </div>
              ) : proofs.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Aucune photo uploadée</p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {proofs.map((proof) => (
                    <div
                      key={proof.id}
                      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-blue-300 hover:shadow-md"
                    >
                      {isImage(proof.mimeType, proof.fileName) ? (
                        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-100">
                          {imageUrls[proof.id] ? (
                            <button
                              type="button"
                              onClick={() => setViewingImage(imageUrls[proof.id])}
                              className="absolute inset-0 flex items-center justify-center transition hover:bg-slate-900/10"
                            >
                              <img
                                src={imageUrls[proof.id]}
                                alt={proof.fileName}
                                className="h-full w-full object-contain"
                              />
                            </button>
                          ) : imageErrors[proof.id] ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
                              <FileImage className="h-8 w-8 text-slate-400" />
                              <p className="text-xs text-slate-500">Erreur de chargement</p>
                              <a
                                href={`${API_URL}/api/vaccination-proofs/${proof.id}/file?token=${encodeURIComponent(accessToken || "")}`}
                                download
                                className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
                              >
                                Télécharger
                              </a>
                            </div>
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-4">
                          <FileImage className="h-8 w-8 text-slate-400" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">{proof.fileName}</p>
                            <p className="text-xs text-slate-500">
                              {proof.fileSize ? `${(proof.fileSize / 1024).toFixed(1)} KB` : ""} •{" "}
                              {new Date(proof.uploadedAt).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "long",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                          <a
                            href={`${API_URL}/api/vaccination-proofs/${proof.id}/file?token=${encodeURIComponent(accessToken || "")}`}
                            download
                            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modal pour afficher l'image en grand */}
          {viewingImage && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-4"
              onClick={() => setViewingImage(null)}
            >
              <button
                type="button"
                onClick={() => setViewingImage(null)}
                className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white transition hover:bg-white/30"
              >
                <X className="h-6 w-6" />
              </button>
              <img
                src={viewingImage}
                alt="Photo du carnet"
                className="max-h-[90vh] max-w-[90vw] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

