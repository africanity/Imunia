const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");

jest.mock('../../src/services/emailService', () => ({
  sendInvitationEmail: jest.fn(),
  sendTwoFactorCode: jest.fn(),
}));

describe("User API - REGIONAL", () => {
  let nationalEmail;
  let nationalPassword;
  let nationalToken;
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

  beforeAll(async () => {
    // Nettoyage complet avant tous les tests
    await prisma.region.deleteMany();
    await prisma.user.deleteMany();

    // Créer le user NATIONAL directement en DB (pas de route pour ça)
    nationalEmail = `national-user-test-${Date.now()}@example.com`;
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

    // Obtenir le token initial
    nationalToken = await getNationalToken();
  });

  beforeEach(async () => {
    try {
      // Nettoyage avant chaque test (mais garder le user NATIONAL)
      // IMPORTANT: Supprimer d'abord les users qui référencent des régions
      // pour éviter les problèmes de foreign key
      await prisma.user.deleteMany({
        where: {
          role: { in: ["REGIONAL", "DISTRICT", "AGENT"] },
        },
      });
      await prisma.region.deleteMany();
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
            phone: "123456789",
            role: "NATIONAL",
            isActive: true,
            emailVerified: true,
          },
        });
      }

      // Régénérer le token pour s'assurer qu'il est valide
      nationalToken = await getNationalToken();
    } catch (error) {
      console.error("Erreur dans beforeEach:", error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      // Nettoyage supplémentaire en cas d'échec de test
      // Supprimer tous les users REGIONAL/DISTRICT/AGENT qui pourraient rester
      await prisma.user.deleteMany({
        where: {
          role: { in: ["REGIONAL", "DISTRICT", "AGENT"] },
        },
      });
      // Supprimer toutes les régions
      await prisma.region.deleteMany();
      testEmails.clear();
    } catch (error) {
      // Ne pas faire échouer les tests à cause du nettoyage
      console.error("Erreur dans afterEach (nettoyage):", error);
    }
  });

  afterAll(async () => {
    try {
      // Nettoyage final complet
      // Supprimer d'abord les users qui référencent des régions
      await prisma.user.deleteMany({
        where: {
          role: { in: ["REGIONAL", "DISTRICT", "AGENT"] },
        },
      });
      await prisma.region.deleteMany();
      if (nationalEmail) {
        await prisma.user.deleteMany({ where: { email: nationalEmail } });
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

  describe("POST /api/users/regional - Création", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/users/regional")
          .send({
            firstName: "Regional",
            lastName: "User",
            email: "test@example.com",
            phone: "123456789",
            regionId: "fake-id",
          });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL (REGIONAL)", async () => {
        // Créer une région pour le REGIONAL
        const regionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `RegionForRegional-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        const regionId = regionRes.body.id;

        // Créer un REGIONAL et l'activer
        const regionalEmail = `regional-auth-${Date.now()}@example.com`;
        testEmails.add(regionalEmail);
        const password = await bcrypt.hash("motdepasse", 10);
        const regionalUser = await prisma.user.create({
          data: {
            email: regionalEmail,
            password,
            firstName: "Regional",
            lastName: "User",
            phone: "987654321",
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: regionId,
          },
        });

        // Se connecter en tant que REGIONAL
        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: regionalEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const regionalToken = loginRes.body.accessToken;

        // Essayer de créer un REGIONAL (interdit)
        const res = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            firstName: "Another",
            lastName: "Regional",
            email: "another@example.com",
            phone: "111111111",
            regionId: regionId,
          });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 400 si regionId manquant", async () => {
        const res = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Regional",
            lastName: "User",
            email: "test@example.com",
            phone: "123456789",
            // regionId manquant
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Remplir les champs obligatoires pour ce rôle.");
      });

      it("Retourne 400 si firstName manquant", async () => {
        const regionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        const regionId = regionRes.body.id;

        const res = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            // firstName manquant
            lastName: "User",
            email: "test@example.com",
            phone: "123456789",
            regionId: regionId,
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Remplir les champs obligatoires pour ce rôle.");
      });

      it("Retourne 400 si email manquant", async () => {
        const regionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        const regionId = regionRes.body.id;

        const res = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Regional",
            lastName: "User",
            // email manquant
            phone: "123456789",
            regionId: regionId,
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Remplir les champs obligatoires pour ce rôle.");
      });

      it("Retourne 400 si regionId invalide (région n'existe pas)", async () => {
        const fakeRegionId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Regional",
            lastName: "User",
            email: "test@example.com",
            phone: "123456789",
            regionId: fakeRegionId,
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Une référence invalide a été fournie. Veuillez vérifier les informations saisies.");
      });

      it("Retourne 409 si email déjà utilisé", async () => {
        const regionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        const regionId = regionRes.body.id;

        const existingEmail = `existing-${Date.now()}@example.com`;
        testEmails.add(existingEmail);

        // Créer le premier REGIONAL
        const firstRes = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "First",
            lastName: "Regional",
            email: existingEmail,
            phone: "111111111",
            regionId: regionId,
          });
        expect(firstRes.statusCode).toBe(201);

        // Essayer de créer un deuxième avec le même email
        const secondRes = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Second",
            lastName: "Regional",
            email: existingEmail,
            phone: "222222222",
            regionId: regionId,
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
      it("Crée un REGIONAL avec succès", async () => {
        // Créer une région
        const regionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        const regionId = regionRes.body.id;

        // Créer le REGIONAL
        const regionalEmail = `regional-success-${Date.now()}@example.com`;
        testEmails.add(regionalEmail);

        const res = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Regional",
            lastName: "User",
            email: regionalEmail,
            phone: "987654321",
            regionId: regionId,
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.email).toBe(regionalEmail);
        expect(res.body.firstName).toBe("Regional");
        expect(res.body.lastName).toBe("User");
        expect(res.body.role).toBe("REGIONAL");
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
        expect(userInDb.email).toBe(regionalEmail);
        expect(userInDb.role).toBe("REGIONAL");
        expect(userInDb.regionId).toBe(regionId);
        expect(userInDb.isActive).toBe(false);
        expect(userInDb.activationToken).toBe(res.body.activationToken);
      });
    });
  });

  describe("POST /api/users/:id/activate - Activation", () => {
    describe("Validation", () => {
      it("Retourne 400 si password manquant", async () => {
        const regionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        const regionId = regionRes.body.id;

        const regionalEmail = `regional-activate-${Date.now()}@example.com`;
        testEmails.add(regionalEmail);
        const createRes = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Regional",
            lastName: "User",
            email: regionalEmail,
            phone: "987654321",
            regionId: regionId,
          });
        expect(createRes.statusCode).toBe(201);
        const regionalId = createRes.body.id;
        const activationToken = createRes.body.activationToken;

        const res = await request(app)
          .post(`/api/users/${regionalId}/activate`)
          .send({
            token: activationToken,
            // password manquant
            confirmPassword: "motdepasse",
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Les mots de passe ne correspondent pas.");
      });

      it("Retourne 400 si password !== confirmPassword", async () => {
        const regionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        const regionId = regionRes.body.id;

        const regionalEmail = `regional-activate-${Date.now()}@example.com`;
        testEmails.add(regionalEmail);
        const createRes = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Regional",
            lastName: "User",
            email: regionalEmail,
            phone: "987654321",
            regionId: regionId,
          });
        expect(createRes.statusCode).toBe(201);
        const regionalId = createRes.body.id;
        const activationToken = createRes.body.activationToken;

        const res = await request(app)
          .post(`/api/users/${regionalId}/activate`)
          .send({
            token: activationToken,
            password: "motdepasse",
            confirmPassword: "autrepassword",
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Les mots de passe ne correspondent pas.");
      });

      it("Retourne 400 si token invalide", async () => {
        const regionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        const regionId = regionRes.body.id;

        const regionalEmail = `regional-activate-${Date.now()}@example.com`;
        testEmails.add(regionalEmail);
        const createRes = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Regional",
            lastName: "User",
            email: regionalEmail,
            phone: "987654321",
            regionId: regionId,
          });
        expect(createRes.statusCode).toBe(201);
        const regionalId = createRes.body.id;

        const res = await request(app)
          .post(`/api/users/${regionalId}/activate`)
          .send({
            token: "wrong-token",
            password: "motdepasse",
            confirmPassword: "motdepasse",
          });
        expect(res.statusCode).toBe(400);
        // Le message utilise une apostrophe typographique, on vérifie juste le contenu
        expect(res.body.message).toContain("Token");
        expect(res.body.message).toContain("activation invalide");
      });

      it("Retourne 400 si user non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .post(`/api/users/${fakeId}/activate`)
          .send({
            token: "some-token",
            password: "motdepasse",
            confirmPassword: "motdepasse",
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Activation invalide.");
      });

      it("Retourne 400 si user déjà actif", async () => {
        const regionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        const regionId = regionRes.body.id;

        const regionalEmail = `regional-active-${Date.now()}@example.com`;
        testEmails.add(regionalEmail);
        const password = await bcrypt.hash("motdepasse", 10);
        const activeUser = await prisma.user.create({
          data: {
            email: regionalEmail,
            password,
            firstName: "Regional",
            lastName: "User",
            phone: "987654321",
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: regionId,
          },
        });

        const res = await request(app)
          .post(`/api/users/${activeUser.id}/activate`)
          .send({
            token: "some-token",
            password: "motdepasse",
            confirmPassword: "motdepasse",
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Activation invalide.");
      });
    });

    describe("Succès", () => {
      it("Active un REGIONAL avec succès et préserve le regionId", async () => {
        // Créer une région
        const regionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        const regionId = regionRes.body.id;

        // Créer un REGIONAL
        const regionalEmail = `regional-activate-success-${Date.now()}@example.com`;
        testEmails.add(regionalEmail);
        const createRes = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Regional",
            lastName: "User",
            email: regionalEmail,
            phone: "987654321",
            regionId: regionId,
          });
        expect(createRes.statusCode).toBe(201);
        const regionalId = createRes.body.id;
        const activationToken = createRes.body.activationToken;

        // Vérifier l'état avant activation
        const userBefore = await prisma.user.findUnique({
          where: { id: regionalId },
        });
        expect(userBefore.regionId).toBe(regionId);
        expect(userBefore.isActive).toBe(false);

        // Activer
        const res = await request(app)
          .post(`/api/users/${regionalId}/activate`)
          .send({
            token: activationToken,
            password: "motdepasse",
            confirmPassword: "motdepasse",
          });
        expect(res.statusCode).toBe(204);

        // Vérifier l'état après activation
        const userAfter = await prisma.user.findUnique({
          where: { id: regionalId },
        });
        expect(userAfter.isActive).toBe(true);
        expect(userAfter.emailVerified).toBe(true);
        expect(userAfter.activationToken).toBeNull();
        expect(userAfter.activationExpires).toBeNull();
        expect(userAfter.regionId).toBe(regionId); // Le regionId doit être préservé
        expect(userAfter.password).not.toBe("");
        expect(userAfter.password).not.toBe(userBefore.password);
      });
    });
  });

  describe("PUT /api/users/regional/:id - Modification", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .put(`/api/users/regional/${fakeId}`)
          .send({ regionId: "fake-id" });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL (REGIONAL)", async () => {
        // Créer une région
        const regionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        const regionId = regionRes.body.id;

        // Créer un REGIONAL et l'activer
        const regionalEmail = `regional-modify-${Date.now()}@example.com`;
        testEmails.add(regionalEmail);
        const password = await bcrypt.hash("motdepasse", 10);
        const regionalUser = await prisma.user.create({
          data: {
            email: regionalEmail,
            password,
            firstName: "Regional",
            lastName: "User",
            phone: "987654321",
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: regionId,
          },
        });

        // Se connecter en tant que REGIONAL
        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: regionalEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const regionalToken = loginRes.body.accessToken;

        // Essayer de modifier un REGIONAL (interdit)
        const res = await request(app)
          .put(`/api/users/regional/${regionalUser.id}`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({ regionId: regionId });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si user non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .put(`/api/users/regional/${fakeId}`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ regionId: "fake-id" });
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Utilisateur non trouvé");
      });

      it("Retourne 400 si regionId invalide (région n'existe pas)", async () => {
        // Mock console.error pour supprimer les logs attendus du middleware errorHandler
        const originalConsoleError = console.error;
        console.error = jest.fn();

        try {
          // Créer une région et un REGIONAL
          const regionRes = await request(app)
            .post("/api/region")
            .set("Authorization", `Bearer ${nationalToken}`)
            .send({ name: `Region-${Date.now()}` });
          expect(regionRes.statusCode).toBe(201);
          const regionId = regionRes.body.id;

          const regionalEmail = `regional-modify-${Date.now()}@example.com`;
          testEmails.add(regionalEmail);
          const createRes = await request(app)
            .post("/api/users/regional")
            .set("Authorization", `Bearer ${nationalToken}`)
            .send({
              firstName: "Regional",
              lastName: "User",
              email: regionalEmail,
              phone: "987654321",
              regionId: regionId,
            });
          expect(createRes.statusCode).toBe(201);
          const regionalId = createRes.body.id;

          // Essayer de modifier avec un regionId invalide
          const fakeRegionId = "00000000-0000-0000-0000-000000000000";
          const res = await request(app)
            .put(`/api/users/regional/${regionalId}`)
            .set("Authorization", `Bearer ${nationalToken}`)
            .send({ regionId: fakeRegionId });
          expect(res.statusCode).toBe(400);
          expect(res.body.message).toBe("Une référence invalide a été fournie. Veuillez vérifier les informations saisies.");
        } finally {
          // Restaurer console.error
          console.error = originalConsoleError;
        }
      });
    });

    describe("Succès", () => {
      it("Modifie le regionId d'un REGIONAL avec succès", async () => {
        // Créer deux régions
        const region1Res = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region1-${Date.now()}` });
        expect(region1Res.statusCode).toBe(201);
        const region1Id = region1Res.body.id;

        const region2Res = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region2-${Date.now()}` });
        expect(region2Res.statusCode).toBe(201);
        const region2Id = region2Res.body.id;

        // Créer un REGIONAL avec region1
        const regionalEmail = `regional-modify-success-${Date.now()}@example.com`;
        testEmails.add(regionalEmail);
        const createRes = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Regional",
            lastName: "User",
            email: regionalEmail,
            phone: "987654321",
            regionId: region1Id,
          });
        expect(createRes.statusCode).toBe(201);
        const regionalId = createRes.body.id;

        // Vérifier qu'il a region1
        const userBefore = await prisma.user.findUnique({
          where: { id: regionalId },
        });
        expect(userBefore.regionId).toBe(region1Id);

        // Modifier pour region2
        const res = await request(app)
          .put(`/api/users/regional/${regionalId}`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ regionId: region2Id });
        expect(res.statusCode).toBe(200);
        expect(res.body.regionId).toBe(region2Id);

        // Vérifier en DB
        const userAfter = await prisma.user.findUnique({
          where: { id: regionalId },
        });
        expect(userAfter.regionId).toBe(region2Id);
      });
    });
  });

  describe("DELETE /api/users/regional/:id - Suppression", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app).delete(`/api/users/regional/${fakeId}`);
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL (REGIONAL)", async () => {
        // Créer une région
        const regionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        const regionId = regionRes.body.id;

        // Créer un REGIONAL et l'activer
        const regionalEmail = `regional-delete-${Date.now()}@example.com`;
        testEmails.add(regionalEmail);
        const password = await bcrypt.hash("motdepasse", 10);
        const regionalUser = await prisma.user.create({
          data: {
            email: regionalEmail,
            password,
            firstName: "Regional",
            lastName: "User",
            phone: "987654321",
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: regionId,
          },
        });

        // Se connecter en tant que REGIONAL
        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: regionalEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const regionalToken = loginRes.body.accessToken;

        // Essayer de supprimer un REGIONAL (interdit)
        const res = await request(app)
          .delete(`/api/users/regional/${regionalUser.id}`)
          .set("Authorization", `Bearer ${regionalToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si user non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await request(app)
          .delete(`/api/users/regional/${fakeId}`)
          .set("Authorization", `Bearer ${nationalToken}`);
        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("Utilisateur non trouvé");
      });
    });

    describe("Succès", () => {
      it("Supprime un REGIONAL avec succès", async () => {
        // Créer une région
        const regionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `Region-${Date.now()}` });
        expect(regionRes.statusCode).toBe(201);
        const regionId = regionRes.body.id;

        // Créer un REGIONAL
        const regionalEmail = `regional-delete-success-${Date.now()}@example.com`;
        testEmails.add(regionalEmail);
        const createRes = await request(app)
          .post("/api/users/regional")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            firstName: "Regional",
            lastName: "User",
            email: regionalEmail,
            phone: "987654321",
            regionId: regionId,
          });
        expect(createRes.statusCode).toBe(201);
        const regionalId = createRes.body.id;

        // Vérifier qu'il existe
        const userBefore = await prisma.user.findUnique({
          where: { id: regionalId },
        });
        expect(userBefore).not.toBeNull();

        // Supprimer
        const res = await request(app)
          .delete(`/api/users/regional/${regionalId}`)
          .set("Authorization", `Bearer ${nationalToken}`);
        expect(res.statusCode).toBe(204);

        // Vérifier qu'il n'existe plus
        const userAfter = await prisma.user.findUnique({
          where: { id: regionalId },
        });
        expect(userAfter).toBeNull();
      });
    });
  });
});

