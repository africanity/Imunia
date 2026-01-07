const prisma = require("../../src/config/prismaClient");
const {
  findAllValidLots,
  calculateDaysUntilExpiration,
  findNextThreshold,
  getConcernedAgents,
  hasNotificationBeenSent,
  recordNotificationSent,
  getOwnerInfo,
} = require("../../src/services/stockExpirationService");

describe("stockExpirationService", () => {
  let regionId;
  let vaccineId;
  let lotId;

  beforeAll(async () => {
    // Setup de données de test
    const region = await prisma.region.create({
      data: { name: "Test Region Service" },
    });
    regionId = region.id;

    const vaccine = await prisma.vaccine.create({
      data: {
        name: "Test Vaccine Service",
        description: "Vaccin de test pour les tests unitaires",
        dosesRequired: "1",
      },
    });
    vaccineId = vaccine.id;
  });

  afterAll(async () => {
    // Nettoyage
    await prisma.stockExpirationNotification.deleteMany({});
    await prisma.stockLot.deleteMany({});
    await prisma.stockREGIONAL.deleteMany({});
    await prisma.stockDISTRICT.deleteMany({});
    await prisma.stockHEALTHCENTER.deleteMany({});
    await prisma.stockNATIONAL.deleteMany({});
    // Nettoyer les utilisateurs de test créés dans les tests
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "@test.com",
        },
      },
    });
    await prisma.vaccine.delete({ where: { id: vaccineId } });
    await prisma.region.delete({ where: { id: regionId } });
  });

  describe("findAllValidLots", () => {
    it("devrait retourner uniquement les lots valides", async () => {
      // Créer un stock régional et un lot valide
      const stock = await prisma.stockREGIONAL.create({
        data: {
          vaccineId,
          regionId,
          quantity: 100,
        },
      });

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          quantity: 50,
          remainingQuantity: 50,
          expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 jours
          status: "VALID",
          ownerType: "REGIONAL",
          ownerId: regionId,
        },
      });

      const lots = await findAllValidLots();
      expect(lots).toContainEqual(
        expect.objectContaining({ id: lot.id })
      );

      // Nettoyer
      await prisma.stockLot.delete({ where: { id: lot.id } });
      await prisma.stockREGIONAL.delete({ where: { id: stock.id } });
    });

    it("ne devrait pas retourner les lots expirés", async () => {
      const stock = await prisma.stockREGIONAL.create({
        data: {
          vaccineId,
          regionId,
          quantity: 100,
        },
      });

      const expiredLot = await prisma.stockLot.create({
        data: {
          vaccineId,
          quantity: 50,
          remainingQuantity: 50,
          expiration: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // -1 jour (expiré)
          status: "EXPIRED",
          ownerType: "REGIONAL",
          ownerId: regionId,
        },
      });

      const lots = await findAllValidLots();
      expect(lots).not.toContainEqual(
        expect.objectContaining({ id: expiredLot.id })
      );

      // Nettoyer
      await prisma.stockLot.delete({ where: { id: expiredLot.id } });
      await prisma.stockREGIONAL.delete({ where: { id: stock.id } });
    });
  });

  describe("calculateDaysUntilExpiration", () => {
    it("devrait calculer correctement les jours restants", () => {
      const expiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 jours
      const days = calculateDaysUntilExpiration(expiration);
      expect(days).toBeCloseTo(7, 0);
    });

    it("devrait retourner un nombre négatif pour les dates passées", () => {
      const expiration = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // -1 jour
      const days = calculateDaysUntilExpiration(expiration);
      expect(days).toBeLessThan(0);
    });
  });

  describe("findNextThreshold", () => {
    it("devrait trouver le seuil 7 jours pour un lot expirant dans 5 jours", () => {
      const daysUntilExpiration = 5;
      const threshold = findNextThreshold(daysUntilExpiration);
      expect(threshold).toBe(7);
    });

    it("devrait trouver le seuil 14 jours pour un lot expirant dans 10 jours", () => {
      const daysUntilExpiration = 10;
      const threshold = findNextThreshold(daysUntilExpiration);
      expect(threshold).toBe(14);
    });

    it("devrait trouver le seuil 30 jours pour un lot expirant dans 20 jours", () => {
      const daysUntilExpiration = 20;
      const threshold = findNextThreshold(daysUntilExpiration);
      expect(threshold).toBe(30);
    });

    it("devrait retourner le plus grand seuil si le lot expire dans plus de 30 jours", () => {
      const daysUntilExpiration = 35;
      const threshold = findNextThreshold(daysUntilExpiration);
      expect(threshold).toBe(30); // Retourne le plus grand seuil disponible
    });
  });

  describe("hasNotificationBeenSent", () => {
    it("devrait retourner false si aucune notification n'a été envoyée", async () => {
      const lotId = "test-lot-id";
      const userId = "test-user-id";
      const notificationType = "EMAIL";
      const sent = await hasNotificationBeenSent(lotId, userId, notificationType);
      expect(sent).toBe(false);
    });

    it("devrait retourner true si une notification a été envoyée", async () => {
      const stock = await prisma.stockREGIONAL.create({
        data: {
          vaccineId,
          regionId,
          quantity: 100,
        },
      });

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          quantity: 50,
          remainingQuantity: 50,
          expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "VALID",
          ownerType: "REGIONAL",
          ownerId: regionId,
        },
      });

      // Créer un utilisateur pour la notification (avec email unique)
      const uniqueEmail = `test-notification-user-${Date.now()}@test.com`;
      const user = await prisma.user.create({
        data: {
          email: uniqueEmail,
          password: "hashed",
          firstName: "Test",
          lastName: "User",
          role: "REGIONAL",
          regionId,
          isActive: true,
        },
      });

      // Enregistrer une notification
      await recordNotificationSent(
        lot.id,
        user.id,
        lot.expiration,
        7,
        "EMAIL"
      );

      const sent = await hasNotificationBeenSent(lot.id, user.id, "EMAIL");
      expect(sent).toBe(true);

      // Nettoyer
      await prisma.stockExpirationNotification.deleteMany({
        where: { stockLotId: lot.id },
      });
      await prisma.stockLot.delete({ where: { id: lot.id } });
      await prisma.stockREGIONAL.delete({ where: { id: stock.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe("getConcernedAgents", () => {
    let communeId;
    let districtId;
    let healthCenterId;

    beforeAll(async () => {
      const commune = await prisma.commune.create({
        data: {
          name: "Test Commune Stock Expiration",
          regionId,
        },
      });
      communeId = commune.id;

      const district = await prisma.district.create({
        data: {
          name: "Test District Stock Expiration",
          communeId,
        },
      });
      districtId = district.id;

      const healthCenter = await prisma.healthCenter.create({
        data: {
          name: "Test Health Center Stock Expiration",
          address: "Test Address",
          districtId,
        },
      });
      healthCenterId = healthCenter.id;
    });

    afterAll(async () => {
      if (healthCenterId) {
        await prisma.healthCenter.delete({ where: { id: healthCenterId } }).catch(() => {});
      }
      if (districtId) {
        await prisma.district.delete({ where: { id: districtId } }).catch(() => {});
      }
      if (communeId) {
        await prisma.commune.delete({ where: { id: communeId } }).catch(() => {});
      }
    });

    it("devrait retourner les agents concernés pour un lot régional", async () => {
      // Créer un agent régional (avec email unique)
      const uniqueEmail = `test-agent-regional-${Date.now()}@test.com`;
      const agent = await prisma.user.create({
        data: {
          email: uniqueEmail,
          password: "hashed",
          firstName: "Test",
          lastName: "Agent",
          role: "REGIONAL",
          regionId,
          isActive: true,
        },
      });

      const stock = await prisma.stockREGIONAL.create({
        data: {
          vaccineId,
          regionId,
          quantity: 100,
        },
      });

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          quantity: 50,
          remainingQuantity: 50,
          expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "VALID",
          ownerType: "REGIONAL",
          ownerId: regionId,
        },
      });

      const agents = await getConcernedAgents(lot);
      expect(agents).toContainEqual(
        expect.objectContaining({ id: agent.id })
      );

      // Nettoyer
      await prisma.stockLot.delete({ where: { id: lot.id } });
      await prisma.stockREGIONAL.delete({ where: { id: stock.id } });
      await prisma.user.delete({ where: { id: agent.id } });
    });

    it("devrait retourner les agents concernés pour un lot national", async () => {
      const uniqueEmail = `test-agent-national-${Date.now()}@test.com`;
      const agent = await prisma.user.create({
        data: {
          email: uniqueEmail,
          password: "hashed",
          firstName: "Test",
          lastName: "Agent",
          role: "NATIONAL",
          isActive: true,
        },
      });

      const stock = await prisma.stockNATIONAL.create({
        data: {
          vaccineId,
          quantity: 100,
        },
      });

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          quantity: 50,
          remainingQuantity: 50,
          expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "VALID",
          ownerType: "NATIONAL",
          ownerId: null,
        },
      });

      const agents = await getConcernedAgents(lot);
      expect(agents).toContainEqual(
        expect.objectContaining({ id: agent.id })
      );

      // Nettoyer
      await prisma.stockLot.delete({ where: { id: lot.id } });
      await prisma.stockNATIONAL.delete({ where: { id: stock.id } });
      await prisma.user.delete({ where: { id: agent.id } });
    });

    it("devrait retourner les agents concernés pour un lot de district", async () => {
      const uniqueEmailAgent = `test-agent-district-${Date.now()}@test.com`;
      const uniqueEmailAdmin = `test-admin-district-${Date.now()}@test.com`;
      
      const agent = await prisma.user.create({
        data: {
          email: uniqueEmailAgent,
          password: "hashed",
          firstName: "Test",
          lastName: "Agent",
          role: "AGENT",
          districtId,
          agentLevel: "ADMIN",
          isActive: true,
        },
      });

      const admin = await prisma.user.create({
        data: {
          email: uniqueEmailAdmin,
          password: "hashed",
          firstName: "Test",
          lastName: "Admin",
          role: "DISTRICT",
          districtId,
          isActive: true,
        },
      });

      const stock = await prisma.stockDISTRICT.create({
        data: {
          vaccineId,
          districtId,
          quantity: 100,
        },
      });

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          quantity: 50,
          remainingQuantity: 50,
          expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "VALID",
          ownerType: "DISTRICT",
          ownerId: districtId,
        },
      });

      const agents = await getConcernedAgents(lot);
      expect(agents.length).toBeGreaterThan(0);
      const agentIds = agents.map((a) => a.id);
      expect(agentIds).toContain(agent.id);
      expect(agentIds).toContain(admin.id);

      // Nettoyer
      await prisma.stockLot.delete({ where: { id: lot.id } });
      await prisma.stockDISTRICT.delete({ where: { id: stock.id } });
      await prisma.user.delete({ where: { id: agent.id } });
      await prisma.user.delete({ where: { id: admin.id } });
    });

    it("devrait retourner les agents concernés pour un lot de centre de santé", async () => {
      const uniqueEmail = `test-agent-healthcenter-${Date.now()}@test.com`;
      const agent = await prisma.user.create({
        data: {
          email: uniqueEmail,
          password: "hashed",
          firstName: "Test",
          lastName: "Agent",
          role: "AGENT",
          healthCenterId,
          isActive: true,
        },
      });

      const stock = await prisma.stockHEALTHCENTER.create({
        data: {
          vaccineId,
          healthCenterId,
          quantity: 100,
        },
      });

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          quantity: 50,
          remainingQuantity: 50,
          expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "VALID",
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
        },
      });

      const agents = await getConcernedAgents(lot);
      expect(agents).toContainEqual(
        expect.objectContaining({ id: agent.id })
      );

      // Nettoyer
      await prisma.stockLot.delete({ where: { id: lot.id } });
      await prisma.stockHEALTHCENTER.delete({ where: { id: stock.id } });
      await prisma.user.delete({ where: { id: agent.id } });
    });

    it("devrait dédupliquer les agents par email", async () => {
      const uniqueEmail = `test-duplicate-${Date.now()}@test.com`;
      const agent1 = await prisma.user.create({
        data: {
          email: uniqueEmail,
          password: "hashed",
          firstName: "Test",
          lastName: "Agent1",
          role: "REGIONAL",
          regionId,
          isActive: true,
        },
      });

      const stock = await prisma.stockREGIONAL.create({
        data: {
          vaccineId,
          regionId,
          quantity: 100,
        },
      });

      const lot = await prisma.stockLot.create({
        data: {
          vaccineId,
          quantity: 50,
          remainingQuantity: 50,
          expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: "VALID",
          ownerType: "REGIONAL",
          ownerId: regionId,
        },
      });

      const agents = await getConcernedAgents(lot);
      const emails = agents.map((a) => a.email);
      const uniqueEmails = new Set(emails);
      expect(emails.length).toBe(uniqueEmails.size);

      // Nettoyer
      await prisma.stockLot.delete({ where: { id: lot.id } });
      await prisma.stockREGIONAL.delete({ where: { id: stock.id } });
      await prisma.user.delete({ where: { id: agent1.id } });
    });
  });

  describe("getOwnerInfo", () => {
    let communeId;
    let districtId;
    let healthCenterId;

    beforeAll(async () => {
      const commune = await prisma.commune.create({
        data: {
          name: "Test Commune Owner Info",
          regionId,
        },
      });
      communeId = commune.id;

      const district = await prisma.district.create({
        data: {
          name: "Test District Owner Info",
          communeId,
        },
      });
      districtId = district.id;

      const healthCenter = await prisma.healthCenter.create({
        data: {
          name: "Test Health Center Owner Info",
          address: "Test Address",
          districtId,
        },
      });
      healthCenterId = healthCenter.id;
    });

    afterAll(async () => {
      if (healthCenterId) {
        await prisma.healthCenter.delete({ where: { id: healthCenterId } }).catch(() => {});
      }
      if (districtId) {
        await prisma.district.delete({ where: { id: districtId } }).catch(() => {});
      }
      if (communeId) {
        await prisma.commune.delete({ where: { id: communeId } }).catch(() => {});
      }
    });

    it("devrait retourner les informations pour un lot national", async () => {
      const lot = {
        ownerType: "NATIONAL",
        ownerId: null,
      };

      const info = await getOwnerInfo(lot);
      expect(info.type).toBe("National");
      expect(info.name).toBe("Stock National");
    });

    it("devrait retourner les informations pour un lot régional", async () => {
      const lot = {
        ownerType: "REGIONAL",
        ownerId: regionId,
      };

      const info = await getOwnerInfo(lot);
      expect(info.type).toBe("Région");
      expect(info.name).toBe("Test Region Service");
    });

    it("devrait retourner les informations pour un lot de district", async () => {
      const lot = {
        ownerType: "DISTRICT",
        ownerId: districtId,
      };

      const info = await getOwnerInfo(lot);
      expect(info.type).toBe("District");
      expect(info.name).toBe("Test District Owner Info");
    });

    it("devrait retourner les informations pour un lot de centre de santé", async () => {
      const lot = {
        ownerType: "HEALTHCENTER",
        ownerId: healthCenterId,
      };

      const info = await getOwnerInfo(lot);
      expect(info.type).toBe("Centre de santé");
      expect(info.name).toBe("Test Health Center Owner Info");
    });

    it("devrait retourner 'Inconnu' pour un type d'owner invalide", async () => {
      const lot = {
        ownerType: "INVALID",
        ownerId: "invalid-id",
      };

      const info = await getOwnerInfo(lot);
      expect(info.type).toBe("Inconnu");
      expect(info.name).toBe("Inconnu");
    });
  });
});