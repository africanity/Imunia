const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");

jest.mock('../../src/services/emailService', () => ({
  sendInvitationEmail: jest.fn().mockResolvedValue([]),
  sendTwoFactorCode: jest.fn().mockResolvedValue([]),
  sendPasswordResetCode: jest.fn().mockResolvedValue([]),
  sendSuperAdminEntityNotification: jest.fn().mockResolvedValue([]),
  sendSuperAdminUserNotification: jest.fn().mockResolvedValue([]),
  sendSuperAdminStockAdjustmentNotification: jest.fn().mockResolvedValue([]),
  sendSuperAdminSettingsNotification: jest.fn().mockResolvedValue([]),
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
}));

// Mock du middleware upload pour les tests de settings
jest.mock('../../src/middleware/upload', () => ({
  single: jest.fn(() => (req, res, next) => {
    // Ne pas définir req.file par défaut - le laisser undefined
    next();
  }),
}));

describe("Superadmin API - Gestion superadmin", () => {
  let superadminEmail;
  let superadminPassword;
  let superadminToken;
  let nationalEmail;
  let nationalPassword;
  let nationalToken;
  let regionId;
  let communeId;
  let districtId;
  let healthCenterId;

  // Helper pour obtenir un token SUPERADMIN valide
  const getSuperadminToken = async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: superadminEmail, password: superadminPassword });
    if (res.statusCode === 200) {
      return res.body.accessToken;
    }
    throw new Error(`Impossible de se connecter: ${res.statusCode} ${JSON.stringify(res.body)}`);
  };

  // Helper pour obtenir un token NATIONAL valide
  const getNationalToken = async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: nationalEmail, password: nationalPassword });
    if (res.statusCode === 200) {
      return res.body.accessToken;
    }
    throw new Error(`Impossible de se connecter: ${res.statusCode} ${JSON.stringify(res.body)}`);
  };

  beforeAll(async () => {
    try {
      // Nettoyage complet avant tous les tests
      await prisma.appSettings.deleteMany();
      await prisma.user.deleteMany();
      await prisma.healthCenter.deleteMany();
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();

      // Créer le user SUPERADMIN
      superadminEmail = `superadmin-test-${Date.now()}@example.com`;
      superadminPassword = "motdepasse";
      const hashedSuperadminPassword = await bcrypt.hash(superadminPassword, 10);

      await prisma.user.create({
        data: {
          email: superadminEmail,
          password: hashedSuperadminPassword,
          firstName: "Super",
          lastName: "Admin",
          role: "SUPERADMIN",
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer le user NATIONAL
      nationalEmail = `national-superadmin-test-${Date.now()}@example.com`;
      nationalPassword = "motdepasse";
      const hashedNationalPassword = await bcrypt.hash(nationalPassword, 10);

      await prisma.user.create({
        data: {
          email: nationalEmail,
          password: hashedNationalPassword,
          firstName: "National",
          lastName: "Admin",
          role: "NATIONAL",
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer une structure hiérarchique pour les tests
      const region = await prisma.region.create({
        data: {
          name: `RegionSuperadmin-${Date.now()}`,
        },
      });
      regionId = region.id;

      const commune = await prisma.commune.create({
        data: {
          name: `CommuneSuperadmin-${Date.now()}`,
          regionId: regionId,
        },
      });
      communeId = commune.id;

      const district = await prisma.district.create({
        data: {
          name: `DistrictSuperadmin-${Date.now()}`,
          communeId: communeId,
        },
      });
      districtId = district.id;

      const healthCenter = await prisma.healthCenter.create({
        data: {
          name: `HealthCenterSuperadmin-${Date.now()}`,
          address: "Adresse test",
          districtId: districtId,
        },
      });
      healthCenterId = healthCenter.id;
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  afterAll(async () => {
    // Nettoyage final
    await prisma.appSettings.deleteMany();
    await prisma.user.deleteMany();
    await prisma.healthCenter.deleteMany();
    await prisma.district.deleteMany();
    await prisma.commune.deleteMany();
    await prisma.region.deleteMany();
    await prisma.$disconnect();
  });

  describe("GET /api/superadmin/entities - Liste des entités", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/superadmin/entities");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas SUPERADMIN", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get("/api/superadmin/entities")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("superadmin");
    });

    it("Retourne la liste des entités pour SUPERADMIN", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get("/api/superadmin/entities")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("regions");
      expect(res.body).toHaveProperty("communes");
      expect(res.body).toHaveProperty("districts");
      expect(res.body).toHaveProperty("healthCenters");
      expect(Array.isArray(res.body.regions)).toBe(true);
      expect(Array.isArray(res.body.communes)).toBe(true);
      expect(Array.isArray(res.body.districts)).toBe(true);
      expect(Array.isArray(res.body.healthCenters)).toBe(true);
    });

    it("Filtre les entités par regionId", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get(`/api/superadmin/entities?regionId=${regionId}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.regions.length).toBeGreaterThan(0);
      expect(res.body.regions[0].id).toBe(regionId);
    });
  });

  describe("GET /api/superadmin/entities/:type/:id - Détails d'une entité", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get(`/api/superadmin/entities/region/${regionId}`);
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas SUPERADMIN", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get(`/api/superadmin/entities/region/${regionId}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 400 si type d'entité invalide", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get(`/api/superadmin/entities/invalid/${regionId}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 404 si entité introuvable", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get("/api/superadmin/entities/region/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it("Retourne les détails d'une région", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get(`/api/superadmin/entities/region/${regionId}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("id", regionId);
      expect(res.body).toHaveProperty("name");
      expect(res.body).toHaveProperty("communes");
    });

    it("Retourne les détails d'une commune", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get(`/api/superadmin/entities/commune/${communeId}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("id", communeId);
      expect(res.body).toHaveProperty("name");
      expect(res.body).toHaveProperty("region");
    });

    it("Retourne les détails d'un district", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get(`/api/superadmin/entities/district/${districtId}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("id", districtId);
      expect(res.body).toHaveProperty("name");
      expect(res.body).toHaveProperty("commune");
    });

    it("Retourne les détails d'un healthCenter", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get(`/api/superadmin/entities/healthcenter/${healthCenterId}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("id", healthCenterId);
      expect(res.body).toHaveProperty("name");
      expect(res.body).toHaveProperty("district");
    });
  });

  describe("PUT /api/superadmin/entities/:type/:id - Modifier une entité", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .put(`/api/superadmin/entities/region/${regionId}`)
        .send({ name: "Nouveau nom" });
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas SUPERADMIN", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .put(`/api/superadmin/entities/region/${regionId}`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ name: "Nouveau nom" });

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 400 si nom manquant", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .put(`/api/superadmin/entities/region/${regionId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it("Met à jour le nom d'une région avec succès", async () => {
      superadminToken = await getSuperadminToken();
      const newName = `RegionModifiee-${Date.now()}`;
      const res = await request(app)
        .put(`/api/superadmin/entities/region/${regionId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ name: newName });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("name", newName);
    });

    it("Met à jour le nom d'une commune avec succès", async () => {
      superadminToken = await getSuperadminToken();
      const newName = `CommuneModifiee-${Date.now()}`;
      const res = await request(app)
        .put(`/api/superadmin/entities/commune/${communeId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ name: newName });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("name", newName);
    });

    it("Met à jour le nom et l'adresse d'un healthCenter avec succès", async () => {
      superadminToken = await getSuperadminToken();
      const newName = `HealthCenterModifie-${Date.now()}`;
      const newAddress = "Nouvelle adresse";
      const res = await request(app)
        .put(`/api/superadmin/entities/healthcenter/${healthCenterId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ name: newName, address: newAddress });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("name", newName);
      expect(res.body).toHaveProperty("address", newAddress);
    });
  });

  describe("GET /api/superadmin/entities/:type/:id/delete-summary - Résumé de suppression", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get(`/api/superadmin/entities/region/${regionId}/delete-summary`);
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas SUPERADMIN", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get(`/api/superadmin/entities/region/${regionId}/delete-summary`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne le résumé de suppression d'une région", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get(`/api/superadmin/entities/region/${regionId}/delete-summary`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("region");
      expect(res.body).toHaveProperty("totals");
    });
  });

  describe("GET /api/superadmin/users - Liste des utilisateurs", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/superadmin/users");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas SUPERADMIN", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get("/api/superadmin/users")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne la liste des utilisateurs pour SUPERADMIN", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get("/api/superadmin/users")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("users");
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it("Filtre les utilisateurs par rôle", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get("/api/superadmin/users?role=NATIONAL")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.users.every(u => u.role === "NATIONAL")).toBe(true);
    });

    it("Filtre les utilisateurs par regionId", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get(`/api/superadmin/users?regionId=${regionId}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/superadmin/users/:id - Détails d'un utilisateur", () => {
    let testUserId;

    beforeEach(async () => {
      // Créer un utilisateur de test
      const user = await prisma.user.create({
        data: {
          email: `test-user-${Date.now()}@example.com`,
          password: await bcrypt.hash("password", 10),
          firstName: "Test",
          lastName: "User",
          role: "REGIONAL",
          regionId: regionId,
          isActive: true,
          emailVerified: true,
        },
      });
      testUserId = user.id;
    });

    afterEach(async () => {
      // Nettoyer l'utilisateur de test
      if (testUserId) {
        await prisma.user.deleteMany({
          where: { id: testUserId },
        });
      }
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get(`/api/superadmin/users/${testUserId}`);
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas SUPERADMIN", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get(`/api/superadmin/users/${testUserId}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 404 si utilisateur introuvable", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get("/api/superadmin/users/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it("Retourne les détails d'un utilisateur", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get(`/api/superadmin/users/${testUserId}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("id", testUserId);
      expect(res.body).toHaveProperty("firstName");
      expect(res.body).toHaveProperty("lastName");
      expect(res.body).toHaveProperty("email");
      expect(res.body).toHaveProperty("role");
    });
  });

  describe("POST /api/superadmin/users - Créer un utilisateur", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).post("/api/superadmin/users");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas SUPERADMIN", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/superadmin/users")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          role: "NATIONAL",
        });

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 400 si champs requis manquants", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .post("/api/superadmin/users")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Test",
          // lastName manquant
        });

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 400 si rôle invalide", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .post("/api/superadmin/users")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Test",
          lastName: "User",
          email: `test-${Date.now()}@example.com`,
          role: "INVALID_ROLE",
        });

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 400 si email déjà utilisé", async () => {
      superadminToken = await getSuperadminToken();
      const email = `duplicate-${Date.now()}@example.com`;

      // Créer le premier utilisateur
      await request(app)
        .post("/api/superadmin/users")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "First",
          lastName: "User",
          email,
          role: "NATIONAL",
        });

      // Essayer de créer un deuxième avec le même email
      const res = await request(app)
        .post("/api/superadmin/users")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Second",
          lastName: "User",
          email,
          role: "NATIONAL",
        });

      expect(res.statusCode).toBe(400);
    });

    it("Crée un utilisateur NATIONAL avec succès", async () => {
      superadminToken = await getSuperadminToken();
      const email = `national-${Date.now()}@example.com`;
      const res = await request(app)
        .post("/api/superadmin/users")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "National",
          lastName: "User",
          email,
          role: "NATIONAL",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("user");
      expect(res.body.user).toHaveProperty("id");
      expect(res.body.user).toHaveProperty("email", email);
      expect(res.body.user).toHaveProperty("role", "NATIONAL");
      expect(res.body.user).toHaveProperty("isActive", false); // Créé inactif

      // Nettoyer
      await prisma.user.delete({ where: { id: res.body.user.id } });
    });

    it("Crée un utilisateur REGIONAL avec région", async () => {
      superadminToken = await getSuperadminToken();
      const email = `regional-${Date.now()}@example.com`;
      const res = await request(app)
        .post("/api/superadmin/users")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Regional",
          lastName: "User",
          email,
          role: "REGIONAL",
          regionId: regionId,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.user).toHaveProperty("role", "REGIONAL");

      // Nettoyer
      await prisma.user.delete({ where: { id: res.body.user.id } });
    });

    it("Retourne 400 si REGIONAL sans regionId", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .post("/api/superadmin/users")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Regional",
          lastName: "User",
          email: `regional-${Date.now()}@example.com`,
          role: "REGIONAL",
          // regionId manquant
        });

      expect(res.statusCode).toBe(400);
    });

    it("Crée un utilisateur AGENT avec healthCenterId et agentLevel", async () => {
      superadminToken = await getSuperadminToken();
      const email = `agent-${Date.now()}@example.com`;
      const res = await request(app)
        .post("/api/superadmin/users")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          firstName: "Agent",
          lastName: "User",
          email,
          role: "AGENT",
          healthCenterId: healthCenterId,
          agentLevel: "ADMIN",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.user).toHaveProperty("role", "AGENT");

      // Nettoyer
      await prisma.user.delete({ where: { id: res.body.user.id } });
    });
  });

  describe("PUT /api/superadmin/users/:id - Modifier un utilisateur", () => {
    let testUserId;

    beforeEach(async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-update-${Date.now()}@example.com`,
          password: await bcrypt.hash("password", 10),
          firstName: "Test",
          lastName: "User",
          role: "NATIONAL",
          isActive: true,
          emailVerified: true,
        },
      });
      testUserId = user.id;
    });

    afterEach(async () => {
      if (testUserId) {
        await prisma.user.deleteMany({ where: { id: testUserId } });
      }
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .put(`/api/superadmin/users/${testUserId}`)
        .send({ firstName: "Updated" });
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas SUPERADMIN", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .put(`/api/superadmin/users/${testUserId}`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ firstName: "Updated" });

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 404 si utilisateur introuvable", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .put("/api/superadmin/users/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ firstName: "Updated" });

      expect(res.statusCode).toBe(404);
    });

    it("Met à jour le prénom avec succès", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .put(`/api/superadmin/users/${testUserId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ firstName: "UpdatedFirstName" });

      expect(res.statusCode).toBe(200);
      expect(res.body.user).toHaveProperty("firstName", "UpdatedFirstName");
    });

    it("Met à jour le statut actif/inactif", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .put(`/api/superadmin/users/${testUserId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ isActive: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.user).toHaveProperty("isActive", false);
    });

    it("Retourne 400 si email déjà utilisé par un autre utilisateur", async () => {
      // Créer un autre utilisateur
      const otherUser = await prisma.user.create({
        data: {
          email: `other-${Date.now()}@example.com`,
          password: await bcrypt.hash("password", 10),
          firstName: "Other",
          lastName: "User",
          role: "NATIONAL",
          isActive: true,
          emailVerified: true,
        },
      });

      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .put(`/api/superadmin/users/${testUserId}`)
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ email: otherUser.email });

      expect(res.statusCode).toBe(400);

      // Nettoyer
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe("GET /api/superadmin/users/:id/delete-summary - Résumé de suppression utilisateur", () => {
    let testUserId;

    beforeEach(async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-delete-${Date.now()}@example.com`,
          password: await bcrypt.hash("password", 10),
          firstName: "Test",
          lastName: "User",
          role: "NATIONAL",
          isActive: true,
          emailVerified: true,
        },
      });
      testUserId = user.id;
    });

    afterEach(async () => {
      if (testUserId) {
        await prisma.user.deleteMany({ where: { id: testUserId } });
      }
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get(`/api/superadmin/users/${testUserId}/delete-summary`);
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas SUPERADMIN", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get(`/api/superadmin/users/${testUserId}/delete-summary`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne le résumé de suppression", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get(`/api/superadmin/users/${testUserId}/delete-summary`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("totals");
      expect(res.body).toHaveProperty("details");
    });
  });

  describe("DELETE /api/superadmin/users/:id - Supprimer un utilisateur", () => {
    let testUserId;

    beforeEach(async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-delete-${Date.now()}@example.com`,
          password: await bcrypt.hash("password", 10),
          firstName: "Test",
          lastName: "User",
          role: "NATIONAL",
          isActive: true,
          emailVerified: true,
        },
      });
      testUserId = user.id;
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).delete(`/api/superadmin/users/${testUserId}`);
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas SUPERADMIN", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .delete(`/api/superadmin/users/${testUserId}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 404 si utilisateur introuvable", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .delete("/api/superadmin/users/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(404);
    });

    it("Retourne 400 si tentative de suppression de soi-même", async () => {
      superadminToken = await getSuperadminToken();
      const superadminUser = await prisma.user.findUnique({
        where: { email: superadminEmail },
      });

      const res = await request(app)
        .delete(`/api/superadmin/users/${superadminUser.id}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("propre compte");
    });

    it("Supprime un utilisateur avec succès", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .delete(`/api/superadmin/users/${testUserId}`)
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("message");

      // Vérifier que l'utilisateur est supprimé
      const deletedUser = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      expect(deletedUser).toBeNull();
    });
  });

  describe("GET /api/superadmin/settings - Récupérer les paramètres", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/superadmin/settings");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas SUPERADMIN", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get("/api/superadmin/settings")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne les paramètres par défaut si aucun paramètre n'existe", async () => {
      // S'assurer qu'il n'y a pas de paramètres
      await prisma.appSettings.deleteMany();

      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get("/api/superadmin/settings")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("appName", "Imunia");
      expect(res.body).toHaveProperty("logoPath", "/logo.png");
      expect(res.body).toHaveProperty("hasCustomName", false);
      expect(res.body).toHaveProperty("hasCustomLogo", false);
    });

    it("Retourne les paramètres existants", async () => {
      // Créer des paramètres de test
      await prisma.appSettings.deleteMany();
      await prisma.appSettings.create({
        data: {
          appName: "Test App",
          logoPath: "/uploads/test-logo.png",
        },
      });

      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get("/api/superadmin/settings")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("appName", "Test App");
      expect(res.body).toHaveProperty("logoPath", "/uploads/test-logo.png");
      expect(res.body).toHaveProperty("hasCustomName", true);
      expect(res.body).toHaveProperty("hasCustomLogo", true);
    });
  });

  describe("PUT /api/superadmin/settings - Modifier les paramètres", () => {
    beforeEach(async () => {
      // Nettoyer les paramètres avant chaque test
      await prisma.appSettings.deleteMany();
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .put("/api/superadmin/settings")
        .send({ appName: "New App" });
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas SUPERADMIN", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .put("/api/superadmin/settings")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ appName: "New App" });

      expect(res.statusCode).toBe(403);
    });

    it("Met à jour le nom de l'application avec succès", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .put("/api/superadmin/settings")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ appName: "Nouvelle App" });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("appName", "Nouvelle App");
      expect(res.body).toHaveProperty("hasCustomName", true);
    });

    it("Crée les paramètres s'ils n'existent pas", async () => {
      await prisma.appSettings.deleteMany();

      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .put("/api/superadmin/settings")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ appName: "New App" });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("appName", "New App");

      // Vérifier que les paramètres ont été créés
      const settings = await prisma.appSettings.findFirst();
      expect(settings).not.toBeNull();
      expect(settings.appName).toBe("New App");
    });

    it("Supprime le logo si logoPath est vide string", async () => {
      // Créer des paramètres avec un logo
      await prisma.appSettings.create({
        data: {
          appName: "Test App",
          logoPath: "/uploads/test-logo.png",
        },
      });

      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .put("/api/superadmin/settings")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({ logoPath: "" });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("hasCustomLogo", false);
    });
  });
});
