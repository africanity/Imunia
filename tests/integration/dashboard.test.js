const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");
const tokenService = require("../../src/services/tokenService");

jest.mock('../../src/services/emailService', () => ({
  sendInvitationEmail: jest.fn(),
  sendTwoFactorCode: jest.fn(),
  sendNewPhotosUploadedEmail: jest.fn(),
  sendStockTransferNotificationEmail: jest.fn().mockResolvedValue([]),
  sendTransferRejectedEmail: jest.fn().mockResolvedValue([]),
  sendTransferCancelledEmail: jest.fn().mockResolvedValue([]),
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

describe("Dashboard API - Tableaux de bord", () => {
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
  let agentAdminEmail;
  let agentAdminPassword;
  let agentAdminToken;
  let regionId;
  let communeId;
  let districtId;
  let healthCenterId;
  let vaccineId;
  let childId;

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
      // Nettoyage complet avant tous les tests
      await prisma.stockReservation.deleteMany();
      await prisma.childVaccineScheduled.deleteMany();
      await prisma.childVaccineCompleted.deleteMany();
      await prisma.childVaccineDue.deleteMany();
      await prisma.childVaccineLate.deleteMany();
      await prisma.childVaccineOverdue.deleteMany();
      await prisma.vaccineRequest.deleteMany();
      await prisma.children.deleteMany();
      await prisma.vaccine.deleteMany();
      await prisma.stockLot.deleteMany();
      await prisma.stockHEALTHCENTER.deleteMany();
      await prisma.healthCenter.deleteMany();
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();
      await prisma.user.deleteMany();

      // Créer le user NATIONAL
      nationalEmail = `national-dashboard-test-${Date.now()}@example.com`;
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
      superadminEmail = `superadmin-dashboard-test-${Date.now()}@example.com`;
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
          name: `RegionForDashboard-${Date.now()}`,
        },
      });
      regionId = region.id;

      // Créer le user REGIONAL
      regionalEmail = `regional-dashboard-test-${Date.now()}@example.com`;
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
          name: `CommuneForDashboard-${Date.now()}`,
          regionId: regionId,
        },
      });
      communeId = commune.id;

      // Créer un district
      const district = await prisma.district.create({
        data: {
          name: `DistrictForDashboard-${Date.now()}`,
          communeId: communeId,
        },
      });
      districtId = district.id;

      // Créer le user DISTRICT
      districtEmail = `district-dashboard-test-${Date.now()}@example.com`;
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

      // Créer un healthCenter
      const healthCenter = await prisma.healthCenter.create({
        data: {
          name: `HealthCenterForDashboard-${Date.now()}`,
          address: "Test Address",
          districtId: districtId,
        },
      });
      healthCenterId = healthCenter.id;

      // Créer le user AGENT ADMIN
      agentAdminEmail = `agent-admin-dashboard-test-${Date.now()}@example.com`;
      agentAdminPassword = "motdepasse";
      const hashedAgentAdminPassword = await bcrypt.hash(agentAdminPassword, 10);

      await prisma.user.create({
        data: {
          email: agentAdminEmail,
          password: hashedAgentAdminPassword,
          firstName: "Agent",
          lastName: "Admin",
          role: "AGENT",
          agentLevel: "ADMIN",
          healthCenterId: healthCenterId,
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer un vaccin de test
      const vaccine = await prisma.vaccine.create({
        data: {
          name: "Vaccin Test Dashboard",
          description: "Description du vaccin test",
          dosesRequired: "2",
          gender: null,
        },
      });
      vaccineId = vaccine.id;

      // Créer un enfant de test
      const child = await prisma.children.create({
        data: {
          firstName: "Child",
          lastName: "Test",
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
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  afterEach(async () => {
    // Nettoyer les données créées pendant les tests
    await prisma.stockReservation.deleteMany();
    await prisma.childVaccineScheduled.deleteMany();
    await prisma.childVaccineCompleted.deleteMany();
    await prisma.childVaccineDue.deleteMany();
    await prisma.childVaccineLate.deleteMany();
    await prisma.childVaccineOverdue.deleteMany();
    await prisma.vaccineRequest.deleteMany();
    await prisma.stockLot.deleteMany();
    await prisma.stockHEALTHCENTER.deleteMany();
  });

  afterAll(async () => {
    // Nettoyage final
    await prisma.stockReservation.deleteMany();
    await prisma.childVaccineScheduled.deleteMany();
    await prisma.childVaccineCompleted.deleteMany();
    await prisma.childVaccineDue.deleteMany();
    await prisma.childVaccineLate.deleteMany();
    await prisma.childVaccineOverdue.deleteMany();
    await prisma.vaccineRequest.deleteMany();
    await prisma.stockLot.deleteMany();
    await prisma.stockHEALTHCENTER.deleteMany();
    await prisma.children.deleteMany();
    await prisma.vaccine.deleteMany();
    await prisma.healthCenter.deleteMany();
    await prisma.district.deleteMany();
    await prisma.commune.deleteMany();
    await prisma.region.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe("GET /api/dashboard/national - Dashboard national", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/dashboard/national");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas NATIONAL ou SUPERADMIN", async () => {
      regionalToken = await getRegionalToken();
      const res = await request(app)
        .get("/api/dashboard/national")
        .set("Authorization", `Bearer ${regionalToken}`);
      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty("message");
    });

    it("Retourne les statistiques nationales pour un utilisateur NATIONAL", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get("/api/dashboard/national")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("totalChildren");
      expect(res.body).toHaveProperty("totalVaccinations");
      expect(res.body).toHaveProperty("monthlyVaccinations");
      expect(res.body).toHaveProperty("coverageByVaccine");
      expect(res.body).toHaveProperty("topRegions");
      expect(Array.isArray(res.body.monthlyVaccinations)).toBe(true);
      expect(Array.isArray(res.body.coverageByVaccine)).toBe(true);
      expect(Array.isArray(res.body.topRegions)).toBe(true);
    });

    it("Retourne les statistiques nationales pour un utilisateur SUPERADMIN", async () => {
      superadminToken = await getSuperadminToken();
      const res = await request(app)
        .get("/api/dashboard/national")
        .set("Authorization", `Bearer ${superadminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("totalChildren");
      expect(res.body).toHaveProperty("totalVaccinations");
      expect(res.body).toHaveProperty("monthlyVaccinations");
      expect(res.body).toHaveProperty("coverageByVaccine");
      expect(res.body).toHaveProperty("topRegions");
    });

    it("Filtre les statistiques par région si regionId est fourni", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get(`/api/dashboard/national?regionId=${regionId}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("totalChildren");
      expect(res.body).toHaveProperty("totalVaccinations");
    });

    it("Filtre les statistiques par district si districtId est fourni", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get(`/api/dashboard/national?districtId=${districtId}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("totalChildren");
      expect(res.body).toHaveProperty("totalVaccinations");
    });

    it("Filtre les statistiques par centre de santé si healthCenterId est fourni", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get(`/api/dashboard/national?healthCenterId=${healthCenterId}`)
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("totalChildren");
      expect(res.body).toHaveProperty("totalVaccinations");
    });
  });

  describe("GET /api/dashboard/regional - Dashboard régional", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/dashboard/regional");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas REGIONAL", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get("/api/dashboard/regional")
        .set("Authorization", `Bearer ${nationalToken}`);
      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty("message");
    });

    it("Retourne 400 si aucun regionId n'est associé à l'utilisateur", async () => {
      // Créer un utilisateur REGIONAL sans regionId
      const regionalNoRegionEmail = `regional-no-region-${Date.now()}@example.com`;
      const hashedPassword = await bcrypt.hash("motdepasse", 10);
      const user = await prisma.user.create({
        data: {
          email: regionalNoRegionEmail,
          password: hashedPassword,
          firstName: "Regional",
          lastName: "NoRegion",
          role: "REGIONAL",
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer un token manuellement car le login bloque les utilisateurs sans relations
      const token = tokenService.signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      const res = await request(app)
        .get("/api/dashboard/regional")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("message");

      // Nettoyer
      await prisma.user.delete({ where: { email: regionalNoRegionEmail } });
    });

    it("Retourne les statistiques régionales", async () => {
      regionalToken = await getRegionalToken();
      const res = await request(app)
        .get("/api/dashboard/regional")
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("region");
      expect(res.body).toHaveProperty("totalChildren");
      expect(res.body).toHaveProperty("vaccinatedChildren");
      expect(res.body).toHaveProperty("coverageRate");
      expect(res.body).toHaveProperty("activeCampaigns");
      expect(res.body).toHaveProperty("monthlyVaccinations");
      expect(res.body).toHaveProperty("coverageByVaccine");
      expect(res.body).toHaveProperty("topDistricts");
      expect(Array.isArray(res.body.monthlyVaccinations)).toBe(true);
      expect(Array.isArray(res.body.coverageByVaccine)).toBe(true);
      expect(Array.isArray(res.body.topDistricts)).toBe(true);
      expect(typeof res.body.coverageRate).toBe("number");
    });
  });

  describe("GET /api/dashboard/district - Dashboard district", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/dashboard/district");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas DISTRICT", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get("/api/dashboard/district")
        .set("Authorization", `Bearer ${nationalToken}`);
      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty("message");
    });

    it("Retourne 400 si aucun districtId n'est associé à l'utilisateur", async () => {
      // Créer un utilisateur DISTRICT sans districtId
      const districtNoDistrictEmail = `district-no-district-${Date.now()}@example.com`;
      const hashedPassword = await bcrypt.hash("motdepasse", 10);
      const user = await prisma.user.create({
        data: {
          email: districtNoDistrictEmail,
          password: hashedPassword,
          firstName: "District",
          lastName: "NoDistrict",
          role: "DISTRICT",
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer un token manuellement car le login bloque les utilisateurs sans relations
      const token = tokenService.signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      const res = await request(app)
        .get("/api/dashboard/district")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("message");

      // Nettoyer
      await prisma.user.delete({ where: { email: districtNoDistrictEmail } });
    });

    it("Retourne les statistiques du district", async () => {
      districtToken = await getDistrictToken();
      const res = await request(app)
        .get("/api/dashboard/district")
        .set("Authorization", `Bearer ${districtToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("district");
      expect(res.body).toHaveProperty("totalChildren");
      expect(res.body).toHaveProperty("vaccinatedChildren");
      expect(res.body).toHaveProperty("coverageRate");
      expect(res.body).toHaveProperty("activeCampaigns");
      expect(res.body).toHaveProperty("coverageByVaccine");
      expect(res.body).toHaveProperty("topHealthCenters");
      expect(res.body).toHaveProperty("monthlyByHealthCenter");
      expect(Array.isArray(res.body.coverageByVaccine)).toBe(true);
      expect(Array.isArray(res.body.topHealthCenters)).toBe(true);
      expect(Array.isArray(res.body.monthlyByHealthCenter)).toBe(true);
      expect(typeof res.body.coverageRate).toBe("number");
    });
  });

  describe("GET /api/dashboard/agent - Dashboard agent", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/dashboard/agent");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si utilisateur n'est pas AGENT", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get("/api/dashboard/agent")
        .set("Authorization", `Bearer ${nationalToken}`);
      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty("message");
    });

    it("Retourne 400 si aucun healthCenterId n'est associé à l'agent", async () => {
      // Créer un agent sans healthCenterId
      const agentNoCenterEmail = `agent-no-center-${Date.now()}@example.com`;
      const hashedPassword = await bcrypt.hash("motdepasse", 10);
      const user = await prisma.user.create({
        data: {
          email: agentNoCenterEmail,
          password: hashedPassword,
          firstName: "Agent",
          lastName: "NoCenter",
          role: "AGENT",
          agentLevel: "ADMIN",
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer un token manuellement car le login bloque les utilisateurs sans relations
      const token = tokenService.signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      const res = await request(app)
        .get("/api/dashboard/agent")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("message");

      // Nettoyer
      await prisma.user.delete({ where: { email: agentNoCenterEmail } });
    });

    it("Retourne les statistiques de l'agent", async () => {
      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .get("/api/dashboard/agent")
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("totalChildren");
      expect(res.body).toHaveProperty("appointmentsToday");
      expect(res.body).toHaveProperty("totalAppointmentsPlanned");
      expect(res.body).toHaveProperty("vaccinationsSaisies");
      expect(res.body).toHaveProperty("remindersSent");
      expect(res.body).toHaveProperty("lowStocks");
      expect(res.body).toHaveProperty("expiringLots");
      expect(res.body).toHaveProperty("dosesPerDay");
      expect(res.body).toHaveProperty("monthlyVaccinations");
      expect(res.body).toHaveProperty("coverageByVaccine");
      expect(res.body).toHaveProperty("topLateChildren");
      expect(Array.isArray(res.body.lowStocks)).toBe(true);
      expect(Array.isArray(res.body.expiringLots)).toBe(true);
      expect(Array.isArray(res.body.dosesPerDay)).toBe(true);
      expect(Array.isArray(res.body.monthlyVaccinations)).toBe(true);
      expect(Array.isArray(res.body.coverageByVaccine)).toBe(true);
      expect(Array.isArray(res.body.topLateChildren)).toBe(true);
      expect(typeof res.body.totalChildren).toBe("number");
      expect(typeof res.body.appointmentsToday).toBe("number");
      expect(typeof res.body.totalAppointmentsPlanned).toBe("number");
      expect(typeof res.body.vaccinationsSaisies).toBe("number");
      expect(typeof res.body.remindersSent).toBe("number");
    });

    it("Retourne les stocks faibles si disponibles", async () => {
      // Créer un stock faible
      await prisma.stockHEALTHCENTER.create({
        data: {
          vaccineId,
          healthCenterId,
          quantity: 10, // En dessous du seuil de 50
        },
      });

      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .get("/api/dashboard/agent")
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.lowStocks)).toBe(true);
    });

    it("Retourne les lots expirant bientôt si disponibles", async () => {
      // Créer un lot expirant bientôt
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15); // Dans 15 jours

      await prisma.stockLot.create({
        data: {
          vaccineId,
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          quantity: 10,
          remainingQuantity: 10,
          expiration: futureDate,
          status: "VALID",
        },
      });

      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .get("/api/dashboard/agent")
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.expiringLots)).toBe(true);
    });
  });
});
