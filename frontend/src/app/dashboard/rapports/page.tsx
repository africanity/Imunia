"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import DashboardShell from "../components/DashboardShell";
import {
  Activity,
  Calendar,
  Package,
  TrendingUp,
  Users,
  Loader2,
  AlertTriangle,
  BarChart3,
  Building2,
  MapPin,
  FileText,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import TabNavigation from "./components/TabNavigation";
import RegionsTab from "./components/RegionsTab";
import RegionDetailView from "./components/RegionDetailView";
import DistrictDetailView from "./components/DistrictDetailView";
import HealthCenterDetailView from "./components/HealthCenterDetailView";
import type {
  NationalStats,
  RegionDetailedStats,
  DistrictDetailedStats,
  HealthCenterDetailedStats,
  RegionalStats,
  TabType,
  DrillLevel,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";

interface StatsData {
  totalVaccinations: number;
  thisMonth: number;
  thisWeek: number;
  stockStatus: { vaccine: string; quantity: number; status: string }[];
  recentActivity: { date: string; child: string; vaccine: string }[];
  monthlyTrend: { month: string; count: number }[];
}

export default function RapportsPage() {
  const { accessToken, user } = useAuth();
  
  // Tous les états doivent être déclarés en haut, avant tout return conditionnel
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false); // Initialiser à false, sera mis à true quand on commence à charger
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("6months");
  
  // États pour le drill-down (NATIONAL uniquement)
  const [drillLevel, setDrillLevel] = useState<DrillLevel>("national");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedHealthCenter, setSelectedHealthCenter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // États pour les données détaillées (NATIONAL uniquement)
  const [nationalStats, setNationalStats] = useState<NationalStats | null>(null);
  const [regionStats, setRegionStats] = useState<RegionDetailedStats | null>(null);
  const [districtStats, setDistrictStats] = useState<DistrictDetailedStats | null>(null);
  const [healthCenterStats, setHealthCenterStats] = useState<HealthCenterDetailedStats | null>(null);

  // États pour les données régionales
  const [regionalStats, setRegionalStats] = useState<RegionalStats | null>(null);

  // États pour les données de district (pour les utilisateurs DISTRICT)
  const [districtReportsStats, setDistrictReportsStats] = useState<RegionalStats | null>(null);

  // Charger les données pour les agents uniquement
  useEffect(() => {
    const fetchStats = async () => {
      if (!accessToken || !user) {
        setLoading(false);
        return;
      }

      if (user.role !== "AGENT") {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_URL}/api/reports/agent?period=${selectedPeriod}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}`);
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error("Erreur chargement stats:", err);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        // Fallback vers des données vides
        setStats({
          totalVaccinations: 0,
          thisMonth: 0,
          thisWeek: 0,
          stockStatus: [],
          recentActivity: [],
          monthlyTrend: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [accessToken, user, selectedPeriod]);

  // Charger les données selon le rôle (REGIONAL et NATIONAL)
  useEffect(() => {
    const fetchData = async () => {
      if (!accessToken || !user) {
        setLoading(false);
        return;
      }

      // Si c'est un agent, on ne fait rien ici (géré par le premier useEffect)
      if (user.role === "AGENT") {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        if (user.role === "REGIONAL") {
          const response = await fetch(`${API_URL}/api/reports/regional?period=${selectedPeriod}`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Erreur ${response.status}`);
          }

          const data = await response.json();
          setRegionalStats(data);
        } else if (user.role === "DISTRICT") {
          const response = await fetch(`${API_URL}/api/reports/district?period=${selectedPeriod}`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Erreur ${response.status}`);
          }

          const data = await response.json();
          setDistrictReportsStats(data);
        } else if (user.role === "NATIONAL" && drillLevel === "national") {
          const response = await fetch(`${API_URL}/api/reports/national?period=${selectedPeriod}`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Erreur ${response.status}`);
          }

          const data = await response.json();
          setNationalStats(data);
        } else if (user.role === "NATIONAL") {
          // Si on est au niveau national mais pas au drill-down "national", on ne charge rien
          setLoading(false);
          return;
        } else {
          // Rôle non géré
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Erreur chargement stats:", err);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accessToken, user, selectedPeriod, drillLevel]);

  // Vue DISTRICT
  if (user?.role === "DISTRICT") {
    const maxTrend = Math.max(...(districtReportsStats?.monthlyTrend?.map((m) => m.count) || [1]), 1);
    const maxVaccinations = Math.max(...(districtReportsStats?.centerPerformance?.map((c) => c.vaccinations) || [1]), 1);

    return (
      <DashboardShell active="/dashboard/rapports">
        <div className="space-y-6">
          {/* En-tête */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-indigo-600" />
                Rapports & Statistiques
              </h1>
              <p className="text-gray-600">Vue d'ensemble de la performance de votre district (par centre de santé)</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="1month">1 mois</option>
                <option value="3months">3 mois</option>
                <option value="6months">6 mois</option>
                <option value="1year">1 an</option>
              </select>
            </div>
          </div>

          {/* Alertes */}
          {districtReportsStats?.alerts && districtReportsStats.alerts.length > 0 && (
            <div
              className={
                districtReportsStats.alerts.some((a) => a.severity === "high")
                  ? "bg-red-50 border-l-4 border-red-400 p-4 rounded-lg"
                  : "bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg"
              }
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={
                    districtReportsStats.alerts.some((a) => a.severity === "high")
                      ? "h-5 w-5 text-red-600 mt-0.5"
                      : "h-5 w-5 text-yellow-600 mt-0.5"
                  }
                />
                <div className="flex-1">
                  <h3
                    className={
                      districtReportsStats.alerts.some((a) => a.severity === "high")
                        ? "font-semibold text-red-900 mb-2"
                        : "font-semibold text-yellow-900 mb-2"
                    }
                  >
                    {districtReportsStats.alerts.length} alerte{districtReportsStats.alerts.length > 1 ? "s" : ""} importante
                    {districtReportsStats.alerts.length > 1 ? "s" : ""}
                  </h3>
                  <ul className="space-y-1">
                    {districtReportsStats.alerts.map((alert, idx) => (
                      <li
                        key={idx}
                        className={
                          alert.severity === "high"
                            ? "text-sm text-red-800 font-medium"
                            : "text-sm text-yellow-800"
                        }
                      >
                        {alert.severity === "high" ? "⚠️" : "•"} {alert.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <Building2 className="h-8 w-8 opacity-80" />
                <MapPin className="h-5 w-5 opacity-60" />
              </div>
              <div className="text-3xl font-bold mb-1">{districtReportsStats?.totalCenters || 0}</div>
              <div className="text-sm opacity-90">Centres de santé actifs</div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <Users className="h-8 w-8 opacity-80" />
                <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">Total</span>
              </div>
              <div className="text-3xl font-bold mb-1">
                {(districtReportsStats?.totalVaccinations || 0).toLocaleString()}
              </div>
              <div className="text-sm opacity-90">Vaccinations effectuées</div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="h-8 w-8 opacity-80" />
                <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">Objectif: 90%</span>
              </div>
              <div className="text-3xl font-bold mb-1">{districtReportsStats?.coverageRate || 0}%</div>
              <div className="text-sm opacity-90">Taux de couverture</div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <Activity className="h-8 w-8 opacity-80" />
                <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">En cours</span>
              </div>
              <div className="text-3xl font-bold mb-1">{districtReportsStats?.activeCampaigns || 0}</div>
              <div className="text-sm opacity-90">Campagnes actives</div>
            </div>
          </div>

          {/* Graphiques */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Évolution mensuelle */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
                Évolution mensuelle
              </h2>
              <div className="space-y-3">
                {districtReportsStats?.monthlyTrend?.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-20 text-sm font-medium text-gray-700">{item.month}</div>
                    <div className="flex-1">
                      <div className="h-10 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 flex items-center justify-end pr-3 text-white text-sm font-bold"
                          style={{
                            width: item.count > 0 ? `${Math.max((item.count / maxTrend) * 100, 5)}%` : "0%",
                            minWidth: item.count > 0 ? "50px" : "0",
                          }}
                        >
                          {item.count > 0 && item.count.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Distribution par vaccin */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-600" />
                Répartition par vaccin
              </h2>
              {districtReportsStats?.vaccineDistribution && districtReportsStats.vaccineDistribution.length > 0 ? (
                <div className="space-y-4">
                  {districtReportsStats.vaccineDistribution.map((vaccine, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-gray-900">{vaccine.vaccine}</span>
                        <span className="text-sm font-bold text-gray-700">
                          {vaccine.total.toLocaleString()} ({vaccine.percentage}%)
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
                          style={{ width: `${Math.max(vaccine.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Aucune donnée de distribution disponible</p>
                </div>
              )}
            </div>
          </div>

          {/* Performance des centres de santé */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              Performance par centre de santé
            </h2>
            {districtReportsStats?.centerPerformance && districtReportsStats.centerPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Centre de santé</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Vaccinations</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Couverture</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Performance</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">État stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {districtReportsStats.centerPerformance.map((center, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="py-4 px-4">
                          <div className="font-medium text-gray-900">{center.name}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-2xl font-bold text-gray-900">
                            {center.vaccinations.toLocaleString()}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold text-gray-900">{center.coverage}%</div>
                            <div className="flex-1 max-w-24">
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    center.coverage >= 90
                                      ? "bg-green-500"
                                      : center.coverage >= 75
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                  }`}
                                  style={{ width: `${center.coverage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="w-full bg-gray-100 rounded-lg h-8 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold"
                              style={{
                                width: `${Math.max((center.vaccinations / maxVaccinations) * 100, 5)}%`,
                                minWidth: center.vaccinations > 0 ? "40px" : "0",
                              }}
                            >
                              {center.vaccinations > 0 &&
                                ((center.vaccinations / maxVaccinations) * 100).toFixed(0) + "%"}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              center.stock === "critical"
                                ? "bg-red-100 text-red-700"
                                : center.stock === "warning"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {center.stock === "critical"
                              ? "Critique"
                              : center.stock === "warning"
                              ? "Attention"
                              : "Bon"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Aucun centre de santé dans ce district</p>
              </div>
            )}
          </div>
        </div>
      </DashboardShell>
    );
  }

  // Fonctions de navigation drill-down (NATIONAL) - doivent être déclarées avant les returns
  const handleRegionClick = async (regionName: string) => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setSelectedRegion(regionName);
      setDrillLevel("region");
      const response = await fetch(
        `${API_URL}/api/reports/region/${encodeURIComponent(regionName)}?period=${selectedPeriod}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      const data = await response.json();
      setRegionStats(data);
    } catch (err) {
      console.error("Erreur chargement stats région:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDistrictClick = async (districtName: string) => {
    if (!accessToken || !selectedRegion) return;
    try {
      setLoading(true);
      setSelectedDistrict(districtName);
      setDrillLevel("district");
      const response = await fetch(
        `${API_URL}/api/reports/district/${encodeURIComponent(selectedRegion)}/${encodeURIComponent(districtName)}?period=${selectedPeriod}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      const data = await response.json();
      setDistrictStats(data);
    } catch (err) {
      console.error("Erreur chargement stats district:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleHealthCenterClick = async (healthCenterName: string) => {
    if (!accessToken || !selectedRegion || !selectedDistrict) return;
    try {
      setLoading(true);
      setSelectedHealthCenter(healthCenterName);
      setDrillLevel("healthcenter");
      const response = await fetch(
        `${API_URL}/api/reports/healthcenter/${encodeURIComponent(selectedRegion)}/${encodeURIComponent(selectedDistrict)}/${encodeURIComponent(healthCenterName)}?period=${selectedPeriod}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      const data = await response.json();
      setHealthCenterStats(data);
    } catch (err) {
      console.error("Erreur chargement stats centre:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToNational = () => {
    setDrillLevel("national");
    setSelectedRegion(null);
    setSelectedDistrict(null);
    setSelectedHealthCenter(null);
    setRegionStats(null);
    setDistrictStats(null);
    setHealthCenterStats(null);
  };

  const handleBackToRegion = () => {
    setDrillLevel("region");
    setSelectedDistrict(null);
    setSelectedHealthCenter(null);
    setDistrictStats(null);
    setHealthCenterStats(null);
  };

  const handleBackToDistrict = () => {
    setDrillLevel("district");
    setSelectedHealthCenter(null);
    setHealthCenterStats(null);
  };

  if (loading) {
    return (
      <DashboardShell active="/dashboard/rapports">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="ml-3 text-gray-600">Chargement des statistiques...</span>
        </div>
      </DashboardShell>
    );
  }

  if (error && !stats) {
    return (
      <DashboardShell active="/dashboard/rapports">
        <div className="flex items-center justify-center h-96">
          <div className="text-red-600">Erreur: {error}</div>
        </div>
      </DashboardShell>
    );
  }

  const maxTrend = Math.max(...(stats?.monthlyTrend?.map((m) => m.count || m.value) || [1]), 1);
  const hasData = stats && stats.totalVaccinations > 0;

  // Si c'est un agent, afficher la vue agent
  if (user?.role === "AGENT") {
    return (
      <DashboardShell active="/dashboard/rapports">
        <div className="space-y-6">
          {/* En-tête */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Rapport d'Activité</h1>
              <p className="text-gray-600 mt-1">
                Statistiques et performance de votre centre de santé
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="1month">1 mois</option>
                <option value="3months">3 mois</option>
                <option value="6months">6 mois</option>
                <option value="1year">1 an</option>
              </select>
              <div className="text-sm text-gray-500">
                Mis à jour: {new Date().toLocaleDateString("fr-FR")}
              </div>
            </div>
          </div>

          {/* KPIs Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <Users className="h-8 w-8 opacity-80" />
                <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">Total</span>
              </div>
              <div className="text-3xl font-bold mb-1">{stats?.totalVaccinations || 0}</div>
              <div className="text-sm opacity-90">Vaccinations effectuées</div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <Calendar className="h-8 w-8 opacity-80" />
                <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">Ce mois</span>
              </div>
              <div className="text-3xl font-bold mb-1">{stats?.thisMonth || 0}</div>
              <div className="text-sm opacity-90">Vaccinations ce mois</div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="h-8 w-8 opacity-80" />
                <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">7 jours</span>
              </div>
              <div className="text-3xl font-bold mb-1">{stats?.thisWeek || 0}</div>
              <div className="text-sm opacity-90">Cette semaine</div>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <Activity className="h-8 w-8 opacity-80" />
                <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">Moyenne</span>
              </div>
              <div className="text-3xl font-bold mb-1">
                {Math.round((stats?.thisMonth || 0) / 30 * 7)}
              </div>
              <div className="text-sm opacity-90">Par semaine (moy.)</div>
            </div>
          </div>

          {/* Graphique tendance + État des stocks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tendance mensuelle */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Évolution mensuelle
              </h2>
              <div className="space-y-3">
                {stats?.monthlyTrend?.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-20 text-sm font-medium text-gray-700">{item.month}</div>
                    <div className="flex-1">
                      <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-end pr-2 text-white text-sm font-semibold"
                          style={{
                            width: (item.count || item.value) > 0
                              ? `${Math.max(((item.count || item.value) / maxTrend) * 100, 5)}%`
                              : "0%",
                            minWidth: (item.count || item.value) > 0 ? "40px" : "0",
                          }}
                        >
                          {(item.count || item.value) > 0 && (item.count || item.value)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* État des stocks */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-600" />
                État des stocks
              </h2>
              <div className="space-y-3">
                {stats?.stockStatus && stats.stockStatus.length > 0 ? (
                  stats.stockStatus.map((stock, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            stock.status === "critical"
                              ? "bg-red-500"
                              : stock.status === "warning"
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                        />
                        <span className="font-medium text-gray-900">{stock.vaccine}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-900">{stock.quantity}</span>
                        <span className="text-sm text-gray-500">doses</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">Aucun stock disponible</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activité récente */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              Activité récente
            </h2>
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Enfant</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Vaccin</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentActivity.map((activity, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(activity.date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {activity.child}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            {activity.vaccine}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            Complété
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Aucune vaccination effectuée récemment</p>
              </div>
            )}
          </div>
        </div>
      </DashboardShell>
    );
  }

  // Vue REGIONAL
  if (user?.role === "REGIONAL") {
    const maxTrend = Math.max(...(regionalStats?.monthlyTrend?.map((m) => m.count) || [1]), 1);
    const maxVaccinations = Math.max(...(regionalStats?.centerPerformance?.map((c) => c.vaccinations) || [1]), 1);

    return (
      <DashboardShell active="/dashboard/rapports">
        <div className="space-y-6">
          {/* En-tête */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-blue-600" />
                Rapports & Statistiques
              </h1>
              <p className="text-gray-600">Vue d'ensemble de la performance de votre région (par district)</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1month">1 mois</option>
                <option value="3months">3 mois</option>
                <option value="6months">6 mois</option>
                <option value="1year">1 an</option>
              </select>
            </div>
          </div>

          {/* Alertes */}
          {regionalStats?.alerts && regionalStats.alerts.length > 0 && (
            <div
              className={
                regionalStats.alerts.some((a) => a.severity === "high")
                  ? "bg-red-50 border-l-4 border-red-400 p-4 rounded-lg"
                  : "bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg"
              }
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={
                    regionalStats.alerts.some((a) => a.severity === "high")
                      ? "h-5 w-5 text-red-600 mt-0.5"
                      : "h-5 w-5 text-yellow-600 mt-0.5"
                  }
                />
                <div className="flex-1">
                  <h3
                    className={
                      regionalStats.alerts.some((a) => a.severity === "high")
                        ? "font-semibold text-red-900 mb-2"
                        : "font-semibold text-yellow-900 mb-2"
                    }
                  >
                    {regionalStats.alerts.length} alerte{regionalStats.alerts.length > 1 ? "s" : ""} importante
                    {regionalStats.alerts.length > 1 ? "s" : ""}
                  </h3>
                  <ul className="space-y-1">
                    {regionalStats.alerts.map((alert, idx) => (
                      <li
                        key={idx}
                        className={
                          alert.severity === "high"
                            ? "text-sm text-red-800 font-medium"
                            : "text-sm text-yellow-800"
                        }
                      >
                        {alert.severity === "high" ? "⚠️" : "•"} {alert.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <Building2 className="h-8 w-8 opacity-80" />
                <MapPin className="h-5 w-5 opacity-60" />
              </div>
              <div className="text-3xl font-bold mb-1">{regionalStats?.totalCenters || 0}</div>
              <div className="text-sm opacity-90">Districts actifs</div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <Users className="h-8 w-8 opacity-80" />
                <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">Total</span>
              </div>
              <div className="text-3xl font-bold mb-1">
                {(regionalStats?.totalVaccinations || 0).toLocaleString()}
              </div>
              <div className="text-sm opacity-90">Vaccinations effectuées</div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="h-8 w-8 opacity-80" />
                <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">Objectif: 90%</span>
              </div>
              <div className="text-3xl font-bold mb-1">{regionalStats?.coverageRate || 0}%</div>
              <div className="text-sm opacity-90">Taux de couverture</div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <Activity className="h-8 w-8 opacity-80" />
                <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded">En cours</span>
              </div>
              <div className="text-3xl font-bold mb-1">{regionalStats?.activeCampaigns || 0}</div>
              <div className="text-sm opacity-90">Campagnes actives</div>
            </div>
          </div>

          {/* Graphiques */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Évolution mensuelle */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
                Évolution mensuelle
              </h2>
              <div className="space-y-3">
                {regionalStats?.monthlyTrend?.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-20 text-sm font-medium text-gray-700">{item.month}</div>
                    <div className="flex-1">
                      <div className="h-10 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-end pr-3 text-white text-sm font-bold"
                          style={{
                            width: item.count > 0 ? `${Math.max((item.count / maxTrend) * 100, 5)}%` : "0%",
                            minWidth: item.count > 0 ? "50px" : "0",
                          }}
                        >
                          {item.count > 0 && item.count.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Distribution par vaccin */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-green-600" />
                Répartition par vaccin
              </h2>
              {regionalStats?.vaccineDistribution && regionalStats.vaccineDistribution.length > 0 ? (
                <div className="space-y-4">
                  {regionalStats.vaccineDistribution.map((vaccine, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-gray-900">{vaccine.vaccine}</span>
                        <span className="text-sm font-bold text-gray-700">
                          {vaccine.total.toLocaleString()} ({vaccine.percentage}%)
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full"
                          style={{ width: `${Math.max(vaccine.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Aucune donnée de distribution disponible</p>
                </div>
              )}
            </div>
          </div>

          {/* Performance des districts */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-green-600" />
              Performance par district
            </h2>
            {regionalStats?.centerPerformance && regionalStats.centerPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">District</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Vaccinations</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Couverture</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Performance</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">État stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionalStats.centerPerformance.map((center, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="py-4 px-4">
                          <div className="font-medium text-gray-900">{center.name}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-2xl font-bold text-gray-900">
                            {center.vaccinations.toLocaleString()}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold text-gray-900">{center.coverage}%</div>
                            <div className="flex-1 max-w-24">
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    center.coverage >= 90
                                      ? "bg-green-500"
                                      : center.coverage >= 75
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                  }`}
                                  style={{ width: `${center.coverage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="w-full bg-gray-100 rounded-lg h-8 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center text-white text-xs font-bold"
                              style={{
                                width: `${Math.max((center.vaccinations / maxVaccinations) * 100, 5)}%`,
                                minWidth: center.vaccinations > 0 ? "40px" : "0",
                              }}
                            >
                              {center.vaccinations > 0 &&
                                ((center.vaccinations / maxVaccinations) * 100).toFixed(0) + "%"}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              center.stock === "critical"
                                ? "bg-red-100 text-red-700"
                                : center.stock === "warning"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {center.stock === "critical"
                              ? "Critique"
                              : center.stock === "warning"
                              ? "Attention"
                              : "Bon"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Aucun district dans cette région</p>
              </div>
            )}
          </div>
        </div>
      </DashboardShell>
    );
  }

  // Vue NATIONAL avec drill-down
  if (user?.role === "NATIONAL") {
    const maxTrend = Math.max(...(nationalStats?.monthlyVaccinations?.map((m) => m.value) || [1]), 1);
    const maxVaccinations = Math.max(
      ...(nationalStats?.regionPerformance?.map((c) => c.vaccinations) || [1]),
      1
    );

    return (
      <DashboardShell active="/dashboard/rapports">
        <div className="space-y-6">
          {/* Breadcrumb et en-tête */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              {/* Breadcrumb */}
              {(drillLevel === "region" || drillLevel === "district" || drillLevel === "healthcenter") && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                  <button
                    onClick={handleBackToNational}
                    className="hover:text-green-600 transition font-medium"
                  >
                    National
                  </button>
                  {selectedRegion && (
                    <>
                      <ChevronRight className="h-4 w-4" />
                      <button
                        onClick={drillLevel !== "region" ? handleBackToRegion : undefined}
                        className={`transition font-medium ${
                          drillLevel === "region"
                            ? "font-semibold text-green-600"
                            : "hover:text-green-600 cursor-pointer"
                        }`}
                      >
                        {selectedRegion}
                      </button>
                    </>
                  )}
                  {selectedDistrict && (
                    <>
                      <ChevronRight className="h-4 w-4" />
                      <button
                        onClick={drillLevel === "healthcenter" ? handleBackToDistrict : undefined}
                        className={`transition font-medium ${
                          drillLevel === "district"
                            ? "font-semibold text-green-600"
                            : "hover:text-green-600 cursor-pointer"
                        }`}
                      >
                        {selectedDistrict}
                      </button>
                    </>
                  )}
                  {selectedHealthCenter && (
                    <>
                      <ChevronRight className="h-4 w-4" />
                      <span className="font-semibold text-green-600">{selectedHealthCenter}</span>
                    </>
                  )}
                </div>
              )}
              <h1 className="text-3xl font-bold text-gray-900">
                {drillLevel === "national" && "Rapports Nationaux Avancés"}
                {drillLevel === "region" && `Région: ${selectedRegion}`}
                {drillLevel === "district" && `District: ${selectedDistrict}`}
                {drillLevel === "healthcenter" && `Centre: ${selectedHealthCenter}`}
              </h1>
              <p className="text-gray-600 mt-1">
                {drillLevel === "national" && "Analyse complète et détaillée de la vaccination"}
                {drillLevel === "region" && "Statistiques détaillées par district"}
                {drillLevel === "district" && "Centres de santé du district"}
                {drillLevel === "healthcenter" && "Détails du centre de santé avec agents en aperçu"}
              </p>
            </div>
            <div className="flex gap-3">
              {drillLevel === "healthcenter" && (
                <button
                  onClick={handleBackToDistrict}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour District
                </button>
              )}
              {drillLevel === "district" && (
                <button
                  onClick={handleBackToRegion}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour Région
                </button>
              )}
              {drillLevel === "region" && (
                <button
                  onClick={handleBackToNational}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour National
                </button>
              )}
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="1month">1 mois</option>
                <option value="3months">3 mois</option>
                <option value="6months">6 mois</option>
                <option value="1year">1 an</option>
              </select>
            </div>
          </div>

          {/* Onglets de navigation (uniquement au niveau national) */}
          {drillLevel === "national" && (
            <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
          )}

          {/* Affichage conditionnel selon l'onglet et le niveau */}
          {drillLevel === "national" && activeTab === "overview" && nationalStats && (
            <>
              {/* Alertes stocks critiques */}
              {nationalStats.summary.criticalStocks > 0 && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg animate-pulse">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-900 mb-1">⚠️ Alerte stocks critiques</h3>
                      <p className="text-sm text-red-800">
                        {nationalStats.summary.criticalStocks} stock
                        {nationalStats.summary.criticalStocks > 1 ? "s" : ""} critique
                        {nationalStats.summary.criticalStocks > 1 ? "s" : ""} détecté
                        {nationalStats.summary.criticalStocks > 1 ? "s" : ""} (quantité &lt; 30 doses)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* KPIs principaux */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="h-8 w-8 opacity-90" />
                    <div className="text-xs bg-white/20 px-2 py-1 rounded">Total</div>
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {nationalStats.summary.totalChildren.toLocaleString()}
                  </div>
                  <div className="text-sm opacity-90">Enfants enregistrés</div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <Activity className="h-8 w-8 opacity-90" />
                    <div className="text-xs bg-white/20 px-2 py-1 rounded">Effectuées</div>
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {nationalStats.summary.totalVaccinations.toLocaleString()}
                  </div>
                  <div className="text-sm opacity-90">Vaccinations totales</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="h-8 w-8 opacity-90" />
                    <div className="text-xs bg-white/20 px-2 py-1 rounded">
                      {nationalStats.summary.coverageRate >= 90
                        ? "Excellent"
                        : nationalStats.summary.coverageRate >= 75
                        ? "Bon"
                        : "Faible"}
                    </div>
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {nationalStats.summary.coverageRate.toFixed(1)}%
                  </div>
                  <div className="text-sm opacity-90">Taux de couverture</div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <MapPin className="h-8 w-8 opacity-90" />
                    <div className="text-xs bg-white/20 px-2 py-1 rounded">Actives</div>
                  </div>
                  <div className="text-3xl font-bold mb-1">{nationalStats.summary.campaigns}</div>
                  <div className="text-sm opacity-90">Campagnes en cours</div>
                </div>
              </div>

              {/* Statistiques secondaires */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <MapPin className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {nationalStats.summary.totalRegions}
                      </div>
                      <div className="text-sm text-gray-600">Régions actives</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Building2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {nationalStats.summary.totalHealthCenters}
                      </div>
                      <div className="text-sm text-gray-600">Centres de santé</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <Package className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {nationalStats.summary.criticalStocks}
                      </div>
                      <div className="text-sm text-gray-600">Stocks critiques</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Graphiques principaux */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Évolution mensuelle */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    Évolution mensuelle
                  </h2>
                  <div className="space-y-3">
                    {nationalStats.monthlyVaccinations.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-20 text-sm font-medium text-gray-700">{item.month}</div>
                        <div className="flex-1">
                          <div className="h-10 bg-gray-100 rounded-lg overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-end pr-3 text-white text-sm font-bold"
                              style={{
                                width: item.value > 0 ? `${Math.max((item.value / maxTrend) * 100, 5)}%` : "0%",
                                minWidth: item.value > 0 ? "50px" : "0",
                              }}
                            >
                              {item.value > 0 && item.value.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Distribution par vaccin */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-green-600" />
                    Répartition par vaccin
                  </h2>
                  {nationalStats.coverageByVaccine && nationalStats.coverageByVaccine.length > 0 ? (
                    <div className="space-y-4">
                      {nationalStats.coverageByVaccine.map((vaccine, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-gray-900">{vaccine.name}</span>
                            <span className="text-sm font-bold text-gray-700">
                              {vaccine.value.toLocaleString()} ({vaccine.percentage}%)
                            </span>
                          </div>
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full"
                              style={{ width: `${Math.max(vaccine.percentage, 2)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">Aucune donnée de distribution disponible</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Top/Pire régions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top 5 meilleures régions */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-md p-6 border border-green-200">
                  <h2 className="text-xl font-bold text-green-900 mb-4 flex items-center gap-2">
                    🏆 Top 5 meilleures régions
                  </h2>
                  {nationalStats.top5BestRegions && nationalStats.top5BestRegions.length > 0 ? (
                    <div className="space-y-3">
                      {nationalStats.top5BestRegions.map((region, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleRegionClick(region.region)}
                          className="flex items-center justify-between bg-white/60 rounded-lg p-3 cursor-pointer hover:bg-white hover:shadow-md transition-all transform hover:scale-105"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                              {idx + 1}
                            </div>
                            <span className="font-medium text-gray-900">{region.region}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold text-green-700">
                              {region.coverage.toFixed(1)}%
                            </div>
                            <ChevronRight className="h-5 w-5 text-green-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-4">Aucune donnée disponible</p>
                  )}
                </div>

                {/* Top 5 pires régions */}
                <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl shadow-md p-6 border border-red-200">
                  <h2 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-2">
                    ⚠️ Régions nécessitant attention
                  </h2>
                  {nationalStats.top5WorstRegions && nationalStats.top5WorstRegions.length > 0 ? (
                    <div className="space-y-3">
                      {nationalStats.top5WorstRegions.map((region, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleRegionClick(region.region)}
                          className="flex items-center justify-between bg-white/60 rounded-lg p-3 cursor-pointer hover:bg-white hover:shadow-md transition-all transform hover:scale-105"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                              ⚠
                            </div>
                            <span className="font-medium text-gray-900">{region.region}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold text-red-700">
                              {region.coverage.toFixed(1)}%
                            </div>
                            <ChevronRight className="h-5 w-5 text-red-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-4">Aucune donnée disponible</p>
                  )}
                </div>
              </div>

              {/* Performance détaillée par région */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  Performance détaillée par région
                </h2>
                {nationalStats.regionPerformance && nationalStats.regionPerformance.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Région</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Enfants</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Vaccinations</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Couverture</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Performance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nationalStats.regionPerformance.map((region, idx) => (
                          <tr
                            key={idx}
                            onClick={() => handleRegionClick(region.region)}
                            className="border-b border-gray-100 hover:bg-blue-50 transition cursor-pointer"
                          >
                            <td className="py-4 px-4">
                              <div className="font-medium text-blue-600 hover:text-blue-800 flex items-center gap-2">
                                {region.region}
                                <ChevronRight className="h-4 w-4" />
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="text-gray-700">{region.totalChildren.toLocaleString()}</div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-medium text-gray-900">
                                {region.vaccinations.toLocaleString()}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 max-w-[120px]">
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        region.coverage >= 90
                                          ? "bg-green-500"
                                          : region.coverage >= 75
                                          ? "bg-blue-500"
                                          : region.coverage >= 60
                                          ? "bg-yellow-500"
                                          : "bg-red-500"
                                      }`}
                                      style={{ width: `${region.coverage}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="text-sm font-bold text-gray-700">
                                  {region.coverage.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="w-full bg-gray-100 rounded-lg h-8 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center text-white text-xs font-bold"
                                  style={{
                                    width: `${Math.max((region.vaccinations / maxVaccinations) * 100, 5)}%`,
                                    minWidth: region.vaccinations > 0 ? "40px" : "0",
                                  }}
                                >
                                  {region.vaccinations > 0 &&
                                    ((region.vaccinations / maxVaccinations) * 100).toFixed(0) + "%"}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">Aucune donnée régionale disponible</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Onglet Régions */}
          {drillLevel === "national" && activeTab === "regions" && nationalStats && (
            <RegionsTab
              regionPerformance={nationalStats.regionPerformance}
              onRegionClick={handleRegionClick}
            />
          )}

          {/* Vue détaillée d'une région */}
          {drillLevel === "region" && regionStats && (
            <RegionDetailView stats={regionStats} onDistrictClick={handleDistrictClick} />
          )}

          {/* Vue détaillée d'un district */}
          {drillLevel === "district" && districtStats && (
            <DistrictDetailView stats={districtStats} onHealthCenterClick={handleHealthCenterClick} />
          )}

          {/* Vue détaillée d'un centre de santé */}
          {drillLevel === "healthcenter" && healthCenterStats && (
            <HealthCenterDetailView stats={healthCenterStats} />
          )}

          {/* Message si pas de données */}
          {!nationalStats &&
            !regionStats &&
            !districtStats &&
            !healthCenterStats &&
            !loading &&
            drillLevel === "national" && (
              <div className="text-center py-12">
                <p className="text-gray-500">Aucune donnée disponible</p>
              </div>
            )}
        </div>
      </DashboardShell>
    );
  }

  // Fallback pour les autres rôles
  return (
    <DashboardShell active="/dashboard/rapports">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Rapports</h1>
        <p className="text-gray-600">Page en cours de développement pour {user?.role}</p>
      </div>
    </DashboardShell>
  );
}

