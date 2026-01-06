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
  notifyNewCampaign: jest.fn().mockResolvedValue([]),
}));

// Mock du middleware upload - ne simule un fichier que si attach() est utilisé
// Le vrai middleware multer ne définit req.file que si un fichier est uploadé
// Pour les tests, on ne simule pas de fichier par défaut
jest.mock('../../src/middleware/upload', () => ({
  single: jest.fn(() => (req, res, next) => {
    // Ne pas définir req.file par défaut - le laisser undefined
    // Le contrôleur vérifiera req.file et utilisera req.body si req.file est undefined
    next();
  }),
}));

describe("Campaign API - Gestion des campagnes", () => {
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
  let regionId;
  let communeId;
  let districtId;

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

  beforeAll(async () => {
    try {
      // Nettoyage complet avant tous les tests
      await prisma.campaign.deleteMany();
      await prisma.user.deleteMany();
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();

      // Créer le user NATIONAL
      nationalEmail = `national-campaign-test-${Date.now()}@example.com`;
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
      superadminEmail = `superadmin-campaign-test-${Date.now()}@example.com`;
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
          name: `RegionForCampaign-${Date.now()}`,
        },
      });
      regionId = region.id;

      // Créer le user REGIONAL
      regionalEmail = `regional-campaign-test-${Date.now()}@example.com`;
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
          name: `CommuneForCampaign-${Date.now()}`,
          regionId: regionId,
        },
      });
      communeId = commune.id;

      // Créer un district
      const district = await prisma.district.create({
        data: {
          name: `DistrictForCampaign-${Date.now()}`,
          communeId: communeId,
        },
      });
      districtId = district.id;

      // Créer le user DISTRICT
      districtEmail = `district-campaign-test-${Date.now()}@example.com`;
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
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  afterEach(async () => {
    // Nettoyer les campagnes créées pendant les tests
    await prisma.campaign.deleteMany();
  });

  afterAll(async () => {
    // Nettoyage final
    await prisma.campaign.deleteMany();
    await prisma.user.deleteMany();
    await prisma.district.deleteMany();
    await prisma.commune.deleteMany();
    await prisma.region.deleteMany();
    await prisma.$disconnect();
  });

  describe("GET /api/campaigns - Liste des campagnes", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/campaigns");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne toutes les campagnes pour NATIONAL", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get("/api/campaigns")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("campaigns");
      expect(Array.isArray(res.body.campaigns)).toBe(true);
    });

    it("Retourne les campagnes filtrées par région pour REGIONAL", async () => {
      regionalToken = await getRegionalToken();
      const res = await request(app)
        .get("/api/campaigns")
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("campaigns");
      expect(Array.isArray(res.body.campaigns)).toBe(true);
      // Vérifier que toutes les campagnes appartiennent à la région de l'utilisateur
      if (res.body.campaigns.length > 0) {
        expect(res.body.campaigns.every((c) => c.regionId === regionId)).toBe(true);
      }
    });

    it("Retourne les campagnes filtrées par région pour DISTRICT", async () => {
      districtToken = await getDistrictToken();
      const res = await request(app)
        .get("/api/campaigns")
        .set("Authorization", `Bearer ${districtToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("campaigns");
      expect(Array.isArray(res.body.campaigns)).toBe(true);
    });
  });

  describe("POST /api/campaigns - Créer une campagne", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).post("/api/campaigns");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas NATIONAL ou REGIONAL", async () => {
      districtToken = await getDistrictToken();
      const res = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${districtToken}`)
        .send({
          title: "Test Campaign",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        });

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 400 si titre manquant", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          regionId: regionId,
        });

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 400 si date de début manquante", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Test Campaign",
          endDate: "2024-12-31",
          regionId: regionId,
        });

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 400 si date de fin manquante", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Test Campaign",
          startDate: "2024-01-01",
          regionId: regionId,
        });

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 400 si région manquante pour NATIONAL", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Test Campaign",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        });

      expect(res.statusCode).toBe(400);
    });

    it("Crée une campagne avec succès pour NATIONAL", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Campagne Test National",
          description: "Description de la campagne",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          regionId: regionId,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("title", "Campagne Test National");
      expect(res.body).toHaveProperty("regionId", regionId);
      expect(res.body).toHaveProperty("medias");
      expect(Array.isArray(res.body.medias)).toBe(true);
    });

    it("Crée une campagne avec succès pour REGIONAL (utilise sa région)", async () => {
      regionalToken = await getRegionalToken();
      const res = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({
          title: "Campagne Test Regional",
          description: "Description de la campagne régionale",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("title", "Campagne Test Regional");
      expect(res.body).toHaveProperty("regionId", regionId);
    });

    it("Retourne 404 si région introuvable", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Campagne Test",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          regionId: "00000000-0000-0000-0000-000000000000",
        });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PUT /api/campaigns/:id - Modifier une campagne", () => {
    let campaignId;

    beforeEach(async () => {
      nationalToken = await getNationalToken();
      const createRes = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Campagne à modifier",
          description: "Description originale",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          regionId: regionId,
        });
      campaignId = createRes.body.id;
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).put(`/api/campaigns/${campaignId}`);
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas NATIONAL ou REGIONAL", async () => {
      districtToken = await getDistrictToken();
      const res = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set("Authorization", `Bearer ${districtToken}`)
        .send({
          title: "Campagne modifiée",
        });

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 404 si campagne introuvable", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .put("/api/campaigns/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Campagne modifiée",
        });

      expect(res.statusCode).toBe(404);
    });

    it("Retourne 403 si REGIONAL essaie de modifier une campagne d'une autre région", async () => {
      // Créer une autre région et un autre utilisateur régional
      const otherRegion = await prisma.region.create({
        data: {
          name: `OtherRegion-${Date.now()}`,
        },
      });

      const otherRegionalEmail = `other-regional-${Date.now()}@example.com`;
      const hashedPassword = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: otherRegionalEmail,
          password: hashedPassword,
          firstName: "Other",
          lastName: "Regional",
          role: "REGIONAL",
          regionId: otherRegion.id,
          isActive: true,
          emailVerified: true,
        },
      });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: otherRegionalEmail, password: "motdepasse" });
      const otherRegionalToken = loginRes.body.accessToken;

      const res = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set("Authorization", `Bearer ${otherRegionalToken}`)
        .send({
          title: "Campagne modifiée",
        });

      expect(res.statusCode).toBe(403);

      // Nettoyer
      await prisma.user.delete({ where: { email: otherRegionalEmail } });
      await prisma.region.delete({ where: { id: otherRegion.id } });
    });

    it("Met à jour une campagne avec succès pour NATIONAL", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Campagne modifiée",
          description: "Description modifiée",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("id", campaignId);
      expect(res.body).toHaveProperty("title", "Campagne modifiée");
      expect(res.body).toHaveProperty("description", "Description modifiée");
    });

    it("Met à jour une campagne avec succès pour REGIONAL de la même région", async () => {
      regionalToken = await getRegionalToken();
      const res = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({
          title: "Campagne modifiée par régional",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("title", "Campagne modifiée par régional");
    });
  });

  describe("DELETE /api/campaigns/:id - Supprimer une campagne", () => {
    let campaignId;

    beforeEach(async () => {
      nationalToken = await getNationalToken();
      const createRes = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Campagne à supprimer",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          regionId: regionId,
        });
      campaignId = createRes.body.id;
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).delete(`/api/campaigns/${campaignId}`);
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas NATIONAL ou REGIONAL", async () => {
      districtToken = await getDistrictToken();
      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}`)
        .set("Authorization", `Bearer ${districtToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 404 si campagne introuvable", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .delete("/api/campaigns/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(404);
    });

    it("Retourne 403 si REGIONAL essaie de supprimer une campagne d'une autre région", async () => {
      // Créer une autre région et un autre utilisateur régional
      const otherRegion = await prisma.region.create({
        data: {
          name: `OtherRegion-${Date.now()}`,
        },
      });

      const otherRegionalEmail = `other-regional-${Date.now()}@example.com`;
      const hashedPassword = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: otherRegionalEmail,
          password: hashedPassword,
          firstName: "Other",
          lastName: "Regional",
          role: "REGIONAL",
          regionId: otherRegion.id,
          isActive: true,
          emailVerified: true,
        },
      });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: otherRegionalEmail, password: "motdepasse" });
      const otherRegionalToken = loginRes.body.accessToken;

      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}`)
        .set("Authorization", `Bearer ${otherRegionalToken}`);

      expect(res.statusCode).toBe(403);

      // Nettoyer
      await prisma.user.delete({ where: { email: otherRegionalEmail } });
      await prisma.region.delete({ where: { id: otherRegion.id } });
    });

    it("Supprime une campagne avec succès pour NATIONAL", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(204);

      // Vérifier que la campagne est supprimée
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });
      expect(campaign).toBeNull();
    });

    it("Supprime une campagne avec succès pour REGIONAL de la même région", async () => {
      regionalToken = await getRegionalToken();
      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}`)
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(204);
    });
  });

  describe("PATCH /api/campaigns/:id/medias - Ajouter un média", () => {
    let campaignId;

    beforeEach(async () => {
      nationalToken = await getNationalToken();
      const createRes = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Campagne avec médias",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          regionId: regionId,
        });
      campaignId = createRes.body.id;
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).patch(`/api/campaigns/${campaignId}/medias`);
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas NATIONAL ou REGIONAL", async () => {
      districtToken = await getDistrictToken();
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${districtToken}`)
        .send({
          url: "https://example.com/video.mp4",
          type: "video",
          title: "Vidéo test",
        });

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 404 si campagne introuvable", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .patch("/api/campaigns/00000000-0000-0000-0000-000000000000/medias")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          url: "https://example.com/video.mp4",
          type: "video",
          title: "Vidéo test",
        });

      expect(res.statusCode).toBe(404);
    });

    it("Retourne 400 si URL et type manquants (sans fichier uploadé)", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Média test",
        });

      // Le contrôleur vérifie d'abord req.file (undefined), puis req.body.url/type (manquants)
      // Il retourne 400 car ni fichier ni URL/type ne sont présents
      expect(res.statusCode).toBe(400);
    });

    it("Retourne 400 si titre manquant", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          url: "https://example.com/video.mp4",
          type: "video",
          // Pas de title
        });

      // Le contrôleur vérifie le titre après avoir déterminé l'URL et le type
      expect(res.statusCode).toBe(400);
    });

    it("Retourne 400 si type invalide", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          url: "https://example.com/file.txt",
          type: "text",
          title: "Fichier test",
        });

      expect(res.statusCode).toBe(400);
    });

    it("Ajoute un média avec URL et type pour NATIONAL", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          url: "https://example.com/video.mp4",
          type: "video",
          title: "Vidéo de campagne",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("medias");
      expect(Array.isArray(res.body.medias)).toBe(true);
      expect(res.body.medias.length).toBe(1);
      expect(res.body.medias[0]).toHaveProperty("url", "https://example.com/video.mp4");
      expect(res.body.medias[0]).toHaveProperty("type", "video");
      expect(res.body.medias[0]).toHaveProperty("title", "Vidéo de campagne");
    });

    it("Ajoute un média PDF avec URL et type", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          url: "https://example.com/document.pdf",
          type: "pdf",
          title: "Document PDF",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.medias.length).toBe(1);
      expect(res.body.medias[0]).toHaveProperty("type", "pdf");
    });

    it("Retourne 409 si média déjà existant (même URL)", async () => {
      nationalToken = await getNationalToken();
      const url = "https://example.com/duplicate-video.mp4";
      
      // Ajouter le média une première fois
      const firstRes = await request(app)
        .patch(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          url,
          type: "video",
          title: "Vidéo 1",
        });
      
      expect(firstRes.statusCode).toBe(200);

      // Essayer d'ajouter le même média une deuxième fois
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          url,
          type: "video",
          title: "Vidéo 2",
        });

      expect(res.statusCode).toBe(409);
    });

    it("Ajoute un média via URL (simulation d'upload)", async () => {
      nationalToken = await getNationalToken();
      // Pour les tests, on simule un upload en utilisant une URL d'upload
      // Le vrai upload de fichier nécessiterait multer qui est complexe à mocker
      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          url: "/uploads/campaigns/test-upload.pdf",
          type: "pdf",
          title: "Fichier uploadé",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.medias.length).toBeGreaterThan(0);
      expect(res.body.medias.some((m) => m.url.includes("test-upload.pdf"))).toBe(true);
    });
  });

  describe("DELETE /api/campaigns/:id/medias - Supprimer un média", () => {
    let campaignId;
    let mediaUrl;

    beforeEach(async () => {
      nationalToken = await getNationalToken();
      const createRes = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          title: "Campagne avec médias",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          regionId: regionId,
        });
      campaignId = createRes.body.id;

      // Ajouter un média
      const addMediaRes = await request(app)
        .patch(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          url: "https://example.com/video-to-delete.mp4",
          type: "video",
          title: "Vidéo à supprimer",
        });
      mediaUrl = "https://example.com/video-to-delete.mp4";
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).delete(`/api/campaigns/${campaignId}/medias`);
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas NATIONAL ou REGIONAL", async () => {
      districtToken = await getDistrictToken();
      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${districtToken}`)
        .send({
          url: mediaUrl,
        });

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 404 si campagne introuvable", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .delete("/api/campaigns/00000000-0000-0000-0000-000000000000/medias")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          url: mediaUrl,
        });

      expect(res.statusCode).toBe(404);
    });

    it("Retourne 400 si URL manquante", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 404 si média introuvable", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          url: "https://example.com/nonexistent.mp4",
        });

      expect(res.statusCode).toBe(404);
    });

    it("Supprime un média avec succès", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .delete(`/api/campaigns/${campaignId}/medias`)
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({
          url: mediaUrl,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("medias");
      expect(Array.isArray(res.body.medias)).toBe(true);
      expect(res.body.medias.length).toBe(0);
    });
  });
});
