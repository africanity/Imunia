"use client";

import { FormEvent, useEffect, useMemo, useState, useCallback } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  CheckCircle,
  Clock,
  Filter,
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

function NationalStocksPage() {
  const { accessToken, user } = useAuth();
  const canAdjust = user?.role === "NATIONAL";

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
  const [updateMode, setUpdateMode] = useState<"set" | "add">("set");
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

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentQuantityValue = updateContext?.currentQuantity ?? 0;
  const parsedUpdateQuantity = Number(updateQuantity);
  const requiresExpirationForSet =
    updateMode === "set" &&
    Number.isFinite(parsedUpdateQuantity) &&
    parsedUpdateQuantity > currentQuantityValue;

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

      if (!stockRes.ok || !vaccineRes.ok || !regionsRes.ok) {
        throw new Error("status non valide");
      }

      const stockData: NationalStockResponse = await stockRes.json();
      const vaccineData: VaccineResponse = await vaccineRes.json();
      const regionsData: RegionsResponse = await regionsRes.json();

      setStocks(Array.isArray(stockData?.national) ? stockData.national : []);
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

  useEffect(() => {
    fetchNationalStocks();
    fetchNationalStats();
  }, [fetchNationalStocks, fetchNationalStats]);

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

  const openUpdateModal = (stock: NationalStock) => {
    setUpdateContext({
      vaccineId: stock.vaccineId,
      vaccineName: stock.vaccine.name,
      currentQuantity: stock.quantity ?? 0,
    });
    setUpdateQuantity(String(stock.quantity ?? 0));
    setUpdateMode("set");
    setAddQuantity("");
    setAddExpiration("");
    setUpdateExpiration("");
    setAddQuantityError(null);
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

  return (
    <DashboardShell active="/dashboard/stocks">
      <div className="space-y-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Stocks & lots</h2>
            <p className="text-sm text-slate-500">
              Suivi des stocks nationaux et distribution vers les régions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Nouveau lot
          </button>
        </div>

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

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
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
                  Expiration
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
                  const expired =
                    stock.hasExpiredLot ||
                    (stock.nearestExpiration
                      ? isDateExpired(stock.nearestExpiration)
                      : false);
                  return (
                    <tr
                      key={stock.id}
                      className={
                        expired
                          ? "bg-red-50/70 text-red-700 hover:bg-red-50"
                          : "hover:bg-slate-50/80"
                      }
                    >
                    <td className="px-6 py-4">
                      <div
                        className={`font-semibold ${
                          expired ? "text-red-700" : "text-slate-900"
                        }`}
                      >
                        {stock.vaccine.name}
                      </div>
                      <div
                        className={`text-xs ${
                          expired ? "text-red-600" : "text-slate-500"
                        }`}
                      >
                        {stock.vaccine.description}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className={`font-semibold ${
                          expired ? "text-red-700" : "text-slate-800"
                        }`}
                      >
                        {(stock.quantity ?? 0).toLocaleString("fr-FR")}
                      </div>
                      <div
                        className={`text-xs ${
                          expired ? "text-red-600" : "text-slate-500"
                        }`}
                      >
                        {stock.vaccine.dosesRequired} doses requises
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {stock.nearestExpiration ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${
                              expired ? "text-red-700" : "text-slate-700"
                            }`}
                          >
                            {formatExpirationDate(stock.nearestExpiration)}
                          </span>
                          {isDateExpired(stock.nearestExpiration) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                              <AlertTriangle className="h-3 w-3" />
                              Expiré
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">Non définie</span>
                      )}
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
                        <button
                          type="button"
                          onClick={() => openTransferModal(stock)}
                          className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                          Envoyer
                        </button>
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
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
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
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Ajuster le stock — {updateContext.vaccineName}
              </h3>

              <div className="mt-6 flex flex-col gap-4 md:flex-row">
                <button
                  type="button"
                  onClick={() => setUpdateMode("set")}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-medium transition ${
                    updateMode === "set"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Remplacer la quantité
                </button>
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
              </div>

              {updateMode === "set" ? (
                <form onSubmit={handleSetQuantitySubmit} className="mt-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">
                      Nouvelle quantité nationale
                    </label>
                    <input
                      value={updateQuantity}
                      onChange={(event) => setUpdateQuantity(event.target.value)}
                      type="number"
                      min="0"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      required
                    />
                    <p className="text-xs text-slate-500">
                      Quantité actuelle : {(updateContext.currentQuantity ?? 0).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  {requiresExpirationForSet && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">
                        Date d&apos;expiration du stock ajouté
                      </label>
                      <input
                        type="date"
                        value={updateExpiration}
                        onChange={(event) => setUpdateExpiration(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        required
                      />
                      <p className="text-xs text-slate-500">
                        Ajout de{" "}
                        {(parsedUpdateQuantity - currentQuantityValue).toLocaleString("fr-FR")}{" "}
                        doses supplémentaires.
                      </p>
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
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {updating ? "Enregistrement…" : "Enregistrer"}
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
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
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
          <div className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
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
                        <tr key={lot.id} className="hover:bg-slate-50/80">
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
                              <button
                                type="button"
                                onClick={() => handleDeleteLot(lot.id)}
                                disabled={!expired || lotDeletingId === lot.id}
                                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                  expired
                                    ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                    : "border-slate-200 bg-slate-100 text-slate-400"
                                }`}
                              >
                                <Trash2 className="h-4 w-4" />
                                {lotDeletingId === lot.id ? "Suppression…" : "Supprimer"}
                              </button>
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
                  onClick={() => lotContext && fetchLotsForVaccine(lotContext.vaccineId)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Rafraîchir
                </button>
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
};

type DistrictOption = {
  id: string;
  name: string;
};

type HealthCenterOption = {
  id: string;
  name: string;
  districtId?: string | null;
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
};

function RegionalStocksPage() {
  const { accessToken } = useAuth();

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
  
  // États pour les envois en attente
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [pendingTransfersLoading, setPendingTransfersLoading] = useState(false);
  const [confirmingTransferId, setConfirmingTransferId] = useState<string | null>(null);

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

      if (!stockRes.ok || !vaccineRes.ok || !districtRes.ok) {
        const payload =
          (!stockRes.ok ? await stockRes.json().catch(() => null) : null) ??
          (!vaccineRes.ok ? await vaccineRes.json().catch(() => null) : null) ??
          (!districtRes.ok ? await districtRes.json().catch(() => null) : null);
        throw new Error(payload?.message ?? "status non valide");
      }

      const stockPayload = (await stockRes.json()) as { regional?: RegionalStock[] };
      const vaccinePayload: VaccineResponse = await vaccineRes.json();
      const districtPayload = await districtRes.json();

      setStocks(Array.isArray(stockPayload?.regional) ? stockPayload.regional : []);
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

  useEffect(() => {
    fetchRegionalStocks();
    fetchRegionalStats();
    fetchPendingTransfers();
  }, [fetchRegionalStocks, fetchRegionalStats, fetchPendingTransfers]);

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

  const refreshRegionalLots = useCallback(() => {
    if (lotContext) {
      void fetchRegionalLots(lotContext.vaccineId, lotContext.ownerId ?? null);
    }
  }, [fetchRegionalLots, lotContext]);

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

  return (
    <DashboardShell active="/dashboard/stocks">
      <div className="space-y-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Stocks & lots</h2>
            <p className="text-sm text-slate-500">
              Suivi des stocks régionaux et distribution vers les districts.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              disabled={availableVaccinesForCreation.length === 0}
            >
              <Plus className="h-4 w-4" />
              Nouveau lot
            </button>
            <button
              type="button"
              onClick={fetchRegionalStocks}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:text-blue-600"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Actualiser
            </button>
          </div>
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

        {/* Section Envois en attente */}
        {pendingTransfers.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-blue-200 bg-blue-50/50 shadow-sm">
            <div className="bg-blue-100 px-6 py-4">
              <h3 className="text-lg font-semibold text-blue-900">
                Envois en attente de confirmation
              </h3>
              <p className="text-sm text-blue-700">
                Confirmez la réception des stocks envoyés depuis le niveau national
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-200">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Vaccin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Quantité
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Date d'envoi
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100 bg-white">
                  {pendingTransfers.map((transfer) => {
                    const sentDate = new Date(transfer.createdAt);
                    return (
                      <tr key={transfer.id} className="hover:bg-blue-50/50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">
                            {transfer.vaccine?.name ?? "Vaccin inconnu"}
                          </div>
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
                              onClick={() => handleConfirmTransfer(transfer.id)}
                              disabled={confirmingTransferId === transfer.id}
                              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {confirmingTransferId === transfer.id ? (
                                <>
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                  Confirmation...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  Confirmer la réception
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
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
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
                  Expiration
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
                  const expired =
                    stock.hasExpiredLot ||
                    (stock.nearestExpiration
                      ? isDateExpired(stock.nearestExpiration)
                      : false);
                  return (
                    <tr
                      key={stock.id}
                      className={
                        expired
                          ? "bg-red-50/70 text-red-700 hover:bg-red-50"
                          : "hover:bg-slate-50/80"
                      }
                    >
                    <td className="px-6 py-4">
                      <div
                        className={`font-semibold ${
                          expired ? "text-red-700" : "text-slate-900"
                        }`}
                      >
                        {stock.vaccine.name}
                      </div>
                      <div
                        className={`text-xs ${
                          expired ? "text-red-600" : "text-slate-500"
                        }`}
                      >
                        {stock.vaccine.description}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className={`font-semibold ${
                          expired ? "text-red-700" : "text-slate-800"
                        }`}
                      >
                        {(stock.quantity ?? 0).toLocaleString("fr-FR")}
                      </div>
                      <div
                        className={`text-xs ${
                          expired ? "text-red-600" : "text-slate-500"
                        }`}
                      >
                        {stock.region?.name ?? "Votre région"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {stock.nearestExpiration ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${
                              expired ? "text-red-700" : "text-slate-700"
                            }`}
                          >
                            {formatExpirationDate(stock.nearestExpiration)}
                          </span>
                          {isDateExpired(stock.nearestExpiration) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                              <AlertTriangle className="h-3 w-3" />
                              Expiré
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">Non définie</span>
                      )}
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
                        <button
                          type="button"
                          onClick={() => openTransferModal(stock)}
                          className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                          Envoyer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRegionalStock(stock)}
                          disabled={regionalDeletingId === stock.id}
                          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          {regionalDeletingId === stock.id ? "Suppression…" : "Supprimer"}
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
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
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
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
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
                  {districts.map((district) => (
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
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
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
                        <tr key={lot.id} className="hover:bg-slate-50/80">
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
                  onClick={refreshRegionalLots}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Rafraîchir
                </button>
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
    </DashboardShell>
  );
}

function DistrictStocksPage() {
  const { accessToken } = useAuth();

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

  // États pour les envois en attente
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [pendingTransfersLoading, setPendingTransfersLoading] = useState(false);
  const [confirmingTransferId, setConfirmingTransferId] = useState<string | null>(null);

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

      if (!stockRes.ok || !vaccineRes.ok || !healthRes.ok) {
        const payload =
          (!stockRes.ok ? await stockRes.json().catch(() => null) : null) ??
          (!vaccineRes.ok ? await vaccineRes.json().catch(() => null) : null) ??
          (!healthRes.ok ? await healthRes.json().catch(() => null) : null);
        throw new Error(payload?.message ?? "status non valide");
      }

      const stockPayload = await stockRes.json();
      const stockItems = Array.isArray(stockPayload?.district)
        ? stockPayload.district
        : [];
      setStocks(stockItems);

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

  useEffect(() => {
    fetchDistrictStocks();
    fetchDistrictStats();
    fetchPendingTransfers();
  }, [fetchDistrictStocks, fetchDistrictStats, fetchPendingTransfers]);

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

  const refreshDistrictLots = useCallback(() => {
    if (lotContext) {
      void fetchDistrictLots(lotContext.vaccineId, lotContext.ownerId ?? null);
    }
  }, [fetchDistrictLots, lotContext]);

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

  return (
    <DashboardShell active="/dashboard/stocks">
      <div className="space-y-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Stocks & lots</h2>
            <p className="text-sm text-slate-500">
              Suivi des stocks districtaux et distribution vers les centres de santé.
            </p>
          </div>
          <div className="flex gap-3">
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
            <button
              type="button"
              onClick={fetchDistrictStocks}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:text-blue-600"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Actualiser
            </button>
          </div>
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

        {/* Section Envois en attente */}
        {pendingTransfers.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-blue-200 bg-blue-50/50 shadow-sm">
            <div className="bg-blue-100 px-6 py-4">
              <h3 className="text-lg font-semibold text-blue-900">
                Envois en attente de confirmation
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Vaccin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Quantité
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Date d'envoi
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100 bg-white">
                  {pendingTransfers.map((transfer) => {
                    const sentDate = new Date(transfer.createdAt);
                    return (
                      <tr key={transfer.id} className="hover:bg-blue-50/50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">
                            {transfer.vaccine?.name ?? "Vaccin inconnu"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-600">
                            {transfer.quantity.toLocaleString("fr-FR")} doses
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-600">
                            {sentDate.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleConfirmTransfer(transfer.id)}
                              disabled={confirmingTransferId === transfer.id}
                              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {confirmingTransferId === transfer.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Confirmation...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  Confirmer la réception
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
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
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
                  Expiration
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
                  const expired =
                    stock.hasExpiredLot ||
                    (stock.nearestExpiration
                      ? isDateExpired(stock.nearestExpiration)
                      : false);
                  return (
                    <tr
                      key={stock.id}
                      className={
                        expired
                          ? "bg-red-50/70 text-red-700 hover:bg-red-50"
                          : "hover:bg-slate-50/80"
                      }
                    >
                    <td className="px-6 py-4">
                      <div
                        className={`font-semibold ${
                          expired ? "text-red-700" : "text-slate-900"
                        }`}
                      >
                        {stock.vaccine.name}
                      </div>
                      <div
                        className={`text-xs ${
                          expired ? "text-red-600" : "text-slate-500"
                        }`}
                      >
                        {stock.vaccine.description}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className={`font-semibold ${
                          expired ? "text-red-700" : "text-slate-800"
                        }`}
                      >
                        {(stock.quantity ?? 0).toLocaleString("fr-FR")}
                      </div>
                      <div
                        className={`text-xs ${
                          expired ? "text-red-600" : "text-slate-500"
                        }`}
                      >
                        {stock.vaccine.dosesRequired} doses requises
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {stock.nearestExpiration ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${
                              expired ? "text-red-700" : "text-slate-700"
                            }`}
                          >
                            {formatExpirationDate(stock.nearestExpiration)}
                          </span>
                          {isDateExpired(stock.nearestExpiration) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                              <AlertTriangle className="h-3 w-3" />
                              Expiré
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">Non définie</span>
                      )}
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
                        <button
                          type="button"
                          onClick={() => openTransferModal(stock)}
                          className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                          Envoyer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDistrictStock(stock)}
                          disabled={districtDeletingId === stock.id}
                          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          {districtDeletingId === stock.id ? "Suppression…" : "Supprimer"}
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
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
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
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
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
                  {healthCenters.map((center) => (
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
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lotItems.map((lot) => {
                      const expired =
                        lot.status === "EXPIRED" || isDateExpired(lot.expiration);
                      return (
                        <tr key={lot.id} className="hover:bg-slate-50/80">
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
                  onClick={refreshDistrictLots}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Rafraîchir
                </button>
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
    </DashboardShell>
  );
}

function AgentAdminStocksPage() {
  const { accessToken, user } = useAuth();
  const isAgentAdmin = user?.role === "AGENT" && user?.agentLevel === "ADMIN";

  const [stocks, setStocks] = useState<HealthCenterStock[]>([]);
  const [vaccines, setVaccines] = useState<VaccineInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const [reservations, setReservations] = useState<any[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [reservationsModalOpen, setReservationsModalOpen] = useState(false);
  const [reservationSearch, setReservationSearch] = useState("");
  const [reservationVaccineFilter, setReservationVaccineFilter] = useState<string>("Tous");
  const [reservationStatusFilter, setReservationStatusFilter] = useState<string>("Tous");

  // États pour les envois en attente
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [pendingTransfersLoading, setPendingTransfersLoading] = useState(false);
  const [confirmingTransferId, setConfirmingTransferId] = useState<string | null>(null);

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
      setStocks(stockItems);

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

  useEffect(() => {
    fetchHealthCenterStocks();
    fetchHealthCenterStats();
    fetchPendingTransfers();
  }, [fetchHealthCenterStocks, fetchHealthCenterStats, fetchPendingTransfers]);

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

    try {
      setCreating(true);
      const response = await fetch(`${API_URL}/api/stock/health-center`, {
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

  const refreshHealthCenterLots = useCallback(() => {
    if (lotContext) {
      void fetchHealthCenterLots(lotContext.vaccineId, lotContext.ownerId ?? null);
    }
  }, [fetchHealthCenterLots, lotContext]);

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

  return (
    <DashboardShell active="/dashboard/stocks">
      <div className="space-y-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Stocks & lots</h2>
            <p className="text-sm text-slate-500">
              Suivi des stocks de votre centre de santé.
            </p>
          </div>
          <div className="flex gap-3">
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
            {isAgentAdmin && (
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
            <button
              type="button"
              onClick={() => {
                fetchHealthCenterStocks();
                fetchHealthCenterStats();
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:text-blue-600"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Actualiser
            </button>
          </div>
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

        {/* Section Envois en attente */}
        {pendingTransfers.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-blue-200 bg-blue-50/50 shadow-sm">
            <div className="bg-blue-100 px-6 py-4">
              <h3 className="text-lg font-semibold text-blue-900">
                Envois en attente de confirmation
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Vaccin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Quantité
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Date d'envoi
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-blue-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100 bg-white">
                  {pendingTransfers.map((transfer) => {
                    const sentDate = new Date(transfer.createdAt);
                    return (
                      <tr key={transfer.id} className="hover:bg-blue-50/50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">
                            {transfer.vaccine?.name ?? "Vaccin inconnu"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-600">
                            {transfer.quantity.toLocaleString("fr-FR")} doses
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-600">
                            {sentDate.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleConfirmTransfer(transfer.id)}
                              disabled={confirmingTransferId === transfer.id}
                              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {confirmingTransferId === transfer.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Confirmation...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  Confirmer la réception
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
          </div>
        )}

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
                  Expiration
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
                  const expired =
                    stock.hasExpiredLot ||
                    (stock.nearestExpiration
                      ? isDateExpired(stock.nearestExpiration)
                      : false);
                  return (
                    <tr
                      key={stock.id}
                      className={
                        expired
                          ? "bg-red-50/70 text-red-700 hover:bg-red-50"
                          : "hover:bg-slate-50/80"
                      }
                    >
                      <td className="px-6 py-4">
                        <div
                          className={`font-semibold ${
                            expired ? "text-red-700" : "text-slate-900"
                          }`}
                        >
                          {stock.vaccine.name}
                        </div>
                        <div
                          className={`text-xs ${
                            expired ? "text-red-600" : "text-slate-500"
                          }`}
                        >
                          {stock.vaccine.description}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className={`font-semibold ${
                            expired ? "text-red-700" : "text-slate-800"
                          }`}
                        >
                          {(stock.quantity ?? 0).toLocaleString("fr-FR")}
                        </div>
                        <div
                          className={`text-xs ${
                            expired ? "text-red-600" : "text-slate-500"
                          }`}
                        >
                          {stock.vaccine.dosesRequired} doses requises
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {stock.nearestExpiration ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-medium ${
                                expired ? "text-red-700" : "text-slate-700"
                              }`}
                            >
                              {formatExpirationDate(stock.nearestExpiration)}
                            </span>
                            {expired && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                                <AlertTriangle className="h-3 w-3" />
                                Expiré
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Non définie</span>
                        )}
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
                          {isAgentAdmin && (
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
      </div>

      {isAgentAdmin && createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
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
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lotItems.map((lot) => {
                      const expired =
                        lot.status === "EXPIRED" || isDateExpired(lot.expiration);
                      return (
                        <tr key={lot.id} className="hover:bg-slate-50/80">
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
                  onClick={refreshHealthCenterLots}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Rafraîchir
                </button>
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
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl flex flex-col">
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
