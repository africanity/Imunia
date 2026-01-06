"use client";

import { useAuth } from "@/context/AuthContext";
import DashboardShell from "../components/DashboardShell";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ChildrenTab from "./ChildrenTab";
import ParentsTab from "./ParentsTab";
import { Child } from "./types";
import { Baby, Users } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type ApiChildrenResponse = {
  total?: number;
  items?: Child[];
};

type TabKey = "children" | "parents";

const statusLabel = (child: Child): string => {
  // Calculer le statut en fonction des données réelles plutôt que du statut stocké
  // pour éviter les incohérences
  if (child.vaccinesLate.length > 0 || child.vaccinesOverdue.length > 0) {
    return "En retard";
  }
  if (child.vaccinesDue.length > 0) {
    return "À faire";
  }
  // Si aucun vaccin en retard, à faire ou overdue, l'enfant est à jour
  return "À jour";
};

export default function EnfantsPage() {
  const { accessToken, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("children");
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regionOptions, setRegionOptions] = useState<string[]>([]);

  const [activationFilter, setActivationFilter] = useState<string>("all");

  const loadChildren = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activationFilter !== "all") {
        params.append("status", activationFilter);
      }
      const url = `${API_URL}/api/children${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `Erreur ${response.status}`);
      }

      const data: ApiChildrenResponse = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const normalized = items.map((child) => ({
        ...child,
        region: child.region ?? "",
        district: child.district ?? "",
        healthCenter: child.healthCenter ?? "",
      }));
      setChildren(normalized);
    } catch (err) {
      console.error("Erreur chargement enfants:", err);
      setError(err instanceof Error ? err.message : "Erreur de chargement");
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, activationFilter]);

  const loadRegions = useCallback(async () => {
    if (!accessToken || user?.role !== "NATIONAL") {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/region`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const payload = await response.json();
      const entries = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.regions)
          ? payload.regions
          : [];
      const names = Array.from(
        new Set(
          entries
            .map((entry: { name?: string }) => entry?.name?.trim())
            .filter((name): name is string => Boolean(name)),
        ),
      ).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
      setRegionOptions(names);
    } catch (err) {
      console.error("Erreur chargement régions pour filtre:", err);
      setRegionOptions([]);
    }
  }, [accessToken, user?.role]);

  useEffect(() => {
    if (accessToken) {
      loadChildren();
      if (user?.role === "NATIONAL") {
        loadRegions();
      } else {
        setRegionOptions([]);
      }
    }
  }, [accessToken, user?.role, loadChildren, loadRegions]);

  // Recharger les données quand un paramètre refresh est présent dans l'URL
  useEffect(() => {
    const refresh = searchParams.get("refresh");
    if (refresh === "true" && accessToken) {
      loadChildren();
      // Retirer le paramètre de l'URL
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete("refresh");
      const newUrl = newSearchParams.toString()
        ? `/dashboard/enfants?${newSearchParams.toString()}`
        : "/dashboard/enfants";
      router.replace(newUrl);
    }
  }, [searchParams, accessToken, loadChildren, router]);

  // Recharger les données quand la page reçoit le focus (utile après redirection)
  useEffect(() => {
    const handleFocus = () => {
      if (accessToken) {
        loadChildren();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [accessToken, loadChildren]);

  const stats = useMemo(() => {
    const total = children.length;
    const upToDate = children.filter((c) => statusLabel(c) === "À jour").length;
    const late = children.filter((c) => statusLabel(c) === "En retard").length;
    const scheduled = children.filter((c) => c.vaccinesScheduled.length > 0 || c.nextAppointment).length;
    return { total, upToDate, late, scheduled };
  }, [children]);

  return (
    <DashboardShell active="/dashboard/enfants">
      <div className="space-y-6">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-blue-800 px-8 py-6 text-white shadow-lg">
          <h1 className="text-3xl font-bold">Gestion des Enfants & Parents</h1>
          <p className="mt-2 text-blue-100">
            Vue d'ensemble nationale – suivez les enfants, leurs statuts vaccinaux et les informations familles.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("children")}
              className={`flex flex-1 items-center justify-center gap-2 px-6 py-4 text-sm font-semibold transition ${
                activeTab === "children"
                  ? "border-b-2 border-blue-600 bg-blue-50 text-blue-600"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Baby className="h-5 w-5" />
              Enfants
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("parents")}
              className={`flex flex-1 items-center justify-center gap-2 px-6 py-4 text-sm font-semibold transition ${
                activeTab === "parents"
                  ? "border-b-2 border-blue-600 bg-blue-50 text-blue-600"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Users className="h-5 w-5" />
              Parents
            </button>
          </div>

          <div className="p-0">
            {activeTab === "children" && (
              <ChildrenTab
                apiBase={API_URL}
                token={accessToken}
                children={children}
                loading={loading}
                error={error}
                onRefresh={loadChildren}
                regionOptions={user?.role === "NATIONAL" ? regionOptions : undefined}
                role={user?.role ?? null}
                agentLevel={user?.agentLevel ?? null}
                activationFilter={activationFilter}
                onActivationFilterChange={setActivationFilter}
              />
            )}
            {activeTab === "parents" && (
              <ParentsTab apiBase={API_URL} token={accessToken} />
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
