const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");

jest.mock('../../src/services/emailService', () => ({
  sendInvitationEmail: jest.fn(),
  sendTwoFactorCode: jest.fn(),
  sendPasswordResetCode: jest.fn(),
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

describe("Advice API - Gestion des conseils", () => {
  let nationalEmail;
  let nationalPassword;
  let nationalToken;
  let regionalEmail;
  let regionalPassword;
  let regionalToken;
  let regionId;

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
      // Nettoyage complet avant tous les tests
      await prisma.advice.deleteMany();
      await prisma.user.deleteMany();
      await prisma.region.deleteMany();

      // Créer le user NATIONAL
      nationalEmail = `national-advice-test-${Date.now()}@example.com`;
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

      // Créer une région
      const region = await prisma.region.create({
        data: {
          name: `RegionForAdvice-${Date.now()}`,
        },
      });
      regionId = region.id;

      // Créer le user REGIONAL
      regionalEmail = `regional-advice-test-${Date.now()}@example.com`;
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
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  afterEach(async () => {
    // Ne pas nettoyer dans afterEach car les conseils créés dans beforeEach
    // sont nécessaires pour les tests de modification/suppression
    // Le nettoyage se fera dans afterAll
  });

  afterAll(async () => {
    // Nettoyage final
    await prisma.advice.deleteMany();
    await prisma.user.deleteMany();
    await prisma.region.deleteMany();
    await prisma.$disconnect();
  });

  describe("GET /api/advice - Liste des conseils", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/advice");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas NATIONAL", async () => {
      regionalToken = await getRegionalToken();
      const res = await request(app)
        .get("/api/advice")
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne la liste des conseils pour NATIONAL", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get("/api/advice")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("items");
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(typeof res.body.total).toBe("number");
    });
  });

  describe("POST /api/advice - Créer un conseil", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).post("/api/advice");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas NATIONAL", async () => {
      regionalToken = await getRegionalToken();
      const res = await request(app)
        .post("/api/advice")
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({
          title: "Conseil test",
          content: "Contenu du conseil",
        });

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 400 si titre manquant", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/advice")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          content: "Contenu du conseil",
        });

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 400 si contenu manquant", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/advice")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Conseil test",
        });

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 400 si specificAge et minAge/maxAge sont tous définis", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/advice")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Conseil test",
          content: "Contenu du conseil",
          specificAge: 6,
          minAge: 0,
          maxAge: 12,
          ageUnit: "MONTHS",
        });

      expect(res.statusCode).toBe(400);
    });

    it("Crée un conseil simple avec succès", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/advice")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Conseil de test",
          content: "Contenu du conseil de test",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("title", "Conseil de test");
      expect(res.body).toHaveProperty("content", "Contenu du conseil de test");
      expect(res.body).toHaveProperty("isActive", true);
    });

    it("Crée un conseil avec catégorie et âge spécifique", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/advice")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Conseil pour 6 mois",
          content: "Contenu du conseil",
          category: "Alimentation",
          specificAge: 6,
          ageUnit: "MONTHS",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("category", "Alimentation");
      expect(res.body).toHaveProperty("specificAge", 6);
      expect(res.body).toHaveProperty("ageUnit", "MONTHS");
    });

    it("Crée un conseil avec plage d'âge", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/advice")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Conseil pour 0-12 mois",
          content: "Contenu du conseil",
          minAge: 0,
          maxAge: 12,
          ageUnit: "MONTHS",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("minAge", 0);
      expect(res.body).toHaveProperty("maxAge", 12);
      expect(res.body).toHaveProperty("ageUnit", "MONTHS");
      expect(res.body.specificAge).toBeNull();
    });

    it("Crée un conseil inactif", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/advice")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Conseil inactif",
          content: "Contenu du conseil",
          isActive: false,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("isActive", false);
    });
  });

  describe("PUT /api/advice/:id - Modifier un conseil", () => {
    let adviceId;

    beforeEach(async () => {
      nationalToken = await getNationalToken();
      const createRes = await request(app)
        .post("/api/advice")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Conseil à modifier",
          content: "Contenu original",
        });
      adviceId = createRes.body.id;
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).put(`/api/advice/${adviceId}`);
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas NATIONAL", async () => {
      regionalToken = await getRegionalToken();
      const res = await request(app)
        .put(`/api/advice/${adviceId}`)
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({
          title: "Conseil modifié",
        });

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 404 si conseil introuvable", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .put("/api/advice/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Conseil modifié",
        });

      expect(res.statusCode).toBe(404);
    });

    it("Retourne 400 si specificAge et minAge/maxAge sont tous définis", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .put(`/api/advice/${adviceId}`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          specificAge: 6,
          minAge: 0,
          maxAge: 12,
        });

      expect(res.statusCode).toBe(400);
    });

    it("Met à jour le titre et le contenu avec succès", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .put(`/api/advice/${adviceId}`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Conseil modifié",
          content: "Contenu modifié",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("id", adviceId);
      expect(res.body).toHaveProperty("title", "Conseil modifié");
      expect(res.body).toHaveProperty("content", "Contenu modifié");
    });

    it("Met à jour la catégorie avec succès", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .put(`/api/advice/${adviceId}`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          category: "Santé",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("category", "Santé");
    });

    it("Met à jour l'âge spécifique avec succès", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .put(`/api/advice/${adviceId}`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          specificAge: 12,
          ageUnit: "MONTHS",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("specificAge", 12);
      expect(res.body).toHaveProperty("ageUnit", "MONTHS");
    });

    it("Met à jour la plage d'âge avec succès", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .put(`/api/advice/${adviceId}`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          minAge: 6,
          maxAge: 24,
          ageUnit: "MONTHS",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("minAge", 6);
      expect(res.body).toHaveProperty("maxAge", 24);
      expect(res.body.specificAge).toBeNull();
    });

    it("Met à jour le statut actif/inactif", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .put(`/api/advice/${adviceId}`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          isActive: false,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("isActive", false);
    });
  });

  describe("DELETE /api/advice/:id - Supprimer un conseil", () => {
    let adviceId;

    beforeEach(async () => {
      nationalToken = await getNationalToken();
      const createRes = await request(app)
        .post("/api/advice")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Conseil à supprimer",
          content: "Contenu du conseil",
        });
      adviceId = createRes.body.id;
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).delete(`/api/advice/${adviceId}`);
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas NATIONAL", async () => {
      regionalToken = await getRegionalToken();
      const res = await request(app)
        .delete(`/api/advice/${adviceId}`)
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 404 si conseil introuvable", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .delete("/api/advice/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(404);
    });

    it("Supprime un conseil avec succès", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .delete(`/api/advice/${adviceId}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(204);

      // Vérifier que le conseil est supprimé
      const advice = await prisma.advice.findUnique({
        where: { id: adviceId },
      });
      expect(advice).toBeNull();
    });
  });
});
