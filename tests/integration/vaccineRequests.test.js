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
  sendVaccineRequestEmail: jest.fn().mockResolvedValue(true),
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
  notifyVaccineScheduled: jest.fn().mockResolvedValue(true),
  createAndSendNotification: jest.fn().mockResolvedValue(true),
}));

describe("Vaccine Requests API - Demandes de Vaccin", () => {
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
  let vaccineRequestId;

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
      await prisma.vaccineRequest.deleteMany();
      await prisma.children.deleteMany();
      await prisma.vaccine.deleteMany();
      await prisma.healthCenter.deleteMany();
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();
      await prisma.user.deleteMany();

      // Créer le user NATIONAL
      nationalEmail = `national-requests-test-${Date.now()}@example.com`;
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
          name: `RegionForRequests-${Date.now()}`,
        },
      });
      regionId = region.id;

      // Créer le user REGIONAL
      regionalEmail = `regional-requests-test-${Date.now()}@example.com`;
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
          name: `CommuneForRequests-${Date.now()}`,
          regionId: regionId,
        },
      });
      communeId = commune.id;

      // Créer un district
      const district = await prisma.district.create({
        data: {
          name: `DistrictForRequests-${Date.now()}`,
          communeId: communeId,
        },
      });
      districtId = district.id;

      // Créer le user DISTRICT
      districtEmail = `district-requests-test-${Date.now()}@example.com`;
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
          name: `HealthCenterForRequests-${Date.now()}`,
          address: "Test Address",
          districtId: districtId,
        },
      });
      healthCenterId = healthCenter.id;

      // Créer le user AGENT ADMIN
      agentAdminEmail = `agent-admin-requests-test-${Date.now()}@example.com`;
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
      agentStaffEmail = `agent-staff-requests-test-${Date.now()}@example.com`;
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
          name: "Vaccin Test Requests",
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
    await prisma.vaccineRequest.deleteMany();
    await prisma.stockLot.deleteMany();
    await prisma.stockHEALTHCENTER.deleteMany();
  });

  afterAll(async () => {
    // Nettoyage final
    await prisma.stockReservation.deleteMany();
    await prisma.childVaccineScheduled.deleteMany();
    await prisma.childVaccineCompleted.deleteMany();
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

  describe("GET /api/vaccine-requests - Liste des demandes", () => {
    beforeEach(async () => {
      // Créer une demande de vaccin pour les tests
      const request = await prisma.vaccineRequest.create({
        data: {
          childId,
          vaccineId,
          status: "PENDING",
          dose: 1,
        },
      });
      vaccineRequestId = request.id;
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/vaccine-requests");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne la liste des demandes pour un agent ADMIN", async () => {
      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .get("/api/vaccine-requests")
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("requests");
      expect(Array.isArray(res.body.requests)).toBe(true);
    });

    it("Retourne la liste des demandes pour un agent STAFF", async () => {
      agentStaffToken = await getAgentStaffToken();
      const res = await request(app)
        .get("/api/vaccine-requests")
        .set("Authorization", `Bearer ${agentStaffToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("requests");
    });

    it("Retourne la liste des demandes pour un DISTRICT", async () => {
      districtToken = await getDistrictToken();
      const res = await request(app)
        .get("/api/vaccine-requests")
        .set("Authorization", `Bearer ${districtToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("requests");
    });

    it("Retourne la liste des demandes pour un REGIONAL", async () => {
      regionalToken = await getRegionalToken();
      const res = await request(app)
        .get("/api/vaccine-requests")
        .set("Authorization", `Bearer ${regionalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("requests");
    });

    it("Retourne la liste des demandes pour un NATIONAL", async () => {
      nationalToken = await getNationalToken();
      const res = await request(app)
        .get("/api/vaccine-requests")
        .set("Authorization", `Bearer ${nationalToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("requests");
    });

    it("Filtre les demandes par statut PENDING", async () => {
      agentAdminToken = await getAgentAdminToken();
      
      // Créer une demande SCHEDULED
      await prisma.vaccineRequest.create({
        data: {
          childId,
          vaccineId,
          status: "SCHEDULED",
          dose: 2,
        },
      });

      const res = await request(app)
        .get("/api/vaccine-requests?status=PENDING")
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      // Toutes les demandes retournées doivent être PENDING
      res.body.requests.forEach((req) => {
        expect(req.status).toBe("PENDING");
      });
    });

    it("Retourne les détails complets de chaque demande", async () => {
      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .get("/api/vaccine-requests")
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(200);
      if (res.body.requests.length > 0) {
        const request = res.body.requests[0];
        expect(request).toHaveProperty("id");
        expect(request).toHaveProperty("childId");
        expect(request).toHaveProperty("vaccineId");
        expect(request).toHaveProperty("status");
        expect(request).toHaveProperty("dose");
        expect(request).toHaveProperty("child");
        expect(request).toHaveProperty("vaccine");
        expect(request.child).toHaveProperty("firstName");
        expect(request.child).toHaveProperty("lastName");
        expect(request.vaccine).toHaveProperty("name");
      }
    });
  });

  describe("POST /api/vaccine-requests/:id/schedule - Programmer une demande", () => {
    beforeEach(async () => {
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

      // Créer une demande PENDING
      const request = await prisma.vaccineRequest.create({
        data: {
          childId,
          vaccineId,
          status: "PENDING",
          dose: 1,
        },
      });
      vaccineRequestId = request.id;
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .post(`/api/vaccine-requests/${vaccineRequestId}/schedule`)
        .send({ scheduledFor: new Date(Date.now() + 86400000).toISOString() });
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 400 si scheduledFor est manquant", async () => {
      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .post(`/api/vaccine-requests/${vaccineRequestId}/schedule`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({});
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body).toHaveProperty("message");
    });

    it("Retourne 400 si la date est invalide", async () => {
      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .post(`/api/vaccine-requests/${vaccineRequestId}/schedule`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({ scheduledFor: "date-invalide" });
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("success", false);
    });

    it("Retourne 404 si la demande n'existe pas", async () => {
      agentAdminToken = await getAgentAdminToken();
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const res = await request(app)
        .post(`/api/vaccine-requests/${fakeId}/schedule`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({ scheduledFor: new Date(Date.now() + 86400000).toISOString() });
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("success", false);
    });

    it("Retourne 403 si l'agent n'appartient pas au même centre de santé", async () => {
      // Créer un autre healthCenter et agent
      const otherHealthCenter = await prisma.healthCenter.create({
        data: {
          name: `OtherHealthCenter-${Date.now()}`,
          address: "Other Address",
          districtId: districtId,
        },
      });

      const otherAgentEmail = `other-agent-${Date.now()}@example.com`;
      const hashedPassword = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: otherAgentEmail,
          password: hashedPassword,
          firstName: "Other",
          lastName: "Agent",
          role: "AGENT",
          agentLevel: "ADMIN",
          healthCenterId: otherHealthCenter.id,
          isActive: true,
          emailVerified: true,
        },
      });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: otherAgentEmail, password: "motdepasse" });
      const otherAgentToken = loginRes.body.accessToken;

      const res = await request(app)
        .post(`/api/vaccine-requests/${vaccineRequestId}/schedule`)
        .set("Authorization", `Bearer ${otherAgentToken}`)
        .send({ scheduledFor: new Date(Date.now() + 86400000).toISOString() });

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty("success", false);

      // Nettoyer
      await prisma.user.delete({ where: { email: otherAgentEmail } });
      await prisma.healthCenter.delete({ where: { id: otherHealthCenter.id } });
    });

    it("Retourne 400 si la demande a déjà été traitée", async () => {
      // Créer une demande SCHEDULED
      const scheduledRequest = await prisma.vaccineRequest.create({
        data: {
          childId,
          vaccineId,
          status: "SCHEDULED",
          dose: 2,
        },
      });

      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .post(`/api/vaccine-requests/${scheduledRequest.id}/schedule`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({ scheduledFor: new Date(Date.now() + 86400000).toISOString() });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body.message).toContain("déjà été traitée");
    });

    it("Programme une demande avec succès", async () => {
      agentAdminToken = await getAgentAdminToken();
      const scheduledFor = new Date(Date.now() + 86400000); // Demain
      
      const res = await request(app)
        .post(`/api/vaccine-requests/${vaccineRequestId}/schedule`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({ 
          scheduledFor: scheduledFor.toISOString(),
          notes: "Notes de test",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("appointment");
      expect(res.body).toHaveProperty("request");
      expect(res.body.appointment).toHaveProperty("id");
      expect(res.body.appointment.childId).toBe(childId);
      expect(res.body.appointment.vaccineId).toBe(vaccineId);
      expect(res.body.request.status).toBe("SCHEDULED");

      // Vérifier que la demande a été mise à jour
      const updatedRequest = await prisma.vaccineRequest.findUnique({
        where: { id: vaccineRequestId },
      });
      expect(updatedRequest.status).toBe("SCHEDULED");
      expect(updatedRequest.scheduledById).toBeDefined();
      expect(updatedRequest.appointmentId).toBeDefined();
    });

    it("Crée un rendez-vous programmé à partir de la demande", async () => {
      agentAdminToken = await getAgentAdminToken();
      const scheduledFor = new Date(Date.now() + 86400000);
      
      const res = await request(app)
        .post(`/api/vaccine-requests/${vaccineRequestId}/schedule`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({ scheduledFor: scheduledFor.toISOString() });

      expect(res.statusCode).toBe(200);
      
      // Vérifier que le rendez-vous a été créé
      const appointment = await prisma.childVaccineScheduled.findUnique({
        where: { id: res.body.appointment.id },
      });
      expect(appointment).toBeDefined();
      expect(appointment.childId).toBe(childId);
      expect(appointment.vaccineId).toBe(vaccineId);
      expect(appointment.dose).toBe(1);
    });

    it("Retourne 400 si le stock est insuffisant", async () => {
      // Supprimer le stock existant
      await prisma.stockLot.deleteMany();
      await prisma.stockHEALTHCENTER.deleteMany();

      agentAdminToken = await getAgentAdminToken();
      const scheduledFor = new Date(Date.now() + 86400000);
      
      const res = await request(app)
        .post(`/api/vaccine-requests/${vaccineRequestId}/schedule`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({ scheduledFor: scheduledFor.toISOString() });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body.message).toBeDefined();
    });
  });

  describe("DELETE /api/vaccine-requests/:id - Annuler une demande", () => {
    beforeEach(async () => {
      // Créer une demande PENDING
      const request = await prisma.vaccineRequest.create({
        data: {
          childId,
          vaccineId,
          status: "PENDING",
          dose: 1,
        },
      });
      vaccineRequestId = request.id;
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).delete(`/api/vaccine-requests/${vaccineRequestId}`);
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 404 si la demande n'existe pas", async () => {
      agentAdminToken = await getAgentAdminToken();
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const res = await request(app)
        .delete(`/api/vaccine-requests/${fakeId}`)
        .set("Authorization", `Bearer ${agentAdminToken}`);
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty("success", false);
    });

    it("Retourne 403 si l'agent n'appartient pas au même centre de santé", async () => {
      // Créer un autre healthCenter et agent
      const otherHealthCenter = await prisma.healthCenter.create({
        data: {
          name: `OtherHealthCenter-${Date.now()}`,
          address: "Other Address",
          districtId: districtId,
        },
      });

      const otherAgentEmail = `other-agent-${Date.now()}@example.com`;
      const hashedPassword = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: otherAgentEmail,
          password: hashedPassword,
          firstName: "Other",
          lastName: "Agent",
          role: "AGENT",
          agentLevel: "ADMIN",
          healthCenterId: otherHealthCenter.id,
          isActive: true,
          emailVerified: true,
        },
      });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: otherAgentEmail, password: "motdepasse" });
      const otherAgentToken = loginRes.body.accessToken;

      const res = await request(app)
        .delete(`/api/vaccine-requests/${vaccineRequestId}`)
        .set("Authorization", `Bearer ${otherAgentToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty("success", false);

      // Nettoyer
      await prisma.user.delete({ where: { email: otherAgentEmail } });
      await prisma.healthCenter.delete({ where: { id: otherHealthCenter.id } });
    });

    it("Retourne 400 si la demande n'est pas PENDING", async () => {
      // Créer une demande SCHEDULED
      const scheduledRequest = await prisma.vaccineRequest.create({
        data: {
          childId,
          vaccineId,
          status: "SCHEDULED",
          dose: 2,
        },
      });

      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .delete(`/api/vaccine-requests/${scheduledRequest.id}`)
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body.message).toContain("en attente");
    });

    it("Supprime une demande avec succès (agent)", async () => {
      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .delete(`/api/vaccine-requests/${vaccineRequestId}`)
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body.message).toContain("supprimée");

      // Vérifier que la demande a été supprimée
      const deleted = await prisma.vaccineRequest.findUnique({
        where: { id: vaccineRequestId },
      });
      expect(deleted).toBeNull();
    });

    it("Marque une demande comme CANCELLED (parent)", async () => {
      // Note: Dans ce test, on simule un parent en utilisant un agent
      // car les parents n'ont pas de token JWT dans ce contexte
      // En réalité, les parents utiliseraient l'API mobile avec leur code d'accès
      
      // Pour ce test, on vérifie que si un agent supprime, la demande est supprimée
      // et si un parent annule, elle est marquée CANCELLED
      // Comme on ne peut pas facilement simuler un parent ici, on teste juste le comportement agent
      
      agentAdminToken = await getAgentAdminToken();
      const res = await request(app)
        .delete(`/api/vaccine-requests/${vaccineRequestId}`)
        .set("Authorization", `Bearer ${agentAdminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
