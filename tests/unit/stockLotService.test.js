// tests/unit/stockLotService.test.js

const prisma = require("../../src/config/prismaClient");
const {
  OWNER_TYPES,
  LOT_STATUS,
  normalizeOwnerId,
  determineStatusFromExpiration,
  ensurePositiveInteger,
  createLot,
  consumeLots,
  recordTransfer,
  refreshExpiredLots,
  deleteLotDirect,
  deleteLotCascade,
  modifyStockQuantity,
  reserveDoseForHealthCenter,
  releaseDoseForHealthCenter,
  restoreOrRecreateLotForRejectedTransfer,
} = require("../../src/services/stockLotService");

jest.mock("../../src/config/prismaClient", () => ({
  stockLot: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  stockTransfer: {
    create: jest.fn(),
  },
  stockTransferLot: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  stockReservation: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  pendingStockTransferLot: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  pendingStockTransfer: {
    delete: jest.fn(),
  },
  stockNATIONAL: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  stockREGIONAL: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  stockDISTRICT: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  stockHEALTHCENTER: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

describe("stockLotService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("normalizeOwnerId", () => {
    it("devrait retourner null pour NATIONAL", () => {
      expect(normalizeOwnerId(OWNER_TYPES.NATIONAL, "any-id")).toBeNull();
    });

    it("devrait retourner l'ownerId pour les autres types", () => {
      expect(normalizeOwnerId(OWNER_TYPES.REGIONAL, "region-1")).toBe("region-1");
      expect(normalizeOwnerId(OWNER_TYPES.DISTRICT, "district-1")).toBe("district-1");
      expect(normalizeOwnerId(OWNER_TYPES.HEALTHCENTER, "hc-1")).toBe("hc-1");
    });

    it("devrait retourner null si ownerId est null", () => {
      expect(normalizeOwnerId(OWNER_TYPES.REGIONAL, null)).toBeNull();
    });
  });

  describe("determineStatusFromExpiration", () => {
    it("devrait retourner EXPIRED si la date est passée", () => {
      const pastDate = new Date(Date.now() - 1000);
      expect(determineStatusFromExpiration(pastDate)).toBe(LOT_STATUS.EXPIRED);
    });

    it("devrait retourner VALID si la date est future", () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24);
      expect(determineStatusFromExpiration(futureDate)).toBe(LOT_STATUS.VALID);
    });

    it("devrait retourner EXPIRED si la date est maintenant", () => {
      const now = new Date();
      expect(determineStatusFromExpiration(now)).toBe(LOT_STATUS.EXPIRED);
    });
  });

  describe("ensurePositiveInteger", () => {
    it("devrait retourner un entier positif valide", () => {
      expect(ensurePositiveInteger(5)).toBe(5);
      expect(ensurePositiveInteger("10")).toBe(10);
    });

    it("devrait lancer une erreur pour une valeur négative", () => {
      expect(() => ensurePositiveInteger(-1)).toThrow();
      expect(() => ensurePositiveInteger(-1)).toThrow("doit être un entier positif");
    });

    it("devrait lancer une erreur pour zéro", () => {
      expect(() => ensurePositiveInteger(0)).toThrow();
    });

    it("devrait lancer une erreur pour une valeur non numérique", () => {
      expect(() => ensurePositiveInteger("abc")).toThrow();
      expect(() => ensurePositiveInteger(NaN)).toThrow();
      expect(() => ensurePositiveInteger(Infinity)).toThrow();
    });

    it("devrait utiliser le nom de champ dans le message d'erreur", () => {
      try {
        ensurePositiveInteger(-1, "quantité");
      } catch (error) {
        expect(error.message).toContain("quantité");
      }
    });
  });

  describe("createLot", () => {
    const mockLot = {
      id: "lot-1",
      vaccineId: "vaccine-1",
      ownerType: OWNER_TYPES.REGIONAL,
      ownerId: "region-1",
      quantity: 100,
      remainingQuantity: 100,
      expiration: new Date("2025-12-31"),
      status: LOT_STATUS.VALID,
    };

    it("devrait créer un lot avec succès", async () => {
      prisma.stockLot.create.mockResolvedValue(mockLot);

      const result = await createLot(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        quantity: 100,
        expiration: new Date("2025-12-31"),
      });

      expect(prisma.stockLot.create).toHaveBeenCalled();
      expect(result).toEqual(mockLot);
    });

    it("devrait lancer une erreur pour une date d'expiration invalide", async () => {
      await expect(
        createLot(null, {
          vaccineId: "vaccine-1",
          ownerType: OWNER_TYPES.REGIONAL,
          ownerId: "region-1",
          quantity: 100,
          expiration: "invalid-date",
        })
      ).rejects.toThrow("Date d'expiration invalide");
    });

    it("devrait lancer une erreur pour une quantité négative", async () => {
      await expect(
        createLot(null, {
          vaccineId: "vaccine-1",
          ownerType: OWNER_TYPES.REGIONAL,
          ownerId: "region-1",
          quantity: -10,
          expiration: new Date("2025-12-31"),
        })
      ).rejects.toThrow("La quantité du lot doit être positive");
    });

    it("devrait permettre quantity: 0 pour les lots PENDING", async () => {
      const pendingLot = { ...mockLot, quantity: 0, status: LOT_STATUS.PENDING };
      prisma.stockLot.create.mockResolvedValue(pendingLot);

      await createLot(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        quantity: 0,
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.PENDING,
      });

      expect(prisma.stockLot.create).toHaveBeenCalled();
    });

    it("devrait forcer EXPIRED si la date est passée même si status est VALID", async () => {
      const expiredLot = { ...mockLot, status: LOT_STATUS.EXPIRED };
      prisma.stockLot.create.mockResolvedValue(expiredLot);

      await createLot(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        quantity: 100,
        expiration: new Date(Date.now() - 1000),
        status: LOT_STATUS.VALID,
      });

      const createCall = prisma.stockLot.create.mock.calls[0][0];
      expect(createCall.data.status).toBe(LOT_STATUS.EXPIRED);
    });

    it("devrait normaliser ownerId pour NATIONAL", async () => {
      prisma.stockLot.create.mockResolvedValue(mockLot);

      await createLot(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.NATIONAL,
        ownerId: "any-id",
        quantity: 100,
        expiration: new Date("2025-12-31"),
      });

      const createCall = prisma.stockLot.create.mock.calls[0][0];
      expect(createCall.data.ownerId).toBeNull();
    });
  });

  describe("consumeLots", () => {
    const mockLots = [
      {
        id: "lot-1",
        remainingQuantity: 50,
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      },
      {
        id: "lot-2",
        remainingQuantity: 30,
        expiration: new Date("2026-01-31"),
        status: LOT_STATUS.VALID,
      },
    ];

    it("devrait consommer des lots avec succès", async () => {
      prisma.stockLot.findMany.mockResolvedValue(mockLots);
      prisma.stockLot.update.mockResolvedValue({});

      const result = await consumeLots(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        quantity: 60,
      });

      expect(prisma.stockLot.findMany).toHaveBeenCalled();
      expect(prisma.stockLot.update).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0].quantity).toBe(50);
      expect(result[1].quantity).toBe(10);
    });

    it("devrait lancer une erreur si la quantité est insuffisante", async () => {
      prisma.stockLot.findMany.mockResolvedValue(mockLots);

      await expect(
        consumeLots(null, {
          vaccineId: "vaccine-1",
          ownerType: OWNER_TYPES.REGIONAL,
          ownerId: "region-1",
          quantity: 100,
        })
      ).rejects.toThrow("Quantité insuffisante");
    });

    it("devrait lancer une erreur pour une quantité invalide", async () => {
      await expect(
        consumeLots(null, {
          vaccineId: "vaccine-1",
          ownerType: OWNER_TYPES.REGIONAL,
          ownerId: "region-1",
          quantity: -10,
        })
      ).rejects.toThrow("La quantité demandée doit être positive");
    });

    it("devrait trier les lots par date d'expiration", async () => {
      prisma.stockLot.findMany.mockResolvedValue(mockLots);

      await consumeLots(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        quantity: 10,
      });

      expect(prisma.stockLot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { expiration: "asc" },
        })
      );
    });
  });

  describe("recordTransfer", () => {
    it("devrait enregistrer un transfert avec succès", async () => {
      const mockTransfer = {
        id: "transfer-1",
        vaccineId: "vaccine-1",
        fromType: OWNER_TYPES.NATIONAL,
        fromId: null,
        toType: OWNER_TYPES.REGIONAL,
        toId: "region-1",
        quantity: 100,
        lots: [
          { lotId: "lot-1", quantity: 50 },
          { lotId: "lot-2", quantity: 50 },
        ],
      };

      prisma.stockTransfer.create.mockResolvedValue(mockTransfer);

      const allocations = [
        { lotId: "lot-1", quantity: 50 },
        { lotId: "lot-2", quantity: 50 },
      ];

      const result = await recordTransfer(null, {
        vaccineId: "vaccine-1",
        fromType: OWNER_TYPES.NATIONAL,
        fromId: null,
        toType: OWNER_TYPES.REGIONAL,
        toId: "region-1",
        quantity: 100,
        allocations,
      });

      expect(prisma.stockTransfer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          vaccineId: "vaccine-1",
          fromType: OWNER_TYPES.NATIONAL,
          fromId: null,
          toType: OWNER_TYPES.REGIONAL,
          toId: "region-1",
          quantity: 100,
          lots: {
            create: [
              { lotId: "lot-1", quantity: 50 },
              { lotId: "lot-2", quantity: 50 },
            ],
          },
        }),
        include: { lots: true },
      });
      expect(result).toEqual(mockTransfer);
    });

    it("devrait retourner null si aucun allocation", async () => {
      const result = await recordTransfer(null, {
        vaccineId: "vaccine-1",
        fromType: OWNER_TYPES.NATIONAL,
        fromId: null,
        toType: OWNER_TYPES.REGIONAL,
        toId: "region-1",
        quantity: 100,
        allocations: [],
      });

      expect(result).toBeNull();
      expect(prisma.stockTransfer.create).not.toHaveBeenCalled();
    });
  });

  describe("refreshExpiredLots", () => {
    it("devrait mettre à jour les lots expirés", async () => {
      const expiredLots = [
        {
          id: "lot-1",
          expiration: new Date(Date.now() - 1000),
          ownerType: OWNER_TYPES.REGIONAL,
          ownerId: "region-1",
          vaccineId: "vaccine-1",
        },
        {
          id: "lot-2",
          expiration: new Date(Date.now() - 2000),
          ownerType: OWNER_TYPES.REGIONAL,
          ownerId: "region-1",
          vaccineId: "vaccine-1",
        },
      ];

      prisma.stockLot.findMany.mockResolvedValue(expiredLots);
      prisma.stockLot.updateMany.mockResolvedValue({ count: 2 });

      const result = await refreshExpiredLots(null);

      expect(prisma.stockLot.findMany).toHaveBeenCalled();
      expect(prisma.stockLot.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["lot-1", "lot-2"] } },
        data: { status: LOT_STATUS.EXPIRED },
      });
      expect(result).toEqual(expiredLots);
    });

    it("devrait retourner un tableau vide si aucun lot expiré", async () => {
      prisma.stockLot.findMany.mockResolvedValue([]);

      const result = await refreshExpiredLots(null);

      expect(result).toEqual([]);
      expect(prisma.stockLot.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("deleteLotDirect", () => {
    it("devrait supprimer un lot directement", async () => {
      const mockLot = {
        id: "lot-1",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        remainingQuantity: 50,
      };

      prisma.stockLot.findUnique.mockResolvedValue(mockLot);
      prisma.stockTransferLot.deleteMany.mockResolvedValue({});
      prisma.stockReservation.deleteMany.mockResolvedValue({});
      prisma.stockREGIONAL.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 100,
      });
      prisma.stockREGIONAL.update.mockResolvedValue({});
      prisma.stockLot.delete.mockResolvedValue(mockLot);

      const result = await deleteLotDirect(null, "lot-1");

      expect(prisma.stockLot.findUnique).toHaveBeenCalledWith({
        where: { id: "lot-1" },
      });
      expect(prisma.stockLot.delete).toHaveBeenCalledWith({
        where: { id: "lot-1" },
      });
      expect(result).toBe("lot-1");
    });

    it("devrait retourner null si le lot n'existe pas", async () => {
      prisma.stockLot.findUnique.mockResolvedValue(null);

      const result = await deleteLotDirect(null, "lot-1");

      expect(result).toBeNull();
      expect(prisma.stockLot.delete).not.toHaveBeenCalled();
    });
  });

  describe("deleteLotCascade", () => {
    it("devrait supprimer un lot avec toutes ses relations", async () => {
      const mockLot = {
        id: "lot-1",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        remainingQuantity: 50,
        derivedLots: [],
      };

      prisma.stockLot.findUnique.mockResolvedValue(mockLot);
      prisma.pendingStockTransferLot.findMany.mockResolvedValue([]);
      prisma.stockReservation.deleteMany.mockResolvedValue({});
      prisma.stockTransferLot.deleteMany.mockResolvedValue({});
      prisma.stockREGIONAL.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        regionId: "region-1",
        quantity: 100,
      });
      prisma.stockREGIONAL.update.mockResolvedValue({});
      prisma.stockLot.delete.mockResolvedValue(mockLot);

      const result = await deleteLotCascade(null, "lot-1");

      expect(prisma.stockLot.findUnique).toHaveBeenCalled();
      expect(prisma.stockReservation.deleteMany).toHaveBeenCalled();
      expect(prisma.stockLot.delete).toHaveBeenCalled();
      expect(result).toEqual(["lot-1"]);
    });

    it("devrait retourner un tableau vide si le lot n'existe pas", async () => {
      prisma.stockLot.findUnique.mockResolvedValue(null);

      const result = await deleteLotCascade(null, "lot-inexistant");

      expect(result).toEqual([]);
    });

    it("devrait gérer les lots dérivés", async () => {
      const mockLot = {
        id: "lot-1",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        remainingQuantity: 50,
        derivedLots: [{ id: "lot-2" }],
      };

      const mockChildLot = {
        id: "lot-2",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        remainingQuantity: 30,
        derivedLots: [],
      };

      prisma.stockLot.findUnique
        .mockResolvedValueOnce(mockLot)
        .mockResolvedValueOnce(mockChildLot);
      prisma.pendingStockTransferLot.findMany.mockResolvedValue([]);
      prisma.stockReservation.deleteMany.mockResolvedValue({});
      prisma.stockTransferLot.deleteMany.mockResolvedValue({});
      prisma.stockREGIONAL.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        regionId: "region-1",
        quantity: 100,
      });
      prisma.stockREGIONAL.update.mockResolvedValue({});
      prisma.stockLot.delete.mockResolvedValue({});

      const result = await deleteLotCascade(null, "lot-1");

      expect(result).toEqual(["lot-2", "lot-1"]); // Triés par depth décroissant
    });

    it("devrait gérer les pending transfers", async () => {
      const mockLot = {
        id: "lot-1",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        remainingQuantity: 50,
        derivedLots: [],
      };

      prisma.stockLot.findUnique.mockResolvedValue(mockLot);
      prisma.pendingStockTransferLot.findMany.mockResolvedValue([
        { pendingTransferId: "transfer-1" },
      ]);
      prisma.pendingStockTransferLot.deleteMany.mockResolvedValue({});
      prisma.pendingStockTransferLot.count.mockResolvedValue(0);
      prisma.pendingStockTransfer.delete.mockResolvedValue({});
      prisma.stockReservation.deleteMany.mockResolvedValue({});
      prisma.stockTransferLot.deleteMany.mockResolvedValue({});
      prisma.stockREGIONAL.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        regionId: "region-1",
        quantity: 100,
      });
      prisma.stockREGIONAL.update.mockResolvedValue({});
      prisma.stockLot.delete.mockResolvedValue(mockLot);

      const result = await deleteLotCascade(null, "lot-1");

      expect(prisma.pendingStockTransferLot.count).toHaveBeenCalled();
      expect(prisma.pendingStockTransfer.delete).toHaveBeenCalled();
      expect(result).toEqual(["lot-1"]);
    });

    it("devrait gérer les lots sans remainingQuantity", async () => {
      const mockLot = {
        id: "lot-1",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        remainingQuantity: 0,
        derivedLots: [],
      };

      prisma.stockLot.findUnique.mockResolvedValue(mockLot);
      prisma.pendingStockTransferLot.findMany.mockResolvedValue([]);
      prisma.stockReservation.deleteMany.mockResolvedValue({});
      prisma.stockTransferLot.deleteMany.mockResolvedValue({});
      prisma.stockLot.delete.mockResolvedValue(mockLot);

      const result = await deleteLotCascade(null, "lot-1");

      // modifyStockQuantity ne devrait pas être appelé si remainingQuantity est 0
      expect(prisma.stockREGIONAL.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(["lot-1"]);
    });
  });

  describe("modifyStockQuantity", () => {
    it("devrait augmenter la quantité du stock", async () => {
      prisma.stockREGIONAL.findUnique.mockResolvedValue({
        id: "stock-1",
        vaccineId: "vaccine-1",
        regionId: "region-1",
        quantity: 100,
      });
      prisma.stockREGIONAL.update.mockResolvedValue({
        id: "stock-1",
        quantity: 150,
      });

      const result = await modifyStockQuantity(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        delta: 50,
      });

      expect(prisma.stockREGIONAL.findUnique).toHaveBeenCalledWith({
        where: {
          vaccineId_regionId: {
            vaccineId: "vaccine-1",
            regionId: "region-1",
          },
        },
      });
      expect(prisma.stockREGIONAL.update).toHaveBeenCalledWith({
        where: {
          vaccineId_regionId: {
            vaccineId: "vaccine-1",
            regionId: "region-1",
          },
        },
        data: { quantity: 150 },
      });
      expect(result).toBe(150);
    });

    it("devrait retourner null si le stock n'existe pas", async () => {
      prisma.stockREGIONAL.findUnique.mockResolvedValue(null);

      const result = await modifyStockQuantity(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        delta: 50,
      });

      expect(result).toBeNull();
      expect(prisma.stockREGIONAL.create).not.toHaveBeenCalled();
    });

    it("devrait retourner null si delta est 0", async () => {
      const result = await modifyStockQuantity(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        delta: 0,
      });

      expect(result).toBeNull();
    });

    it("devrait gérer NATIONAL", async () => {
      prisma.stockNATIONAL.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 100,
      });
      prisma.stockNATIONAL.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 150,
      });

      const result = await modifyStockQuantity(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.NATIONAL,
        ownerId: null,
        delta: 50,
      });

      expect(result).toBe(150);
    });

    it("devrait gérer DISTRICT", async () => {
      prisma.stockDISTRICT.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        districtId: "district-1",
        quantity: 100,
      });
      prisma.stockDISTRICT.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 150,
      });

      const result = await modifyStockQuantity(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.DISTRICT,
        ownerId: "district-1",
        delta: 50,
      });

      expect(result).toBe(150);
    });

    it("devrait gérer HEALTHCENTER", async () => {
      prisma.stockHEALTHCENTER.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        quantity: 100,
      });
      prisma.stockHEALTHCENTER.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 150,
      });

      const result = await modifyStockQuantity(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: "hc-1",
        delta: 50,
      });

      expect(result).toBe(150);
    });

    it("devrait retourner null pour un type inconnu", async () => {
      const result = await modifyStockQuantity(null, {
        vaccineId: "vaccine-1",
        ownerType: "UNKNOWN",
        ownerId: "id-1",
        delta: 50,
      });

      expect(result).toBeNull();
    });

    it("devrait retourner null si regionId est null pour REGIONAL", async () => {
      const result = await modifyStockQuantity(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: null,
        delta: 50,
      });

      expect(result).toBeNull();
    });

    it("devrait gérer quantity null dans stock", async () => {
      prisma.stockREGIONAL.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        regionId: "region-1",
        quantity: null,
      });
      prisma.stockREGIONAL.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 50,
      });

      const result = await modifyStockQuantity(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        delta: 50,
      });

      expect(result).toBe(50);
    });

    it("devrait empêcher quantity négative (Math.max)", async () => {
      prisma.stockREGIONAL.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        regionId: "region-1",
        quantity: 10,
      });
      prisma.stockREGIONAL.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 0,
      });

      const result = await modifyStockQuantity(null, {
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        delta: -20, // Réduire de 20 alors qu'il n'y a que 10
      });

      expect(prisma.stockREGIONAL.update).toHaveBeenCalledWith({
        where: {
          vaccineId_regionId: {
            vaccineId: "vaccine-1",
            regionId: "region-1",
          },
        },
        data: { quantity: 0 }, // Math.max(0, 10 - 20) = 0
      });
      expect(result).toBe(0);
    });
  });

  describe("reserveDoseForHealthCenter", () => {
    it("devrait réserver une dose avec succès", async () => {
      const mockLot = {
        id: "lot-1",
        remainingQuantity: 100,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: "hc-1",
      };

      prisma.stockHEALTHCENTER.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        quantity: 100,
      });
      prisma.stockLot.findFirst.mockResolvedValue(mockLot);
      prisma.stockLot.update.mockResolvedValue({
        ...mockLot,
        remainingQuantity: 99,
      });
      prisma.stockHEALTHCENTER.update.mockResolvedValue({});

      const result = await reserveDoseForHealthCenter(null, {
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        quantity: 1,
      });

      expect(prisma.stockHEALTHCENTER.findUnique).toHaveBeenCalled();
      expect(prisma.stockLot.findFirst).toHaveBeenCalled();
      expect(prisma.stockHEALTHCENTER.update).toHaveBeenCalled();
      expect(prisma.stockLot.update).toHaveBeenCalled();
      expect(result).toEqual({
        lotId: "lot-1",
        quantity: 1,
      });
    });

    it("devrait lancer une erreur si le stock est insuffisant", async () => {
      prisma.stockHEALTHCENTER.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        quantity: 0,
      });

      await expect(
        reserveDoseForHealthCenter(null, {
          vaccineId: "vaccine-1",
          healthCenterId: "hc-1",
          quantity: 1,
        })
      ).rejects.toThrow("Stock insuffisant pour ce vaccin");
    });

    it("devrait lancer une erreur si aucun lot disponible", async () => {
      prisma.stockHEALTHCENTER.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        quantity: 100,
      });
      prisma.stockLot.findFirst.mockResolvedValue(null);

      await expect(
        reserveDoseForHealthCenter(null, {
          vaccineId: "vaccine-1",
          healthCenterId: "hc-1",
          quantity: 1,
        })
      ).rejects.toThrow();
    });

    it("devrait lancer une erreur si le stock sera expiré avant le rendez-vous", async () => {
      const appointmentDate = new Date("2025-12-31");
      const expiredDate = new Date("2025-12-30"); // Expire avant le rendez-vous

      prisma.stockHEALTHCENTER.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        quantity: 100,
      });
      prisma.stockLot.findFirst
        .mockResolvedValueOnce(null) // Premier appel : pas de lot valide
        .mockResolvedValueOnce({
          // Deuxième appel : lot valide mais qui expire avant le rendez-vous
          id: "lot-1",
          expiration: expiredDate,
          status: LOT_STATUS.VALID,
          remainingQuantity: 50,
        });

      await expect(
        reserveDoseForHealthCenter(null, {
          vaccineId: "vaccine-1",
          healthCenterId: "hc-1",
          quantity: 1,
          appointmentDate: appointmentDate,
        })
      ).rejects.toThrow("Le stock restant sera expiré avant le rendez-vous programmé");
    });

    it("devrait lancer une erreur si tous les lots sont expirés", async () => {
      prisma.stockHEALTHCENTER.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        quantity: 100,
      });
      // Premier appel : cherche un lot valide (ligne 573)
      // Deuxième appel : cherche un lot expiré (ligne 618) - seulement si !lot || lot.remainingQuantity < qty
      prisma.stockLot.findFirst
        .mockResolvedValueOnce(null) // Premier appel : pas de lot valide
        .mockResolvedValueOnce({
          // Deuxième appel : cherche un lot expiré (dans le bloc if (!lot || lot.remainingQuantity < qty))
          id: "lot-1",
          expiration: new Date("2024-01-01"),
          status: LOT_STATUS.EXPIRED,
          remainingQuantity: 50,
        });

      await expect(
        reserveDoseForHealthCenter(null, {
          vaccineId: "vaccine-1",
          healthCenterId: "hc-1",
          quantity: 1,
        })
      ).rejects.toThrow("Tous les lots disponibles pour ce vaccin sont expirés");
    });
  });

  describe("releaseDoseForHealthCenter", () => {
    it("devrait libérer une dose avec succès", async () => {
      prisma.stockLot.update.mockResolvedValue({
        id: "lot-1",
        remainingQuantity: 101,
      });
      prisma.stockHEALTHCENTER.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        quantity: 99,
      });
      prisma.stockHEALTHCENTER.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        quantity: 100,
      });

      const result = await releaseDoseForHealthCenter(null, {
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        lotId: "lot-1",
        quantity: 1,
      });

      expect(prisma.stockLot.update).toHaveBeenCalledWith({
        where: { id: "lot-1" },
        data: { remainingQuantity: { increment: 1 } },
      });
      expect(prisma.stockHEALTHCENTER.update).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("devrait créer le stock s'il n'existe pas", async () => {
      prisma.stockLot.update.mockResolvedValue({
        id: "lot-1",
        remainingQuantity: 101,
      });
      prisma.stockHEALTHCENTER.findUnique.mockResolvedValue(null);
      prisma.stockHEALTHCENTER.create.mockResolvedValue({
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        quantity: 1,
      });

      const result = await releaseDoseForHealthCenter(null, {
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        lotId: "lot-1",
        quantity: 1,
      });

      expect(prisma.stockHEALTHCENTER.create).toHaveBeenCalledWith({
        data: {
          vaccineId: "vaccine-1",
          healthCenterId: "hc-1",
          quantity: 1,
        },
      });
      expect(result).toBe(true);
    });

    it("devrait retourner null si healthCenterId ou lotId manquants", async () => {
      const result1 = await releaseDoseForHealthCenter(null, {
        vaccineId: "vaccine-1",
        healthCenterId: null,
        lotId: "lot-1",
        quantity: 1,
      });

      const result2 = await releaseDoseForHealthCenter(null, {
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        lotId: null,
        quantity: 1,
      });

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe("restoreOrRecreateLotForRejectedTransfer", () => {
    it("devrait restaurer un lot existant", async () => {
      const mockLot = {
        id: "lot-1",
        remainingQuantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
      };

      prisma.stockLot.findUnique.mockResolvedValue(mockLot);
      prisma.stockLot.update.mockResolvedValue({
        ...mockLot,
        remainingQuantity: 100,
      });
      prisma.stockREGIONAL.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 200,
      });
      prisma.stockREGIONAL.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 250,
      });

      const result = await restoreOrRecreateLotForRejectedTransfer(null, {
        lotId: "lot-1",
        quantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      });

      expect(result.restored).toBe(true);
      expect(prisma.stockLot.update).toHaveBeenCalled();
    });

    it("devrait recréer un lot si le lot original n'existe pas", async () => {
      const newLot = {
        id: "lot-2",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        quantity: 50,
        remainingQuantity: 50,
      };

      prisma.stockLot.findUnique.mockResolvedValue(null);
      prisma.stockLot.create.mockResolvedValue(newLot);
      prisma.stockREGIONAL.findUnique.mockResolvedValue(null);
      prisma.stockREGIONAL.create.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 50,
      });

      const result = await restoreOrRecreateLotForRejectedTransfer(null, {
        lotId: "lot-1",
        quantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      });

      expect(result.restored).toBe(false);
      expect(result.created).toBe(true);
      expect(prisma.stockLot.create).toHaveBeenCalled();
    });

    it("devrait créer le stock NATIONAL s'il n'existe pas lors de la restauration", async () => {
      const mockLot = {
        id: "lot-1",
        remainingQuantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.NATIONAL,
        ownerId: null,
      };

      prisma.stockLot.findUnique.mockResolvedValue(mockLot);
      prisma.stockLot.update.mockResolvedValue({
        ...mockLot,
        remainingQuantity: 100,
      });
      prisma.stockNATIONAL.findUnique.mockResolvedValue(null);
      prisma.stockNATIONAL.create.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 50,
      });

      const result = await restoreOrRecreateLotForRejectedTransfer(null, {
        lotId: "lot-1",
        quantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.NATIONAL,
        ownerId: null,
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      });

      expect(result.restored).toBe(true);
      expect(prisma.stockNATIONAL.create).toHaveBeenCalled();
    });

    it("devrait créer le stock DISTRICT s'il n'existe pas lors de la recréation", async () => {
      const newLot = {
        id: "lot-2",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.DISTRICT,
        ownerId: "district-1",
        quantity: 50,
        remainingQuantity: 50,
      };

      prisma.stockLot.findUnique.mockResolvedValue(null);
      prisma.stockLot.create.mockResolvedValue(newLot);
      prisma.stockDISTRICT.findUnique.mockResolvedValue(null);
      prisma.stockDISTRICT.create.mockResolvedValue({
        vaccineId: "vaccine-1",
        districtId: "district-1",
        quantity: 50,
      });

      const result = await restoreOrRecreateLotForRejectedTransfer(null, {
        lotId: "lot-1",
        quantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.DISTRICT,
        ownerId: "district-1",
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      });

      expect(result.restored).toBe(false);
      expect(result.created).toBe(true);
      expect(prisma.stockDISTRICT.create).toHaveBeenCalled();
    });

    it("devrait créer le stock HEALTHCENTER s'il n'existe pas lors de la recréation", async () => {
      const newLot = {
        id: "lot-2",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: "hc-1",
        quantity: 50,
        remainingQuantity: 50,
      };

      prisma.stockLot.findUnique.mockResolvedValue(null);
      prisma.stockLot.create.mockResolvedValue(newLot);
      prisma.stockHEALTHCENTER.findUnique.mockResolvedValue(null);
      prisma.stockHEALTHCENTER.create.mockResolvedValue({
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        quantity: 50,
      });

      const result = await restoreOrRecreateLotForRejectedTransfer(null, {
        lotId: "lot-1",
        quantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: "hc-1",
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      });

      expect(result.restored).toBe(false);
      expect(result.created).toBe(true);
      expect(prisma.stockHEALTHCENTER.create).toHaveBeenCalled();
    });

    it("devrait mettre à jour le stock existant lors de la restauration", async () => {
      const mockLot = {
        id: "lot-1",
        remainingQuantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.NATIONAL,
        ownerId: null,
      };

      prisma.stockLot.findUnique.mockResolvedValue(mockLot);
      prisma.stockLot.update.mockResolvedValue({
        ...mockLot,
        remainingQuantity: 100,
      });
      prisma.stockNATIONAL.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 200,
      });
      prisma.stockNATIONAL.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 250,
      });

      const result = await restoreOrRecreateLotForRejectedTransfer(null, {
        lotId: "lot-1",
        quantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.NATIONAL,
        ownerId: null,
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      });

      expect(result.restored).toBe(true);
      expect(prisma.stockNATIONAL.update).toHaveBeenCalled();
      expect(prisma.stockNATIONAL.create).not.toHaveBeenCalled();
    });

    it("devrait mettre à jour le stock REGIONAL existant lors de la restauration", async () => {
      const mockLot = {
        id: "lot-1",
        remainingQuantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
      };

      prisma.stockLot.findUnique.mockResolvedValue(mockLot);
      prisma.stockLot.update.mockResolvedValue({
        ...mockLot,
        remainingQuantity: 100,
      });
      prisma.stockREGIONAL.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        regionId: "region-1",
        quantity: 200,
      });
      prisma.stockREGIONAL.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 250,
      });

      const result = await restoreOrRecreateLotForRejectedTransfer(null, {
        lotId: "lot-1",
        quantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      });

      expect(result.restored).toBe(true);
      expect(prisma.stockREGIONAL.update).toHaveBeenCalled();
      expect(prisma.stockREGIONAL.create).not.toHaveBeenCalled();
    });

    it("devrait mettre à jour le stock DISTRICT existant lors de la restauration", async () => {
      const mockLot = {
        id: "lot-1",
        remainingQuantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.DISTRICT,
        ownerId: "district-1",
      };

      prisma.stockLot.findUnique.mockResolvedValue(mockLot);
      prisma.stockLot.update.mockResolvedValue({
        ...mockLot,
        remainingQuantity: 100,
      });
      prisma.stockDISTRICT.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        districtId: "district-1",
        quantity: 200,
      });
      prisma.stockDISTRICT.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 250,
      });

      const result = await restoreOrRecreateLotForRejectedTransfer(null, {
        lotId: "lot-1",
        quantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.DISTRICT,
        ownerId: "district-1",
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      });

      expect(result.restored).toBe(true);
      expect(prisma.stockDISTRICT.update).toHaveBeenCalled();
      expect(prisma.stockDISTRICT.create).not.toHaveBeenCalled();
    });

    it("devrait mettre à jour le stock HEALTHCENTER existant lors de la restauration", async () => {
      const mockLot = {
        id: "lot-1",
        remainingQuantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: "hc-1",
      };

      prisma.stockLot.findUnique.mockResolvedValue(mockLot);
      prisma.stockLot.update.mockResolvedValue({
        ...mockLot,
        remainingQuantity: 100,
      });
      prisma.stockHEALTHCENTER.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        quantity: 200,
      });
      prisma.stockHEALTHCENTER.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 250,
      });

      const result = await restoreOrRecreateLotForRejectedTransfer(null, {
        lotId: "lot-1",
        quantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: "hc-1",
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      });

      expect(result.restored).toBe(true);
      expect(prisma.stockHEALTHCENTER.update).toHaveBeenCalled();
      expect(prisma.stockHEALTHCENTER.create).not.toHaveBeenCalled();
    });

    it("devrait lancer une erreur si regionId est null pour REGIONAL lors de la restauration", async () => {
      const mockLot = {
        id: "lot-1",
        remainingQuantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: null,
      };

      prisma.stockLot.findUnique.mockResolvedValue(mockLot);
      prisma.stockLot.update.mockResolvedValue({
        ...mockLot,
        remainingQuantity: 100,
      });

      await expect(
        restoreOrRecreateLotForRejectedTransfer(null, {
          lotId: "lot-1",
          quantity: 50,
          vaccineId: "vaccine-1",
          ownerType: OWNER_TYPES.REGIONAL,
          ownerId: null,
          expiration: new Date("2025-12-31"),
          status: LOT_STATUS.VALID,
        })
      ).rejects.toThrow("regionId est requis pour un stock régional");
    });

    it("devrait lancer une erreur si districtId est null pour DISTRICT lors de la restauration", async () => {
      const mockLot = {
        id: "lot-1",
        remainingQuantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.DISTRICT,
        ownerId: null,
      };

      prisma.stockLot.findUnique.mockResolvedValue(mockLot);
      prisma.stockLot.update.mockResolvedValue({
        ...mockLot,
        remainingQuantity: 100,
      });

      await expect(
        restoreOrRecreateLotForRejectedTransfer(null, {
          lotId: "lot-1",
          quantity: 50,
          vaccineId: "vaccine-1",
          ownerType: OWNER_TYPES.DISTRICT,
          ownerId: null,
          expiration: new Date("2025-12-31"),
          status: LOT_STATUS.VALID,
        })
      ).rejects.toThrow("districtId est requis pour un stock district");
    });

    it("devrait lancer une erreur si healthCenterId est null pour HEALTHCENTER lors de la restauration", async () => {
      const mockLot = {
        id: "lot-1",
        remainingQuantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: null,
      };

      prisma.stockLot.findUnique.mockResolvedValue(mockLot);
      prisma.stockLot.update.mockResolvedValue({
        ...mockLot,
        remainingQuantity: 100,
      });

      await expect(
        restoreOrRecreateLotForRejectedTransfer(null, {
          lotId: "lot-1",
          quantity: 50,
          vaccineId: "vaccine-1",
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: null,
          expiration: new Date("2025-12-31"),
          status: LOT_STATUS.VALID,
        })
      ).rejects.toThrow("healthCenterId est requis pour un stock centre de santé");
    });

    it("devrait mettre à jour le stock existant lors de la recréation", async () => {
      const newLot = {
        id: "lot-2",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.NATIONAL,
        ownerId: null,
        quantity: 50,
        remainingQuantity: 50,
      };

      prisma.stockLot.findUnique.mockResolvedValue(null);
      prisma.stockLot.create.mockResolvedValue(newLot);
      prisma.stockNATIONAL.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 200,
      });
      prisma.stockNATIONAL.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 250,
      });

      const result = await restoreOrRecreateLotForRejectedTransfer(null, {
        lotId: "lot-1",
        quantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.NATIONAL,
        ownerId: null,
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      });

      expect(result.restored).toBe(false);
      expect(result.created).toBe(true);
      expect(prisma.stockNATIONAL.update).toHaveBeenCalled();
      expect(prisma.stockNATIONAL.create).not.toHaveBeenCalled();
    });

    it("devrait mettre à jour le stock REGIONAL existant lors de la recréation", async () => {
      const newLot = {
        id: "lot-2",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        quantity: 50,
        remainingQuantity: 50,
      };

      prisma.stockLot.findUnique.mockResolvedValue(null);
      prisma.stockLot.create.mockResolvedValue(newLot);
      prisma.stockREGIONAL.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        regionId: "region-1",
        quantity: 200,
      });
      prisma.stockREGIONAL.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 250,
      });

      const result = await restoreOrRecreateLotForRejectedTransfer(null, {
        lotId: "lot-1",
        quantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: "region-1",
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      });

      expect(result.restored).toBe(false);
      expect(result.created).toBe(true);
      expect(prisma.stockREGIONAL.update).toHaveBeenCalled();
      expect(prisma.stockREGIONAL.create).not.toHaveBeenCalled();
    });

    it("devrait mettre à jour le stock DISTRICT existant lors de la recréation", async () => {
      const newLot = {
        id: "lot-2",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.DISTRICT,
        ownerId: "district-1",
        quantity: 50,
        remainingQuantity: 50,
      };

      prisma.stockLot.findUnique.mockResolvedValue(null);
      prisma.stockLot.create.mockResolvedValue(newLot);
      prisma.stockDISTRICT.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        districtId: "district-1",
        quantity: 200,
      });
      prisma.stockDISTRICT.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 250,
      });

      const result = await restoreOrRecreateLotForRejectedTransfer(null, {
        lotId: "lot-1",
        quantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.DISTRICT,
        ownerId: "district-1",
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      });

      expect(result.restored).toBe(false);
      expect(result.created).toBe(true);
      expect(prisma.stockDISTRICT.update).toHaveBeenCalled();
      expect(prisma.stockDISTRICT.create).not.toHaveBeenCalled();
    });

    it("devrait mettre à jour le stock HEALTHCENTER existant lors de la recréation", async () => {
      const newLot = {
        id: "lot-2",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: "hc-1",
        quantity: 50,
        remainingQuantity: 50,
      };

      prisma.stockLot.findUnique.mockResolvedValue(null);
      prisma.stockLot.create.mockResolvedValue(newLot);
      prisma.stockHEALTHCENTER.findUnique.mockResolvedValue({
        vaccineId: "vaccine-1",
        healthCenterId: "hc-1",
        quantity: 200,
      });
      prisma.stockHEALTHCENTER.update.mockResolvedValue({
        vaccineId: "vaccine-1",
        quantity: 250,
      });

      const result = await restoreOrRecreateLotForRejectedTransfer(null, {
        lotId: "lot-1",
        quantity: 50,
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: "hc-1",
        expiration: new Date("2025-12-31"),
        status: LOT_STATUS.VALID,
      });

      expect(result.restored).toBe(false);
      expect(result.created).toBe(true);
      expect(prisma.stockHEALTHCENTER.update).toHaveBeenCalled();
      expect(prisma.stockHEALTHCENTER.create).not.toHaveBeenCalled();
    });

    it("devrait lancer une erreur si regionId est null pour REGIONAL lors de la recréation", async () => {
      const newLot = {
        id: "lot-2",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.REGIONAL,
        ownerId: null,
        quantity: 50,
        remainingQuantity: 50,
      };

      prisma.stockLot.findUnique.mockResolvedValue(null);
      prisma.stockLot.create.mockResolvedValue(newLot);

      await expect(
        restoreOrRecreateLotForRejectedTransfer(null, {
          lotId: "lot-1",
          quantity: 50,
          vaccineId: "vaccine-1",
          ownerType: OWNER_TYPES.REGIONAL,
          ownerId: null,
          expiration: new Date("2025-12-31"),
          status: LOT_STATUS.VALID,
        })
      ).rejects.toThrow("regionId est requis pour un stock régional");
    });

    it("devrait lancer une erreur si districtId est null pour DISTRICT lors de la recréation", async () => {
      const newLot = {
        id: "lot-2",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.DISTRICT,
        ownerId: null,
        quantity: 50,
        remainingQuantity: 50,
      };

      prisma.stockLot.findUnique.mockResolvedValue(null);
      prisma.stockLot.create.mockResolvedValue(newLot);

      await expect(
        restoreOrRecreateLotForRejectedTransfer(null, {
          lotId: "lot-1",
          quantity: 50,
          vaccineId: "vaccine-1",
          ownerType: OWNER_TYPES.DISTRICT,
          ownerId: null,
          expiration: new Date("2025-12-31"),
          status: LOT_STATUS.VALID,
        })
      ).rejects.toThrow("districtId est requis pour un stock district");
    });

    it("devrait lancer une erreur si healthCenterId est null pour HEALTHCENTER lors de la recréation", async () => {
      const newLot = {
        id: "lot-2",
        vaccineId: "vaccine-1",
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: null,
        quantity: 50,
        remainingQuantity: 50,
      };

      prisma.stockLot.findUnique.mockResolvedValue(null);
      prisma.stockLot.create.mockResolvedValue(newLot);

      await expect(
        restoreOrRecreateLotForRejectedTransfer(null, {
          lotId: "lot-1",
          quantity: 50,
          vaccineId: "vaccine-1",
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: null,
          expiration: new Date("2025-12-31"),
          status: LOT_STATUS.VALID,
        })
      ).rejects.toThrow("healthCenterId est requis pour un stock centre de santé");
    });
  });
});
