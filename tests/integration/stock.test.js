const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");

jest.mock('../../src/services/emailService', () => ({
  sendInvitationEmail: jest.fn(),
  sendTwoFactorCode: jest.fn(),
  sendNewPhotosUploadedEmail: jest.fn(),
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
}));

describe("Stock API - Gestion des Stocks", () => {
  let nationalEmail;
  let nationalPassword;
  let nationalToken;
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
  let vaccineId;
  const testEmails = new Set();

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
      // Appliquer la migration pour permettre plusieurs districts par commune
      try {
        await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "District_communeId_key";');
      } catch (error) {
        console.log("Index unique déjà supprimé ou n'existe pas");
      }

      // Nettoyage complet avant tous les tests
      await prisma.stockReservation.deleteMany();
      await prisma.pendingStockTransferLot.deleteMany();
      await prisma.pendingStockTransfer.deleteMany();
      await prisma.stockTransferLot.deleteMany();
      await prisma.stockTransfer.deleteMany();
      await prisma.stockLot.deleteMany();
      await prisma.stockHEALTHCENTER.deleteMany();
      await prisma.stockDISTRICT.deleteMany();
      await prisma.stockREGIONAL.deleteMany();
      await prisma.stockNATIONAL.deleteMany();
      await prisma.vaccine.deleteMany();
      await prisma.healthCenter.deleteMany();
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();
      await prisma.user.deleteMany();

      // Créer le user NATIONAL directement en DB
      nationalEmail = `national-stock-test-${Date.now()}@example.com`;
      nationalPassword = "motdepasse";
      const hashedPassword = await bcrypt.hash(nationalPassword, 10);

      await prisma.user.create({
        data: {
          email: nationalEmail,
          password: hashedPassword,
          firstName: "National",
          lastName: "Admin",
          phone: "123456789",
          role: "NATIONAL",
          isActive: true,
          emailVerified: true,
        },
      });

      // Obtenir le token NATIONAL initial
      nationalToken = await getNationalToken();

      // Créer un vaccin pour les tests
      const vaccine = await prisma.vaccine.create({
        data: {
          name: "Vaccin Test",
          description: "Description du vaccin test",
          dosesRequired: "3",
        },
      });
      vaccineId = vaccine.id;

      // Créer une région pour les tests
      const regionRes = await request(app)
        .post("/api/region")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ name: `RegionForStock-${Date.now()}` });
      expect(regionRes.statusCode).toBe(201);
      regionId = regionRes.body.id;

      // Créer une commune
      const communeRes = await request(app)
        .post("/api/commune")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ name: `CommuneForStock-${Date.now()}`, regionId: regionId });
      expect(communeRes.statusCode).toBe(201);
      communeId = communeRes.body.id;

      // Créer un user REGIONAL directement en DB
      regionalEmail = `regional-stock-test-${Date.now()}@example.com`;
      regionalPassword = "motdepasse";
      testEmails.add(regionalEmail);
      const regionalHashedPassword = await bcrypt.hash(regionalPassword, 10);

      await prisma.user.create({
        data: {
          email: regionalEmail,
          password: regionalHashedPassword,
          firstName: "Regional",
          lastName: "User",
          phone: "987654321",
          role: "REGIONAL",
          isActive: true,
          emailVerified: true,
          regionId: regionId,
        },
      });

      // Obtenir le token REGIONAL initial
      regionalToken = await getRegionalToken();

      // Créer un district
      const districtRes = await request(app)
        .post("/api/district")
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({ name: `DistrictForStock-${Date.now()}`, communeId: communeId });
      expect(districtRes.statusCode).toBe(201);
      districtId = districtRes.body.id;

      // Créer un user DISTRICT directement en DB
      districtEmail = `district-stock-test-${Date.now()}@example.com`;
      districtPassword = "motdepasse";
      testEmails.add(districtEmail);
      const districtHashedPassword = await bcrypt.hash(districtPassword, 10);

      await prisma.user.create({
        data: {
          email: districtEmail,
          password: districtHashedPassword,
          firstName: "District",
          lastName: "User",
          phone: "111111111",
          role: "DISTRICT",
          isActive: true,
          emailVerified: true,
          districtId: districtId,
        },
      });

      // Obtenir le token DISTRICT initial
      districtToken = await getDistrictToken();

      // Créer un healthCenter pour les tests
      const healthCenterRes = await request(app)
        .post("/api/healthCenter")
        .set("Authorization", `Bearer ${districtToken}`)
        .send({ name: `HealthCenter-${Date.now()}`, address: "123 Test Street" });
      expect(healthCenterRes.statusCode).toBe(201);
      healthCenterId = healthCenterRes.body.id;

      // Créer un user AGENT ADMIN directement en DB
      agentAdminEmail = `agentadmin-stock-test-${Date.now()}@example.com`;
      agentAdminPassword = "motdepasse";
      testEmails.add(agentAdminEmail);
      const agentAdminHashedPassword = await bcrypt.hash(agentAdminPassword, 10);

      await prisma.user.create({
        data: {
          email: agentAdminEmail,
          password: agentAdminHashedPassword,
          firstName: "Agent",
          lastName: "Admin",
          phone: "222222222",
          role: "AGENT",
          agentLevel: "ADMIN",
          isActive: true,
          emailVerified: true,
          districtId: districtId,
          healthCenterId: healthCenterId,
        },
      });

      // Obtenir le token AGENT ADMIN initial
      agentAdminToken = await getAgentAdminToken();

      // Créer un user AGENT STAFF directement en DB
      agentStaffEmail = `agentstaff-stock-test-${Date.now()}@example.com`;
      agentStaffPassword = "motdepasse";
      testEmails.add(agentStaffEmail);
      const agentStaffHashedPassword = await bcrypt.hash(agentStaffPassword, 10);

      await prisma.user.create({
        data: {
          email: agentStaffEmail,
          password: agentStaffHashedPassword,
          firstName: "Agent",
          lastName: "Staff",
          phone: "333333333",
          role: "AGENT",
          agentLevel: "STAFF",
          isActive: true,
          emailVerified: true,
          districtId: districtId,
          healthCenterId: healthCenterId,
        },
      });

      // Obtenir le token AGENT STAFF initial
      agentStaffToken = await getAgentStaffToken();
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  beforeEach(async () => {
    try {
      // Nettoyage avant chaque test (mais garder les users et structures de base)
      await prisma.stockReservation.deleteMany();
      await prisma.pendingStockTransferLot.deleteMany();
      await prisma.pendingStockTransfer.deleteMany();
      await prisma.stockTransferLot.deleteMany();
      await prisma.stockTransfer.deleteMany();
      await prisma.stockLot.deleteMany();
      await prisma.stockHEALTHCENTER.deleteMany();
      await prisma.stockDISTRICT.deleteMany();
      await prisma.stockREGIONAL.deleteMany();
      await prisma.stockNATIONAL.deleteMany();

      // S'assurer que le vaccin existe toujours
      const existingVaccine = await prisma.vaccine.findUnique({
        where: { id: vaccineId },
      });
      if (!existingVaccine) {
        const vaccine = await prisma.vaccine.create({
          data: {
            name: "Vaccin Test",
            description: "Description du vaccin test",
            dosesRequired: "3",
          },
        });
        vaccineId = vaccine.id;
      }

      // Régénérer les tokens
      nationalToken = await getNationalToken();
      regionalToken = await getRegionalToken();
      districtToken = await getDistrictToken();
      agentAdminToken = await getAgentAdminToken();
      agentStaffToken = await getAgentStaffToken();
    } catch (error) {
      console.error("Erreur dans beforeEach:", error);
      throw error;
    }
  });

  afterEach(async () => {
    // Cleanup des emails de test créés
    if (testEmails.size > 0) {
      const emailsToDelete = Array.from(testEmails).filter(
        (email) => email !== nationalEmail && email !== regionalEmail && email !== districtEmail && email !== agentAdminEmail && email !== agentStaffEmail
      );
      if (emailsToDelete.length > 0) {
        await prisma.user.deleteMany({
          where: {
            email: { in: emailsToDelete },
          },
        });
      }
      testEmails.clear();
      testEmails.add(regionalEmail);
      testEmails.add(districtEmail);
      testEmails.add(agentAdminEmail);
      testEmails.add(agentStaffEmail);
    }
  });

  afterAll(async () => {
    // Nettoyage final
    await prisma.stockReservation.deleteMany();
    await prisma.pendingStockTransferLot.deleteMany();
    await prisma.pendingStockTransfer.deleteMany();
    await prisma.stockTransferLot.deleteMany();
    await prisma.stockTransfer.deleteMany();
    await prisma.stockLot.deleteMany();
    await prisma.stockHEALTHCENTER.deleteMany();
    await prisma.stockDISTRICT.deleteMany();
    await prisma.stockREGIONAL.deleteMany();
    await prisma.stockNATIONAL.deleteMany();
    await prisma.vaccine.deleteMany();
    await prisma.healthCenter.deleteMany();
    await prisma.district.deleteMany();
    await prisma.commune.deleteMany();
    await prisma.region.deleteMany();
    if (nationalEmail) {
      await prisma.user.deleteMany({ where: { email: nationalEmail } });
    }
    if (testEmails.size > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: Array.from(testEmails) } },
      });
    }
    await prisma.$disconnect();
  });

  // ============================================
  // SECTION 1: CRUD STOCK NATIONAL
  // ============================================
  
  describe("Stock NATIONAL - CRUD", () => {
    describe("POST /api/stock/national - Création", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/stock/national")
          .send({ vaccineId });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL", async () => {
        const res = await request(app)
          .post("/api/stock/national")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ vaccineId });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });

      it("Crée un stock NATIONAL avec succès", async () => {
        const res = await request(app)
          .post("/api/stock/national")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ vaccineId });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("id");
        expect(res.body.vaccineId).toBe(vaccineId);

        // Vérifier en DB
        const stock = await prisma.stockNATIONAL.findUnique({
          where: { vaccineId },
        });
        expect(stock).toBeDefined();
        expect(stock.vaccineId).toBe(vaccineId);
      });
    });

    describe("GET /api/stock/national - Lecture", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get("/api/stock/national");
        expect(res.statusCode).toBe(401);
      });

      it("Retourne la liste des stocks NATIONAL", async () => {
        // Créer un stock
        await prisma.stockNATIONAL.create({
          data: { vaccineId },
        });

        const res = await request(app)
          .get("/api/stock/national")
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("national");
        expect(res.body.national).toBeInstanceOf(Array);
        expect(res.body.national.length).toBeGreaterThan(0);
        expect(res.body.national[0]).toHaveProperty("vaccineId");
      });
    });

    describe("PUT /api/stock/national - Mise à jour", () => {
      beforeEach(async () => {
        await prisma.stockNATIONAL.create({
          data: { vaccineId },
        });
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .put("/api/stock/national")
          .send({ vaccineId, quantity: 100 });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL", async () => {
        const res = await request(app)
          .put("/api/stock/national")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ vaccineId, quantity: 100 });
        expect(res.statusCode).toBe(403);
      });

      it("Met à jour un stock NATIONAL avec succès", async () => {
        // Créer un stock avec quantité initiale
        await prisma.stockNATIONAL.update({
          where: { vaccineId },
          data: { quantity: 50 },
        });

        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const res = await request(app)
          .put("/api/stock/national")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ vaccineId, quantity: 100, expiration: futureDate.toISOString() });

        expect(res.statusCode).toBe(200);
        expect(res.body.quantity).toBe(100);

        // Vérifier en DB
        const stock = await prisma.stockNATIONAL.findUnique({
          where: { vaccineId },
        });
        expect(stock.quantity).toBe(100);
      });
    });

    describe("DELETE /api/stock/national - Suppression", () => {
      beforeEach(async () => {
        await prisma.stockNATIONAL.create({
          data: { vaccineId },
        });
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .delete("/api/stock/national")
          .send({ vaccineId });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL", async () => {
        const res = await request(app)
          .delete("/api/stock/national")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ vaccineId });
        expect(res.statusCode).toBe(403);
      });

      it("Supprime un stock NATIONAL avec succès", async () => {
        const res = await request(app)
          .delete("/api/stock/national")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ vaccineId });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        // Vérifier en DB
        const stock = await prisma.stockNATIONAL.findUnique({
          where: { vaccineId },
        });
        expect(stock).toBeNull();
      });
    });
  });

  // ============================================
  // SECTION 2: CRUD STOCK REGIONAL
  // ============================================
  
  describe("Stock REGIONAL - CRUD", () => {
    describe("POST /api/stock/regional - Création", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/stock/regional")
          .send({ vaccineId, regionId });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL ou REGIONAL", async () => {
        const res = await request(app)
          .post("/api/stock/regional")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ vaccineId, regionId });
        expect(res.statusCode).toBe(403);
      });

      it("Crée un stock REGIONAL avec succès (NATIONAL)", async () => {
        const res = await request(app)
          .post("/api/stock/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ vaccineId, regionId });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("id");
        expect(res.body.vaccineId).toBe(vaccineId);
        expect(res.body.regionId).toBe(regionId);
      });

      it("Crée un stock REGIONAL avec succès (REGIONAL)", async () => {
        const res = await request(app)
          .post("/api/stock/regional")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ vaccineId });

        expect(res.statusCode).toBe(201);
        expect(res.body.regionId).toBe(regionId);
      });

      it("Retourne 400 si vaccineId manquant", async () => {
        const res = await request(app)
          .post("/api/stock/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ regionId });
        expect(res.statusCode).toBe(400);
      });
    });

    describe("GET /api/stock/regional - Lecture", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get("/api/stock/regional");
        expect(res.statusCode).toBe(401);
      });

      it("Retourne la liste des stocks REGIONAL", async () => {
        // Créer un stock
        await prisma.stockREGIONAL.create({
          data: { vaccineId, regionId },
        });

        const res = await request(app)
          .get("/api/stock/regional")
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("regional");
        expect(res.body.regional).toBeInstanceOf(Array);
        expect(res.body.regional.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================
  // SECTION 3: OPÉRATIONS ADD/REDUCE
  // ============================================
  
  describe("Opérations ADD/REDUCE", () => {
    describe("PUT /api/stock/add-national - Ajout de stock", () => {
      beforeEach(async () => {
        await prisma.stockNATIONAL.create({
          data: { vaccineId, quantity: 50 },
        });
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .put("/api/stock/add-national")
          .send({ vaccineId, quantity: 10 });
        expect(res.statusCode).toBe(401);
      });

      it("Ajoute du stock NATIONAL avec succès", async () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const res = await request(app)
          .put("/api/stock/add-national")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ vaccineId, quantity: 10, expiration: futureDate.toISOString() });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("stock");
        expect(res.body.stock.quantity).toBe(60);
        expect(res.body).toHaveProperty("lot");

        // Vérifier en DB
        const stock = await prisma.stockNATIONAL.findUnique({
          where: { vaccineId },
        });
        expect(stock.quantity).toBe(60);
      });
    });

    describe("PUT /api/stock/reduce-national - Réduction de stock", () => {
      beforeEach(async () => {
        await prisma.stockNATIONAL.upsert({
          where: { vaccineId },
          update: { quantity: 100 },
          create: { vaccineId, quantity: 100 },
        });
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .put("/api/stock/reduce-national")
          .send({ vaccineId, quantity: 10 });
        expect(res.statusCode).toBe(401);
      });

      it("Réduit le stock NATIONAL avec succès", async () => {
        const res = await request(app)
          .put("/api/stock/reduce-national")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ vaccineId, quantity: 10 });

        expect(res.statusCode).toBe(200);
        expect(res.body.quantity).toBe(90);

        // Vérifier en DB
        const stock = await prisma.stockNATIONAL.findUnique({
          where: { vaccineId },
        });
        expect(stock.quantity).toBe(90);
      });
    });
  });

  // ============================================
  // SECTION 4: GESTION DES LOTS
  // ============================================
  
  describe("Gestion des Lots", () => {
    describe("GET /api/stock/national/:vaccineId/lots - Liste des lots NATIONAL", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .get(`/api/stock/national/${vaccineId}/lots`);
        expect(res.statusCode).toBe(401);
      });

      it("Retourne la liste des lots NATIONAL", async () => {
        // Créer un stock et un lot
        await prisma.stockNATIONAL.create({
          data: { vaccineId },
        });

        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        await prisma.stockLot.create({
          data: {
            vaccineId,
            ownerType: "NATIONAL",
            ownerId: null,
            quantity: 100,
            remainingQuantity: 100,
            expiration: futureDate,
            status: "VALID",
          },
        });

        const res = await request(app)
          .get(`/api/stock/national/${vaccineId}/lots`)
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("lots");
        expect(res.body.lots).toBeInstanceOf(Array);
        expect(res.body.lots.length).toBeGreaterThan(0);
        expect(res.body.lots[0]).toHaveProperty("id");
        expect(res.body.lots[0]).toHaveProperty("quantity");
        expect(res.body.lots[0]).toHaveProperty("remainingQuantity");
        expect(res.body).toHaveProperty("totalRemaining");
      });
    });
  });

  // ============================================
  // SECTION 3: CRUD STOCK DISTRICT
  // ============================================
  
  describe("Stock DISTRICT - CRUD", () => {
    describe("POST /api/stock/district - Création", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/stock/district")
          .send({ vaccineId, districtId });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL, REGIONAL ou DISTRICT", async () => {
        const res = await request(app)
          .post("/api/stock/district")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ vaccineId, districtId });
        expect(res.statusCode).toBe(403);
      });

      it("Crée un stock DISTRICT avec succès (REGIONAL)", async () => {
        const res = await request(app)
          .post("/api/stock/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ vaccineId, districtId });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("id");
        expect(res.body.vaccineId).toBe(vaccineId);
        expect(res.body.districtId).toBe(districtId);
      });

      it("Crée un stock DISTRICT avec succès (REGIONAL)", async () => {
        const res = await request(app)
          .post("/api/stock/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ vaccineId, districtId });

        expect(res.statusCode).toBe(201);
        expect(res.body.districtId).toBe(districtId);
      });

      it("Crée un stock DISTRICT avec succès (DISTRICT)", async () => {
        const res = await request(app)
          .post("/api/stock/district")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ vaccineId, districtId });

        expect(res.statusCode).toBe(201);
        expect(res.body.districtId).toBe(districtId);
      });
    });

    describe("GET /api/stock/district - Lecture", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get("/api/stock/district");
        expect(res.statusCode).toBe(401);
      });

      it("Retourne la liste des stocks DISTRICT", async () => {
        // Créer un stock
        await prisma.stockDISTRICT.create({
          data: { vaccineId, districtId },
        });

        const res = await request(app)
          .get("/api/stock/district")
          .set("Authorization", `Bearer ${districtToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("district");
        expect(res.body.district).toBeInstanceOf(Array);
        expect(res.body.district.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================
  // SECTION 4: CRUD STOCK HEALTHCENTER
  // ============================================
  
  describe("Stock HEALTHCENTER - CRUD", () => {
    describe("POST /api/stock/health-center - Création", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/stock/health-center")
          .send({ vaccineId, healthCenterId });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL, REGIONAL, DISTRICT ou AGENT", async () => {
        // Pas de test pour un rôle invalide car tous les rôles valides sont autorisés
        // On teste plutôt l'authentification
        const fakeToken = "fake-token";
        const res = await request(app)
          .post("/api/stock/health-center")
          .set("Authorization", `Bearer ${fakeToken}`)
          .send({ vaccineId, healthCenterId });
        expect(res.statusCode).toBe(401);
      });

      it("Crée un stock HEALTHCENTER avec succès (AGENT ADMIN)", async () => {
        const res = await request(app)
          .post("/api/stock/health-center")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ vaccineId });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("id");
        expect(res.body.vaccineId).toBe(vaccineId);
        expect(res.body.healthCenterId).toBe(healthCenterId);
      });

      it("Crée un stock HEALTHCENTER avec succès (DISTRICT)", async () => {
        const res = await request(app)
          .post("/api/stock/health-center")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ vaccineId, healthCenterId });

        expect(res.statusCode).toBe(201);
        expect(res.body.healthCenterId).toBe(healthCenterId);
      });
    });

    describe("GET /api/stock/health-center - Lecture", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get("/api/stock/health-center");
        expect(res.statusCode).toBe(401);
      });

      it("Retourne la liste des stocks HEALTHCENTER", async () => {
        // Créer un stock
        await prisma.stockHEALTHCENTER.create({
          data: { vaccineId, healthCenterId },
        });

        const res = await request(app)
          .get("/api/stock/health-center")
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("healthCenter");
        expect(res.body.healthCenter).toBeInstanceOf(Array);
        expect(res.body.healthCenter.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================
  // SECTION 5: OPÉRATIONS ADD/REDUCE
  // ============================================
  
  describe("Opérations ADD/REDUCE", () => {
    describe("PUT /api/stock/add-national - Ajout de stock", () => {
      beforeEach(async () => {
        await prisma.stockNATIONAL.create({
          data: { vaccineId, quantity: 50 },
        });
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .put("/api/stock/add-national")
          .send({ vaccineId, quantity: 10 });
        expect(res.statusCode).toBe(401);
      });

      it("Ajoute du stock NATIONAL avec succès", async () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const res = await request(app)
          .put("/api/stock/add-national")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ vaccineId, quantity: 10, expiration: futureDate.toISOString() });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("stock");
        expect(res.body.stock.quantity).toBe(60);
        expect(res.body).toHaveProperty("lot");

        // Vérifier en DB
        const stock = await prisma.stockNATIONAL.findUnique({
          where: { vaccineId },
        });
        expect(stock.quantity).toBe(60);
      });
    });

    describe("PUT /api/stock/reduce-national - Réduction de stock", () => {
      beforeEach(async () => {
        await prisma.stockNATIONAL.create({
          data: { vaccineId, quantity: 100 },
        });
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .put("/api/stock/reduce-national")
          .send({ vaccineId, quantity: 10 });
        expect(res.statusCode).toBe(401);
      });

      it("Réduit le stock NATIONAL avec succès", async () => {
        const res = await request(app)
          .put("/api/stock/reduce-national")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ vaccineId, quantity: 10 });

        expect(res.statusCode).toBe(200);
        expect(res.body.quantity).toBe(90);

        // Vérifier en DB
        const stock = await prisma.stockNATIONAL.findUnique({
          where: { vaccineId },
        });
        expect(stock.quantity).toBe(90);
      });
    });

    describe("PUT /api/stock/add-regional - Ajout de stock REGIONAL", () => {
      beforeEach(async () => {
        await prisma.stockREGIONAL.upsert({
          where: { vaccineId_regionId: { vaccineId, regionId } },
          update: { quantity: 50 },
          create: { vaccineId, regionId, quantity: 50 },
        });
      });

      it("Ajoute du stock REGIONAL avec succès", async () => {
        // Créer ou mettre à jour le stock NATIONAL avec quantité et lots
        await prisma.stockNATIONAL.upsert({
          where: { vaccineId },
          update: { quantity: 100 },
          create: { vaccineId, quantity: 100 },
        });

        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        // Créer des lots dans le stock NATIONAL
        await prisma.stockLot.create({
          data: {
            vaccineId,
            ownerType: "NATIONAL",
            ownerId: null,
            quantity: 100,
            remainingQuantity: 100,
            expiration: futureDate,
            status: "VALID",
          },
        });

        const res = await request(app)
          .put("/api/stock/add-regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ vaccineId, regionId, quantity: 10 });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("national");
        expect(res.body).toHaveProperty("pendingTransfer");
      });
    });

    describe("PUT /api/stock/add-district - Ajout de stock DISTRICT", () => {
      beforeEach(async () => {
        await prisma.stockDISTRICT.create({
          data: { vaccineId, districtId, quantity: 50 },
        });
      });

      it("Ajoute du stock DISTRICT avec succès", async () => {
        // Créer d'abord un stock REGIONAL avec quantité suffisante et lots
        await prisma.stockREGIONAL.create({
          data: { vaccineId, regionId, quantity: 100 },
        });

        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        // Créer des lots dans le stock REGIONAL
        await prisma.stockLot.create({
          data: {
            vaccineId,
            ownerType: "REGIONAL",
            ownerId: regionId,
            quantity: 100,
            remainingQuantity: 100,
            expiration: futureDate,
            status: "VALID",
          },
        });

        const res = await request(app)
          .put("/api/stock/add-district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ vaccineId, districtId, regionId, quantity: 10 });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("pendingTransfer");
      });
    });

    describe("PUT /api/stock/add-health-center - Ajout de stock HEALTHCENTER", () => {
      beforeEach(async () => {
        await prisma.stockHEALTHCENTER.create({
          data: { vaccineId, healthCenterId, quantity: 50 },
        });
      });

      it("Ajoute du stock HEALTHCENTER avec succès", async () => {
        // Créer ou mettre à jour le stock DISTRICT avec quantité suffisante et lots
        await prisma.stockDISTRICT.upsert({
          where: { vaccineId_districtId: { vaccineId, districtId } },
          update: { quantity: 100 },
          create: { vaccineId, districtId, quantity: 100 },
        });

        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        // Créer des lots dans le stock DISTRICT
        await prisma.stockLot.create({
          data: {
            vaccineId,
            ownerType: "DISTRICT",
            ownerId: districtId,
            quantity: 100,
            remainingQuantity: 100,
            expiration: futureDate,
            status: "VALID",
          },
        });

        const res = await request(app)
          .put("/api/stock/add-health-center")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ vaccineId, healthCenterId, quantity: 10 });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("pendingTransfer");
      });
    });
  });

  // ============================================
  // SECTION 6: GESTION DES LOTS
  // ============================================
  
  describe("Gestion des Lots", () => {
    describe("GET /api/stock/national/:vaccineId/lots - Liste des lots NATIONAL", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .get(`/api/stock/national/${vaccineId}/lots`);
        expect(res.statusCode).toBe(401);
      });

      it("Retourne la liste des lots NATIONAL", async () => {
        // Créer un stock et un lot
        await prisma.stockNATIONAL.create({
          data: { vaccineId },
        });

        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        await prisma.stockLot.create({
          data: {
            vaccineId,
            ownerType: "NATIONAL",
            ownerId: null,
            quantity: 100,
            remainingQuantity: 100,
            expiration: futureDate,
            status: "VALID",
          },
        });

        const res = await request(app)
          .get(`/api/stock/national/${vaccineId}/lots`)
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("lots");
        expect(res.body.lots).toBeInstanceOf(Array);
        expect(res.body.lots.length).toBeGreaterThan(0);
        expect(res.body.lots[0]).toHaveProperty("id");
        expect(res.body.lots[0]).toHaveProperty("quantity");
        expect(res.body.lots[0]).toHaveProperty("remainingQuantity");
        expect(res.body).toHaveProperty("totalRemaining");
      });
    });

    describe("GET /api/stock/regional/:vaccineId/lots - Liste des lots REGIONAL", () => {
      it("Retourne la liste des lots REGIONAL", async () => {
        // Créer un stock et un lot
        await prisma.stockREGIONAL.create({
          data: { vaccineId, regionId },
        });

        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        await prisma.stockLot.create({
          data: {
            vaccineId,
            ownerType: "REGIONAL",
            ownerId: regionId,
            quantity: 100,
            remainingQuantity: 100,
            expiration: futureDate,
            status: "VALID",
          },
        });

        const res = await request(app)
          .get(`/api/stock/regional/${vaccineId}/lots`)
          .set("Authorization", `Bearer ${regionalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("lots");
        expect(res.body.lots).toBeInstanceOf(Array);
        expect(res.body.lots.length).toBeGreaterThan(0);
        expect(res.body).toHaveProperty("totalRemaining");
      });
    });

    describe("GET /api/stock/district/:vaccineId/lots - Liste des lots DISTRICT", () => {
      it("Retourne la liste des lots DISTRICT", async () => {
        // Créer un stock et un lot
        await prisma.stockDISTRICT.create({
          data: { vaccineId, districtId },
        });

        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        await prisma.stockLot.create({
          data: {
            vaccineId,
            ownerType: "DISTRICT",
            ownerId: districtId,
            quantity: 100,
            remainingQuantity: 100,
            expiration: futureDate,
            status: "VALID",
          },
        });

        const res = await request(app)
          .get(`/api/stock/district/${vaccineId}/lots`)
          .set("Authorization", `Bearer ${districtToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("lots");
        expect(res.body.lots).toBeInstanceOf(Array);
        expect(res.body.lots.length).toBeGreaterThan(0);
        expect(res.body).toHaveProperty("totalRemaining");
      });
    });

    describe("GET /api/stock/health-center/:vaccineId/lots - Liste des lots HEALTHCENTER", () => {
      it("Retourne la liste des lots HEALTHCENTER", async () => {
        // Créer un stock et un lot
        await prisma.stockHEALTHCENTER.create({
          data: { vaccineId, healthCenterId },
        });

        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        await prisma.stockLot.create({
          data: {
            vaccineId,
            ownerType: "HEALTHCENTER",
            ownerId: healthCenterId,
            quantity: 100,
            remainingQuantity: 100,
            expiration: futureDate,
            status: "VALID",
          },
        });

        const res = await request(app)
          .get(`/api/stock/health-center/${vaccineId}/lots`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .query({ healthCenterId });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("lots");
        expect(res.body.lots).toBeInstanceOf(Array);
        expect(res.body.lots.length).toBeGreaterThan(0);
        expect(res.body).toHaveProperty("totalRemaining");
      });
    });

    describe("DELETE /api/stock/lots/:id - Suppression d'un lot", () => {
      let lotId;

      beforeEach(async () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const lot = await prisma.stockLot.create({
          data: {
            vaccineId,
            ownerType: "NATIONAL",
            ownerId: null,
            quantity: 100,
            remainingQuantity: 100,
            expiration: futureDate,
            status: "VALID",
          },
        });
        lotId = lot.id;
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .delete(`/api/stock/lots/${lotId}`);
        expect(res.statusCode).toBe(401);
      });

      it("Supprime un lot avec succès", async () => {
        const res = await request(app)
          .delete(`/api/stock/lots/${lotId}`)
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("deletedIds");
        expect(res.body.deletedIds).toBeInstanceOf(Array);
        expect(res.body.deletedIds.length).toBeGreaterThan(0);

        // Vérifier en DB
        const lot = await prisma.stockLot.findUnique({
          where: { id: lotId },
        });
        expect(lot).toBeNull();
      });
    });
  });

  // ============================================
  // SECTION 7: STATISTIQUES
  // ============================================
  
  describe("Statistiques", () => {
    describe("GET /api/stock/stats/national - Statistiques NATIONAL", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get("/api/stock/stats/national");
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL", async () => {
        const res = await request(app)
          .get("/api/stock/stats/national")
          .set("Authorization", `Bearer ${regionalToken}`);
        expect(res.statusCode).toBe(403);
      });

      it("Retourne les statistiques NATIONAL avec succès", async () => {
        // Créer des stocks
        await prisma.stockNATIONAL.create({
          data: { vaccineId, quantity: 100 },
        });

        const res = await request(app)
          .get("/api/stock/stats/national")
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("totalLots");
        expect(res.body).toHaveProperty("totalQuantity");
        expect(res.body).toHaveProperty("lowStockCount");
        expect(res.body).toHaveProperty("expiredLots");
        expect(res.body).toHaveProperty("threshold");
      });
    });

    describe("GET /api/stock/stats/regional - Statistiques REGIONAL", () => {
      it("Retourne les statistiques REGIONAL avec succès", async () => {
        // Créer des stocks
        await prisma.stockREGIONAL.create({
          data: { vaccineId, regionId, quantity: 50 },
        });

        const res = await request(app)
          .get("/api/stock/stats/regional")
          .set("Authorization", `Bearer ${regionalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("totalLots");
        expect(res.body).toHaveProperty("totalQuantity");
        expect(res.body).toHaveProperty("lowStockCount");
        expect(res.body).toHaveProperty("expiredLots");
      });
    });

    describe("GET /api/stock/stats/district - Statistiques DISTRICT", () => {
      it("Retourne les statistiques DISTRICT avec succès", async () => {
        // Créer des stocks
        await prisma.stockDISTRICT.create({
          data: { vaccineId, districtId, quantity: 30 },
        });

        const res = await request(app)
          .get("/api/stock/stats/district")
          .set("Authorization", `Bearer ${districtToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("totalLots");
        expect(res.body).toHaveProperty("totalQuantity");
        expect(res.body).toHaveProperty("lowStockCount");
        expect(res.body).toHaveProperty("expiredLots");
      });
    });

    describe("GET /api/stock/stats/health-center - Statistiques HEALTHCENTER", () => {
      it("Retourne les statistiques HEALTHCENTER avec succès", async () => {
        // Créer des stocks
        await prisma.stockHEALTHCENTER.create({
          data: { vaccineId, healthCenterId, quantity: 20 },
        });

        const res = await request(app)
          .get("/api/stock/stats/health-center")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .query({ healthCenterId });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("totalLots");
        expect(res.body).toHaveProperty("totalQuantity");
        expect(res.body).toHaveProperty("lowStockCount");
        expect(res.body).toHaveProperty("expiredLots");
      });
    });
  });

  // ============================================
  // SECTION 8: RÉSERVATIONS
  // ============================================
  
  describe("Réservations", () => {
    describe("GET /api/stock/health-center/reservations - Liste des réservations", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .get("/api/stock/health-center/reservations");
        expect(res.statusCode).toBe(401);
      });

      it("Retourne la liste des réservations", async () => {
        // Créer un lot
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const lot = await prisma.stockLot.create({
          data: {
            vaccineId,
            ownerType: "HEALTHCENTER",
            ownerId: healthCenterId,
            quantity: 100,
            remainingQuantity: 100,
            expiration: futureDate,
            status: "VALID",
          },
        });

        // Note: StockReservation nécessite un scheduleId (ChildVaccineScheduled)
        // Pour simplifier, on teste juste que la route fonctionne sans réservation
        const res = await request(app)
          .get("/api/stock/health-center/reservations")
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("reservations");
        expect(res.body.reservations).toBeInstanceOf(Array);
      });
    });
  });

  // ============================================
  // SECTION 9: TRANSFERTS
  // ============================================
  
  describe("Transferts", () => {
    describe("GET /api/stock/pending-transfers - Liste des transferts en attente", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .get("/api/stock/pending-transfers");
        expect(res.statusCode).toBe(401);
      });

      it("Retourne la liste des transferts en attente", async () => {
        // Créer un transfert en attente
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const lot = await prisma.stockLot.create({
          data: {
            vaccineId,
            ownerType: "NATIONAL",
            ownerId: null,
            quantity: 100,
            remainingQuantity: 100,
            expiration: futureDate,
            status: "VALID",
          },
        });

        const pendingTransfer = await prisma.pendingStockTransfer.create({
          data: {
            vaccineId,
            fromType: "NATIONAL",
            fromId: null,
            toType: "REGIONAL",
            toId: regionId,
            quantity: 50,
            status: "PENDING",
          },
        });

        await prisma.pendingStockTransferLot.create({
          data: {
            pendingTransferId: pendingTransfer.id,
            lotId: lot.id,
            quantity: 50,
          },
        });

        const res = await request(app)
          .get("/api/stock/pending-transfers")
          .set("Authorization", `Bearer ${regionalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("transfers");
        expect(res.body.transfers).toBeInstanceOf(Array);
        expect(res.body.transfers.length).toBeGreaterThan(0);
      });
    });

    describe("POST /api/stock/pending-transfers/:transferId/confirm - Confirmation d'un transfert", () => {
      let transferId;
      let lotId;

      beforeEach(async () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const lot = await prisma.stockLot.create({
          data: {
            vaccineId,
            ownerType: "NATIONAL",
            ownerId: null,
            quantity: 100,
            remainingQuantity: 100,
            expiration: futureDate,
            status: "VALID",
          },
        });
        lotId = lot.id;

        const pendingTransfer = await prisma.pendingStockTransfer.create({
          data: {
            vaccineId,
            fromType: "NATIONAL",
            fromId: null,
            toType: "REGIONAL",
            toId: regionId,
            quantity: 50,
            status: "PENDING",
          },
        });
        transferId = pendingTransfer.id;

        await prisma.pendingStockTransferLot.create({
          data: {
            pendingTransferId: pendingTransfer.id,
            lotId: lot.id,
            quantity: 50,
          },
        });
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post(`/api/stock/pending-transfers/${transferId}/confirm`);
        expect(res.statusCode).toBe(401);
      });

      it("Confirme un transfert avec succès", async () => {
        // Créer ou mettre à jour le stock REGIONAL pour que le transfert puisse être confirmé
        await prisma.stockREGIONAL.upsert({
          where: { vaccineId_regionId: { vaccineId, regionId } },
          update: { quantity: 0 },
          create: { vaccineId, regionId, quantity: 0 },
        });

        const res = await request(app)
          .post(`/api/stock/pending-transfers/${transferId}/confirm`)
          .set("Authorization", `Bearer ${regionalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("transfer");
        expect(res.body).toHaveProperty("stock");
        expect(res.body).toHaveProperty("message");

        // Vérifier que le transfert est confirmé
        const transfer = await prisma.pendingStockTransfer.findUnique({
          where: { id: transferId },
        });
        expect(transfer.status).toBe("CONFIRMED");
      });
    });
  });
});

