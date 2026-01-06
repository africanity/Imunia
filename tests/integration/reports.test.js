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

describe("Reports API - Rapports et statistiques", () => {
  let agentEmail;
  let agentPassword;
  let agentToken;
  let regionalEmail;
  let regionalPassword;
  let regionalToken;
  let districtEmail;
  let districtPassword;
  let districtToken;
  let nationalEmail;
  let nationalPassword;
  let nationalToken;
  let superadminEmail;
  let superadminPassword;
  let superadminToken;
  let regionId;
  let regionName;
  let communeId;
  let districtId;
  let districtName;
  let healthCenterId;
  let healthCenterName;
  let vaccineId;
  let childId;

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
      await prisma.stockReservation.deleteMany();
      await prisma.childVaccineScheduled.deleteMany();
      await prisma.childVaccineCompleted.deleteMany();
      await prisma.childVaccineDue.deleteMany();
      await prisma.childVaccineLate.deleteMany();
      await prisma.childVaccineOverdue.deleteMany();
      await prisma.vaccineRequest.deleteMany();
      await prisma.children.deleteMany();
      await prisma.stockLot.deleteMany();
      await prisma.stockHEALTHCENTER.deleteMany();
      await prisma.stockDISTRICT.deleteMany();
      await prisma.stockREGIONAL.deleteMany();
      await prisma.stockNATIONAL.deleteMany();
      await prisma.user.deleteMany();
      await prisma.healthCenter.deleteMany();
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();
      await prisma.vaccine.deleteMany();

      // Créer une région
      regionName = `RegionReports-${Date.now()}`;
      const region = await prisma.region.create({
        data: {
          name: regionName,
        },
      });
      regionId = region.id;

      // Créer une commune
      const commune = await prisma.commune.create({
        data: {
          name: `CommuneReports-${Date.now()}`,
          regionId: regionId,
        },
      });
      communeId = commune.id;

      // Créer un district
      districtName = `DistrictReports-${Date.now()}`;
      const district = await prisma.district.create({
        data: {
          name: districtName,
          communeId: communeId,
        },
      });
      districtId = district.id;

      // Créer un centre de santé
      healthCenterName = `HealthCenterReports-${Date.now()}`;
      const healthCenter = await prisma.healthCenter.create({
        data: {
          name: healthCenterName,
          address: "Adresse test",
          districtId: districtId,
        },
      });
      healthCenterId = healthCenter.id;

      // Créer un vaccin
      const vaccine = await prisma.vaccine.create({
        data: {
          name: "Vaccin Test Reports",
          description: "Description du vaccin test",
          dosesRequired: "2",
          gender: null,
        },
      });
      vaccineId = vaccine.id;

      // Créer un enfant
      const child = await prisma.children.create({
        data: {
          firstName: "Child",
          lastName: "Reports",
          birthDate: new Date("2024-01-01"),
          birthPlace: "Dakar",
          address: "123 Test St",
          gender: "M",
          phoneParent: "+221123456789",
          healthCenterId: healthCenterId,
          status: "A_JOUR",
          isActive: true,
        },
      });
      childId = child.id;

      // Créer un utilisateur AGENT
      agentEmail = `agent-reports-${Date.now()}@test.com`;
      agentPassword = "password123";
      const hashedAgentPassword = await bcrypt.hash(agentPassword, 10);

      await prisma.user.create({
        data: {
          email: agentEmail,
          password: hashedAgentPassword,
          firstName: "Agent",
          lastName: "Reports",
          role: "AGENT",
          agentLevel: "ADMIN",
          healthCenterId: healthCenterId,
          districtId: districtId,
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer un utilisateur REGIONAL
      regionalEmail = `regional-reports-${Date.now()}@test.com`;
      regionalPassword = "password123";
      const hashedRegionalPassword = await bcrypt.hash(regionalPassword, 10);

      await prisma.user.create({
        data: {
          email: regionalEmail,
          password: hashedRegionalPassword,
          firstName: "Regional",
          lastName: "Reports",
          role: "REGIONAL",
          regionId: regionId,
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer un utilisateur DISTRICT
      districtEmail = `district-reports-${Date.now()}@test.com`;
      districtPassword = "password123";
      const hashedDistrictPassword = await bcrypt.hash(districtPassword, 10);

      await prisma.user.create({
        data: {
          email: districtEmail,
          password: hashedDistrictPassword,
          firstName: "District",
          lastName: "Reports",
          role: "DISTRICT",
          districtId: districtId,
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer un utilisateur NATIONAL
      nationalEmail = `national-reports-${Date.now()}@test.com`;
      nationalPassword = "password123";
      const hashedNationalPassword = await bcrypt.hash(nationalPassword, 10);

      await prisma.user.create({
        data: {
          email: nationalEmail,
          password: hashedNationalPassword,
          firstName: "National",
          lastName: "Reports",
          role: "NATIONAL",
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer un utilisateur SUPERADMIN
      superadminEmail = `superadmin-reports-${Date.now()}@test.com`;
      superadminPassword = "password123";
      const hashedSuperadminPassword = await bcrypt.hash(superadminPassword, 10);

      await prisma.user.create({
        data: {
          email: superadminEmail,
          password: hashedSuperadminPassword,
          firstName: "Superadmin",
          lastName: "Reports",
          role: "SUPERADMIN",
          isActive: true,
          emailVerified: true,
        },
      });

      // Obtenir les tokens
      agentToken = await getUserToken(agentEmail, agentPassword);
      regionalToken = await getUserToken(regionalEmail, regionalPassword);
      districtToken = await getUserToken(districtEmail, districtPassword);
      nationalToken = await getUserToken(nationalEmail, nationalPassword);
      superadminToken = await getUserToken(superadminEmail, superadminPassword);
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  afterAll(async () => {
    await prisma.stockReservation.deleteMany();
    await prisma.childVaccineScheduled.deleteMany();
    await prisma.childVaccineCompleted.deleteMany();
    await prisma.childVaccineDue.deleteMany();
    await prisma.childVaccineLate.deleteMany();
    await prisma.childVaccineOverdue.deleteMany();
    await prisma.vaccineRequest.deleteMany();
    await prisma.children.deleteMany();
    await prisma.stockLot.deleteMany();
    await prisma.stockHEALTHCENTER.deleteMany();
    await prisma.stockDISTRICT.deleteMany();
    await prisma.stockREGIONAL.deleteMany();
    await prisma.stockNATIONAL.deleteMany();
    await prisma.user.deleteMany();
    await prisma.healthCenter.deleteMany();
    await prisma.district.deleteMany();
    await prisma.commune.deleteMany();
    await prisma.region.deleteMany();
    await prisma.vaccine.deleteMany();
    await prisma.$disconnect();
  });

  describe("GET /api/reports/agent - Rapports pour les agents", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/reports/agent");

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si l'utilisateur n'est pas un agent", async () => {
      const res = await request(app)
        .get("/api/reports/agent")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne les données de stock avec le statut correct", async () => {
      // Créer un stock pour tester
      await prisma.stockHEALTHCENTER.create({
        data: {
          healthCenterId: healthCenterId,
          vaccineId: vaccineId,
          quantity: 25, // Quantité critique (< 30)
        },
      });

      const res = await request(app)
        .get("/api/reports/agent")
        .set("Authorization", `Bearer ${agentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("stockStatus");
      expect(Array.isArray(res.body.stockStatus)).toBe(true);
      
      // Vérifier qu'il y a au moins un stock avec statut "critical"
      const criticalStocks = res.body.stockStatus.filter(s => s.status === "critical");
      expect(criticalStocks.length).toBeGreaterThanOrEqual(1);
      
      // Nettoyer
      await prisma.stockHEALTHCENTER.deleteMany({
        where: { healthCenterId: healthCenterId },
      });
    });

    it("Retourne les rapports de l'agent avec succès", async () => {
      const res = await request(app)
        .get("/api/reports/agent")
        .set("Authorization", `Bearer ${agentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("totalVaccinations");
      expect(res.body).toHaveProperty("thisMonth");
      expect(res.body).toHaveProperty("thisWeek");
      expect(res.body).toHaveProperty("criticalStocks");
      expect(res.body).toHaveProperty("stockStatus");
      expect(Array.isArray(res.body.stockStatus)).toBe(true);
      expect(res.body).toHaveProperty("recentActivity");
      expect(Array.isArray(res.body.recentActivity)).toBe(true);
      expect(res.body).toHaveProperty("monthlyTrend");
      expect(Array.isArray(res.body.monthlyTrend)).toBe(true);
      expect(typeof res.body.totalVaccinations).toBe("number");
      expect(typeof res.body.thisMonth).toBe("number");
      expect(typeof res.body.thisWeek).toBe("number");
      expect(typeof res.body.criticalStocks).toBe("number");
    });

    it("Accepte le paramètre period dans la requête", async () => {
      const res = await request(app)
        .get("/api/reports/agent?period=3months")
        .set("Authorization", `Bearer ${agentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("monthlyTrend");
      expect(Array.isArray(res.body.monthlyTrend)).toBe(true);
    });
  });

  describe("GET /api/reports/regional - Rapports pour les régions", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/reports/regional");

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si l'utilisateur n'est pas régional", async () => {
      const res = await request(app)
        .get("/api/reports/regional")
        .set("Authorization", `Bearer ${agentToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Accepte le paramètre period dans la requête", async () => {
      const res = await request(app)
        .get("/api/reports/regional?period=3months")
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("monthlyTrend");
      expect(Array.isArray(res.body.monthlyTrend)).toBe(true);
    });

    it("Retourne les rapports régionaux avec succès", async () => {
      const res = await request(app)
        .get("/api/reports/regional")
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("totalCenters");
      expect(res.body).toHaveProperty("totalVaccinations");
      expect(res.body).toHaveProperty("coverageRate");
      expect(res.body).toHaveProperty("activeCampaigns");
      expect(res.body).toHaveProperty("criticalStocks");
      expect(res.body).toHaveProperty("centerPerformance");
      expect(Array.isArray(res.body.centerPerformance)).toBe(true);
      expect(res.body).toHaveProperty("vaccineDistribution");
      expect(Array.isArray(res.body.vaccineDistribution)).toBe(true);
      expect(res.body).toHaveProperty("monthlyTrend");
      expect(Array.isArray(res.body.monthlyTrend)).toBe(true);
      expect(res.body).toHaveProperty("alerts");
      expect(Array.isArray(res.body.alerts)).toBe(true);
      expect(typeof res.body.totalCenters).toBe("number");
      expect(typeof res.body.totalVaccinations).toBe("number");
      expect(typeof res.body.coverageRate).toBe("number");
    });
  });

  describe("GET /api/reports/district - Rapports pour les districts", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/reports/district");

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si l'utilisateur n'est pas district", async () => {
      const res = await request(app)
        .get("/api/reports/district")
        .set("Authorization", `Bearer ${agentToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Accepte le paramètre period dans la requête", async () => {
      const res = await request(app)
        .get("/api/reports/district?period=1year")
        .set("Authorization", `Bearer ${districtToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("monthlyTrend");
      expect(Array.isArray(res.body.monthlyTrend)).toBe(true);
    });

    it("Retourne les rapports de district avec succès", async () => {
      const res = await request(app)
        .get("/api/reports/district")
        .set("Authorization", `Bearer ${districtToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("totalCenters");
      expect(res.body).toHaveProperty("totalVaccinations");
      expect(res.body).toHaveProperty("coverageRate");
      expect(res.body).toHaveProperty("criticalStocks");
      expect(res.body).toHaveProperty("centerPerformance");
      expect(Array.isArray(res.body.centerPerformance)).toBe(true);
      expect(res.body).toHaveProperty("vaccineDistribution");
      expect(Array.isArray(res.body.vaccineDistribution)).toBe(true);
      expect(res.body).toHaveProperty("monthlyTrend");
      expect(Array.isArray(res.body.monthlyTrend)).toBe(true);
      expect(res.body).toHaveProperty("alerts");
      expect(Array.isArray(res.body.alerts)).toBe(true);
      expect(typeof res.body.totalCenters).toBe("number");
      expect(typeof res.body.totalVaccinations).toBe("number");
      expect(typeof res.body.coverageRate).toBe("number");
    });
  });

  describe("GET /api/reports/national - Rapports pour le niveau national", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/reports/national");

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si l'utilisateur n'est pas national ou superadmin", async () => {
      const res = await request(app)
        .get("/api/reports/national")
        .set("Authorization", `Bearer ${agentToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne les rapports nationaux avec succès pour un utilisateur NATIONAL", async () => {
      const res = await request(app)
        .get("/api/reports/national")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("summary");
      expect(res.body.summary).toHaveProperty("totalChildren");
      expect(res.body.summary).toHaveProperty("totalVaccinations");
      expect(res.body.summary).toHaveProperty("totalRegions");
      expect(res.body.summary).toHaveProperty("totalHealthCenters");
      expect(res.body.summary).toHaveProperty("campaigns");
      expect(res.body.summary).toHaveProperty("coverageRate");
      expect(res.body.summary).toHaveProperty("criticalStocks");
      expect(res.body).toHaveProperty("monthlyVaccinations");
      expect(Array.isArray(res.body.monthlyVaccinations)).toBe(true);
      expect(res.body).toHaveProperty("coverageByVaccine");
      expect(Array.isArray(res.body.coverageByVaccine)).toBe(true);
      expect(res.body).toHaveProperty("regionPerformance");
      expect(Array.isArray(res.body.regionPerformance)).toBe(true);
      expect(res.body).toHaveProperty("top5BestRegions");
      expect(Array.isArray(res.body.top5BestRegions)).toBe(true);
      expect(res.body).toHaveProperty("top5WorstRegions");
      expect(Array.isArray(res.body.top5WorstRegions)).toBe(true);
    });

    it("Retourne les rapports nationaux avec succès pour un utilisateur SUPERADMIN", async () => {
      const res = await request(app)
        .get("/api/reports/national")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("summary");
      expect(res.body.summary).toHaveProperty("totalChildren");
      expect(res.body.summary).toHaveProperty("totalVaccinations");
    });
  });

  describe("GET /api/reports/region/:regionName - Détails d'une région", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get(`/api/reports/region/${regionName}`);

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si l'utilisateur n'est pas national", async () => {
      const res = await request(app)
        .get(`/api/reports/region/${regionName}`)
        .set("Authorization", `Bearer ${agentToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 404 si la région n'existe pas", async () => {
      const res = await request(app)
        .get("/api/reports/region/RegionInexistante")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "Région non trouvée");
    });

    it("Retourne les détails de la région avec succès", async () => {
      const res = await request(app)
        .get(`/api/reports/region/${regionName}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("region", regionName);
      expect(res.body).toHaveProperty("summary");
      expect(res.body.summary).toHaveProperty("totalChildren");
      expect(res.body.summary).toHaveProperty("totalVaccinations");
      expect(res.body.summary).toHaveProperty("coverageRate");
      expect(res.body.summary).toHaveProperty("totalDistricts");
      expect(res.body.summary).toHaveProperty("overdueVaccinations");
      expect(res.body).toHaveProperty("districtStats");
      expect(Array.isArray(res.body.districtStats)).toBe(true);
      expect(res.body).toHaveProperty("vaccineDistribution");
      expect(Array.isArray(res.body.vaccineDistribution)).toBe(true);
      expect(res.body).toHaveProperty("monthlyVaccinations");
      expect(Array.isArray(res.body.monthlyVaccinations)).toBe(true);
    });
  });

  describe("GET /api/reports/district/:regionName/:districtName - Détails d'un district", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get(`/api/reports/district/${regionName}/${districtName}`);

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si l'utilisateur n'est pas national", async () => {
      const res = await request(app)
        .get(`/api/reports/district/${regionName}/${districtName}`)
        .set("Authorization", `Bearer ${agentToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 404 si la région n'existe pas", async () => {
      const res = await request(app)
        .get("/api/reports/district/RegionInexistante/DistrictTest")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "Région non trouvée");
    });

    it("Retourne 404 si le district n'existe pas", async () => {
      const res = await request(app)
        .get(`/api/reports/district/${regionName}/DistrictInexistant`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "District non trouvé");
    });

    it("Retourne les détails du district avec succès", async () => {
      const res = await request(app)
        .get(`/api/reports/district/${regionName}/${districtName}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("region", regionName);
      expect(res.body).toHaveProperty("district", districtName);
      expect(res.body).toHaveProperty("summary");
      expect(res.body.summary).toHaveProperty("totalChildren");
      expect(res.body.summary).toHaveProperty("totalVaccinations");
      expect(res.body.summary).toHaveProperty("coverageRate");
      expect(res.body.summary).toHaveProperty("totalHealthCenters");
      expect(res.body.summary).toHaveProperty("activeHealthCenters");
      expect(res.body.summary).toHaveProperty("totalAgents");
      expect(res.body.summary).toHaveProperty("activeAgents");
      expect(res.body.summary).toHaveProperty("overdueVaccinations");
      expect(res.body).toHaveProperty("healthCenterStats");
      expect(Array.isArray(res.body.healthCenterStats)).toBe(true);
      expect(res.body).toHaveProperty("vaccineDistribution");
      expect(Array.isArray(res.body.vaccineDistribution)).toBe(true);
      expect(res.body).toHaveProperty("monthlyVaccinations");
      expect(Array.isArray(res.body.monthlyVaccinations)).toBe(true);
    });
  });

  describe("GET /api/reports/healthcenter/:regionName/:districtName/:healthCenterName - Détails d'un centre de santé", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get(`/api/reports/healthcenter/${regionName}/${districtName}/${healthCenterName}`);

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si l'utilisateur n'est pas national", async () => {
      const res = await request(app)
        .get(`/api/reports/healthcenter/${regionName}/${districtName}/${healthCenterName}`)
        .set("Authorization", `Bearer ${agentToken}`);

      expect(res.statusCode).toBe(403);
    });

    it("Retourne 404 si la région n'existe pas", async () => {
      const res = await request(app)
        .get("/api/reports/healthcenter/RegionInexistante/DistrictTest/HealthCenterTest")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "Région non trouvée");
    });

    it("Retourne 404 si le district n'existe pas", async () => {
      const res = await request(app)
        .get(`/api/reports/healthcenter/${regionName}/DistrictInexistant/HealthCenterTest`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "District non trouvé");
    });

    it("Retourne 404 si le centre de santé n'existe pas", async () => {
      const res = await request(app)
        .get(`/api/reports/healthcenter/${regionName}/${districtName}/HealthCenterInexistant`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("message", "Centre de santé non trouvé");
    });

    it("Retourne les détails du centre de santé avec succès", async () => {
      const res = await request(app)
        .get(`/api/reports/healthcenter/${regionName}/${districtName}/${healthCenterName}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("region", regionName);
      expect(res.body).toHaveProperty("district", districtName);
      expect(res.body).toHaveProperty("healthCenter", healthCenterName);
      expect(res.body).toHaveProperty("healthCenterType", "Centre de santé");
      expect(res.body).toHaveProperty("summary");
      expect(res.body.summary).toHaveProperty("totalChildren");
      expect(res.body.summary).toHaveProperty("totalVaccinations");
      expect(res.body.summary).toHaveProperty("coverageRate");
      expect(res.body.summary).toHaveProperty("totalAgents");
      expect(res.body.summary).toHaveProperty("activeAgents");
      expect(res.body.summary).toHaveProperty("overdueVaccinations");
      expect(res.body).toHaveProperty("agentStats");
      expect(Array.isArray(res.body.agentStats)).toBe(true);
      expect(res.body).toHaveProperty("vaccineDistribution");
      expect(Array.isArray(res.body.vaccineDistribution)).toBe(true);
      expect(res.body).toHaveProperty("monthlyVaccinations");
      expect(Array.isArray(res.body.monthlyVaccinations)).toBe(true);
    });
  });
});
