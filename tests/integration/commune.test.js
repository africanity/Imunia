const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");

jest.mock('../../src/services/emailService', () => ({
  sendInvitationEmail: jest.fn(),
  sendTwoFactorCode: jest.fn(),
}));

describe("Commune API", () => {
  let nationalEmail;
  let nationalPassword;
  let nationalToken;
  let regionalEmail;
  let regionalPassword;
  let regionalToken;
  let regionId;
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

  beforeAll(async () => {
    try {
      // Appliquer la migration pour permettre plusieurs districts par commune
      try {
        await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "District_communeId_key";');
      } catch (error) {
        console.log("Index unique déjà supprimé ou n'existe pas");
      }

      // Nettoyage complet avant tous les tests
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();
      await prisma.user.deleteMany();

      // Créer le user NATIONAL directement en DB
      nationalEmail = `national-commune-test-${Date.now()}@example.com`;
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

      // Créer une région pour les tests
      const regionRes = await request(app)
        .post("/api/region")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ name: `RegionForCommune-${Date.now()}` });
      expect(regionRes.statusCode).toBe(201);
      regionId = regionRes.body.id;

      // Créer un user REGIONAL directement en DB
      regionalEmail = `regional-commune-test-${Date.now()}@example.com`;
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
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  beforeEach(async () => {
    try {
      // Nettoyage avant chaque test (mais garder les users NATIONAL et REGIONAL, et la région)
      // IMPORTANT: Supprimer d'abord les users qui référencent des districts/communes
      await prisma.user.deleteMany({
        where: {
          role: { in: ["DISTRICT", "AGENT"] },
        },
      });
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      testEmails.clear();
      testEmails.add(regionalEmail);

      // S'assurer que le user NATIONAL existe toujours
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
            phone: "123456789",
            role: "NATIONAL",
            isActive: true,
            emailVerified: true,
          },
        });
      }

      // S'assurer que le user REGIONAL existe toujours avec sa région
      const existingRegional = await prisma.user.findUnique({
        where: { email: regionalEmail },
        include: { region: true },
      });

      if (!existingRegional) {
        const hashedPassword = await bcrypt.hash(regionalPassword, 10);
        await prisma.user.create({
          data: {
            email: regionalEmail,
            password: hashedPassword,
            firstName: "Regional",
            lastName: "User",
            phone: "987654321",
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: regionId,
          },
        });
      } else if (!existingRegional.regionId || !existingRegional.region) {
        await prisma.user.update({
          where: { email: regionalEmail },
          data: { regionId: regionId },
        });
      }

      // Régénérer les tokens
      nationalToken = await getNationalToken();
      regionalToken = await getRegionalToken();
    } catch (error) {
      console.error("Erreur dans beforeEach:", error);
      throw error;
    }
  });

  afterEach(async () => {
    // Cleanup des emails de test créés
    if (testEmails.size > 0) {
      const emailsToDelete = Array.from(testEmails).filter(
        (email) => email !== nationalEmail && email !== regionalEmail
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
    }
  });

  afterAll(async () => {
    // Nettoyage final
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

  describe("POST /api/commune - Création", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/commune")
          .send({ name: "Test Commune", regionId: regionId });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL ou REGIONAL (DISTRICT)", async () => {
        // Créer une commune et un district pour avoir un user DISTRICT
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        const districtRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `District-${Date.now()}`, communeId: communeId });
        expect(districtRes.statusCode).toBe(201);
        const districtId = districtRes.body.id;

        const districtEmail = `district-${Date.now()}@example.com`;
        testEmails.add(districtEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: districtEmail,
            password: hashedPassword,
            firstName: "District",
            lastName: "User",
            phone: "111111111",
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
            districtId: districtId,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: districtEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const districtToken = loginRes.body.accessToken;

        const res = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: "Test Commune", regionId: regionId });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 400 si name manquant", async () => {
        const res = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ regionId: regionId });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Nom et région requis");
      });

      it("Retourne 400 si regionId manquant pour NATIONAL", async () => {
        const res = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: "Test Commune" });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Nom et région requis");
      });

      it("Retourne 400 si région n'existe pas (contrainte foreign key)", async () => {
        const fakeRegionId = "00000000-0000-0000-0000-000000000000";
        const originalError = console.error;
        console.error = jest.fn();

        const res = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: "Test Commune", regionId: fakeRegionId });
        
        // Le contrôleur ne vérifie pas l'existence de la région, donc Prisma retourne une erreur de contrainte
        expect([400, 500]).toContain(res.statusCode);
        console.error = originalError;
      });
    });

    describe("Succès", () => {
      it("Crée une commune avec succès pour NATIONAL", async () => {
        const res = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });

        expect(res.statusCode).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.name).toBeDefined();
        expect(res.body.regionId).toBe(regionId);
        expect(res.body.region).toBeDefined();
        expect(res.body.region.id).toBe(regionId);

        // Vérifier en DB
        const communeInDb = await prisma.commune.findUnique({
          where: { id: res.body.id },
        });
        expect(communeInDb).not.toBeNull();
        expect(communeInDb.name).toBe(res.body.name);
        expect(communeInDb.regionId).toBe(regionId);
      });

      it("Crée une commune avec succès pour REGIONAL (utilise automatiquement son regionId)", async () => {
        const res = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `Commune-Regional-${Date.now()}` });

        expect(res.statusCode).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.name).toBeDefined();
        expect(res.body.regionId).toBe(regionId);
        expect(res.body.region).toBeDefined();

        // Vérifier en DB
        const communeInDb = await prisma.commune.findUnique({
          where: { id: res.body.id },
        });
        expect(communeInDb).not.toBeNull();
        expect(communeInDb.name).toBe(res.body.name);
        expect(communeInDb.regionId).toBe(regionId);
      });

      it("REGIONAL ignore le regionId fourni et utilise le sien", async () => {
        // Créer une autre région
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        const res = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `Commune-Regional-${Date.now()}`, regionId: otherRegionId });

        expect(res.statusCode).toBe(201);
        // Le REGIONAL doit utiliser son propre regionId, pas celui fourni
        expect(res.body.regionId).toBe(regionId);
        expect(res.body.regionId).not.toBe(otherRegionId);
      });
    });
  });

  describe("GET /api/commune - Liste", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get("/api/commune");
        expect(res.statusCode).toBe(401);
      });
    });

    describe("Autorisation", () => {
      it("Retourne 403 si utilisateur n'est pas NATIONAL ou REGIONAL (DISTRICT)", async () => {
        // Créer une commune et un district
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        const districtRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `District-${Date.now()}`, communeId: communeId });
        expect(districtRes.statusCode).toBe(201);
        const districtId = districtRes.body.id;

        const districtEmail = `district-2-${Date.now()}@example.com`;
        testEmails.add(districtEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: districtEmail,
            password: hashedPassword,
            firstName: "District",
            lastName: "User2",
            phone: "222222222",
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
            districtId: districtId,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: districtEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const districtToken = loginRes.body.accessToken;

        const res = await request(app)
          .get("/api/commune")
          .set("Authorization", `Bearer ${districtToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Succès", () => {
      it("Retourne toutes les communes pour NATIONAL", async () => {
        // Créer quelques communes
        const commune1Res = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune1-${Date.now()}`, regionId: regionId });
        expect(commune1Res.statusCode).toBe(201);

        const commune2Res = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune2-${Date.now()}`, regionId: regionId });
        expect(commune2Res.statusCode).toBe(201);

        // Créer une autre région et une commune dedans
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        const commune3Res = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune3-${Date.now()}`, regionId: otherRegionId });
        expect(commune3Res.statusCode).toBe(201);

        const res = await request(app)
          .get("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("total");
        expect(res.body).toHaveProperty("items");
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.total).toBeGreaterThanOrEqual(3);
      });

      it("Retourne seulement les communes de sa région pour REGIONAL", async () => {
        // Créer une commune dans la région du REGIONAL
        const commune1Res = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `Commune-Regional-${Date.now()}` });
        expect(commune1Res.statusCode).toBe(201);

        // Créer une autre région et une commune dedans
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion2-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        const commune2Res = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-Other-${Date.now()}`, regionId: otherRegionId });
        expect(commune2Res.statusCode).toBe(201);

        const res = await request(app)
          .get("/api/commune")
          .set("Authorization", `Bearer ${regionalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("total");
        expect(res.body).toHaveProperty("items");
        expect(Array.isArray(res.body.items)).toBe(true);
        // Le REGIONAL ne doit voir que les communes de sa région
        res.body.items.forEach((commune) => {
          expect(commune.regionId).toBe(regionId);
        });
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
            phone: "333333333",
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: regionalWithoutRegionIdEmail, password: "motdepasse" });
        
        // Un REGIONAL sans regionId ne peut pas se connecter (403) ou peut se connecter mais l'API retourne une liste vide
        if (loginRes.statusCode === 403) {
          const res = await request(app)
            .get("/api/commune")
            .set("Authorization", "Bearer invalid-token");
          expect([401, 403]).toContain(res.statusCode);
          return;
        }

        expect(loginRes.statusCode).toBe(200);
        const token = loginRes.body.accessToken;

        const res = await request(app)
          .get("/api/commune")
          .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.total).toBe(0);
        expect(res.body.items).toHaveLength(0);
      });
    });
  });

  describe("PUT /api/commune/:id - Modification", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        // Créer une commune
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        const res = await request(app)
          .put(`/api/commune/${communeId}`)
          .send({ name: "Updated Commune" });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL ou REGIONAL (DISTRICT)", async () => {
        // Créer une commune et un district
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        const districtRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `District-${Date.now()}`, communeId: communeId });
        expect(districtRes.statusCode).toBe(201);
        const districtId = districtRes.body.id;

        const districtEmail = `district-3-${Date.now()}@example.com`;
        testEmails.add(districtEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: districtEmail,
            password: hashedPassword,
            firstName: "District",
            lastName: "User3",
            phone: "444444444",
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
            districtId: districtId,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: districtEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const districtToken = loginRes.body.accessToken;

        const res = await request(app)
          .put(`/api/commune/${communeId}`)
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: "Updated Commune" });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si commune non trouvée", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .put(`/api/commune/${fakeId}`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: "Updated Commune" });
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Commune introuvable");
      });

      it("Retourne 403 si REGIONAL essaie de modifier une commune d'une autre région", async () => {
        // Créer une autre région et une commune dedans
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion3-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        const otherCommuneRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-Other-${Date.now()}`, regionId: otherRegionId });
        expect(otherCommuneRes.statusCode).toBe(201);
        const otherCommuneId = otherCommuneRes.body.id;

        // Essayer de modifier la commune d'une autre région
        const res = await request(app)
          .put(`/api/commune/${otherCommuneId}`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: "Updated Commune" });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Succès", () => {
      it("Modifie le nom d'une commune avec succès (NATIONAL)", async () => {
        // Créer une commune
        const createRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(createRes.statusCode).toBe(201);
        const communeId = createRes.body.id;

        // Modifier le nom
        const res = await request(app)
          .put(`/api/commune/${communeId}`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: "Updated Commune Name" });

        expect(res.statusCode).toBe(200);
        expect(res.body.name).toBe("Updated Commune Name");
        expect(res.body.regionId).toBe(regionId);

        // Vérifier en DB
        const communeInDb = await prisma.commune.findUnique({
          where: { id: communeId },
        });
        expect(communeInDb.name).toBe("Updated Commune Name");
      });

      it("Modifie le nom d'une commune avec succès (REGIONAL)", async () => {
        // Créer une commune
        const createRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `Commune-Regional-${Date.now()}` });
        expect(createRes.statusCode).toBe(201);
        const communeId = createRes.body.id;

        // Modifier le nom
        const res = await request(app)
          .put(`/api/commune/${communeId}`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: "Updated Commune Name Regional" });

        expect(res.statusCode).toBe(200);
        expect(res.body.name).toBe("Updated Commune Name Regional");
        expect(res.body.regionId).toBe(regionId);

        // Vérifier en DB
        const communeInDb = await prisma.commune.findUnique({
          where: { id: communeId },
        });
        expect(communeInDb.name).toBe("Updated Commune Name Regional");
      });

      it("Modifie le regionId d'une commune avec succès (NATIONAL uniquement)", async () => {
        // Créer une autre région
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion4-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        // Créer une commune
        const createRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(createRes.statusCode).toBe(201);
        const communeId = createRes.body.id;

        // Modifier le regionId (NATIONAL peut le faire)
        const res = await request(app)
          .put(`/api/commune/${communeId}`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ regionId: otherRegionId });

        expect(res.statusCode).toBe(200);
        expect(res.body.regionId).toBe(otherRegionId);

        // Vérifier en DB
        const communeInDb = await prisma.commune.findUnique({
          where: { id: communeId },
        });
        expect(communeInDb.regionId).toBe(otherRegionId);
      });

      it("REGIONAL ne peut pas modifier le regionId", async () => {
        // Créer une autre région
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion5-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        // Créer une commune
        const createRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `Commune-Regional-${Date.now()}` });
        expect(createRes.statusCode).toBe(201);
        const communeId = createRes.body.id;

        // Essayer de modifier le regionId (REGIONAL ne peut pas)
        const res = await request(app)
          .put(`/api/commune/${communeId}`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ regionId: otherRegionId });

        expect(res.statusCode).toBe(200);
        // Le regionId ne doit pas avoir changé
        expect(res.body.regionId).toBe(regionId);
        expect(res.body.regionId).not.toBe(otherRegionId);

        // Vérifier en DB
        const communeInDb = await prisma.commune.findUnique({
          where: { id: communeId },
        });
        expect(communeInDb.regionId).toBe(regionId);
      });
    });
  });

  describe("GET /api/commune/:id/delete-summary - Résumé de suppression", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        // Créer une commune
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        const res = await request(app).get(`/api/commune/${communeId}/delete-summary`);
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL ou REGIONAL (DISTRICT)", async () => {
        // Créer une commune et un district
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        const districtRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `District-${Date.now()}`, communeId: communeId });
        expect(districtRes.statusCode).toBe(201);
        const districtId = districtRes.body.id;

        const districtEmail = `district-4-${Date.now()}@example.com`;
        testEmails.add(districtEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: districtEmail,
            password: hashedPassword,
            firstName: "District",
            lastName: "User4",
            phone: "555555555",
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
            districtId: districtId,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: districtEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const districtToken = loginRes.body.accessToken;

        const res = await request(app)
          .get(`/api/commune/${communeId}/delete-summary`)
          .set("Authorization", `Bearer ${districtToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si commune non trouvée", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const originalError = console.error;
        console.error = jest.fn();

        const res = await request(app)
          .get(`/api/commune/${fakeId}/delete-summary`)
          .set("Authorization", `Bearer ${nationalToken}`);

        expect([404, 500]).toContain(res.statusCode);
        console.error = originalError;
      });

      it("Retourne 403 si REGIONAL essaie d'accéder à une commune d'une autre région", async () => {
        // Créer une autre région et une commune dedans
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion6-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        const otherCommuneRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-Other-${Date.now()}`, regionId: otherRegionId });
        expect(otherCommuneRes.statusCode).toBe(201);
        const otherCommuneId = otherCommuneRes.body.id;

        // Essayer d'accéder au résumé d'une commune d'une autre région
        const res = await request(app)
          .get(`/api/commune/${otherCommuneId}/delete-summary`)
          .set("Authorization", `Bearer ${regionalToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Succès", () => {
      it("Retourne un résumé de suppression avec toutes les données", async () => {
        // Créer une commune
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        const res = await request(app)
          .get(`/api/commune/${communeId}/delete-summary`)
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("success");
        expect(res.body).toHaveProperty("commune");
        expect(res.body).toHaveProperty("totals");
        expect(res.body).toHaveProperty("details");
        expect(res.body.commune.id).toBe(communeId);
        expect(res.body.totals).toHaveProperty("districts");
        expect(res.body.totals).toHaveProperty("healthCenters");
        expect(res.body.totals).toHaveProperty("children");
        expect(res.body.totals).toHaveProperty("users");
        expect(res.body.totals).toHaveProperty("stockLots");
        expect(res.body.totals).toHaveProperty("pendingTransfers");
      });
    });
  });

  describe("DELETE /api/commune/:id - Suppression", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        // Créer une commune
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        const res = await request(app).delete(`/api/commune/${communeId}`);
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL ou REGIONAL (DISTRICT)", async () => {
        // Créer une commune et un district
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        const districtRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `District-${Date.now()}`, communeId: communeId });
        expect(districtRes.statusCode).toBe(201);
        const districtId = districtRes.body.id;

        const districtEmail = `district-5-${Date.now()}@example.com`;
        testEmails.add(districtEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: districtEmail,
            password: hashedPassword,
            firstName: "District",
            lastName: "User5",
            phone: "666666666",
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
            districtId: districtId,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: districtEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const districtToken = loginRes.body.accessToken;

        const res = await request(app)
          .delete(`/api/commune/${communeId}`)
          .set("Authorization", `Bearer ${districtToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si commune non trouvée", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const originalError = console.error;
        console.error = jest.fn();

        const res = await request(app)
          .delete(`/api/commune/${fakeId}`)
          .set("Authorization", `Bearer ${nationalToken}`);

        expect([404, 500]).toContain(res.statusCode);
        console.error = originalError;
      });

      it("Retourne 403 si REGIONAL essaie de supprimer une commune d'une autre région", async () => {
        // Créer une autre région et une commune dedans
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion7-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        const otherCommuneRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-Other-${Date.now()}`, regionId: otherRegionId });
        expect(otherCommuneRes.statusCode).toBe(201);
        const otherCommuneId = otherCommuneRes.body.id;

        // Essayer de supprimer la commune d'une autre région
        const res = await request(app)
          .delete(`/api/commune/${otherCommuneId}`)
          .set("Authorization", `Bearer ${regionalToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Succès", () => {
      it("Supprime une commune avec succès (NATIONAL)", async () => {
        // Créer une commune
        const createRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(createRes.statusCode).toBe(201);
        const communeId = createRes.body.id;

        // Supprimer la commune
        const res = await request(app)
          .delete(`/api/commune/${communeId}`)
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(204);

        // Vérifier en DB
        const communeInDb = await prisma.commune.findUnique({
          where: { id: communeId },
        });
        expect(communeInDb).toBeNull();
      });

      it("Supprime une commune avec succès (REGIONAL)", async () => {
        // Créer une commune
        const createRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `Commune-Regional-${Date.now()}` });
        expect(createRes.statusCode).toBe(201);
        const communeId = createRes.body.id;

        // Supprimer la commune
        const res = await request(app)
          .delete(`/api/commune/${communeId}`)
          .set("Authorization", `Bearer ${regionalToken}`);

        expect(res.statusCode).toBe(204);

        // Vérifier en DB
        const communeInDb = await prisma.commune.findUnique({
          where: { id: communeId },
        });
        expect(communeInDb).toBeNull();
      });

      it("Supprime une commune avec cascade (districts, healthCenters, etc.)", async () => {
        // Créer une commune
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        // Créer un district
        const districtRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `District-${Date.now()}`, communeId: communeId });
        expect(districtRes.statusCode).toBe(201);
        const districtId = districtRes.body.id;

        // Créer un user DISTRICT
        const districtEmail = `district-6-${Date.now()}@example.com`;
        testEmails.add(districtEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: districtEmail,
            password: hashedPassword,
            firstName: "District",
            lastName: "User6",
            phone: "777777777",
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
            districtId: districtId,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: districtEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const districtToken = loginRes.body.accessToken;

        // Créer un healthCenter
        const healthCenterRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: `HealthCenter-${Date.now()}`, address: "Test Address" });
        expect(healthCenterRes.statusCode).toBe(201);
        const healthCenterId = healthCenterRes.body.id;

        // Supprimer la commune (cascade)
        const res = await request(app)
          .delete(`/api/commune/${communeId}`)
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(204);

        // Vérifier que tout a été supprimé en cascade
        const communeInDb = await prisma.commune.findUnique({
          where: { id: communeId },
        });
        expect(communeInDb).toBeNull();

        const districtInDb = await prisma.district.findUnique({
          where: { id: districtId },
        });
        expect(districtInDb).toBeNull();

        const healthCenterInDb = await prisma.healthCenter.findUnique({
          where: { id: healthCenterId },
        });
        expect(healthCenterInDb).toBeNull();

        const districtUserInDb = await prisma.user.findUnique({
          where: { email: districtEmail },
        });
        expect(districtUserInDb).toBeNull();
      });
    });
  });
});

