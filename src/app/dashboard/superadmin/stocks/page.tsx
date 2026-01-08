"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Loader2, MapPin, Building2, Hospital, ArrowLeft } from "lucide-react";
import DashboardShell from "@/app/dashboard/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import dynamic from "next/dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

// Importer dynamiquement les composants stocks
const StocksModule = dynamic(() => import("@/app/dashboard/stocks/page"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
  ),
});

type Region = {
  id: string;
  name: string;
};

type District = {
  id: string;
  name: string;
  commune: {
    region: {
      id: string;
      name: string;
    };
  };
};

type HealthCenter = {
  id: string;
  name: string;
  district: {
    id: string;
    name: string;
    commune: {
      region: {
        id: string;
        name: string;
      };
    };
  };
};

export default function SuperAdminStocksPage() {
  const { accessToken } = useAuth();
  const [step, setStep] = useState<"select" | "view">("select");
  const [selectedEntity, setSelectedEntity] = useState<{
    type: "national" | "region" | "district" | "healthcenter";
    id?: string;
    name?: string;
  } | null>(null);

  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [healthCenters, setHealthCenters] = useState<HealthCenter[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("");
  const [selectedHealthCenterId, setSelectedHealthCenterId] = useState<string>("");

  // Charger les régions
  useEffect(() => {
    const fetchRegions = async () => {
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
          setRegions(regionsList);
        }
      } catch (err) {
        console.error("Erreur chargement régions:", err);
      }
    };
    fetchRegions();
  }, [accessToken]);

  // Charger les districts quand une région est sélectionnée
  useEffect(() => {
    const fetchDistricts = async () => {
      if (!accessToken || !selectedRegionId) {
        setDistricts([]);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(
          `${API_URL}/api/district?regionId=${selectedRegionId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
        if (res.ok) {
          const data = await res.json();
          const districtsList = Array.isArray(data) 
            ? data 
            : Array.isArray(data.items) 
              ? data.items 
              : Array.isArray(data.districts) 
                ? data.districts 
                : [];
          setDistricts(districtsList);
        }
      } catch (err) {
        console.error("Erreur chargement districts:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDistricts();
  }, [accessToken, selectedRegionId]);

  // Charger les centres quand un district est sélectionné
  useEffect(() => {
    const fetchHealthCenters = async () => {
      if (!accessToken || !selectedDistrictId) {
        setHealthCenters([]);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(
          `${API_URL}/api/healthCenter?districtId=${selectedDistrictId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
        if (res.ok) {
          const data = await res.json();
          const centersList = Array.isArray(data) 
            ? data 
            : Array.isArray(data.items) 
              ? data.items 
              : Array.isArray(data.healthCenters) 
                ? data.healthCenters 
                : [];
          setHealthCenters(centersList);
        }
      } catch (err) {
        console.error("Erreur chargement centres:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHealthCenters();
  }, [accessToken, selectedDistrictId]);

  const handleSelectNational = () => {
    setSelectedEntity({ type: "national", name: "Stock National" });
    setStep("view");
  };

  const handleSelectRegion = (regionId: string) => {
    setSelectedRegionId(regionId);
    // Réinitialiser les sélections suivantes
    setSelectedDistrictId("");
    setSelectedHealthCenterId("");
  };

  const handleSelectDistrict = (districtId: string) => {
    setSelectedDistrictId(districtId);
    // Réinitialiser la sélection du centre
    setSelectedHealthCenterId("");
  };

  const handleSelectHealthCenter = (healthCenterId: string) => {
    setSelectedHealthCenterId(healthCenterId);
  };

  const handleValidate = () => {
    if (selectedHealthCenterId) {
      const center = healthCenters.find((c) => c.id === selectedHealthCenterId);
      if (center) {
        setSelectedEntity({
          type: "healthcenter",
          id: selectedHealthCenterId,
          name: center.name,
        });
        setStep("view");
      }
    } else if (selectedDistrictId) {
      const district = districts.find((d) => d.id === selectedDistrictId);
      if (district) {
        setSelectedEntity({
          type: "district",
          id: selectedDistrictId,
          name: district.name,
        });
        setStep("view");
      }
    } else if (selectedRegionId) {
      const region = regions.find((r) => r.id === selectedRegionId);
      if (region) {
        setSelectedEntity({ type: "region", id: selectedRegionId, name: region.name });
        setStep("view");
      }
    }
  };

  const handleBack = () => {
    setStep("select");
    setSelectedEntity(null);
    setSelectedRegionId("");
    setSelectedDistrictId("");
    setSelectedHealthCenterId("");
  };

  if (step === "view" && selectedEntity) {
    // Créer un wrapper qui injecte les paramètres d'entité dans les appels API
    const StocksWrapper = () => {
      const { accessToken } = useAuth();
      const [mounted, setMounted] = useState(false);
      const [StocksComponent, setStocksComponent] = useState<React.ComponentType | null>(null);

      // Injecter le style pour annuler le padding du DashboardShell interne, masquer le TopBar et la Sidebar
      // Ce useEffect doit toujours être appelé pour respecter les règles des hooks
      useEffect(() => {
        const styleId = 'stocks-wrapper-superadmin-style';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          /* Masquer la sidebar dans le DashboardShell interne */
          .stocks-wrapper-superadmin aside {
            display: none !important;
          }
          .stocks-wrapper-superadmin > div > main > section {
            padding: 0 !important;
            margin: 0 !important;
          }
          .stocks-wrapper-superadmin > div > main {
            margin-left: 0 !important;
          }
          .stocks-wrapper-superadmin > div {
            margin-left: 0 !important;
          }
          /* Modifier le header pour afficher le titre et le bouton */
          .stocks-wrapper-superadmin > div > main > header {
            display: flex !important;
            padding: 1.5rem 1.5rem !important;
            border-bottom: 1px solid rgb(226 232 240) !important;
            background-color: white !important;
          }
        `;
        document.head.appendChild(style);
        
        return () => {
          const existingStyle = document.getElementById(styleId);
          if (existingStyle) {
            document.head.removeChild(existingStyle);
          }
        };
      }, []);

      // Intercepter les appels fetch AVANT de charger le composant
      useEffect(() => {
        const originalFetch = window.fetch;
        const fetchInterceptor = async (input: RequestInfo | URL, init?: RequestInit) => {
          let url: string;
          if (typeof input === 'string') {
            url = input;
          } else if (input instanceof URL) {
            url = input.toString();
          } else if (input instanceof Request) {
            url = input.url;
          } else {
            url = (input as any).url || '';
          }
          
          const apiUrl = API_URL.replace(/\/$/, '');
          
          // Vérifier si c'est un appel à l'API de stock ou healthCenter
          if (url.startsWith(apiUrl) && (url.includes('/api/stock/') || url.includes('/api/healthCenter'))) {
            try {
              const urlObj = new URL(url);
              let modifiedInit = init ? { ...init } : {};
              
              // Ajouter les paramètres d'entité selon le type
              if (selectedEntity.type === "region" && selectedEntity.id) {
                urlObj.searchParams.set('regionId', selectedEntity.id);
                
                // Pour les requêtes POST et PUT, aussi ajouter regionId dans le body
                if ((modifiedInit.method === 'POST' || modifiedInit.method === 'PUT') && modifiedInit.body) {
                  try {
                    const body = typeof modifiedInit.body === 'string' 
                      ? JSON.parse(modifiedInit.body) 
                      : modifiedInit.body;
                    
                    if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
                      (body as any).regionId = selectedEntity.id;
                      modifiedInit.body = JSON.stringify(body);
                    }
                  } catch (err) {
                    // Si le body n'est pas du JSON, on ne le modifie pas
                    console.warn("Impossible de modifier le body de la requête POST/PUT:", err);
                  }
                }
              } else if (selectedEntity.type === "district" && selectedEntity.id) {
                urlObj.searchParams.set('districtId', selectedEntity.id);
                // Pour healthCenter, aussi injecter districtId
                if (url.includes('/api/healthCenter')) {
                  urlObj.searchParams.set('districtId', selectedEntity.id);
                }
                
                // Pour les requêtes POST et PUT, aussi ajouter districtId dans le body
                if ((modifiedInit.method === 'POST' || modifiedInit.method === 'PUT') && modifiedInit.body) {
                  try {
                    const body = typeof modifiedInit.body === 'string' 
                      ? JSON.parse(modifiedInit.body) 
                      : modifiedInit.body;
                    
                    if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
                      (body as any).districtId = selectedEntity.id;
                      modifiedInit.body = JSON.stringify(body);
                    }
                  } catch (err) {
                    // Si le body n'est pas du JSON, on ne le modifie pas
                    console.warn("Impossible de modifier le body de la requête POST/PUT:", err);
                  }
                }
              } else if (selectedEntity.type === "healthcenter" && selectedEntity.id) {
                urlObj.searchParams.set('healthCenterId', selectedEntity.id);
                
                // Pour les requêtes POST et PUT, aussi ajouter healthCenterId dans le body
                if ((modifiedInit.method === 'POST' || modifiedInit.method === 'PUT') && modifiedInit.body) {
                  try {
                    const body = typeof modifiedInit.body === 'string' 
                      ? JSON.parse(modifiedInit.body) 
                      : modifiedInit.body;
                    
                    if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
                      (body as any).healthCenterId = selectedEntity.id;
                      modifiedInit.body = JSON.stringify(body);
                    }
                  } catch (err) {
                    // Si le body n'est pas du JSON, on ne le modifie pas
                    console.warn("Impossible de modifier le body de la requête POST/PUT:", err);
                  }
                }
              }
              
              const modifiedUrl = urlObj.toString();
              
              if (typeof input === 'string') {
                return originalFetch(modifiedUrl, modifiedInit);
              } else if (input instanceof URL) {
                return originalFetch(new URL(modifiedUrl), modifiedInit);
              } else if (input instanceof Request) {
                return originalFetch(new Request(modifiedUrl, { ...input, ...modifiedInit }), modifiedInit);
              } else {
                return originalFetch(modifiedUrl, modifiedInit);
              }
            } catch (err) {
              console.error("Erreur interception fetch:", err);
              return originalFetch(input, init);
            }
          }
          
          return originalFetch(input, init);
        };
        
        window.fetch = fetchInterceptor as typeof fetch;

        return () => {
          window.fetch = originalFetch;
        };
      }, [selectedEntity.type, selectedEntity.id]);

      // Charger le module et extraire le bon composant
      useEffect(() => {
        setMounted(true);
        
        import("@/app/dashboard/stocks/page").then((module) => {
          let Component: React.ComponentType | null = null;
          
          if (selectedEntity.type === "national") {
            Component = module.NationalStocksPage;
          } else if (selectedEntity.type === "region" && selectedEntity.id) {
            Component = module.RegionalStocksPage;
          } else if (selectedEntity.type === "district" && selectedEntity.id) {
            Component = module.DistrictStocksPage;
          } else if (selectedEntity.type === "healthcenter" && selectedEntity.id) {
            Component = module.AgentAdminStocksPage;
          }
          
          setStocksComponent(() => Component);
        }).catch((err) => {
          console.error("Erreur chargement composant stocks:", err);
        });
      }, [selectedEntity.type, selectedEntity.id]);

      // Injecter le titre et le bouton dans le header du DashboardShell interne
      // Ce useEffect doit toujours être appelé pour respecter les règles des hooks
      useEffect(() => {
        if (!mounted || !StocksComponent) return;
        
        // Attendre que le DOM soit prêt
        const timer = setTimeout(() => {
          const header = document.querySelector('.stocks-wrapper-superadmin > div > main > header');
          if (header) {
            header.innerHTML = `
              <div class="flex items-center justify-between w-full">
                <div>
                  <h2 class="text-2xl font-semibold text-slate-900">
                    Stocks - ${selectedEntity.name}
                  </h2>
                  <p class="text-sm text-slate-500">
                    Gestion des stocks pour ${selectedEntity.name}
                  </p>
                </div>
                <button
                  type="button"
                  id="change-entity-btn"
                  class="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Changer d'entité
                </button>
              </div>
            `;
            
            // Ajouter l'événement au bouton
            const btn = document.getElementById('change-entity-btn');
            if (btn) {
              btn.addEventListener('click', handleBack);
            }
          }
        }, 100);
        
        return () => {
          clearTimeout(timer);
          const btn = document.getElementById('change-entity-btn');
          if (btn) {
            btn.removeEventListener('click', handleBack);
          }
        };
      }, [mounted, StocksComponent, selectedEntity.name, handleBack]);

      if (!mounted || !StocksComponent) {
        return (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        );
      }

      return (
        <div className="stocks-wrapper-superadmin">
          <StocksComponent />
        </div>
      );
    };

    return (
      <DashboardShell active="/dashboard/superadmin/stocks">
        <div className="-mx-2 md:-mx-8 -mt-2 md:-mt-8">
          <div className="rounded-t-2xl md:rounded-t-3xl border-t border-l border-r border-slate-200 bg-white">
            <StocksWrapper />
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell active="/dashboard/superadmin/stocks">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Gestion des stocks</h2>
          <p className="text-sm text-slate-500">
            Sélectionnez l'entité dont vous souhaitez gérer les stocks
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Option National */}
          <button
            type="button"
            onClick={handleSelectNational}
            className="flex flex-col items-center gap-4 rounded-3xl border-2 border-slate-200 bg-white p-6 text-center transition hover:border-emerald-500 hover:bg-emerald-50"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <Package className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Stock National</h3>
              <p className="mt-1 text-xs text-slate-500">Voir et gérer le stock national</p>
            </div>
          </button>

          {/* Option Région */}
          <div className="rounded-3xl border-2 border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <MapPin className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <h3 className="mb-4 text-center font-semibold text-slate-900">Région</h3>
            <select
              value={selectedRegionId}
              onChange={(e) => {
                handleSelectRegion(e.target.value);
              }}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">Sélectionner une région</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>

          {/* Option District */}
          <div className="rounded-3xl border-2 border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                <Building2 className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            <h3 className="mb-4 text-center font-semibold text-slate-900">District</h3>
            <select
              value={selectedDistrictId}
              onChange={(e) => {
                handleSelectDistrict(e.target.value);
              }}
              disabled={!selectedRegionId || districts.length === 0}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:opacity-50"
            >
              <option value="">
                {!selectedRegionId
                  ? "Sélectionnez d'abord une région"
                  : districts.length === 0
                    ? "Aucun district"
                    : "Sélectionner un district"}
              </option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </select>
          </div>

          {/* Option Centre de santé */}
          <div className="rounded-3xl border-2 border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <Hospital className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <h3 className="mb-4 text-center font-semibold text-slate-900">Centre de santé</h3>
            <select
              value={selectedHealthCenterId}
              onChange={(e) => {
                handleSelectHealthCenter(e.target.value);
              }}
              disabled={!selectedDistrictId || healthCenters.length === 0}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:opacity-50"
            >
              <option value="">
                {!selectedDistrictId
                  ? "Sélectionnez d'abord un district"
                  : healthCenters.length === 0
                    ? "Aucun centre"
                    : "Sélectionner un centre"}
              </option>
              {healthCenters.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bouton Valider */}
        {(selectedRegionId || selectedDistrictId || selectedHealthCenterId) && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleValidate}
              disabled={!selectedRegionId && !selectedDistrictId && !selectedHealthCenterId}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Valider et voir les stocks
            </button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

