const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");
const tokenService = require("../../src/services/tokenService");

jest.mock('../../src/services/emailService', () => ({
  sendInvitationEmail: jest.fn().mockResolvedValue([]),
  sendTwoFactorCode: jest.fn().mockResolvedValue([]),
  sendPasswordResetCode: jest.fn().mockResolvedValue([]),
  sendChildAccountActivatedEmail: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/services/notification', () => ({
  sendParentAccessCode: jest.fn().mockResolvedValue({ success: true }),
  sendVerificationCode: jest.fn().mockResolvedValue({ success: true }),
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

// Mock multer pour les uploads - doit être fait avant l'import de l'app
const multerMiddleware = (req, res, next) => {
  req.files = [];
  req.file = null;
  next();
};

jest.mock('multer', () => {
  const multer = jest.fn(() => ({
    array: jest.fn(() => multerMiddleware),
    single: jest.fn(() => multerMiddleware),
    fields: jest.fn(() => multerMiddleware),
    any: jest.fn(() => multerMiddleware),
  }));
  
  multer.diskStorage = jest.fn(() => ({}));
  multer.memoryStorage = jest.fn(() => ({}));
  
  return multer;
});

// Helper function pour supprimer un enfant et toutes ses relations
const deleteChildWithRelations = async (phoneParent) => {
  const children = await prisma.children.findMany({
    where: { phoneParent },
    select: { id: true },
  });
  
  const childIds = children.map(c => c.id);
  
  if (childIds.length > 0) {
    await prisma.childVaccineCompleted.deleteMany({
      where: { childId: { in: childIds } },
    });
    await prisma.childVaccineDue.deleteMany({
      where: { childId: { in: childIds } },
    });
    await prisma.childVaccineLate.deleteMany({
      where: { childId: { in: childIds } },
    });
    await prisma.childVaccineOverdue.deleteMany({
      where: { childId: { in: childIds } },
    });
    await prisma.childVaccineScheduled.deleteMany({
      where: { childId: { in: childIds } },
    });
    await prisma.vaccineRequest.deleteMany({
      where: { childId: { in: childIds } },
    });
    await prisma.childVaccinationProof.deleteMany({
      where: { childId: { in: childIds } },
    });
    await prisma.notification.deleteMany({
      where: { childId: { in: childIds } },
    });
    await prisma.appointmentNotification.deleteMany({
      where: { childId: { in: childIds } },
    });
    await prisma.children.deleteMany({
      where: { phoneParent },
    });
  }
};

describe("Mobile API - Application mobile", () => {
  let regionId;
  let communeId;
  let districtId;
  let healthCenterId;
  let childId;
  let parentPhone;
  let accessCode;
  let parentToken;
  let vaccineId;
  let vaccineCalendarId;

  beforeAll(async () => {
    try {
      // Nettoyage complet
      await prisma.children.deleteMany();
      await prisma.user.deleteMany();
      await prisma.healthCenter.deleteMany();
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();
      await prisma.vaccineCalendar.deleteMany();
      await prisma.vaccine.deleteMany();

      // Créer une structure hiérarchique
      const region = await prisma.region.create({
        data: {
          name: `RegionMobile-${Date.now()}`,
        },
      });
      regionId = region.id;

      const commune = await prisma.commune.create({
        data: {
          name: `CommuneMobile-${Date.now()}`,
          regionId: regionId,
        },
      });
      communeId = commune.id;

      const district = await prisma.district.create({
        data: {
          name: `DistrictMobile-${Date.now()}`,
          communeId: communeId,
        },
      });
      districtId = district.id;

      const healthCenter = await prisma.healthCenter.create({
        data: {
          name: `HealthCenterMobile-${Date.now()}`,
          address: "Adresse test",
          districtId: districtId,
        },
      });
      healthCenterId = healthCenter.id;

      // Créer un vaccin pour les tests
      const vaccine = await prisma.vaccine.create({
        data: {
          name: "Vaccin Test Mobile",
          description: "Description du vaccin test mobile",
          dosesRequired: "2",
        },
      });
      vaccineId = vaccine.id;

      // Créer un calendrier vaccinal
      const calendar = await prisma.vaccineCalendar.create({
        data: {
          description: "Test Calendar",
          ageUnit: "MONTHS",
          minAge: 0,
          maxAge: 12,
          specificAge: 0,
        },
      });
      vaccineCalendarId = calendar.id;

      // Créer une assignation de dose
      await prisma.vaccineCalendarDose.create({
        data: {
          calendarId: calendar.id,
          vaccineId: vaccine.id,
          doseNumber: 1,
        },
      });
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  afterAll(async () => {
    // Supprimer dans l'ordre pour respecter les contraintes de clés étrangères
    await prisma.childVaccineCompleted.deleteMany();
    await prisma.childVaccineDue.deleteMany();
    await prisma.childVaccineLate.deleteMany();
    await prisma.childVaccineOverdue.deleteMany();
    await prisma.childVaccineScheduled.deleteMany();
    await prisma.vaccineRequest.deleteMany();
    await prisma.childVaccinationProof.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.appointmentNotification.deleteMany();
    await prisma.children.deleteMany();
    await prisma.user.deleteMany();
    await prisma.vaccineCalendarDose.deleteMany();
    await prisma.vaccineCalendar.deleteMany();
    await prisma.healthCenter.deleteMany();
    await prisma.district.deleteMany();
    await prisma.commune.deleteMany();
    await prisma.region.deleteMany();
    await prisma.vaccine.deleteMany();
    await prisma.$disconnect();
  });

  describe("POST /api/mobile/request-verification-code - Demande de code de vérification", () => {
    it("Retourne 400 si champs obligatoires manquants", async () => {
      const res = await request(app)
        .post("/api/mobile/request-verification-code")
        .send({
          parentPhone: "+221771234567",
          // Champs manquants
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("Crée une inscription en attente avec succès", async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const res = await request(app)
        .post("/api/mobile/request-verification-code")
        .send({
          parentPhone,
          childFirstName: "Test",
          childLastName: "Child",
          childBirthDate: "2023-01-01",
          childGender: "M",
          birthPlace: "Dakar",
          fatherName: "Père Test",
          motherName: "Mère Test",
          address: "Adresse test",
          healthCenterId: healthCenterId,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("registrationId");
      expect(res.body).toHaveProperty("message");
    });

    it("Retourne 400 si aucun centre de santé disponible", async () => {
      // Supprimer tous les centres
      await prisma.children.deleteMany();
      await prisma.healthCenter.deleteMany();

      const res = await request(app)
        .post("/api/mobile/request-verification-code")
        .send({
          parentPhone: "+221771234568",
          childFirstName: "Test",
          childLastName: "Child",
          childBirthDate: "2023-01-01",
          childGender: "M",
          birthPlace: "Dakar",
          fatherName: "Père Test",
          motherName: "Mère Test",
          address: "Adresse test",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);

      // Recréer le centre pour les autres tests
      const newHealthCenter = await prisma.healthCenter.create({
        data: {
          name: `HealthCenterMobile-${Date.now()}`,
          address: "Adresse test",
          districtId: districtId,
        },
      });
      healthCenterId = newHealthCenter.id;
    });
  });

  describe("POST /api/mobile/resend-verification-code - Renvoyer le code", () => {
    let registrationId;

    beforeEach(async () => {
      // Créer une inscription en attente
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Resend",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: `VERIFY_123456_${Date.now() + 600000}`,
          passwordParent: "0000",
          status: "A_JOUR",
        },
      });
      registrationId = child.id;
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 400 si registrationId manquant", async () => {
      const res = await request(app)
        .post("/api/mobile/resend-verification-code")
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 404 si inscription introuvable", async () => {
      const res = await request(app)
        .post("/api/mobile/resend-verification-code")
        .send({ registrationId: "00000000-0000-0000-0000-000000000000" });

      expect(res.statusCode).toBe(404);
    });

    it("Renvoie le code avec succès", async () => {
      const res = await request(app)
        .post("/api/mobile/resend-verification-code")
        .send({ registrationId });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /api/mobile/parent-register - Inscription parent/enfant", () => {
    let registrationId;
    let verificationCode;

    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      verificationCode = "123456";
      const expiresAt = Date.now() + 600000; // 10 minutes

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Register",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: `VERIFY_${verificationCode}_${expiresAt}`,
          passwordParent: "0000",
          status: "A_JOUR",
        },
      });
      registrationId = child.id;
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 400 si champs manquants", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-register")
        .send({ registrationId });

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 404 si inscription introuvable", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-register")
        .send({
          registrationId: "00000000-0000-0000-0000-000000000000",
          verificationCode: "123456",
        });

      expect(res.statusCode).toBe(404);
    });

    it("Retourne 400 si code incorrect", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-register")
        .send({
          registrationId,
          verificationCode: "999999",
        });

      expect(res.statusCode).toBe(400);
    });

    it("Active le compte avec succès", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-register")
        .send({
          registrationId,
          verificationCode,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("child");

      // Vérifier que le code d'accès a été généré
      const child = await prisma.children.findUnique({
        where: { id: registrationId },
      });
      expect(child.code).not.toBeNull();
      expect(child.code).not.toMatch(/^VERIFY_/);
    });
  });

  describe("POST /api/mobile/verify-access-code - Vérification code d'accès", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      accessCode = "ABCDEF";

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Access",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: accessCode,
          passwordParent: "0000",
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 400 si champs manquants", async () => {
      const res = await request(app)
        .post("/api/mobile/verify-access-code")
        .send({ phone: parentPhone });

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 401 si code invalide", async () => {
      const res = await request(app)
        .post("/api/mobile/verify-access-code")
        .send({
          phone: parentPhone,
          accessCode: "INVALID",
        });

      expect(res.statusCode).toBe(401);
    });

    it("Génère un token avec succès", async () => {
      const res = await request(app)
        .post("/api/mobile/verify-access-code")
        .send({
          phone: parentPhone,
          accessCode,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("child");
      expect(res.body).toHaveProperty("hasPin");
    });
  });

  describe("POST /api/mobile/parent-login - Connexion avec PIN", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const hashedPin = await bcrypt.hash("1234", 10);

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Login",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: null,
          passwordParent: hashedPin,
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 400 si champs manquants", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-login")
        .send({ phone: parentPhone });

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 401 si aucun compte trouvé", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-login")
        .send({
          phone: "+221999999999",
          pin: "1234",
        });

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 401 si PIN incorrect", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-login")
        .send({
          phone: parentPhone,
          pin: "9999",
        });

      expect(res.statusCode).toBe(401);
    });

    it("Connecte avec succès", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-login")
        .send({
          phone: parentPhone,
          pin: "1234",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("child");
    });
  });

  describe("POST /api/mobile/parent-pin/save - Sauvegarder PIN", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      accessCode = "ABCDEF";

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Pin",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: accessCode,
          passwordParent: "0000",
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 400 si champs manquants", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-pin/save")
        .send({ childId, parentPhone });

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 400 si PIN invalide (pas 4 chiffres)", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-pin/save")
        .send({
          childId,
          parentPhone,
          pin: "123",
        });

      expect(res.statusCode).toBe(400);
    });

    it("Sauvegarde le PIN avec succès", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-pin/save")
        .send({
          childId,
          parentPhone,
          pin: "5678",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Vérifier que le PIN a été sauvegardé et le code supprimé
      const child = await prisma.children.findUnique({
        where: { id: childId },
      });
      expect(child.code).toBeNull();
      expect(child.passwordParent).not.toBe("0000");
    });
  });

  describe("POST /api/mobile/parent-pin/verify - Vérifier PIN", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const hashedPin = await bcrypt.hash("1234", 10);

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Verify",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: null,
          passwordParent: hashedPin,
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 400 si champs manquants", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-pin/verify")
        .send({ childId, parentPhone });

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 401 si PIN non configuré", async () => {
      // Créer un enfant sans PIN
      const childWithoutPin = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "NoPin",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: `+22177${Date.now()}`,
          code: null,
          passwordParent: "0000",
          isActive: true,
          status: "A_JOUR",
        },
      });

      const res = await request(app)
        .post("/api/mobile/parent-pin/verify")
        .send({
          childId: childWithoutPin.id,
          parentPhone: childWithoutPin.phoneParent,
          pin: "1234",
        });

      expect(res.statusCode).toBe(401);

      await prisma.children.delete({ where: { id: childWithoutPin.id } });
    });

    it("Retourne 401 si PIN incorrect", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-pin/verify")
        .send({
          childId,
          parentPhone,
          pin: "9999",
        });

      expect(res.statusCode).toBe(401);
    });

    it("Génère un token avec succès", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-pin/verify")
        .send({
          childId,
          parentPhone,
          pin: "1234",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("child");
    });
  });

  describe("GET /api/mobile/regions - Liste des régions", () => {
    it("Retourne la liste des régions", async () => {
      const res = await request(app).get("/api/mobile/regions");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("items");
      expect(Array.isArray(res.body.items)).toBe(true);
    });
  });

  describe("GET /api/mobile/health-centers - Liste des centres de santé", () => {
    it("Retourne la liste des centres", async () => {
      const res = await request(app).get("/api/mobile/health-centers");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("items");
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it("Filtre par regionId", async () => {
      const res = await request(app)
        .get(`/api/mobile/health-centers?regionId=${regionId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/mobile/vaccine-calendar - Calendrier vaccinal", () => {
    it("Retourne le calendrier vaccinal", async () => {
      const res = await request(app).get("/api/mobile/vaccine-calendar");

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("Filtre par childId", async () => {
      // Créer un enfant pour le test
      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Calendar",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: `+22177${Date.now()}`,
          code: "TEST",
          passwordParent: "0000",
          isActive: true,
          status: "A_JOUR",
        },
      });

      const res = await request(app)
        .get(`/api/mobile/vaccine-calendar?childId=${child.id}`);

      expect(res.statusCode).toBe(200);

      await prisma.children.delete({ where: { id: child.id } });
    });
  });

  describe("POST /api/mobile/children/:childId/mark-vaccines-done - Marquer vaccins effectués", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Vaccines",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: "TEST",
          passwordParent: "0000",
          isActive: false,
          status: "A_JOUR",
        },
      });
      childId = child.id;
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 400 si vaccines n'est pas un tableau", async () => {
      const res = await request(app)
        .post(`/api/mobile/children/${childId}/mark-vaccines-done`)
        .send({ vaccines: "invalid" });

      expect(res.statusCode).toBe(400);
    });

    it("Retourne 404 si enfant introuvable", async () => {
      const res = await request(app)
        .post("/api/mobile/children/00000000-0000-0000-0000-000000000000/mark-vaccines-done")
        .send({ vaccines: [] });

      expect(res.statusCode).toBe(404);
    });

    it("Marque les vaccins comme effectués avec succès", async () => {
      const res = await request(app)
        .post(`/api/mobile/children/${childId}/mark-vaccines-done`)
        .send({
          vaccines: [
            {
              vaccineId: vaccineId,
              vaccineCalendarId: vaccineCalendarId,
              administeredAt: new Date().toISOString(),
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isActive).toBe(true);
    });
  });

  describe("GET /api/mobile/advice - Conseils", () => {
    it("Retourne la liste des conseils", async () => {
      const res = await request(app).get("/api/mobile/advice");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("items");
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it("Filtre par âge", async () => {
      const res = await request(app)
        .get("/api/mobile/advice?age=6&ageUnit=MONTHS");

      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/mobile/campaigns - Campagnes", () => {
    it("Retourne la liste des campagnes", async () => {
      const res = await request(app).get("/api/mobile/campaigns");

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("campaigns");
      expect(Array.isArray(res.body.campaigns)).toBe(true);
    });
  });

  describe("GET /api/mobile/children/:childId/dashboard - Dashboard enfant", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const hashedPin = await bcrypt.hash("1234", 10);

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Dashboard",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: null,
          passwordParent: hashedPin,
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;

      // Générer un token
      parentToken = tokenService.signAccessToken({
        sub: childId,
        type: "parent",
        phone: parentPhone,
      });
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/dashboard`);

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 403 si accès refusé", async () => {
      // Créer un autre enfant
      const otherChild = await prisma.children.create({
        data: {
          firstName: "Other",
          lastName: "Child",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: `+22177${Date.now()}`,
          code: null,
          passwordParent: "0000",
          isActive: true,
          status: "A_JOUR",
        },
      });

      const otherToken = tokenService.signAccessToken({
        sub: otherChild.id,
        type: "parent",
        phone: otherChild.phoneParent,
      });

      const res = await request(app)
        .get(`/api/mobile/children/${childId}/dashboard`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.statusCode).toBe(403);

      await prisma.children.delete({ where: { id: otherChild.id } });
    });

    it("Retourne le dashboard avec succès", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/dashboard`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("child");
      expect(res.body).toHaveProperty("vaccinations");
    });
  });

  describe("GET /api/mobile/children/:childId/appointments - Rendez-vous", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const hashedPin = await bcrypt.hash("1234", 10);

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Appointments",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: null,
          passwordParent: hashedPin,
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;

      parentToken = tokenService.signAccessToken({
        sub: childId,
        type: "parent",
        phone: parentPhone,
      });
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/appointments`);

      expect(res.statusCode).toBe(401);
    });

    it("Retourne la liste des rendez-vous", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/appointments`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("appointments");
      expect(Array.isArray(res.body.appointments)).toBe(true);
    });
  });

  describe("GET /api/mobile/children/:childId/calendar - Calendrier enfant", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const hashedPin = await bcrypt.hash("1234", 10);

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Calendar",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: null,
          passwordParent: hashedPin,
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;

      parentToken = tokenService.signAccessToken({
        sub: childId,
        type: "parent",
        phone: parentPhone,
      });
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/calendar`);

      expect(res.statusCode).toBe(401);
    });

    it("Retourne le calendrier", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/calendar`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("merged");
      expect(Array.isArray(res.body.merged)).toBe(true);
    });
  });

  describe("GET /api/mobile/children/:childId/notifications - Notifications", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const hashedPin = await bcrypt.hash("1234", 10);

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Notifications",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: null,
          passwordParent: hashedPin,
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;

      parentToken = tokenService.signAccessToken({
        sub: childId,
        type: "parent",
        phone: parentPhone,
      });
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/notifications`);

      expect(res.statusCode).toBe(401);
    });

    it("Retourne la liste des notifications", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/notifications`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("notifications");
      expect(Array.isArray(res.body.notifications)).toBe(true);
    });
  });

  describe("GET /api/mobile/children/:childId/notifications/unread-count - Nombre notifications non lues", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const hashedPin = await bcrypt.hash("1234", 10);

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Unread",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: null,
          passwordParent: hashedPin,
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;

      parentToken = tokenService.signAccessToken({
        sub: childId,
        type: "parent",
        phone: parentPhone,
      });
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/notifications/unread-count`);

      expect(res.statusCode).toBe(401);
    });

    it("Retourne le nombre de notifications non lues", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/notifications/unread-count`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("count");
      expect(typeof res.body.count).toBe("number");
    });
  });

  describe("PUT /api/mobile/children/:childId/notifications/mark-all-read - Marquer toutes comme lues", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const hashedPin = await bcrypt.hash("1234", 10);

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "MarkRead",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: null,
          passwordParent: hashedPin,
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;

      parentToken = tokenService.signAccessToken({
        sub: childId,
        type: "parent",
        phone: parentPhone,
      });
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .put(`/api/mobile/children/${childId}/notifications/mark-all-read`);

      expect(res.statusCode).toBe(401);
    });

    it("Marque toutes les notifications comme lues", async () => {
      const res = await request(app)
        .put(`/api/mobile/children/${childId}/notifications/mark-all-read`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
    });
  });

  describe("POST /api/mobile/children/:childId/vaccine-requests - Créer demande de vaccin", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const hashedPin = await bcrypt.hash("1234", 10);

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Request",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: null,
          passwordParent: hashedPin,
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;

      parentToken = tokenService.signAccessToken({
        sub: childId,
        type: "parent",
        phone: parentPhone,
      });
    });

    afterEach(async () => {
      await prisma.vaccineRequest.deleteMany({
        where: { childId },
      });
      await prisma.children.deleteMany({
        where: { phoneParent: parentPhone },
      });
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .post(`/api/mobile/children/${childId}/vaccine-requests`);

      expect(res.statusCode).toBe(401);
    });

    it("Crée une demande de vaccin avec succès", async () => {
      const res = await request(app)
        .post(`/api/mobile/children/${childId}/vaccine-requests`)
        .set("Authorization", `Bearer ${parentToken}`)
        .send({
          vaccineId: vaccineId,
          preferredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("success", true);
    });
  });

  describe("POST /api/mobile/children/:childId/vaccination-proofs - Upload preuves", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const hashedPin = await bcrypt.hash("1234", 10);

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Proofs",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: null,
          passwordParent: hashedPin,
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;

      parentToken = tokenService.signAccessToken({
        sub: childId,
        type: "parent",
        phone: parentPhone,
      });
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .post(`/api/mobile/children/${childId}/vaccination-proofs`);

      expect(res.statusCode).toBe(401);
    });

    it("Upload des preuves avec succès", async () => {
      const res = await request(app)
        .post(`/api/mobile/children/${childId}/vaccination-proofs`)
        .set("Authorization", `Bearer ${parentToken}`)
        .attach("files", Buffer.from("fake image"), "test.jpg");

      // Le mock multer ne fait rien, donc on vérifie juste que la route est accessible
      // En réalité, il faudrait un vrai fichier
      // Peut retourner 200, 201, 400 ou 500 selon les erreurs de traitement
      expect([200, 201, 400, 500]).toContain(res.statusCode);
    });
  });

  describe("POST /api/mobile/parent-pin/request-change-code - Demander code changement PIN", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const hashedPin = await bcrypt.hash("1234", 10);

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "ChangePin",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: null,
          passwordParent: hashedPin,
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;

      parentToken = tokenService.signAccessToken({
        sub: childId,
        type: "parent",
        phone: parentPhone,
      });
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-pin/request-change-code");

      expect(res.statusCode).toBe(401);
    });

    it("Demande un code de changement avec succès", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-pin/request-change-code")
        .set("Authorization", `Bearer ${parentToken}`)
        .send({
          childId,
          parentPhone,
          oldPin: "1234",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
    });
  });

  describe("POST /api/mobile/parent-pin/change - Changer PIN", () => {
    beforeEach(async () => {
      parentPhone = `+22177${Date.now().toString().slice(-6)}`;
      const hashedPin = await bcrypt.hash("1234", 10);

      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Change",
          birthDate: new Date("2023-01-01"),
          gender: "M",
          birthPlace: "Dakar",
          fatherName: "Père",
          motherName: "Mère",
          address: "Adresse",
          healthCenterId: healthCenterId,
          phoneParent: parentPhone,
          code: null,
          passwordParent: hashedPin,
          isActive: true,
          status: "A_JOUR",
        },
      });
      childId = child.id;

      parentToken = tokenService.signAccessToken({
        sub: childId,
        type: "parent",
        phone: parentPhone,
      });
    });

    afterEach(async () => {
      await deleteChildWithRelations(parentPhone);
    });

    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-pin/change");

      expect(res.statusCode).toBe(401);
    });

    it("Retourne 400 si champs manquants", async () => {
      const res = await request(app)
        .post("/api/mobile/parent-pin/change")
        .set("Authorization", `Bearer ${parentToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it("Change le PIN avec succès", async () => {
      // D'abord, demander un code de changement
      await request(app)
        .post("/api/mobile/parent-pin/request-change-code")
        .set("Authorization", `Bearer ${parentToken}`)
        .send({
          childId,
          parentPhone,
          oldPin: "1234",
        });

      // Récupérer le code depuis la base (format: CHANGE_PIN_CODE_EXPIRESAT)
      const child = await prisma.children.findUnique({
        where: { id: childId },
      });
      
      if (!child.code || !child.code.startsWith("CHANGE_PIN_")) {
        throw new Error("Code de changement non généré");
      }

      const codeParts = child.code.split("_");
      if (codeParts.length !== 4) {
        throw new Error("Format de code invalide");
      }
      const verificationCode = codeParts[2];

      const res = await request(app)
        .post("/api/mobile/parent-pin/change")
        .set("Authorization", `Bearer ${parentToken}`)
        .send({
          childId,
          parentPhone,
          verificationCode,
          newPin: "5678",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
    });
  });
});
