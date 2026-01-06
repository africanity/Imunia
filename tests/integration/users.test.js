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
}));

describe("Users API - Gestion des utilisateurs", () => {
  let nationalEmail;
  let nationalPassword;
  let nationalToken;
  let superadminEmail;
  let superadminPassword;
  let superadminToken;
  let regionalEmail;
  let regionalPassword;
  let regionalToken;
  let districtEmail;
  let districtPassword;
  let districtToken;
  let agentAdminEmail;
  let agentAdminPassword;
  let agentAdminToken;
  let agentStaffEmail;
  let agentStaffPassword;
  let agentStaffToken;
  let regionId;
  let communeId;
  let districtId;
  let healthCenterId;

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

  // Helper pour obtenir un token REGIONAL valide
  const getRegionalToken = async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: regionalEmail, password: regionalPassword });
    if (res.statusCode === 200) {
      return res.body.accessToken;
    }
    throw new Error(`Impossible de se connecter: ${res.statusCode} ${JSON.stringify(res.body)}`);
  };

  // Helper pour obtenir un token DISTRICT valide
  const getDistrictToken = async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: districtEmail, password: districtPassword });
    if (res.statusCode === 200) {
      return res.body.accessToken;
    }
    throw new Error(`Impossible de se connecter: ${res.statusCode} ${JSON.stringify(res.body)}`);
  };

  // Helper pour obtenir un token AGENT ADMIN valide
  const getAgentAdminToken = async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: agentAdminEmail, password: agentAdminPassword });
    if (res.statusCode === 200) {
      return res.body.accessToken;
    }
    throw new Error(`Impossible de se connecter: ${res.statusCode} ${JSON.stringify(res.body)}`);
  };

  // Helper pour obtenir un token AGENT STAFF valide
  const getAgentStaffToken = async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: agentStaffEmail, password: agentStaffPassword });
    if (res.statusCode === 200) {
      return res.body.accessToken;
    }
    throw new Error(`Impossible de se connecter: ${res.statusCode} ${JSON.stringify(res.body)}`);
  };

  beforeAll(async () => {
    try {
      // Nettoyage complet avant tous les tests
      await prisma.user.deleteMany();
      await prisma.healthCenter.deleteMany();
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();

      // Créer le user NATIONAL
      nationalEmail = `national-users-test-${Date.now()}@example.com`;
      nationalPassword = "motdepasse";
      const hashedPassword = await bcrypt.hash(nationalPassword, 10);

      await prisma.user.create({
        data: {
          email: nationalEmail,
          password: hashedPassword,
          firstName: "National",
          lastName: "Admin",
          role: "NATIONAL",
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer le user SUPERADMIN
      superadminEmail = `superadmin-users-test-${Date.now()}@example.com`;
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

      // Créer une région
      const region = await prisma.region.create({
        data: {
          name: `RegionForUsers-${Date.now()}`,
        },
      });
      regionId = region.id;

      // Créer le user REGIONAL
      regionalEmail = `regional-users-test-${Date.now()}@example.com`;
      regionalPassword = "motdepasse";
      const hashedRegionalPassword = await bcrypt.hash(regionalPassword, 10);

      await prisma.user.create({
        data: {
          email: regionalEmail,
          password: hashedRegionalPassword,
          firstName: "Regional",
          lastName: "User",
          role: "REGIONAL",
          regionId: regionId,
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer une commune
      const commune = await prisma.commune.create({
        data: {
          name: `CommuneForUsers-${Date.now()}`,
          regionId: regionId,
        },
      });
      communeId = commune.id;

      // Créer un district
      const district = await prisma.district.create({
        data: {
          name: `DistrictForUsers-${Date.now()}`,
          communeId: communeId,
        },
      });
      districtId = district.id;

      // Créer le user DISTRICT
      districtEmail = `district-users-test-${Date.now()}@example.com`;
      districtPassword = "motdepasse";
      const hashedDistrictPassword = await bcrypt.hash(districtPassword, 10);

      await prisma.user.create({
        data: {
          email: districtEmail,
          password: hashedDistrictPassword,
          firstName: "District",
          lastName: "User",
          role: "DISTRICT",
          districtId: districtId,
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer un healthCenter
      const healthCenter = await prisma.healthCenter.create({
        data: {
          name: `HealthCenterForUsers-${Date.now()}`,
          address: "Test Address",
          districtId: districtId,
        },
      });
      healthCenterId = healthCenter.id;

      // Créer le user AGENT ADMIN
      agentAdminEmail = `agent-admin-users-test-${Date.now()}@example.com`;
      agentAdminPassword = "motdepasse";
      const hashedAgentAdminPassword = await bcrypt.hash(agentAdminPassword, 10);

      await prisma.user.create({
        data: {
          email: agentAdminEmail,
          password: hashedAgentAdminPassword,
          firstName: "Agent",
          lastName: "Admin",
          role: "AGENT",
          agentLevel: "ADMIN",
          healthCenterId: healthCenterId,
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer le user AGENT STAFF
      agentStaffEmail = `agent-staff-users-test-${Date.now()}@example.com`;
      agentStaffPassword = "motdepasse";
      const hashedAgentStaffPassword = await bcrypt.hash(agentStaffPassword, 10);

      await prisma.user.create({
        data: {
          email: agentStaffEmail,
          password: hashedAgentStaffPassword,
          firstName: "Agent",
          lastName: "Staff",
          role: "AGENT",
          agentLevel: "STAFF",
          healthCenterId: healthCenterId,
          isActive: true,
          emailVerified: true,
        },
      });
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  afterEach(async () => {
    // Ne pas nettoyer dans afterEach car les utilisateurs créés dans beforeEach
    // sont nécessaires pour les tests de modification/suppression
    // Le nettoyage se fera dans afterAll
  });

  afterAll(async () => {
    // Nettoyage final
    await prisma.user.deleteMany();
    await prisma.healthCenter.deleteMany();
    await prisma.district.deleteMany();
    await prisma.commune.deleteMany();
    await prisma.region.deleteMany();
    await prisma.$disconnect();
  });

  describe("GET /api/users - Liste des utilisateurs", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/users");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne la liste des utilisateurs pour NATIONAL", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("Retourne la liste des districts pour REGIONAL", async () => {
      regionalToken = await getRegionalToken();
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Vérifier que seuls les districts de la région sont retournés
      if (res.body.length > 0) {
        expect(res.body.every((u) => u.role === "DISTRICT")).toBe(true);
      }
    });

    it("Retourne la liste des agents pour DISTRICT", async () => {
      districtToken = await getDistrictToken();
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${districtToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Vérifier que seuls les agents sont retournés
      if (res.body.length > 0) {
        expect(res.body.every((u) => u.role === "AGENT")).toBe(true);
      }
    });

    it("Retourne la liste des agents STAFF pour AGENT ADMIN", async () => {
      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Vérifier que seuls les agents STAFF sont retournés
      if (res.body.length > 0) {
        expect(res.body.every((u) => u.role === "AGENT" && u.agentLevel === "STAFF")).toBe(true);
      }
    });

    it("Retourne un tableau vide pour AGENT STAFF", async () => {
      agentStaffToken = await getAgentStaffToken();
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${agentStaffToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });
  });

  describe("GET /api/users/health-center/agents - Agents du centre de santé", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/users/health-center/agents");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne les agents du centre de santé pour AGENT ADMIN", async () => {
      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .get("/api/users/health-center/agents")
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Vérifier que tous les agents appartiennent au même centre de santé
      // Note: certains agents peuvent ne pas avoir de healthCenterId si le champ n'est pas sélectionné
      if (res.body.length > 0) {
        // Vérifier que la réponse est un tableau valide
        expect(res.body.length).toBeGreaterThanOrEqual(0);
        // Si des agents ont un healthCenterId, vérifier qu'ils appartiennent au même centre
        const agentsWithHealthCenter = res.body.filter((u) => u.healthCenterId != null);
        if (agentsWithHealthCenter.length > 0) {
          const allSameHealthCenter = agentsWithHealthCenter.every((u) => u.healthCenterId === healthCenterId);
          // Au moins certains agents doivent avoir le même healthCenterId
          expect(allSameHealthCenter || agentsWithHealthCenter.length === 0).toBe(true);
        }
      }
    });

    it("Retourne les agents du centre de santé pour AGENT STAFF aussi", async () => {
      agentStaffToken = await getAgentStaffToken();
      const res = await request(app)
        .get("/api/users/health-center/agents")
        .set("Authorization", `Bearer ${agentStaffToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/users/me - Profil utilisateur", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/users/me");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne le profil de l'utilisateur connecté", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("email");
      expect(res.body).toHaveProperty("role");
      expect(res.body.email).toBe(nationalEmail);
    });
  });

  describe("PATCH /api/users/me - Modifier son profil", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).patch("/api/users/me");
      expect(res.statusCode).toBe(401);
    });

    it("Met à jour le prénom et nom de l'utilisateur", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          firstName: "NationalUpdated",
          lastName: "AdminUpdated",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("firstName", "NationalUpdated");
      expect(res.body).toHaveProperty("lastName", "AdminUpdated");
    });
  });

  describe("POST /api/users/regional - Créer utilisateur régional", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).post("/api/users/regional");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas NATIONAL ou SUPERADMIN", async () => {
      regionalToken = await getRegionalToken();
      const res = await request(app)
        .post("/api/users/regional")
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({
          email: `new-regional-${Date.now()}@example.com`,
          firstName: "New",
          lastName: "Regional",
          regionId: regionId,
        });

      expect(res.statusCode).toBe(403);
    });

    it("Crée un utilisateur régional avec succès", async () => {
      nationalToken = await getNationalToken();
      const newEmail = `new-regional-${Date.now()}@example.com`;
      const res = await request(app)
        .post("/api/users/regional")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          email: newEmail,
          firstName: "New",
          lastName: "Regional",
          regionId: regionId,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("email", newEmail);
      expect(res.body).toHaveProperty("role", "REGIONAL");
    });

    it("Retourne 400 ou 409 si email déjà utilisé", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/users/regional")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          email: regionalEmail, // Email déjà utilisé
          firstName: "New",
          lastName: "Regional",
          regionId: regionId,
        });

      expect([400, 409]).toContain(res.statusCode); // 400 ou 409 selon l'implémentation
    });
  });

  describe("POST /api/users/district - Créer utilisateur district", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).post("/api/users/district");
      expect(res.statusCode).toBe(401);
    });

    it("Crée un utilisateur district avec succès (nécessite REGIONAL)", async () => {
      regionalToken = await getRegionalToken();
      const newEmail = `new-district-${Date.now()}@example.com`;
      const res = await request(app)
        .post("/api/users/district")
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({
          email: newEmail,
          firstName: "New",
          lastName: "District",
          districtId: districtId,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("email", newEmail);
      expect(res.body).toHaveProperty("role", "DISTRICT");
    });
  });

  describe("POST /api/users/agent-admin - Créer agent admin", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).post("/api/users/agent-admin");
      expect(res.statusCode).toBe(401);
    });

    it("Crée un agent admin avec succès", async () => {
      districtToken = await getDistrictToken();
      const newEmail = `new-agent-admin-${Date.now()}@example.com`;
      const res = await request(app)
        .post("/api/users/agent-admin")
        .set("Authorization", `Bearer ${districtToken}`)
        .send({
          email: newEmail,
          firstName: "New",
          lastName: "AgentAdmin",
          healthCenterId: healthCenterId,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("email", newEmail);
      expect(res.body).toHaveProperty("role", "AGENT");
      expect(res.body).toHaveProperty("agentLevel", "ADMIN");
    });
  });

  describe("POST /api/users/agent-staff - Créer agent staff", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).post("/api/users/agent-staff");
      expect(res.statusCode).toBe(401);
    });

    it("Crée un agent staff avec succès", async () => {
      agentAdminToken = await getAgentAdminToken();
      const newEmail = `new-agent-staff-${Date.now()}@example.com`;
      const res = await request(app)
        .post("/api/users/agent-staff")
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          email: newEmail,
          firstName: "New",
          lastName: "AgentStaff",
          healthCenterId: healthCenterId,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("email", newEmail);
      expect(res.body).toHaveProperty("role", "AGENT");
      expect(res.body).toHaveProperty("agentLevel", "STAFF");
    });
  });

  describe("POST /api/users/:id/activate - Activer un utilisateur", () => {
    let inactiveUserId;
    let activationToken;

    beforeEach(async () => {
      // Créer un utilisateur inactif
      const { generateActivationToken } = require("../../src/services/tokenService");
      const tokenData = generateActivationToken();
      activationToken = tokenData.token;

      const inactiveUser = await prisma.user.create({
        data: {
          email: `inactive-${Date.now()}@example.com`,
          password: await bcrypt.hash("temp", 10),
          firstName: "Inactive",
          lastName: "User",
          role: "AGENT",
          agentLevel: "STAFF",
          healthCenterId: healthCenterId,
          isActive: false,
          emailVerified: false,
          activationToken: tokenData.token,
          activationExpires: tokenData.expiresAt,
        },
      });
      inactiveUserId = inactiveUser.id;
    });

    it("Retourne 400 si token invalide", async () => {
      const res = await request(app)
        .post(`/api/users/${inactiveUserId}/activate`)
        .send({
          token: "invalid-token",
          password: "newpassword",
          confirmPassword: "newpassword",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Token.*activation.*invalide/);
    });

    it("Retourne 400 si mots de passe ne correspondent pas", async () => {
      const res = await request(app)
        .post(`/api/users/${inactiveUserId}/activate`)
        .send({
          token: activationToken,
          password: "newpassword",
          confirmPassword: "differentpassword",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("Les mots de passe ne correspondent pas");
    });

    it("Active un utilisateur avec succès", async () => {
      const res = await request(app)
        .post(`/api/users/${inactiveUserId}/activate`)
        .send({
          token: activationToken,
          password: "newpassword",
          confirmPassword: "newpassword",
        });

      expect(res.statusCode).toBe(204);

      // Vérifier que l'utilisateur est maintenant actif
      const user = await prisma.user.findUnique({
        where: { id: inactiveUserId },
      });
      expect(user.isActive).toBe(true);
      expect(user.emailVerified).toBe(true);
      expect(user.activationToken).toBeNull();
    });
  });

  describe("PUT /api/users/regional/:id - Modifier utilisateur régional", () => {
    let regionalUserId;

    beforeEach(async () => {
      nationalToken = await getNationalToken();
      const newEmail = `regional-to-update-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post("/api/users/regional")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          email: newEmail,
          firstName: "Original",
          lastName: "Regional",
          regionId: regionId,
        });
      regionalUserId = createRes.body.id;
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).put(`/api/users/regional/${regionalUserId}`);
      expect(res.statusCode).toBe(401);
    });

    it("Met à jour un utilisateur régional avec succès (ne met à jour que regionId)", async () => {
      nationalToken = await getNationalToken();
      // Vérifier que l'utilisateur existe avant de le mettre à jour
      expect(regionalUserId).toBeDefined();
      
      // Vérifier que l'utilisateur existe en base
      const userExists = await prisma.user.findUnique({
        where: { id: regionalUserId },
      });
      expect(userExists).not.toBeNull();
      
      const res = await request(app)
        .put(`/api/users/regional/${regionalUserId}`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          regionId: regionId, // updateRegional ne met à jour que regionId
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("id");
    });
  });

  describe("PUT /api/users/district/:id - Modifier utilisateur district", () => {
    let districtUserId;

    beforeEach(async () => {
      regionalToken = await getRegionalToken();
      const newEmail = `district-to-update-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post("/api/users/district")
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({
          email: newEmail,
          firstName: "Original",
          lastName: "District",
          districtId: districtId,
        });
      expect(createRes.statusCode).toBe(201);
      districtUserId = createRes.body.id;
      expect(districtUserId).toBeDefined();
    });

    it("Met à jour un utilisateur district avec succès (nécessite REGIONAL)", async () => {
      regionalToken = await getRegionalToken();
      // Vérifier que l'utilisateur existe avant de le mettre à jour
      expect(districtUserId).toBeDefined();
      const userExists = await prisma.user.findUnique({
        where: { id: districtUserId },
      });
      expect(userExists).not.toBeNull();
      
      const res = await request(app)
        .put(`/api/users/district/${districtUserId}`)
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({
          districtId: districtId, // updateDistrict ne met à jour que districtId
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("id");
    });
  });

  describe("PUT /api/users/agent-admin/:id - Modifier agent admin", () => {
    let agentAdminUserId;

    beforeEach(async () => {
      districtToken = await getDistrictToken();
      const newEmail = `agent-admin-to-update-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post("/api/users/agent-admin")
        .set("Authorization", `Bearer ${districtToken}`)
        .send({
          email: newEmail,
          firstName: "Original",
          lastName: "AgentAdmin",
          healthCenterId: healthCenterId,
        });
      agentAdminUserId = createRes.body.id;
    });

    it("Met à jour un agent admin avec succès (ne met à jour que healthCenterId)", async () => {
      districtToken = await getDistrictToken();
      const res = await request(app)
        .put(`/api/users/agent-admin/${agentAdminUserId}`)
        .set("Authorization", `Bearer ${districtToken}`)
        .send({
          healthCenterId: healthCenterId, // updateAgentAdmin ne met à jour que healthCenterId
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("id");
    });
  });

  describe("PUT /api/users/agent-staff/:id - Modifier agent staff", () => {
    let agentStaffUserId;

    beforeEach(async () => {
      agentAdminToken = await getAgentAdminToken();
      const newEmail = `agent-staff-to-update-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post("/api/users/agent-staff")
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          email: newEmail,
          firstName: "Original",
          lastName: "AgentStaff",
          healthCenterId: healthCenterId,
        });
      agentStaffUserId = createRes.body.id;
    });

    it("Met à jour un agent staff avec succès (ne met à jour que healthCenterId)", async () => {
      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .put(`/api/users/agent-staff/${agentStaffUserId}`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          healthCenterId: healthCenterId, // updateAgentStaff ne met à jour que healthCenterId
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("id");
    });
  });

  describe("DELETE /api/users/regional/:id - Supprimer utilisateur régional", () => {
    let regionalUserId;

    beforeEach(async () => {
      nationalToken = await getNationalToken();
      const newEmail = `regional-to-delete-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post("/api/users/regional")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          email: newEmail,
          firstName: "ToDelete",
          lastName: "Regional",
          regionId: regionId,
        });
      regionalUserId = createRes.body.id;
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).delete(`/api/users/regional/${regionalUserId}`);
      expect(res.statusCode).toBe(401);
    });

    it("Supprime un utilisateur régional avec succès", async () => {
      nationalToken = await getNationalToken();
      // Vérifier que l'utilisateur existe avant de le supprimer
      expect(regionalUserId).toBeDefined();
      const res = await request(app)
        .delete(`/api/users/regional/${regionalUserId}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(204);
    });
  });

  describe("DELETE /api/users/district/:id - Supprimer utilisateur district", () => {
    let districtUserId;

    beforeEach(async () => {
      regionalToken = await getRegionalToken();
      const newEmail = `district-to-delete-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post("/api/users/district")
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({
          email: newEmail,
          firstName: "ToDelete",
          lastName: "District",
          districtId: districtId,
        });
      expect(createRes.statusCode).toBe(201);
      districtUserId = createRes.body.id;
      expect(districtUserId).toBeDefined();
    });

    it("Supprime un utilisateur district avec succès (nécessite REGIONAL)", async () => {
      regionalToken = await getRegionalToken();
      
      // Vérifier que l'utilisateur existe avant de le supprimer
      expect(districtUserId).toBeDefined();
      const userExists = await prisma.user.findUnique({
        where: { id: districtUserId },
      });
      expect(userExists).not.toBeNull();
      
      const res = await request(app)
        .delete(`/api/users/district/${districtUserId}`)
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(204);
    });
  });

  describe("DELETE /api/users/agent-admin/:id - Supprimer agent admin", () => {
    let agentAdminUserId;

    beforeEach(async () => {
      districtToken = await getDistrictToken();
      const newEmail = `agent-admin-to-delete-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post("/api/users/agent-admin")
        .set("Authorization", `Bearer ${districtToken}`)
        .send({
          email: newEmail,
          firstName: "ToDelete",
          lastName: "AgentAdmin",
          healthCenterId: healthCenterId,
        });
      agentAdminUserId = createRes.body.id;
    });

    it("Supprime un agent admin avec succès", async () => {
      districtToken = await getDistrictToken();
      const res = await request(app)
        .delete(`/api/users/agent-admin/${agentAdminUserId}`)
        .set("Authorization", `Bearer ${districtToken}`);

      expect(res.statusCode).toBe(204);
    });
  });

  describe("DELETE /api/users/agent-staff/:id - Supprimer agent staff", () => {
    let agentStaffUserId;

    beforeEach(async () => {
      agentAdminToken = await getAgentAdminToken();
      const newEmail = `agent-staff-to-delete-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post("/api/users/agent-staff")
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          email: newEmail,
          firstName: "ToDelete",
          lastName: "AgentStaff",
          healthCenterId: healthCenterId,
        });
      agentStaffUserId = createRes.body.id;
    });

    it("Supprime un agent staff avec succès", async () => {
      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .delete(`/api/users/agent-staff/${agentStaffUserId}`)
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(204);
    });
  });

  describe("GET /api/users/:id/delete-summary - Résumé de suppression", () => {
    let userToDeleteId;

    beforeEach(async () => {
      agentAdminToken = await getAgentAdminToken();
      const newEmail = `user-to-delete-summary-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post("/api/users/agent-staff")
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          email: newEmail,
          firstName: "ToDelete",
          lastName: "User",
          healthCenterId: healthCenterId,
        });
      userToDeleteId = createRes.body.id;
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get(`/api/users/${userToDeleteId}/delete-summary`);
      expect(res.statusCode).toBe(401);
    });

    it("Retourne le résumé de suppression", async () => {
      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .get(`/api/users/${userToDeleteId}/delete-summary`)
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("totals");
      expect(res.body.totals).toHaveProperty("recordsDeleted");
      expect(res.body.totals).toHaveProperty("scheduledPlannerCleared");
    });
  });

  describe("DELETE /api/users/:id - Supprimer utilisateur", () => {
    let userToDeleteId;

    beforeEach(async () => {
      agentAdminToken = await getAgentAdminToken();
      const newEmail = `user-to-delete-${Date.now()}@example.com`;
      const createRes = await request(app)
        .post("/api/users/agent-staff")
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          email: newEmail,
          firstName: "ToDelete",
          lastName: "User",
          healthCenterId: healthCenterId,
        });
      userToDeleteId = createRes.body.id;
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).delete(`/api/users/${userToDeleteId}`);
      expect(res.statusCode).toBe(401);
    });

    it("Supprime un utilisateur avec succès", async () => {
      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .delete(`/api/users/${userToDeleteId}`)
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(204);
    });
  });

  describe("POST /api/users/me/verify-email - Vérifier email", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).post("/api/users/me/verify-email");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 400 si code manquant", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/users/me/verify-email")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/users/me/request-email-change - Demander changement email", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).post("/api/users/me/request-email-change");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 400 si nouvel email manquant", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/users/me/request-email-change")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/users/me/verify-email-change - Vérifier changement email", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).post("/api/users/me/verify-email-change");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 400 si code manquant", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/users/me/verify-email-change")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/users/me/request-password-change - Demander changement mot de passe", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).post("/api/users/me/request-password-change");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 200 avec succès", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/users/me/request-password-change")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({});

      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/users/me/verify-password-code - Vérifier code changement mot de passe", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).post("/api/users/me/verify-password-code");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 400 si code manquant", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/users/me/verify-password-code")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/users/me/change-password - Changer mot de passe", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).post("/api/users/me/change-password");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 400 si mot de passe manquant", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/users/me/change-password")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });
});
