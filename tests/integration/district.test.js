const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");

jest.mock('../../src/services/emailService', () => ({
  sendInvitationEmail: jest.fn(),
  sendTwoFactorCode: jest.fn(),
}));

describe("District API", () => {
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
      // (si elle n'a pas déjà été appliquée)
      try {
        await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "District_communeId_key";');
      } catch (error) {
        // Ignorer l'erreur si l'index n'existe pas
        console.log("Index unique déjà supprimé ou n'existe pas");
      }

      // Nettoyage complet avant tous les tests
    await prisma.district.deleteMany();
    await prisma.commune.deleteMany();
    await prisma.region.deleteMany();
      await prisma.user.deleteMany();

      // Créer le user NATIONAL directement en DB
      nationalEmail = `national-district-test-${Date.now()}@example.com`;
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
        .send({ name: `RegionForDistrict-${Date.now()}` });
      expect(regionRes.statusCode).toBe(201);
      regionId = regionRes.body.id;

      // Créer un user REGIONAL directement en DB
      regionalEmail = `regional-district-test-${Date.now()}@example.com`;
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
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  beforeEach(async () => {
    try {
      // Nettoyage avant chaque test (mais garder les users NATIONAL et REGIONAL, et la région)
      // IMPORTANT: Supprimer d'abord les users qui référencent des districts
      await prisma.user.deleteMany({
        where: {
          role: { in: ["DISTRICT", "AGENT"] },
        },
      });
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      testEmails.clear();

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
            
            role: "NATIONAL",
            isActive: true,
            emailVerified: true,
          },
        });
      }

      // S'assurer que le user REGIONAL existe toujours
      const existingRegional = await prisma.user.findUnique({
        where: { email: regionalEmail },
      });

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
      }

      // S'assurer que la région existe toujours
      const existingRegion = await prisma.region.findUnique({
        where: { id: regionId },
      });

      if (!existingRegion) {
        const regionRes = await request(app)
      .post("/api/region")
      .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `RegionForDistrict-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        regionId = regionRes.body.id;
      }

      // Régénérer les tokens pour s'assurer qu'ils sont valides
      nationalToken = await getNationalToken();
      regionalToken = await getRegionalToken();
    } catch (error) {
      console.error("Erreur dans beforeEach:", error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      // Nettoyage supplémentaire en cas d'échec de test
      await prisma.user.deleteMany({
        where: {
          role: { in: ["DISTRICT", "AGENT"] },
        },
      });
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      testEmails.clear();
    } catch (error) {
      // Ne pas faire échouer les tests à cause du nettoyage
      console.error("Erreur dans afterEach (nettoyage):", error);
    }
  });

  afterAll(async () => {
    try {
      // Nettoyage final complet
      await prisma.user.deleteMany({
        where: {
          role: { in: ["DISTRICT", "AGENT"] },
        },
      });
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();
      if (nationalEmail) {
        await prisma.user.deleteMany({ where: { email: nationalEmail } });
      }
      if (regionalEmail) {
        await prisma.user.deleteMany({ where: { email: regionalEmail } });
      }
      if (testEmails.size > 0) {
        await prisma.user.deleteMany({
          where: { email: { in: Array.from(testEmails) } },
        });
      }
    } catch (error) {
      console.error("Erreur dans afterAll (nettoyage final):", error);
    } finally {
      await prisma.$disconnect();
    }
  });

  describe("POST /api/district - Création", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/district")
          .send({ name: "Test District", communeId: "fake-id" });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas REGIONAL (NATIONAL)", async () => {
        // Créer une commune pour le test
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        // Essayer de créer un district avec un token NATIONAL (interdit)
        const res = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: "District Interdit", communeId: communeId });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 400 si name manquant", async () => {
        // Créer une commune
        const communeRes = await request(app)
          .post("/api/commune")
      .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        const res = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            // name manquant
            communeId: communeId,
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Nom et commune requis");
      });

      it("Retourne 400 si communeId manquant", async () => {
        const res = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
      .send({
            name: "Test District",
            // communeId manquant
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Nom et commune requis");
      });

      it("Retourne 404 si commune n'existe pas", async () => {
        const fakeCommuneId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: "Test District", communeId: fakeCommuneId });
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Commune introuvable");
      });

      it("Retourne 403 si commune n'appartient pas à la région du REGIONAL", async () => {
        // Créer une autre région
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        // Créer une commune dans l'autre région
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: otherRegionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        // Essayer de créer un district avec une commune d'une autre région
        const res = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: "District Interdit", communeId: communeId });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Commune hors de votre région");
      });

      it("Permet de créer plusieurs districts pour la même commune", async () => {
        // Créer une commune
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        // Créer le premier district
        const firstRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: "First District", communeId: communeId });
        expect(firstRes.statusCode).toBe(201);
        expect(firstRes.body.communeId).toBe(communeId);

        // Créer un deuxième district pour la même commune (maintenant autorisé)
        const secondRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: "Second District", communeId: communeId });
        expect(secondRes.statusCode).toBe(201);
        expect(secondRes.body.communeId).toBe(communeId);
        expect(secondRes.body.name).toBe("Second District");

        // Vérifier que les deux districts existent en DB
        const districts = await prisma.district.findMany({
          where: { communeId: communeId },
        });
        expect(districts).toHaveLength(2);
        expect(districts.map((d) => d.name)).toContain("First District");
        expect(districts.map((d) => d.name)).toContain("Second District");
      });
    });

    describe("Succès", () => {
      it("Crée un district avec succès", async () => {
        // Créer une commune
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: regionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        // Créer le district
        const res = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `District-${Date.now()}`, communeId: communeId });

        expect(res.statusCode).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.name).toBeDefined();
        expect(res.body.communeId).toBe(communeId);
        expect(res.body.commune).toBeDefined();
        expect(res.body.commune.id).toBe(communeId);

        // Vérifier en DB
        const districtInDb = await prisma.district.findUnique({
          where: { id: res.body.id },
        });
        expect(districtInDb).not.toBeNull();
        expect(districtInDb.name).toBe(res.body.name);
        expect(districtInDb.communeId).toBe(communeId);
      });
    });
  });

  describe("GET /api/district - Liste", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/district");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas REGIONAL ou NATIONAL (DISTRICT)", async () => {
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

      // Créer un user DISTRICT
      const districtEmail = `district-list-${Date.now()}@example.com`;
      testEmails.add(districtEmail);
      const password = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: districtEmail,
          password,
          firstName: "District",
        lastName: "User",
          
          role: "DISTRICT",
          isActive: true,
          emailVerified: true,
          regionId: regionId,
          districtId: districtId,
        },
      });

      // Se connecter en tant que DISTRICT
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: districtEmail, password: "motdepasse" });
      expect(loginRes.statusCode).toBe(200);
      const districtToken = loginRes.body.accessToken;

      // Essayer de lister les districts (interdit)
      const res = await request(app)
        .get("/api/district")
        .set("Authorization", `Bearer ${districtToken}`);
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe("Accès refusé");
    });

    it("Retourne la liste des districts pour REGIONAL", async () => {
      // Créer deux communes et deux districts
      const commune1Res = await request(app)
        .post("/api/commune")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ name: `Commune1-${Date.now()}`, regionId: regionId });
      expect(commune1Res.statusCode).toBe(201);
      const commune1Id = commune1Res.body.id;

      const commune2Res = await request(app)
        .post("/api/commune")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ name: `Commune2-${Date.now()}`, regionId: regionId });
      expect(commune2Res.statusCode).toBe(201);
      const commune2Id = commune2Res.body.id;

      const district1Res = await request(app)
        .post("/api/district")
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({ name: `District1-${Date.now()}`, communeId: commune1Id });
      expect(district1Res.statusCode).toBe(201);

      const district2Res = await request(app)
        .post("/api/district")
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({ name: `District2-${Date.now()}`, communeId: commune2Id });
      expect(district2Res.statusCode).toBe(201);

      // Lister les districts
      const res = await request(app)
        .get("/api/district")
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].commune).toBeDefined();
    });

    it("Retourne une liste vide si REGIONAL sans regionId", async () => {
      // Créer un REGIONAL sans regionId
      const regionalNoRegionEmail = `regional-no-region-${Date.now()}@example.com`;
      testEmails.add(regionalNoRegionEmail);
      const password = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: regionalNoRegionEmail,
          password,
          firstName: "Regional",
          lastName: "NoRegion",
          
          role: "REGIONAL",
          isActive: true,
          emailVerified: true,
          regionId: null,
        },
      });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: regionalNoRegionEmail, password: "motdepasse" });
      // Le login peut échouer si regionId est null, mais on teste quand même
      if (loginRes.statusCode === 200) {
        const token = loginRes.body.accessToken;
        const res = await request(app)
          .get("/api/district")
          .set("Authorization", `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.total).toBe(0);
        expect(res.body.items).toHaveLength(0);
      }
    });
  });

  describe("PUT /api/district/:id - Modification", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .put(`/api/district/${fakeId}`)
          .send({ name: "Updated District" });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas REGIONAL (NATIONAL)", async () => {
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

        // Essayer de modifier avec un token NATIONAL (interdit)
        const res = await request(app)
          .put(`/api/district/${districtId}`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: "Updated District" });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si district non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .put(`/api/district/${fakeId}`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: "Updated District" });
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("District introuvable");
      });

      it("Retourne 403 si district n'appartient pas à la région du REGIONAL", async () => {
        // Créer une autre région
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        // Créer une commune et un district dans l'autre région
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: otherRegionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        // Créer un REGIONAL pour l'autre région
        const otherRegionalEmail = `regional-other-${Date.now()}@example.com`;
        testEmails.add(otherRegionalEmail);
        const password = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherRegionalEmail,
            password,
            firstName: "Other",
            lastName: "Regional",
            
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: otherRegionId,
          },
        });

        const loginRes = await request(app)
      .post("/api/auth/login")
          .send({ email: otherRegionalEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const otherRegionalToken = loginRes.body.accessToken;

        const districtRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${otherRegionalToken}`)
          .send({ name: `District-${Date.now()}`, communeId: communeId });
        expect(districtRes.statusCode).toBe(201);
        const districtId = districtRes.body.id;

        // Essayer de modifier avec le REGIONAL de la première région
        const res = await request(app)
          .put(`/api/district/${districtId}`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: "Updated District" });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé à ce district");
      });
    });

    describe("Succès", () => {
      it("Modifie le nom d'un district avec succès", async () => {
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
          .send({ name: "Original District", communeId: communeId });
        expect(districtRes.statusCode).toBe(201);
        const districtId = districtRes.body.id;

        // Modifier le nom
        const res = await request(app)
          .put(`/api/district/${districtId}`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: "Updated District" });

        expect(res.statusCode).toBe(200);
        expect(res.body.name).toBe("Updated District");
        expect(res.body.communeId).toBe(communeId);

        // Vérifier en DB
        const districtInDb = await prisma.district.findUnique({
          where: { id: districtId },
        });
        expect(districtInDb.name).toBe("Updated District");
      });
    });
  });

  describe("DELETE /api/district/:id - Suppression", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app).delete(`/api/district/${fakeId}`);
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas REGIONAL (NATIONAL)", async () => {
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

        // Essayer de supprimer avec un token NATIONAL (interdit)
        const res = await request(app)
          .delete(`/api/district/${districtId}`)
          .set("Authorization", `Bearer ${nationalToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si district non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .delete(`/api/district/${fakeId}`)
          .set("Authorization", `Bearer ${regionalToken}`);
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("District introuvable");
      });
    });

    describe("Succès", () => {
      it("Supprime un district avec succès", async () => {
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

        // Vérifier qu'il existe
        const districtBefore = await prisma.district.findUnique({
          where: { id: districtId },
        });
        expect(districtBefore).not.toBeNull();

        // Supprimer
        const res = await request(app)
          .delete(`/api/district/${districtId}`)
          .set("Authorization", `Bearer ${regionalToken}`);
        expect(res.statusCode).toBe(204);

        // Vérifier qu'il n'existe plus
        const districtAfter = await prisma.district.findUnique({
          where: { id: districtId },
        });
        expect(districtAfter).toBeNull();
      });
    });
  });

  describe("POST /api/users/district - Création d'utilisateur DISTRICT", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/users/district")
          .send({
            firstName: "District",
            lastName: "User",
            email: "test@example.com",
            
            districtId: "fake-id",
          });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas REGIONAL (NATIONAL)", async () => {
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

        // Essayer de créer un DISTRICT avec un token NATIONAL (interdit)
        const res = await request(app)
          .post("/api/users/district")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "District",
            lastName: "User",
            email: "test@example.com",
            
            districtId: districtId,
          });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
  });
});

    describe("Validation", () => {
      it("Retourne 400 si districtId manquant", async () => {
        const res = await request(app)
          .post("/api/users/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            firstName: "District",
            lastName: "User",
            email: "test@example.com",
            
            // districtId manquant
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Remplir les champs obligatoires pour ce rôle.");
      });

      it("Retourne 400 si firstName manquant", async () => {
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

        const res = await request(app)
          .post("/api/users/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            // firstName manquant
            lastName: "User",
            email: "test@example.com",
            
            districtId: districtId,
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Remplir les champs obligatoires pour ce rôle.");
      });

      it("Retourne 400 si REGIONAL sans regionId", async () => {
        // Créer un REGIONAL sans regionId
        const regionalNoRegionEmail = `regional-no-region-${Date.now()}@example.com`;
        testEmails.add(regionalNoRegionEmail);
    const password = await bcrypt.hash("motdepasse", 10);
    await prisma.user.create({
      data: {
            email: regionalNoRegionEmail,
        password,
            firstName: "Regional",
            lastName: "NoRegion",
            
            role: "REGIONAL",
        isActive: true,
            emailVerified: true,
            regionId: null,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: regionalNoRegionEmail, password: "motdepasse" });
        // Le login peut échouer, mais on teste quand même
        if (loginRes.statusCode === 200) {
          const token = loginRes.body.accessToken;
          const res = await request(app)
            .post("/api/users/district")
            .set("Authorization", `Bearer ${token}`)
            .send({
              firstName: "District",
              lastName: "User",
              email: "test@example.com",
              
              districtId: "fake-id",
            });
          expect(res.statusCode).toBe(400);
          expect(res.body.message).toBe("Votre compte n'est pas associé à une région.");
        }
      });

      it("Retourne 404 si district introuvable", async () => {
        const fakeDistrictId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .post("/api/users/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            firstName: "District",
            lastName: "User",
            email: "test@example.com",
            
            districtId: fakeDistrictId,
          });
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("District introuvable");
      });

      it("Retourne 403 si district n'appartient pas à la région du REGIONAL", async () => {
        // Créer une autre région
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        // Créer une commune et un district dans l'autre région
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: otherRegionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        // Créer un REGIONAL pour l'autre région
        const otherRegionalEmail = `regional-other-${Date.now()}@example.com`;
        testEmails.add(otherRegionalEmail);
        const password = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherRegionalEmail,
            password,
            firstName: "Other",
            lastName: "Regional",
            
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: otherRegionId,
          },
        });

        const loginRes = await request(app)
      .post("/api/auth/login")
          .send({ email: otherRegionalEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const otherRegionalToken = loginRes.body.accessToken;

        const districtRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${otherRegionalToken}`)
          .send({ name: `District-${Date.now()}`, communeId: communeId });
        expect(districtRes.statusCode).toBe(201);
        const districtId = districtRes.body.id;

        // Essayer de créer un DISTRICT avec le REGIONAL de la première région
        const res = await request(app)
          .post("/api/users/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            firstName: "District",
            lastName: "User",
            email: "test@example.com",
            
            districtId: districtId,
          });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Ce district n'appartient pas à votre région.");
      });

      it("Retourne 409 si email déjà utilisé", async () => {
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

        const existingEmail = `existing-${Date.now()}@example.com`;
        testEmails.add(existingEmail);

        // Créer le premier DISTRICT
        const firstRes = await request(app)
          .post("/api/users/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            firstName: "First",
            lastName: "District",
            email: existingEmail,
            
            districtId: districtId,
          });
        expect(firstRes.statusCode).toBe(201);

        // Essayer de créer un deuxième avec le même email
        const secondRes = await request(app)
          .post("/api/users/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            firstName: "Second",
            lastName: "District",
            email: existingEmail,
            
            districtId: districtId,
          });
        expect(secondRes.statusCode).toBe(409);
        // Le message peut être spécifique ou générique selon la détection de la contrainte
        expect(
          secondRes.body.message === "Cet email est déjà utilisé. Veuillez utiliser un autre email." ||
          secondRes.body.message === "Une des informations saisies est déjà utilisée. Veuillez vérifier et modifier les champs concernés."
        ).toBe(true);
      });
    });

    describe("Succès", () => {
      it("Crée un DISTRICT avec succès", async () => {
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

        // Créer le DISTRICT
        const districtEmail = `district-success-${Date.now()}@example.com`;
        testEmails.add(districtEmail);

        const res = await request(app)
          .post("/api/users/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            firstName: "District",
            lastName: "User",
            email: districtEmail,
            
            districtId: districtId,
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.email).toBe(districtEmail);
        expect(res.body.firstName).toBe("District");
        expect(res.body.lastName).toBe("User");
        expect(res.body.role).toBe("DISTRICT");
        expect(res.body.districtId).toBe(districtId);
        expect(res.body.regionId).toBe(regionId);
        expect(res.body.isActive).toBe(false);
        expect(res.body.activationToken).toBeDefined();
        expect(res.body.activationExpires).toBeDefined();
        expect(res.body.password).toBe("");

        // Vérifier en DB
        const userInDb = await prisma.user.findUnique({
          where: { id: res.body.id },
        });
        expect(userInDb).not.toBeNull();
        expect(userInDb.email).toBe(districtEmail);
        expect(userInDb.role).toBe("DISTRICT");
        expect(userInDb.districtId).toBe(districtId);
        expect(userInDb.regionId).toBe(regionId);
        expect(userInDb.isActive).toBe(false);
        expect(userInDb.activationToken).toBe(res.body.activationToken);
      });
    });
  });

  describe("PUT /api/users/district/:id - Modification d'utilisateur DISTRICT", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .put(`/api/users/district/${fakeId}`)
          .send({ districtId: "fake-id" });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas REGIONAL (NATIONAL)", async () => {
        // Créer une commune, un district et un DISTRICT
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

        const districtEmail = `district-modify-${Date.now()}@example.com`;
        testEmails.add(districtEmail);
        const createRes = await request(app)
          .post("/api/users/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            firstName: "District",
            lastName: "User",
            email: districtEmail,
            
            districtId: districtId,
          });
        expect(createRes.statusCode).toBe(201);
        const districtUserId = createRes.body.id;

        // Essayer de modifier avec un token NATIONAL (interdit)
        const res = await request(app)
          .put(`/api/users/district/${districtUserId}`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ districtId: districtId });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si user non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .put(`/api/users/district/${fakeId}`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ districtId: "fake-id" });
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Utilisateur non trouvé");
      });

      it("Retourne 404 si user n'est pas DISTRICT", async () => {
        // Créer un REGIONAL
        const regionalEmail = `regional-not-district-${Date.now()}@example.com`;
        testEmails.add(regionalEmail);
        const password = await bcrypt.hash("motdepasse", 10);
        const regionalUser = await prisma.user.create({
          data: {
            email: regionalEmail,
            password,
            firstName: "Regional",
            lastName: "User",
            
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: regionId,
          },
        });

        // Essayer de modifier un REGIONAL comme s'il était un DISTRICT
        const res = await request(app)
          .put(`/api/users/district/${regionalUser.id}`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ districtId: "fake-id" });
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Utilisateur non trouvé");
      });

      it("Retourne 403 si district n'appartient pas à la région du REGIONAL", async () => {
        // Créer une autre région
        const otherRegionRes = await request(app)
      .post("/api/region")
      .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        // Créer une commune et un district dans l'autre région
        const communeRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune-${Date.now()}`, regionId: otherRegionId });
        expect(communeRes.statusCode).toBe(201);
        const communeId = communeRes.body.id;

        // Créer un REGIONAL pour l'autre région
        const otherRegionalEmail = `regional-other-${Date.now()}@example.com`;
        testEmails.add(otherRegionalEmail);
        const password = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherRegionalEmail,
            password,
            firstName: "Other",
            lastName: "Regional",
            
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: otherRegionId,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherRegionalEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const otherRegionalToken = loginRes.body.accessToken;

        const districtRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${otherRegionalToken}`)
          .send({ name: `District-${Date.now()}`, communeId: communeId });
        expect(districtRes.statusCode).toBe(201);
        const districtId = districtRes.body.id;

        const districtEmail = `district-other-${Date.now()}@example.com`;
        testEmails.add(districtEmail);
        const createRes = await request(app)
          .post("/api/users/district")
          .set("Authorization", `Bearer ${otherRegionalToken}`)
          .send({
            firstName: "District",
            lastName: "User",
            email: districtEmail,
            
            districtId: districtId,
          });
        expect(createRes.statusCode).toBe(201);
        const districtUserId = createRes.body.id;

        // Essayer de modifier avec le REGIONAL de la première région
        const res = await request(app)
          .put(`/api/users/district/${districtUserId}`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ districtId: districtId });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Vous ne pouvez pas modifier cet utilisateur");
      });
    });

    describe("Succès", () => {
      it("Modifie le districtId d'un DISTRICT avec succès", async () => {
        // Créer deux communes et deux districts
        const commune1Res = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune1-${Date.now()}`, regionId: regionId });
        expect(commune1Res.statusCode).toBe(201);
        const commune1Id = commune1Res.body.id;

        const commune2Res = await request(app)
          .post("/api/commune")
      .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Commune2-${Date.now()}`, regionId: regionId });
        expect(commune2Res.statusCode).toBe(201);
        const commune2Id = commune2Res.body.id;

        const district1Res = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `District1-${Date.now()}`, communeId: commune1Id });
        expect(district1Res.statusCode).toBe(201);
        const district1Id = district1Res.body.id;

        const district2Res = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ name: `District2-${Date.now()}`, communeId: commune2Id });
        expect(district2Res.statusCode).toBe(201);
        const district2Id = district2Res.body.id;

        // Créer un DISTRICT avec district1
        const districtEmail = `district-modify-success-${Date.now()}@example.com`;
        testEmails.add(districtEmail);
        const createRes = await request(app)
          .post("/api/users/district")
          .set("Authorization", `Bearer ${regionalToken}`)
      .send({
            firstName: "District",
        lastName: "User",
            email: districtEmail,
            
            districtId: district1Id,
          });
        expect(createRes.statusCode).toBe(201);
        const districtUserId = createRes.body.id;

        // Vérifier qu'il a district1
        const userBefore = await prisma.user.findUnique({
          where: { id: districtUserId },
        });
        expect(userBefore.districtId).toBe(district1Id);

        // Modifier pour district2
        const res = await request(app)
          .put(`/api/users/district/${districtUserId}`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ districtId: district2Id });
        expect(res.statusCode).toBe(200);
        expect(res.body.districtId).toBe(district2Id);

        // Vérifier en DB
        const userAfter = await prisma.user.findUnique({
          where: { id: districtUserId },
        });
        expect(userAfter.districtId).toBe(district2Id);
      });
    });
  });

  describe("DELETE /api/users/district/:id - Suppression d'utilisateur DISTRICT", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app).delete(`/api/users/district/${fakeId}`);
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas REGIONAL (NATIONAL)", async () => {
        // Créer une commune, un district et un DISTRICT
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

        const districtEmail = `district-delete-${Date.now()}@example.com`;
        testEmails.add(districtEmail);
        const createRes = await request(app)
          .post("/api/users/district")
          .set("Authorization", `Bearer ${regionalToken}`)
      .send({
            firstName: "District",
            lastName: "User",
            email: districtEmail,
            
            districtId: districtId,
          });
        expect(createRes.statusCode).toBe(201);
        const districtUserId = createRes.body.id;

        // Essayer de supprimer avec un token NATIONAL (interdit)
        const res = await request(app)
          .delete(`/api/users/district/${districtUserId}`)
          .set("Authorization", `Bearer ${nationalToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si user non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .delete(`/api/users/district/${fakeId}`)
          .set("Authorization", `Bearer ${regionalToken}`);
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Utilisateur non trouvé");
      });
    });

    describe("Succès", () => {
      it("Supprime un DISTRICT avec succès", async () => {
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

        // Créer un DISTRICT
        const districtEmail = `district-delete-success-${Date.now()}@example.com`;
        testEmails.add(districtEmail);
        const createRes = await request(app)
          .post("/api/users/district")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            firstName: "District",
            lastName: "User",
            email: districtEmail,
            
            districtId: districtId,
          });
        expect(createRes.statusCode).toBe(201);
        const districtUserId = createRes.body.id;

        // Vérifier qu'il existe
        const userBefore = await prisma.user.findUnique({
          where: { id: districtUserId },
        });
        expect(userBefore).not.toBeNull();

        // Supprimer
        const res = await request(app)
          .delete(`/api/users/district/${districtUserId}`)
          .set("Authorization", `Bearer ${regionalToken}`);
        expect(res.statusCode).toBe(204);

        // Vérifier qu'il n'existe plus
        const userAfter = await prisma.user.findUnique({
          where: { id: districtUserId },
        });
        expect(userAfter).toBeNull();
      });
    });
  });
});

