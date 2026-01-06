"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, Upload, X, Loader2, Save, Trash2 } from "lucide-react";
import DashboardShell from "@/app/dashboard/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { useSystemSettings } from "@/contexts/SystemSettingsContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

export default function SuperAdminSettingsPage() {
  const { accessToken } = useAuth();
  const { refreshSettings } = useSystemSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [appName, setAppName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [currentLogoPath, setCurrentLogoPath] = useState<string | null>(null);
  const [hasCustomName, setHasCustomName] = useState(false);
  const [hasCustomLogo, setHasCustomLogo] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/api/superadmin/settings`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const data = await res.json();
      setAppName(data.hasCustomName ? data.appName : "");
      setCurrentLogoPath(data.logoPath);
      setHasCustomName(data.hasCustomName);
      setHasCustomLogo(data.hasCustomLogo);
      if (data.hasCustomLogo && data.logoPath) {
        setLogoPreview(data.logoPath);
      }
    } catch (err) {
      console.error("Erreur chargement paramètres:", err);
      setError("Impossible de charger les paramètres");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setCurrentLogoPath(null);
  };

  const handleSave = async () => {
    if (!accessToken) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const formData = new FormData();
      if (appName.trim()) {
        formData.append("appName", appName.trim());
      } else {
        formData.append("appName", "");
      }
      if (logoFile) {
        formData.append("logo", logoFile);
      } else if (!logoPreview && hasCustomLogo) {
        // Si on supprime le logo
        formData.append("logoPath", "");
      }

      const res = await fetch(`${API_URL}/api/superadmin/settings`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `status ${res.status}`);
      }

      setSuccess(true);
      await refreshSettings();
      await fetchSettings();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Erreur sauvegarde paramètres:", err);
      setError(err instanceof Error ? err.message : "Impossible de sauvegarder les paramètres");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell active="/dashboard/superadmin/parametres">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell active="/dashboard/superadmin/parametres">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Paramètres de l'application</h2>
            <p className="text-sm text-slate-500">
              Gérez le nom et le logo de l'application
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-700">
            Paramètres sauvegardés avec succès
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Section Nom de l'application */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-slate-900">Nom de l'application</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">
                  Nom actuel
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="Imunia (par défaut)"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {hasCustomName
                    ? "Un nom personnalisé est défini"
                    : "Le nom par défaut 'Imunia' sera utilisé si aucun nom n'est défini"}
                </p>
              </div>
              {hasCustomName && (
                <button
                  type="button"
                  onClick={() => {
                    setAppName("");
                    setHasCustomName(false);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer le nom personnalisé
                </button>
              )}
            </div>
          </div>

          {/* Section Logo */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-slate-900">Logo de l'application</h3>
            </div>
            <div className="space-y-4">
              {logoPreview && (
                <div className="relative">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-32 w-32 rounded-xl border border-slate-200 object-contain"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1.5 text-white transition hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">
                  {hasCustomLogo ? "Remplacer le logo" : "Choisir un logo"}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {hasCustomLogo
                    ? "Un logo personnalisé est défini"
                    : "Le logo par défaut sera utilisé si aucun logo n'est défini"}
                </p>
              </div>
              {hasCustomLogo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer le logo personnalisé
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bouton de sauvegarde */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Sauvegarder les paramètres
              </>
            )}
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}
