const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");

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

describe("Vaccine API - Gestion des Vaccins", () => {
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
  let vaccineId;
  let childId;
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
      // Nettoyage complet avant tous les tests
      await prisma.stockReservation.deleteMany();
      await prisma.childVaccineScheduled.deleteMany();
      await prisma.childVaccineCompleted.deleteMany();
      await prisma.childVaccineDue.deleteMany();
      await prisma.childVaccineLate.deleteMany();
      await prisma.childVaccineOverdue.deleteMany();
      await prisma.vaccineCalendarDose.deleteMany();
      await prisma.vaccineCalendar.deleteMany();
      await prisma.stockLot.deleteMany();
      await prisma.stockHEALTHCENTER.deleteMany();
      await prisma.children.deleteMany();
      await prisma.vaccine.deleteMany();
      await prisma.healthCenter.deleteMany();
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();
      await prisma.user.deleteMany();

      // Créer le user NATIONAL
      nationalEmail = `national-vaccine-test-${Date.now()}@example.com`;
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
          name: `RegionForVaccine-${Date.now()}`,
        },
      });
      regionId = region.id;

      // Créer le user REGIONAL
      regionalEmail = `regional-vaccine-test-${Date.now()}@example.com`;
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
          name: `CommuneForVaccine-${Date.now()}`,
          regionId: regionId,
        },
      });
      communeId = commune.id;

      // Créer un district
      const district = await prisma.district.create({
        data: {
          name: `DistrictForVaccine-${Date.now()}`,
          communeId: communeId,
        },
      });
      districtId = district.id;

      // Créer le user DISTRICT
      districtEmail = `district-vaccine-test-${Date.now()}@example.com`;
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
          name: `HealthCenterForVaccine-${Date.now()}`,
          address: "Test Address",
          districtId: districtId,
        },
      });
      healthCenterId = healthCenter.id;

      // Créer le user AGENT ADMIN
      agentAdminEmail = `agent-admin-vaccine-test-${Date.now()}@example.com`;
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

      // Créer le user AGENT STAFF
      agentStaffEmail = `agent-staff-vaccine-test-${Date.now()}@example.com`;
      agentStaffPassword = "motdepasse";
      const hashedAgentStaffPassword = await bcrypt.hash(agentStaffPassword, 10);

      await prisma.user.create({
        data: {
          email: agentStaffEmail,
          password: hashedAgentStaffPassword,
          firstName: "Agent",
          lastName: "Staff",
          role: "AGENT",
          agentLevel: "STAFF",
          healthCenterId: healthCenterId,
          isActive: true,
          emailVerified: true,
        },
      });

      // Créer un vaccin de test
      const vaccine = await prisma.vaccine.create({
        data: {
          name: "Vaccin Test",
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
          birthDate: new Date("2020-01-01"),
          birthPlace: "Test Place",
          gender: "M",
          address: "Test Address",
          phoneParent: "1234567890",
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
    await prisma.vaccineCalendarDose.deleteMany();
    await prisma.vaccineCalendar.deleteMany();
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
    await prisma.vaccineCalendarDose.deleteMany();
    await prisma.vaccineCalendar.deleteMany();
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

  describe("CRUD Vaccins", () => {
    describe("POST /api/vaccine - Création", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/vaccine")
          .send({
            name: "Nouveau Vaccin",
            description: "Description",
            dosesRequired: "1",
          });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL ou SUPERADMIN", async () => {
        regionalToken = await getRegionalToken();
        const res = await request(app)
          .post("/api/vaccine")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            name: "Nouveau Vaccin",
            description: "Description",
            dosesRequired: "1",
          });
        expect(res.statusCode).toBe(403);
      });

      it("Crée un vaccin avec succès", async () => {
        nationalToken = await getNationalToken();
        const res = await request(app)
          .post("/api/vaccine")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            name: `Vaccin-${Date.now()}`,
            description: "Description du vaccin",
            dosesRequired: "3",
            gender: null,
          });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("id");
        expect(res.body.name).toBeDefined();
        expect(res.body.description).toBeDefined();
        expect(res.body.dosesRequired).toBe("3");
      });
    });

    describe("GET /api/vaccine - Liste", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get("/api/vaccine");
        expect(res.statusCode).toBe(401);
      });

      it("Retourne la liste des vaccins pour un agent STAFF", async () => {
        // Les agents STAFF sont autorisés à voir la liste des vaccins
        agentStaffToken = await getAgentStaffToken();
        const res = await request(app)
          .get("/api/vaccine")
          .set("Authorization", `Bearer ${agentStaffToken}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("total");
        expect(res.body).toHaveProperty("vaccines");
      });

      it("Retourne la liste des vaccins avec stocks", async () => {
        nationalToken = await getNationalToken();
        const res = await request(app)
          .get("/api/vaccine")
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("total");
        expect(res.body).toHaveProperty("vaccines");
        expect(Array.isArray(res.body.vaccines)).toBe(true);
        if (res.body.vaccines.length > 0) {
          expect(res.body.vaccines[0]).toHaveProperty("id");
          expect(res.body.vaccines[0]).toHaveProperty("name");
          expect(res.body.vaccines[0]).toHaveProperty("stock");
        }
      });
    });

    describe("PUT /api/vaccine/:id - Modification", () => {
      let testVaccineId;

      beforeEach(async () => {
        const vaccine = await prisma.vaccine.create({
          data: {
            name: `Vaccin-${Date.now()}`,
            description: "Description originale",
            dosesRequired: "1",
          },
        });
        testVaccineId = vaccine.id;
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .put(`/api/vaccine/${testVaccineId}`)
          .send({
            name: "Vaccin Modifié",
            description: "Nouvelle description",
            dosesRequired: "2",
          });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL ou SUPERADMIN", async () => {
        regionalToken = await getRegionalToken();
        const res = await request(app)
          .put(`/api/vaccine/${testVaccineId}`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            name: "Vaccin Modifié",
            description: "Nouvelle description",
            dosesRequired: "2",
          });
        expect(res.statusCode).toBe(403);
      });

      it("Retourne 400 si champs manquants", async () => {
        nationalToken = await getNationalToken();
        const res = await request(app)
          .put(`/api/vaccine/${testVaccineId}`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            name: "Vaccin Modifié",
            // description manquant
            dosesRequired: "2",
          });
        expect(res.statusCode).toBe(400);
      });

      it("Modifie un vaccin avec succès", async () => {
        nationalToken = await getNationalToken();
        const res = await request(app)
          .put(`/api/vaccine/${testVaccineId}`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            name: "Vaccin Modifié",
            description: "Nouvelle description",
            dosesRequired: "3",
            gender: "M",
          });

        expect(res.statusCode).toBe(200);
        expect(res.body.name).toBe("Vaccin Modifié");
        expect(res.body.description).toBe("Nouvelle description");
        expect(res.body.dosesRequired).toBe("3");
        expect(res.body.gender).toBe("M");
      });
    });

    describe("DELETE /api/vaccine/:id - Suppression", () => {
      let testVaccineId;

      beforeEach(async () => {
        const vaccine = await prisma.vaccine.create({
          data: {
            name: `Vaccin-${Date.now()}`,
            description: "Description",
            dosesRequired: "1",
          },
        });
        testVaccineId = vaccine.id;
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).delete(`/api/vaccine/${testVaccineId}`);
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL ou SUPERADMIN", async () => {
        regionalToken = await getRegionalToken();
        const res = await request(app)
          .delete(`/api/vaccine/${testVaccineId}`)
          .set("Authorization", `Bearer ${regionalToken}`);
        expect(res.statusCode).toBe(403);
      });

      it("Supprime un vaccin avec succès", async () => {
        nationalToken = await getNationalToken();
        const res = await request(app)
          .delete(`/api/vaccine/${testVaccineId}`)
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(204);

        // Vérifier que le vaccin a été supprimé
        const deleted = await prisma.vaccine.findUnique({
          where: { id: testVaccineId },
        });
        expect(deleted).toBeNull();
      });
    });
  });

  describe("Calendriers Vaccinaux", () => {
    describe("POST /api/vaccine/calendar - Création", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/vaccine/calendar")
          .send({
            description: "Calendrier test",
            ageUnit: "MONTHS",
            specificAge: 2,
            minAge: 1,
            maxAge: 3,
            vaccine: [{ vaccineId, doseCount: 1 }],
          });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL ou SUPERADMIN", async () => {
        regionalToken = await getRegionalToken();
        const res = await request(app)
          .post("/api/vaccine/calendar")
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            description: "Calendrier test",
            ageUnit: "MONTHS",
            specificAge: 2,
            minAge: 1,
            maxAge: 3,
            vaccine: [{ vaccineId, doseCount: 1 }],
          });
        expect(res.statusCode).toBe(403);
      });

      it("Crée un calendrier vaccinal avec succès", async () => {
        nationalToken = await getNationalToken();
        const res = await request(app)
          .post("/api/vaccine/calendar")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            description: `Calendrier-${Date.now()}`,
            ageUnit: "MONTHS",
            specificAge: 2,
            minAge: 1,
            maxAge: 3,
            vaccine: [{ vaccineId, doseCount: 1 }],
          });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("id");
        expect(res.body.description).toBeDefined();
        expect(res.body.ageUnit).toBe("MONTHS");
      });
    });

    describe("GET /api/vaccine/calendar - Liste", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get("/api/vaccine/calendar");
        expect(res.statusCode).toBe(401);
      });

      it("Retourne la liste des calendriers", async () => {
        nationalToken = await getNationalToken();
        
        // Créer un calendrier de test
        await prisma.vaccineCalendar.create({
          data: {
            description: `Calendrier-${Date.now()}`,
            ageUnit: "MONTHS",
            specificAge: 2,
            minAge: 1,
            maxAge: 3,
          },
        });

        const res = await request(app)
          .get("/api/vaccine/calendar")
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe("PUT /api/vaccine/calendar/:id - Modification", () => {
      let calendarId;

      beforeEach(async () => {
        const calendar = await prisma.vaccineCalendar.create({
          data: {
            description: `Calendrier-${Date.now()}`,
            ageUnit: "MONTHS",
            specificAge: 2,
            minAge: 1,
            maxAge: 3,
          },
        });
        calendarId = calendar.id;
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .put(`/api/vaccine/calendar/${calendarId}`)
          .send({
            description: "Calendrier modifié",
            ageUnit: "WEEKS",
            specificAge: 4,
            minAge: 2,
            maxAge: 6,
          });
        expect(res.statusCode).toBe(401);
      });

      it("Modifie un calendrier avec succès", async () => {
        nationalToken = await getNationalToken();
        const res = await request(app)
          .put(`/api/vaccine/calendar/${calendarId}`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            description: "Calendrier modifié",
            ageUnit: "WEEKS",
            specificAge: 4,
            minAge: 2,
            maxAge: 6,
            vaccine: [{ vaccineId, doseCount: 1 }],
          });

        expect(res.statusCode).toBe(200);
        expect(res.body.description).toBe("Calendrier modifié");
        expect(res.body.ageUnit).toBe("WEEKS");
      });
    });

    describe("DELETE /api/vaccine/calendar/:id - Suppression", () => {
      let calendarId;

      beforeEach(async () => {
        const calendar = await prisma.vaccineCalendar.create({
          data: {
            description: `Calendrier-${Date.now()}`,
            ageUnit: "MONTHS",
            specificAge: 2,
            minAge: 1,
            maxAge: 3,
          },
        });
        calendarId = calendar.id;
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).delete(`/api/vaccine/calendar/${calendarId}`);
        expect(res.statusCode).toBe(401);
      });

      it("Supprime un calendrier avec succès", async () => {
        nationalToken = await getNationalToken();
        const res = await request(app)
          .delete(`/api/vaccine/calendar/${calendarId}`)
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(204);

        // Vérifier que le calendrier a été supprimé
        const deleted = await prisma.vaccineCalendar.findUnique({
          where: { id: calendarId },
        });
        expect(deleted).toBeNull();
      });
    });

    describe("GET /api/vaccine/calendar/download-pdf - Téléchargement PDF", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get("/api/vaccine/calendar/download-pdf");
        expect(res.statusCode).toBe(401);
      });

      it("Télécharge le PDF du calendrier", async () => {
        nationalToken = await getNationalToken();
        const res = await request(app)
          .get("/api/vaccine/calendar/download-pdf")
          .set("Authorization", `Bearer ${nationalToken}`);

        // Le PDF peut retourner 200 ou 404 si aucun calendrier
        expect([200, 404]).toContain(res.statusCode);
      });
    });

    describe("GET /api/vaccine/calendar/dose-warnings - Avertissements doses", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get("/api/vaccine/calendar/dose-warnings");
        expect(res.statusCode).toBe(401);
      });

      it("Retourne la liste des avertissements", async () => {
        nationalToken = await getNationalToken();
        const res = await request(app)
          .get("/api/vaccine/calendar/dose-warnings")
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("warnings");
        expect(Array.isArray(res.body.warnings)).toBe(true);
      });
    });
  });

  describe("Vaccinations Programmées", () => {
    describe("POST /api/vaccine/scheduled - Programmer vaccination", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post("/api/vaccine/scheduled")
          .send({
            childId,
            vaccineId,
            scheduledFor: new Date(Date.now() + 86400000).toISOString(),
          });
        expect(res.statusCode).toBe(401);
      });

      it("Programme une vaccination avec succès", async () => {
        agentAdminToken = await getAgentAdminToken();
        
        // Créer un stock HEALTHCENTER avec un lot pour permettre la réservation
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        
        await prisma.stockHEALTHCENTER.create({
          data: { vaccineId, healthCenterId, quantity: 10 },
        });
        
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
        
        const scheduledFor = new Date(Date.now() + 86400000); // Demain
        
        const res = await request(app)
          .post("/api/vaccine/scheduled")
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            childId,
            vaccineId,
            scheduledFor: scheduledFor.toISOString(),
          });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("id");
        expect(res.body.childId).toBe(childId);
        expect(res.body.vaccineId).toBe(vaccineId);
      });
    });

    describe("GET /api/vaccine/scheduled - Liste vaccinations programmées", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get("/api/vaccine/scheduled");
        expect(res.statusCode).toBe(401);
      });

      it("Retourne la liste des vaccinations programmées", async () => {
        agentAdminToken = await getAgentAdminToken();
        
        // Créer une vaccination programmée
        await prisma.childVaccineScheduled.create({
          data: {
            childId,
            vaccineId,
            scheduledFor: new Date(Date.now() + 86400000),
            dose: 1,
          },
        });

        const res = await request(app)
          .get("/api/vaccine/scheduled")
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("items");
        expect(Array.isArray(res.body.items)).toBe(true);
      });
    });

    describe("POST /api/vaccine/scheduled/:id/complete - Compléter vaccination", () => {
      let scheduledId;

      beforeEach(async () => {
        // Créer une vaccination programmée dans le passé pour pouvoir la compléter
        const scheduled = await prisma.childVaccineScheduled.create({
          data: {
            childId,
            vaccineId,
            scheduledFor: new Date(Date.now() - 86400000), // Hier
            dose: 1,
          },
        });
        scheduledId = scheduled.id;
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post(`/api/vaccine/scheduled/${scheduledId}/complete`)
          .send({ notes: "Vaccination effectuée" });
        expect(res.statusCode).toBe(401);
      });

      it("Retourne 403 si utilisateur n'est pas AGENT", async () => {
        nationalToken = await getNationalToken();
        const res = await request(app)
          .post(`/api/vaccine/scheduled/${scheduledId}/complete`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ notes: "Vaccination effectuée" });
        expect(res.statusCode).toBe(403);
      });

      it("Complète une vaccination avec succès", async () => {
        agentAdminToken = await getAgentAdminToken();
        const res = await request(app)
          .post(`/api/vaccine/scheduled/${scheduledId}/complete`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ notes: "Vaccination effectuée avec succès" });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("id");

        // Vérifier que la vaccination programmée a été supprimée
        const scheduled = await prisma.childVaccineScheduled.findUnique({
          where: { id: scheduledId },
        });
        expect(scheduled).toBeNull();

        // Vérifier qu'une entrée completed a été créée
        const completed = await prisma.childVaccineCompleted.findFirst({
          where: { childId, vaccineId },
        });
        expect(completed).toBeDefined();
      });
    });

    describe("PATCH /api/vaccine/scheduled/:id - Modifier vaccination programmée", () => {
      let scheduledId;

      beforeEach(async () => {
        const scheduled = await prisma.childVaccineScheduled.create({
          data: {
            childId,
            vaccineId,
            scheduledFor: new Date(Date.now() + 86400000),
            dose: 1,
          },
        });
        scheduledId = scheduled.id;
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .patch(`/api/vaccine/scheduled/${scheduledId}`)
          .send({ scheduledFor: new Date(Date.now() + 172800000).toISOString() });
        expect(res.statusCode).toBe(401);
      });

      it("Modifie une vaccination programmée avec succès", async () => {
        agentAdminToken = await getAgentAdminToken();
        const newDate = new Date(Date.now() + 172800000); // Après-demain
        
        const res = await request(app)
          .patch(`/api/vaccine/scheduled/${scheduledId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ 
            scheduledFor: newDate.toISOString(),
            vaccineId,
          });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("id");
      });
    });

    describe("DELETE /api/vaccine/scheduled/:id - Annuler vaccination programmée", () => {
      let scheduledId;

      beforeEach(async () => {
        const scheduled = await prisma.childVaccineScheduled.create({
          data: {
            childId,
            vaccineId,
            scheduledFor: new Date(Date.now() + 86400000),
            dose: 1,
          },
        });
        scheduledId = scheduled.id;
      });

      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).delete(`/api/vaccine/scheduled/${scheduledId}`);
        expect(res.statusCode).toBe(401);
      });

      it("Annule une vaccination programmée avec succès", async () => {
        agentAdminToken = await getAgentAdminToken();
        const res = await request(app)
          .delete(`/api/vaccine/scheduled/${scheduledId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(204);

        // Vérifier que la vaccination programmée a été supprimée
        const deleted = await prisma.childVaccineScheduled.findUnique({
          where: { id: scheduledId },
        });
        expect(deleted).toBeNull();
      });
    });
  });
});
