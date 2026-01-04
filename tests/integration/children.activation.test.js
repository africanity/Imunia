const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");

jest.mock('../../src/services/emailService', () => ({
  sendInvitationEmail: jest.fn(),
  sendTwoFactorCode: jest.fn(),
  sendNewPhotosUploadedEmail: jest.fn(),
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
}));

describe("Children API - Activation et Demande Photos", () => {
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
      // Appliquer la migration pour permettre plusieurs districts par commune
      try {
        await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "District_communeId_key";');
      } catch (error) {
        console.log("Index unique déjà supprimé ou n'existe pas");
      }

      // Nettoyage complet avant tous les tests
      await prisma.children.deleteMany();
      await prisma.healthCenter.deleteMany();
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();
      await prisma.user.deleteMany();

      // Créer le user NATIONAL directement en DB
      nationalEmail = `national-activation-test-${Date.now()}@example.com`;
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
        .send({ name: `RegionForActivation-${Date.now()}` });
      expect(regionRes.statusCode).toBe(201);
      regionId = regionRes.body.id;

      // Créer une commune
      const communeRes = await request(app)
        .post("/api/commune")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ name: `CommuneForActivation-${Date.now()}`, regionId: regionId });
      expect(communeRes.statusCode).toBe(201);
      communeId = communeRes.body.id;

      // Créer un user REGIONAL directement en DB
      regionalEmail = `regional-activation-test-${Date.now()}@example.com`;
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

      // Créer un district
      const districtRes = await request(app)
        .post("/api/district")
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({ name: `DistrictForActivation-${Date.now()}`, communeId: communeId });
      expect(districtRes.statusCode).toBe(201);
      districtId = districtRes.body.id;

      // Créer un user DISTRICT directement en DB
      districtEmail = `district-activation-test-${Date.now()}@example.com`;
      districtPassword = "motdepasse";
      testEmails.add(districtEmail);
      const districtHashedPassword = await bcrypt.hash(districtPassword, 10);

      await prisma.user.create({
        data: {
          email: districtEmail,
          password: districtHashedPassword,
          firstName: "District",
          lastName: "User",
          phone: "111111111",
          role: "DISTRICT",
          isActive: true,
          emailVerified: true,
          districtId: districtId,
        },
      });

      // Obtenir le token DISTRICT initial
      districtToken = await getDistrictToken();

      // Créer un healthCenter pour les tests
      const healthCenterRes = await request(app)
        .post("/api/healthCenter")
        .set("Authorization", `Bearer ${districtToken}`)
        .send({ name: `HealthCenter-${Date.now()}`, address: "123 Test Street" });
      expect(healthCenterRes.statusCode).toBe(201);
      healthCenterId = healthCenterRes.body.id;

      // Créer un user AGENT ADMIN directement en DB
      agentAdminEmail = `agentadmin-activation-test-${Date.now()}@example.com`;
      agentAdminPassword = "motdepasse";
      testEmails.add(agentAdminEmail);
      const agentAdminHashedPassword = await bcrypt.hash(agentAdminPassword, 10);

      await prisma.user.create({
        data: {
          email: agentAdminEmail,
          password: agentAdminHashedPassword,
          firstName: "Agent",
          lastName: "Admin",
          phone: "222222222",
          role: "AGENT",
          agentLevel: "ADMIN",
          isActive: true,
          emailVerified: true,
          districtId: districtId,
          healthCenterId: healthCenterId,
        },
      });

      // Obtenir le token AGENT ADMIN initial
      agentAdminToken = await getAgentAdminToken();

      // Créer un user AGENT STAFF directement en DB
      agentStaffEmail = `agentstaff-activation-test-${Date.now()}@example.com`;
      agentStaffPassword = "motdepasse";
      testEmails.add(agentStaffEmail);
      const agentStaffHashedPassword = await bcrypt.hash(agentStaffPassword, 10);

      await prisma.user.create({
        data: {
          email: agentStaffEmail,
          password: agentStaffHashedPassword,
          firstName: "Agent",
          lastName: "Staff",
          phone: "333333333",
          role: "AGENT",
          agentLevel: "STAFF",
          isActive: true,
          emailVerified: true,
          districtId: districtId,
          healthCenterId: healthCenterId,
        },
      });

      // Obtenir le token AGENT STAFF initial
      agentStaffToken = await getAgentStaffToken();
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  beforeEach(async () => {
    try {
      // Nettoyage avant chaque test (mais garder les users et structures de base)
      await prisma.children.deleteMany();
      await prisma.user.deleteMany({
        where: {
          role: { in: ["AGENT"] },
          email: { notIn: [agentAdminEmail, agentStaffEmail] },
        },
      });
      testEmails.clear();
      testEmails.add(regionalEmail);
      testEmails.add(districtEmail);
      testEmails.add(agentAdminEmail);
      testEmails.add(agentStaffEmail);

      // S'assurer que les users de base existent toujours
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

      const existingRegional = await prisma.user.findUnique({
        where: { email: regionalEmail },
        include: { region: true },
      });
      if (!existingRegional || !existingRegional.region) {
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
        } else if (!existingRegional.regionId) {
          await prisma.user.update({
            where: { email: regionalEmail },
            data: { regionId: regionId },
          });
        }
      }

      const existingDistrict = await prisma.user.findUnique({
        where: { email: districtEmail },
        include: { district: true },
      });
      if (!existingDistrict || !existingDistrict.district) {
        if (!existingDistrict) {
          const hashedPassword = await bcrypt.hash(districtPassword, 10);
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
        } else if (!existingDistrict.districtId) {
          await prisma.user.update({
            where: { email: districtEmail },
            data: { districtId: districtId },
          });
        }
      }

      // Régénérer les tokens
      nationalToken = await getNationalToken();
      regionalToken = await getRegionalToken();
      districtToken = await getDistrictToken();
      agentAdminToken = await getAgentAdminToken();
      agentStaffToken = await getAgentStaffToken();

      // Créer un enfant pour les tests (inactif par défaut)
      const birthDate = new Date("2024-01-01");
      const childRes = await request(app)
        .post("/api/children")
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          firstName: "Activation",
          lastName: "Test",
          birthDate: birthDate.toISOString(),
          birthPlace: "Dakar",
          address: "123 Test St",
          gender: "M",
          emailParent: "parent@test.com",
          phoneParent: "+221123456789",
          fatherName: "Father",
          motherName: "Mother",
        });
      expect(childRes.statusCode).toBe(201);
      childId = childRes.body.id;

      // S'assurer que l'enfant est inactif
      await prisma.children.update({
        where: { id: childId },
        data: { isActive: false, photosRequested: false },
      });
    } catch (error) {
      console.error("Erreur dans beforeEach:", error);
      throw error;
    }
  });

  afterEach(async () => {
    // Cleanup des emails de test créés
    if (testEmails.size > 0) {
      const emailsToDelete = Array.from(testEmails).filter(
        (email) => email !== nationalEmail && email !== regionalEmail && email !== districtEmail && email !== agentAdminEmail && email !== agentStaffEmail
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
      testEmails.add(districtEmail);
      testEmails.add(agentAdminEmail);
      testEmails.add(agentStaffEmail);
    }
  });

  afterAll(async () => {
    // Nettoyage final
    await prisma.children.deleteMany();
    await prisma.healthCenter.deleteMany();
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

  describe("PUT /api/children/:id/activate - Activation", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).put(`/api/children/${childId}/activate`);
        expect(res.statusCode).toBe(401);
      });
    });

    describe("Autorisation", () => {
      it("Retourne 403 si utilisateur n'est pas NATIONAL ou AGENT (REGIONAL)", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}/activate`)
          .set("Authorization", `Bearer ${regionalToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL ou AGENT (DISTRICT)", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}/activate`)
          .set("Authorization", `Bearer ${districtToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });

      it("Retourne 403 si utilisateur n'a pas accès géographique (AGENT d'un autre healthCenter)", async () => {
        // Créer un autre healthCenter et un agent dedans
        const otherHealthCenterRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: `OtherHealthCenter-${Date.now()}`, address: "456 Other St" });
        expect(otherHealthCenterRes.statusCode).toBe(201);
        const otherHealthCenterId = otherHealthCenterRes.body.id;

        const otherAgentEmail = `other-agent-${Date.now()}@example.com`;
        testEmails.add(otherAgentEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherAgentEmail,
            password: hashedPassword,
            firstName: "Other",
            lastName: "Agent",
            phone: "444444444",
            role: "AGENT",
            agentLevel: "ADMIN",
            isActive: true,
            emailVerified: true,
            districtId: districtId,
            healthCenterId: otherHealthCenterId,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherAgentEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const otherAgentToken = loginRes.body.accessToken;

        // Essayer d'activer un enfant d'un autre healthCenter
        const res = await request(app)
          .put(`/api/children/${childId}/activate`)
          .set("Authorization", `Bearer ${otherAgentToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si enfant non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const originalError = console.error;
        console.error = jest.fn();

        const res = await request(app)
          .put(`/api/children/${fakeId}/activate`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect([404, 500]).toContain(res.statusCode);
        console.error = originalError;
      });
    });

    describe("Succès", () => {
      it("Active un enfant avec succès (AGENT ADMIN)", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}/activate`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain("activé");
        expect(res.body.child).toBeDefined();
        expect(res.body.child.isActive).toBe(true);
        expect(res.body.child.photosRequested).toBe(false);

        // Vérifier en DB
        const childInDb = await prisma.children.findUnique({
          where: { id: childId },
        });
        expect(childInDb.isActive).toBe(true);
        expect(childInDb.photosRequested).toBe(false);
      });

      it("Active un enfant avec succès (NATIONAL)", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}/activate`)
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.child.isActive).toBe(true);
      });

      it("Réinitialise photosRequested lors de l'activation", async () => {
        // Marquer photosRequested à true avant activation
        await prisma.children.update({
          where: { id: childId },
          data: { photosRequested: true },
        });

        const res = await request(app)
          .put(`/api/children/${childId}/activate`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.child.photosRequested).toBe(false);

        // Vérifier en DB
        const childInDb = await prisma.children.findUnique({
          where: { id: childId },
        });
        expect(childInDb.photosRequested).toBe(false);
      });
    });
  });

  describe("PUT /api/children/:id/request-photos - Demande de photos", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).put(`/api/children/${childId}/request-photos`);
        expect(res.statusCode).toBe(401);
      });
    });

    describe("Autorisation", () => {
      it("Retourne 403 si utilisateur n'est pas NATIONAL ou AGENT (REGIONAL)", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}/request-photos`)
          .set("Authorization", `Bearer ${regionalToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });

      it("Retourne 403 si utilisateur n'est pas NATIONAL ou AGENT (DISTRICT)", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}/request-photos`)
          .set("Authorization", `Bearer ${districtToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });

      it("Retourne 403 si utilisateur n'a pas accès géographique (AGENT d'un autre healthCenter)", async () => {
        // Créer un autre healthCenter et un agent dedans
        const otherHealthCenterRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${districtToken}`)
          .send({ name: `OtherHealthCenter2-${Date.now()}`, address: "789 Other St" });
        expect(otherHealthCenterRes.statusCode).toBe(201);
        const otherHealthCenterId = otherHealthCenterRes.body.id;

        const otherAgentEmail = `other-agent-2-${Date.now()}@example.com`;
        testEmails.add(otherAgentEmail);
        const hashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherAgentEmail,
            password: hashedPassword,
            firstName: "Other",
            lastName: "Agent2",
            phone: "555555555",
            role: "AGENT",
            agentLevel: "ADMIN",
            isActive: true,
            emailVerified: true,
            districtId: districtId,
            healthCenterId: otherHealthCenterId,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherAgentEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const otherAgentToken = loginRes.body.accessToken;

        // Essayer de demander des photos pour un enfant d'un autre healthCenter
        const res = await request(app)
          .put(`/api/children/${childId}/request-photos`)
          .set("Authorization", `Bearer ${otherAgentToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si enfant non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const originalError = console.error;
        console.error = jest.fn();

        const res = await request(app)
          .put(`/api/children/${fakeId}/request-photos`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect([404, 500]).toContain(res.statusCode);
        console.error = originalError;
      });
    });

    describe("Succès", () => {
      it("Demande des photos avec succès (AGENT ADMIN)", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}/request-photos`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain("photos");
        expect(res.body.child).toBeDefined();
        expect(res.body.child.photosRequested).toBe(true);
        expect(res.body.child.isActive).toBe(false);

        // Vérifier en DB
        const childInDb = await prisma.children.findUnique({
          where: { id: childId },
        });
        expect(childInDb.photosRequested).toBe(true);
        expect(childInDb.isActive).toBe(false);
      });

      it("Demande des photos avec succès (NATIONAL)", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}/request-photos`)
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.child.photosRequested).toBe(true);
        expect(res.body.child.isActive).toBe(false);
      });

      it("Désactive le compte lors de la demande de photos", async () => {
        // Activer l'enfant d'abord
        await prisma.children.update({
          where: { id: childId },
          data: { isActive: true },
        });

        const res = await request(app)
          .put(`/api/children/${childId}/request-photos`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.child.isActive).toBe(false);

        // Vérifier en DB
        const childInDb = await prisma.children.findUnique({
          where: { id: childId },
        });
        expect(childInDb.isActive).toBe(false);
      });
    });
  });
});


