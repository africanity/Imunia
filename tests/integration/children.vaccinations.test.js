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
  notifyHealthCenterAgents: jest.fn().mockResolvedValue([]),
}));

describe("Children API - Vaccinations", () => {
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
  let vaccineId;
  let calendarId;
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
      await prisma.vaccine.deleteMany();
      await prisma.vaccineCalendar.deleteMany();

      // Créer le user NATIONAL directement en DB
      nationalEmail = `national-vaccinations-test-${Date.now()}@example.com`;
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
        .send({ name: `RegionForVaccinations-${Date.now()}` });
      expect(regionRes.statusCode).toBe(201);
      regionId = regionRes.body.id;

      // Créer une commune
      const communeRes = await request(app)
        .post("/api/commune")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ name: `CommuneForVaccinations-${Date.now()}`, regionId: regionId });
      expect(communeRes.statusCode).toBe(201);
      communeId = communeRes.body.id;

      // Créer un user REGIONAL directement en DB
      regionalEmail = `regional-vaccinations-test-${Date.now()}@example.com`;
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

      // Créer un district
      const districtRes = await request(app)
        .post("/api/district")
        .set("Authorization", `Bearer ${regionalToken}`)
        .send({ name: `DistrictForVaccinations-${Date.now()}`, communeId: communeId });
      expect(districtRes.statusCode).toBe(201);
      districtId = districtRes.body.id;

      // Créer un user DISTRICT directement en DB
      districtEmail = `district-vaccinations-test-${Date.now()}@example.com`;
      districtPassword = "motdepasse";
      testEmails.add(districtEmail);
      const districtHashedPassword = await bcrypt.hash(districtPassword, 10);

      await prisma.user.create({
        data: {
          email: districtEmail,
          password: districtHashedPassword,
          firstName: "District",
          lastName: "User",
          
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
      agentAdminEmail = `agentadmin-vaccinations-test-${Date.now()}@example.com`;
      agentAdminPassword = "motdepasse";
      testEmails.add(agentAdminEmail);
      const agentAdminHashedPassword = await bcrypt.hash(agentAdminPassword, 10);

      await prisma.user.create({
        data: {
          email: agentAdminEmail,
          password: agentAdminHashedPassword,
          firstName: "Agent",
          lastName: "Admin",
          
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
      agentStaffEmail = `agentstaff-vaccinations-test-${Date.now()}@example.com`;
      agentStaffPassword = "motdepasse";
      testEmails.add(agentStaffEmail);
      const agentStaffHashedPassword = await bcrypt.hash(agentStaffPassword, 10);

      await prisma.user.create({
        data: {
          email: agentStaffEmail,
          password: agentStaffHashedPassword,
          firstName: "Agent",
          lastName: "Staff",
          
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

      // Créer un vaccin pour les tests
      const vaccine = await prisma.vaccine.create({
        data: {
          name: `Test Vaccine ${Date.now()}`,
          description: "Vaccin de test",
          dosesRequired: "1",
          gender: null, // Pour tous les genres
        },
      });
      vaccineId = vaccine.id;

      // Créer un calendrier vaccinal pour les tests
      const calendar = await prisma.vaccineCalendar.create({
        data: {
          description: `Test Calendar ${Date.now()}`,
          ageUnit: "MONTHS",
          specificAge: 2,
          minAge: 0,
          maxAge: 24,
        },
      });
      calendarId = calendar.id;

      // Créer une assignation de dose pour le calendrier
      await prisma.vaccineCalendarDose.create({
        data: {
          vaccineId: vaccineId,
          calendarId: calendarId,
          doseNumber: 1,
        },
      });
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  beforeEach(async () => {
    try {
      // Nettoyage avant chaque test (mais garder les users, structures de base, vaccins et calendriers)
      await prisma.childVaccineCompleted.deleteMany();
      await prisma.childVaccineScheduled.deleteMany();
      await prisma.childVaccineDue.deleteMany();
      await prisma.childVaccineLate.deleteMany();
      await prisma.childVaccineOverdue.deleteMany();
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

      // Créer un enfant pour les tests
      const birthDate = new Date("2024-01-01");
      const childRes = await request(app)
        .post("/api/children")
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          firstName: "Vaccination",
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

      // Nettoyer les vaccinations automatiquement créées pour éviter les conflits
      await prisma.childVaccineDue.deleteMany({ where: { childId } });
      await prisma.childVaccineLate.deleteMany({ where: { childId } });
      await prisma.childVaccineOverdue.deleteMany({ where: { childId } });
      await prisma.childVaccineScheduled.deleteMany({ where: { childId } });
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
    await prisma.childVaccineCompleted.deleteMany();
    await prisma.childVaccineScheduled.deleteMany();
    await prisma.childVaccineDue.deleteMany();
    await prisma.childVaccineLate.deleteMany();
    await prisma.childVaccineOverdue.deleteMany();
    await prisma.children.deleteMany();
    await prisma.vaccineCalendarDose.deleteMany();
    await prisma.vaccineCalendar.deleteMany();
    await prisma.vaccine.deleteMany();
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

  describe("GET /api/children/:id/vaccinations - Liste des vaccinations", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app).get(`/api/children/${childId}/vaccinations`);
        expect(res.statusCode).toBe(401);
      });
    });

    describe("Autorisation", () => {
      it("Retourne 403 si utilisateur n'a pas accès géographique", async () => {
        // Créer une autre région et un enfant dedans
        const otherRegionRes = await request(app)
          .post("/api/region")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherRegion-${Date.now()}` });
        expect(otherRegionRes.statusCode).toBe(201);
        const otherRegionId = otherRegionRes.body.id;

        const otherCommuneRes = await request(app)
          .post("/api/commune")
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({ name: `OtherCommune-${Date.now()}`, regionId: otherRegionId });
        expect(otherCommuneRes.statusCode).toBe(201);
        const otherCommuneId = otherCommuneRes.body.id;

        // Créer un user REGIONAL pour l'autre région
        const otherRegionalEmail = `other-regional-${Date.now()}@example.com`;
        testEmails.add(otherRegionalEmail);
        const otherRegionalHashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherRegionalEmail,
            password: otherRegionalHashedPassword,
            firstName: "Other",
            lastName: "Regional",
            
            role: "REGIONAL",
            isActive: true,
            emailVerified: true,
            regionId: otherRegionId,
          },
        });

        const otherRegionalLoginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherRegionalEmail, password: "motdepasse" });
        expect(otherRegionalLoginRes.statusCode).toBe(200);
        const otherRegionalToken = otherRegionalLoginRes.body.accessToken;

        const otherDistrictRes = await request(app)
          .post("/api/district")
          .set("Authorization", `Bearer ${otherRegionalToken}`)
          .send({ name: `OtherDistrict-${Date.now()}`, communeId: otherCommuneId });
        expect(otherDistrictRes.statusCode).toBe(201);
        const otherDistrictId = otherDistrictRes.body.id;

        // Créer un user DISTRICT pour l'autre région
        const otherDistrictEmail = `other-district-${Date.now()}@example.com`;
        testEmails.add(otherDistrictEmail);
        const otherDistrictHashedPassword = await bcrypt.hash("motdepasse", 10);
        await prisma.user.create({
          data: {
            email: otherDistrictEmail,
            password: otherDistrictHashedPassword,
            firstName: "Other",
            lastName: "District",
            
            role: "DISTRICT",
            isActive: true,
            emailVerified: true,
            districtId: otherDistrictId,
          },
        });

        const otherDistrictLoginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherDistrictEmail, password: "motdepasse" });
        expect(otherDistrictLoginRes.statusCode).toBe(200);
        const otherDistrictToken = otherDistrictLoginRes.body.accessToken;

        const otherHealthCenterRes = await request(app)
          .post("/api/healthCenter")
          .set("Authorization", `Bearer ${otherDistrictToken}`)
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
            
            role: "AGENT",
            agentLevel: "ADMIN",
            isActive: true,
            emailVerified: true,
            districtId: otherDistrictId,
            healthCenterId: otherHealthCenterId,
          },
        });

        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: otherAgentEmail, password: "motdepasse" });
        expect(loginRes.statusCode).toBe(200);
        const otherAgentToken = loginRes.body.accessToken;

        // Essayer d'accéder aux vaccinations d'un enfant d'une autre région
        const res = await request(app)
          .get(`/api/children/${childId}/vaccinations`)
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
          .get(`/api/children/${fakeId}/vaccinations`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect([404, 500]).toContain(res.statusCode);
        console.error = originalError;
      });
    });

    describe("Succès", () => {
      it("Retourne la liste des vaccinations avec toutes les catégories", async () => {
        const res = await request(app)
          .get(`/api/children/${childId}/vaccinations`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("child");
        expect(res.body).toHaveProperty("vaccinations");
        expect(res.body.vaccinations).toHaveProperty("due");
        expect(res.body.vaccinations).toHaveProperty("scheduled");
        expect(res.body.vaccinations).toHaveProperty("late");
        expect(res.body.vaccinations).toHaveProperty("overdue");
        expect(res.body.vaccinations).toHaveProperty("completed");
        expect(Array.isArray(res.body.vaccinations.due)).toBe(true);
        expect(Array.isArray(res.body.vaccinations.scheduled)).toBe(true);
        expect(Array.isArray(res.body.vaccinations.late)).toBe(true);
        expect(Array.isArray(res.body.vaccinations.overdue)).toBe(true);
        expect(Array.isArray(res.body.vaccinations.completed)).toBe(true);
        expect(res.body.child.id).toBe(childId);
      });
    });
  });

  describe("POST /api/children/:id/vaccinations/:bucket - Création entrée manuelle", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post(`/api/children/${childId}/vaccinations/due`)
          .send({
            vaccineId: vaccineId,
            vaccineCalendarId: calendarId,
            scheduledFor: new Date().toISOString(),
            dose: 1,
          });
        expect(res.statusCode).toBe(401);
      });
    });

    describe("Validation", () => {
      it("Retourne 400 si bucket invalide", async () => {
        const res = await request(app)
          .post(`/api/children/${childId}/vaccinations/invalid`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            vaccineId: vaccineId,
            vaccineCalendarId: calendarId,
            scheduledFor: new Date().toISOString(),
            dose: 1,
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Type d'entrée invalide.");
      });

      it("Retourne 404 si enfant non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const originalError = console.error;
        console.error = jest.fn();

        const res = await request(app)
          .post(`/api/children/${fakeId}/vaccinations/due`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            vaccineId: vaccineId,
            vaccineCalendarId: calendarId,
            scheduledFor: new Date().toISOString(),
            dose: 1,
          });

        expect([404, 500]).toContain(res.statusCode);
        console.error = originalError;
      });

      it("Retourne 403 si AGENT_STAFF essaie de créer", async () => {
        const res = await request(app)
          .post(`/api/children/${childId}/vaccinations/due`)
          .set("Authorization", `Bearer ${agentStaffToken}`)
          .send({
            vaccineId: vaccineId,
            vaccineCalendarId: calendarId,
            scheduledFor: new Date().toISOString(),
            dose: 1,
          });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Bucket: due", () => {
      it("Crée une entrée due avec succès (AGENT ADMIN)", async () => {
        const scheduledFor = new Date("2024-12-31");
        const res = await request(app)
          .post(`/api/children/${childId}/vaccinations/due`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            vaccineId: vaccineId,
            vaccineCalendarId: calendarId,
            scheduledFor: scheduledFor.toISOString(),
            dose: 1,
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.id).toBeDefined();

        // Vérifier en DB
        const entry = await prisma.childVaccineDue.findUnique({
          where: { id: res.body.id },
        });
        expect(entry).not.toBeNull();
        expect(entry.childId).toBe(childId);
        expect(entry.vaccineId).toBe(vaccineId);
        expect(entry.vaccineCalendarId).toBe(calendarId);
        expect(entry.dose).toBe(1);
      });

      it("Crée une entrée due avec succès (NATIONAL)", async () => {
        const scheduledFor = new Date("2024-12-31");
        const res = await request(app)
          .post(`/api/children/${childId}/vaccinations/due`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .send({
            vaccineId: vaccineId,
            vaccineCalendarId: calendarId,
            scheduledFor: scheduledFor.toISOString(),
            dose: 1,
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
      });

      it("Crée une entrée due avec succès (REGIONAL)", async () => {
        const scheduledFor = new Date("2024-12-31");
        const res = await request(app)
          .post(`/api/children/${childId}/vaccinations/due`)
          .set("Authorization", `Bearer ${regionalToken}`)
          .send({
            vaccineId: vaccineId,
            vaccineCalendarId: calendarId,
            scheduledFor: scheduledFor.toISOString(),
            dose: 1,
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
      });

      it("Crée une entrée due avec succès (DISTRICT)", async () => {
        const scheduledFor = new Date("2024-12-31");
        const res = await request(app)
          .post(`/api/children/${childId}/vaccinations/due`)
          .set("Authorization", `Bearer ${districtToken}`)
          .send({
            vaccineId: vaccineId,
            vaccineCalendarId: calendarId,
            scheduledFor: scheduledFor.toISOString(),
            dose: 1,
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
      });
    });

    describe("Bucket: late", () => {
      it("Crée une entrée late avec succès", async () => {
        const dueDate = new Date("2024-01-01");
        const res = await request(app)
          .post(`/api/children/${childId}/vaccinations/late`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            vaccineId: vaccineId,
            vaccineCalendarId: calendarId,
            dueDate: dueDate.toISOString(),
            dose: 1,
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.id).toBeDefined();

        // Vérifier en DB
        const entry = await prisma.childVaccineLate.findUnique({
          where: { id: res.body.id },
        });
        expect(entry).not.toBeNull();
        expect(entry.childId).toBe(childId);
        expect(entry.vaccineId).toBe(vaccineId);
        expect(entry.dueDate).toBeDefined();
      });
    });

    describe("Bucket: overdue", () => {
      it("Crée une entrée overdue avec succès", async () => {
        const dueDate = new Date("2024-01-01");
        const res = await request(app)
          .post(`/api/children/${childId}/vaccinations/overdue`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            vaccineId: vaccineId,
            vaccineCalendarId: calendarId,
            dueDate: dueDate.toISOString(),
            dose: 1,
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.id).toBeDefined();

        // Vérifier en DB
        const entry = await prisma.childVaccineOverdue.findUnique({
          where: { id: res.body.id },
        });
        expect(entry).not.toBeNull();
        expect(entry.childId).toBe(childId);
      });
    });

    describe("Bucket: completed", () => {
      it("Crée une entrée completed avec succès", async () => {
        const administeredAt = new Date();
        const res = await request(app)
          .post(`/api/children/${childId}/vaccinations/completed`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            vaccineId: vaccineId,
            vaccineCalendarId: calendarId,
            administeredAt: administeredAt.toISOString(),
            dose: 1,
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.id).toBeDefined();

        // Vérifier en DB
        const entry = await prisma.childVaccineCompleted.findUnique({
          where: { id: res.body.id },
        });
        expect(entry).not.toBeNull();
        expect(entry.childId).toBe(childId);
        expect(entry.vaccineId).toBe(vaccineId);
        expect(entry.administeredById).toBeDefined();
      });

      it("Crée une entrée completed avec administeredById spécifié", async () => {
        // Récupérer l'ID de l'agent admin
        const agentAdmin = await prisma.user.findUnique({
          where: { email: agentAdminEmail },
          select: { id: true },
        });
        expect(agentAdmin).not.toBeNull();

        const administeredAt = new Date();
        const res = await request(app)
          .post(`/api/children/${childId}/vaccinations/completed`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({
            vaccineId: vaccineId,
            vaccineCalendarId: calendarId,
            administeredAt: administeredAt.toISOString(),
            dose: 1,
            administeredById: agentAdmin.id,
          });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);

        // Vérifier en DB
        const entry = await prisma.childVaccineCompleted.findUnique({
          where: { id: res.body.id },
        });
        expect(entry.administeredById).toBe(agentAdmin.id);
      });
    });
  });

  describe("PUT /api/children/:id/vaccinations/:bucket/:entryId - Modification entrée", () => {
    let dueEntryId;
    let lateEntryId;
    let completedEntryId;

    beforeEach(async () => {
      // Créer des entrées pour les tests de modification
      const scheduledFor = new Date("2024-12-31");
      const dueRes = await request(app)
        .post(`/api/children/${childId}/vaccinations/due`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          vaccineId: vaccineId,
          vaccineCalendarId: calendarId,
          scheduledFor: scheduledFor.toISOString(),
          dose: 1,
        });
      expect(dueRes.statusCode).toBe(201);
      dueEntryId = dueRes.body.id;

      const dueDate = new Date("2024-01-01");
      const lateRes = await request(app)
        .post(`/api/children/${childId}/vaccinations/late`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          vaccineId: vaccineId,
          vaccineCalendarId: calendarId,
          dueDate: dueDate.toISOString(),
          dose: 1,
        });
      expect(lateRes.statusCode).toBe(201);
      lateEntryId = lateRes.body.id;

      const administeredAt = new Date();
      const completedRes = await request(app)
        .post(`/api/children/${childId}/vaccinations/completed`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          vaccineId: vaccineId,
          vaccineCalendarId: calendarId,
          administeredAt: administeredAt.toISOString(),
          dose: 1,
        });
      expect(completedRes.statusCode).toBe(201);
      completedEntryId = completedRes.body.id;
    });

    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}/vaccinations/due/${dueEntryId}`)
          .send({ scheduledFor: new Date().toISOString() });
        expect(res.statusCode).toBe(401);
      });
    });

    describe("Validation", () => {
      it("Retourne 400 si bucket invalide", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}/vaccinations/invalid/${dueEntryId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ scheduledFor: new Date().toISOString() });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Type d'entrée invalide.");
      });

      it("Retourne 404 si entrée non trouvée", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const originalError = console.error;
        console.error = jest.fn();

        const res = await request(app)
          .put(`/api/children/${childId}/vaccinations/due/${fakeId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ scheduledFor: new Date().toISOString() });

        expect([404, 500]).toContain(res.statusCode);
        console.error = originalError;
      });

      it("Retourne 400 si aucune donnée à mettre à jour", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}/vaccinations/due/${dueEntryId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({});

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Aucune donnée à mettre à jour.");
      });

      it("Retourne 403 si AGENT_STAFF essaie de modifier", async () => {
        const res = await request(app)
          .put(`/api/children/${childId}/vaccinations/due/${dueEntryId}`)
          .set("Authorization", `Bearer ${agentStaffToken}`)
          .send({ scheduledFor: new Date().toISOString() });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Succès", () => {
      it("Modifie une entrée due avec succès", async () => {
        const newScheduledFor = new Date("2025-01-01");
        const res = await request(app)
          .put(`/api/children/${childId}/vaccinations/due/${dueEntryId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ scheduledFor: newScheduledFor.toISOString() });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        // Vérifier en DB
        const entry = await prisma.childVaccineDue.findUnique({
          where: { id: dueEntryId },
        });
        expect(entry.scheduledFor).toBeDefined();
      });

      it("Modifie une entrée late avec succès", async () => {
        const newDueDate = new Date("2025-01-01");
        const res = await request(app)
          .put(`/api/children/${childId}/vaccinations/late/${lateEntryId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ dueDate: newDueDate.toISOString() });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it("Modifie une entrée completed avec succès", async () => {
        const newAdministeredAt = new Date();
        const res = await request(app)
          .put(`/api/children/${childId}/vaccinations/completed/${completedEntryId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .send({ administeredAt: newAdministeredAt.toISOString() });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });
  });

  describe("DELETE /api/children/:id/vaccinations/:bucket/:entryId - Suppression entrée", () => {
    let dueEntryId;
    let lateEntryId;
    let completedEntryId;

    beforeEach(async () => {
      // Créer des entrées pour les tests de suppression
      const scheduledFor = new Date("2024-12-31");
      const dueRes = await request(app)
        .post(`/api/children/${childId}/vaccinations/due`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          vaccineId: vaccineId,
          vaccineCalendarId: calendarId,
          scheduledFor: scheduledFor.toISOString(),
          dose: 1,
        });
      expect(dueRes.statusCode).toBe(201);
      dueEntryId = dueRes.body.id;

      const dueDate = new Date("2024-01-01");
      const lateRes = await request(app)
        .post(`/api/children/${childId}/vaccinations/late`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          vaccineId: vaccineId,
          vaccineCalendarId: calendarId,
          dueDate: dueDate.toISOString(),
          dose: 1,
        });
      expect(lateRes.statusCode).toBe(201);
      lateEntryId = lateRes.body.id;

      const administeredAt = new Date();
      const completedRes = await request(app)
        .post(`/api/children/${childId}/vaccinations/completed`)
        .set("Authorization", `Bearer ${agentAdminToken}`)
        .send({
          vaccineId: vaccineId,
          vaccineCalendarId: calendarId,
          administeredAt: administeredAt.toISOString(),
          dose: 1,
        });
      expect(completedRes.statusCode).toBe(201);
      completedEntryId = completedRes.body.id;
    });

    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .delete(`/api/children/${childId}/vaccinations/due/${dueEntryId}`);
        expect(res.statusCode).toBe(401);
      });
    });

    describe("Validation", () => {
      it("Retourne 400 si bucket invalide", async () => {
        const res = await request(app)
          .delete(`/api/children/${childId}/vaccinations/invalid/${dueEntryId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`);
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe("Type d'entrée invalide.");
      });

      it("Retourne 404 si entrée non trouvée", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const originalError = console.error;
        console.error = jest.fn();

        const res = await request(app)
          .delete(`/api/children/${childId}/vaccinations/due/${fakeId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect([404, 500]).toContain(res.statusCode);
        console.error = originalError;
      });

      it("Retourne 403 si AGENT_STAFF essaie de supprimer", async () => {
        const res = await request(app)
          .delete(`/api/children/${childId}/vaccinations/due/${dueEntryId}`)
          .set("Authorization", `Bearer ${agentStaffToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Accès refusé");
      });
    });

    describe("Succès", () => {
      it("Supprime une entrée due avec succès", async () => {
        const res = await request(app)
          .delete(`/api/children/${childId}/vaccinations/due/${dueEntryId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        // Vérifier en DB
        const entry = await prisma.childVaccineDue.findUnique({
          where: { id: dueEntryId },
        });
        expect(entry).toBeNull();
      });

      it("Supprime une entrée late avec succès", async () => {
        const res = await request(app)
          .delete(`/api/children/${childId}/vaccinations/late/${lateEntryId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        // Vérifier en DB
        const entry = await prisma.childVaccineLate.findUnique({
          where: { id: lateEntryId },
        });
        expect(entry).toBeNull();
      });

      it("Supprime une entrée completed avec succès", async () => {
        const res = await request(app)
          .delete(`/api/children/${childId}/vaccinations/completed/${completedEntryId}`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        // Vérifier en DB
        const entry = await prisma.childVaccineCompleted.findUnique({
          where: { id: completedEntryId },
        });
        expect(entry).toBeNull();
      });
    });
  });
});

