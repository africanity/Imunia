const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");

jest.mock('../../src/services/emailService', () => ({
  sendInvitationEmail: jest.fn().mockResolvedValue([]),
  sendTwoFactorCode: jest.fn().mockResolvedValue([]),
  sendPasswordResetCode: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/services/notification', () => ({
  sendParentAccessCode: jest.fn(),
  sendVerificationCode: jest.fn(),
}));

jest.mock('../../src/services/whatsapp', () => ({
  sendAccountActivationWhatsApp: jest.fn(),
  sendPhotoRequestWhatsApp: jest.fn(),
}));

jest.mock('../../src/services/notificationService', () => ({
  notifyAccountActivated: jest.fn(),
  notifyPhotoRequest: jest.fn(),
  notifyHealthCenterAgents: jest.fn().mockResolvedValue([]),
  createNotification: jest.fn(),
  createNotificationsForUsers: jest.fn(),
}));

describe("Event Logs API - Journal des événements", () => {
  let nationalEmail;
  let nationalPassword;
  let nationalToken;
  let superadminEmail;
  let superadminPassword;
  let superadminToken;
  let regionalEmail;
  let regionalPassword;
  let regionalToken;
  let nationalUserId;
  let superadminUserId;
  let regionId;
  let eventLogId1;
  let eventLogId2;
  let eventLogId3;
  let eventLogId4;

  // Helper pour obtenir un token utilisateur valide
  const getUserToken = async (email, password) => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password });
    if (res.statusCode === 200) {
      return res.body.accessToken;
    }
    throw new Error(`Impossible de se connecter: ${res.statusCode} ${JSON.stringify(res.body)}`);
  };

  beforeAll(async () => {
    try {
      // Nettoyage complet
      await prisma.eventLog.deleteMany();
      await prisma.user.deleteMany();

      // Créer un utilisateur NATIONAL
      nationalEmail = `national-eventlog-${Date.now()}@test.com`;
      nationalPassword = "password123";
      const hashedNationalPassword = await bcrypt.hash(nationalPassword, 10);

      const nationalUser = await prisma.user.create({
        data: {
          email: nationalEmail,
          password: hashedNationalPassword,
          firstName: "National",
          lastName: "EventLog",
          role: "NATIONAL",
          isActive: true,
          emailVerified: true,
        },
      });
      nationalUserId = nationalUser.id;

      // Créer un utilisateur SUPERADMIN
      superadminEmail = `superadmin-eventlog-${Date.now()}@test.com`;
      superadminPassword = "password123";
      const hashedSuperadminPassword = await bcrypt.hash(superadminPassword, 10);

      const superadminUser = await prisma.user.create({
        data: {
          email: superadminEmail,
          password: hashedSuperadminPassword,
          firstName: "Superadmin",
          lastName: "EventLog",
          role: "SUPERADMIN",
          isActive: true,
          emailVerified: true,
        },
      });
      superadminUserId = superadminUser.id;

      // Créer une région pour l'utilisateur REGIONAL
      const region = await prisma.region.create({
        data: {
          name: `RegionEventLog-${Date.now()}`,
        },
      });
      regionId = region.id;

      // Créer un utilisateur REGIONAL (pour tester les permissions)
      regionalEmail = `regional-eventlog-${Date.now()}@test.com`;
      regionalPassword = "password123";
      const hashedRegionalPassword = await bcrypt.hash(regionalPassword, 10);

      await prisma.user.create({
        data: {
          email: regionalEmail,
          password: hashedRegionalPassword,
          firstName: "Regional",
          lastName: "EventLog",
          role: "REGIONAL",
          regionId: regionId,
          isActive: true,
          emailVerified: true,
        },
      });

      // Obtenir les tokens
      nationalToken = await getUserToken(nationalEmail, nationalPassword);
      superadminToken = await getUserToken(superadminEmail, superadminPassword);
      regionalToken = await getUserToken(regionalEmail, regionalPassword);
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  afterAll(async () => {
    await prisma.eventLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.region.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Créer des event logs de test directement avec Prisma
    const event1 = await prisma.eventLog.create({
      data: {
        type: "USER",
        subtype: "AGENT",
        action: "CREATE",
        userId: nationalUserId,
        userFirstName: "National",
        userLastName: "EventLog",
        userEmail: nationalEmail,
        userRole: "NATIONAL",
        entityType: "User",
        entityId: "test-user-id-1",
        entityName: "Test User 1",
        details: { test: "data1" },
      },
    });
    eventLogId1 = event1.id;

    const event2 = await prisma.eventLog.create({
      data: {
        type: "ENTITY",
        subtype: "REGION",
        action: "UPDATE",
        userId: superadminUserId,
        userFirstName: "Superadmin",
        userLastName: "EventLog",
        userEmail: superadminEmail,
        userRole: "SUPERADMIN",
        entityType: "Region",
        entityId: "test-region-id-1",
        entityName: "Test Region 1",
        details: { test: "data2" },
      },
    });
    eventLogId2 = event2.id;

    const event3 = await prisma.eventLog.create({
      data: {
        type: "VACCINE",
        subtype: null,
        action: "DELETE",
        userId: nationalUserId,
        userFirstName: "National",
        userLastName: "EventLog",
        userEmail: nationalEmail,
        userRole: "NATIONAL",
        entityType: "Vaccine",
        entityId: "test-vaccine-id-1",
        entityName: "Test Vaccine 1",
      },
    });
    eventLogId3 = event3.id;

    // Créer un event log avec une date différente pour tester les filtres de date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const event4 = await prisma.eventLog.create({
      data: {
        type: "USER",
        subtype: "AGENT",
        action: "CREATE",
        userId: nationalUserId,
        userFirstName: "National",
        userLastName: "EventLog",
        userEmail: nationalEmail,
        userRole: "NATIONAL",
        entityType: "User",
        entityId: "test-user-id-2",
        entityName: "Test User 2",
        createdAt: yesterday,
      },
    });
    eventLogId4 = event4.id;
  });

  afterEach(async () => {
    await prisma.eventLog.deleteMany();
  });

  describe("GET /api/event-logs - Liste des événements", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/event-logs");

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si l'utilisateur n'est pas NATIONAL ou SUPERADMIN", async () => {
      const res = await request(app)
        .get("/api/event-logs")
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty("message", "Accès refusé");
    });

    it("Retourne la liste des événements avec succès pour un utilisateur NATIONAL", async () => {
      const res = await request(app)
        .get("/api/event-logs")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("events");
      expect(res.body).toHaveProperty("pagination");
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(res.body.pagination).toHaveProperty("page");
      expect(res.body.pagination).toHaveProperty("limit");
      expect(res.body.pagination).toHaveProperty("total");
      expect(res.body.pagination).toHaveProperty("totalPages");
      expect(res.body.events.length).toBeGreaterThan(0);
      
      // Vérifier la structure d'un événement
      if (res.body.events.length > 0) {
        const event = res.body.events[0];
        expect(event).toHaveProperty("id");
        expect(event).toHaveProperty("type");
        expect(event).toHaveProperty("action");
        expect(event).toHaveProperty("createdAt");
        expect(event).toHaveProperty("user");
      }
    });

    it("Retourne la liste des événements avec succès pour un utilisateur SUPERADMIN", async () => {
      const res = await request(app)
        .get("/api/event-logs")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("events");
      expect(res.body).toHaveProperty("pagination");
      expect(Array.isArray(res.body.events)).toBe(true);
    });

    it("Filtre les événements par type", async () => {
      const res = await request(app)
        .get("/api/event-logs?type=USER")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.events.length).toBeGreaterThan(0);
      res.body.events.forEach((event) => {
        expect(event.type).toBe("USER");
      });
    });

    it("Filtre les événements par subtype", async () => {
      const res = await request(app)
        .get("/api/event-logs?subtype=AGENT")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      res.body.events.forEach((event) => {
        expect(event.subtype).toBe("AGENT");
      });
    });

    it("Filtre les événements par action", async () => {
      const res = await request(app)
        .get("/api/event-logs?action=CREATE")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      res.body.events.forEach((event) => {
        expect(event.action).toBe("CREATE");
      });
    });

    it("Filtre les événements par entityType", async () => {
      const res = await request(app)
        .get("/api/event-logs?entityType=User")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      res.body.events.forEach((event) => {
        expect(event.entityType).toBe("User");
      });
    });

    it("Filtre les événements par entityId", async () => {
      const res = await request(app)
        .get(`/api/event-logs?entityId=test-user-id-1`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.events.length).toBeGreaterThan(0);
      res.body.events.forEach((event) => {
        expect(event.entityId).toBe("test-user-id-1");
      });
    });

    it("Filtre les événements par date précise", async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get(`/api/event-logs?date=${today}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      // Les événements créés aujourd'hui devraient être inclus
      expect(res.body.events.length).toBeGreaterThan(0);
    });

    it("Filtre les événements par plage de dates", async () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/event-logs?dateFrom=${today}&dateTo=${tomorrowStr}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.events)).toBe(true);
    });

    it("Utilise la pagination correctement", async () => {
      const res = await request(app)
        .get("/api/event-logs?page=1&limit=2")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.events.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBeGreaterThan(0);
      expect(res.body.pagination.totalPages).toBeGreaterThan(0);
    });

    it("Trie les événements par ordre décroissant par défaut", async () => {
      const res = await request(app)
        .get("/api/event-logs")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      if (res.body.events.length > 1) {
        const dates = res.body.events.map(e => new Date(e.createdAt));
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i].getTime()).toBeGreaterThanOrEqual(dates[i + 1].getTime());
        }
      }
    });

    it("Trie les événements par ordre croissant avec sortOrder=asc", async () => {
      const res = await request(app)
        .get("/api/event-logs?sortOrder=asc")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      if (res.body.events.length > 1) {
        const dates = res.body.events.map(e => new Date(e.createdAt));
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i].getTime()).toBeLessThanOrEqual(dates[i + 1].getTime());
        }
      }
    });
  });

  describe("GET /api/event-logs/stats - Statistiques des événements", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/event-logs/stats");

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si l'utilisateur n'est pas NATIONAL ou SUPERADMIN", async () => {
      const res = await request(app)
        .get("/api/event-logs/stats")
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty("message", "Accès refusé");
    });

    it("Retourne les statistiques avec succès pour un utilisateur NATIONAL", async () => {
      const res = await request(app)
        .get("/api/event-logs/stats")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("stats");
      expect(Array.isArray(res.body.stats)).toBe(true);
      
      if (res.body.stats.length > 0) {
        const stat = res.body.stats[0];
        expect(stat).toHaveProperty("type");
        expect(stat).toHaveProperty("subtype");
        expect(stat).toHaveProperty("_count");
        expect(stat._count).toHaveProperty("id");
        expect(typeof stat._count.id).toBe("number");
      }
    });

    it("Retourne les statistiques avec succès pour un utilisateur SUPERADMIN", async () => {
      const res = await request(app)
        .get("/api/event-logs/stats")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("stats");
      expect(Array.isArray(res.body.stats)).toBe(true);
    });
  });

  describe("DELETE /api/event-logs/:id - Supprimer un événement", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .delete(`/api/event-logs/${eventLogId1}`);

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si l'utilisateur n'est pas NATIONAL ou SUPERADMIN", async () => {
      const res = await request(app)
        .delete(`/api/event-logs/${eventLogId1}`)
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty("message", "Accès refusé");
    });

    it("Retourne 404 si l'événement n'existe pas", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const res = await request(app)
        .delete(`/api/event-logs/${fakeId}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "Événement non trouvé");
    });

    it("Supprime un événement avec succès pour un utilisateur NATIONAL", async () => {
      // Vérifier que l'événement existe avant
      const beforeEvent = await prisma.eventLog.findUnique({
        where: { id: eventLogId1 },
      });
      expect(beforeEvent).not.toBeNull();

      const res = await request(app)
        .delete(`/api/event-logs/${eventLogId1}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("message", "Événement supprimé avec succès");

      // Vérifier que l'événement a été supprimé
      const afterEvent = await prisma.eventLog.findUnique({
        where: { id: eventLogId1 },
      });
      expect(afterEvent).toBeNull();
    });

    it("Supprime un événement avec succès pour un utilisateur SUPERADMIN", async () => {
      // Vérifier que l'événement existe avant
      const beforeEvent = await prisma.eventLog.findUnique({
        where: { id: eventLogId2 },
      });
      expect(beforeEvent).not.toBeNull();

      const res = await request(app)
        .delete(`/api/event-logs/${eventLogId2}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("message", "Événement supprimé avec succès");

      // Vérifier que l'événement a été supprimé
      const afterEvent = await prisma.eventLog.findUnique({
        where: { id: eventLogId2 },
      });
      expect(afterEvent).toBeNull();
    });
  });

  describe("DELETE /api/event-logs - Supprimer plusieurs événements", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .delete("/api/event-logs")
        .send({ ids: [eventLogId1, eventLogId2] });

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si l'utilisateur n'est pas NATIONAL ou SUPERADMIN", async () => {
      const res = await request(app)
        .delete("/api/event-logs")
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({ ids: [eventLogId1, eventLogId2] });

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty("message", "Accès refusé");
    });

    it("Retourne 400 si la liste d'IDs est invalide", async () => {
      const res = await request(app)
        .delete("/api/event-logs")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ ids: [] });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("message", "Liste d'IDs invalide");
    });

    it("Retourne 400 si ids n'est pas un tableau", async () => {
      const res = await request(app)
        .delete("/api/event-logs")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ ids: "not-an-array" });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("message", "Liste d'IDs invalide");
    });

    it("Supprime plusieurs événements avec succès pour un utilisateur NATIONAL", async () => {
      // Vérifier que les événements existent avant
      const beforeCount = await prisma.eventLog.count({
        where: {
          id: { in: [eventLogId1, eventLogId2] },
        },
      });
      expect(beforeCount).toBe(2);

      const res = await request(app)
        .delete("/api/event-logs")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ ids: [eventLogId1, eventLogId2] });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain("2 événement(s) supprimé(s)");

      // Vérifier que les événements ont été supprimés
      const afterCount = await prisma.eventLog.count({
        where: {
          id: { in: [eventLogId1, eventLogId2] },
        },
      });
      expect(afterCount).toBe(0);
    });

    it("Supprime plusieurs événements avec succès pour un utilisateur SUPERADMIN", async () => {
      // Créer des événements pour ce test directement avec Prisma
      const event1 = await prisma.eventLog.create({
        data: {
          type: "USER",
          subtype: "AGENT",
          action: "CREATE",
          userId: superadminUserId,
          userFirstName: "Superadmin",
          userLastName: "EventLog",
          userEmail: superadminEmail,
          userRole: "SUPERADMIN",
          entityType: "User",
          entityId: "test-user-id-3",
          entityName: "Test User 3",
        },
      });

      const event2 = await prisma.eventLog.create({
        data: {
          type: "ENTITY",
          subtype: "DISTRICT",
          action: "UPDATE",
          userId: superadminUserId,
          userFirstName: "Superadmin",
          userLastName: "EventLog",
          userEmail: superadminEmail,
          userRole: "SUPERADMIN",
          entityType: "District",
          entityId: "test-district-id-1",
          entityName: "Test District 1",
        },
      });

      const ids = [event1.id, event2.id];

      const res = await request(app)
        .delete("/api/event-logs")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ ids });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain(`${ids.length} événement(s) supprimé(s)`);

      // Vérifier que les événements ont été supprimés
      const afterCount = await prisma.eventLog.count({
        where: {
          id: { in: ids },
        },
      });
      expect(afterCount).toBe(0);
    });
  });
});
