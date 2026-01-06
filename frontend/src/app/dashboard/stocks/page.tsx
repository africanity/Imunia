"use client";

import { FormEvent, useEffect, useMemo, useState, useCallback } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Info,
  Loader2,
  PackageOpen,
  PenSquare,
  Plus,
  Search,
  Syringe,
  Trash2,
  User,
  X,
} from "lucide-react";
import DashboardShell from "@/app/dashboard/components/DashboardShell";
import StatCard from "@/app/dashboard/components/StatCard";
import { AppointmentCancellationModal } from "@/app/dashboard/components/AppointmentCancellationModal";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

const LOW_STOCK_THRESHOLD = 50;

type StockStats = {
  totalLots: number;
  totalQuantity: number;
  lowStockCount: number;
  threshold: number;
  expiredLots: number;
};

const emptyStats: StockStats = {
  totalLots: 0,
  totalQuantity: 0,
  lowStockCount: 0,
  threshold: LOW_STOCK_THRESHOLD,
  expiredLots: 0,
};

type VaccineInfo = {
  id: string;
  name: string;
  description: string;
  dosesRequired: string;
};

type VaccineResponse =
  | {
      vaccines?: VaccineInfo[];
    }
  | VaccineInfo[];

type NationalStock = {
  id: string;
  vaccineId: string;
  quantity: number | null;
  vaccine: VaccineInfo;
  hasExpiredLot?: boolean;
  nearestExpiration?: string | null;
  lotCount?: number;
  expiredLotCount?: number;
  expiredQuantity?: number;
};

type NationalStockResponse = {
  national?: NationalStock[];
};

type LotItem = {
  id: string;
  vaccineId: string;
  quantity: number;
  remainingQuantity: number;
  distributedQuantity: number;
  expiration: string;
  status: "VALID" | "EXPIRED";
  sourceLotId: string | null;
  derivedCount: number;
  reservedQuantity?: number;
};

type LotResponse = {
  lots: LotItem[];
  totalRemaining: number;
};

type LotModalContext = {
  vaccineId: string;
  vaccineName: string;
  ownerLabel?: string | null;
  ownerId?: string | null;
};

type PendingTransfer = {
  id: string;
  vaccineId: string;
  vaccine: VaccineInfo;
  fromType: string;
  fromId: string | null;
  toType: string;
  toId: string | null;
  toName?: string | null;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  createdAt: string;
  confirmedAt: string | null;
  confirmedById: string | null;
  lots: Array<{
    id: string;
    lotId: string;
    quantity: number;
    lot: {
      id: string;
      expiration: string;
      quantity: number;
      remainingQuantity: number;
      status?: string;
    } | null;
  }>;
};

type TransferHistoryItem = {
  id: string;
  vaccineId: string;
  vaccineName: string;
  fromType: string;
  fromId: string | null;
  fromName: string | null;
  toType: string;
  toId: string | null;
  toName: string | null;
  quantity: number;
  sentAt: string;
  confirmedAt: string | null;
  confirmedById: string | null;
  confirmedByName: string | null;
  lotExpiration: string | null;
  lotStatus: string | null;
  status: string;
  createdAt: string;
};

const formatExpirationDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatEntityName = (type: string, name: string | null | undefined): string => {
  if (!name) {
    // Si pas de nom, on retourne juste le type
    switch (type) {
      case "NATIONAL":
        return "National";
      case "REGIONAL":
        return "Région";
      case "DISTRICT":
        return "District";
      case "HEALTHCENTER":
        return "Centre de santé";
      default:
        return "Inconnu";
    }
  }
  
  // Si on a un nom, on retourne "Type: Nom"
  switch (type) {
    case "NATIONAL":
      return `National: ${name}`;
    case "REGIONAL":
      return `Région: ${name}`;
    case "DISTRICT":
      return `District: ${name}`;
    case "HEALTHCENTER":
      return `Centre de santé: ${name}`;
    default:
      return name;
  }
};

const isDateExpired = (value: string) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(value);
  return target < now;
};

type Region = {
  id: string;
  name: string;
};

type RegionsResponse =
  | {
      regions?: Region[];
    }
  | Region[];

