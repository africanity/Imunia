const prisma = require("../../src/config/prismaClient");
const {
  createLot,
  consumeLots,
  normalizeOwnerId,
  determineStatusFromExpiration,
  ensurePositiveInteger,
  modifyStockQuantity,
  reserveDoseForHealthCenter,
  releaseDoseForHealthCenter,
  refreshExpiredLots,
  deleteLotDirect,
  OWNER_TYPES,
  LOT_STATUS,
} = require("../../src/services/stockLotService");

describe("stockLotService - Fonctions critiques", () => {
  let regionId;
  let communeId;
  let districtId;
  let healthCenterId;
  let vaccineId;

  beforeAll(async () => {
    // Nettoyer les données de test existantes
    await prisma.stockLot.deleteMany({
      where: {
        vaccine: {
          name: { contains: "Test Vaccine StockLot" },
        },
      },
    });
    await prisma.stockHEALTHCENTER.deleteMany({});
    await prisma.stockDISTRICT.deleteMany({});
    await prisma.stockREGIONAL.deleteMany({});
    await prisma.stockNATIONAL.deleteMany({});

    // Créer une région
    const region = await prisma.region.create({
      data: {
        name: "Test Region StockLot",
      },
    });
    regionId = region.id;

    // Créer une commune
    const commune = await prisma.commune.create({
      data: {
        name: "Test Commune StockLot",
        regionId: regionId,
      },
    });
    communeId = commune.id;

    // Créer un district
    const district = await prisma.district.create({
      data: {
        name: "Test District StockLot",
        communeId: communeId,
      },
    });
    districtId = district.id;

    // Créer un centre de santé
    const healthCenter = await prisma.healthCenter.create({
      data: {
        name: "Test Health Center StockLot",
        address: "Test Address",
        districtId: districtId,
      },
    });
    healthCenterId = healthCenter.id;

    // Créer un vaccin
    const vaccine = await prisma.vaccine.create({
      data: {
        name: "Test Vaccine StockLot",
        description: "Vaccin de test pour stockLotService",
        dosesRequired: "1",
      },
    });
    vaccineId = vaccine.id;
  });

  afterAll(async () => {
    // Nettoyer les données de test
    if (vaccineId) {
      await prisma.stockLot.deleteMany({
        where: {
          vaccineId: vaccineId,
        },
      });
      await prisma.stockHEALTHCENTER.deleteMany({
        where: { vaccineId: vaccineId },
      });
      await prisma.stockDISTRICT.deleteMany({
        where: { vaccineId: vaccineId },
      });
      await prisma.stockREGIONAL.deleteMany({
        where: { vaccineId: vaccineId },
      });
      await prisma.stockNATIONAL.deleteMany({
        where: { vaccineId: vaccineId },
      });
      await prisma.vaccine.delete({ where: { id: vaccineId } }).catch(() => {});
    }
    if (healthCenterId) {
      await prisma.healthCenter.delete({ where: { id: healthCenterId } }).catch(() => {});
    }
    if (districtId) {
      await prisma.district.delete({ where: { id: districtId } }).catch(() => {});
    }
    if (communeId) {
      await prisma.commune.delete({ where: { id: communeId } }).catch(() => {});
    }
    if (regionId) {
      await prisma.region.delete({ where: { id: regionId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Nettoyer les lots avant chaque test
    await prisma.stockLot.deleteMany({
      where: { vaccineId: vaccineId },
    });
  });

  describe("normalizeOwnerId()", () => {
    it("Retourne null pour OWNER_TYPES.NATIONAL", () => {
      const result = normalizeOwnerId(OWNER_TYPES.NATIONAL, "any-id");
      expect(result).toBeNull();
    });

    it("Retourne l'ID pour les autres types", () => {
      const result = normalizeOwnerId(OWNER_TYPES.HEALTHCENTER, "test-id");
      expect(result).toBe("test-id");
    });

    it("Retourne null si ownerId est null", () => {
      const result = normalizeOwnerId(OWNER_TYPES.HEALTHCENTER, null);
      expect(result).toBeNull();
    });
  });

  describe("determineStatusFromExpiration()", () => {
    it("Retourne EXPIRED pour une date passée", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const result = determineStatusFromExpiration(pastDate);
      expect(result).toBe(LOT_STATUS.EXPIRED);
    });

    it("Retourne VALID pour une date future", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const result = determineStatusFromExpiration(futureDate);
      expect(result).toBe(LOT_STATUS.VALID);
    });

    it("Retourne EXPIRED pour une date exactement maintenant", () => {
      const now = new Date();
      const result = determineStatusFromExpiration(now);
      expect(result).toBe(LOT_STATUS.EXPIRED);
    });
  });

  describe("ensurePositiveInteger()", () => {
    it("Retourne un entier positif valide", () => {
      const result = ensurePositiveInteger(100, "quantité");
      expect(result).toBe(100);
    });

    it("Convertit une chaîne en nombre", () => {
      const result = ensurePositiveInteger("100", "quantité");
      expect(result).toBe(100);
    });

    it("Lance une erreur pour un nombre négatif", () => {
      expect(() => {
        ensurePositiveInteger(-10, "quantité");
      }).toThrow("quantité doit être un entier positif");
    });

    it("Lance une erreur pour zéro", () => {
      expect(() => {
        ensurePositiveInteger(0, "quantité");
      }).toThrow("quantité doit être un entier positif");
    });

    it("Lance une erreur pour un nombre non fini", () => {
      expect(() => {
        ensurePositiveInteger(Infinity, "quantité");
      }).toThrow();
    });

    it("Lance une erreur pour NaN", () => {
      expect(() => {
        ensurePositiveInteger(NaN, "quantité");
      }).toThrow();
    });

    it("Lance une erreur pour une chaîne invalide", () => {
      expect(() => {
        ensurePositiveInteger("abc", "quantité");
      }).toThrow();
    });
  });

  describe("createLot()", () => {
    it("Crée un lot valide avec toutes les propriétés", async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);

      const lot = await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 100,
        expiration: expirationDate,
        status: LOT_STATUS.VALID,
      });

      expect(lot).toBeTruthy();
      expect(lot.vaccineId).toBe(vaccineId);
      expect(lot.ownerType).toBe(OWNER_TYPES.HEALTHCENTER);
      expect(lot.ownerId).toBe(healthCenterId);
      expect(lot.quantity).toBe(100);
      expect(lot.remainingQuantity).toBe(100);
      expect(lot.status).toBe(LOT_STATUS.VALID);
      expect(new Date(lot.expiration).getTime()).toBe(expirationDate.getTime());
    });

    it("Normalise ownerId à null pour NATIONAL", async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);

      const lot = await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.NATIONAL,
        ownerId: "any-id",
        quantity: 100,
        expiration: expirationDate,
        status: LOT_STATUS.VALID,
      });

      expect(lot.ownerId).toBeNull();
    });

    it("Détermine automatiquement le statut si non fourni", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const lot = await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 100,
        expiration: futureDate,
        // Pas de status fourni
      });

      expect(lot.status).toBe(LOT_STATUS.VALID);
    });

    it("Force EXPIRED si la date est passée même si VALID est demandé", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const lot = await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 100,
        expiration: pastDate,
        status: LOT_STATUS.VALID, // Tentative de forcer VALID
      });

      expect(lot.status).toBe(LOT_STATUS.EXPIRED);
    });

    it("Permet quantity: 0 pour les lots PENDING", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const lot = await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 0,
        expiration: futureDate,
        status: LOT_STATUS.PENDING,
      });

      expect(lot.quantity).toBe(0);
      expect(lot.remainingQuantity).toBe(0);
      expect(lot.status).toBe(LOT_STATUS.PENDING);
    });

    it("Lance une erreur pour une date d'expiration invalide", async () => {
      await expect(
        createLot(null, {
          vaccineId,
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: healthCenterId,
          quantity: 100,
          expiration: "invalid-date",
          status: LOT_STATUS.VALID,
        })
      ).rejects.toThrow("Date d'expiration invalide");
    });

    it("Lance une erreur pour une quantité négative", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      await expect(
        createLot(null, {
          vaccineId,
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: healthCenterId,
          quantity: -10,
          expiration: futureDate,
          status: LOT_STATUS.VALID,
        })
      ).rejects.toThrow("La quantité du lot doit être positive");
    });

    it("Lance une erreur pour quantity: 0 si pas PENDING", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      await expect(
        createLot(null, {
          vaccineId,
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: healthCenterId,
          quantity: 0,
          expiration: futureDate,
          status: LOT_STATUS.VALID, // Pas PENDING
        })
      ).rejects.toThrow("La quantité du lot doit être positive");
    });
  });

  describe("consumeLots()", () => {
    beforeEach(async () => {
      // Créer des lots pour les tests de consommation
      const expiration1 = new Date();
      expiration1.setDate(expiration1.getDate() + 30);
      const expiration2 = new Date();
      expiration2.setDate(expiration2.getDate() + 60);

      await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 50,
        expiration: expiration1,
        status: LOT_STATUS.VALID,
      });

      await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 100,
        expiration: expiration2,
        status: LOT_STATUS.VALID,
      });
    });

    it("Consomme des lots en utilisant FIFO (premier expiré d'abord)", async () => {
      const allocations = await consumeLots(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 30,
      });

      expect(allocations.length).toBeGreaterThan(0);
      expect(allocations[0].quantity).toBe(30);

      // Vérifier que le premier lot a été consommé
      const lots = await prisma.stockLot.findMany({
        where: {
          vaccineId,
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: healthCenterId,
        },
        orderBy: { expiration: "asc" },
      });

      expect(lots[0].remainingQuantity).toBe(20); // 50 - 30
      expect(lots[1].remainingQuantity).toBe(100); // Non touché
    });

    it("Consomme depuis plusieurs lots si nécessaire", async () => {
      const allocations = await consumeLots(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 75, // Plus que le premier lot (50)
      });

      expect(allocations.length).toBeGreaterThan(0);
      const totalConsumed = allocations.reduce(
        (sum, a) => sum + a.quantity,
        0
      );
      expect(totalConsumed).toBe(75);
    });

    it("Lance une erreur si quantité insuffisante", async () => {
      await expect(
        consumeLots(null, {
          vaccineId,
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: healthCenterId,
          quantity: 1000, // Plus que disponible
        })
      ).rejects.toThrow("Quantité insuffisante");
    });

    it("Lance une erreur pour une quantité négative", async () => {
      await expect(
        consumeLots(null, {
          vaccineId,
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: healthCenterId,
          quantity: -10,
        })
      ).rejects.toThrow("La quantité demandée doit être positive");
    });

    it("Ignore les lots expirés", async () => {
      // Créer un lot expiré
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 200,
        expiration: pastDate,
        status: LOT_STATUS.EXPIRED,
      });

      // Consommer devrait utiliser les lots VALID uniquement
      const allocations = await consumeLots(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 30,
      });

      // Aucun lot expiré ne devrait être utilisé
      allocations.forEach((allocation) => {
        expect(allocation.status).toBe(LOT_STATUS.VALID);
      });
    });
  });

  describe("modifyStockQuantity()", () => {
    beforeEach(async () => {
      // Nettoyer les stocks existants avant de créer
      await prisma.stockHEALTHCENTER.deleteMany({
        where: {
          vaccineId,
          healthCenterId,
        },
      });
      // Créer des stocks pour les tests
      await prisma.stockHEALTHCENTER.create({
        data: {
          vaccineId,
          healthCenterId,
          quantity: 100,
        },
      });
    });

    it("Augmente la quantité de stock HEALTHCENTER", async () => {
      const result = await modifyStockQuantity(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        delta: 50,
      });

      expect(result).toBe(150);

      const stock = await prisma.stockHEALTHCENTER.findUnique({
        where: {
          vaccineId_healthCenterId: {
            vaccineId,
            healthCenterId,
          },
        },
      });
      expect(stock.quantity).toBe(150);
    });

    it("Diminue la quantité de stock HEALTHCENTER", async () => {
      const result = await modifyStockQuantity(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        delta: -30,
      });

      expect(result).toBe(70);

      const stock = await prisma.stockHEALTHCENTER.findUnique({
        where: {
          vaccineId_healthCenterId: {
            vaccineId,
            healthCenterId,
          },
        },
      });
      expect(stock.quantity).toBe(70);
    });

    it("Ne permet pas de quantité négative (retourne 0 minimum)", async () => {
      const result = await modifyStockQuantity(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        delta: -200, // Plus que disponible (100)
      });

      expect(result).toBe(0);

      const stock = await prisma.stockHEALTHCENTER.findUnique({
        where: {
          vaccineId_healthCenterId: {
            vaccineId,
            healthCenterId,
          },
        },
      });
      expect(stock.quantity).toBe(0);
    });

    it("Retourne null si delta est 0", async () => {
      const result = await modifyStockQuantity(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        delta: 0,
      });

      expect(result).toBeNull();
    });

    it("Retourne null si le stock n'existe pas", async () => {
      const result = await modifyStockQuantity(null, {
        vaccineId,
        ownerType: OWNER_TYPES.DISTRICT,
        ownerId: districtId,
        delta: 50,
      });

      expect(result).toBeNull();
    });
  });

  describe("reserveDoseForHealthCenter()", () => {
    beforeEach(async () => {
      // Nettoyer les stocks existants avant de créer
      await prisma.stockHEALTHCENTER.deleteMany({
        where: {
          vaccineId,
          healthCenterId,
        },
      });
      // Créer un stock HEALTHCENTER
      await prisma.stockHEALTHCENTER.create({
        data: {
          vaccineId,
          healthCenterId,
          quantity: 100,
        },
      });

      // Créer un lot valide
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);

      await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 100,
        expiration: expirationDate,
        status: LOT_STATUS.VALID,
      });
    });

    it("Réserve une dose avec succès", async () => {
      const result = await reserveDoseForHealthCenter(null, {
        vaccineId,
        healthCenterId,
        quantity: 1,
      });

      expect(result).toBeTruthy();
      expect(result.lotId).toBeTruthy();
      expect(result.quantity).toBe(1);

      // Vérifier que le stock a été diminué
      const stock = await prisma.stockHEALTHCENTER.findUnique({
        where: {
          vaccineId_healthCenterId: {
            vaccineId,
            healthCenterId,
          },
        },
      });
      expect(stock.quantity).toBe(99); // 100 - 1
    });

    it("Réserve plusieurs doses", async () => {
      const result = await reserveDoseForHealthCenter(null, {
        vaccineId,
        healthCenterId,
        quantity: 5,
      });

      expect(result.quantity).toBe(5);

      const stock = await prisma.stockHEALTHCENTER.findUnique({
        where: {
          vaccineId_healthCenterId: {
            vaccineId,
            healthCenterId,
          },
        },
      });
      expect(stock.quantity).toBe(95); // 100 - 5
    });

    it("Lance une erreur si stock insuffisant", async () => {
      await expect(
        reserveDoseForHealthCenter(null, {
          vaccineId,
          healthCenterId,
          quantity: 200, // Plus que disponible (100)
        })
      ).rejects.toThrow("Stock insuffisant");
    });

    it("Lance une erreur si healthCenterId est invalide", async () => {
      await expect(
        reserveDoseForHealthCenter(null, {
          vaccineId,
          healthCenterId: null,
          quantity: 1,
        })
      ).rejects.toThrow("Centre de santé invalide");
    });

    it("Vérifie que le lot ne sera pas expiré au moment du rendez-vous", async () => {
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 20);

      // Créer un lot qui expire avant le rendez-vous
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 10); // Expire avant le rendez-vous

      await prisma.stockLot.deleteMany({
        where: { vaccineId, ownerType: OWNER_TYPES.HEALTHCENTER },
      });

      await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 50,
        expiration: expirationDate,
        status: LOT_STATUS.VALID,
      });

      await expect(
        reserveDoseForHealthCenter(null, {
          vaccineId,
          healthCenterId,
          quantity: 1,
          appointmentDate: appointmentDate,
        })
      ).rejects.toThrow("sera expiré avant le rendez-vous");
    });
  });

  describe("releaseDoseForHealthCenter()", () => {
    beforeEach(async () => {
      // Nettoyer les stocks existants avant de créer
      await prisma.stockHEALTHCENTER.deleteMany({
        where: {
          vaccineId,
          healthCenterId,
        },
      });
      // Créer un stock HEALTHCENTER
      await prisma.stockHEALTHCENTER.create({
        data: {
          vaccineId,
          healthCenterId,
          quantity: 100,
        },
      });

      // Créer un lot
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);

      const lot = await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 100,
        expiration: expirationDate,
        status: LOT_STATUS.VALID,
      });

      // Consommer une partie pour simuler une réservation
      await prisma.stockLot.update({
        where: { id: lot.id },
        data: { remainingQuantity: 90 }, // 100 - 10
      });
    });

    it("Libère une dose avec succès", async () => {
      const lot = await prisma.stockLot.findFirst({
        where: {
          vaccineId,
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: healthCenterId,
        },
      });

      const result = await releaseDoseForHealthCenter(null, {
        vaccineId,
        healthCenterId,
        lotId: lot.id,
        quantity: 1,
      });

      expect(result).toBe(true);

      // Vérifier que le lot a été mis à jour
      const updatedLot = await prisma.stockLot.findUnique({
        where: { id: lot.id },
      });
      expect(updatedLot.remainingQuantity).toBe(91); // 90 + 1

      // Vérifier que le stock a été augmenté
      const stock = await prisma.stockHEALTHCENTER.findUnique({
        where: {
          vaccineId_healthCenterId: {
            vaccineId,
            healthCenterId,
          },
        },
      });
      expect(stock.quantity).toBe(101); // 100 + 1
    });

    it("Crée le stock s'il n'existe pas", async () => {
      // Supprimer le stock existant
      await prisma.stockHEALTHCENTER.delete({
        where: {
          vaccineId_healthCenterId: {
            vaccineId,
            healthCenterId,
          },
        },
      });

      const lot = await prisma.stockLot.findFirst({
        where: {
          vaccineId,
          ownerType: OWNER_TYPES.HEALTHCENTER,
          ownerId: healthCenterId,
        },
      });

      const result = await releaseDoseForHealthCenter(null, {
        vaccineId,
        healthCenterId,
        lotId: lot.id,
        quantity: 1,
      });

      expect(result).toBe(true);

      // Vérifier que le stock a été créé
      const stock = await prisma.stockHEALTHCENTER.findUnique({
        where: {
          vaccineId_healthCenterId: {
            vaccineId,
            healthCenterId,
          },
        },
      });
      expect(stock).toBeTruthy();
      expect(stock.quantity).toBe(1);
    });

    it("Retourne null si healthCenterId ou lotId est manquant", async () => {
      const result1 = await releaseDoseForHealthCenter(null, {
        vaccineId,
        healthCenterId: null,
        lotId: "some-id",
        quantity: 1,
      });

      expect(result1).toBeNull();

      const result2 = await releaseDoseForHealthCenter(null, {
        vaccineId,
        healthCenterId: healthCenterId,
        lotId: null,
        quantity: 1,
      });

      expect(result2).toBeNull();
    });
  });

  describe("refreshExpiredLots()", () => {
    it("Met à jour les lots expirés en EXPIRED", async () => {
      // Créer des lots avec une date future d'abord (pour qu'ils soient créés en VALID/PENDING)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const lot1 = await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 50,
        expiration: futureDate,
        status: LOT_STATUS.VALID,
      });

      const lot2 = await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 100,
        expiration: futureDate,
        status: LOT_STATUS.PENDING,
      });

      // Maintenant mettre à jour les dates d'expiration pour qu'elles soient passées
      // tout en gardant le statut VALID/PENDING (pour simuler des lots qui n'ont pas encore été rafraîchis)
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      await prisma.stockLot.update({
        where: { id: lot1.id },
        data: { expiration: pastDate, status: LOT_STATUS.VALID },
      });

      await prisma.stockLot.update({
        where: { id: lot2.id },
        data: { expiration: pastDate, status: LOT_STATUS.PENDING },
      });

      const expiredLots = await refreshExpiredLots(null);

      expect(expiredLots.length).toBeGreaterThanOrEqual(2);

      // Vérifier que les lots ont été mis à jour
      const updatedLot1 = await prisma.stockLot.findUnique({
        where: { id: lot1.id },
      });
      expect(updatedLot1.status).toBe(LOT_STATUS.EXPIRED);

      const updatedLot2 = await prisma.stockLot.findUnique({
        where: { id: lot2.id },
      });
      expect(updatedLot2.status).toBe(LOT_STATUS.EXPIRED);
    });

    it("Retourne un tableau vide s'il n'y a pas de lots expirés", async () => {
      // Créer un lot valide (non expiré)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 100,
        expiration: futureDate,
        status: LOT_STATUS.VALID,
      });

      const expiredLots = await refreshExpiredLots(null);

      // Le lot créé ne devrait pas être dans la liste (sauf s'il y en a d'autres)
      const hasFutureLot = expiredLots.some(
        (lot) => new Date(lot.expiration) > new Date()
      );
      expect(hasFutureLot).toBe(false);
    });
  });

  describe("deleteLotDirect()", () => {
    it("Supprime un lot et ajuste le stock", async () => {
      // Nettoyer les stocks existants avant de créer
      await prisma.stockHEALTHCENTER.deleteMany({
        where: {
          vaccineId,
          healthCenterId,
        },
      });
      // Créer un stock
      await prisma.stockHEALTHCENTER.create({
        data: {
          vaccineId,
          healthCenterId,
          quantity: 100,
        },
      });

      // Créer un lot
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);

      const lot = await createLot(null, {
        vaccineId,
        ownerType: OWNER_TYPES.HEALTHCENTER,
        ownerId: healthCenterId,
        quantity: 50,
        expiration: expirationDate,
        status: LOT_STATUS.VALID,
      });

      // Consommer une partie
      await prisma.stockLot.update({
        where: { id: lot.id },
        data: { remainingQuantity: 30 }, // 50 - 20 consommés
      });

      const deletedId = await deleteLotDirect(null, lot.id);

      expect(deletedId).toBe(lot.id);

      // Vérifier que le lot a été supprimé
      const deletedLot = await prisma.stockLot.findUnique({
        where: { id: lot.id },
      });
      expect(deletedLot).toBeNull();

      // Vérifier que le stock a été ajusté (100 - 30 restants = 70)
      const stock = await prisma.stockHEALTHCENTER.findUnique({
        where: {
          vaccineId_healthCenterId: {
            vaccineId,
            healthCenterId,
          },
        },
      });
      expect(stock.quantity).toBe(70);
    });

    it("Retourne null si le lot n'existe pas", async () => {
      const result = await deleteLotDirect(
        null,
        "00000000-0000-0000-0000-000000000000"
      );
      expect(result).toBeNull();
    });
  });
});
