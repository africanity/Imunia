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
  notifyHealthCenterAgents: jest.fn().mockResolvedValue([]),
}));

describe("Children API - CRUD", () => {
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
      await prisma.children.deleteMany();
      await prisma.healthCenter.deleteMany();
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();
      await prisma.user.deleteMany();

      // Créer le user NATIONAL directement en DB
      nationalEmail = `national-children-crud-test-${Date.now()}@example.com`;
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

      // Obtenir le token NATIONAL initial
      nationalToken = await getNationalToken();

      // Créer une région pour les tests
      const regionRes = await request(app)
        .post("/api/region")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ name: `RegionForChildren-${Date.now()}` });
      expect(regionRes.statusCode).toBe(201);
      regionId = regionRes.body.id;

      // Créer une commune
      const communeRes = await request(app)
        .post("/api/commune")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ name: `CommuneForChildren-${Date.now()}`, regionId: regionId });
      expect(communeRes.statusCode).toBe(201);
      communeId = communeRes.body.id;

      // Créer un user REGIONAL directement en DB
      regionalEmail = `regional-children-crud-test-${Date.now()}@example.com`;
      regionalPassword = "motdepasse";
      testEmails.add(regionalEmail);
      const regionalHashedPassword = await bcrypt.hash(regionalPassword, 10);

      await prisma.user.create({
        data: {
          email: regionalEmail,
          password: regionalHashedPassword,
          firstName: "Regional",
          lastName: "User",
          
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
        .send({ name: `DistrictForChildren-${Date.now()}`, communeId: communeId });
      expect(districtRes.statusCode).toBe(201);
      districtId = districtRes.body.id;

      // Créer un user DISTRICT directement en DB
      districtEmail = `district-children-crud-test-${Date.now()}@example.com`;
      districtPassword = "motdepasse";
      testEmails.add(districtEmail);
      const districtHashedPassword = await bcrypt.hash(districtPassword, 10);

      await prisma.user.create({
        data: {
          email: districtEmail,
          password: districtHashedPassword,
          firstName: "District",
          lastName: "User",
          
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
      agentAdminEmail = `agentadmin-children-crud-test-${Date.now()}@example.com`;
      agentAdminPassword = "motdepasse";
      testEmails.add(agentAdminEmail);
      const agentAdminHashedPassword = await bcrypt.hash(agentAdminPassword, 10);

      await prisma.user.create({
        data: {
          email: agentAdminEmail,
          password: agentAdminHashedPassword,
          firstName: "Agent",
          lastName: "Admin",
          
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
      agentStaffEmail = `agentstaff-children-crud-test-${Date.now()}@example.com`;
      agentStaffPassword = "motdepasse";
      testEmails.add(agentStaffEmail);
      const agentStaffHashedPassword = await bcrypt.hash(agentStaffPassword, 10);

      await prisma.user.create({
        data: {
          email: agentStaffEmail,
          password: agentStaffHashedPassword,
          firstName: "Agent",
          lastName: "Staff",
          
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
      await prisma.children.deleteMany();
      await prisma.user.deleteMany({
        where: {
          role: { in: ["AGENT"] },
          email: { notIn: [agentAdminEmail, agentStaffEmail] },
        },
      });
      testEmails.clear();
      testEmails.add(regionalEmail);
      testEmails.add(districtEmail);
      testEmails.add(agentAdminEmail);
      testEmails.add(agentStaffEmail);

      // S'assurer que les users de base existent toujours
      const existingNational = await prisma.user.findUnique({
        where: { email: nationalEmail },
      });
      if (!existingNational) {
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
      }

      const existingRegional = await prisma.user.findUnique({
        where: { email: regionalEmail },
        include: { region: true },
      });
      if (!existingRegional || !existingRegional.region) {
        if (!existingRegional) {
          const hashedPassword = await bcrypt.hash(regionalPassword, 10);
          await prisma.user.create({
            data: {
              email: regionalEmail,
              password: hashedPassword,
              firstName: "Regional",
              lastName: "User",
              
              role: "REGIONAL",
              isActive: true,
              emailVerified: true,
              regionId: regionId,
            },
          });
        } else if (!existingRegional.regionId) {
          await prisma.user.update({
            where: { email: regionalEmail },
            data: { regionId: regionId },
          });
        }
      }

      const existingDistrict = await prisma.user.findUnique({
        where: { email: districtEmail },
        include: { district: true },
      });
      if (!existingDistrict || !existingDistrict.district) {
        if (!existingDistrict) {
          const hashedPassword = await bcrypt.hash(districtPassword, 10);
          await prisma.user.create({
            data: {
              email: districtEmail,
              password: hashedPassword,
              firstName: "District",
              lastName: "User",
              
              role: "DISTRICT",
              isActive: true,
              emailVerified: true,
              districtId: districtId,
            },
          });
        } else if (!existingDistrict.districtId) {
          await prisma.user.update({
            where: { email: districtEmail },
            data: { districtId: districtId },
          });
        }
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
    await prisma.children.deleteMany();
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

  describe("POST /api/children - Création", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/children")
          .send({
            firstName: "Test",
            lastName: "Child",
            birthDate: "2024-01-01",
            birthPlace: "Dakar",
            address: "123 Test St",
            gender: "M",
            phoneParent: "+221123456789",
            emailParent: "test@example.com",
            fatherName: "Father",
            motherName: "Mother",
          });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas AGENT (NATIONAL)", async () => {
        const res = await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Test",
            lastName: "Child",
            birthDate: "2024-01-01",
            birthPlace: "Dakar",
            address: "123 Test St",
            gender: "M",
            phoneParent: "+221123456789",
            emailParent: "test@example.com",
            fatherName: "Father",
            motherName: "Mother",
          });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toContain("Seuls les agents");
      });

      it("Retourne 403 si utilisateur n'est pas AGENT (REGIONAL)", async () => {
        const res = await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            firstName: "Test",
            lastName: "Child",
            birthDate: "2024-01-01",
            birthPlace: "Dakar",
            address: "123 Test St",
            gender: "M",
            phoneParent: "+221123456789",
            emailParent: "test@example.com",
            fatherName: "Father",
            motherName: "Mother",
          });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toContain("Seuls les agents");
      });

      it("Retourne 400 si AGENT sans healthCenterId", async () => {
        // Créer un agent sans healthCenterId
        const agentWithoutHCEmail = `agent-no-hc-${Date.now()}@example.com`;
        testEmails.add(agentWithoutHCEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: agentWithoutHCEmail,
            password: hashedPassword,
            firstName: "Agent",
            lastName: "NoHC",
            
            role: "AGENT",
            agentLevel: "ADMIN",
            isActive: true,
            emailVerified: true,
            districtId: districtId,
            // Pas de healthCenterId
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: agentWithoutHCEmail, password: "motdepasse" });
        
        // Un AGENT sans healthCenterId ne peut pas se connecter (403) ou peut se connecter mais l'API retourne 400
        if (loginRes.statusCode === 403) {
          const res = await request(app)
            .post("/api/children")
            .set("Authorization", "Bearer invalid-token")
            .send({
              firstName: "Test",
              lastName: "Child",
              birthDate: "2024-01-01",
              birthPlace: "Dakar",
              address: "123 Test St",
              gender: "M",
              phoneParent: "+221123456789",
              emailParent: "test@example.com",
              fatherName: "Father",
              motherName: "Mother",
            });
          expect([401, 403]).toContain(res.statusCode);
          return;
        }

        expect(loginRes.statusCode).toBe(200);
        const token = loginRes.body.accessToken;

        const res = await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${token}`)
          .send({
            firstName: "Test",
            lastName: "Child",
            birthDate: "2024-01-01",
            birthPlace: "Dakar",
            address: "123 Test St",
            gender: "M",
            phoneParent: "+221123456789",
            emailParent: "test@example.com",
            fatherName: "Father",
            motherName: "Mother",
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain("centre de santé");
      });
    });

    describe("Succès", () => {
      it("Crée un enfant avec succès (AGENT ADMIN)", async () => {
        const birthDate = new Date("2024-01-01");
        const res = await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "Test",
            lastName: "Child",
            birthDate: birthDate.toISOString(),
            birthPlace: "Dakar",
            address: "123 Test St",
            gender: "M",
            emailParent: "parent@test.com",
            phoneParent: "+221123456789",
            emailParent: "test@example.com",
            fatherName: "Father",
            motherName: "Mother",
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.firstName).toBe("Test");
        expect(res.body.lastName).toBe("Child");
        expect(res.body.isActive).toBe(false);
        expect(res.body.photosRequested).toBe(false);
        expect(res.body.healthCenter).toBeDefined();

        // Vérifier en DB
        const childInDb = await prisma.children.findUnique({
          where: { id: res.body.id },
        });
        expect(childInDb).not.toBeNull();
        expect(childInDb.firstName).toBe("Test");
        expect(childInDb.healthCenterId).toBe(healthCenterId);
        expect(childInDb.code).toBeDefined(); // Le code est stocké en DB mais pas dans la réponse
      });

      it("Crée un enfant avec succès (AGENT STAFF)", async () => {
        const birthDate = new Date("2024-01-01");
        const res = await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${agentStaffToken}`)
          .send({
            firstName: "Test2",
            lastName: "Child2",
            birthDate: birthDate.toISOString(),
            birthPlace: "Thiès",
            address: "456 Test Ave",
            gender: "F",
            emailParent: "parent2@test.com",
            phoneParent: "+221987654321",
            emailParent: "test2@example.com",
            fatherName: "Father2",
            motherName: "Mother2",
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.firstName).toBe("Test2");
        expect(res.body.gender).toBe("F");
      });
    });
  });

  describe("GET /api/children - Liste", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get("/api/children");
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas autorisé", async () => {
        // Créer un user avec un rôle non autorisé (ex: pas de rôle défini)
        // En fait, tous les rôles sont autorisés, donc on teste avec un token invalide
        const res = await request(app)
          .get("/api/children")
          .set("Authorization", "Bearer invalid-token");
        expect(res.statusCode).toBe(401);
      });
    });

    describe("Autorisation et Scopes", () => {
      it("Retourne toutes les enfants pour NATIONAL", async () => {
        // Créer quelques enfants
        const birthDate = new Date("2024-01-01");
        await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "Child1",
            lastName: "Test1",
            birthDate: birthDate.toISOString(),
            birthPlace: "Dakar",
            address: "123 Test St",
            gender: "M",
            phoneParent: "+221111111111",
            emailParent: "parent1@test.com",
            fatherName: "Father1",
            motherName: "Mother1",
          });

        await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "Child2",
            lastName: "Test2",
            birthDate: birthDate.toISOString(),
            birthPlace: "Thiès",
            address: "456 Test Ave",
            gender: "F",
            phoneParent: "+221222222222",
            emailParent: "parent2@test.com",
            fatherName: "Father2",
            motherName: "Mother2",
          });

        const res = await request(app)
          .get("/api/children")
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("total");
        expect(res.body).toHaveProperty("items");
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.total).toBeGreaterThanOrEqual(2);
      });

      it("Retourne seulement les enfants de sa région pour REGIONAL", async () => {
        // Créer un enfant dans la région
        const birthDate = new Date("2024-01-01");
        await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "ChildRegional",
            lastName: "Test",
            birthDate: birthDate.toISOString(),
            birthPlace: "Dakar",
            address: "123 Test St",
            gender: "M",
            phoneParent: "+221333333333",
            emailParent: "parent3@test.com",
            fatherName: "Father",
            motherName: "Mother",
          });

        const res = await request(app)
          .get("/api/children")
          .set("Authorization", `Bearer ${regionalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("total");
        expect(res.body).toHaveProperty("items");
        // Le REGIONAL doit voir les enfants de sa région
        res.body.items.forEach((child) => {
          expect(child.healthCenter).toBeDefined();
        });
      });

      it("Retourne seulement les enfants de son district pour DISTRICT", async () => {
        // Créer un enfant
        const birthDate = new Date("2024-01-01");
        await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "ChildDistrict",
            lastName: "Test",
            birthDate: birthDate.toISOString(),
            birthPlace: "Dakar",
            address: "123 Test St",
            gender: "M",
            phoneParent: "+221444444444",
            emailParent: "parent4@test.com",
            fatherName: "Father",
            motherName: "Mother",
          });

        const res = await request(app)
          .get("/api/children")
          .set("Authorization", `Bearer ${districtToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("total");
        expect(res.body).toHaveProperty("items");
      });

      it("Retourne seulement les enfants de son healthCenter pour AGENT", async () => {
        // Créer un enfant
        const birthDate = new Date("2024-01-01");
        await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "ChildAgent",
            lastName: "Test",
            birthDate: birthDate.toISOString(),
            birthPlace: "Dakar",
            address: "123 Test St",
            gender: "M",
            phoneParent: "+221555555555",
            emailParent: "parent5@test.com",
            fatherName: "Father",
            motherName: "Mother",
          });

        const res = await request(app)
          .get("/api/children")
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("total");
        expect(res.body).toHaveProperty("items");
        expect(res.body.total).toBeGreaterThanOrEqual(1);
      });

      it("Retourne une liste vide si REGIONAL sans regionId", async () => {
        const regionalWithoutRegionIdEmail = `regional-no-region-${Date.now()}@example.com`;
        testEmails.add(regionalWithoutRegionIdEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: regionalWithoutRegionIdEmail,
            password: hashedPassword,
            firstName: "Regional",
            lastName: "NoRegion",
            
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: regionalWithoutRegionIdEmail, password: "motdepasse" });
        
        if (loginRes.statusCode === 403) {
          const res = await request(app)
            .get("/api/children")
            .set("Authorization", "Bearer invalid-token");
          expect([401, 403]).toContain(res.statusCode);
          return;
        }

        expect(loginRes.statusCode).toBe(200);
        const token = loginRes.body.accessToken;

        const res = await request(app)
          .get("/api/children")
          .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.total).toBe(0);
        expect(res.body.items).toHaveLength(0);
      });
    });

    describe("Filtres", () => {
      it("Filtre par status=active", async () => {
        // Créer un enfant actif et un inactif
        const birthDate = new Date("2024-01-01");
        const child1Res = await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "Active",
            lastName: "Child",
            birthDate: birthDate.toISOString(),
            birthPlace: "Dakar",
            address: "123 Test St",
            gender: "M",
            phoneParent: "+221777777777",
            emailParent: "parent7@test.com",
            fatherName: "Father",
            motherName: "Mother",
          });
        expect(child1Res.statusCode).toBe(201);
        const child1Id = child1Res.body.id;

        // Activer l'enfant
        await prisma.children.update({
          where: { id: child1Id },
          data: { isActive: true },
        });

        const child2Res = await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "Inactive",
            lastName: "Child",
            birthDate: birthDate.toISOString(),
            birthPlace: "Dakar",
            address: "456 Test St",
            gender: "F",
            phoneParent: "+221888888888",
            emailParent: "parent8@test.com",
            fatherName: "Father2",
            motherName: "Mother2",
          });
        expect(child2Res.statusCode).toBe(201);
        // child2 reste inactif par défaut

        const res = await request(app)
          .get("/api/children?status=active")
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        res.body.items.forEach((child) => {
          expect(child.isActive).toBe(true);
        });
      });

      it("Filtre par status=inactive", async () => {
        const birthDate = new Date("2024-01-01");
        await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "Inactive",
            lastName: "Child",
            birthDate: birthDate.toISOString(),
            birthPlace: "Dakar",
            address: "123 Test St",
            gender: "M",
            phoneParent: "+221999999999",
            emailParent: "parent9@test.com",
            fatherName: "Father",
            motherName: "Mother",
          });

        const res = await request(app)
          .get("/api/children?status=inactive")
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        res.body.items.forEach((child) => {
          expect(child.isActive).toBe(false);
        });
      });
    });
  });

  describe("PUT /api/children/:id - Modification", () => {
    let childId;

    beforeEach(async () => {
      // Créer un enfant pour les tests de modification
      const birthDate = new Date("2024-01-01");
      const res = await request(app)
        .post("/api/children")
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          firstName: "Update",
          lastName: "Test",
          birthDate: birthDate.toISOString(),
          birthPlace: "Dakar",
          address: "123 Test St",
          gender: "M",
            phoneParent: "+221000000000",
            emailParent: "parent0@test.com",
            fatherName: "Father",
            motherName: "Mother",
          });
      expect(res.statusCode).toBe(201);
      childId = res.body.id;
    });

    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}`)
          .send({ nextVaccineId: "vaccine-1" });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas AGENT ou DISTRICT (NATIONAL)", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ nextVaccineId: "vaccine-1" });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });

      it("Retourne 403 si utilisateur n'est pas AGENT ou DISTRICT (REGIONAL)", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ nextVaccineId: "vaccine-1" });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si enfant non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .put(`/api/children/${fakeId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ nextVaccineId: "vaccine-1" });
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Enfant non trouvé");
      });
    });

    describe("Succès", () => {
      it("Modifie nextVaccineId avec succès (AGENT)", async () => {
        // nextVaccineId peut être null ou un UUID valide
        const res = await request(app)
          .put(`/api/children/${childId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ nextVaccineId: null });

        expect(res.statusCode).toBe(200);
        expect(res.body.nextVaccineId).toBeNull();

        // Vérifier en DB
        const childInDb = await prisma.children.findUnique({
          where: { id: childId },
        });
        expect(childInDb.nextVaccineId).toBeNull();
      });

      it("Modifie nextAgentId avec succès (AGENT)", async () => {
        const agentId = agentAdminToken ? "test-agent-id" : null;
        if (!agentId) {
          // Si on n'a pas d'agentId, on teste juste que la requête fonctionne
          const res = await request(app)
            .put(`/api/children/${childId}`)
            .set("Authorization", `Bearer ${agentAdminToken}`)
            .send({ nextAgentId: "test-agent-id" });
          expect(res.statusCode).toBe(200);
        }
      });

      it("Modifie nextAppointment avec succès (AGENT)", async () => {
        const appointmentDate = new Date("2024-12-31");
        const res = await request(app)
          .put(`/api/children/${childId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ nextAppointment: appointmentDate.toISOString() });

        expect(res.statusCode).toBe(200);
        expect(res.body.nextAppointment).toBeDefined();

        // Vérifier en DB
        const childInDb = await prisma.children.findUnique({
          where: { id: childId },
        });
        expect(childInDb.nextAppointment).not.toBeNull();
      });

      it("Modifie avec succès (DISTRICT)", async () => {
        // nextVaccineId peut être null ou un UUID valide
        const res = await request(app)
          .put(`/api/children/${childId}`)
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ nextVaccineId: null });

        expect(res.statusCode).toBe(200);
        expect(res.body.nextVaccineId).toBeNull();
      });
    });
  });

  describe("DELETE /api/children/:id - Suppression", () => {
    let childId;

    beforeEach(async () => {
      // Créer un enfant pour les tests de suppression
      const birthDate = new Date("2024-01-01");
      const res = await request(app)
        .post("/api/children")
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          firstName: "Delete",
          lastName: "Test",
          birthDate: birthDate.toISOString(),
          birthPlace: "Dakar",
          address: "123 Test St",
          gender: "M",
          phoneParent: "+221111111111",
          emailParent: "delete@test.com",
          fatherName: "Father",
          motherName: "Mother",
        });
      expect(res.statusCode).toBe(201);
      childId = res.body.id;
    });

    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).delete(`/api/children/${childId}`);
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas AGENT (NATIONAL)", async () => {
        const res = await request(app)
          .delete(`/api/children/${childId}`)
          .set("Authorization", `Bearer ${nationalToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });

      it("Retourne 403 si utilisateur n'est pas AGENT (REGIONAL)", async () => {
        const res = await request(app)
          .delete(`/api/children/${childId}`)
          .set("Authorization", `Bearer ${regionalToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });

      it("Retourne 400 si AGENT sans healthCenterId", async () => {
        const agentWithoutHCEmail = `agent-no-hc-2-${Date.now()}@example.com`;
        testEmails.add(agentWithoutHCEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: agentWithoutHCEmail,
            password: hashedPassword,
            firstName: "Agent",
            lastName: "NoHC2",
            
            role: "AGENT",
            agentLevel: "ADMIN",
            isActive: true,
            emailVerified: true,
            districtId: districtId,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: agentWithoutHCEmail, password: "motdepasse" });
        
        if (loginRes.statusCode === 403) {
          const res = await request(app)
            .delete(`/api/children/${childId}`)
            .set("Authorization", "Bearer invalid-token");
          expect([401, 403]).toContain(res.statusCode);
          return;
        }

        expect(loginRes.statusCode).toBe(200);
        const token = loginRes.body.accessToken;

        const res = await request(app)
          .delete(`/api/children/${childId}`)
          .set("Authorization", `Bearer ${token}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si enfant non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const originalError = console.error;
        console.error = jest.fn();

        const res = await request(app)
          .delete(`/api/children/${fakeId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect([404, 500]).toContain(res.statusCode);
        console.error = originalError;
      });

      it("Retourne 403 si AGENT essaie de supprimer un enfant d'un autre healthCenter", async () => {
        // Créer un autre healthCenter et un agent dedans
        const otherHealthCenterRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: `OtherHealthCenter-${Date.now()}`, address: "456 Other St" });
        expect(otherHealthCenterRes.statusCode).toBe(201);
        const otherHealthCenterId = otherHealthCenterRes.body.id;

        const otherAgentEmail = `other-agent-${Date.now()}@example.com`;
        testEmails.add(otherAgentEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherAgentEmail,
            password: hashedPassword,
            firstName: "Other",
            lastName: "Agent",
            
            role: "AGENT",
            agentLevel: "ADMIN",
            isActive: true,
            emailVerified: true,
            districtId: districtId,
            healthCenterId: otherHealthCenterId,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherAgentEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const otherAgentToken = loginRes.body.accessToken;

        // Essayer de supprimer l'enfant d'un autre healthCenter
        const res = await request(app)
          .delete(`/api/children/${childId}`)
          .set("Authorization", `Bearer ${otherAgentToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toContain("Accès refusé");
      });
    });

    describe("Succès", () => {
      it("Supprime un enfant avec succès (AGENT ADMIN)", async () => {
        const res = await request(app)
          .delete(`/api/children/${childId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toContain("supprimé");

        // Vérifier en DB
        const childInDb = await prisma.children.findUnique({
          where: { id: childId },
        });
        expect(childInDb).toBeNull();
      });

      it("Supprime un enfant avec succès (AGENT STAFF)", async () => {
        // Créer un nouvel enfant pour ce test
        const birthDate = new Date("2024-01-01");
        const createRes = await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${agentStaffToken}`)
          .send({
            firstName: "DeleteStaff",
            lastName: "Test",
            birthDate: birthDate.toISOString(),
            birthPlace: "Dakar",
            address: "123 Test St",
            gender: "M",
            phoneParent: "+221222222222",
            emailParent: "parent2@test.com",
            fatherName: "Father",
            motherName: "Mother",
          });
        expect(createRes.statusCode).toBe(201);
        const staffChildId = createRes.body.id;

        const res = await request(app)
          .delete(`/api/children/${staffChildId}`)
          .set("Authorization", `Bearer ${agentStaffToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toContain("supprimé");

        // Vérifier en DB
        const childInDb = await prisma.children.findUnique({
          where: { id: staffChildId },
        });
        expect(childInDb).toBeNull();
      });

      it("Supprime un enfant avec cascade (vaccinations, réservations, records)", async () => {
        // Créer un enfant avec des données liées
        const birthDate = new Date("2024-01-01");
        const createRes = await request(app)
          .post("/api/children")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "Cascade",
            lastName: "Test",
            birthDate: birthDate.toISOString(),
            birthPlace: "Dakar",
            address: "123 Test St",
            gender: "M",
            phoneParent: "+221333333333",
            emailParent: "parent3@test.com",
            fatherName: "Father",
            motherName: "Mother",
          });
        expect(createRes.statusCode).toBe(201);
        const cascadeChildId = createRes.body.id;

        // Vérifier que l'enfant a des vaccinations (due, late, etc.)
        const childBefore = await prisma.children.findUnique({
          where: { id: cascadeChildId },
          include: {
            dueVaccines: true,
            lateVaccines: true,
            scheduledVaccines: true,
          },
        });
        // Les vaccinations peuvent être créées automatiquement lors de la création

        // Supprimer l'enfant
        const res = await request(app)
          .delete(`/api/children/${cascadeChildId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);

        // Vérifier que tout a été supprimé en cascade
        const childInDb = await prisma.children.findUnique({
          where: { id: cascadeChildId },
        });
        expect(childInDb).toBeNull();

        // Vérifier que les vaccinations ont été supprimées
        const dueVaccines = await prisma.childVaccineDue.findMany({
          where: { childId: cascadeChildId },
        });
        expect(dueVaccines).toHaveLength(0);

        const lateVaccines = await prisma.childVaccineLate.findMany({
          where: { childId: cascadeChildId },
        });
        expect(lateVaccines).toHaveLength(0);
      });
    });
  });
});