export function NationalStocksPage() {
  const { accessToken, user } = useAuth();
  const canAdjust = user?.role === "NATIONAL" || user?.role === "SUPERADMIN";

  const [stocks, setStocks] = useState<NationalStock[]>([]);
  const [vaccines, setVaccines] = useState<VaccineInfo[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createVaccineId, setCreateVaccineId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateContext, setUpdateContext] = useState<{ vaccineId: string; vaccineName: string; currentQuantity: number } | null>(null);
  const [updateQuantity, setUpdateQuantity] = useState<string>("");
  const [updateMode, setUpdateMode] = useState<"reduce" | "add">("add");
  
  // États pour la diminution par lots
  const [reduceQuantity, setReduceQuantity] = useState<string>("");
  const [reduceRemaining, setReduceRemaining] = useState<number>(0);
  const [reduceLots, setReduceLots] = useState<LotItem[]>([]);
  const [reduceLoading, setReduceLoading] = useState(false);
  const [reduceError, setReduceError] = useState<string | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [reduceLotsLoaded, setReduceLotsLoaded] = useState(false);
  const [addQuantity, setAddQuantity] = useState<string>("");
  const [addQuantityError, setAddQuantityError] = useState<string | null>(null);
  const [addExpiration, setAddExpiration] = useState<string>("");
  const [updateExpiration, setUpdateExpiration] = useState<string>("");
  const [updating, setUpdating] = useState(false);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferContext, setTransferContext] = useState<{ vaccineId: string; vaccineName: string } | null>(null);
  const [transferRegionId, setTransferRegionId] = useState<string>("");
  const [transferQuantity, setTransferQuantity] = useState<string>("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [pendingRegionalCreation, setPendingRegionalCreation] = useState(false);

  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [lotContext, setLotContext] = useState<{ vaccineId: string; vaccineName: string } | null>(null);
  const [lotItems, setLotItems] = useState<LotItem[]>([]);
  const [lotTotalRemaining, setLotTotalRemaining] = useState(0);
  const [lotLoading, setLotLoading] = useState(false);
  const [lotError, setLotError] = useState<string | null>(null);
  const [lotDeletingId, setLotDeletingId] = useState<string | null>(null);
  const [nationalDeletingId, setNationalDeletingId] = useState<string | null>(null);

  const [stats, setStats] = useState<StockStats>(emptyStats);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // États pour les onglets
  const [activeTab, setActiveTab] = useState<"stocks" | "pending-received" | "pending-sent" | "history">("stocks");
  
  // États pour les envois en attente (reçus) - toujours vide pour NATIONAL
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [pendingTransfersLoading, setPendingTransfersLoading] = useState(false);
  
  // États pour les envois en cours (envoyés)
  const [sentTransfers, setSentTransfers] = useState<PendingTransfer[]>([]);
  const [sentTransfersLoading, setSentTransfersLoading] = useState(false);
  const [cancellingTransferId, setCancellingTransferId] = useState<string | null>(null);
  
  // États pour l'historique
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [historyFilters, setHistoryFilters] = useState({
    vaccineId: "",
    fromType: "",
    toType: "",
    sentStartDate: "",
    sentEndDate: "",
    confirmedStartDate: "",
    confirmedEndDate: "",
    search: "",
  });

  const [legendExpanded, setLegendExpanded] = useState(false);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentQuantityValue = updateContext?.currentQuantity ?? 0;
  const parsedUpdateQuantity = Number(updateQuantity);
  const parsedReduceQuantity = Number(reduceQuantity);

  const fetchNationalStats = useCallback(async () => {
    if (!accessToken) {
      setStats(emptyStats);
      setStatsLoading(false);
      return;
    }

    try {
      setStatsLoading(true);
      setStatsError(null);

      const response = await fetch(`${API_URL}/api/stock/stats/national`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const payload = (await response.json()) as StockStats;
      setStats(payload);
    } catch (error) {
      console.error("Erreur récupération stats nationales:", error);
      setStats(emptyStats);
      setStatsError(
        error instanceof Error
          ? error.message
          : "Impossible de charger les statistiques nationales"
      );
    } finally {
      setStatsLoading(false);
    }
  }, [accessToken]);

  const fetchNationalStocks = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [stockRes, vaccineRes, regionsRes] = await Promise.all([
        fetch(`${API_URL}/api/stock/national`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        fetch(`${API_URL}/api/vaccine`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        fetch(`${API_URL}/api/region`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      ]);

      if (!stockRes.ok) {
        const errorText = await stockRes.text().catch(() => "Erreur inconnue");
        console.error("Erreur API stock/national:", stockRes.status, errorText);
        throw new Error(`Erreur chargement stocks: ${stockRes.status} - ${errorText}`);
      }
      if (!vaccineRes.ok) {
        const errorText = await vaccineRes.text().catch(() => "Erreur inconnue");
        console.error("Erreur API vaccine:", vaccineRes.status, errorText);
        throw new Error(`Erreur chargement vaccins: ${vaccineRes.status} - ${errorText}`);
      }
      if (!regionsRes.ok) {
        const errorText = await regionsRes.text().catch(() => "Erreur inconnue");
        console.error("Erreur API region:", regionsRes.status, errorText);
        throw new Error(`Erreur chargement régions: ${regionsRes.status} - ${errorText}`);
      }

      const stockData: NationalStockResponse = await stockRes.json();
      const vaccineData: VaccineResponse = await vaccineRes.json();
      const regionsData: RegionsResponse = await regionsRes.json();

      const stocksList = Array.isArray(stockData?.national) ? stockData.national : [];
      
      // Charger les lots pour chaque stock et calculer les statistiques
      const stocksWithLots = await Promise.all(
        stocksList.map(async (stock) => {
          try {
            const lotsRes = await fetch(`${API_URL}/api/stock/national/${stock.vaccineId}/lots`, {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
            });
            
            if (lotsRes.ok) {
              const lotsData: LotResponse = await lotsRes.json();
              const lots = lotsData.lots || [];
              const expiredLots = lots.filter((lot) => lot.status === "EXPIRED" || isDateExpired(lot.expiration));
              const expiredQuantity = expiredLots.reduce((sum, lot) => sum + lot.quantity, 0);
              
              return {
                ...stock,
                lotCount: lots.length,
                expiredLotCount: expiredLots.length,
                expiredQuantity,
              };
            }
          } catch (err) {
            console.error(`Erreur chargement lots pour ${stock.vaccineId}:`, err);
          }
          
          return {
            ...stock,
            lotCount: 0,
            expiredLotCount: 0,
            expiredQuantity: 0,
          };
        })
      );
      
      setStocks(stocksWithLots);
      setVaccines(
        Array.isArray(vaccineData)
          ? vaccineData
          : Array.isArray(vaccineData?.vaccines)
          ? vaccineData.vaccines
          : []
      );
      setRegions(
        Array.isArray(regionsData)
          ? regionsData
          : Array.isArray(regionsData?.regions)
          ? regionsData.regions
          : []
      );
    } catch (err) {
      console.error("Erreur chargement stocks:", err);
      setError("Impossible de charger les stocks nationaux");
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Supprimé - remplacé par le nouveau useEffect plus bas

  const availableVaccinesForCreation = useMemo(() => {
    const withStock = new Set(stocks.map((stock) => stock.vaccineId));
    return vaccines.filter((vaccine) => !withStock.has(vaccine.id));
  }, [stocks, vaccines]);

  const resetUpdateModal = () => {
    setUpdateModalOpen(false);
    setUpdateContext(null);
    setUpdateQuantity("");
    setAddQuantity("");
    setAddExpiration("");
    setUpdateExpiration("");
    setAddQuantityError(null);
    setUpdating(false);
    // Reset reduce states
    setReduceQuantity("");
    setReduceRemaining(0);
    setReduceLots([]);
    setReduceError(null);
    setSelectedLotId(null);
    setReduceLotsLoaded(false);
  };

  const handleCreateStock = async (event: FormEvent) => {
    event.preventDefault();
    if (!createVaccineId || !accessToken) return;

    try {
      setCreating(true);
      const response = await fetch(`${API_URL}/api/stock/national`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ vaccineId: createVaccineId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      setCreateModalOpen(false);
      setCreateVaccineId("");
      await fetchNationalStocks();
      await fetchNationalStats();
    } catch (err) {
      console.error("Erreur création stock national:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer le stock national"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteHealthCenterStock = async (stock: HealthCenterStock) => {
    if (!accessToken) return;

    const confirmed = window.confirm(
      `Supprimer le stock pour le vaccin ${stock.vaccine.name} ?`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setHealthDeletingId(stock.id);
      setError(null);

      const payload: Record<string, string> = { vaccineId: stock.vaccineId };
      if (stock.healthCenterId) {
        payload.healthCenterId = stock.healthCenterId;
      }

      const response = await fetch(`${API_URL}/api/stock/health-center`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? `status ${response.status}`);
      }

      await Promise.all([fetchHealthCenterStocks(), fetchHealthCenterStats()]);
    } catch (err) {
      console.error("Erreur suppression stock centre:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de supprimer ce stock de centre.",
      );
    } finally {
      setHealthDeletingId(null);
    }
  };

  const handleDeleteDistrictStock = async (stock: DistrictStock) => {
    if (!accessToken) return;

    const confirmed = window.confirm(
      `Supprimer le stock du district ${stock.district?.name ?? ""} pour le vaccin ${stock.vaccine.name} ?`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setDistrictDeletingId(stock.id);
      setError(null);

      const payload: Record<string, string> = { vaccineId: stock.vaccineId };
      if (stock.districtId) {
        payload.districtId = stock.districtId;
      }

      const response = await fetch(`${API_URL}/api/stock/district`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? `status ${response.status}`);
      }

      await Promise.all([fetchDistrictStocks(), fetchDistrictStats()]);
    } catch (err) {
      console.error("Erreur suppression stock district:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de supprimer ce stock district.",
      );
    } finally {
      setDistrictDeletingId(null);
    }
  };

  const handleDeleteRegionalStock = async (stock: RegionalStock) => {
    if (!accessToken) return;
    const confirmed = window.confirm(
      `Supprimer le stock régional pour le vaccin ${stock.vaccine.name} ?`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setRegionalDeletingId(stock.id);
      setError(null);

      const payload: Record<string, string> = { vaccineId: stock.vaccineId };
      if (stock.regionId) {
        payload.regionId = stock.regionId;
      }

      const response = await fetch(`${API_URL}/api/stock/regional`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message ?? `status ${response.status}`);
      }

      await Promise.all([fetchRegionalStocks(), fetchRegionalStats()]);
    } catch (err) {
      console.error("Erreur suppression stock régional:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de supprimer ce stock régional.",
      );
    } finally {
      setRegionalDeletingId(null);
    }
  };

  const openUpdateModal = async (stock: NationalStock) => {
    setUpdateContext({
      vaccineId: stock.vaccineId,
      vaccineName: stock.vaccine.name,
      currentQuantity: stock.quantity ?? 0,
    });
    setUpdateQuantity(String(stock.quantity ?? 0));
    setUpdateMode("add");
    setAddQuantity("");
    setAddExpiration("");
    setUpdateExpiration("");
    setAddQuantityError(null);
    // Reset reduce states
    setReduceQuantity("");
    setReduceRemaining(0);
    setReduceLots([]);
    setReduceError(null);
    setSelectedLotId(null);
    setReduceLotsLoaded(false);
    setUpdateModalOpen(true);
  };

  const handleSetQuantitySubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!updateContext || !accessToken) return;

    const quantityValue = Number(updateQuantity);
    if (!Number.isFinite(quantityValue) || quantityValue < 0) {
      setAddQuantityError("Veuillez saisir une quantité valide.");
      return;
    }

    const currentQuantity = updateContext.currentQuantity ?? 0;
    const requiresExpiration = quantityValue > currentQuantity;

    if (requiresExpiration && !updateExpiration) {
      setAddQuantityError("Veuillez indiquer la date d'expiration du stock ajouté.");
      return;
    }

    try {
      setAddQuantityError(null);
      setUpdating(true);
      const payload: {
        vaccineId: string;
        quantity: number;
        expiration?: string;
      } = {
        vaccineId: updateContext.vaccineId,
        quantity: quantityValue,
      };

      if (requiresExpiration && updateExpiration) {
        payload.expiration = `${updateExpiration}T00:00:00.000Z`;
      }

      const response = await fetch(`${API_URL}/api/stock/national`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      resetUpdateModal();
      await Promise.all([fetchNationalStocks(), fetchNationalStats()]);
    } catch (err) {
      console.error("Erreur mise à jour stock national:", err);
      setAddQuantityError(
        err instanceof Error
          ? err.message
          : "Impossible de modifier le stock national"
      );
    } finally {
      setUpdating(false);
    }
  };

  // Charger les lots pour la diminution
  const loadLotsForReduce = useCallback(async () => {
    if (!updateContext?.vaccineId || !accessToken) return;

    try {
      setReduceLoading(true);
      setReduceError(null);
      const response = await fetch(
        `${API_URL}/api/stock/national/${updateContext.vaccineId}/lots`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Impossible de charger les lots");
      }

      const payload: LotResponse = await response.json();
      const validLots = payload.lots.filter((lot) => lot.remainingQuantity > 0);
      setReduceLots(validLots);
      setReduceRemaining(payload.totalRemaining);
      setReduceLotsLoaded(true); // Marquer comme chargé pour éviter les rechargements en boucle
      
      // Réinitialiser selectedLotId si le lot sélectionné n'existe plus dans les lots valides
      setSelectedLotId((currentSelectedId) => {
        if (currentSelectedId && !validLots.find((lot) => lot.id === currentSelectedId)) {
          return null;
        }
        return currentSelectedId;
      });
    } catch (err) {
      console.error("Erreur chargement lots:", err);
      setReduceError(
        err instanceof Error ? err.message : "Impossible de charger les lots"
      );
      setReduceLotsLoaded(true); // Marquer comme chargé même en cas d'erreur pour éviter les boucles
    } finally {
      setReduceLoading(false);
    }
  }, [updateContext?.vaccineId, accessToken]);

  // Réinitialiser le flag quand on change de mode ou de contexte
  useEffect(() => {
    if (updateMode === "add" || !updateContext?.vaccineId) {
      setReduceLotsLoaded(false);
    }
  }, [updateMode, updateContext?.vaccineId]);

  // Quand on passe en mode reduce, charger les lots une seule fois
  useEffect(() => {
    if (updateMode === "reduce" && updateContext?.vaccineId && !reduceLotsLoaded && !reduceLoading) {
      loadLotsForReduce();
    }
  }, [updateMode, updateContext?.vaccineId, loadLotsForReduce, reduceLotsLoaded, reduceLoading]);

  const handleReduceLotSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!updateContext || !accessToken || !selectedLotId) return;

    // Vérifier qu'il y a des lots disponibles
    if (reduceLots.length === 0) {
      setReduceError("Aucun lot disponible avec une quantité restante.");
      return;
    }

    const quantityValue = Number(reduceQuantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setReduceError("Veuillez saisir une quantité valide supérieure à 0.");
      return;
    }

    const selectedLot = reduceLots.find((lot) => lot.id === selectedLotId);
    if (!selectedLot) {
      setReduceError("Lot sélectionné introuvable. Veuillez sélectionner un lot disponible.");
      setSelectedLotId(null);
      return;
    }

    // Vérifier que la quantité à réduire ne dépasse pas le stock disponible
    if (quantityValue > selectedLot.remainingQuantity) {
      setReduceError(
        `La quantité à réduire (${quantityValue.toLocaleString("fr-FR")}) dépasse le stock disponible (${selectedLot.remainingQuantity.toLocaleString("fr-FR")} doses).`
      );
      return;
    }

    const actualQuantityToReduce = quantityValue;

    try {
      setReduceError(null);
      setUpdating(true);

      const response = await fetch(
        `${API_URL}/api/stock/national/lot/${selectedLotId}/reduce`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            quantity: actualQuantityToReduce,
          }),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Erreur lors de la diminution");
      }

      // Recharger les lots
      await loadLotsForReduce();
      
      // La diminution est terminée
      resetUpdateModal();
      await Promise.all([fetchNationalStocks(), fetchNationalStats()]);
    } catch (err) {
      console.error("Erreur diminution lot:", err);
      setReduceError(
        err instanceof Error ? err.message : "Impossible de diminuer le lot"
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleAddQuantitySubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!updateContext || !accessToken) return;

    const quantityValue = Number(addQuantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setAddQuantityError("Veuillez saisir une quantité valide.");
      return;
    }

    if (!addExpiration) {
      setAddQuantityError("Veuillez indiquer la date d'expiration du lot ajouté.");
      return;
    }

    try {
      setAddQuantityError(null);
      setUpdating(true);
      const response = await fetch(`${API_URL}/api/stock/add-national`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          vaccineId: updateContext.vaccineId,
          quantity: quantityValue,
          expiration: `${addExpiration}T00:00:00.000Z`,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      resetUpdateModal();
      await Promise.all([fetchNationalStocks(), fetchNationalStats()]);
    } catch (err) {
      console.error("Erreur ajout stock national:", err);
      setAddQuantityError(
        err instanceof Error
          ? err.message
          : "Impossible d'ajouter au stock national"
      );
    } finally {
      setUpdating(false);
    }
  };

  const openTransferModal = (stock: NationalStock) => {
    setTransferContext({ vaccineId: stock.vaccineId, vaccineName: stock.vaccine.name });
    setTransferRegionId("");
    setTransferQuantity("");
    setTransferError(null);
    setPendingRegionalCreation(false);
    setTransferModalOpen(true);
  };

  const handleTransferSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !transferContext) return;

    const quantityValue = Number(transferQuantity);
    if (!transferRegionId || !Number.isFinite(quantityValue) || quantityValue <= 0) {
      setTransferError("Sélectionnez une région et saisissez une quantité valide.");
      return;
    }

    try {
      setTransferLoading(true);
      setTransferError(null);
      setPendingRegionalCreation(false);

      const response = await fetch(`${API_URL}/api/stock/add-regional`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          vaccineId: transferContext.vaccineId,
          regionId: transferRegionId,
          quantity: quantityValue,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          setTransferError(
            "Cette région n'a pas encore de stock pour ce vaccin. Créez-le puis recommencez."
          );
          setPendingRegionalCreation(true);
        } else {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }
        return;
      }

      setTransferModalOpen(false);
      setTransferContext(null);
      setTransferRegionId("");
      setTransferQuantity("");
      await Promise.all([fetchNationalStocks(), fetchNationalStats()]);
    } catch (err) {
      console.error("Erreur transfert régional:", err);
      setTransferError(
        err instanceof Error ? err.message : "Impossible de transférer le stock"
      );
    } finally {
      setTransferLoading(false);
    }
  };

  const handleCreateRegionalStock = async () => {
    if (!transferContext || !transferRegionId || !accessToken) return;

    try {
      setTransferLoading(true);
      setTransferError(null);

      const response = await fetch(`${API_URL}/api/stock/regional`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          vaccineId: transferContext.vaccineId,
          regionId: transferRegionId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      setTransferError(
        "Stock régional créé. Vous pouvez maintenant effectuer le transfert."
      );
      setPendingRegionalCreation(false);
      await Promise.all([fetchNationalStocks(), fetchNationalStats()]);
    } catch (err) {
      console.error("Erreur création stock régional:", err);
      setTransferError(
        err instanceof Error
          ? err.message
          : "Impossible de créer le stock régional"
      );
    } finally {
      setTransferLoading(false);
    }
  };

  const handleDeleteStock = async (stock: NationalStock) => {
    if (!accessToken) return;

    const confirmed = window.confirm(
      `Supprimer le stock national pour le vaccin ${stock.vaccine.name} ?`
    );
    if (!confirmed) {
      return;
    }

    try {
      setNationalDeletingId(stock.id);
      setError(null);

      const response = await fetch(`${API_URL}/api/stock/national`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ vaccineId: stock.vaccineId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      await Promise.all([fetchNationalStocks(), fetchNationalStats()]);
    } catch (err) {
      console.error("Erreur suppression stock national:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de supprimer ce stock national."
      );
    } finally {
      setNationalDeletingId(null);
    }
  };

  const fetchLotsForVaccine = useCallback(
    async (vaccineId: string) => {
      if (!accessToken) return;
      try {
        setLotLoading(true);
        setLotError(null);
        const response = await fetch(
          `${API_URL}/api/stock/national/${vaccineId}/lots`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        const payload = (await response.json()) as LotResponse;
        setLotItems(Array.isArray(payload?.lots) ? payload.lots : []);
        setLotTotalRemaining(payload?.totalRemaining ?? 0);
      } catch (err) {
        console.error("Erreur chargement lots:", err);
        setLotItems([]);
        setLotTotalRemaining(0);
        setLotError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les lots du vaccin.",
        );
      } finally {
        setLotLoading(false);
      }
    },
    [accessToken],
  );

  const handleOpenNationalLotModal = useCallback(
    (stock: NationalStock) => {
      setLotContext({
        vaccineId: stock.vaccineId,
        vaccineName: stock.vaccine.name,
        ownerId: null,
      });
      setLotItems([]);
      setLotTotalRemaining(0);
      setLotError(null);
      setLotModalOpen(true);
      void fetchLotsForVaccine(stock.vaccineId);
    },
    [fetchLotsForVaccine],
  );

  const closeNationalLotModal = useCallback(() => {
    setLotModalOpen(false);
    setLotContext(null);
    setLotItems([]);
    setLotTotalRemaining(0);
    setLotError(null);
    setLotDeletingId(null);
  }, []);

  const handleDeleteLot = useCallback(
    async (lotId: string) => {
      if (!accessToken || !lotContext) return;
      try {
        setLotDeletingId(lotId);
        const response = await fetch(`${API_URL}/api/stock/lots/${lotId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        await fetchLotsForVaccine(lotContext.vaccineId);
        await Promise.all([fetchNationalStocks(), fetchNationalStats()]);
      } catch (err) {
        console.error("Erreur suppression lot:", err);
        setLotError(
          err instanceof Error
            ? err.message
            : "Impossible de supprimer le lot sélectionné.",
        );
      } finally {
        setLotDeletingId(null);
      }
    },
    [
      accessToken,
      fetchLotsForVaccine,
      fetchNationalStats,
      fetchNationalStocks,
      lotContext,
    ],
  );

  // Fonction pour récupérer les transferts envoyés
  const fetchSentTransfers = useCallback(async () => {
    if (!accessToken) {
      setSentTransfers([]);
      setSentTransfersLoading(false);
      return;
    }
    try {
      setSentTransfersLoading(true);
      const response = await fetch(`${API_URL}/api/stock/pending-transfers/sent`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const payload = (await response.json()) as { transfers?: PendingTransfer[] };
      setSentTransfers(Array.isArray(payload?.transfers) ? payload.transfers : []);
    } catch (err) {
      console.error("Erreur chargement envois envoyés:", err);
      setSentTransfers([]);
    } finally {
      setSentTransfersLoading(false);
    }
  }, [accessToken]);

  // Fonction pour récupérer l'historique
  const fetchTransferHistory = useCallback(async () => {
    if (!accessToken) return;
    try {
      setHistoryLoading(true);
      const params = new URLSearchParams({
        page: historyPage.toString(),
        limit: "20",
      });
      
      if (historyFilters.vaccineId) params.append("vaccineId", historyFilters.vaccineId);
      if (historyFilters.fromType) params.append("fromType", historyFilters.fromType);
      if (historyFilters.toType) params.append("toType", historyFilters.toType);
      if (historyFilters.sentStartDate) params.append("sentStartDate", historyFilters.sentStartDate);
      if (historyFilters.sentEndDate) params.append("sentEndDate", historyFilters.sentEndDate);
      if (historyFilters.confirmedStartDate) params.append("confirmedStartDate", historyFilters.confirmedStartDate);
      if (historyFilters.confirmedEndDate) params.append("confirmedEndDate", historyFilters.confirmedEndDate);
      if (historyFilters.search) params.append("search", historyFilters.search);

      const response = await fetch(`${API_URL}/api/stock/transfer-history?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const errorMessage = payload?.message ?? `Erreur ${response.status}`;
        console.error("Erreur API historique:", errorMessage, payload);
        throw new Error(errorMessage);
      }

      const payload = (await response.json()) as {
        history?: TransferHistoryItem[];
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
      };
      
      setTransferHistory(Array.isArray(payload?.history) ? payload.history : []);
      setHistoryTotal(payload?.total ?? 0);
      setHistoryTotalPages(payload?.totalPages ?? 0);
    } catch (err) {
      console.error("Erreur chargement historique:", err);
      setTransferHistory([]);
      setHistoryTotal(0);
      setHistoryTotalPages(0);
    } finally {
      setHistoryLoading(false);
    }
  }, [accessToken, historyPage, historyFilters]);

  // Fonction pour annuler un transfert
  const handleCancelTransfer = useCallback(
    async (transferId: string) => {
      if (!accessToken) return;
      const confirmed = window.confirm(
        "Êtes-vous sûr de vouloir annuler ce transfert ? Les quantités seront restaurées dans votre stock."
      );
      if (!confirmed) return;

      try {
        setCancellingTransferId(transferId);
        const response = await fetch(
          `${API_URL}/api/stock/pending-transfers/${transferId}/cancel`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        await Promise.all([
          fetchSentTransfers(),
          fetchNationalStocks(),
          fetchNationalStats(),
        ]);
      } catch (err) {
        console.error("Erreur annulation transfert:", err);
        alert(
          err instanceof Error
            ? err.message
            : "Impossible d'annuler le transfert.",
        );
      } finally {
        setCancellingTransferId(null);
      }
    },
    [accessToken, fetchSentTransfers, fetchNationalStocks, fetchNationalStats],
  );

  useEffect(() => {
    fetchNationalStocks();
    fetchNationalStats();
    if (activeTab === "pending-sent") {
      fetchSentTransfers();
    } else if (activeTab === "history") {
      fetchTransferHistory();
    }
  }, [fetchNationalStocks, fetchNationalStats, activeTab, fetchSentTransfers, fetchTransferHistory]);

  return (
    <DashboardShell active="/dashboard/stocks">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {user?.role !== "SUPERADMIN" && (
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Stocks & lots</h2>
              <p className="text-sm text-slate-500">
                Suivi des stocks nationaux et distribution vers les régions.
              </p>
            </div>
          )}
          
          {/* Boutons d'action et onglets */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* Bouton Nouveau lot */}
            {activeTab === "stocks" && (
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Nouveau lot
              </button>
            )}
            
            {/* Onglets */}
            <div className="border-b border-slate-200 md:border-b-0">
              <nav className="-mb-px flex space-x-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("stocks")}
                  className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "stocks"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Stocks
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pending-sent")}
                  className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "pending-sent"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Envois en cours
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "history"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Historique
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Contenu des onglets */}
        {activeTab === "stocks" && (
          <>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title="Total de doses"
            value={stats.totalQuantity.toLocaleString("fr-FR")}
            icon={Syringe}
            accent="emerald"
            loading={statsLoading}
          />
          <StatCard
            title="Stocks faibles"
            value={stats.lowStockCount}
            icon={AlertTriangle}
            accent="red"
            loading={statsLoading}
          />
          <StatCard
            title="Lots expirés"
            value={
              statsLoading
                ? "…"
                : stats.expiredLots.toLocaleString("fr-FR")
            }
            icon={AlertTriangle}
            accent="red"
            loading={statsLoading}
          />
        </div>

        {statsError && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-700">
            {statsError}
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {pendingTransfers.length > 0 && (
          <div className="rounded-3xl border border-blue-200 bg-blue-50/80 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
                  <PackageOpen className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    {pendingTransfers.length} envoi{pendingTransfers.length > 1 ? "s" : ""} en attente de confirmation
                  </p>
                  <p className="text-xs text-blue-700">
                    Veuillez confirmer ou refuser les transferts reçus
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("pending-received")}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Voir les envois
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-blue-100 bg-blue-50/50 mb-4">
          <button
            type="button"
            onClick={() => setLegendExpanded(!legendExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-blue-100/50 transition rounded-xl"
          >
            <div className="flex items-center gap-2 flex-1">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <h4 className="text-xs font-semibold text-blue-900">Qu'est-ce qu'un lot ?</h4>
            </div>
            {legendExpanded ? (
              <ChevronUp className="h-4 w-4 text-blue-600 flex-shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-blue-600 flex-shrink-0" />
            )}
          </button>
          {legendExpanded && (
            <div className="px-3 pb-2 pt-1">
              <p className="text-xs text-blue-800 leading-relaxed">
                Un <strong>lot</strong> représente un ensemble de doses d'un vaccin avec une même date d'expiration. 
                Chaque stock peut contenir plusieurs lots, chacun ayant sa propre date d'expiration. 
                Les lots permettent de gérer efficacement la traçabilité et le suivi des vaccins, notamment pour identifier 
                les doses expirées et optimiser la distribution selon les dates d'expiration.
              </p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Vaccin
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Quantité (national)
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Nombre de lots
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                    Chargement des stocks…
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                    Aucun stock national enregistré pour le moment.
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => {
                  const lotCount = stock.lotCount ?? 0;
                  const expiredLotCount = stock.expiredLotCount ?? 0;
                  const expiredQuantity = stock.expiredQuantity ?? 0;
                  const totalQuantity = stock.quantity ?? 0;
                  const validQuantity = totalQuantity - expiredQuantity;
                  const validLotCount = lotCount - expiredLotCount;
                  
                  // Vérifier si le stock peut être envoyé
                  const canSend = lotCount > 0 && validLotCount > 0 && validQuantity > 0;
                  const disabledReason = lotCount === 0 
                    ? "Aucun lot disponible pour ce vaccin"
                    : validLotCount === 0
                    ? "Tous les lots sont expirés"
                    : validQuantity === 0
                    ? "Toutes les quantités sont expirées"
                    : "";
                  
                  return (
                    <tr
                      key={stock.id}
                      className="hover:bg-slate-50/80"
                    >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {stock.vaccine.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {stock.vaccine.description}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">
                        {(stock.quantity ?? 0).toLocaleString("fr-FR")}
                        {expiredQuantity > 0 && (
                          <span className="ml-2 text-sm font-normal text-red-600">
                            ({expiredQuantity.toLocaleString("fr-FR")} expiré{expiredQuantity > 1 ? "s" : ""})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {stock.vaccine.dosesRequired} doses requises
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-slate-700">
                        {lotCount} lot{lotCount > 1 ? "s" : ""}
                        {expiredLotCount > 0 && (
                          <span className="ml-2 text-red-600">
                            - {expiredLotCount} expiré{expiredLotCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenNationalLotModal(stock)}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                        >
                          <PackageOpen className="h-4 w-4" />
                          Lots
                        </button>
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={() => canSend && openTransferModal(stock)}
                            disabled={!canSend}
                            className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-50"
                            title={!canSend ? disabledReason : undefined}
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                            Envoyer
                          </button>
                          {!canSend && (
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10 w-48 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
                              {disabledReason}
                              <div className="absolute top-full right-4 -mt-1 h-2 w-2 rotate-45 bg-slate-900"></div>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => openUpdateModal(stock)}
                          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-100"
                        >
                          Ajuster
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStock(stock)}
                          disabled={nationalDeletingId === stock.id}
                          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          {nationalDeletingId === stock.id ? "Suppression…" : "Supprimer"}
                        </button>
                      </div>
                    </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
          </>
        )}

        {activeTab === "pending-sent" && (
          <div className="space-y-6">
            {sentTransfersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : sentTransfers.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                <PackageOpen className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-sm font-medium text-slate-900">Aucun envoi en cours</p>
                <p className="mt-2 text-sm text-slate-500">
                  Vous n'avez aucun transfert en attente de confirmation.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Vaccin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Destinataire
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Quantité
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Date d'envoi
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {sentTransfers.map((transfer) => {
                      const sentDate = new Date(transfer.createdAt);
                      return (
                        <tr key={transfer.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-slate-900">
                              {transfer.vaccine?.name ?? "Vaccin inconnu"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {formatEntityName(transfer.toType, transfer.toName)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {transfer.quantity.toLocaleString("fr-FR")} doses
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {sentDate.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleCancelTransfer(transfer.id)}
                                disabled={cancellingTransferId === transfer.id}
                                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                              >
                                {cancellingTransferId === transfer.id ? (
                                  <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                    Annulation...
                                  </>
                                ) : (
                                  <>
                                    <X className="h-4 w-4" />
                                    Annuler
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "pending-received" && (
          <div className="space-y-6">
            {pendingTransfersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : pendingTransfers.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                <PackageOpen className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-sm font-medium text-slate-900">Aucun envoi en attente</p>
                <p className="mt-2 text-sm text-slate-500">
                  Vous n'avez aucun transfert en attente de confirmation.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-hidden rounded-2xl md:rounded-3xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Vaccin
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Expéditeur
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Quantité
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Date d'envoi
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-right text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {pendingTransfers.map((transfer) => {
                      const sentDate = new Date(transfer.createdAt);
                      return (
                        <tr key={transfer.id} className="hover:bg-slate-50">
                          <td className="px-2 md:px-6 py-2 md:py-4">
                            <div className="text-xs md:text-sm font-medium text-slate-900">
                              {transfer.vaccine?.name ?? "Vaccin inconnu"}
                            </div>
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-700">
                            {formatEntityName(transfer.fromType, transfer.fromName)}
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-700">
                            {transfer.quantity.toLocaleString("fr-FR")} doses
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-600">
                            {sentDate.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4">
                            <div className="flex justify-end gap-1 md:gap-2">
                              <button
                                type="button"
                                onClick={() => handleRejectTransfer(transfer.id)}
                                disabled={rejectingTransferId === transfer.id}
                                className="flex items-center gap-1 md:gap-2 rounded-lg md:rounded-xl border border-red-200 bg-red-50 px-2 md:px-4 py-1 md:py-2 text-[10px] md:text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                              >
                                {rejectingTransferId === transfer.id ? (
                                  <>
                                    <div className="h-3 w-3 md:h-4 md:w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                    <span className="hidden sm:inline">Refus...</span>
                                    <span className="sm:hidden">...</span>
                                  </>
                                ) : (
                                  <>
                                    <X className="h-3 w-3 md:h-4 md:w-4" />
                                    <span className="hidden sm:inline">Refuser</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmTransfer(transfer.id)}
                                disabled={confirmingTransferId === transfer.id}
                                className="flex items-center gap-1 md:gap-2 rounded-lg md:rounded-xl bg-emerald-600 px-2 md:px-4 py-1 md:py-2 text-[10px] md:text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {confirmingTransferId === transfer.id ? (
                                  <>
                                    <div className="h-3 w-3 md:h-4 md:w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    <span className="hidden sm:inline">Confirmation...</span>
                                    <span className="sm:hidden">...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-3 w-3 md:h-4 md:w-4" />
                                    <span className="hidden sm:inline">Confirmer</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-6">
            {/* Filtres */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Historique des envois</h3>
                <p className="text-sm text-slate-500">
                  Tous les transferts de stock confirmés
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="w-[180px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Rechercher
                  </label>
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={historyFilters.search}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, search: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                
                {/* Bloc Date d'envoi */}
                <div className="w-[280px] rounded-xl border-2 border-blue-200 bg-blue-50/30 p-3">
                  <label className="mb-2 block text-xs font-semibold text-blue-700">
                    Date d'envoi
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Du
                      </label>
                      <input
                        type="date"
                        value={historyFilters.sentStartDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, sentStartDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Au
                      </label>
                      <input
                        type="date"
                        value={historyFilters.sentEndDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, sentEndDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Bloc Date de confirmation/annulation */}
                <div className="w-[280px] rounded-xl border-2 border-green-200 bg-green-50/30 p-3">
                  <label className="mb-2 block text-xs font-semibold text-green-700">
                    Date de confirmation/annulation
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Du
                      </label>
                      <input
                        type="date"
                        value={historyFilters.confirmedStartDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, confirmedStartDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Au
                      </label>
                      <input
                        type="date"
                        value={historyFilters.confirmedEndDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, confirmedEndDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="w-[140px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Expéditeur
                  </label>
                  <select
                    value={historyFilters.fromType}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, fromType: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Tous expéditeurs</option>
                    <option value="NATIONAL">National</option>
                    <option value="REGIONAL">Régional</option>
                    <option value="DISTRICT">District</option>
                    <option value="HEALTHCENTER">Centre de santé</option>
                  </select>
                </div>
                <div className="w-[140px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Destinataire
                  </label>
                  <select
                    value={historyFilters.toType}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, toType: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Tous destinataires</option>
                    <option value="REGIONAL">Régional</option>
                    <option value="DISTRICT">District</option>
                    <option value="HEALTHCENTER">Centre de santé</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      // Validation : si une date de début est remplie, la date de fin doit l'être aussi
                      if (
                        (historyFilters.sentStartDate && !historyFilters.sentEndDate) ||
                        (!historyFilters.sentStartDate && historyFilters.sentEndDate) ||
                        (historyFilters.confirmedStartDate && !historyFilters.confirmedEndDate) ||
                        (!historyFilters.confirmedStartDate && historyFilters.confirmedEndDate)
                      ) {
                        alert("Veuillez remplir les deux dates (du et au) pour chaque période de filtrage.");
                        return;
                      }
                      setHistoryPage(1);
                      fetchTransferHistory();
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                  >
                    <Search className="h-4 w-4" />
                    Filtrer
                  </button>
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : transferHistory.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                <PackageOpen className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-sm font-medium text-slate-900">Aucun historique</p>
                <p className="mt-2 text-sm text-slate-500">
                  Aucun transfert confirmé pour le moment.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Vaccin
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Expéditeur
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Destinataire
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Quantité
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Date envoi
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Confirmation/annulation
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Expiration lot
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {transferHistory.map((item) => {
                        const sentDate = new Date(item.sentAt);
                        const confirmedDate = item.confirmedAt ? new Date(item.confirmedAt) : null;
                        const expirationDate = item.lotExpiration ? new Date(item.lotExpiration) : null;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-900">
                                {item.vaccineName}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              {formatEntityName(item.fromType, item.fromName)}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              {formatEntityName(item.toType, item.toName)}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              {item.quantity.toLocaleString("fr-FR")} doses
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {sentDate.toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {confirmedDate
                                ? confirmedDate.toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "N/A"}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {expirationDate
                                ? expirationDate.toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  item.status === "CONFIRMED"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {item.status === "CONFIRMED" ? "Confirmé" : "Annulé"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {historyTotalPages > 1 && (
                  <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-6 py-4">
                    <div className="text-sm text-slate-700">
                      Page {historyPage} sur {historyTotalPages} ({historyTotal} résultats)
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryPage((p) => Math.max(1, p - 1));
                        }}
                        disabled={historyPage === 1}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Précédent
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryPage((p) => Math.min(historyTotalPages, p + 1));
                        }}
                        disabled={historyPage === historyTotalPages}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-lg rounded-3xl bg-white shadow-2xl">
            <form onSubmit={handleCreateStock} className="space-y-4 p-6">
              <h3 className="text-lg font-semibold text-slate-900">Créer un stock national</h3>
              <p className="text-sm text-slate-500">
                Sélectionnez un vaccin qui n'a pas encore de stock national.
              </p>

              <select
                value={createVaccineId}
                onChange={(event) => setCreateVaccineId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                required
              >
                <option value="">— Sélectionner un vaccin —</option>
                {availableVaccinesForCreation.map((vaccine) => (
                  <option key={vaccine.id} value={vaccine.id}>
                    {vaccine.name}
                  </option>
                ))}
              </select>

              {availableVaccinesForCreation.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  Tous les vaccins possèdent déjà un stock national.
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setCreateVaccineId("");
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating || availableVaccinesForCreation.length === 0}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {creating ? "Création…" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {updateModalOpen && updateContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Ajuster le stock — {updateContext.vaccineName}
              </h3>

              <div className="mt-6 flex flex-col gap-4 md:flex-row">
                <button
                  type="button"
                  onClick={() => setUpdateMode("add")}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-medium transition ${
                    updateMode === "add"
                      ? "border-blue-300 bg-blue-50 text-blue-700 shadow"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Ajouter au stock
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateMode("reduce")}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-medium transition ${
                    updateMode === "reduce"
                      ? "border-orange-300 bg-orange-50 text-orange-700 shadow"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Diminuer
                </button>
              </div>

              {updateMode === "reduce" ? (
                <form onSubmit={handleReduceLotSubmit} className="mt-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Quantité à diminuer
                    </label>
                    <input
                      value={reduceQuantity}
                      onChange={(event) => setReduceQuantity(event.target.value)}
                      type="number"
                      min="1"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      required
                      disabled={updating}
                    />
                    <p className="text-xs text-slate-500">
                      Quantité totale disponible : {reduceRemaining.toLocaleString("fr-FR")} doses
                    </p>
                  </div>

                  {reduceLoading ? (
                    <div className="text-center py-4 text-slate-500">
                      Chargement des lots...
                    </div>
                  ) : reduceLots.length === 0 ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      Aucun lot disponible avec une quantité restante.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-600">
                        Choisir le lot dans lequel diminuer
                      </label>
                      <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-3">
                        {reduceLots.map((lot) => (
                          <button
                            key={lot.id}
                            type="button"
                            onClick={() => setSelectedLotId(lot.id)}
                            className={`w-full text-left p-3 rounded-lg border transition ${
                              selectedLotId === lot.id
                                ? "border-orange-500 bg-orange-50"
                                : "border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium text-slate-900">
                                  Lot expirant le {new Date(lot.expiration).toLocaleDateString("fr-FR")}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Quantité disponible : {lot.remainingQuantity.toLocaleString("fr-FR")} doses
                                </div>
                              </div>
                              {selectedLotId === lot.id && (
                                <div className="text-orange-600">✓</div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {reduceError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {reduceError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={resetUpdateModal}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                      disabled={updating}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={updating || !selectedLotId || !reduceQuantity || reduceLots.length === 0}
                      className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-60"
                    >
                      {updating ? "Diminution…" : "Diminuer"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAddQuantitySubmit} className="mt-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">
                        Quantité actuelle
                      </label>
                      <input
                        value={(updateContext.currentQuantity ?? 0).toLocaleString("fr-FR")}
                        disabled
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">
                        Quantité à ajouter
                      </label>
                      <input
                        value={addQuantity}
                        onChange={(event) => setAddQuantity(event.target.value)}
                        type="number"
                        min="1"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Date d&apos;expiration du lot ajouté
                    </label>
                    <input
                      type="date"
                      value={addExpiration}
                      onChange={(event) => setAddExpiration(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  </div>

                  {addQuantityError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {addQuantityError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={resetUpdateModal}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={updating}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {updating ? "Ajout…" : "Ajouter"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {transferModalOpen && transferContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-lg rounded-3xl bg-white shadow-2xl">
            <form onSubmit={handleTransferSubmit} className="space-y-4 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Envoyer du stock — {transferContext.vaccineName}
              </h3>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">Région</label>
                <select
                  value={transferRegionId}
                  onChange={(event) => {
                    setTransferRegionId(event.target.value);
                    setTransferError(null);
                    setPendingRegionalCreation(false);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                >
                  <option value="">— Sélectionner une région —</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">
                  Quantité à envoyer
                </label>
                <input
                  value={transferQuantity}
                  onChange={(event) => setTransferQuantity(event.target.value)}
                  type="number"
                  min="1"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              {transferError && (
                <div
                  className={`rounded-xl border p-3 text-sm ${
                    pendingRegionalCreation
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {transferError}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3">
                {pendingRegionalCreation && (
                  <button
                    type="button"
                    onClick={handleCreateRegionalStock}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
                  >
                    Créer le stock régional
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setTransferModalOpen(false);
                    setTransferContext(null);
                    setTransferRegionId("");
                    setTransferQuantity("");
                    setTransferError(null);
                    setPendingRegionalCreation(false);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {transferLoading ? "Transfert…" : "Envoyer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lotModalOpen && lotContext && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-[95vw] md:max-w-4xl rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Lots du vaccin {lotContext.vaccineName}
                </h3>
                <p className="text-sm text-slate-500">
                  Historique des lots ajoutés et envoyés. Les lots expirés peuvent être retirés pour mettre à jour les stocks.
                </p>
              </div>
              <button
                type="button"
                onClick={closeNationalLotModal}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Fermer
              </button>
            </div>

            {lotError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {lotError}
              </div>
            )}

            <div className="mt-4 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200">
              {lotLoading ? (
                <div className="flex items-center justify-center px-6 py-10 text-sm text-slate-500">
                  Chargement des lots…
                </div>
              ) : lotItems.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-500">
                  Aucun lot enregistré pour ce vaccin.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Lot
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Expiration
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Quantité
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Restant
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Distribué
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Statut
                      </th>
                      <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lotItems.map((lot) => {
                      const expired = lot.status === "EXPIRED" || isDateExpired(lot.expiration);
                      return (
                        <tr
                          key={lot.id}
                          className={expired ? "bg-red-50/70 hover:bg-red-50" : "hover:bg-slate-50/80"}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{lot.id}</div>
                            {lot.sourceLotId && (
                              <div className="text-xs text-slate-500">
                                Issu du lot {lot.sourceLotId}
                              </div>
                            )}
                            {lot.derivedCount > 0 && (
                              <div className="text-xs text-slate-400">
                                {lot.derivedCount} lot(s) dérivé(s)
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                expired ? "font-medium text-red-600" : "font-medium text-slate-700"
                              }
                            >
                              {formatExpirationDate(lot.expiration)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {lot.quantity.toLocaleString("fr-FR")}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {lot.remainingQuantity.toLocaleString("fr-FR")}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {lot.distributedQuantity.toLocaleString("fr-FR")}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                expired
                                  ? "bg-red-100 text-red-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {expired ? "Expiré" : "Valide"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end">
                              {(user?.role === "SUPERADMIN" || user?.role === "NATIONAL" || expired) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLot(lot.id)}
                                  disabled={lotDeletingId === lot.id}
                                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {lotDeletingId === lot.id ? "Suppression…" : "Supprimer"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div>
                Total restant dans le stock national :{" "}
                <span className="font-semibold text-slate-800">
                  {lotTotalRemaining.toLocaleString("fr-FR")} dose(s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeNationalLotModal}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

type RegionalStock = {
  id: string;
  vaccineId: string;
  regionId: string;
  quantity: number | null;
  vaccine: VaccineInfo;
  region?: {
    id: string;
    name: string;
  } | null;
  hasExpiredLot?: boolean;
  nearestExpiration?: string | null;
  lotCount?: number;
  expiredLotCount?: number;
  expiredQuantity?: number;
};

type DistrictStock = {
  id: string;
  vaccineId: string;
  districtId: string;
  quantity: number | null;
  vaccine: VaccineInfo;
  district?: {
    id: string;
    name: string;
  } | null;
  hasExpiredLot?: boolean;
  nearestExpiration?: string | null;
  lotCount?: number;
  expiredLotCount?: number;
  expiredQuantity?: number;
};

type DistrictOption = {
  id: string;
  name: string;
  regionId?: string | null;
};

type HealthCenterOption = {
  id: string;
  name: string;
  districtId?: string | null;
};

type PendingTransfer = {
  id: string;
  vaccineId: string;
  vaccine: VaccineInfo;
  fromType: string;
  fromId: string | null;
  toType: string;
  toId: string | null;
  toName?: string | null;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  createdAt: string;
  confirmedAt: string | null;
  confirmedById: string | null;
  lots: Array<{
    id: string;
    lotId: string;
    quantity: number;
    lot: {
      id: string;
      expiration: string;
      quantity: number;
      remainingQuantity: number;
      status?: string;
    } | null;
  }>;
};

type TransferHistoryItem = {
  id: string;
  vaccineId: string;
  vaccineName: string;
  fromType: string;
  fromId: string | null;
  fromName: string | null;
  toType: string;
  toId: string | null;
  toName: string | null;
  quantity: number;
  sentAt: string;
  confirmedAt: string | null;
  confirmedById: string | null;
  confirmedByName: string | null;
  lotExpiration: string | null;
  lotStatus: string | null;
  status: string;
  createdAt: string;
};

type HealthCenterStock = {
  id: string;
  vaccineId: string;
  healthCenterId: string;
  quantity: number | null;
  vaccine: VaccineInfo;
  healthCenter?: {
    id: string;
    name: string;
  } | null;
  hasExpiredLot?: boolean;
  nearestExpiration?: string | null;
  lotCount?: number;
  expiredLotCount?: number;
  expiredQuantity?: number;
};

export function RegionalStocksPage() {
  const { accessToken, user } = useAuth();

  const [stocks, setStocks] = useState<RegionalStock[]>([]);
  const [vaccines, setVaccines] = useState<VaccineInfo[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<StockStats>(emptyStats);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createVaccineId, setCreateVaccineId] = useState("");
  const [creating, setCreating] = useState(false);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferContext, setTransferContext] = useState<RegionalStock | null>(null);
  const [transferDistrictId, setTransferDistrictId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [pendingDistrictCreation, setPendingDistrictCreation] = useState(false);
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [lotContext, setLotContext] = useState<LotModalContext | null>(null);
  const [lotItems, setLotItems] = useState<LotItem[]>([]);
  const [lotTotalRemaining, setLotTotalRemaining] = useState(0);
  const [lotLoading, setLotLoading] = useState(false);
  const [lotError, setLotError] = useState<string | null>(null);
  const [regionalDeletingId, setRegionalDeletingId] = useState<string | null>(null);
  const [lotDeletingId, setLotDeletingId] = useState<string | null>(null);
  
  // États pour l'ajustement
  const canAdjust = user?.role === "SUPERADMIN";
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateContext, setUpdateContext] = useState<{ vaccineId: string; vaccineName: string; currentQuantity: number; regionId?: string } | null>(null);
  const [updateQuantity, setUpdateQuantity] = useState<string>("");
  const [updateMode, setUpdateMode] = useState<"reduce" | "add">("add");
  const [reduceQuantity, setReduceQuantity] = useState<string>("");
  const [reduceRemaining, setReduceRemaining] = useState<number>(0);
  const [reduceLots, setReduceLots] = useState<LotItem[]>([]);
  const [reduceLoading, setReduceLoading] = useState(false);
  const [reduceError, setReduceError] = useState<string | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [reduceLotsLoaded, setReduceLotsLoaded] = useState(false);
  const [addQuantity, setAddQuantity] = useState<string>("");
  const [addQuantityError, setAddQuantityError] = useState<string | null>(null);
  const [addExpiration, setAddExpiration] = useState<string>("");
  const [updateExpiration, setUpdateExpiration] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  
  // États pour les onglets
  const [activeTab, setActiveTab] = useState<"stocks" | "pending-received" | "pending-sent" | "history">("stocks");
  
  // États pour les envois en attente (reçus)
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [pendingTransfersLoading, setPendingTransfersLoading] = useState(false);
  const [confirmingTransferId, setConfirmingTransferId] = useState<string | null>(null);
  const [rejectingTransferId, setRejectingTransferId] = useState<string | null>(null);
  
  // États pour les envois en cours (envoyés)
  const [sentTransfers, setSentTransfers] = useState<PendingTransfer[]>([]);
  const [sentTransfersLoading, setSentTransfersLoading] = useState(false);
  const [cancellingTransferId, setCancellingTransferId] = useState<string | null>(null);
  
  // États pour l'historique
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [historyFilters, setHistoryFilters] = useState({
    vaccineId: "",
    fromType: "",
    toType: "",
    sentStartDate: "",
    sentEndDate: "",
    confirmedStartDate: "",
    confirmedEndDate: "",
    search: "",
  });

  const [legendExpanded, setLegendExpanded] = useState(false);

  const fetchRegionalStats = useCallback(async () => {
    if (!accessToken) {
      setStats(emptyStats);
      setStatsLoading(false);
      return;
    }

    try {
      setStatsLoading(true);
      setStatsError(null);

      const response = await fetch(`${API_URL}/api/stock/stats/regional`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const payload = (await response.json()) as StockStats;
      setStats(payload);
    } catch (err) {
      console.error("Erreur récupération stats régionales:", err);
      setStats(emptyStats);
      setStatsError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les statistiques régionales"
      );
    } finally {
      setStatsLoading(false);
    }
  }, [accessToken]);

  const fetchRegionalStocks = useCallback(async () => {
    if (!accessToken) {
      setStocks([]);
      setVaccines([]);
      setDistricts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [stockRes, vaccineRes, districtRes] = await Promise.all([
        fetch(`${API_URL}/api/stock/regional`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        fetch(`${API_URL}/api/vaccine`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        fetch(`${API_URL}/api/district`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      ]);

      if (!stockRes.ok) {
        const errorText = await stockRes.text().catch(() => "Erreur inconnue");
        let errorMessage = "Erreur inconnue";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorText;
        } catch {
          errorMessage = errorText;
        }
        console.error("Erreur API stock/regional:", stockRes.status, errorMessage);
        throw new Error(`Erreur chargement stocks régionaux: ${stockRes.status} - ${errorMessage}`);
      }
      if (!vaccineRes.ok) {
        const errorText = await vaccineRes.text().catch(() => "Erreur inconnue");
        let errorMessage = "Erreur inconnue";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorText;
        } catch {
          errorMessage = errorText;
        }
        console.error("Erreur API vaccine:", vaccineRes.status, errorMessage);
        throw new Error(`Erreur chargement vaccins: ${vaccineRes.status} - ${errorMessage}`);
      }
      if (!districtRes.ok) {
        const errorText = await districtRes.text().catch(() => "Erreur inconnue");
        let errorMessage = "Erreur inconnue";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorText;
        } catch {
          errorMessage = errorText;
        }
        console.error("Erreur API district:", districtRes.status, errorMessage);
        throw new Error(`Erreur chargement districts: ${districtRes.status} - ${errorMessage}`);
      }

      const stockPayload = (await stockRes.json()) as { regional?: RegionalStock[] };
      const vaccinePayload: VaccineResponse = await vaccineRes.json();
      const districtPayload = await districtRes.json();

      const stocksList = Array.isArray(stockPayload?.regional) ? stockPayload.regional : [];
      
      // Charger les lots pour chaque stock et calculer les statistiques
      const stocksWithLots = await Promise.all(
        stocksList.map(async (stock) => {
          try {
            const lotsRes = await fetch(`${API_URL}/api/stock/regional/${stock.vaccineId}/lots`, {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
            });
            
            if (lotsRes.ok) {
              const lotsData: LotResponse = await lotsRes.json();
              const lots = lotsData.lots || [];
              const expiredLots = lots.filter((lot) => lot.status === "EXPIRED" || isDateExpired(lot.expiration));
              const expiredQuantity = expiredLots.reduce((sum, lot) => sum + lot.quantity, 0);
              
              return {
                ...stock,
                lotCount: lots.length,
                expiredLotCount: expiredLots.length,
                expiredQuantity,
              };
            }
          } catch (err) {
            console.error(`Erreur chargement lots pour ${stock.vaccineId}:`, err);
          }
          
          return {
            ...stock,
            lotCount: 0,
            expiredLotCount: 0,
            expiredQuantity: 0,
          };
        })
      );
      
      setStocks(stocksWithLots);
      setVaccines(
        Array.isArray(vaccinePayload)
          ? vaccinePayload
          : Array.isArray(vaccinePayload?.vaccines)
          ? vaccinePayload.vaccines
          : []
      );

      const districtItems = Array.isArray(districtPayload?.items)
        ? districtPayload.items
        : Array.isArray(districtPayload)
        ? districtPayload
        : [];

      setDistricts(
        districtItems.map((district: any) => ({
          id: district.id,
          name: district.name,
          regionId: district.commune?.region?.id ?? district.commune?.regionId ?? null,
        }))
      );
    } catch (err) {
      console.error("Erreur chargement stocks régionaux:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les stocks régionaux"
      );
      setStocks([]);
      setVaccines([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const fetchRegionalLots = useCallback(
    async (vaccineId: string, regionId?: string | null) => {
      if (!accessToken) return;
      try {
        setLotLoading(true);
        setLotError(null);

        const params = new URLSearchParams();
        if (regionId) {
          params.set("regionId", regionId);
        }

        const response = await fetch(
          `${API_URL}/api/stock/regional/${vaccineId}/lots${
            params.toString() ? `?${params.toString()}` : ""
          }`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        const payload = (await response.json()) as LotResponse;
        setLotItems(Array.isArray(payload?.lots) ? payload.lots : []);
        setLotTotalRemaining(payload?.totalRemaining ?? 0);
      } catch (err) {
        console.error("Erreur chargement lots régionaux:", err);
        setLotItems([]);
        setLotTotalRemaining(0);
        setLotError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les lots pour ce vaccin.",
        );
      } finally {
        setLotLoading(false);
      }
    },
    [accessToken],
  );

  const fetchPendingTransfers = useCallback(async () => {
    if (!accessToken) {
      setPendingTransfers([]);
      setPendingTransfersLoading(false);
      return;
    }
    try {
      setPendingTransfersLoading(true);
      const response = await fetch(`${API_URL}/api/stock/pending-transfers`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const payload = (await response.json()) as { transfers?: any[] };
      setPendingTransfers(Array.isArray(payload?.transfers) ? payload.transfers : []);
    } catch (err) {
      console.error("Erreur chargement envois en attente:", err);
      setPendingTransfers([]);
    } finally {
      setPendingTransfersLoading(false);
    }
  }, [accessToken]);

  const handleConfirmTransfer = useCallback(
    async (transferId: string) => {
      if (!accessToken) return;
      try {
        setConfirmingTransferId(transferId);
        const response = await fetch(
          `${API_URL}/api/stock/pending-transfers/${transferId}/confirm`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        // Recharger les données
        await Promise.all([
          fetchPendingTransfers(),
          fetchRegionalStocks(),
          fetchRegionalStats(),
        ]);
      } catch (err) {
        console.error("Erreur confirmation envoi:", err);
        alert(
          err instanceof Error
            ? err.message
            : "Impossible de confirmer la réception du stock.",
        );
      } finally {
        setConfirmingTransferId(null);
      }
    },
    [accessToken, fetchPendingTransfers, fetchRegionalStocks, fetchRegionalStats],
  );

  // Fonction pour récupérer les transferts envoyés
  const fetchSentTransfers = useCallback(async () => {
    if (!accessToken) {
      setSentTransfers([]);
      setSentTransfersLoading(false);
      return;
    }
    try {
      setSentTransfersLoading(true);
      const response = await fetch(`${API_URL}/api/stock/pending-transfers/sent`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const payload = (await response.json()) as { transfers?: PendingTransfer[] };
      setSentTransfers(Array.isArray(payload?.transfers) ? payload.transfers : []);
    } catch (err) {
      console.error("Erreur chargement envois envoyés:", err);
      setSentTransfers([]);
    } finally {
      setSentTransfersLoading(false);
    }
  }, [accessToken]);

  // Fonction pour récupérer l'historique
  const fetchTransferHistory = useCallback(async () => {
    if (!accessToken) return;
    try {
      setHistoryLoading(true);
      const params = new URLSearchParams({
        page: historyPage.toString(),
        limit: "20",
      });
      
      if (historyFilters.vaccineId) params.append("vaccineId", historyFilters.vaccineId);
      if (historyFilters.fromType) params.append("fromType", historyFilters.fromType);
      if (historyFilters.toType) params.append("toType", historyFilters.toType);
      if (historyFilters.sentStartDate) params.append("sentStartDate", historyFilters.sentStartDate);
      if (historyFilters.sentEndDate) params.append("sentEndDate", historyFilters.sentEndDate);
      if (historyFilters.confirmedStartDate) params.append("confirmedStartDate", historyFilters.confirmedStartDate);
      if (historyFilters.confirmedEndDate) params.append("confirmedEndDate", historyFilters.confirmedEndDate);
      if (historyFilters.search) params.append("search", historyFilters.search);

      const response = await fetch(`${API_URL}/api/stock/transfer-history?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const payload = (await response.json()) as {
        history?: TransferHistoryItem[];
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
      };
      
      setTransferHistory(Array.isArray(payload?.history) ? payload.history : []);
      setHistoryTotal(payload?.total ?? 0);
      setHistoryTotalPages(payload?.totalPages ?? 0);
    } catch (err) {
      console.error("Erreur chargement historique:", err);
      setTransferHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [accessToken, historyPage, historyFilters]);

  // Fonction pour refuser un transfert
  const handleRejectTransfer = useCallback(
    async (transferId: string) => {
      if (!accessToken) return;
      const confirmed = window.confirm(
        "Êtes-vous sûr de vouloir refuser ce transfert ? Les quantités seront restaurées chez l'expéditeur."
      );
      if (!confirmed) return;

      try {
        setRejectingTransferId(transferId);
        const response = await fetch(
          `${API_URL}/api/stock/pending-transfers/${transferId}/reject`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        await Promise.all([
          fetchPendingTransfers(),
          fetchRegionalStocks(),
          fetchRegionalStats(),
        ]);
      } catch (err) {
        console.error("Erreur refus transfert:", err);
        alert(
          err instanceof Error
            ? err.message
            : "Impossible de refuser le transfert.",
        );
      } finally {
        setRejectingTransferId(null);
      }
    },
    [accessToken, fetchPendingTransfers, fetchRegionalStocks, fetchRegionalStats],
  );

  // Fonction pour annuler un transfert
  const handleCancelTransfer = useCallback(
    async (transferId: string) => {
      if (!accessToken) return;
      const confirmed = window.confirm(
        "Êtes-vous sûr de vouloir annuler ce transfert ? Les quantités seront restaurées dans votre stock."
      );
      if (!confirmed) return;

      try {
        setCancellingTransferId(transferId);
        const response = await fetch(
          `${API_URL}/api/stock/pending-transfers/${transferId}/cancel`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        await Promise.all([
          fetchSentTransfers(),
          fetchRegionalStocks(),
          fetchRegionalStats(),
        ]);
      } catch (err) {
        console.error("Erreur annulation transfert:", err);
        alert(
          err instanceof Error
            ? err.message
            : "Impossible d'annuler le transfert.",
        );
      } finally {
        setCancellingTransferId(null);
      }
    },
    [accessToken, fetchSentTransfers, fetchRegionalStocks, fetchRegionalStats],
  );

  useEffect(() => {
    fetchRegionalStocks();
    fetchRegionalStats();
    if (activeTab === "pending-received") {
      fetchPendingTransfers();
    } else if (activeTab === "pending-sent") {
      fetchSentTransfers();
    } else if (activeTab === "history") {
      fetchTransferHistory();
    } else {
      fetchPendingTransfers();
    }
  }, [fetchRegionalStocks, fetchRegionalStats, fetchPendingTransfers, activeTab, fetchSentTransfers, fetchTransferHistory]);

  const availableVaccinesForCreation = useMemo(() => {
    const existing = new Set(stocks.map((stock) => stock.vaccineId));
    return vaccines.filter((vaccine) => !existing.has(vaccine.id));
  }, [stocks, vaccines]);

  const handleOpenRegionalLotModal = useCallback(
    (stock: RegionalStock) => {
      const regionLabel = stock.region?.name ?? "votre région";
      setLotContext({
        vaccineId: stock.vaccineId,
        vaccineName: stock.vaccine.name,
        ownerLabel: regionLabel,
        ownerId: stock.regionId ?? null,
      });
      setLotItems([]);
      setLotTotalRemaining(0);
      setLotError(null);
      setLotModalOpen(true);
      void fetchRegionalLots(stock.vaccineId, stock.regionId ?? null);
    },
    [fetchRegionalLots],
  );

  const closeRegionalLotModal = useCallback(() => {
    setLotModalOpen(false);
    setLotContext(null);
    setLotItems([]);
    setLotTotalRemaining(0);
    setLotError(null);
  }, []);


  const handleDeleteRegionalLot = useCallback(
    async (lotId: string) => {
      if (!accessToken || !lotContext) return;
      try {
        setLotDeletingId(lotId);
        const response = await fetch(`${API_URL}/api/stock/lots/${lotId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        await fetchRegionalLots(lotContext.vaccineId, lotContext.ownerId ?? null);
        await Promise.all([fetchRegionalStocks(), fetchRegionalStats()]);
      } catch (err) {
        console.error("Erreur suppression lot:", err);
        setLotError(
          err instanceof Error
            ? err.message
            : "Impossible de supprimer le lot sélectionné.",
        );
      } finally {
        setLotDeletingId(null);
      }
    },
    [
      accessToken,
      fetchRegionalLots,
      fetchRegionalStats,
      fetchRegionalStocks,
      lotContext,
    ],
  );

  const handleDeleteRegionalStock = useCallback(
    async (stock: RegionalStock) => {
      if (!accessToken) return;
      const confirmed = window.confirm(
        `Supprimer le stock régional pour le vaccin ${stock.vaccine.name} ?`,
      );
      if (!confirmed) {
        return;
      }

      try {
        setRegionalDeletingId(stock.id);
        setError(null);

        const payload: Record<string, string> = { vaccineId: stock.vaccineId };
        if (stock.regionId) {
          payload.regionId = stock.regionId;
        }

        const response = await fetch(`${API_URL}/api/stock/regional`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.message ?? `status ${response.status}`);
        }

        await Promise.all([fetchRegionalStocks(), fetchRegionalStats()]);
      } catch (err) {
        console.error("Erreur suppression stock régional:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de supprimer ce stock régional.",
        );
      } finally {
        setRegionalDeletingId(null);
      }
    },
    [accessToken, fetchRegionalStocks, fetchRegionalStats],
  );

  const handleCreateStock = async (event: FormEvent) => {
    event.preventDefault();
    if (!createVaccineId || !accessToken) return;

    try {
      setCreating(true);
      const response = await fetch(`${API_URL}/api/stock/regional`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ vaccineId: createVaccineId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      setCreateModalOpen(false);
      setCreateVaccineId("");
      await Promise.all([fetchRegionalStocks(), fetchRegionalStats()]);
    } catch (err) {
      console.error("Erreur création stock régional:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer le stock régional"
      );
    } finally {
      setCreating(false);
    }
  };

  const openTransferModal = (stock: RegionalStock) => {
    setTransferContext(stock);
    setTransferDistrictId("");
    setTransferQuantity("");
    setTransferError(null);
    setPendingDistrictCreation(false);
    setTransferModalOpen(true);
  };

  const handleTransferSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !transferContext) return;

    const quantityValue = Number(transferQuantity);
    if (!transferDistrictId || !Number.isFinite(quantityValue) || quantityValue <= 0) {
      setTransferError("Sélectionnez un district et saisissez une quantité valide.");
      return;
    }

    try {
      setTransferLoading(true);
      setTransferError(null);
      setPendingDistrictCreation(false);

      const response = await fetch(`${API_URL}/api/stock/add-district`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          vaccineId: transferContext.vaccineId,
          districtId: transferDistrictId,
          quantity: quantityValue,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          setTransferError(
            "Ce district n'a pas encore de stock pour ce vaccin. Créez-le puis recommencez."
          );
          setPendingDistrictCreation(true);
        } else {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }
        return;
      }

      setTransferModalOpen(false);
      setTransferContext(null);
      setTransferDistrictId("");
      setTransferQuantity("");
      await Promise.all([fetchRegionalStocks(), fetchRegionalStats()]);
    } catch (err) {
      console.error("Erreur transfert district:", err);
      setTransferError(
        err instanceof Error ? err.message : "Impossible de transférer le stock"
      );
    } finally {
      setTransferLoading(false);
    }
  };

  const handleCreateDistrictStock = async () => {
    if (!accessToken || !transferContext || !transferDistrictId) return;

    try {
      setTransferLoading(true);
      setTransferError(null);

      const response = await fetch(`${API_URL}/api/stock/district`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          vaccineId: transferContext.vaccineId,
          districtId: transferDistrictId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      setTransferError(
        "Stock district créé. Vous pouvez maintenant effectuer le transfert."
      );
      setPendingDistrictCreation(false);
    } catch (err) {
      console.error("Erreur création stock district:", err);
      setTransferError(
        err instanceof Error
          ? err.message
          : "Impossible de créer le stock district"
      );
    } finally {
      setTransferLoading(false);
    }
  };

  // Fonctions pour l'ajustement
  const openUpdateModal = async (stock: RegionalStock) => {
    setUpdateContext({
      vaccineId: stock.vaccineId,
      vaccineName: stock.vaccine.name,
      currentQuantity: stock.quantity ?? 0,
      regionId: stock.regionId,
    });
    setUpdateQuantity(String(stock.quantity ?? 0));
    setUpdateMode("add");
    setAddQuantity("");
    setAddExpiration("");
    setUpdateExpiration("");
    setAddQuantityError(null);
    setReduceQuantity("");
    setReduceRemaining(0);
    setReduceLots([]);
    setReduceError(null);
    setSelectedLotId(null);
    setReduceLotsLoaded(false);
    setUpdateModalOpen(true);
  };

  const resetUpdateModal = () => {
    setUpdateModalOpen(false);
    setUpdateContext(null);
    setUpdateQuantity("");
    setAddQuantity("");
    setAddExpiration("");
    setUpdateExpiration("");
    setAddQuantityError(null);
    setUpdating(false);
    setReduceQuantity("");
    setReduceRemaining(0);
    setReduceLots([]);
    setReduceError(null);
    setSelectedLotId(null);
    setReduceLotsLoaded(false);
  };

  const loadLotsForReduce = useCallback(async () => {
    if (!updateContext?.vaccineId || !accessToken) return;

    try {
      setReduceLoading(true);
      setReduceError(null);
      const response = await fetch(
        `${API_URL}/api/stock/regional/${updateContext.vaccineId}/lots`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Impossible de charger les lots");
      }

      const payload: LotResponse = await response.json();
      const validLots = payload.lots.filter((lot) => lot.remainingQuantity > 0);
      setReduceLots(validLots);
      setReduceRemaining(payload.totalRemaining);
      setReduceLotsLoaded(true); // Marquer comme chargé pour éviter les rechargements en boucle
      
      // Réinitialiser selectedLotId si le lot sélectionné n'existe plus dans les lots valides
      setSelectedLotId((currentSelectedId) => {
        if (currentSelectedId && !validLots.find((lot) => lot.id === currentSelectedId)) {
          return null;
        }
        return currentSelectedId;
      });
    } catch (err) {
      console.error("Erreur chargement lots:", err);
      setReduceError(
        err instanceof Error ? err.message : "Impossible de charger les lots"
      );
      setReduceLotsLoaded(true); // Marquer comme chargé même en cas d'erreur pour éviter les boucles
    } finally {
      setReduceLoading(false);
    }
  }, [updateContext?.vaccineId, accessToken]);

  // Réinitialiser le flag quand on change de mode ou de contexte
  useEffect(() => {
    if (updateMode === "add" || !updateContext?.vaccineId) {
      setReduceLotsLoaded(false);
    }
  }, [updateMode, updateContext?.vaccineId]);

  // Quand on passe en mode reduce, charger les lots une seule fois
  useEffect(() => {
    if (updateMode === "reduce" && updateContext?.vaccineId && !reduceLotsLoaded && !reduceLoading) {
      loadLotsForReduce();
    }
  }, [updateMode, updateContext?.vaccineId, loadLotsForReduce, reduceLotsLoaded, reduceLoading]);

  const handleAddQuantitySubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!updateContext || !accessToken) return;

    const quantityValue = Number(addQuantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setAddQuantityError("Veuillez saisir une quantité valide.");
      return;
    }

    if (!addExpiration) {
      setAddQuantityError("Veuillez indiquer la date d'expiration du lot ajouté.");
      return;
    }

    try {
      setAddQuantityError(null);
      setUpdating(true);

      // Pour SUPERADMIN, utiliser updateStock qui crée directement un lot sans prélever du niveau supérieur
      // Pour les autres rôles, utiliser addStock qui prélève du niveau supérieur
      const isSuperAdmin = user?.role === "SUPERADMIN";
      
      if (isSuperAdmin && updateContext.regionId) {
        // Utiliser updateStockREGIONAL pour créer directement un lot
        const currentQuantity = updateContext.currentQuantity ?? 0;
        const newTotalQuantity = currentQuantity + quantityValue;
        
        const response = await fetch(`${API_URL}/api/stock/regional`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            vaccineId: updateContext.vaccineId,
            regionId: updateContext.regionId,
            quantity: newTotalQuantity,
            expiration: `${addExpiration}T00:00:00.000Z`,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }
      } else {
        // Utiliser addStockREGIONAL qui prélève du stock national
        // Note: Cette branche ne devrait jamais s'exécuter car canAdjust est true uniquement pour SUPERADMIN
        const response = await fetch(`${API_URL}/api/stock/add-regional`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            vaccineId: updateContext.vaccineId,
            regionId: updateContext.regionId,
            quantity: quantityValue,
            expiration: `${addExpiration}T00:00:00.000Z`,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }
      }

      resetUpdateModal();
      await Promise.all([fetchRegionalStocks(), fetchRegionalStats()]);
    } catch (err) {
      console.error("Erreur ajout stock régional:", err);
      setAddQuantityError(
        err instanceof Error
          ? err.message
          : "Impossible d'ajouter au stock régional"
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleReduceLotSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!updateContext || !accessToken || !selectedLotId) return;

    // Vérifier qu'il y a des lots disponibles
    if (reduceLots.length === 0) {
      setReduceError("Aucun lot disponible avec une quantité restante.");
      return;
    }

    const quantityValue = Number(reduceQuantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setReduceError("Veuillez saisir une quantité valide supérieure à 0.");
      return;
    }

    const selectedLot = reduceLots.find((lot) => lot.id === selectedLotId);
    if (!selectedLot) {
      setReduceError("Lot sélectionné introuvable. Veuillez sélectionner un lot disponible.");
      setSelectedLotId(null);
      return;
    }

    // Vérifier que la quantité à réduire ne dépasse pas le stock disponible
    if (quantityValue > selectedLot.remainingQuantity) {
      setReduceError(
        `La quantité à réduire (${quantityValue.toLocaleString("fr-FR")}) dépasse le stock disponible (${selectedLot.remainingQuantity.toLocaleString("fr-FR")} doses).`
      );
      return;
    }

    const actualQuantityToReduce = quantityValue;

    try {
      setReduceError(null);
      setUpdating(true);

      const response = await fetch(
        `${API_URL}/api/stock/regional/lot/${selectedLotId}/reduce`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            quantity: actualQuantityToReduce,
          }),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Erreur lors de la diminution");
      }

      await loadLotsForReduce();
      
      // La diminution est terminée
      resetUpdateModal();
      await Promise.all([fetchRegionalStocks(), fetchRegionalStats()]);
    } catch (err) {
      console.error("Erreur diminution stock régional:", err);
      setReduceError(
        err instanceof Error
          ? err.message
          : "Impossible de diminuer le stock régional"
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <DashboardShell active="/dashboard/stocks">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {user?.role !== "SUPERADMIN" && (
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Stocks & lots</h2>
              <p className="text-sm text-slate-500">
                Suivi des stocks régionaux et distribution vers les districts.
              </p>
            </div>
          )}
          
          {/* Boutons d'action et onglets */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* Bouton Nouveau lot */}
            {activeTab === "stocks" && (
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                disabled={availableVaccinesForCreation.length === 0}
              >
                <Plus className="h-4 w-4" />
                Nouveau lot
              </button>
            )}
            
            {/* Onglets */}
            <div className="border-b border-slate-200 md:border-b-0">
              <nav className="-mb-px flex space-x-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("stocks")}
                  className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "stocks"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Stocks
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pending-received")}
                  className={`relative whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "pending-received"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Envois en attente
                  {pendingTransfers.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
                      {pendingTransfers.length > 99 ? "99+" : pendingTransfers.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pending-sent")}
                  className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "pending-sent"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Envois en cours
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "history"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Historique
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Contenu des onglets */}
        {activeTab === "stocks" && (
          <>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title="Total de doses"
            value={
              statsLoading ? "…" : stats.totalQuantity.toLocaleString("fr-FR")
            }
            icon={Syringe}
            accent="emerald"
            loading={statsLoading}
          />
          <StatCard
            title="Stocks faibles"
            value={statsLoading ? "…" : stats.lowStockCount}
            icon={AlertTriangle}
            accent="red"
            loading={statsLoading}
          />
          <StatCard
            title="Lots expirés"
            value={stats.expiredLots}
            icon={AlertTriangle}
            accent="red"
            loading={statsLoading}
          />
        </div>

        {statsError && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-700">
            {statsError}
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {pendingTransfers.length > 0 && (
          <div className="rounded-3xl border border-blue-200 bg-blue-50/80 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
                  <PackageOpen className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    {pendingTransfers.length} envoi{pendingTransfers.length > 1 ? "s" : ""} en attente de confirmation
                  </p>
                  <p className="text-xs text-blue-700">
                    Veuillez confirmer ou refuser les transferts reçus
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("pending-received")}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Voir les envois
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-blue-100 bg-blue-50/50 mb-4">
          <button
            type="button"
            onClick={() => setLegendExpanded(!legendExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-blue-100/50 transition rounded-xl"
          >
            <div className="flex items-center gap-2 flex-1">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <h4 className="text-xs font-semibold text-blue-900">Qu'est-ce qu'un lot ?</h4>
            </div>
            {legendExpanded ? (
              <ChevronUp className="h-4 w-4 text-blue-600 flex-shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-blue-600 flex-shrink-0" />
            )}
          </button>
          {legendExpanded && (
            <div className="px-3 pb-2 pt-1">
              <p className="text-xs text-blue-800 leading-relaxed">
                Un <strong>lot</strong> représente un ensemble de doses d'un vaccin avec une même date d'expiration. 
                Chaque stock peut contenir plusieurs lots, chacun ayant sa propre date d'expiration. 
                Les lots permettent de gérer efficacement la traçabilité et le suivi des vaccins, notamment pour identifier 
                les doses expirées et optimiser la distribution selon les dates d'expiration.
              </p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Vaccin
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Quantité (région)
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Nombre de lots
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                    Chargement des stocks régionaux…
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                    Aucun stock régional enregistré pour le moment.
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => {
                  const lotCount = stock.lotCount ?? 0;
                  const expiredLotCount = stock.expiredLotCount ?? 0;
                  const expiredQuantity = stock.expiredQuantity ?? 0;
                  const totalQuantity = stock.quantity ?? 0;
                  const validQuantity = totalQuantity - expiredQuantity;
                  const validLotCount = lotCount - expiredLotCount;
                  
                  // Vérifier si le stock peut être envoyé
                  const canSend = lotCount > 0 && validLotCount > 0 && validQuantity > 0;
                  const disabledReason = lotCount === 0 
                    ? "Aucun lot disponible pour ce vaccin"
                    : validLotCount === 0
                    ? "Tous les lots sont expirés"
                    : validQuantity === 0
                    ? "Toutes les quantités sont expirées"
                    : "";
                  
                  return (
                    <tr
                      key={stock.id}
                      className="hover:bg-slate-50/80"
                    >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {stock.vaccine.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {stock.vaccine.description}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">
                        {(stock.quantity ?? 0).toLocaleString("fr-FR")}
                        {expiredQuantity > 0 && (
                          <span className="ml-2 text-sm font-normal text-red-600">
                            ({expiredQuantity.toLocaleString("fr-FR")} expiré{expiredQuantity > 1 ? "s" : ""})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {stock.region?.name ?? "Votre région"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-slate-700">
                        {lotCount} lot{lotCount > 1 ? "s" : ""}
                        {expiredLotCount > 0 && (
                          <span className="ml-2 text-red-600">
                            - {expiredLotCount} expiré{expiredLotCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenRegionalLotModal(stock)}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                        >
                          <PackageOpen className="h-4 w-4" />
                          Lots
                        </button>
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={() => canSend && openTransferModal(stock)}
                            disabled={!canSend}
                            className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-50"
                            title={!canSend ? disabledReason : undefined}
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                            Envoyer
                          </button>
                          {!canSend && (
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10 w-48 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
                              {disabledReason}
                              <div className="absolute top-full right-4 -mt-1 h-2 w-2 rotate-45 bg-slate-900"></div>
                            </div>
                          )}
                        </div>
                        {canAdjust && (
                          <button
                            type="button"
                            onClick={() => openUpdateModal(stock)}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-100"
                          >
                            Ajuster
                          </button>
                        )}
                        {(user?.role === "SUPERADMIN" || (stock.expiredLotCount ?? 0) > 0) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRegionalStock(stock)}
                            disabled={regionalDeletingId === stock.id}
                            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                          >
                            <Trash2 className="h-4 w-4" />
                            {regionalDeletingId === stock.id ? "Suppression…" : "Supprimer"}
                          </button>
                        )}
                      </div>
                    </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
          </>
        )}

        {activeTab === "pending-sent" && (
          <div className="space-y-6">
            {sentTransfersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : sentTransfers.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                <PackageOpen className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-sm font-medium text-slate-900">Aucun envoi en cours</p>
                <p className="mt-2 text-sm text-slate-500">
                  Vous n'avez aucun transfert en attente de confirmation.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Vaccin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Destinataire
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Quantité
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Date d'envoi
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {sentTransfers.map((transfer) => {
                      const sentDate = new Date(transfer.createdAt);
                      return (
                        <tr key={transfer.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-slate-900">
                              {transfer.vaccine?.name ?? "Vaccin inconnu"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {formatEntityName(transfer.toType, transfer.toName)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {transfer.quantity.toLocaleString("fr-FR")} doses
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {sentDate.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleCancelTransfer(transfer.id)}
                                disabled={cancellingTransferId === transfer.id}
                                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                              >
                                {cancellingTransferId === transfer.id ? (
                                  <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                    Annulation...
                                  </>
                                ) : (
                                  <>
                                    <X className="h-4 w-4" />
                                    Annuler
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "pending-received" && (
          <div className="space-y-6">
            {pendingTransfersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : pendingTransfers.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                <PackageOpen className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-sm font-medium text-slate-900">Aucun envoi en attente</p>
                <p className="mt-2 text-sm text-slate-500">
                  Vous n'avez aucun transfert en attente de confirmation.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-hidden rounded-2xl md:rounded-3xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Vaccin
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Expéditeur
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Quantité
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Date d'envoi
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-right text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {pendingTransfers.map((transfer) => {
                      const sentDate = new Date(transfer.createdAt);
                      return (
                        <tr key={transfer.id} className="hover:bg-slate-50">
                          <td className="px-2 md:px-6 py-2 md:py-4">
                            <div className="text-xs md:text-sm font-medium text-slate-900">
                              {transfer.vaccine?.name ?? "Vaccin inconnu"}
                            </div>
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-700">
                            {formatEntityName(transfer.fromType, transfer.fromName)}
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-700">
                            {transfer.quantity.toLocaleString("fr-FR")} doses
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-600">
                            {sentDate.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4">
                            <div className="flex justify-end gap-1 md:gap-2">
                              <button
                                type="button"
                                onClick={() => handleRejectTransfer(transfer.id)}
                                disabled={rejectingTransferId === transfer.id}
                                className="flex items-center gap-1 md:gap-2 rounded-lg md:rounded-xl border border-red-200 bg-red-50 px-2 md:px-4 py-1 md:py-2 text-[10px] md:text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                              >
                                {rejectingTransferId === transfer.id ? (
                                  <>
                                    <div className="h-3 w-3 md:h-4 md:w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                    <span className="hidden sm:inline">Refus...</span>
                                    <span className="sm:hidden">...</span>
                                  </>
                                ) : (
                                  <>
                                    <X className="h-3 w-3 md:h-4 md:w-4" />
                                    <span className="hidden sm:inline">Refuser</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmTransfer(transfer.id)}
                                disabled={confirmingTransferId === transfer.id}
                                className="flex items-center gap-1 md:gap-2 rounded-lg md:rounded-xl bg-emerald-600 px-2 md:px-4 py-1 md:py-2 text-[10px] md:text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {confirmingTransferId === transfer.id ? (
                                  <>
                                    <div className="h-3 w-3 md:h-4 md:w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    <span className="hidden sm:inline">Confirmation...</span>
                                    <span className="sm:hidden">...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-3 w-3 md:h-4 md:w-4" />
                                    <span className="hidden sm:inline">Confirmer</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-6">
            {/* Filtres */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Historique des envois</h3>
                <p className="text-sm text-slate-500">
                  Tous les transferts de stock confirmés
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="w-[180px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Rechercher
                  </label>
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={historyFilters.search}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, search: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                
                {/* Bloc Date d'envoi */}
                <div className="w-[280px] rounded-xl border-2 border-blue-200 bg-blue-50/30 p-3">
                  <label className="mb-2 block text-xs font-semibold text-blue-700">
                    Date d'envoi
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Du
                      </label>
                      <input
                        type="date"
                        value={historyFilters.sentStartDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, sentStartDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Au
                      </label>
                      <input
                        type="date"
                        value={historyFilters.sentEndDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, sentEndDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Bloc Date de confirmation/annulation */}
                <div className="w-[280px] rounded-xl border-2 border-green-200 bg-green-50/30 p-3">
                  <label className="mb-2 block text-xs font-semibold text-green-700">
                    Date de confirmation/annulation
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Du
                      </label>
                      <input
                        type="date"
                        value={historyFilters.confirmedStartDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, confirmedStartDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Au
                      </label>
                      <input
                        type="date"
                        value={historyFilters.confirmedEndDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, confirmedEndDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="w-[140px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Expéditeur
                  </label>
                  <select
                    value={historyFilters.fromType}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, fromType: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Tous expéditeurs</option>
                    <option value="NATIONAL">National</option>
                    <option value="REGIONAL">Régional</option>
                    <option value="DISTRICT">District</option>
                    <option value="HEALTHCENTER">Centre de santé</option>
                  </select>
                </div>
                <div className="w-[140px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Destinataire
                  </label>
                  <select
                    value={historyFilters.toType}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, toType: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Tous destinataires</option>
                    <option value="REGIONAL">Régional</option>
                    <option value="DISTRICT">District</option>
                    <option value="HEALTHCENTER">Centre de santé</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      // Validation : si une date de début est remplie, la date de fin doit l'être aussi
                      if (
                        (historyFilters.sentStartDate && !historyFilters.sentEndDate) ||
                        (!historyFilters.sentStartDate && historyFilters.sentEndDate) ||
                        (historyFilters.confirmedStartDate && !historyFilters.confirmedEndDate) ||
                        (!historyFilters.confirmedStartDate && historyFilters.confirmedEndDate)
                      ) {
                        alert("Veuillez remplir les deux dates (du et au) pour chaque période de filtrage.");
                        return;
                      }
                      setHistoryPage(1);
                      fetchTransferHistory();
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                  >
                    <Search className="h-4 w-4" />
                    Filtrer
                  </button>
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : transferHistory.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                <PackageOpen className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-sm font-medium text-slate-900">Aucun historique</p>
                <p className="mt-2 text-sm text-slate-500">
                  Aucun transfert confirmé pour le moment.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Vaccin
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Expéditeur
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Destinataire
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Quantité
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Date envoi
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Confirmation/annulation
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Expiration lot
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {transferHistory.map((item) => {
                        const sentDate = new Date(item.sentAt);
                        const confirmedDate = item.confirmedAt ? new Date(item.confirmedAt) : null;
                        const expirationDate = item.lotExpiration ? new Date(item.lotExpiration) : null;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-900">
                                {item.vaccineName}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              {formatEntityName(item.fromType, item.fromName)}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              {formatEntityName(item.toType, item.toName)}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              {item.quantity.toLocaleString("fr-FR")} doses
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {sentDate.toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {confirmedDate
                                ? confirmedDate.toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "N/A"}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {expirationDate
                                ? expirationDate.toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  item.status === "CONFIRMED"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {item.status === "CONFIRMED" ? "Confirmé" : "Annulé"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {historyTotalPages > 1 && (
                  <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-6 py-4">
                    <div className="text-sm text-slate-700">
                      Page {historyPage} sur {historyTotalPages} ({historyTotal} résultats)
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryPage((p) => Math.max(1, p - 1));
                        }}
                        disabled={historyPage === 1}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Précédent
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryPage((p) => Math.min(historyTotalPages, p + 1));
                        }}
                        disabled={historyPage === historyTotalPages}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-lg rounded-3xl bg-white shadow-2xl">
            <form onSubmit={handleCreateStock} className="space-y-4 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Créer un stock régional
              </h3>
              <p className="text-sm text-slate-500">
                Sélectionnez un vaccin qui n'a pas encore de stock pour votre région.
              </p>

              <select
                value={createVaccineId}
                onChange={(event) => setCreateVaccineId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                required
              >
                <option value="">— Sélectionner un vaccin —</option>
                {availableVaccinesForCreation.map((vaccine) => (
                  <option key={vaccine.id} value={vaccine.id}>
                    {vaccine.name}
                  </option>
                ))}
              </select>

              {availableVaccinesForCreation.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  Tous les vaccins possèdent déjà un stock régional.
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setCreateVaccineId("");
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating || availableVaccinesForCreation.length === 0}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {creating ? "Création…" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transferModalOpen && transferContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-lg rounded-3xl bg-white shadow-2xl">
            <form onSubmit={handleTransferSubmit} className="space-y-4 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Envoyer du stock — {transferContext.vaccine.name}
              </h3>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">
                  District
                </label>
                <select
                  value={transferDistrictId}
                  onChange={(event) => {
                    setTransferDistrictId(event.target.value);
                    setTransferError(null);
                    setPendingDistrictCreation(false);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                >
                  <option value="">— Sélectionner un district —</option>
                  {districts
                    .filter((district) => {
                      // Pour SUPERADMIN, filtrer par la région du stock qu'on transfère
                      if (user?.role === "SUPERADMIN" && transferContext?.regionId) {
                        return district.regionId === transferContext.regionId;
                      }
                      // Pour les autres rôles, tous les districts sont déjà filtrés par l'API
                      return true;
                    })
                    .map((district) => (
                      <option key={district.id} value={district.id}>
                        {district.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">
                  Quantité à envoyer
                </label>
                <input
                  value={transferQuantity}
                  onChange={(event) => setTransferQuantity(event.target.value)}
                  type="number"
                  min="1"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              {transferError && (
                <div
                  className={`rounded-xl border p-3 text-sm ${
                    pendingDistrictCreation
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {transferError}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3">
                {pendingDistrictCreation && (
                  <button
                    type="button"
                    onClick={handleCreateDistrictStock}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
                  >
                    Créer le stock district
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setTransferModalOpen(false);
                    setTransferContext(null);
                    setTransferDistrictId("");
                    setTransferQuantity("");
                    setTransferError(null);
                    setPendingDistrictCreation(false);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {transferLoading ? "Transfert…" : "Envoyer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lotModalOpen && lotContext && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-[95vw] md:max-w-3xl rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Lots du vaccin {lotContext.vaccineName}
                </h3>
                <p className="text-sm text-slate-500">
                  Historique des lots reçus pour {lotContext.ownerLabel ?? "votre région"}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeRegionalLotModal}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Fermer
              </button>
            </div>

            {lotError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {lotError}
              </div>
            )}

            <div className="mt-4 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200">
              {lotLoading ? (
                <div className="flex items-center justify-center px-6 py-10 text-sm text-slate-500">
                  Chargement des lots…
                </div>
              ) : lotItems.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-500">
                  Aucun lot enregistré pour ce vaccin.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Lot
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Expiration
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Quantité
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Restant
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lotItems.map((lot) => {
                      const expired =
                        lot.status === "EXPIRED" || isDateExpired(lot.expiration);
                      return (
                        <tr
                          key={lot.id}
                          className={expired ? "bg-red-50/70 hover:bg-red-50" : "hover:bg-slate-50/80"}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{lot.id}</div>
                            {lot.sourceLotId && (
                              <div className="text-xs text-slate-500">
                                Issu du lot {lot.sourceLotId}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                expired ? "font-medium text-red-600" : "font-medium text-slate-700"
                              }
                            >
                              {formatExpirationDate(lot.expiration)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {lot.quantity.toLocaleString("fr-FR")}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {lot.remainingQuantity.toLocaleString("fr-FR")}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end">
                              {(user?.role === "SUPERADMIN" || expired) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRegionalLot(lot.id)}
                                  disabled={lotDeletingId === lot.id}
                                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {lotDeletingId === lot.id ? "Suppression…" : "Supprimer"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div>
                Total restant pour {lotContext.ownerLabel ?? "votre région"} :{" "}
                <span className="font-semibold text-slate-800">
                  {lotTotalRemaining.toLocaleString("fr-FR")} dose(s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeRegionalLotModal}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {updateModalOpen && updateContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Ajuster le stock — {updateContext.vaccineName}
              </h3>

              <div className="mt-6 flex flex-col gap-4 md:flex-row">
                <button
                  type="button"
                  onClick={() => setUpdateMode("add")}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-medium transition ${
                    updateMode === "add"
                      ? "border-blue-300 bg-blue-50 text-blue-700 shadow"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Ajouter au stock
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateMode("reduce")}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-medium transition ${
                    updateMode === "reduce"
                      ? "border-orange-300 bg-orange-50 text-orange-700 shadow"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Diminuer
                </button>
              </div>

              {updateMode === "reduce" ? (
                <form onSubmit={handleReduceLotSubmit} className="mt-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Quantité à diminuer
                    </label>
                    <input
                      value={reduceQuantity}
                      onChange={(event) => setReduceQuantity(event.target.value)}
                      type="number"
                      min="1"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      required
                      disabled={updating}
                    />
                    <p className="text-xs text-slate-500">
                      Quantité totale disponible : {reduceRemaining.toLocaleString("fr-FR")} doses
                    </p>
                  </div>

                  {reduceLoading ? (
                    <div className="text-center py-4 text-slate-500">
                      Chargement des lots...
                    </div>
                  ) : reduceLots.length === 0 ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      Aucun lot disponible avec une quantité restante.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-600">
                        Choisir le lot dans lequel diminuer
                      </label>
                      <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-3">
                        {reduceLots.map((lot) => (
                          <button
                            key={lot.id}
                            type="button"
                            onClick={() => setSelectedLotId(lot.id)}
                            className={`w-full text-left p-3 rounded-lg border transition ${
                              selectedLotId === lot.id
                                ? "border-orange-500 bg-orange-50"
                                : "border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium text-slate-900">
                                  Lot expirant le {new Date(lot.expiration).toLocaleDateString("fr-FR")}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Quantité disponible : {lot.remainingQuantity.toLocaleString("fr-FR")} doses
                                </div>
                              </div>
                              {selectedLotId === lot.id && (
                                <div className="text-orange-600">✓</div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {reduceError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {reduceError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={resetUpdateModal}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                      disabled={updating}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={updating || !selectedLotId || !reduceQuantity || reduceLots.length === 0}
                      className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-60"
                    >
                      {updating ? "Diminution…" : "Diminuer"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAddQuantitySubmit} className="mt-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">
                        Quantité actuelle
                      </label>
                      <input
                        value={(updateContext.currentQuantity ?? 0).toLocaleString("fr-FR")}
                        disabled
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">
                        Quantité à ajouter
                      </label>
                      <input
                        value={addQuantity}
                        onChange={(event) => setAddQuantity(event.target.value)}
                        type="number"
                        min="1"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Date d&apos;expiration du lot ajouté
                    </label>
                    <input
                      type="date"
                      value={addExpiration}
                      onChange={(event) => setAddExpiration(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  </div>

                  {addQuantityError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {addQuantityError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={resetUpdateModal}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={updating}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {updating ? "Ajout…" : "Ajouter"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export function DistrictStocksPage() {
  const { accessToken, user } = useAuth();

  const [stocks, setStocks] = useState<DistrictStock[]>([]);
  const [vaccines, setVaccines] = useState<VaccineInfo[]>([]);
  const [healthCenters, setHealthCenters] = useState<HealthCenterOption[]>([]);
  const [districtId, setDistrictId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<StockStats>(emptyStats);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createVaccineId, setCreateVaccineId] = useState("");
  const [creating, setCreating] = useState(false);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferContext, setTransferContext] = useState<DistrictStock | null>(null);
  const [transferHealthCenterId, setTransferHealthCenterId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [pendingHealthCenterCreation, setPendingHealthCenterCreation] = useState(false);
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [lotContext, setLotContext] = useState<LotModalContext | null>(null);
  const [lotItems, setLotItems] = useState<LotItem[]>([]);
  const [lotTotalRemaining, setLotTotalRemaining] = useState(0);
  const [lotLoading, setLotLoading] = useState(false);
  const [lotError, setLotError] = useState<string | null>(null);
  const [districtDeletingId, setDistrictDeletingId] = useState<string | null>(null);
  const [lotDeletingId, setLotDeletingId] = useState<string | null>(null);
  
  // États pour l'ajustement
  const canAdjust = user?.role === "SUPERADMIN";
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateContext, setUpdateContext] = useState<{ vaccineId: string; vaccineName: string; currentQuantity: number; districtId?: string } | null>(null);
  const [updateQuantity, setUpdateQuantity] = useState<string>("");
  const [updateMode, setUpdateMode] = useState<"reduce" | "add">("add");
  const [reduceQuantity, setReduceQuantity] = useState<string>("");
  const [reduceRemaining, setReduceRemaining] = useState<number>(0);
  const [reduceLots, setReduceLots] = useState<LotItem[]>([]);
  const [reduceLoading, setReduceLoading] = useState(false);
  const [reduceError, setReduceError] = useState<string | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [reduceLotsLoaded, setReduceLotsLoaded] = useState(false);
  const [addQuantity, setAddQuantity] = useState<string>("");
  const [addQuantityError, setAddQuantityError] = useState<string | null>(null);
  const [addExpiration, setAddExpiration] = useState<string>("");
  const [updateExpiration, setUpdateExpiration] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  
  // États pour les onglets
  const [activeTab, setActiveTab] = useState<"stocks" | "pending-received" | "pending-sent" | "history">("stocks");
  
  // États pour les envois en attente (reçus)
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [pendingTransfersLoading, setPendingTransfersLoading] = useState(false);
  const [confirmingTransferId, setConfirmingTransferId] = useState<string | null>(null);
  const [rejectingTransferId, setRejectingTransferId] = useState<string | null>(null);
  
  // États pour les envois en cours (envoyés)
  const [sentTransfers, setSentTransfers] = useState<PendingTransfer[]>([]);
  const [sentTransfersLoading, setSentTransfersLoading] = useState(false);
  const [cancellingTransferId, setCancellingTransferId] = useState<string | null>(null);
  
  // États pour l'historique
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [historyFilters, setHistoryFilters] = useState({
    vaccineId: "",
    fromType: "",
    toType: "",
    sentStartDate: "",
    sentEndDate: "",
    confirmedStartDate: "",
    confirmedEndDate: "",
    search: "",
  });

  const [legendExpanded, setLegendExpanded] = useState(false);

  const fetchDistrictStats = useCallback(async () => {
    if (!accessToken) {
      setStats(emptyStats);
      setStatsLoading(false);
      return;
    }

    try {
      setStatsLoading(true);
      setStatsError(null);

      const response = await fetch(`${API_URL}/api/stock/stats/district`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const payload = (await response.json()) as StockStats;
      setStats(payload);
    } catch (err) {
      console.error("Erreur récupération stats district:", err);
      setStats(emptyStats);
      setStatsError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les statistiques district"
      );
    } finally {
      setStatsLoading(false);
    }
  }, [accessToken]);

  const fetchDistrictStocks = useCallback(async () => {
    if (!accessToken) {
      setStocks([]);
      setVaccines([]);
      setHealthCenters([]);
      setDistrictId(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [stockRes, vaccineRes, healthRes] = await Promise.all([
        fetch(`${API_URL}/api/stock/district`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        fetch(`${API_URL}/api/vaccine`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        fetch(`${API_URL}/api/healthCenter`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      ]);

      if (!stockRes.ok) {
        const errorText = await stockRes.text().catch(() => "Erreur inconnue");
        let errorMessage = "Erreur inconnue";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorText;
        } catch {
          errorMessage = errorText;
        }
        console.error("Erreur API stock/district:", stockRes.status, errorMessage);
        throw new Error(`Erreur chargement stocks district: ${stockRes.status} - ${errorMessage}`);
      }
      if (!vaccineRes.ok) {
        const errorText = await vaccineRes.text().catch(() => "Erreur inconnue");
        let errorMessage = "Erreur inconnue";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorText;
        } catch {
          errorMessage = errorText;
        }
        console.error("Erreur API vaccine:", vaccineRes.status, errorMessage);
        throw new Error(`Erreur chargement vaccins: ${vaccineRes.status} - ${errorMessage}`);
      }
      if (!healthRes.ok) {
        const errorText = await healthRes.text().catch(() => "Erreur inconnue");
        let errorMessage = "Erreur inconnue";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorText;
        } catch {
          errorMessage = errorText;
        }
        console.error("Erreur API healthCenter:", healthRes.status, errorMessage);
        throw new Error(`Erreur chargement centres de santé: ${healthRes.status} - ${errorMessage}`);
      }

      const stockPayload = await stockRes.json();
      const stockItems = Array.isArray(stockPayload?.district)
        ? stockPayload.district
        : [];
      
      // Charger les lots pour chaque stock et calculer les statistiques
      const stocksWithLots = await Promise.all(
        stockItems.map(async (stock: DistrictStock) => {
          try {
            const lotsRes = await fetch(`${API_URL}/api/stock/district/${stock.vaccineId}/lots?districtId=${stock.districtId}`, {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
            });
            
            if (lotsRes.ok) {
              const lotsData: LotResponse = await lotsRes.json();
              const lots = lotsData.lots || [];
              const expiredLots = lots.filter((lot) => lot.status === "EXPIRED" || isDateExpired(lot.expiration));
              const expiredQuantity = expiredLots.reduce((sum, lot) => sum + lot.quantity, 0);
              
              return {
                ...stock,
                lotCount: lots.length,
                expiredLotCount: expiredLots.length,
                expiredQuantity,
              };
            }
          } catch (err) {
            console.error(`Erreur chargement lots pour ${stock.vaccineId}:`, err);
          }
          
          return {
            ...stock,
            lotCount: 0,
            expiredLotCount: 0,
            expiredQuantity: 0,
          };
        })
      );
      
      setStocks(stocksWithLots);

      const vaccinePayload: VaccineResponse = await vaccineRes.json();
      setVaccines(
        Array.isArray(vaccinePayload)
          ? vaccinePayload
          : Array.isArray(vaccinePayload?.vaccines)
          ? vaccinePayload.vaccines
          : []
      );

      const healthPayload = await healthRes.json();
      const healthItems = Array.isArray(healthPayload?.items)
        ? healthPayload.items
        : Array.isArray(healthPayload)
        ? healthPayload
        : [];

      const mappedCenters: HealthCenterOption[] = healthItems.map(
        (center: any) => ({
          id: center.id,
          name: center.name,
          districtId: center.districtId ?? center.district?.id ?? null,
        })
      );
      setHealthCenters(mappedCenters);

      let derivedDistrictId =
        stockPayload?.districtId ??
        (stockItems.length > 0
          ? stockItems[0].districtId ?? stockItems[0]?.district?.id ?? null
          : null);

      if (!derivedDistrictId) {
        const withDistrict = mappedCenters.find(
          (center) => center.districtId
        );
        derivedDistrictId = withDistrict?.districtId ?? null;
      }

      setDistrictId(derivedDistrictId ?? null);
    } catch (err) {
      console.error("Erreur chargement stocks district:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les stocks district"
      );
      setStocks([]);
      setVaccines([]);
      setHealthCenters([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const fetchPendingTransfers = useCallback(async () => {
    if (!accessToken) {
      setPendingTransfers([]);
      setPendingTransfersLoading(false);
      return;
    }
    try {
      setPendingTransfersLoading(true);
      const response = await fetch(`${API_URL}/api/stock/pending-transfers`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const payload = (await response.json()) as { transfers?: any[] };
      setPendingTransfers(Array.isArray(payload?.transfers) ? payload.transfers : []);
    } catch (err) {
      console.error("Erreur chargement envois en attente:", err);
      setPendingTransfers([]);
    } finally {
      setPendingTransfersLoading(false);
    }
  }, [accessToken]);

  const handleConfirmTransfer = useCallback(
    async (transferId: string) => {
      if (!accessToken) return;
      try {
        setConfirmingTransferId(transferId);
        const response = await fetch(
          `${API_URL}/api/stock/pending-transfers/${transferId}/confirm`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        // Recharger les données
        await Promise.all([
          fetchPendingTransfers(),
          fetchDistrictStocks(),
          fetchDistrictStats(),
        ]);
      } catch (err) {
        console.error("Erreur confirmation envoi:", err);
        alert(
          err instanceof Error
            ? err.message
            : "Impossible de confirmer la réception du stock.",
        );
      } finally {
        setConfirmingTransferId(null);
      }
    },
    [accessToken, fetchPendingTransfers, fetchDistrictStocks, fetchDistrictStats],
  );

  // Fonction pour récupérer les transferts envoyés
  const fetchSentTransfers = useCallback(async () => {
    if (!accessToken) {
      setSentTransfers([]);
      setSentTransfersLoading(false);
      return;
    }
    try {
      setSentTransfersLoading(true);
      const response = await fetch(`${API_URL}/api/stock/pending-transfers/sent`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const payload = (await response.json()) as { transfers?: PendingTransfer[] };
      setSentTransfers(Array.isArray(payload?.transfers) ? payload.transfers : []);
    } catch (err) {
      console.error("Erreur chargement envois envoyés:", err);
      setSentTransfers([]);
    } finally {
      setSentTransfersLoading(false);
    }
  }, [accessToken]);

  // Fonction pour récupérer l'historique
  const fetchTransferHistory = useCallback(async () => {
    if (!accessToken) return;
    try {
      setHistoryLoading(true);
      const params = new URLSearchParams({
        page: historyPage.toString(),
        limit: "20",
      });
      
      if (historyFilters.vaccineId) params.append("vaccineId", historyFilters.vaccineId);
      if (historyFilters.fromType) params.append("fromType", historyFilters.fromType);
      if (historyFilters.toType) params.append("toType", historyFilters.toType);
      if (historyFilters.sentStartDate) params.append("sentStartDate", historyFilters.sentStartDate);
      if (historyFilters.sentEndDate) params.append("sentEndDate", historyFilters.sentEndDate);
      if (historyFilters.confirmedStartDate) params.append("confirmedStartDate", historyFilters.confirmedStartDate);
      if (historyFilters.confirmedEndDate) params.append("confirmedEndDate", historyFilters.confirmedEndDate);
      if (historyFilters.search) params.append("search", historyFilters.search);

      const response = await fetch(`${API_URL}/api/stock/transfer-history?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const payload = (await response.json()) as {
        history?: TransferHistoryItem[];
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
      };
      
      setTransferHistory(Array.isArray(payload?.history) ? payload.history : []);
      setHistoryTotal(payload?.total ?? 0);
      setHistoryTotalPages(payload?.totalPages ?? 0);
    } catch (err) {
      console.error("Erreur chargement historique:", err);
      setTransferHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [accessToken, historyPage, historyFilters]);

  // Fonction pour refuser un transfert
  const handleRejectTransfer = useCallback(
    async (transferId: string) => {
      if (!accessToken) return;
      const confirmed = window.confirm(
        "Êtes-vous sûr de vouloir refuser ce transfert ? Les quantités seront restaurées chez l'expéditeur."
      );
      if (!confirmed) return;

      try {
        setRejectingTransferId(transferId);
        const response = await fetch(
          `${API_URL}/api/stock/pending-transfers/${transferId}/reject`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        await Promise.all([
          fetchPendingTransfers(),
          fetchDistrictStocks(),
          fetchDistrictStats(),
        ]);
      } catch (err) {
        console.error("Erreur refus transfert:", err);
        alert(
          err instanceof Error
            ? err.message
            : "Impossible de refuser le transfert.",
        );
      } finally {
        setRejectingTransferId(null);
      }
    },
    [accessToken, fetchPendingTransfers, fetchDistrictStocks, fetchDistrictStats],
  );

  // Fonction pour annuler un transfert
  const handleCancelTransfer = useCallback(
    async (transferId: string) => {
      if (!accessToken) return;
      const confirmed = window.confirm(
        "Êtes-vous sûr de vouloir annuler ce transfert ? Les quantités seront restaurées dans votre stock."
      );
      if (!confirmed) return;

      try {
        setCancellingTransferId(transferId);
        const response = await fetch(
          `${API_URL}/api/stock/pending-transfers/${transferId}/cancel`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        await Promise.all([
          fetchSentTransfers(),
          fetchDistrictStocks(),
          fetchDistrictStats(),
        ]);
      } catch (err) {
        console.error("Erreur annulation transfert:", err);
        alert(
          err instanceof Error
            ? err.message
            : "Impossible d'annuler le transfert.",
        );
      } finally {
        setCancellingTransferId(null);
      }
    },
    [accessToken, fetchSentTransfers, fetchDistrictStocks, fetchDistrictStats],
  );

  useEffect(() => {
    fetchDistrictStocks();
    fetchDistrictStats();
    fetchPendingTransfers();
    if (activeTab === "pending-sent") {
      fetchSentTransfers();
    } else if (activeTab === "history") {
      fetchTransferHistory();
    }
  }, [fetchDistrictStocks, fetchDistrictStats, fetchPendingTransfers, activeTab, fetchSentTransfers, fetchTransferHistory]);

  const availableVaccinesForCreation = useMemo(() => {
    const existing = new Set(stocks.map((stock) => stock.vaccineId));
    return vaccines.filter((vaccine) => !existing.has(vaccine.id));
  }, [stocks, vaccines]);

  const fetchDistrictLots = useCallback(
    async (vaccineId: string, districtId?: string | null) => {
      if (!accessToken) return;
      try {
        setLotLoading(true);
        setLotError(null);

        const params = new URLSearchParams();
        if (districtId) {
          params.set("districtId", districtId);
        }

        const response = await fetch(
          `${API_URL}/api/stock/district/${vaccineId}/lots${
            params.toString() ? `?${params.toString()}` : ""
          }`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        const payload = (await response.json()) as LotResponse;
        setLotItems(Array.isArray(payload?.lots) ? payload.lots : []);
        setLotTotalRemaining(payload?.totalRemaining ?? 0);
      } catch (err) {
        console.error("Erreur chargement lots district:", err);
        setLotItems([]);
        setLotTotalRemaining(0);
        setLotError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les lots pour ce vaccin.",
        );
      } finally {
        setLotLoading(false);
      }
    },
    [accessToken],
  );

  const handleOpenDistrictLotModal = useCallback(
    (stock: DistrictStock) => {
      const districtLabel = stock.district?.name ?? "votre district";
      setLotContext({
        vaccineId: stock.vaccineId,
        vaccineName: stock.vaccine.name,
        ownerLabel: districtLabel,
        ownerId: stock.districtId ?? null,
      });
      setLotItems([]);
      setLotTotalRemaining(0);
      setLotError(null);
      setLotModalOpen(true);
      void fetchDistrictLots(stock.vaccineId, stock.districtId ?? null);
    },
    [fetchDistrictLots],
  );

  const closeDistrictLotModal = useCallback(() => {
    setLotModalOpen(false);
    setLotContext(null);
    setLotItems([]);
    setLotTotalRemaining(0);
    setLotError(null);
  }, []);


  const handleDeleteDistrictLot = useCallback(
    async (lotId: string) => {
      if (!accessToken || !lotContext) return;
      try {
        setLotDeletingId(lotId);
        const response = await fetch(`${API_URL}/api/stock/lots/${lotId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        await fetchDistrictLots(lotContext.vaccineId, lotContext.ownerId ?? null);
        await Promise.all([fetchDistrictStocks(), fetchDistrictStats()]);
      } catch (err) {
        console.error("Erreur suppression lot:", err);
        setLotError(
          err instanceof Error
            ? err.message
            : "Impossible de supprimer le lot sélectionné.",
        );
      } finally {
        setLotDeletingId(null);
      }
    },
    [
      accessToken,
      fetchDistrictLots,
      fetchDistrictStats,
      fetchDistrictStocks,
      lotContext,
    ],
  );

  const handleCreateStock = async (event: FormEvent) => {
    event.preventDefault();
    if (!createVaccineId || !accessToken) return;
    if (!districtId) {
      setError(
        "Impossible de déterminer votre district pour créer un stock."
      );
      return;
    }

    try {
      setCreating(true);
      const response = await fetch(`${API_URL}/api/stock/district`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          vaccineId: createVaccineId,
          districtId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      setCreateModalOpen(false);
      setCreateVaccineId("");
      await Promise.all([fetchDistrictStocks(), fetchDistrictStats()]);
    } catch (err) {
      console.error("Erreur création stock district:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer le stock district"
      );
    } finally {
      setCreating(false);
    }
  };

  const openTransferModal = (stock: DistrictStock) => {
    setTransferContext(stock);
    setTransferHealthCenterId("");
    setTransferQuantity("");
    setTransferError(null);
    setPendingHealthCenterCreation(false);
    setTransferModalOpen(true);
  };

  const handleTransferSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !transferContext) return;
    if (!districtId) {
      setTransferError("District introuvable pour ce transfert.");
      return;
    }

    const quantityValue = Number(transferQuantity);
    if (
      !transferHealthCenterId ||
      !Number.isFinite(quantityValue) ||
      quantityValue <= 0
    ) {
      setTransferError(
        "Sélectionnez un centre de santé et saisissez une quantité valide."
      );
      return;
    }

    try {
      setTransferLoading(true);
      setTransferError(null);
      setPendingHealthCenterCreation(false);

      const response = await fetch(`${API_URL}/api/stock/add-health-center`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          vaccineId: transferContext.vaccineId,
          healthCenterId: transferHealthCenterId,
          districtId,
          quantity: quantityValue,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          setTransferError(
            "Ce centre n'a pas encore de stock pour ce vaccin. Créez-le puis recommencez."
          );
          setPendingHealthCenterCreation(true);
        } else {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }
        return;
      }

      setTransferModalOpen(false);
      setTransferContext(null);
      setTransferHealthCenterId("");
      setTransferQuantity("");
      await Promise.all([fetchDistrictStocks(), fetchDistrictStats()]);
    } catch (err) {
      console.error("Erreur transfert centre de santé:", err);
      setTransferError(
        err instanceof Error ? err.message : "Impossible de transférer le stock"
      );
    } finally {
      setTransferLoading(false);
    }
  };

  const handleCreateHealthCenterStock = async () => {
    if (!accessToken || !transferContext || !transferHealthCenterId) return;

    try {
      setTransferLoading(true);
      setTransferError(null);

      const response = await fetch(`${API_URL}/api/stock/health-center`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          vaccineId: transferContext.vaccineId,
          healthCenterId: transferHealthCenterId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      setTransferError(
        "Stock centre de santé créé. Vous pouvez maintenant effectuer le transfert."
      );
      setPendingHealthCenterCreation(false);
      await Promise.all([fetchDistrictStocks(), fetchDistrictStats()]);
    } catch (err) {
      console.error("Erreur création stock centre de santé:", err);
      setTransferError(
        err instanceof Error
          ? err.message
          : "Impossible de créer le stock centre de santé"
      );
    } finally {
      setTransferLoading(false);
    }
  };

  const handleDeleteDistrictStock = useCallback(
    async (stock: DistrictStock) => {
      if (!accessToken) {
        return;
      }

      const confirmed = window.confirm(
        `Supprimer le stock du district ${stock.district?.name ?? ""} pour le vaccin ${stock.vaccine.name} ?`,
      );
      if (!confirmed) {
        return;
      }

      try {
        setDistrictDeletingId(stock.id);
        setError(null);

        const payload: Record<string, string> = { vaccineId: stock.vaccineId };
        if (stock.districtId) {
          payload.districtId = stock.districtId;
        }

        const response = await fetch(`${API_URL}/api/stock/district`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? `status ${response.status}`);
        }

        await Promise.all([fetchDistrictStocks(), fetchDistrictStats()]);
      } catch (err) {
        console.error("Erreur suppression stock district:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de supprimer ce stock district.",
        );
      } finally {
        setDistrictDeletingId(null);
      }
    },
    [accessToken, fetchDistrictStats, fetchDistrictStocks],
  );

  // Fonctions pour l'ajustement
  const openUpdateModal = async (stock: DistrictStock) => {
    setUpdateContext({
      vaccineId: stock.vaccineId,
      vaccineName: stock.vaccine.name,
      currentQuantity: stock.quantity ?? 0,
      districtId: stock.districtId,
    });
    setUpdateQuantity(String(stock.quantity ?? 0));
    setUpdateMode("add");
    setAddQuantity("");
    setAddExpiration("");
    setUpdateExpiration("");
    setAddQuantityError(null);
    setReduceQuantity("");
    setReduceRemaining(0);
    setReduceLots([]);
    setReduceError(null);
    setSelectedLotId(null);
    setReduceLotsLoaded(false);
    setUpdateModalOpen(true);
  };

  const resetUpdateModal = () => {
    setUpdateModalOpen(false);
    setUpdateContext(null);
    setUpdateQuantity("");
    setAddQuantity("");
    setAddExpiration("");
    setUpdateExpiration("");
    setAddQuantityError(null);
    setUpdating(false);
    setReduceQuantity("");
    setReduceRemaining(0);
    setReduceLots([]);
    setReduceError(null);
    setSelectedLotId(null);
    setReduceLotsLoaded(false);
  };

  const loadLotsForReduce = useCallback(async () => {
    if (!updateContext?.vaccineId || !accessToken || !districtId) return;

    try {
      setReduceLoading(true);
      setReduceError(null);
      const response = await fetch(
        `${API_URL}/api/stock/district/${updateContext.vaccineId}/lots?districtId=${districtId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Impossible de charger les lots");
      }

      const payload: LotResponse = await response.json();
      const validLots = payload.lots.filter((lot) => lot.remainingQuantity > 0);
      setReduceLots(validLots);
      setReduceRemaining(payload.totalRemaining);
      setReduceLotsLoaded(true); // Marquer comme chargé pour éviter les rechargements en boucle
      
      // Réinitialiser selectedLotId si le lot sélectionné n'existe plus dans les lots valides
      setSelectedLotId((currentSelectedId) => {
        if (currentSelectedId && !validLots.find((lot) => lot.id === currentSelectedId)) {
          return null;
        }
        return currentSelectedId;
      });
    } catch (err) {
      console.error("Erreur chargement lots:", err);
      setReduceError(
        err instanceof Error ? err.message : "Impossible de charger les lots"
      );
      setReduceLotsLoaded(true); // Marquer comme chargé même en cas d'erreur pour éviter les boucles
    } finally {
      setReduceLoading(false);
    }
  }, [updateContext?.vaccineId, accessToken, districtId]);

  // Réinitialiser le flag quand on change de mode ou de contexte
  useEffect(() => {
    if (updateMode === "add" || !updateContext?.vaccineId) {
      setReduceLotsLoaded(false);
    }
  }, [updateMode, updateContext?.vaccineId]);

  // Quand on passe en mode reduce, charger les lots une seule fois
  useEffect(() => {
    if (updateMode === "reduce" && updateContext?.vaccineId && !reduceLotsLoaded && !reduceLoading) {
      loadLotsForReduce();
    }
  }, [updateMode, updateContext?.vaccineId, loadLotsForReduce, reduceLotsLoaded, reduceLoading]);

  const handleAddQuantitySubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!updateContext || !accessToken || !districtId) return;

    const quantityValue = Number(addQuantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setAddQuantityError("Veuillez saisir une quantité valide.");
      return;
    }

    if (!addExpiration) {
      setAddQuantityError("Veuillez indiquer la date d'expiration du lot ajouté.");
      return;
    }

    try {
      setAddQuantityError(null);
      setUpdating(true);

      // Pour SUPERADMIN, utiliser updateStock qui crée directement un lot sans prélever du niveau supérieur
      // Pour les autres rôles, utiliser addStock qui prélève du niveau supérieur
      const isSuperAdmin = user?.role === "SUPERADMIN";
      
      if (isSuperAdmin && updateContext.districtId) {
        // Utiliser updateStockDISTRICT pour créer directement un lot
        const currentQuantity = updateContext.currentQuantity ?? 0;
        const newTotalQuantity = currentQuantity + quantityValue;
        
        const response = await fetch(`${API_URL}/api/stock/district`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            vaccineId: updateContext.vaccineId,
            districtId: updateContext.districtId,
            quantity: newTotalQuantity,
            expiration: `${addExpiration}T00:00:00.000Z`,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }
      } else {
        // Utiliser addStockDISTRICT qui prélève du stock régional
        const response = await fetch(`${API_URL}/api/stock/add-district`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            vaccineId: updateContext.vaccineId,
            districtId: districtId,
            quantity: quantityValue,
            expiration: `${addExpiration}T00:00:00.000Z`,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }
      }

      resetUpdateModal();
      await Promise.all([fetchDistrictStocks(), fetchDistrictStats()]);
    } catch (err) {
      console.error("Erreur ajout stock district:", err);
      setAddQuantityError(
        err instanceof Error
          ? err.message
          : "Impossible d'ajouter au stock district"
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleReduceLotSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!updateContext || !accessToken || !selectedLotId) return;

    // Vérifier qu'il y a des lots disponibles
    if (reduceLots.length === 0) {
      setReduceError("Aucun lot disponible avec une quantité restante.");
      return;
    }

    const quantityValue = Number(reduceQuantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setReduceError("Veuillez saisir une quantité valide supérieure à 0.");
      return;
    }

    const selectedLot = reduceLots.find((lot) => lot.id === selectedLotId);
    if (!selectedLot) {
      setReduceError("Lot sélectionné introuvable. Veuillez sélectionner un lot disponible.");
      setSelectedLotId(null);
      return;
    }

    // Vérifier que la quantité à réduire ne dépasse pas le stock disponible
    if (quantityValue > selectedLot.remainingQuantity) {
      setReduceError(
        `La quantité à réduire (${quantityValue.toLocaleString("fr-FR")}) dépasse le stock disponible (${selectedLot.remainingQuantity.toLocaleString("fr-FR")} doses).`
      );
      return;
    }

    const actualQuantityToReduce = quantityValue;

    try {
      setReduceError(null);
      setUpdating(true);

      const response = await fetch(
        `${API_URL}/api/stock/district/lot/${selectedLotId}/reduce`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            quantity: actualQuantityToReduce,
          }),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Erreur lors de la diminution");
      }

      await loadLotsForReduce();
      
      // La diminution est terminée
      resetUpdateModal();
      await Promise.all([fetchDistrictStocks(), fetchDistrictStats()]);
    } catch (err) {
      console.error("Erreur diminution stock district:", err);
      setReduceError(
        err instanceof Error
          ? err.message
          : "Impossible de diminuer le stock district"
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <DashboardShell active="/dashboard/stocks">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {user?.role !== "SUPERADMIN" && (
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Stocks & lots</h2>
              <p className="text-sm text-slate-500">
                Suivi des stocks districtaux et distribution vers les centres de santé.
              </p>
            </div>
          )}
          
          {/* Boutons d'action et onglets */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* Bouton Nouveau lot */}
            {activeTab === "stocks" && (
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                disabled={
                  availableVaccinesForCreation.length === 0 || !districtId
                }
              >
                <Plus className="h-4 w-4" />
                Nouveau lot
              </button>
            )}
            
            {/* Onglets */}
            <div className="border-b border-slate-200 md:border-b-0">
              <nav className="-mb-px flex space-x-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("stocks")}
                  className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "stocks"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Stocks
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pending-received")}
                  className={`relative whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "pending-received"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Envois en attente
                  {pendingTransfers.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
                      {pendingTransfers.length > 99 ? "99+" : pendingTransfers.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pending-sent")}
                  className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "pending-sent"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Envois en cours
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "history"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Historique
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Contenu des onglets */}
        {activeTab === "stocks" && (
          <>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title="Total de doses"
            value={
              statsLoading ? "…" : stats.totalQuantity.toLocaleString("fr-FR")
            }
            icon={Syringe}
            accent="emerald"
            loading={statsLoading}
          />
          <StatCard
            title="Stocks faibles"
            value={statsLoading ? "…" : stats.lowStockCount}
            icon={AlertTriangle}
            accent="red"
            loading={statsLoading}
          />
          <StatCard
            title="Lots expirés"
            value={statsLoading ? "…" : stats.expiredLots}
            icon={AlertTriangle}
            accent="red"
            loading={statsLoading}
          />
        </div>

        {statsError && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-700">
            {statsError}
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {pendingTransfers.length > 0 && (
          <div className="rounded-3xl border border-blue-200 bg-blue-50/80 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
                  <PackageOpen className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    {pendingTransfers.length} envoi{pendingTransfers.length > 1 ? "s" : ""} en attente de confirmation
                  </p>
                  <p className="text-xs text-blue-700">
                    Veuillez confirmer ou refuser les transferts reçus
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("pending-received")}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Voir les envois
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-blue-100 bg-blue-50/50 mb-4">
          <button
            type="button"
            onClick={() => setLegendExpanded(!legendExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-blue-100/50 transition rounded-xl"
          >
            <div className="flex items-center gap-2 flex-1">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <h4 className="text-xs font-semibold text-blue-900">Qu'est-ce qu'un lot ?</h4>
            </div>
            {legendExpanded ? (
              <ChevronUp className="h-4 w-4 text-blue-600 flex-shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-blue-600 flex-shrink-0" />
            )}
          </button>
          {legendExpanded && (
            <div className="px-3 pb-2 pt-1">
              <p className="text-xs text-blue-800 leading-relaxed">
                Un <strong>lot</strong> représente un ensemble de doses d'un vaccin avec une même date d'expiration. 
                Chaque stock peut contenir plusieurs lots, chacun ayant sa propre date d'expiration. 
                Les lots permettent de gérer efficacement la traçabilité et le suivi des vaccins, notamment pour identifier 
                les doses expirées et optimiser la distribution selon les dates d'expiration.
              </p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Vaccin
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Quantité (district)
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Nombre de lots
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  District
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Chargement des stocks district…
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Aucun stock district enregistré pour le moment.
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => {
                  const lotCount = stock.lotCount ?? 0;
                  const expiredLotCount = stock.expiredLotCount ?? 0;
                  const expiredQuantity = stock.expiredQuantity ?? 0;
                  const totalQuantity = stock.quantity ?? 0;
                  const validQuantity = totalQuantity - expiredQuantity;
                  const validLotCount = lotCount - expiredLotCount;
                  
                  // Vérifier si le stock peut être envoyé
                  const canSend = lotCount > 0 && validLotCount > 0 && validQuantity > 0;
                  const disabledReason = lotCount === 0 
                    ? "Aucun lot disponible pour ce vaccin"
                    : validLotCount === 0
                    ? "Tous les lots sont expirés"
                    : validQuantity === 0
                    ? "Toutes les quantités sont expirées"
                    : "";
                  
                  return (
                    <tr
                      key={stock.id}
                      className="hover:bg-slate-50/80"
                    >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {stock.vaccine.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {stock.vaccine.description}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">
                        {(stock.quantity ?? 0).toLocaleString("fr-FR")}
                        {expiredQuantity > 0 && (
                          <span className="ml-2 text-sm font-normal text-red-600">
                            ({expiredQuantity.toLocaleString("fr-FR")} expiré{expiredQuantity > 1 ? "s" : ""})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {stock.vaccine.dosesRequired} doses requises
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-slate-700">
                        {lotCount} lot{lotCount > 1 ? "s" : ""}
                        {expiredLotCount > 0 && (
                          <span className="ml-2 text-red-600">
                            - {expiredLotCount} expiré{expiredLotCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {stock.district?.name ?? "Votre district"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenDistrictLotModal(stock)}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                        >
                          <PackageOpen className="h-4 w-4" />
                          Lots
                        </button>
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={() => canSend && openTransferModal(stock)}
                            disabled={!canSend}
                            className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-50"
                            title={!canSend ? disabledReason : undefined}
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                            Envoyer
                          </button>
                          {!canSend && (
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10 w-48 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
                              {disabledReason}
                              <div className="absolute top-full right-4 -mt-1 h-2 w-2 rotate-45 bg-slate-900"></div>
                            </div>
                          )}
                        </div>
                        {canAdjust && (
                          <button
                            type="button"
                            onClick={() => openUpdateModal(stock)}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-100"
                          >
                            Ajuster
                          </button>
                        )}
                        {(user?.role === "SUPERADMIN" || (stock.expiredLotCount ?? 0) > 0) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDistrictStock(stock)}
                            disabled={districtDeletingId === stock.id}
                            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                          >
                            <Trash2 className="h-4 w-4" />
                            {districtDeletingId === stock.id ? "Suppression…" : "Supprimer"}
                          </button>
                        )}
                      </div>
                    </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
          </>
        )}

        {activeTab === "pending-sent" && (
          <div className="space-y-6">
            {sentTransfersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : sentTransfers.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                <PackageOpen className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-sm font-medium text-slate-900">Aucun envoi en cours</p>
                <p className="mt-2 text-sm text-slate-500">
                  Vous n'avez aucun transfert en attente de confirmation.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Vaccin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Destinataire
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Quantité
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Date d'envoi
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {sentTransfers.map((transfer) => {
                      const sentDate = new Date(transfer.createdAt);
                      return (
                        <tr key={transfer.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-slate-900">
                              {transfer.vaccine?.name ?? "Vaccin inconnu"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {formatEntityName(transfer.toType, transfer.toName)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {transfer.quantity.toLocaleString("fr-FR")} doses
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {sentDate.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleCancelTransfer(transfer.id)}
                                disabled={cancellingTransferId === transfer.id}
                                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                              >
                                {cancellingTransferId === transfer.id ? (
                                  <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                    Annulation...
                                  </>
                                ) : (
                                  <>
                                    <X className="h-4 w-4" />
                                    Annuler
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "pending-received" && (
          <div className="space-y-6">
            {pendingTransfersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : pendingTransfers.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                <PackageOpen className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-sm font-medium text-slate-900">Aucun envoi en attente</p>
                <p className="mt-2 text-sm text-slate-500">
                  Vous n'avez aucun transfert en attente de confirmation.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-hidden rounded-2xl md:rounded-3xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Vaccin
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Expéditeur
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Quantité
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Date d'envoi
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-right text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {pendingTransfers.map((transfer) => {
                      const sentDate = new Date(transfer.createdAt);
                      return (
                        <tr key={transfer.id} className="hover:bg-slate-50">
                          <td className="px-2 md:px-6 py-2 md:py-4">
                            <div className="text-xs md:text-sm font-medium text-slate-900">
                              {transfer.vaccine?.name ?? "Vaccin inconnu"}
                            </div>
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-700">
                            {formatEntityName(transfer.fromType, transfer.fromName)}
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-700">
                            {transfer.quantity.toLocaleString("fr-FR")} doses
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-600">
                            {sentDate.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4">
                            <div className="flex justify-end gap-1 md:gap-2">
                              <button
                                type="button"
                                onClick={() => handleRejectTransfer(transfer.id)}
                                disabled={rejectingTransferId === transfer.id}
                                className="flex items-center gap-1 md:gap-2 rounded-lg md:rounded-xl border border-red-200 bg-red-50 px-2 md:px-4 py-1 md:py-2 text-[10px] md:text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                              >
                                {rejectingTransferId === transfer.id ? (
                                  <>
                                    <div className="h-3 w-3 md:h-4 md:w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                    <span className="hidden sm:inline">Refus...</span>
                                    <span className="sm:hidden">...</span>
                                  </>
                                ) : (
                                  <>
                                    <X className="h-3 w-3 md:h-4 md:w-4" />
                                    <span className="hidden sm:inline">Refuser</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmTransfer(transfer.id)}
                                disabled={confirmingTransferId === transfer.id}
                                className="flex items-center gap-1 md:gap-2 rounded-lg md:rounded-xl bg-emerald-600 px-2 md:px-4 py-1 md:py-2 text-[10px] md:text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {confirmingTransferId === transfer.id ? (
                                  <>
                                    <div className="h-3 w-3 md:h-4 md:w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    <span className="hidden sm:inline">Confirmation...</span>
                                    <span className="sm:hidden">...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-3 w-3 md:h-4 md:w-4" />
                                    <span className="hidden sm:inline">Confirmer</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-6">
            {/* Filtres */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Historique des envois</h3>
                <p className="text-sm text-slate-500">
                  Tous les transferts de stock confirmés
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="w-[180px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Rechercher
                  </label>
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={historyFilters.search}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, search: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                
                {/* Bloc Date d'envoi */}
                <div className="w-[280px] rounded-xl border-2 border-blue-200 bg-blue-50/30 p-3">
                  <label className="mb-2 block text-xs font-semibold text-blue-700">
                    Date d'envoi
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Du
                      </label>
                      <input
                        type="date"
                        value={historyFilters.sentStartDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, sentStartDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Au
                      </label>
                      <input
                        type="date"
                        value={historyFilters.sentEndDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, sentEndDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Bloc Date de confirmation/annulation */}
                <div className="w-[280px] rounded-xl border-2 border-green-200 bg-green-50/30 p-3">
                  <label className="mb-2 block text-xs font-semibold text-green-700">
                    Date de confirmation/annulation
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Du
                      </label>
                      <input
                        type="date"
                        value={historyFilters.confirmedStartDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, confirmedStartDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Au
                      </label>
                      <input
                        type="date"
                        value={historyFilters.confirmedEndDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, confirmedEndDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="w-[140px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Expéditeur
                  </label>
                  <select
                    value={historyFilters.fromType}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, fromType: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Tous expéditeurs</option>
                    <option value="NATIONAL">National</option>
                    <option value="REGIONAL">Régional</option>
                    <option value="DISTRICT">District</option>
                    <option value="HEALTHCENTER">Centre de santé</option>
                  </select>
                </div>
                <div className="w-[140px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Destinataire
                  </label>
                  <select
                    value={historyFilters.toType}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, toType: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Tous destinataires</option>
                    <option value="REGIONAL">Régional</option>
                    <option value="DISTRICT">District</option>
                    <option value="HEALTHCENTER">Centre de santé</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      // Validation : si une date de début est remplie, la date de fin doit l'être aussi
                      if (
                        (historyFilters.sentStartDate && !historyFilters.sentEndDate) ||
                        (!historyFilters.sentStartDate && historyFilters.sentEndDate) ||
                        (historyFilters.confirmedStartDate && !historyFilters.confirmedEndDate) ||
                        (!historyFilters.confirmedStartDate && historyFilters.confirmedEndDate)
                      ) {
                        alert("Veuillez remplir les deux dates (du et au) pour chaque période de filtrage.");
                        return;
                      }
                      setHistoryPage(1);
                      fetchTransferHistory();
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                  >
                    <Search className="h-4 w-4" />
                    Filtrer
                  </button>
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : transferHistory.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                <PackageOpen className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-sm font-medium text-slate-900">Aucun historique</p>
                <p className="mt-2 text-sm text-slate-500">
                  Aucun transfert confirmé pour le moment.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Vaccin
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Expéditeur
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Destinataire
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Quantité
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Date envoi
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Confirmation/annulation
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Expiration lot
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {transferHistory.map((item) => {
                        const sentDate = new Date(item.sentAt);
                        const confirmedDate = item.confirmedAt ? new Date(item.confirmedAt) : null;
                        const expirationDate = item.lotExpiration ? new Date(item.lotExpiration) : null;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-900">
                                {item.vaccineName}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              {formatEntityName(item.fromType, item.fromName)}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              {formatEntityName(item.toType, item.toName)}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              {item.quantity.toLocaleString("fr-FR")} doses
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {sentDate.toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {confirmedDate
                                ? confirmedDate.toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "N/A"}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {expirationDate
                                ? expirationDate.toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  item.status === "CONFIRMED"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {item.status === "CONFIRMED" ? "Confirmé" : "Annulé"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {historyTotalPages > 1 && (
                  <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-6 py-4">
                    <div className="text-sm text-slate-700">
                      Page {historyPage} sur {historyTotalPages} ({historyTotal} résultats)
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryPage((p) => Math.max(1, p - 1));
                        }}
                        disabled={historyPage === 1}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Précédent
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryPage((p) => Math.min(historyTotalPages, p + 1));
                        }}
                        disabled={historyPage === historyTotalPages}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-lg rounded-3xl bg-white shadow-2xl">
            <form onSubmit={handleCreateStock} className="space-y-4 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Créer un stock district
              </h3>
              <p className="text-sm text-slate-500">
                Sélectionnez un vaccin qui n'a pas encore de stock pour votre district.
              </p>

              <select
                value={createVaccineId}
                onChange={(event) => setCreateVaccineId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                required
              >
                <option value="">— Sélectionner un vaccin —</option>
                {availableVaccinesForCreation.map((vaccine) => (
                  <option key={vaccine.id} value={vaccine.id}>
                    {vaccine.name}
                  </option>
                ))}
              </select>

              {availableVaccinesForCreation.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  Tous les vaccins possèdent déjà un stock district.
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setCreateVaccineId("");
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={
                    creating ||
                    availableVaccinesForCreation.length === 0 ||
                    !districtId
                  }
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {creating ? "Création…" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transferModalOpen && transferContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-lg rounded-3xl bg-white shadow-2xl">
            <form onSubmit={handleTransferSubmit} className="space-y-4 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Envoyer du stock — {transferContext.vaccine.name}
              </h3>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">
                  Centre de santé
                </label>
                <select
                  value={transferHealthCenterId}
                  onChange={(event) => {
                    setTransferHealthCenterId(event.target.value);
                    setTransferError(null);
                    setPendingHealthCenterCreation(false);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                >
                  <option value="">— Sélectionner un centre —</option>
                  {healthCenters
                    .filter((center) => {
                      // Pour SUPERADMIN, filtrer par le district du stock qu'on transfère
                      if (user?.role === "SUPERADMIN" && transferContext?.districtId) {
                        return center.districtId === transferContext.districtId;
                      }
                      // Pour les autres rôles, tous les centres sont déjà filtrés par l'API
                      return true;
                    })
                    .map((center) => (
                      <option key={center.id} value={center.id}>
                        {center.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">
                  Quantité à envoyer
                </label>
                <input
                  value={transferQuantity}
                  onChange={(event) => setTransferQuantity(event.target.value)}
                  type="number"
                  min="1"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              {transferError && (
                <div
                  className={`rounded-xl border p-3 text-sm ${
                    pendingHealthCenterCreation
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {transferError}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3">
                {pendingHealthCenterCreation && (
                  <button
                    type="button"
                    onClick={handleCreateHealthCenterStock}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
                  >
                    Créer le stock centre
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setTransferModalOpen(false);
                    setTransferContext(null);
                    setTransferHealthCenterId("");
                    setTransferQuantity("");
                    setTransferError(null);
                    setPendingHealthCenterCreation(false);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {transferLoading ? "Transfert…" : "Envoyer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lotModalOpen && lotContext && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-[95vw] md:max-w-3xl rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Lots du vaccin {lotContext.vaccineName}
                </h3>
                <p className="text-sm text-slate-500">
                  Historique des lots reçus pour {lotContext.ownerLabel ?? "votre district"}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDistrictLotModal}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Fermer
              </button>
            </div>

            {lotError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {lotError}
              </div>
            )}

            <div className="mt-4 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200">
              {lotLoading ? (
                <div className="flex items-center justify-center px-6 py-10 text-sm text-slate-500">
                  Chargement des lots…
                </div>
              ) : lotItems.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-500">
                  Aucun lot enregistré pour ce vaccin.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Lot
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Expiration
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Quantité
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Restant
                      </th>
                      <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lotItems.map((lot) => {
                      const expired =
                        lot.status === "EXPIRED" || isDateExpired(lot.expiration);
                      return (
                        <tr
                          key={lot.id}
                          className={expired ? "bg-red-50/70 hover:bg-red-50" : "hover:bg-slate-50/80"}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{lot.id}</div>
                            {lot.sourceLotId && (
                              <div className="text-xs text-slate-500">
                                Issu du lot {lot.sourceLotId}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                expired ? "font-medium text-red-600" : "font-medium text-slate-700"
                              }
                            >
                              {formatExpirationDate(lot.expiration)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {lot.quantity.toLocaleString("fr-FR")}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {lot.remainingQuantity.toLocaleString("fr-FR")}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end">
                              {(user?.role === "SUPERADMIN" || expired) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDistrictLot(lot.id)}
                                  disabled={lotDeletingId === lot.id}
                                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {lotDeletingId === lot.id ? "Suppression…" : "Supprimer"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div>
                Total restant pour {lotContext.ownerLabel ?? "votre district"} :{" "}
                <span className="font-semibold text-slate-800">
                  {lotTotalRemaining.toLocaleString("fr-FR")} dose(s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeDistrictLotModal}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {updateModalOpen && updateContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Ajuster le stock — {updateContext.vaccineName}
              </h3>

              <div className="mt-6 flex flex-col gap-4 md:flex-row">
                <button
                  type="button"
                  onClick={() => setUpdateMode("add")}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-medium transition ${
                    updateMode === "add"
                      ? "border-blue-300 bg-blue-50 text-blue-700 shadow"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Ajouter au stock
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateMode("reduce")}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-medium transition ${
                    updateMode === "reduce"
                      ? "border-orange-300 bg-orange-50 text-orange-700 shadow"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Diminuer
                </button>
              </div>

              {updateMode === "reduce" ? (
                <form onSubmit={handleReduceLotSubmit} className="mt-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Quantité à diminuer
                    </label>
                    <input
                      value={reduceQuantity}
                      onChange={(event) => setReduceQuantity(event.target.value)}
                      type="number"
                      min="1"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      required
                      disabled={updating}
                    />
                    <p className="text-xs text-slate-500">
                      Quantité totale disponible : {reduceRemaining.toLocaleString("fr-FR")} doses
                    </p>
                  </div>

                  {reduceLoading ? (
                    <div className="text-center py-4 text-slate-500">
                      Chargement des lots...
                    </div>
                  ) : reduceLots.length === 0 ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      Aucun lot disponible avec une quantité restante.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-600">
                        Choisir le lot dans lequel diminuer
                      </label>
                      <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-3">
                        {reduceLots.map((lot) => (
                          <button
                            key={lot.id}
                            type="button"
                            onClick={() => setSelectedLotId(lot.id)}
                            className={`w-full text-left p-3 rounded-lg border transition ${
                              selectedLotId === lot.id
                                ? "border-orange-500 bg-orange-50"
                                : "border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium text-slate-900">
                                  Lot expirant le {new Date(lot.expiration).toLocaleDateString("fr-FR")}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Quantité disponible : {lot.remainingQuantity.toLocaleString("fr-FR")} doses
                                </div>
                              </div>
                              {selectedLotId === lot.id && (
                                <div className="text-orange-600">✓</div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {reduceError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {reduceError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={resetUpdateModal}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                      disabled={updating}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={updating || !selectedLotId || !reduceQuantity || reduceLots.length === 0}
                      className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-60"
                    >
                      {updating ? "Diminution…" : "Diminuer"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAddQuantitySubmit} className="mt-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">
                        Quantité actuelle
                      </label>
                      <input
                        value={(updateContext.currentQuantity ?? 0).toLocaleString("fr-FR")}
                        disabled
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">
                        Quantité à ajouter
                      </label>
                      <input
                        value={addQuantity}
                        onChange={(event) => setAddQuantity(event.target.value)}
                        type="number"
                        min="1"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Date d&apos;expiration du lot ajouté
                    </label>
                    <input
                      type="date"
                      value={addExpiration}
                      onChange={(event) => setAddExpiration(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  </div>

                  {addQuantityError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {addQuantityError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={resetUpdateModal}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={updating}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {updating ? "Ajout…" : "Ajouter"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export function AgentAdminStocksPage() {
  const { accessToken, user } = useAuth();
  const isAgentAdmin = user?.role === "AGENT" && user?.agentLevel === "ADMIN";
  const isAgentStaff = user?.role === "AGENT" && user?.agentLevel === "STAFF";

  const [stocks, setStocks] = useState<HealthCenterStock[]>([]);
  const [vaccines, setVaccines] = useState<VaccineInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthCenterId, setHealthCenterId] = useState<string | null>(null);

  const [stats, setStats] = useState<StockStats>(emptyStats);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createVaccineId, setCreateVaccineId] = useState("");
  const [creating, setCreating] = useState(false);
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [lotContext, setLotContext] = useState<LotModalContext | null>(null);
  const [lotItems, setLotItems] = useState<LotItem[]>([]);
  const [lotTotalRemaining, setLotTotalRemaining] = useState(0);
  const [lotLoading, setLotLoading] = useState(false);
  const [lotError, setLotError] = useState<string | null>(null);
  const [healthDeletingId, setHealthDeletingId] = useState<string | null>(null);
  const [lotDeletingId, setLotDeletingId] = useState<string | null>(null);
  
  // États pour la modal d'annulation de rendez-vous
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const [cancellationModalData, setCancellationModalData] = useState<{
    actionType: "deleteStock" | "deleteLot" | "reduce";
    affectedAppointments: number;
    entityName?: string;
    onConfirm: () => void;
  } | null>(null);
  
  // États pour l'ajustement
  const canAdjust = user?.role === "SUPERADMIN";
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateContext, setUpdateContext] = useState<{ vaccineId: string; vaccineName: string; currentQuantity: number; healthCenterId?: string } | null>(null);
  const [updateQuantity, setUpdateQuantity] = useState<string>("");
  const [updateMode, setUpdateMode] = useState<"reduce" | "add">("add");
  const [reduceQuantity, setReduceQuantity] = useState<string>("");
  const [reduceRemaining, setReduceRemaining] = useState<number>(0);
  const [reduceLots, setReduceLots] = useState<LotItem[]>([]);
  const [reduceLoading, setReduceLoading] = useState(false);
  const [reduceError, setReduceError] = useState<string | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [reduceLotsLoaded, setReduceLotsLoaded] = useState(false);
  const [addQuantity, setAddQuantity] = useState<string>("");
  const [addQuantityError, setAddQuantityError] = useState<string | null>(null);
  const [addExpiration, setAddExpiration] = useState<string>("");
  const [updateExpiration, setUpdateExpiration] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  
  const [reservations, setReservations] = useState<any[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [reservationsModalOpen, setReservationsModalOpen] = useState(false);
  const [reservationSearch, setReservationSearch] = useState("");
  const [reservationVaccineFilter, setReservationVaccineFilter] = useState<string>("Tous");
  const [reservationStatusFilter, setReservationStatusFilter] = useState<string>("Tous");

  // États pour les onglets
  const [activeTab, setActiveTab] = useState<"stocks" | "pending-received" | "history">("stocks");
  
  // États pour les envois en attente (reçus)
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [pendingTransfersLoading, setPendingTransfersLoading] = useState(false);
  const [confirmingTransferId, setConfirmingTransferId] = useState<string | null>(null);
  const [rejectingTransferId, setRejectingTransferId] = useState<string | null>(null);
  
  // États pour l'historique
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [historyFilters, setHistoryFilters] = useState({
    vaccineId: "",
    fromType: "",
    toType: "",
    sentStartDate: "",
    sentEndDate: "",
    confirmedStartDate: "",
    confirmedEndDate: "",
    search: "",
  });

  const [legendExpanded, setLegendExpanded] = useState(false);

  const fetchHealthCenterStats = useCallback(async () => {
    if (!accessToken) {
      setStats(emptyStats);
      setStatsLoading(false);
      return;
    }

    try {
      setStatsLoading(true);
      setStatsError(null);

      const response = await fetch(`${API_URL}/api/stock/stats/health-center`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const payload = (await response.json()) as StockStats;
      setStats(payload);
    } catch (err) {
      console.error("Erreur récupération stats centre:", err);
      setStats(emptyStats);
      setStatsError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les statistiques du centre"
      );
    } finally {
      setStatsLoading(false);
    }
  }, [accessToken]);

  const fetchHealthCenterStocks = useCallback(async () => {
    if (!accessToken) {
      setStocks([]);
      setVaccines([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [stockRes, vaccineRes] = await Promise.all([
        fetch(`${API_URL}/api/stock/health-center`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        fetch(`${API_URL}/api/vaccine`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      ]);

      if (!stockRes.ok || !vaccineRes.ok) {
        const payload =
          (!stockRes.ok ? await stockRes.json().catch(() => null) : null) ??
          (!vaccineRes.ok ? await vaccineRes.json().catch(() => null) : null);
        throw new Error(payload?.message ?? "status non valide");
      }

      const stockPayload = await stockRes.json();
      const stockItems = Array.isArray(stockPayload?.healthCenter)
        ? stockPayload.healthCenter
        : [];
      
      // Charger les lots pour chaque stock et calculer les statistiques
      const stocksWithLots = await Promise.all(
        stockItems.map(async (stock: HealthCenterStock) => {
          try {
            const lotsRes = await fetch(`${API_URL}/api/stock/health-center/${stock.vaccineId}/lots`, {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
            });
            
            if (lotsRes.ok) {
              const lotsData: LotResponse = await lotsRes.json();
              const lots = lotsData.lots || [];
              const expiredLots = lots.filter((lot) => lot.status === "EXPIRED" || isDateExpired(lot.expiration));
              const expiredQuantity = expiredLots.reduce((sum, lot) => sum + lot.quantity, 0);
              
              return {
                ...stock,
                lotCount: lots.length,
                expiredLotCount: expiredLots.length,
                expiredQuantity,
              };
            }
          } catch (err) {
            console.error(`Erreur chargement lots pour ${stock.vaccineId}:`, err);
          }
          
          return {
            ...stock,
            lotCount: 0,
            expiredLotCount: 0,
            expiredQuantity: 0,
          };
        })
      );
      
      setStocks(stocksWithLots);
      
      // Stocker le healthCenterId depuis les stocks chargés
      if (stocksWithLots.length > 0 && stocksWithLots[0].healthCenterId) {
        setHealthCenterId(stocksWithLots[0].healthCenterId);
      } else if (stockItems.length > 0 && stockItems[0].healthCenterId) {
        setHealthCenterId(stockItems[0].healthCenterId);
      }

      const vaccinePayload: VaccineResponse = await vaccineRes.json();
      setVaccines(
        Array.isArray(vaccinePayload)
          ? vaccinePayload
          : Array.isArray(vaccinePayload?.vaccines)
          ? vaccinePayload.vaccines
          : []
      );
    } catch (err) {
      console.error("Erreur chargement stocks centre:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les stocks du centre"
      );
      setStocks([]);
      setVaccines([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const fetchReservations = useCallback(async () => {
    if (!accessToken) {
      setReservations([]);
      return;
    }

    try {
      setReservationsLoading(true);
      setReservationsError(null);

      const response = await fetch(`${API_URL}/api/stock/health-center/reservations`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `Erreur ${response.status}`);
      }

      const payload = await response.json();
      setReservations(Array.isArray(payload?.reservations) ? payload.reservations : []);
    } catch (err) {
      console.error("Erreur chargement réservations:", err);
      setReservationsError(
        err instanceof Error ? err.message : "Impossible de charger les réservations"
      );
      setReservations([]);
    } finally {
      setReservationsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchHealthCenterStocks();
    fetchHealthCenterStats();
  }, [fetchHealthCenterStocks, fetchHealthCenterStats]);

  const fetchPendingTransfers = useCallback(async () => {
    if (!accessToken) {
      setPendingTransfers([]);
      setPendingTransfersLoading(false);
      return;
    }
    try {
      setPendingTransfersLoading(true);
      const response = await fetch(`${API_URL}/api/stock/pending-transfers`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const payload = (await response.json()) as { transfers?: any[] };
      setPendingTransfers(Array.isArray(payload?.transfers) ? payload.transfers : []);
    } catch (err) {
      console.error("Erreur chargement envois en attente:", err);
      setPendingTransfers([]);
    } finally {
      setPendingTransfersLoading(false);
    }
  }, [accessToken]);

  const handleConfirmTransfer = useCallback(
    async (transferId: string) => {
      if (!accessToken) return;
      try {
        setConfirmingTransferId(transferId);
        const response = await fetch(
          `${API_URL}/api/stock/pending-transfers/${transferId}/confirm`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        // Recharger les données
        await Promise.all([
          fetchPendingTransfers(),
          fetchHealthCenterStocks(),
          fetchHealthCenterStats(),
        ]);
      } catch (err) {
        console.error("Erreur confirmation envoi:", err);
        alert(
          err instanceof Error
            ? err.message
            : "Impossible de confirmer la réception du stock.",
        );
      } finally {
        setConfirmingTransferId(null);
      }
    },
    [accessToken, fetchPendingTransfers, fetchHealthCenterStocks, fetchHealthCenterStats],
  );

  // Fonction pour récupérer l'historique
  const fetchTransferHistory = useCallback(async () => {
    if (!accessToken) return;
    try {
      setHistoryLoading(true);
      const params = new URLSearchParams({
        page: historyPage.toString(),
        limit: "20",
      });
      
      if (historyFilters.vaccineId) params.append("vaccineId", historyFilters.vaccineId);
      if (historyFilters.fromType) params.append("fromType", historyFilters.fromType);
      if (historyFilters.toType) params.append("toType", historyFilters.toType);
      if (historyFilters.sentStartDate) params.append("sentStartDate", historyFilters.sentStartDate);
      if (historyFilters.sentEndDate) params.append("sentEndDate", historyFilters.sentEndDate);
      if (historyFilters.confirmedStartDate) params.append("confirmedStartDate", historyFilters.confirmedStartDate);
      if (historyFilters.confirmedEndDate) params.append("confirmedEndDate", historyFilters.confirmedEndDate);
      if (historyFilters.search) params.append("search", historyFilters.search);

      const response = await fetch(`${API_URL}/api/stock/transfer-history?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      const payload = (await response.json()) as {
        history?: TransferHistoryItem[];
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
      };
      
      setTransferHistory(Array.isArray(payload?.history) ? payload.history : []);
      setHistoryTotal(payload?.total ?? 0);
      setHistoryTotalPages(payload?.totalPages ?? 0);
    } catch (err) {
      console.error("Erreur chargement historique:", err);
      setTransferHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [accessToken, historyPage, historyFilters]);

  // Fonction pour refuser un transfert
  const handleRejectTransfer = useCallback(
    async (transferId: string) => {
      if (!accessToken) return;
      const confirmed = window.confirm(
        "Êtes-vous sûr de vouloir refuser ce transfert ? Les quantités seront restaurées chez l'expéditeur."
      );
      if (!confirmed) return;

      try {
        setRejectingTransferId(transferId);
        const response = await fetch(
          `${API_URL}/api/stock/pending-transfers/${transferId}/reject`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        await Promise.all([
          fetchPendingTransfers(),
          fetchHealthCenterStocks(),
          fetchHealthCenterStats(),
        ]);
      } catch (err) {
        console.error("Erreur refus transfert:", err);
        alert(
          err instanceof Error
            ? err.message
            : "Impossible de refuser le transfert.",
        );
      } finally {
        setRejectingTransferId(null);
      }
    },
    [accessToken, fetchPendingTransfers, fetchHealthCenterStocks, fetchHealthCenterStats],
  );

  useEffect(() => {
    fetchHealthCenterStocks();
    fetchHealthCenterStats();
    if (activeTab === "pending-received") {
      fetchPendingTransfers();
    } else if (activeTab === "history") {
      fetchTransferHistory();
    } else {
      fetchPendingTransfers();
    }
  }, [fetchHealthCenterStocks, fetchHealthCenterStats, fetchPendingTransfers, activeTab, fetchTransferHistory]);

  // Format entity name helper (unique to AgentAdminStocksPage context)
  const formatEntityName = (type: string, name: string | null | undefined): string => {
    if (!name) return type;
    return name;
  };

  const availableVaccinesForCreation = useMemo(() => {
    const existing = new Set(stocks.map((stock) => stock.vaccineId));
    return vaccines.filter((vaccine) => !existing.has(vaccine.id));
  }, [stocks, vaccines]);

  const fetchHealthCenterLots = useCallback(
    async (vaccineId: string, healthCenterId?: string | null) => {
      if (!accessToken) return;
      try {
        setLotLoading(true);
        setLotError(null);

        const params = new URLSearchParams();
        if (healthCenterId) {
          params.set("healthCenterId", healthCenterId);
        }

        const response = await fetch(
          `${API_URL}/api/stock/health-center/${vaccineId}/lots${
            params.toString() ? `?${params.toString()}` : ""
          }`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        const payload = (await response.json()) as LotResponse;
        setLotItems(Array.isArray(payload?.lots) ? payload.lots : []);
        setLotTotalRemaining(payload?.totalRemaining ?? 0);
      } catch (err) {
        console.error("Erreur chargement lots centre:", err);
        setLotItems([]);
        setLotTotalRemaining(0);
        setLotError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les lots pour ce vaccin.",
        );
      } finally {
        setLotLoading(false);
      }
    },
    [accessToken],
  );

  const handleCreateStock = async (event: FormEvent) => {
    event.preventDefault();
    if (!createVaccineId || !accessToken) return;

    // Récupérer le healthCenterId depuis l'état ou depuis les stocks existants
   /* let currentHealthCenterId = healthCenterId || user?.healthCenterId;
    
    if (!currentHealthCenterId && stocks.length > 0 && stocks[0].healthCenterId) {
      currentHealthCenterId = stocks[0].healthCenterId;
      setHealthCenterId(currentHealthCenterId);
    }

    if (!currentHealthCenterId) {
      setError("Impossible de déterminer le centre de santé. Veuillez rafraîchir la page.");
      return;
    }*/

    try {
      setCreating(true);
      const response = await fetch(`${API_URL}/api/stock/health-center`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ 
          vaccineId: createVaccineId,
          //healthCenterId: currentHealthCenterId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `status ${response.status}`);
      }

      setCreateModalOpen(false);
      setCreateVaccineId("");
      await Promise.all([fetchHealthCenterStocks(), fetchHealthCenterStats()]);
    } catch (err) {
      console.error("Erreur création stock centre:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer le stock du centre"
      );
    } finally {
      setCreating(false);
    }
  };

  const healthCenterName = useMemo(() => {
    return (
      stocks.find((entry) => entry.healthCenter?.name)?.healthCenter?.name ??
      "Votre centre de santé"
    );
  }, [stocks]);

  const handleOpenHealthLotModal = useCallback(
    (stock: HealthCenterStock) => {
      const centerLabel = stock.healthCenter?.name ?? healthCenterName;
      setLotContext({
        vaccineId: stock.vaccineId,
        vaccineName: stock.vaccine.name,
        ownerLabel: centerLabel,
        ownerId: stock.healthCenterId ?? null,
      });
      setLotItems([]);
      setLotTotalRemaining(0);
      setLotError(null);
      setLotModalOpen(true);
      void fetchHealthCenterLots(stock.vaccineId, stock.healthCenterId ?? null);
    },
    [fetchHealthCenterLots, healthCenterName],
  );

  const closeHealthLotModal = useCallback(() => {
    setLotModalOpen(false);
    setLotContext(null);
    setLotItems([]);
    setLotTotalRemaining(0);
    setLotError(null);
  }, []);

  const handleDeleteHealthCenterStock = useCallback(
    async (stock: HealthCenterStock) => {
      if (!accessToken) return;

      // Pour SUPERADMIN uniquement : vérifier l'impact avant suppression
      if (user?.role === "SUPERADMIN") {
        try {
          const payload: Record<string, string> = { vaccineId: stock.vaccineId };
          if (stock.healthCenterId) {
            payload.healthCenterId = stock.healthCenterId;
          }

          const impactResponse = await fetch(
            `${API_URL}/api/stock/health-center/impact?${new URLSearchParams(payload).toString()}`,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (impactResponse.ok) {
            const impactData = await impactResponse.json();
            if (impactData.willCancelAppointments && impactData.affectedAppointments > 0) {
              // Afficher la modal de confirmation
              setCancellationModalData({
                actionType: "deleteStock",
                affectedAppointments: impactData.affectedAppointments,
                entityName: stock.vaccine.name,
                onConfirm: async () => {
                  setCancellationModalOpen(false);
                  await performDeleteHealthCenterStock(stock);
                },
              });
              setCancellationModalOpen(true);
              return;
            }
          }
        } catch (err) {
          console.error("Erreur vérification impact:", err);
          // En cas d'erreur, continuer avec la suppression normale
        }
      }

      // Pour les autres rôles ou si pas d'impact, utiliser la confirmation classique
      const confirmed = window.confirm(
        `Supprimer le stock pour le vaccin ${stock.vaccine.name} ?`,
      );
      if (!confirmed) {
        return;
      }

      await performDeleteHealthCenterStock(stock);
    },
    [accessToken, fetchHealthCenterStocks, fetchHealthCenterStats, user?.role],
  );

  const performDeleteHealthCenterStock = useCallback(
    async (stock: HealthCenterStock) => {
      if (!accessToken) return;

      try {
        setHealthDeletingId(stock.id);
        setError(null);

        const payload: Record<string, string> = { vaccineId: stock.vaccineId };
        if (stock.healthCenterId) {
          payload.healthCenterId = stock.healthCenterId;
        }

        const response = await fetch(`${API_URL}/api/stock/health-center`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? `status ${response.status}`);
        }

        await Promise.all([fetchHealthCenterStocks(), fetchHealthCenterStats()]);
      } catch (err) {
        console.error("Erreur suppression stock centre:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de supprimer ce stock de centre.",
        );
      } finally {
        setHealthDeletingId(null);
      }
    },
    [accessToken, fetchHealthCenterStocks, fetchHealthCenterStats],
  );

  const handleDeleteHealthCenterLot = useCallback(
    async (lotId: string) => {
      if (!accessToken || !lotContext) return;

      // Pour SUPERADMIN uniquement : vérifier l'impact avant suppression
      if (user?.role === "SUPERADMIN") {
        try {
          const impactResponse = await fetch(
            `${API_URL}/api/stock/lots/${lotId}/impact`,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (impactResponse.ok) {
            const impactData = await impactResponse.json();
            if (impactData.willCancelAppointments && impactData.affectedAppointments > 0) {
              // Afficher la modal de confirmation
              setCancellationModalData({
                actionType: "deleteLot",
                affectedAppointments: impactData.affectedAppointments,
                entityName: lotContext.vaccineName,
                onConfirm: async () => {
                  setCancellationModalOpen(false);
                  await performDeleteHealthCenterLot(lotId);
                },
              });
              setCancellationModalOpen(true);
              return;
            }
          }
        } catch (err) {
          console.error("Erreur vérification impact:", err);
          // En cas d'erreur, continuer avec la suppression normale
        }
      }

      await performDeleteHealthCenterLot(lotId);
    },
    [
      accessToken,
      fetchHealthCenterLots,
      fetchHealthCenterStats,
      fetchHealthCenterStocks,
      lotContext,
      user?.role,
    ],
  );

  const performDeleteHealthCenterLot = useCallback(
    async (lotId: string) => {
      if (!accessToken || !lotContext) return;
      try {
        setLotDeletingId(lotId);
        const response = await fetch(`${API_URL}/api/stock/lots/${lotId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }

        await fetchHealthCenterLots(lotContext.vaccineId, lotContext.ownerId ?? null);
        await Promise.all([fetchHealthCenterStocks(), fetchHealthCenterStats()]);
      } catch (err) {
        console.error("Erreur suppression lot:", err);
        setLotError(
          err instanceof Error
            ? err.message
            : "Impossible de supprimer le lot sélectionné.",
        );
      } finally {
        setLotDeletingId(null);
      }
    },
    [
      accessToken,
      fetchHealthCenterLots,
      fetchHealthCenterStats,
      fetchHealthCenterStocks,
      lotContext,
    ],
  );

  const filteredReservations = useMemo(() => {
    const normalizedSearch = reservationSearch.trim().toLowerCase();
    return reservations.filter((reservation) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        reservation.vaccine.name.toLowerCase().includes(normalizedSearch) ||
        reservation.appointment.child.name.toLowerCase().includes(normalizedSearch);

      const matchesVaccine =
        reservationVaccineFilter === "Tous" ||
        reservation.vaccine.name === reservationVaccineFilter;

      const appointmentDate = new Date(reservation.appointment.scheduledFor);
      const isPast = appointmentDate < new Date();
      const matchesStatus =
        reservationStatusFilter === "Tous" ||
        (reservationStatusFilter === "À venir" && !isPast) ||
        (reservationStatusFilter === "Passé" && isPast);

      return matchesSearch && matchesVaccine && matchesStatus;
    });
  }, [reservations, reservationSearch, reservationVaccineFilter, reservationStatusFilter]);

  // Fonctions pour l'ajustement
  const openUpdateModal = async (stock: HealthCenterStock) => {
    setUpdateContext({
      vaccineId: stock.vaccineId,
      vaccineName: stock.vaccine.name,
      currentQuantity: stock.quantity ?? 0,
      healthCenterId: stock.healthCenterId,
    });
    setUpdateQuantity(String(stock.quantity ?? 0));
    setUpdateMode("add");
    setAddQuantity("");
    setAddExpiration("");
    setUpdateExpiration("");
    setAddQuantityError(null);
    setReduceQuantity("");
    setReduceRemaining(0);
    setReduceLots([]);
    setReduceError(null);
    setSelectedLotId(null);
    setReduceLotsLoaded(false);
    setUpdateModalOpen(true);
  };

  const resetUpdateModal = () => {
    setUpdateModalOpen(false);
    setUpdateContext(null);
    setUpdateQuantity("");
    setAddQuantity("");
    setAddExpiration("");
    setUpdateExpiration("");
    setAddQuantityError(null);
    setUpdating(false);
    setReduceQuantity("");
    setReduceRemaining(0);
    setReduceLots([]);
    setReduceError(null);
    setSelectedLotId(null);
    setReduceLotsLoaded(false);
  };

  const loadLotsForReduce = useCallback(async () => {
    if (!updateContext?.vaccineId || !accessToken) return;

    try {
      setReduceLoading(true);
      setReduceError(null);
      const response = await fetch(
        `${API_URL}/api/stock/health-center/${updateContext.vaccineId}/lots`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Impossible de charger les lots");
      }

      const payload: LotResponse = await response.json();
      const validLots = payload.lots.filter((lot) => lot.remainingQuantity > 0);
      setReduceLots(validLots);
      setReduceRemaining(payload.totalRemaining);
      setReduceLotsLoaded(true); // Marquer comme chargé pour éviter les rechargements en boucle
      
      // Réinitialiser selectedLotId si le lot sélectionné n'existe plus dans les lots valides
      setSelectedLotId((currentSelectedId) => {
        if (currentSelectedId && !validLots.find((lot) => lot.id === currentSelectedId)) {
          return null;
        }
        return currentSelectedId;
      });
    } catch (err) {
      console.error("Erreur chargement lots:", err);
      setReduceError(
        err instanceof Error ? err.message : "Impossible de charger les lots"
      );
      setReduceLotsLoaded(true); // Marquer comme chargé même en cas d'erreur pour éviter les boucles
    } finally {
      setReduceLoading(false);
    }
  }, [updateContext?.vaccineId, accessToken]);

  // Réinitialiser le flag quand on change de mode ou de contexte
  useEffect(() => {
    if (updateMode === "add" || !updateContext?.vaccineId) {
      setReduceLotsLoaded(false);
    }
  }, [updateMode, updateContext?.vaccineId]);

  // Quand on passe en mode reduce, charger les lots une seule fois
  useEffect(() => {
    if (updateMode === "reduce" && updateContext?.vaccineId && !reduceLotsLoaded && !reduceLoading) {
      loadLotsForReduce();
    }
  }, [updateMode, updateContext?.vaccineId, loadLotsForReduce, reduceLotsLoaded, reduceLoading]);

  const handleAddQuantitySubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!updateContext || !accessToken) return;

    const quantityValue = Number(addQuantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setAddQuantityError("Veuillez saisir une quantité valide.");
      return;
    }

    if (!addExpiration) {
      setAddQuantityError("Veuillez indiquer la date d'expiration du lot ajouté.");
      return;
    }

    // Récupérer le healthCenterId depuis le contexte ou depuis les stocks existants
    let currentHealthCenterId: string | undefined = updateContext.healthCenterId;
    
    if (!currentHealthCenterId && stocks.length > 0) {
      const stock = stocks.find((s) => s.vaccineId === updateContext.vaccineId);
      if (stock?.healthCenterId) {
        currentHealthCenterId = stock.healthCenterId;
      }
    }

    // Ligne ~8306, remplacer par :
    if (!currentHealthCenterId) {
      currentHealthCenterId = healthCenterId ?? user?.healthCenterId ?? undefined;    }

    if (!currentHealthCenterId) {
      setAddQuantityError("Impossible de déterminer le centre de santé. Veuillez rafraîchir la page.");
      return;
    }

    try {
      setAddQuantityError(null);
      setUpdating(true);

      // Pour SUPERADMIN, utiliser updateStock qui crée directement un lot sans prélever du niveau supérieur
      // Pour les autres rôles, utiliser addStock qui prélève du niveau supérieur
      const isSuperAdmin = user?.role === "SUPERADMIN";
      
      if (isSuperAdmin) {
        // Utiliser updateStockHEALTHCENTER pour créer directement un lot
        const currentQuantity = updateContext.currentQuantity ?? 0;
        const newTotalQuantity = currentQuantity + quantityValue;
        
        const response = await fetch(`${API_URL}/api/stock/health-center`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            vaccineId: updateContext.vaccineId,
            healthCenterId: currentHealthCenterId,
            quantity: newTotalQuantity,
            expiration: `${addExpiration}T00:00:00.000Z`,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }
      } else {
        // Utiliser addStockHEALTHCENTER qui prélève du stock district
        const response = await fetch(`${API_URL}/api/stock/add-health-center`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            vaccineId: updateContext.vaccineId,
            healthCenterId: currentHealthCenterId,
            quantity: quantityValue,
            expiration: `${addExpiration}T00:00:00.000Z`,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? `status ${response.status}`);
        }
      }

      resetUpdateModal();
      await Promise.all([fetchHealthCenterStocks(), fetchHealthCenterStats()]);
    } catch (err) {
      console.error("Erreur ajout stock centre:", err);
      setAddQuantityError(
        err instanceof Error
          ? err.message
          : "Impossible d'ajouter au stock centre"
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleReduceLotSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!updateContext || !accessToken || !selectedLotId) return;

    // Vérifier qu'il y a des lots disponibles
    if (reduceLots.length === 0) {
      setReduceError("Aucun lot disponible avec une quantité restante.");
      return;
    }

    const quantityValue = Number(reduceQuantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setReduceError("Veuillez saisir une quantité valide supérieure à 0.");
      return;
    }

    const selectedLot = reduceLots.find((lot) => lot.id === selectedLotId);
    if (!selectedLot) {
      setReduceError("Lot sélectionné introuvable. Veuillez sélectionner un lot disponible.");
      setSelectedLotId(null);
      return;
    }

    // Vérifier que la quantité à réduire ne dépasse pas le stock disponible
    if (quantityValue > selectedLot.remainingQuantity) {
      setReduceError(
        `La quantité à réduire (${quantityValue.toLocaleString("fr-FR")}) dépasse le stock disponible (${selectedLot.remainingQuantity.toLocaleString("fr-FR")} doses).`
      );
      return;
    }

    const actualQuantityToReduce = quantityValue;

    // Pour SUPERADMIN uniquement : vérifier l'impact avant réduction
    if (user?.role === "SUPERADMIN") {
      try {
        const impactResponse = await fetch(
          `${API_URL}/api/stock/lots/${selectedLotId}/reduce-impact?quantity=${actualQuantityToReduce}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (impactResponse.ok) {
          const impactData = await impactResponse.json();
          if (impactData.willCancelAppointments && impactData.affectedAppointments > 0) {
            // Afficher la modal de confirmation
            setCancellationModalData({
              actionType: "reduce",
              affectedAppointments: impactData.affectedAppointments,
              entityName: updateContext.vaccineName,
              onConfirm: async () => {
                setCancellationModalOpen(false);
                await performReduceLot(selectedLotId, actualQuantityToReduce);
              },
            });
            setCancellationModalOpen(true);
            return;
          }
        }
      } catch (err) {
        console.error("Erreur vérification impact:", err);
        // En cas d'erreur, continuer avec la réduction normale
      }
    }

    await performReduceLot(selectedLotId, actualQuantityToReduce);
  };

  const performReduceLot = async (lotId: string, quantity: number) => {
    if (!updateContext || !accessToken) return;

    try {
      setReduceError(null);
      setUpdating(true);

      const response = await fetch(
        `${API_URL}/api/stock/health-center/lot/${lotId}/reduce`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            quantity,
          }),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Erreur lors de la diminution");
      }

      await loadLotsForReduce();
      
      // La diminution est terminée
      resetUpdateModal();
      await Promise.all([fetchHealthCenterStocks(), fetchHealthCenterStats()]);
    } catch (err) {
      console.error("Erreur diminution stock centre:", err);
      setReduceError(
        err instanceof Error
          ? err.message
          : "Impossible de diminuer le stock centre"
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <DashboardShell active="/dashboard/stocks">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {user?.role !== "SUPERADMIN" && (
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Stocks & lots</h2>
              <p className="text-sm text-slate-500">
                Suivi des stocks de votre centre de santé.
              </p>
            </div>
          )}
          
          {/* Boutons d'action et onglets */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* Bouton Nouveau lot */}
            {activeTab === "stocks" && (isAgentAdmin || user?.role === "SUPERADMIN") && (
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Nouveau lot
              </button>
            )}
            
            {/* Onglets */}
            <div className="border-b border-slate-200 md:border-b-0">
              <nav className="-mb-px flex space-x-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("stocks")}
                  className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "stocks"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Stocks
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pending-received")}
                  className={`relative whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "pending-received"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Envois en attente
                  {pendingTransfers.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
                      {pendingTransfers.length > 99 ? "99+" : pendingTransfers.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition ${
                    activeTab === "history"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Historique
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Contenu des onglets */}
        {activeTab === "stocks" && (
          <>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
              <button
                type="button"
                onClick={async () => {
                  console.log("Ouverture modal réservations");
                  setReservationsModalOpen(true);
                  await fetchReservations();
                  console.log("Réservations chargées:", reservations.length);
                }}
                className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:border-amber-400 hover:bg-amber-100"
              >
                <Clock className="h-4 w-4" />
                Réservations
              </button>
            </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title="Total de doses"
            value={
              statsLoading ? "…" : stats.totalQuantity.toLocaleString("fr-FR")
            }
            icon={Syringe}
            accent="emerald"
            loading={statsLoading}
          />
          <StatCard
            title="Stocks faibles"
            value={statsLoading ? "…" : stats.lowStockCount}
            icon={AlertTriangle}
            accent="red"
            loading={statsLoading}
          />
          <StatCard
            title="Lots expirés"
            value={statsLoading ? "…" : stats.expiredLots}
            icon={AlertTriangle}
            accent="red"
            loading={statsLoading}
          />
        </div>

        {statsError && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-700">
            {statsError}
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Notification pour les transferts en attente */}
        {pendingTransfers.length > 0 && (
          <div className="rounded-3xl border border-blue-200 bg-blue-50/80 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
                  <PackageOpen className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    {pendingTransfers.length} envoi{pendingTransfers.length > 1 ? "s" : ""} en attente de confirmation
                  </p>
                  <p className="text-xs text-blue-700">
                    Veuillez confirmer ou refuser les transferts reçus
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("pending-received")}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Voir les envois
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-blue-100 bg-blue-50/50 mb-4">
          <button
            type="button"
            onClick={() => setLegendExpanded(!legendExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-blue-100/50 transition rounded-xl"
          >
            <div className="flex items-center gap-2 flex-1">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <h4 className="text-xs font-semibold text-blue-900">Qu'est-ce qu'un lot ?</h4>
            </div>
            {legendExpanded ? (
              <ChevronUp className="h-4 w-4 text-blue-600 flex-shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-blue-600 flex-shrink-0" />
            )}
          </button>
          {legendExpanded && (
            <div className="px-3 pb-2 pt-1">
              <p className="text-xs text-blue-800 leading-relaxed">
                Un <strong>lot</strong> représente un ensemble de doses d'un vaccin avec une même date d'expiration. 
                Chaque stock peut contenir plusieurs lots, chacun ayant sa propre date d'expiration. 
                Les lots permettent de gérer efficacement la traçabilité et le suivi des vaccins, notamment pour identifier 
                les doses expirées et optimiser la distribution selon les dates d'expiration.
              </p>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4 text-sm text-slate-500">
            {healthCenterName}
          </div>
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Vaccin
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Quantité (centre)
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Nombre de lots
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Chargement des stocks du centre…
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-sm text-slate-500"
                  >
                    Aucun stock enregistré pour le moment.
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => {
                  const lotCount = stock.lotCount ?? 0;
                  const expiredLotCount = stock.expiredLotCount ?? 0;
                  const expiredQuantity = stock.expiredQuantity ?? 0;
                  
                  return (
                    <tr
                      key={stock.id}
                      className="hover:bg-slate-50/80"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {stock.vaccine.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {stock.vaccine.description}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">
                          {(stock.quantity ?? 0).toLocaleString("fr-FR")}
                          {expiredQuantity > 0 && (
                            <span className="ml-2 text-sm font-normal text-red-600">
                              ({expiredQuantity.toLocaleString("fr-FR")} expiré{expiredQuantity > 1 ? "s" : ""})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {stock.vaccine.dosesRequired} doses requises
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-slate-700">
                          {lotCount} lot{lotCount > 1 ? "s" : ""}
                          {expiredLotCount > 0 && (
                            <span className="ml-2 text-red-600">
                              - {expiredLotCount} expiré{expiredLotCount > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenHealthLotModal(stock)}
                            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                          >
                            <PackageOpen className="h-4 w-4" />
                            Lots
                          </button>
                          {canAdjust && (
                            <button
                              type="button"
                              onClick={() => openUpdateModal(stock)}
                              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-100"
                            >
                              Ajuster
                            </button>
                          )}
                          {(isAgentAdmin || user?.role === "SUPERADMIN") && (user?.role === "SUPERADMIN" || (stock.expiredLotCount ?? 0) > 0) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteHealthCenterStock(stock)}
                              disabled={healthDeletingId === stock.id}
                              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                            >
                              <Trash2 className="h-4 w-4" />
                              {healthDeletingId === stock.id ? "Suppression…" : "Supprimer"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
          </>
        )}

        {activeTab === "pending-received" && (
          <div className="space-y-6">
            {pendingTransfersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : pendingTransfers.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                <PackageOpen className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-sm font-medium text-slate-900">Aucun envoi en attente</p>
                <p className="mt-2 text-sm text-slate-500">
                  Vous n'avez aucun transfert en attente de confirmation.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-hidden rounded-2xl md:rounded-3xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Vaccin
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Expéditeur
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Quantité
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Date d'envoi
                      </th>
                      <th className="px-2 md:px-6 py-1.5 md:py-3 text-right text-[10px] md:text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {pendingTransfers.map((transfer) => {
                      const sentDate = new Date(transfer.createdAt);
                      return (
                        <tr key={transfer.id} className="hover:bg-slate-50">
                          <td className="px-2 md:px-6 py-2 md:py-4">
                            <div className="text-xs md:text-sm font-medium text-slate-900">
                              {transfer.vaccine?.name ?? "Vaccin inconnu"}
                            </div>
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-700">
                            {formatEntityName(transfer.fromType, transfer.fromName)}
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-700">
                            {transfer.quantity.toLocaleString("fr-FR")} doses
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4 text-xs md:text-sm text-slate-600">
                            {sentDate.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-2 md:px-6 py-2 md:py-4">
                            <div className="flex justify-end gap-1 md:gap-2">
                              <button
                                type="button"
                                onClick={() => handleRejectTransfer(transfer.id)}
                                disabled={isAgentStaff || rejectingTransferId === transfer.id}
                                className="flex items-center gap-1 md:gap-2 rounded-lg md:rounded-xl border border-red-200 bg-red-50 px-2 md:px-4 py-1 md:py-2 text-[10px] md:text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                                title={isAgentStaff ? "Réservé aux agents admin" : ""}
                              >
                                {rejectingTransferId === transfer.id ? (
                                  <>
                                    <div className="h-3 w-3 md:h-4 md:w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                    <span className="hidden sm:inline">Refus...</span>
                                    <span className="sm:hidden">...</span>
                                  </>
                                ) : (
                                  <>
                                    <X className="h-3 w-3 md:h-4 md:w-4" />
                                    <span className="hidden sm:inline">Refuser</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmTransfer(transfer.id)}
                                disabled={isAgentStaff || confirmingTransferId === transfer.id}
                                className="flex items-center gap-1 md:gap-2 rounded-lg md:rounded-xl bg-emerald-600 px-2 md:px-4 py-1 md:py-2 text-[10px] md:text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                title={isAgentStaff ? "Réservé aux agents admin" : ""}
                              >
                                {confirmingTransferId === transfer.id ? (
                                  <>
                                    <div className="h-3 w-3 md:h-4 md:w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    <span className="hidden sm:inline">Confirmation...</span>
                                    <span className="sm:hidden">...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-3 w-3 md:h-4 md:w-4" />
                                    <span className="hidden sm:inline">Confirmer</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-6">
            {/* Filtres */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Historique des envois</h3>
                <p className="text-sm text-slate-500">
                  Tous les transferts de stock confirmés
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="w-[180px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Rechercher
                  </label>
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={historyFilters.search}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, search: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                
                {/* Bloc Date d'envoi */}
                <div className="w-[280px] rounded-xl border-2 border-blue-200 bg-blue-50/30 p-3">
                  <label className="mb-2 block text-xs font-semibold text-blue-700">
                    Date d'envoi
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Du
                      </label>
                      <input
                        type="date"
                        value={historyFilters.sentStartDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, sentStartDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Au
                      </label>
                      <input
                        type="date"
                        value={historyFilters.sentEndDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, sentEndDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Bloc Date de confirmation/annulation */}
                <div className="w-[280px] rounded-xl border-2 border-green-200 bg-green-50/30 p-3">
                  <label className="mb-2 block text-xs font-semibold text-green-700">
                    Date de confirmation/annulation
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Du
                      </label>
                      <input
                        type="date"
                        value={historyFilters.confirmedStartDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, confirmedStartDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Au
                      </label>
                      <input
                        type="date"
                        value={historyFilters.confirmedEndDate}
                        onChange={(e) => setHistoryFilters({ ...historyFilters, confirmedEndDate: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="w-[140px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Expéditeur
                  </label>
                  <select
                    value={historyFilters.fromType}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, fromType: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Tous expéditeurs</option>
                    <option value="NATIONAL">National</option>
                    <option value="REGIONAL">Régional</option>
                    <option value="DISTRICT">District</option>
                    <option value="HEALTHCENTER">Centre de santé</option>
                  </select>
                </div>
                <div className="w-[140px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Destinataire
                  </label>
                  <select
                    value={historyFilters.toType}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, toType: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Tous destinataires</option>
                    <option value="REGIONAL">Régional</option>
                    <option value="DISTRICT">District</option>
                    <option value="HEALTHCENTER">Centre de santé</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      // Validation : si une date de début est remplie, la date de fin doit l'être aussi
                      if (
                        (historyFilters.sentStartDate && !historyFilters.sentEndDate) ||
                        (!historyFilters.sentStartDate && historyFilters.sentEndDate) ||
                        (historyFilters.confirmedStartDate && !historyFilters.confirmedEndDate) ||
                        (!historyFilters.confirmedStartDate && historyFilters.confirmedEndDate)
                      ) {
                        alert("Veuillez remplir les deux dates (du et au) pour chaque période de filtrage.");
                        return;
                      }
                      setHistoryPage(1);
                      fetchTransferHistory();
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                  >
                    <Search className="h-4 w-4" />
                    Filtrer
                  </button>
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : transferHistory.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                <PackageOpen className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-sm font-medium text-slate-900">Aucun historique</p>
                <p className="mt-2 text-sm text-slate-500">
                  Aucun transfert confirmé pour le moment.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Vaccin
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Expéditeur
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Destinataire
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Quantité
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Date envoi
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Confirmation/annulation
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Expiration lot
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {transferHistory.map((item) => {
                        const sentDate = new Date(item.sentAt);
                        const confirmedDate = item.confirmedAt ? new Date(item.confirmedAt) : null;
                        const expirationDate = item.lotExpiration ? new Date(item.lotExpiration) : null;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-900">
                                {item.vaccineName}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              {formatEntityName(item.fromType, item.fromName)}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              {formatEntityName(item.toType, item.toName)}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              {item.quantity.toLocaleString("fr-FR")} doses
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {sentDate.toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {confirmedDate
                                ? confirmedDate.toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "N/A"}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {expirationDate
                                ? expirationDate.toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  item.status === "CONFIRMED"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {item.status === "CONFIRMED" ? "Confirmé" : "Annulé"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {historyTotalPages > 1 && (
                  <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-6 py-4">
                    <div className="text-sm text-slate-700">
                      Page {historyPage} sur {historyTotalPages} ({historyTotal} résultats)
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryPage((p) => Math.max(1, p - 1));
                        }}
                        disabled={historyPage === 1}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Précédent
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryPage((p) => Math.min(historyTotalPages, p + 1));
                        }}
                        disabled={historyPage === historyTotalPages}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {(isAgentAdmin || user?.role === "SUPERADMIN") && createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-lg rounded-3xl bg-white shadow-2xl">
            <form onSubmit={handleCreateStock} className="space-y-4 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Créer un stock centre
              </h3>
              <p className="text-sm text-slate-500">
                Sélectionnez un vaccin qui n&apos;a pas encore de stock dans votre centre.
              </p>

              <select
                value={createVaccineId}
                onChange={(event) => setCreateVaccineId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                required
              >
                <option value="">— Sélectionner un vaccin —</option>
                {availableVaccinesForCreation.map((vaccine) => (
                  <option key={vaccine.id} value={vaccine.id}>
                    {vaccine.name}
                  </option>
                ))}
              </select>

              {availableVaccinesForCreation.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  Tous les vaccins possèdent déjà un stock dans votre centre.
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setCreateVaccineId("");
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating || availableVaccinesForCreation.length === 0}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {creating ? "Création…" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lotModalOpen && lotContext && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-[95vw] md:max-w-3xl rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Lots du vaccin {lotContext.vaccineName}
                </h3>
                <p className="text-sm text-slate-500">
                  Historique des lots enregistrés pour {lotContext.ownerLabel ?? "votre centre"}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeHealthLotModal}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Fermer
              </button>
            </div>

            {lotError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {lotError}
              </div>
            )}

            <div className="mt-4 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200">
              {lotLoading ? (
                <div className="flex items-center justify-center px-6 py-10 text-sm text-slate-500">
                  Chargement des lots…
                </div>
              ) : lotItems.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-500">
                  Aucun lot enregistré pour ce vaccin.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Lot
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Expiration
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Quantité
                      </th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
                        Restant
                      </th>
                      {isAgentAdmin && (
                        <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lotItems.map((lot) => {
                      const expired =
                        lot.status === "EXPIRED" || isDateExpired(lot.expiration);
                      return (
                        <tr
                          key={lot.id}
                          className={expired ? "bg-red-50/70 hover:bg-red-50" : "hover:bg-slate-50/80"}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{lot.id}</div>
                            {lot.sourceLotId && (
                              <div className="text-xs text-slate-500">
                                Issu du lot {lot.sourceLotId}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                expired ? "font-medium text-red-600" : "font-medium text-slate-700"
                              }
                            >
                              {formatExpirationDate(lot.expiration)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {lot.quantity.toLocaleString("fr-FR")}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="flex items-center gap-2">
                              <span>{lot.remainingQuantity.toLocaleString("fr-FR")}</span>
                              {lot.reservedQuantity && lot.reservedQuantity > 0 && (
                                <span className="text-xs text-amber-600">
                                  ({lot.reservedQuantity} réservé{lot.reservedQuantity > 1 ? "s" : ""})
                                </span>
                              )}
                            </div>
                          </td>
                          {(isAgentAdmin || user?.role === "SUPERADMIN") && (user?.role === "SUPERADMIN" || expired) && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHealthCenterLot(lot.id)}
                                  disabled={lotDeletingId === lot.id}
                                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {lotDeletingId === lot.id ? "Suppression…" : "Supprimer"}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div>
                Total restant pour {lotContext.ownerLabel ?? "votre centre"} :{" "}
                <span className="font-semibold text-slate-800">
                  {lotTotalRemaining.toLocaleString("fr-FR")} dose(s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeHealthLotModal}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reservationsModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4" style={{ zIndex: 9999 }}>
          <div className="w-full max-w-[95vw] md:max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-amber-50 to-amber-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Vaccins réservés
                </h3>
                <p className="text-sm text-slate-600">
                  Doses réservées pour des rendez-vous programmés
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReservationsModalOpen(false);
                  setReservationSearch("");
                  setReservationVaccineFilter("Tous");
                  setReservationStatusFilter("Tous");
                }}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {reservationsError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {reservationsError}
                </div>
              )}

              {!reservationsLoading && reservations.length === 0 && !reservationsError && (
                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                  Aucune réservation trouvée. Les réservations apparaîtront ici lorsqu'un rendez-vous est programmé.
                </div>
              )}

              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-600" />
                  <h4 className="text-sm font-semibold text-slate-900">Filtres</h4>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={reservationSearch}
                      onChange={(e) => setReservationSearch(e.target.value)}
                      placeholder="Rechercher un enfant ou vaccin..."
                      className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>

                  <div>
                    <select
                      value={reservationVaccineFilter}
                      onChange={(e) => setReservationVaccineFilter(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-4 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    >
                      <option value="Tous">Tous les vaccins</option>
                      {Array.from(new Set(reservations.map((r) => r.vaccine.name)))
                        .sort()
                        .map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={reservationStatusFilter}
                      onChange={(e) => setReservationStatusFilter(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-4 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    >
                      <option value="Tous">Tous les statuts</option>
                      <option value="À venir">À venir</option>
                      <option value="Passé">Passé</option>
                    </select>
                  </div>
                </div>
              </div>

              {reservationsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600" />
                    <p className="text-sm text-slate-600">Chargement des réservations...</p>
                  </div>
                </div>
              ) : filteredReservations.length === 0 ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="text-center">
                        <Clock className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                        <p className="font-medium text-slate-500">Aucune réservation trouvée</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredReservations.map((reservation) => {
                        const appointmentDate = new Date(reservation.appointment.scheduledFor);
                        const isPast = appointmentDate < new Date();
                        const lotExpiration = new Date(reservation.lot.expiration);
                        const lotExpired = lotExpiration < new Date();

                        return (
                          <div
                            key={reservation.id}
                            className={`rounded-xl border p-4 ${
                              isPast
                                ? "border-red-200 bg-red-50/50"
                                : lotExpired
                                ? "border-amber-300 bg-amber-50/50"
                                : "border-amber-200 bg-amber-50/30"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="mb-2 flex items-center gap-2">
                                  <Syringe className="h-4 w-4 text-amber-600" />
                                  <span className="font-semibold text-slate-900">
                                    {reservation.vaccine.name}
                                  </span>
                                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                                    {reservation.quantity} dose{reservation.quantity > 1 ? "s" : ""}
                                  </span>
                                  {isPast && (
                                    <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs font-medium text-red-800">
                                      Rendez-vous passé
                                    </span>
                                  )}
                                  {lotExpired && (
                                    <span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-medium text-amber-900">
                                      Lot expiré
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-2">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-slate-400" />
                                    <span>
                                      <span className="font-medium">Enfant:</span>{" "}
                                      {reservation.appointment.child.name}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-slate-400" />
                                    <span>
                                      <span className="font-medium">RDV:</span>{" "}
                                      {appointmentDate.toLocaleDateString("fr-FR", {
                                        weekday: "long",
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <PackageOpen className="h-4 w-4 text-slate-400" />
                                    <span>
                                      <span className="font-medium">Dose:</span>{" "}
                                      {reservation.appointment.dose}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-slate-400" />
                                    <span>
                                      <span className="font-medium">Lot expire:</span>{" "}
                                      {lotExpiration.toLocaleDateString("fr-FR")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>
                  {reservationsLoading
                    ? "Chargement..."
                    : `${filteredReservations.length} réservation${filteredReservations.length > 1 ? "s" : ""}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReservationsModalOpen(false);
                    setReservationSearch("");
                    setReservationVaccineFilter("Tous");
                    setReservationStatusFilter("Tous");
                  }}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {updateModalOpen && updateContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[95vw] md:max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Ajuster le stock — {updateContext.vaccineName}
              </h3>

              <div className="mt-6 flex flex-col gap-4 md:flex-row">
                <button
                  type="button"
                  onClick={() => setUpdateMode("add")}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-medium transition ${
                    updateMode === "add"
                      ? "border-blue-300 bg-blue-50 text-blue-700 shadow"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Ajouter au stock
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateMode("reduce")}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-medium transition ${
                    updateMode === "reduce"
                      ? "border-orange-300 bg-orange-50 text-orange-700 shadow"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Diminuer
                </button>
              </div>

              {updateMode === "reduce" ? (
                <form onSubmit={handleReduceLotSubmit} className="mt-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Quantité à diminuer
                    </label>
                    <input
                      value={reduceQuantity}
                      onChange={(event) => setReduceQuantity(event.target.value)}
                      type="number"
                      min="1"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      required
                      disabled={updating}
                    />
                    <p className="text-xs text-slate-500">
                      Quantité totale disponible : {reduceRemaining.toLocaleString("fr-FR")} doses
                    </p>
                  </div>

                  {reduceLoading ? (
                    <div className="text-center py-4 text-slate-500">
                      Chargement des lots...
                    </div>
                  ) : reduceLots.length === 0 ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      Aucun lot disponible avec une quantité restante.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-600">
                        Choisir le lot dans lequel diminuer
                      </label>
                      <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-3">
                        {reduceLots.map((lot) => (
                          <button
                            key={lot.id}
                            type="button"
                            onClick={() => setSelectedLotId(lot.id)}
                            className={`w-full text-left p-3 rounded-lg border transition ${
                              selectedLotId === lot.id
                                ? "border-orange-500 bg-orange-50"
                                : "border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium text-slate-900">
                                  Lot expirant le {new Date(lot.expiration).toLocaleDateString("fr-FR")}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Quantité disponible : {lot.remainingQuantity.toLocaleString("fr-FR")} doses
                                </div>
                              </div>
                              {selectedLotId === lot.id && (
                                <div className="text-orange-600">✓</div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {reduceError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {reduceError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={resetUpdateModal}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                      disabled={updating}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={updating || !selectedLotId || !reduceQuantity || reduceLots.length === 0}
                      className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-60"
                    >
                      {updating ? "Diminution…" : "Diminuer"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAddQuantitySubmit} className="mt-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">
                        Quantité actuelle
                      </label>
                      <input
                        value={(updateContext.currentQuantity ?? 0).toLocaleString("fr-FR")}
                        disabled
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">
                        Quantité à ajouter
                      </label>
                      <input
                        value={addQuantity}
                        onChange={(event) => setAddQuantity(event.target.value)}
                        type="number"
                        min="1"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Date d&apos;expiration du lot ajouté
                    </label>
                    <input
                      type="date"
                      value={addExpiration}
                      onChange={(event) => setAddExpiration(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      required
                    />
                  </div>

                  {addQuantityError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {addQuantityError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={resetUpdateModal}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={updating}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {updating ? "Ajout…" : "Ajouter"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal d'annulation de rendez-vous */}
      {cancellationModalData && (
        <AppointmentCancellationModal
          isOpen={cancellationModalOpen}
          onClose={() => {
            setCancellationModalOpen(false);
            setCancellationModalData(null);
          }}
          onConfirm={cancellationModalData.onConfirm}
          affectedAppointments={cancellationModalData.affectedAppointments}
          actionType={cancellationModalData.actionType}
          entityName={cancellationModalData.entityName}
          isLoading={healthDeletingId !== null || lotDeletingId !== null || updating}
        />
      )}
    </DashboardShell>
  );
}

function StocksAccessFallback() {
  return (
    <DashboardShell active="/dashboard/stocks">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">
        <p className="text-lg font-semibold text-slate-900">
          Accès au module de stocks restreint
        </p>
        <p className="mt-2 text-sm">
          Votre rôle ne permet pas encore de consulter ou de modifier les stocks.
        </p>
      </div>
    </DashboardShell>
  );
}

export default function StocksPage() {
  const { user } = useAuth();

  if (!user) {
    return <StocksAccessFallback />;
  }

  if (user.role === "NATIONAL") {
    return <NationalStocksPage />;
  }

  if (user.role === "REGIONAL") {
    return <RegionalStocksPage />;
  }

  if (user.role === "DISTRICT") {
    return <DistrictStocksPage />;
  }

  if (user.role === "AGENT" && (user.agentLevel === "ADMIN" || user.agentLevel === "STAFF")) {
    return <AgentAdminStocksPage />;
  }

  return <StocksAccessFallback />;
}
