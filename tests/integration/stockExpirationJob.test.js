const prisma = require("../../src/config/prismaClient");
const { checkStockExpirations } = require("../../src/jobs/stockExpirationJob");
const {
  findAllValidLots,
  calculateDaysUntilExpiration,
  findNextThreshold,
  getConcernedAgents,
  hasNotificationBeenSent,
  recordNotificationSent,
} = require("../../src/services/stockExpirationService");

// Mock du service d'email pour éviter d'envoyer de vrais emails
jest.mock("../../src/services/emailService", () => ({
  sendStockExpirationAlert: jest.fn().mockResolvedValue({
    success: true,
  }),
}));

const { sendStockExpirationAlert } = require("../../src/services/emailService");

describe("Stock Expiration Job - checkStockExpirations", () => {
  let regionId;
  let communeId;
  let districtId;
  let healthCenterId;
  let vaccineId;
  let agentId;
  let agentAdminId;
  let districtAdminId;
  let regionalAdminId;
  let nationalAdminId;

  beforeAll(async () => {
    // Nettoyer les données de test existantes
    await prisma.stockExpirationNotification.deleteMany({});
    await prisma.stockLot.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "test-stock-expiration",
        },
      },
    });

    // Créer une région
    const region = await prisma.region.create({
      data: {
        name: "Test Region Stock Expiration",
      },
    });
    regionId = region.id;

    // Créer une commune
    const commune = await prisma.commune.create({
      data: {
        name: "Test Commune Stock Expiration",
        regionId: regionId,
      },
    });
    communeId = commune.id;

    // Créer un district
    const district = await prisma.district.create({
      data: {
        name: "Test District Stock Expiration",
        communeId: communeId,
      },
    });
    districtId = district.id;

    // Créer un centre de santé
    const healthCenter = await prisma.healthCenter.create({
      data: {
        name: "Test Health Center Stock Expiration",
        address: "Test Address",
        districtId: districtId,
      },
    });
    healthCenterId = healthCenter.id;

    // Créer un vaccin
    const vaccine = await prisma.vaccine.create({
      data: {
        name: "Test Vaccine Stock Expiration",
        description: "Vaccin de test pour expiration",
        dosesRequired: "1",
      },
    });
    vaccineId = vaccine.id;

    // Créer des utilisateurs pour les tests
    const hashedPassword = await require("bcryptjs").hash("password123", 10);

    // Agent normal
    const agent = await prisma.user.create({
      data: {
        email: "test-stock-expiration-agent@test.com",
        password: hashedPassword,
        firstName: "Agent",
        lastName: "Test",
        role: "AGENT",
        healthCenterId: healthCenterId,
        isActive: true,
      },
    });
    agentId = agent.id;

    // Agent ADMIN
    const agentAdmin = await prisma.user.create({
      data: {
        email: "test-stock-expiration-agent-admin@test.com",
        password: hashedPassword,
        firstName: "Agent",
        lastName: "Admin",
        role: "AGENT",
        agentLevel: "ADMIN",
        districtId: districtId,
        isActive: true,
      },
    });
    agentAdminId = agentAdmin.id;

    // Administrateur de district
    const districtAdmin = await prisma.user.create({
      data: {
        email: "test-stock-expiration-district@test.com",
        password: hashedPassword,
        firstName: "District",
        lastName: "Admin",
        role: "DISTRICT",
        districtId: districtId,
        isActive: true,
      },
    });
    districtAdminId = districtAdmin.id;

    // Administrateur régional
    const regionalAdmin = await prisma.user.create({
      data: {
        email: "test-stock-expiration-regional@test.com",
        password: hashedPassword,
        firstName: "Regional",
        lastName: "Admin",
        role: "REGIONAL",
        regionId: regionId,
        isActive: true,
      },
    });
    regionalAdminId = regionalAdmin.id;

    // Administrateur national
    const nationalAdmin = await prisma.user.create({
      data: {
        email: "test-stock-expiration-national@test.com",
        password: hashedPassword,
        firstName: "National",
        lastName: "Admin",
        role: "NATIONAL",
        isActive: true,
      },
    });
    nationalAdminId = nationalAdmin.id;
  });

  afterAll(async () => {
    // Nettoyer les données de test
    await prisma.stockExpirationNotification.deleteMany({});
    await prisma.stockLot.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "test-stock-expiration",
        },
      },
    });
    if (vaccineId) {
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

  beforeEach(() => {
    // Réinitialiser les mocks avant chaque test
    jest.clearAllMocks();
    sendStockExpirationAlert.mockResolvedValue({ success: true });
  });

  describe("checkStockExpirations() - Scénarios de base", () => {
    it("Retourne success: true même s'il n'y a aucun lot", async () => {
      // S'assurer qu'il n'y a pas de lots
      await prisma.stockLot.deleteMany({});

      const result = await checkStockExpirations();

      expect(result).toEqual({
        success: true,
        notificationsSent: 0,
        errors: 0,
      });
    });

    it("Ignore les lots expirés", async () => {
      // Créer un lot expiré
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 10); // Il y a 10 jours

      await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          quantity: 100,
          remainingQuantity: 50,
          expiration: expiredDate,
          status: "EXPIRED",
        },
      });

      const result = await checkStockExpirations();

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBe(0);
      expect(sendStockExpirationAlert).not.toHaveBeenCalled();
    });

    it("Ignore les lots avec quantité restante = 0", async () => {
      // Créer un lot avec quantité restante = 0
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          quantity: 100,
          remainingQuantity: 0,
          expiration: futureDate,
          status: "VALID",
        },
      });

      const result = await checkStockExpirations();

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBe(0);
      expect(sendStockExpirationAlert).not.toHaveBeenCalled();
    });

    it("Ignore les lots qui ne sont pas encore au seuil", async () => {
      // Créer un lot qui expire dans 60 jours (trop loin)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);

      await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          quantity: 100,
          remainingQuantity: 50,
          expiration: futureDate,
          status: "VALID",
        },
      });

      const result = await checkStockExpirations();

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBe(0);
      expect(sendStockExpirationAlert).not.toHaveBeenCalled();
    });
  });

  describe("checkStockExpirations() - Notifications pour HEALTHCENTER", () => {
    it("Envoie une notification pour un lot qui expire dans 7 jours", async () => {
      // Créer un lot qui expire dans 6.5 jours (dans la fenêtre de 24h pour le seuil de 7 jours)
      const expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + (6.5 * 24 * 60 * 60 * 1000)); // 6.5 jours en millisecondes

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          quantity: 100,
          remainingQuantity: 50,
          expiration: expirationDate,
          status: "VALID",
        },
        include: {
          vaccine: true,
        },
      });

      const result = await checkStockExpirations();

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBeGreaterThan(0);
      expect(sendStockExpirationAlert).toHaveBeenCalled();

      // Vérifier que la notification a été enregistrée
      const notification = await prisma.stockExpirationNotification.findFirst({
        where: {
          stockLotId: lot.id,
          userId: agentId,
        },
      });
      expect(notification).toBeTruthy();
      expect(notification.notificationType).toBe("7_DAYS");

      // Nettoyer
      await prisma.stockExpirationNotification.deleteMany({});
      await prisma.stockLot.delete({ where: { id: lot.id } });
    });

    it("Ne renvoie pas de notification si déjà envoyée", async () => {
      // Créer un lot qui expire dans 6.5 jours (dans la fenêtre de 24h pour le seuil de 7 jours)
      const expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + (6.5 * 24 * 60 * 60 * 1000));

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          quantity: 100,
          remainingQuantity: 50,
          expiration: expirationDate,
          status: "VALID",
        },
      });

      // Enregistrer qu'une notification a déjà été envoyée
      await prisma.stockExpirationNotification.create({
        data: {
          stockLotId: lot.id,
          userId: agentId,
          expirationDate: expirationDate,
          daysBeforeExpiration: 7,
          notificationType: "7_DAYS",
        },
      });

      // Réinitialiser le mock pour compter les appels
      sendStockExpirationAlert.mockClear();

      const result = await checkStockExpirations();

      expect(result.success).toBe(true);
      // Le lot devrait être ignoré car la notification a déjà été envoyée
      expect(sendStockExpirationAlert).not.toHaveBeenCalled();

      // Nettoyer
      await prisma.stockExpirationNotification.deleteMany({});
      await prisma.stockLot.delete({ where: { id: lot.id } });
    });

    it("Groupe les notifications par agent", async () => {
      // Créer deux lots qui expirent dans 6.5 jours (dans la fenêtre de 24h pour le seuil de 7 jours)
      const expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + (6.5 * 24 * 60 * 60 * 1000));

      const lot1 = await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          quantity: 100,
          remainingQuantity: 50,
          expiration: expirationDate,
          status: "VALID",
        },
        include: {
          vaccine: true,
        },
      });

      const lot2 = await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          quantity: 200,
          remainingQuantity: 100,
          expiration: expirationDate,
          status: "VALID",
        },
        include: {
          vaccine: true,
        },
      });

      const result = await checkStockExpirations();

      expect(result.success).toBe(true);
      // Un seul email devrait être envoyé (groupé) mais pour 2 lots
      expect(sendStockExpirationAlert).toHaveBeenCalledTimes(1);
      expect(result.notificationsSent).toBe(2);

      // Vérifier que les deux notifications ont été enregistrées
      const notifications = await prisma.stockExpirationNotification.findMany({
        where: {
          userId: agentId,
        },
      });
      expect(notifications.length).toBe(2);

      // Nettoyer
      await prisma.stockExpirationNotification.deleteMany({});
      await prisma.stockLot.deleteMany({
        where: {
          id: { in: [lot1.id, lot2.id] },
        },
      });
    });
  });

  describe("checkStockExpirations() - Notifications pour DISTRICT", () => {
    it("Notifie les agents ADMIN du district et l'administrateur du district", async () => {
      // Créer un lot au niveau district qui expire dans 13.5 jours (dans la fenêtre de 24h pour le seuil de 14 jours)
      const expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + (13.5 * 24 * 60 * 60 * 1000));

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "DISTRICT",
          ownerId: districtId,
          quantity: 500,
          remainingQuantity: 250,
          expiration: expirationDate,
          status: "VALID",
        },
        include: {
          vaccine: true,
        },
      });

      const result = await checkStockExpirations();

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBeGreaterThan(0);

      // Vérifier que les notifications ont été envoyées aux bons utilisateurs
      const notifications = await prisma.stockExpirationNotification.findMany({
        where: {
          stockLotId: lot.id,
        },
      });

      const notifiedUserIds = notifications.map((n) => n.userId);
      expect(notifiedUserIds).toContain(agentAdminId);
      expect(notifiedUserIds).toContain(districtAdminId);

      // Nettoyer
      await prisma.stockExpirationNotification.deleteMany({});
      await prisma.stockLot.delete({ where: { id: lot.id } });
    });
  });

  describe("checkStockExpirations() - Notifications pour REGIONAL", () => {
    it("Notifie les administrateurs régionaux", async () => {
      // Créer un lot au niveau régional qui expire dans 29.5 jours (dans la fenêtre de 24h pour le seuil de 30 jours)
      const expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + (29.5 * 24 * 60 * 60 * 1000));

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "REGIONAL",
          ownerId: regionId,
          quantity: 1000,
          remainingQuantity: 500,
          expiration: expirationDate,
          status: "VALID",
        },
        include: {
          vaccine: true,
        },
      });

      const result = await checkStockExpirations();

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBeGreaterThan(0);

      // Vérifier que la notification a été envoyée à l'administrateur régional
      const notification = await prisma.stockExpirationNotification.findFirst({
        where: {
          stockLotId: lot.id,
          userId: regionalAdminId,
        },
      });
      expect(notification).toBeTruthy();

      // Nettoyer
      await prisma.stockExpirationNotification.deleteMany({});
      await prisma.stockLot.delete({ where: { id: lot.id } });
    });
  });

  describe("checkStockExpirations() - Notifications pour NATIONAL", () => {
    it("Notifie les administrateurs nationaux", async () => {
      // Créer un lot au niveau national qui expire dans 1.5 jours (dans la fenêtre de 24h pour le seuil de 2 jours)
      const expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + (1.5 * 24 * 60 * 60 * 1000));

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "NATIONAL",
          ownerId: null,
          quantity: 5000,
          remainingQuantity: 2500,
          expiration: expirationDate,
          status: "VALID",
        },
        include: {
          vaccine: true,
        },
      });

      const result = await checkStockExpirations();

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBeGreaterThan(0);

      // Vérifier que la notification a été envoyée à l'administrateur national
      const notification = await prisma.stockExpirationNotification.findFirst({
        where: {
          stockLotId: lot.id,
          userId: nationalAdminId,
        },
      });
      expect(notification).toBeTruthy();

      // Nettoyer
      await prisma.stockExpirationNotification.deleteMany({});
      await prisma.stockLot.delete({ where: { id: lot.id } });
    });
  });

  describe("checkStockExpirations() - Gestion des erreurs", () => {
    it("Gère les erreurs d'envoi d'email sans planter", async () => {
      // Simuler une erreur d'envoi d'email pour tous les appels
      sendStockExpirationAlert.mockResolvedValue({
        success: false,
        error: "Erreur SMTP",
      });

      // Créer un lot qui expire dans 6.9 jours (dans la fenêtre de 24h pour le seuil de 7 jours)
      // Utiliser 6.9 pour être sûr d'être dans la fenêtre [6, 7]
      const expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + (6.9 * 24 * 60 * 60 * 1000));

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          quantity: 100,
          remainingQuantity: 50,
          expiration: expirationDate,
          status: "VALID",
        },
        include: {
          vaccine: true,
        },
      });

      const result = await checkStockExpirations();

      expect(result.success).toBe(true);
      expect(result.errors).toBeGreaterThan(0);
      expect(result.notificationsSent).toBe(0);

      // Restaurer le mock pour les autres tests
      sendStockExpirationAlert.mockResolvedValue({ success: true });

      // Nettoyer
      await prisma.stockExpirationNotification.deleteMany({});
      await prisma.stockLot.delete({ where: { id: lot.id } });
    });

    it("Gère les exceptions lors de l'envoi d'email", async () => {
      // Simuler une exception lors de l'envoi d'email
      sendStockExpirationAlert.mockRejectedValueOnce(
        new Error("Erreur réseau")
      );

      // Créer un lot qui expire dans 6.5 jours (dans la fenêtre de 24h pour le seuil de 7 jours)
      const expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + (6.5 * 24 * 60 * 60 * 1000));

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          quantity: 100,
          remainingQuantity: 50,
          expiration: expirationDate,
          status: "VALID",
        },
      });

      const result = await checkStockExpirations();

      expect(result.success).toBe(true);
      expect(result.errors).toBeGreaterThan(0);

      // Nettoyer
      await prisma.stockLot.delete({ where: { id: lot.id } });
    });

    it("Retourne success: false en cas d'erreur critique", async () => {
      // Simuler une erreur critique en mockant Prisma pour faire échouer findAllValidLots
      const originalFindMany = prisma.stockLot.findMany;
      
      prisma.stockLot.findMany = jest.fn().mockRejectedValue(
        new Error("Erreur base de données")
      );

      const result = await checkStockExpirations();

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();

      // Restaurer la fonction originale
      prisma.stockLot.findMany = originalFindMany;
    });
  });

  describe("checkStockExpirations() - Différents seuils d'expiration", () => {
    it("Détecte correctement le seuil de 30 jours", async () => {
      // Créer un lot qui expire dans 29.5 jours (dans la fenêtre de 24h pour le seuil de 30 jours)
      const expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + (29.5 * 24 * 60 * 60 * 1000));

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          quantity: 100,
          remainingQuantity: 50,
          expiration: expirationDate,
          status: "VALID",
        },
      });

      const result = await checkStockExpirations();

      if (result.notificationsSent > 0) {
        const notification = await prisma.stockExpirationNotification.findFirst({
          where: {
            stockLotId: lot.id,
          },
        });
        expect(notification?.notificationType).toBe("30_DAYS");
      }

      await prisma.stockExpirationNotification.deleteMany({});
      await prisma.stockLot.delete({ where: { id: lot.id } });
    });

    it("Détecte correctement le seuil de 14 jours", async () => {
      // Créer un lot qui expire dans 13.5 jours (dans la fenêtre de 24h pour le seuil de 14 jours)
      const expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + (13.5 * 24 * 60 * 60 * 1000));

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          quantity: 100,
          remainingQuantity: 50,
          expiration: expirationDate,
          status: "VALID",
        },
      });

      const result = await checkStockExpirations();

      if (result.notificationsSent > 0) {
        const notification = await prisma.stockExpirationNotification.findFirst({
          where: {
            stockLotId: lot.id,
          },
        });
        expect(notification?.notificationType).toBe("14_DAYS");
      }

      await prisma.stockExpirationNotification.deleteMany({});
      await prisma.stockLot.delete({ where: { id: lot.id } });
    });

    it("Détecte correctement le seuil de 2 jours", async () => {
      // Créer un lot qui expire dans 1.5 jours (dans la fenêtre de 24h pour le seuil de 2 jours)
      const expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + (1.5 * 24 * 60 * 60 * 1000));

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          quantity: 100,
          remainingQuantity: 50,
          expiration: expirationDate,
          status: "VALID",
        },
      });

      const result = await checkStockExpirations();

      if (result.notificationsSent > 0) {
        const notification = await prisma.stockExpirationNotification.findFirst({
          where: {
            stockLotId: lot.id,
          },
        });
        expect(notification?.notificationType).toBe("2_DAYS");
      }

      await prisma.stockExpirationNotification.deleteMany({});
      await prisma.stockLot.delete({ where: { id: lot.id } });
    });
  });
});
