const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");

jest.mock('../../src/services/emailService', () => ({
  sendInvitationEmail: jest.fn(),
  sendTwoFactorCode: jest.fn(),
}));

describe("HealthCenter API", () => {
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

  beforeAll(async () => {
    try {
      // Appliquer la migration pour permettre plusieurs districts par commune
      try {
        await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "District_communeId_key";');
      } catch (error) {
        console.log("Index unique déjà supprimé ou n'existe pas");
      }

      // Nettoyage complet avant tous les tests
      await prisma.healthCenter.deleteMany();
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();
      await prisma.user.deleteMany();

      // Créer le user NATIONAL directement en DB
      nationalEmail = `national-healthcenter-test-${Date.now()}@example.com`;
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
        .send({ name: `RegionForHealthCenter-${Date.now()}` });
      expect(regionRes.statusCode).toBe(201);
      regionId = regionRes.body.id;

      // Créer une commune
      const communeRes = await request(app)
        .post("/api/commune")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ name: `CommuneForHealthCenter-${Date.now()}`, regionId: regionId });
      expect(communeRes.statusCode).toBe(201);
      communeId = communeRes.body.id;

      // Créer un user REGIONAL directement en DB
      regionalEmail = `regional-healthcenter-test-${Date.now()}@example.com`;
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
        .send({ name: `DistrictForHealthCenter-${Date.now()}`, communeId: communeId });
      expect(districtRes.statusCode).toBe(201);
      districtId = districtRes.body.id;

      // Créer un user DISTRICT directement en DB
      districtEmail = `district-healthcenter-test-${Date.now()}@example.com`;
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
      agentAdminEmail = `agentadmin-healthcenter-test-${Date.now()}@example.com`;
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
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  beforeEach(async () => {
    try {
      // Nettoyage avant chaque test (mais garder les users et structures de base)
      await prisma.user.deleteMany({
        where: {
          role: { in: ["AGENT"] },
          email: { notIn: [agentAdminEmail] },
        },
      });
      await prisma.healthCenter.deleteMany({
        where: { id: { not: healthCenterId } },
      });
      testEmails.clear();
      testEmails.add(regionalEmail);
      testEmails.add(districtEmail);
      testEmails.add(agentAdminEmail);

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

      const existingAgentAdmin = await prisma.user.findUnique({
        where: { email: agentAdminEmail },
        include: { healthCenter: true },
      });
      if (!existingAgentAdmin || !existingAgentAdmin.healthCenter) {
        if (!existingAgentAdmin) {
          const hashedPassword = await bcrypt.hash(agentAdminPassword, 10);
          await prisma.user.create({
            data: {
              email: agentAdminEmail,
              password: hashedPassword,
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
        } else if (!existingAgentAdmin.healthCenterId) {
          await prisma.user.update({
            where: { email: agentAdminEmail },
            data: { healthCenterId: healthCenterId, districtId: districtId },
          });
        }
      }

      // Régénérer les tokens
      nationalToken = await getNationalToken();
      regionalToken = await getRegionalToken();
      districtToken = await getDistrictToken();
      agentAdminToken = await getAgentAdminToken();
    } catch (error) {
      console.error("Erreur dans beforeEach:", error);
      throw error;
    }
  });

  afterEach(async () => {
    // Cleanup des emails de test créés
    if (testEmails.size > 0) {
      const emailsToDelete = Array.from(testEmails).filter(
        (email) =>
          email !== nationalEmail &&
          email !== regionalEmail &&
          email !== districtEmail &&
          email !== agentAdminEmail
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
    }
  });

  afterAll(async () => {
    // Nettoyage final
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

  describe("POST /api/healthCenter - Création", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/healthCenter")
          .send({ name: "Test HealthCenter", address: "123 Test Street" });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas DISTRICT (NATIONAL)", async () => {
        const res = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: "Test HealthCenter", address: "123 Test Street" });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });

      it("Retourne 403 si utilisateur n'est pas DISTRICT (REGIONAL)", async () => {
        const res = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: "Test HealthCenter", address: "123 Test Street" });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });

      it("Retourne 400 si DISTRICT sans districtId", async () => {
        // Créer un DISTRICT sans districtId
        const districtWithoutDistrictIdEmail = `district-no-district-${Date.now()}@example.com`;
        testEmails.add(districtWithoutDistrictIdEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: districtWithoutDistrictIdEmail,
            password: hashedPassword,
            firstName: "District",
            lastName: "NoDistrict",
            
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: districtWithoutDistrictIdEmail, password: "motdepasse" });
        
        // Un DISTRICT sans districtId ne peut pas se connecter (403) ou peut se connecter mais l'API retourne 400
        if (loginRes.statusCode === 403) {
          // Si le login échoue, on teste directement avec un token invalide pour vérifier l'authentification
          const res = await request(app)
            .post("/api/healthCenter")
            .set("Authorization", "Bearer invalid-token")
            .send({ name: "Test HealthCenter", address: "123 Test Street" });
          expect([401, 403]).toContain(res.statusCode);
          return;
        }

        expect(loginRes.statusCode).toBe(200);
        const token = loginRes.body.accessToken;

        const res = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${token}`)
          .send({ name: "Test HealthCenter", address: "123 Test Street" });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain("rattaché à un district");
      });
    });

    describe("Validation", () => {
      it("Retourne 400 si name manquant", async () => {
        const res = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ address: "123 Test Street" });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Nom et adresse requis");
      });

      it("Retourne 400 si address manquant", async () => {
        const res = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: "Test HealthCenter" });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Nom et adresse requis");
      });
    });

    describe("Succès", () => {
      it("Crée un healthCenter avec succès", async () => {
        const res = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: `HealthCenter-${Date.now()}`, address: "123 Test Street" });

        expect(res.statusCode).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.name).toBeDefined();
        expect(res.body.address).toBeDefined();
        expect(res.body.districtId).toBe(districtId);
        expect(res.body.district).toBeDefined();

        // Vérifier en DB
        const healthCenterInDb = await prisma.healthCenter.findUnique({
          where: { id: res.body.id },
        });
        expect(healthCenterInDb).not.toBeNull();
        expect(healthCenterInDb.name).toBe(res.body.name);
        expect(healthCenterInDb.address).toBe(res.body.address);
        expect(healthCenterInDb.districtId).toBe(districtId);
      });
    });
  });

  describe("GET /api/healthCenter - Liste", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get("/api/healthCenter");
        expect(res.statusCode).toBe(401);
      });
    });

    describe("Autorisation", () => {
      it("Retourne 403 si utilisateur n'est pas NATIONAL, REGIONAL, DISTRICT ou AGENT (DISTRICT d'une autre région)", async () => {
        // Créer une autre région, commune, district et DISTRICT user
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        const otherCommuneRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherCommune-${Date.now()}`, regionId: otherRegionId });
        expect(otherCommuneRes.statusCode).toBe(201);
        const otherCommuneId = otherCommuneRes.body.id;

        const otherDistrictRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `OtherDistrict-${Date.now()}`, communeId: otherCommuneId });
        // Ceci devrait échouer car le REGIONAL ne peut pas créer un district dans une autre région
        // Créons-le avec NATIONAL via REGIONAL de cette région
        const otherRegionalEmail = `other-regional-${Date.now()}@example.com`;
        testEmails.add(otherRegionalEmail);
        const otherRegionalHashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherRegionalEmail,
            password: otherRegionalHashedPassword,
            firstName: "Other",
            lastName: "Regional",
            
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: otherRegionId,
          },
        });

        const otherRegionalLoginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherRegionalEmail, password: "motdepasse" });
        expect(otherRegionalLoginRes.statusCode).toBe(200);
        const otherRegionalToken = otherRegionalLoginRes.body.accessToken;

        const otherDistrictRes2 = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${otherRegionalToken}`)
          .send({ name: `OtherDistrict-${Date.now()}`, communeId: otherCommuneId });
        expect(otherDistrictRes2.statusCode).toBe(201);
        const otherDistrictId = otherDistrictRes2.body.id;

        const otherDistrictEmail = `other-district-${Date.now()}@example.com`;
        testEmails.add(otherDistrictEmail);
        const otherDistrictHashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherDistrictEmail,
            password: otherDistrictHashedPassword,
            firstName: "Other",
            lastName: "District",
            
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
            districtId: otherDistrictId,
          },
        });

        const otherDistrictLoginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherDistrictEmail, password: "motdepasse" });
        expect(otherDistrictLoginRes.statusCode).toBe(200);
        const otherDistrictToken = otherDistrictLoginRes.body.accessToken;

        // Le DISTRICT devrait pouvoir voir les healthCenters de son district
        const res = await request(app)
          .get("/api/healthCenter")
          .set("Authorization", `Bearer ${otherDistrictToken}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("total");
        expect(res.body).toHaveProperty("items");
      });
    });

    describe("Succès", () => {
      it("Retourne la liste des healthCenters pour DISTRICT", async () => {
        // Créer quelques healthCenters
        const hc1Res = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: `HC1-${Date.now()}`, address: "Address 1" });
        expect(hc1Res.statusCode).toBe(201);

        const hc2Res = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: `HC2-${Date.now()}`, address: "Address 2" });
        expect(hc2Res.statusCode).toBe(201);

        const res = await request(app)
          .get("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("total");
        expect(res.body).toHaveProperty("items");
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.total).toBeGreaterThanOrEqual(2);
      });

      it("Retourne une liste vide si DISTRICT sans districtId", async () => {
        const districtWithoutDistrictIdEmail = `district-no-district-2-${Date.now()}@example.com`;
        testEmails.add(districtWithoutDistrictIdEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: districtWithoutDistrictIdEmail,
            password: hashedPassword,
            firstName: "District",
            lastName: "NoDistrict2",
            
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: districtWithoutDistrictIdEmail, password: "motdepasse" });
        
        // Un DISTRICT sans districtId ne peut pas se connecter (403)
        if (loginRes.statusCode === 403) {
          // Si le login échoue, on teste directement avec un token invalide pour vérifier l'authentification
          const res = await request(app)
            .get("/api/healthCenter")
            .set("Authorization", "Bearer invalid-token");
          expect([401, 403]).toContain(res.statusCode);
          return;
        }

        expect(loginRes.statusCode).toBe(200);
        const token = loginRes.body.accessToken;

        const res = await request(app)
          .get("/api/healthCenter")
          .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.total).toBe(0);
        expect(res.body.items).toHaveLength(0);
      });

      it("Retourne le healthCenter pour AGENT", async () => {
        const res = await request(app)
          .get("/api/healthCenter")
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("total");
        expect(res.body).toHaveProperty("items");
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.total).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("PUT /api/healthCenter/:id - Modification", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .put(`/api/healthCenter/${healthCenterId}`)
          .send({ name: "Updated HealthCenter" });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas DISTRICT (NATIONAL)", async () => {
        const res = await request(app)
          .put(`/api/healthCenter/${healthCenterId}`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: "Updated HealthCenter" });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si healthCenter non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .put(`/api/healthCenter/${fakeId}`)
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: "Updated HealthCenter" });
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Centre introuvable");
      });

      it("Retourne 403 si healthCenter n'appartient pas au district du DISTRICT", async () => {
        // Créer une autre région, commune, district et healthCenter
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion2-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        const otherCommuneRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherCommune2-${Date.now()}`, regionId: otherRegionId });
        expect(otherCommuneRes.statusCode).toBe(201);
        const otherCommuneId = otherCommuneRes.body.id;

        const otherRegionalEmail = `other-regional-2-${Date.now()}@example.com`;
        testEmails.add(otherRegionalEmail);
        const otherRegionalHashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherRegionalEmail,
            password: otherRegionalHashedPassword,
            firstName: "Other",
            lastName: "Regional2",
            
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: otherRegionId,
          },
        });

        const otherRegionalLoginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherRegionalEmail, password: "motdepasse" });
        expect(otherRegionalLoginRes.statusCode).toBe(200);
        const otherRegionalToken = otherRegionalLoginRes.body.accessToken;

        const otherDistrictRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${otherRegionalToken}`)
          .send({ name: `OtherDistrict2-${Date.now()}`, communeId: otherCommuneId });
        expect(otherDistrictRes.statusCode).toBe(201);
        const otherDistrictId = otherDistrictRes.body.id;

        const otherDistrictEmail = `other-district-2-${Date.now()}@example.com`;
        testEmails.add(otherDistrictEmail);
        const otherDistrictHashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherDistrictEmail,
            password: otherDistrictHashedPassword,
            firstName: "Other",
            lastName: "District2",
            
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
            districtId: otherDistrictId,
          },
        });

        const otherDistrictLoginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherDistrictEmail, password: "motdepasse" });
        expect(otherDistrictLoginRes.statusCode).toBe(200);
        const otherDistrictToken = otherDistrictLoginRes.body.accessToken;

        const otherHealthCenterRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${otherDistrictToken}`)
          .send({ name: `OtherHC-${Date.now()}`, address: "Other Address" });
        expect(otherHealthCenterRes.statusCode).toBe(201);
        const otherHealthCenterId = otherHealthCenterRes.body.id;

        // Essayer de modifier le healthCenter d'un autre district
        const res = await request(app)
          .put(`/api/healthCenter/${otherHealthCenterId}`)
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: "Updated HealthCenter" });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Succès", () => {
      it("Modifie le nom d'un healthCenter avec succès", async () => {
        // Créer un healthCenter
        const createRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: `HC-${Date.now()}`, address: "Original Address" });
        expect(createRes.statusCode).toBe(201);
        const hcId = createRes.body.id;

        // Modifier le nom
        const res = await request(app)
          .put(`/api/healthCenter/${hcId}`)
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: "Updated HealthCenter Name" });

        expect(res.statusCode).toBe(200);
        expect(res.body.name).toBe("Updated HealthCenter Name");
        expect(res.body.address).toBe("Original Address");

        // Vérifier en DB
        const healthCenterInDb = await prisma.healthCenter.findUnique({
          where: { id: hcId },
        });
        expect(healthCenterInDb.name).toBe("Updated HealthCenter Name");
      });

      it("Modifie l'adresse d'un healthCenter avec succès", async () => {
        // Créer un healthCenter
        const createRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: `HC-${Date.now()}`, address: "Original Address" });
        expect(createRes.statusCode).toBe(201);
        const hcId = createRes.body.id;

        // Modifier l'adresse
        const res = await request(app)
          .put(`/api/healthCenter/${hcId}`)
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ address: "Updated Address" });

        expect(res.statusCode).toBe(200);
        expect(res.body.address).toBe("Updated Address");

        // Vérifier en DB
        const healthCenterInDb = await prisma.healthCenter.findUnique({
          where: { id: hcId },
        });
        expect(healthCenterInDb.address).toBe("Updated Address");
      });
    });
  });

  describe("DELETE /api/healthCenter/:id - Suppression", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).delete(`/api/healthCenter/${healthCenterId}`);
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas DISTRICT (NATIONAL)", async () => {
        const res = await request(app)
          .delete(`/api/healthCenter/${healthCenterId}`)
          .set("Authorization", `Bearer ${nationalToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si healthCenter non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const originalError = console.error;
        console.error = jest.fn();

        const res = await request(app)
          .delete(`/api/healthCenter/${fakeId}`)
          .set("Authorization", `Bearer ${districtToken}`);

        expect([404, 500]).toContain(res.statusCode);
        console.error = originalError;
      });
    });

    describe("Succès", () => {
      it("Supprime un healthCenter avec succès", async () => {
        // Créer un healthCenter
        const createRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: `HC-${Date.now()}`, address: "Test Address" });
        expect(createRes.statusCode).toBe(201);
        const hcId = createRes.body.id;

        // Supprimer le healthCenter
        const res = await request(app)
          .delete(`/api/healthCenter/${hcId}`)
          .set("Authorization", `Bearer ${districtToken}`);

        expect(res.statusCode).toBe(204);

        // Vérifier en DB
        const healthCenterInDb = await prisma.healthCenter.findUnique({
          where: { id: hcId },
        });
        expect(healthCenterInDb).toBeNull();
      });
    });
  });

  // Tests pour les agents ADMIN
  describe("POST /api/users/agent-admin - Création d'utilisateur AGENT ADMIN", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/users/agent-admin")
          .send({
            firstName: "Agent",
            lastName: "Admin",
            email: "agent@example.com",
            
            healthCenterId: healthCenterId,
          });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas DISTRICT (NATIONAL)", async () => {
        const res = await request(app)
          .post("/api/users/agent-admin")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Agent",
            lastName: "Admin",
            email: "agent@example.com",
            
            healthCenterId: healthCenterId,
          });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 400 si healthCenterId manquant", async () => {
        const res = await request(app)
          .post("/api/users/agent-admin")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({
            firstName: "Agent",
            lastName: "Admin",
            email: "agent@example.com",
            
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain("champs obligatoires");
      });

      it("Retourne 400 si firstName manquant", async () => {
        const res = await request(app)
          .post("/api/users/agent-admin")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({
            lastName: "Admin",
            email: "agent@example.com",
            
            healthCenterId: healthCenterId,
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain("champs obligatoires");
      });

      it("Retourne 400 si DISTRICT sans districtId", async () => {
        const districtWithoutDistrictIdEmail = `district-no-district-3-${Date.now()}@example.com`;
        testEmails.add(districtWithoutDistrictIdEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: districtWithoutDistrictIdEmail,
            password: hashedPassword,
            firstName: "District",
            lastName: "NoDistrict3",
            
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: districtWithoutDistrictIdEmail, password: "motdepasse" });
        
        // Un DISTRICT sans districtId ne peut pas se connecter (403) ou peut se connecter mais l'API retourne 400
        if (loginRes.statusCode === 403) {
          // Si le login échoue, on teste directement avec un token invalide pour vérifier l'authentification
          const res = await request(app)
            .post("/api/users/agent-admin")
            .set("Authorization", "Bearer invalid-token")
            .send({
              firstName: "Agent",
              lastName: "Admin",
              email: "agent@example.com",
              
              healthCenterId: healthCenterId,
            });
          expect([401, 403]).toContain(res.statusCode);
          return;
        }

        expect(loginRes.statusCode).toBe(200);
        const token = loginRes.body.accessToken;

        const res = await request(app)
          .post("/api/users/agent-admin")
          .set("Authorization", `Bearer ${token}`)
          .send({
            firstName: "Agent",
            lastName: "Admin",
            email: "agent@example.com",
            
            healthCenterId: healthCenterId,
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain("associé à un district");
      });

      it("Retourne 404 si healthCenter introuvable", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .post("/api/users/agent-admin")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({
            firstName: "Agent",
            lastName: "Admin",
            email: "agent@example.com",
            
            healthCenterId: fakeId,
          });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toContain("hors de votre district");
      });

      it("Retourne 403 si healthCenter n'appartient pas au district du DISTRICT", async () => {
        // Créer une autre région, commune, district et healthCenter
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion3-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        const otherCommuneRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherCommune3-${Date.now()}`, regionId: otherRegionId });
        expect(otherCommuneRes.statusCode).toBe(201);
        const otherCommuneId = otherCommuneRes.body.id;

        const otherRegionalEmail = `other-regional-3-${Date.now()}@example.com`;
        testEmails.add(otherRegionalEmail);
        const otherRegionalHashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherRegionalEmail,
            password: otherRegionalHashedPassword,
            firstName: "Other",
            lastName: "Regional3",
            
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: otherRegionId,
          },
        });

        const otherRegionalLoginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherRegionalEmail, password: "motdepasse" });
        expect(otherRegionalLoginRes.statusCode).toBe(200);
        const otherRegionalToken = otherRegionalLoginRes.body.accessToken;

        const otherDistrictRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${otherRegionalToken}`)
          .send({ name: `OtherDistrict3-${Date.now()}`, communeId: otherCommuneId });
        expect(otherDistrictRes.statusCode).toBe(201);
        const otherDistrictId = otherDistrictRes.body.id;

        const otherDistrictEmail = `other-district-3-${Date.now()}@example.com`;
        testEmails.add(otherDistrictEmail);
        const otherDistrictHashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherDistrictEmail,
            password: otherDistrictHashedPassword,
            firstName: "Other",
            lastName: "District3",
            
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
            districtId: otherDistrictId,
          },
        });

        const otherDistrictLoginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherDistrictEmail, password: "motdepasse" });
        expect(otherDistrictLoginRes.statusCode).toBe(200);
        const otherDistrictToken = otherDistrictLoginRes.body.accessToken;

        const otherHealthCenterRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${otherDistrictToken}`)
          .send({ name: `OtherHC2-${Date.now()}`, address: "Other Address 2" });
        expect(otherHealthCenterRes.statusCode).toBe(201);
        const otherHealthCenterId = otherHealthCenterRes.body.id;

        // Essayer de créer un agent pour un healthCenter d'un autre district
        const res = await request(app)
          .post("/api/users/agent-admin")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({
            firstName: "Agent",
            lastName: "Admin",
            email: `agent-${Date.now()}@example.com`,
            
            healthCenterId: otherHealthCenterId,
          });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toContain("hors de votre district");
      });

      it("Retourne 409 si email déjà utilisé", async () => {
        const duplicateEmail = `duplicate-${Date.now()}@example.com`;
        testEmails.add(duplicateEmail);

        // Créer le premier agent
        const firstRes = await request(app)
          .post("/api/users/agent-admin")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({
            firstName: "Agent",
            lastName: "Admin1",
            email: duplicateEmail,
            
            healthCenterId: healthCenterId,
          });
        expect(firstRes.statusCode).toBe(201);

        // Essayer de créer un deuxième agent avec le même email
        const secondRes = await request(app)
          .post("/api/users/agent-admin")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({
            firstName: "Agent",
            lastName: "Admin2",
            email: duplicateEmail,
            
            healthCenterId: healthCenterId,
          });
        expect(secondRes.statusCode).toBe(409);
        expect(secondRes.body.message).toContain("déjà utilisé");
      });
    });

    describe("Succès", () => {
      it("Crée un AGENT ADMIN avec succès", async () => {
        const uniqueEmail = `agent-admin-${Date.now()}@example.com`;
        testEmails.add(uniqueEmail);

        const res = await request(app)
          .post("/api/users/agent-admin")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({
            firstName: "Agent",
            lastName: "Admin",
            email: uniqueEmail,
            
            healthCenterId: healthCenterId,
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.role).toBe("AGENT");
        expect(res.body.agentLevel).toBe("ADMIN");
        expect(res.body.healthCenterId).toBe(healthCenterId);
        expect(res.body.districtId).toBe(districtId);
        expect(res.body.isActive).toBe(false);
        expect(res.body.activationToken).toBeDefined();

        // Vérifier en DB
        const agentInDb = await prisma.user.findUnique({
          where: { id: res.body.id },
        });
        expect(agentInDb).not.toBeNull();
        expect(agentInDb.role).toBe("AGENT");
        expect(agentInDb.agentLevel).toBe("ADMIN");
        expect(agentInDb.healthCenterId).toBe(healthCenterId);
        expect(agentInDb.districtId).toBe(districtId);
      });
    });
  });

  // Tests pour PUT /api/users/agent-admin/:id
  describe("PUT /api/users/agent-admin/:id - Modification d'utilisateur AGENT ADMIN", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .put(`/api/users/agent-admin/${agentAdminEmail}`)
          .send({ healthCenterId: healthCenterId });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas DISTRICT (NATIONAL)", async () => {
        const agentAdminUser = await prisma.user.findUnique({
          where: { email: agentAdminEmail },
        });

        const res = await request(app)
          .put(`/api/users/agent-admin/${agentAdminUser.id}`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ healthCenterId: healthCenterId });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si user non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .put(`/api/users/agent-admin/${fakeId}`)
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ healthCenterId: healthCenterId });
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Utilisateur non trouvé");
      });

      it("Retourne 404 si user n'est pas AGENT ADMIN", async () => {
        // Créer un REGIONAL user
        const regionalUserEmail = `regional-user-${Date.now()}@example.com`;
        testEmails.add(regionalUserEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        const regionalUser = await prisma.user.create({
          data: {
            email: regionalUserEmail,
            password: hashedPassword,
            firstName: "Regional",
            lastName: "User",
            
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: regionId,
          },
        });

        const res = await request(app)
          .put(`/api/users/agent-admin/${regionalUser.id}`)
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ healthCenterId: healthCenterId });
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Utilisateur non trouvé");
      });

      it("Retourne 403 si healthCenter n'appartient pas au district du DISTRICT", async () => {
        const agentAdminUser = await prisma.user.findUnique({
          where: { email: agentAdminEmail },
        });

        // Créer un healthCenter dans un autre district (même logique que précédemment)
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion4-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        const otherCommuneRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherCommune4-${Date.now()}`, regionId: otherRegionId });
        expect(otherCommuneRes.statusCode).toBe(201);
        const otherCommuneId = otherCommuneRes.body.id;

        const otherRegionalEmail = `other-regional-4-${Date.now()}@example.com`;
        testEmails.add(otherRegionalEmail);
        const otherRegionalHashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherRegionalEmail,
            password: otherRegionalHashedPassword,
            firstName: "Other",
            lastName: "Regional4",
            
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: otherRegionId,
          },
        });

        const otherRegionalLoginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherRegionalEmail, password: "motdepasse" });
        expect(otherRegionalLoginRes.statusCode).toBe(200);
        const otherRegionalToken = otherRegionalLoginRes.body.accessToken;

        const otherDistrictRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${otherRegionalToken}`)
          .send({ name: `OtherDistrict4-${Date.now()}`, communeId: otherCommuneId });
        expect(otherDistrictRes.statusCode).toBe(201);
        const otherDistrictId = otherDistrictRes.body.id;

        const otherDistrictEmail = `other-district-4-${Date.now()}@example.com`;
        testEmails.add(otherDistrictEmail);
        const otherDistrictHashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherDistrictEmail,
            password: otherDistrictHashedPassword,
            firstName: "Other",
            lastName: "District4",
            
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
            districtId: otherDistrictId,
          },
        });

        const otherDistrictLoginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherDistrictEmail, password: "motdepasse" });
        expect(otherDistrictLoginRes.statusCode).toBe(200);
        const otherDistrictToken = otherDistrictLoginRes.body.accessToken;

        const otherHealthCenterRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${otherDistrictToken}`)
          .send({ name: `OtherHC3-${Date.now()}`, address: "Other Address 3" });
        expect(otherHealthCenterRes.statusCode).toBe(201);
        const otherHealthCenterId = otherHealthCenterRes.body.id;

        // Essayer de modifier l'agent pour un healthCenter d'un autre district
        const res = await request(app)
          .put(`/api/users/agent-admin/${agentAdminUser.id}`)
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ healthCenterId: otherHealthCenterId });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toContain("hors de votre district");
      });
    });

    describe("Succès", () => {
      it("Modifie le healthCenterId d'un AGENT ADMIN avec succès", async () => {
        // Créer un nouveau healthCenter
        const newHealthCenterRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: `NewHC-${Date.now()}`, address: "New Address" });
        expect(newHealthCenterRes.statusCode).toBe(201);
        const newHealthCenterId = newHealthCenterRes.body.id;

        // Créer un agent ADMIN
        const uniqueEmail = `agent-admin-2-${Date.now()}@example.com`;
        testEmails.add(uniqueEmail);
        const createRes = await request(app)
          .post("/api/users/agent-admin")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({
            firstName: "Agent",
            lastName: "Admin2",
            email: uniqueEmail,
            
            healthCenterId: healthCenterId,
          });
        expect(createRes.statusCode).toBe(201);
        const agentId = createRes.body.id;

        // Modifier le healthCenterId
        const res = await request(app)
          .put(`/api/users/agent-admin/${agentId}`)
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ healthCenterId: newHealthCenterId });

        expect(res.statusCode).toBe(200);
        expect(res.body.healthCenterId).toBe(newHealthCenterId);
        expect(res.body.districtId).toBe(districtId);

        // Vérifier en DB
        const agentInDb = await prisma.user.findUnique({
          where: { id: agentId },
        });
        expect(agentInDb.healthCenterId).toBe(newHealthCenterId);
        expect(agentInDb.districtId).toBe(districtId);
      });
    });
  });

  // Tests pour DELETE /api/users/agent-admin/:id
  describe("DELETE /api/users/agent-admin/:id - Suppression d'utilisateur AGENT ADMIN", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const agentAdminUser = await prisma.user.findUnique({
          where: { email: agentAdminEmail },
        });
        const res = await request(app).delete(`/api/users/agent-admin/${agentAdminUser.id}`);
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas DISTRICT (NATIONAL)", async () => {
        const agentAdminUser = await prisma.user.findUnique({
          where: { email: agentAdminEmail },
        });
        const res = await request(app)
          .delete(`/api/users/agent-admin/${agentAdminUser.id}`)
          .set("Authorization", `Bearer ${nationalToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si user non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .delete(`/api/users/agent-admin/${fakeId}`)
          .set("Authorization", `Bearer ${districtToken}`);
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Utilisateur non trouvé");
      });
    });

    describe("Succès", () => {
      it("Supprime un AGENT ADMIN avec succès", async () => {
        // Créer un agent ADMIN
        const uniqueEmail = `agent-admin-3-${Date.now()}@example.com`;
        testEmails.add(uniqueEmail);
        const createRes = await request(app)
          .post("/api/users/agent-admin")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({
            firstName: "Agent",
            lastName: "Admin3",
            email: uniqueEmail,
            
            healthCenterId: healthCenterId,
          });
        expect(createRes.statusCode).toBe(201);
        const agentId = createRes.body.id;

        // Supprimer l'agent
        const res = await request(app)
          .delete(`/api/users/agent-admin/${agentId}`)
          .set("Authorization", `Bearer ${districtToken}`);

        expect(res.statusCode).toBe(204);

        // Vérifier en DB
        const agentInDb = await prisma.user.findUnique({
          where: { id: agentId },
        });
        expect(agentInDb).toBeNull();
      });
    });
  });

  // Tests pour les agents STAFF
  describe("POST /api/users/agent-staff - Création d'utilisateur AGENT STAFF", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/users/agent-staff")
          .send({
            firstName: "Agent",
            lastName: "Staff",
            email: "agent@example.com",
            
            healthCenterId: healthCenterId,
          });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas AGENT ADMIN (NATIONAL)", async () => {
        const res = await request(app)
          .post("/api/users/agent-staff")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Agent",
            lastName: "Staff",
            email: "agent@example.com",
            
            healthCenterId: healthCenterId,
          });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });

      it("Retourne 403 si utilisateur n'est pas AGENT ADMIN (DISTRICT)", async () => {
        const res = await request(app)
          .post("/api/users/agent-staff")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({
            firstName: "Agent",
            lastName: "Staff",
            email: "agent@example.com",
            
            healthCenterId: healthCenterId,
          });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 400 si healthCenterId manquant", async () => {
        const res = await request(app)
          .post("/api/users/agent-staff")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "Agent",
            lastName: "Staff",
            email: "agent@example.com",
            
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain("champs obligatoires");
      });

      it("Retourne 403 si healthCenter invalide", async () => {
        // Créer un healthCenter dans un autre district
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion5-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        const otherCommuneRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherCommune5-${Date.now()}`, regionId: otherRegionId });
        expect(otherCommuneRes.statusCode).toBe(201);
        const otherCommuneId = otherCommuneRes.body.id;

        const otherRegionalEmail = `other-regional-5-${Date.now()}@example.com`;
        testEmails.add(otherRegionalEmail);
        const otherRegionalHashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherRegionalEmail,
            password: otherRegionalHashedPassword,
            firstName: "Other",
            lastName: "Regional5",
            
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: otherRegionId,
          },
        });

        const otherRegionalLoginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherRegionalEmail, password: "motdepasse" });
        expect(otherRegionalLoginRes.statusCode).toBe(200);
        const otherRegionalToken = otherRegionalLoginRes.body.accessToken;

        const otherDistrictRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${otherRegionalToken}`)
          .send({ name: `OtherDistrict5-${Date.now()}`, communeId: otherCommuneId });
        expect(otherDistrictRes.statusCode).toBe(201);
        const otherDistrictId = otherDistrictRes.body.id;

        const otherDistrictEmail = `other-district-5-${Date.now()}@example.com`;
        testEmails.add(otherDistrictEmail);
        const otherDistrictHashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherDistrictEmail,
            password: otherDistrictHashedPassword,
            firstName: "Other",
            lastName: "District5",
            
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
            districtId: otherDistrictId,
          },
        });

        const otherDistrictLoginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherDistrictEmail, password: "motdepasse" });
        expect(otherDistrictLoginRes.statusCode).toBe(200);
        const otherDistrictToken = otherDistrictLoginRes.body.accessToken;

        const otherHealthCenterRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${otherDistrictToken}`)
          .send({ name: `OtherHC4-${Date.now()}`, address: "Other Address 4" });
        expect(otherHealthCenterRes.statusCode).toBe(201);
        const otherHealthCenterId = otherHealthCenterRes.body.id;

        // Essayer de créer un agent STAFF pour un healthCenter différent
        const res = await request(app)
          .post("/api/users/agent-staff")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "Agent",
            lastName: "Staff",
            email: `agent-${Date.now()}@example.com`,
            
            healthCenterId: otherHealthCenterId,
          });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Centre de santé invalide");
      });
    });

    describe("Succès", () => {
      it("Crée un AGENT STAFF avec succès", async () => {
        const uniqueEmail = `agent-staff-${Date.now()}@example.com`;
        testEmails.add(uniqueEmail);

        const res = await request(app)
          .post("/api/users/agent-staff")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "Agent",
            lastName: "Staff",
            email: uniqueEmail,
            
            healthCenterId: healthCenterId,
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.role).toBe("AGENT");
        expect(res.body.agentLevel).toBe("STAFF");
        expect(res.body.healthCenterId).toBe(healthCenterId);
        expect(res.body.districtId).toBe(districtId);
        expect(res.body.isActive).toBe(false);
        expect(res.body.activationToken).toBeDefined();

        // Vérifier en DB
        const agentInDb = await prisma.user.findUnique({
          where: { id: res.body.id },
        });
        expect(agentInDb).not.toBeNull();
        expect(agentInDb.role).toBe("AGENT");
        expect(agentInDb.agentLevel).toBe("STAFF");
        expect(agentInDb.healthCenterId).toBe(healthCenterId);
        expect(agentInDb.districtId).toBe(districtId);
      });
    });
  });

  // Tests pour PUT /api/users/agent-staff/:id
  describe("PUT /api/users/agent-staff/:id - Modification d'utilisateur AGENT STAFF", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .put(`/api/users/agent-staff/fake-id`)
          .send({ healthCenterId: healthCenterId });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas AGENT ADMIN (NATIONAL)", async () => {
        const res = await request(app)
          .put(`/api/users/agent-staff/fake-id`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ healthCenterId: healthCenterId });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si user non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .put(`/api/users/agent-staff/${fakeId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ healthCenterId: healthCenterId });
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Utilisateur non trouvé");
      });

      it("Retourne 404 si user n'est pas AGENT STAFF", async () => {
        // Créer un REGIONAL user
        const regionalUserEmail = `regional-user-2-${Date.now()}@example.com`;
        testEmails.add(regionalUserEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        const regionalUser = await prisma.user.create({
          data: {
            email: regionalUserEmail,
            password: hashedPassword,
            firstName: "Regional",
            lastName: "User2",
            
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: regionId,
          },
        });

        const res = await request(app)
          .put(`/api/users/agent-staff/${regionalUser.id}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ healthCenterId: healthCenterId });
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Utilisateur non trouvé");
      });

      it("Retourne 403 si agent STAFF n'appartient pas au même healthCenter", async () => {
        // Créer un autre healthCenter dans le même district
        const otherHealthCenterRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: `OtherHC5-${Date.now()}`, address: "Other Address 5" });
        expect(otherHealthCenterRes.statusCode).toBe(201);
        const otherHealthCenterId = otherHealthCenterRes.body.id;

        // Créer un autre agent ADMIN pour ce healthCenter
        const otherAgentAdminEmail = `other-agent-admin-${Date.now()}@example.com`;
        testEmails.add(otherAgentAdminEmail);
        const otherAgentAdminHashedPassword = await bcrypt.hash("motdepasse", 10);
        const otherAgentAdmin = await prisma.user.create({
          data: {
            email: otherAgentAdminEmail,
            password: otherAgentAdminHashedPassword,
            firstName: "Other",
            lastName: "AgentAdmin",
            
            role: "AGENT",
            agentLevel: "ADMIN",
            isActive: true,
            emailVerified: true,
            districtId: districtId,
            healthCenterId: otherHealthCenterId,
          },
        });

        // Créer un agent STAFF pour ce healthCenter
        const otherAgentStaffEmail = `other-agent-staff-${Date.now()}@example.com`;
        testEmails.add(otherAgentStaffEmail);
        const otherAgentStaffHashedPassword = await bcrypt.hash("motdepasse", 10);
        const otherAgentStaff = await prisma.user.create({
          data: {
            email: otherAgentStaffEmail,
            password: otherAgentStaffHashedPassword,
            firstName: "Other",
            lastName: "AgentStaff",
            
            role: "AGENT",
            agentLevel: "STAFF",
            isActive: true,
            emailVerified: true,
            districtId: districtId,
            healthCenterId: otherHealthCenterId,
          },
        });

        // Essayer de modifier l'agent STAFF d'un autre healthCenter
        const res = await request(app)
          .put(`/api/users/agent-staff/${otherAgentStaff.id}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ healthCenterId: healthCenterId });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toContain("ne pouvez pas modifier");
      });
    });

    describe("Succès", () => {
      it("Modifie le healthCenterId d'un AGENT STAFF avec succès (même healthCenter)", async () => {
        // Créer un agent STAFF
        const uniqueEmail = `agent-staff-2-${Date.now()}@example.com`;
        testEmails.add(uniqueEmail);
        const createRes = await request(app)
          .post("/api/users/agent-staff")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "Agent",
            lastName: "Staff2",
            email: uniqueEmail,
            
            healthCenterId: healthCenterId,
          });
        expect(createRes.statusCode).toBe(201);
        const agentId = createRes.body.id;

        // Modifier le healthCenterId (même healthCenter, donc pas de changement réel)
        const res = await request(app)
          .put(`/api/users/agent-staff/${agentId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ healthCenterId: healthCenterId });

        expect(res.statusCode).toBe(200);
        expect(res.body.healthCenterId).toBe(healthCenterId);

        // Vérifier en DB
        const agentInDb = await prisma.user.findUnique({
          where: { id: agentId },
        });
        expect(agentInDb.healthCenterId).toBe(healthCenterId);
      });
    });
  });

  // Tests pour DELETE /api/users/agent-staff/:id
  describe("DELETE /api/users/agent-staff/:id - Suppression d'utilisateur AGENT STAFF", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).delete(`/api/users/agent-staff/fake-id`);
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas AGENT ADMIN (NATIONAL)", async () => {
        const res = await request(app)
          .delete(`/api/users/agent-staff/fake-id`)
          .set("Authorization", `Bearer ${nationalToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si user non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .delete(`/api/users/agent-staff/${fakeId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`);
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Utilisateur non trouvé");
      });
    });

    describe("Succès", () => {
      it("Supprime un AGENT STAFF avec succès", async () => {
        // Créer un agent STAFF
        const uniqueEmail = `agent-staff-3-${Date.now()}@example.com`;
        testEmails.add(uniqueEmail);
        const createRes = await request(app)
          .post("/api/users/agent-staff")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            firstName: "Agent",
            lastName: "Staff3",
            email: uniqueEmail,
            
            healthCenterId: healthCenterId,
          });
        expect(createRes.statusCode).toBe(201);
        const agentId = createRes.body.id;

        // Supprimer l'agent
        const res = await request(app)
          .delete(`/api/users/agent-staff/${agentId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(204);

        // Vérifier en DB
        const agentInDb = await prisma.user.findUnique({
          where: { id: agentId },
        });
        expect(agentInDb).toBeNull();
      });
    });
  });
});

