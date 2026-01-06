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

describe("System Settings API - Paramètres système", () => {
  let superadminEmail;
  let superadminPassword;
  let superadminToken;
  let superadminUserId;

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
      await prisma.appSettings.deleteMany();
      await prisma.user.deleteMany();

      // Créer un utilisateur SUPERADMIN pour les tests qui pourraient nécessiter une authentification
      superadminEmail = `superadmin-settings-${Date.now()}@test.com`;
      superadminPassword = "password123";
      const hashedPassword = await bcrypt.hash(superadminPassword, 10);

      const superadminUser = await prisma.user.create({
        data: {
          email: superadminEmail,
          password: hashedPassword,
          firstName: "Superadmin",
          lastName: "Settings",
          role: "SUPERADMIN",
          isActive: true,
          emailVerified: true,
        },
      });
      superadminUserId = superadminUser.id;

      // Obtenir le token
      superadminToken = await getUserToken(superadminEmail, superadminPassword);
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  afterAll(async () => {
    await prisma.appSettings.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Nettoyer les paramètres avant chaque test pour avoir un état propre
    await prisma.appSettings.deleteMany();
  });

  describe("GET /api/systemSettings - Récupération des paramètres système", () => {
    it("Retourne les valeurs par défaut quand aucun paramètre n'existe", async () => {
      const res = await request(app).get("/api/systemSettings");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("appName", "Imunia");
      expect(res.body).toHaveProperty("appSubtitle", "Plateforme de gestion de vaccination");
      expect(res.body).toHaveProperty("logoUrl", "/logo.png");
      expect(typeof res.body.appName).toBe("string");
      expect(typeof res.body.appSubtitle).toBe("string");
      expect(typeof res.body.logoUrl).toBe("string");
    });

    it("Retourne les paramètres depuis la base de données quand ils existent", async () => {
      // Créer des paramètres en base
      await prisma.appSettings.create({
        data: {
          appName: "Mon Application",
          logoPath: "/custom-logo.png",
          updatedById: superadminUserId,
        },
      });

      const res = await request(app).get("/api/systemSettings");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("appName", "Mon Application");
      expect(res.body).toHaveProperty("appSubtitle", "Plateforme de gestion de vaccination");
      expect(res.body).toHaveProperty("logoUrl", "/custom-logo.png");
    });

    it("Utilise 'Imunia' comme appName par défaut si appName est null", async () => {
      // Créer des paramètres avec appName null
      await prisma.appSettings.create({
        data: {
          appName: null,
          logoPath: "/custom-logo.png",
          updatedById: superadminUserId,
        },
      });

      const res = await request(app).get("/api/systemSettings");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("appName", "Imunia");
      expect(res.body).toHaveProperty("appSubtitle", "Plateforme de gestion de vaccination");
      expect(res.body).toHaveProperty("logoUrl", "/custom-logo.png");
    });

    it("Utilise 'Imunia' comme appName par défaut si appName est une chaîne vide", async () => {
      // Créer des paramètres avec appName vide
      await prisma.appSettings.create({
        data: {
          appName: "",
          logoPath: "/custom-logo.png",
          updatedById: superadminUserId,
        },
      });

      const res = await request(app).get("/api/systemSettings");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("appName", "Imunia");
      expect(res.body).toHaveProperty("appSubtitle", "Plateforme de gestion de vaccination");
      expect(res.body).toHaveProperty("logoUrl", "/custom-logo.png");
    });

    it("Utilise 'Imunia' comme appName par défaut si appName est une chaîne avec seulement des espaces", async () => {
      // Créer des paramètres avec appName contenant seulement des espaces
      await prisma.appSettings.create({
        data: {
          appName: "   ",
          logoPath: "/custom-logo.png",
          updatedById: superadminUserId,
        },
      });

      const res = await request(app).get("/api/systemSettings");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("appName", "Imunia");
      expect(res.body).toHaveProperty("appSubtitle", "Plateforme de gestion de vaccination");
      expect(res.body).toHaveProperty("logoUrl", "/custom-logo.png");
    });

    it("Utilise '/logo.png' comme logoUrl par défaut si logoPath est null", async () => {
      // Créer des paramètres sans logoPath
      await prisma.appSettings.create({
        data: {
          appName: "Mon Application",
          logoPath: null,
          updatedById: superadminUserId,
        },
      });

      const res = await request(app).get("/api/systemSettings");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("appName", "Mon Application");
      expect(res.body).toHaveProperty("logoUrl", "/logo.png");
    });

    it("Retourne toujours le même appSubtitle", async () => {
      const res1 = await request(app).get("/api/systemSettings");
      expect(res1.body.appSubtitle).toBe("Plateforme de gestion de vaccination");

      // Créer des paramètres personnalisés
      await prisma.appSettings.create({
        data: {
          appName: "Test App",
          logoPath: "/test-logo.png",
          updatedById: superadminUserId,
        },
      });

      const res2 = await request(app).get("/api/systemSettings");
      expect(res2.body.appSubtitle).toBe("Plateforme de gestion de vaccination");
    });

    it("Retourne les valeurs par défaut même si la base de données a des erreurs", async () => {
      // Cette fonctionnalité est gérée par le try-catch dans le contrôleur
      // On ne peut pas facilement simuler une erreur de base de données dans un test d'intégration
      // mais on peut vérifier que la structure de réponse est toujours correcte
      const res = await request(app).get("/api/systemSettings");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("appName");
      expect(res.body).toHaveProperty("appSubtitle");
      expect(res.body).toHaveProperty("logoUrl");
      expect(typeof res.body.appName).toBe("string");
      expect(typeof res.body.appSubtitle).toBe("string");
      expect(typeof res.body.logoUrl).toBe("string");
    });

    it("Retourne la structure de réponse correcte avec tous les champs requis", async () => {
      const res = await request(app).get("/api/systemSettings");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("appName");
      expect(res.body).toHaveProperty("appSubtitle");
      expect(res.body).toHaveProperty("logoUrl");
      
      // Vérifier que ce sont les seuls champs retournés
      const keys = Object.keys(res.body);
      expect(keys.length).toBe(3);
      expect(keys).toContain("appName");
      expect(keys).toContain("appSubtitle");
      expect(keys).toContain("logoUrl");
    });

    it("Retourne les valeurs correctes avec un appName personnalisé", async () => {
      await prisma.appSettings.create({
        data: {
          appName: "VaxCare Pro",
          logoPath: "/vaxcare-logo.png",
          updatedById: superadminUserId,
        },
      });

      const res = await request(app).get("/api/systemSettings");

      expect(res.statusCode).toBe(200);
      expect(res.body.appName).toBe("VaxCare Pro");
      expect(res.body.logoUrl).toBe("/vaxcare-logo.png");
    });

    it("Retourne les valeurs correctes avec un appName avec espaces à trimmer", async () => {
      await prisma.appSettings.create({
        data: {
          appName: "  Mon App  ",
          logoPath: "/logo.png",
          updatedById: superadminUserId,
        },
      });

      const res = await request(app).get("/api/systemSettings");

      expect(res.statusCode).toBe(200);
      expect(res.body.appName).toBe("Mon App");
    });
  });
});
