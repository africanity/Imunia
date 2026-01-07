export const LOW_STOCK_THRESHOLD = 50;

export type StockStats = {
  totalLots: number;
  totalQuantity: number;
  lowStockCount: number;
  threshold: number;
  expiredLots: number;
};

export const emptyStats: StockStats = {
  totalLots: 0,
  totalQuantity: 0,
  lowStockCount: 0,
  threshold: LOW_STOCK_THRESHOLD,
  expiredLots: 0,
};

export type VaccineInfo = {
  id: string;
  name: string;
  description: string;
  dosesRequired: string;
};

export type VaccineResponse =
  | {
      vaccines?: VaccineInfo[];
    }
  | VaccineInfo[];

export type NationalStock = {
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

export type NationalStockResponse = {
  national?: NationalStock[];
};

export type LotItem = {
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

export type LotResponse = {
  lots: LotItem[];
  totalRemaining: number;
};

export type LotModalContext = {
  vaccineId: string;
  vaccineName: string;
  ownerLabel?: string | null;
  ownerId?: string | null;
};

export type PendingTransfer = {
  id: string;
  vaccineId: string;
  vaccine: VaccineInfo;
  fromType: string;
  fromId: string | null;
  fromName?: string | null;
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

export type TransferHistoryItem = {
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

export type Region = {
  id: string;
  name: string;
};

export type RegionsResponse =
  | {
      regions?: Region[];
    }
  | Region[];

export type RegionalStock = {
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

export type DistrictStock = {
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

export type DistrictOption = {
  id: string;
  name: string;
  communeId?: string | null;
  regionId?: string | null;
};

export type HealthCenterOption = {
  id: string;
  name: string;
  districtId?: string | null;
};

export type HealthCenterStock = {
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
