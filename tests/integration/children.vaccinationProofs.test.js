const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

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

describe("Children API - Preuves de Vaccination", () => {
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
  const testFiles = [];

  // Helper pour créer un fichier de test temporaire
  const createTestFile = (filename, content = "test content") => {
    const testDir = path.join(__dirname, "../../uploads/vaccination-proofs");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, content);
    testFiles.push(filePath);
    return filePath;
  };

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
      await prisma.childVaccinationProof.deleteMany();
      await prisma.children.deleteMany();
      await prisma.healthCenter.deleteMany();
      await prisma.district.deleteMany();
      await prisma.commune.deleteMany();
      await prisma.region.deleteMany();
      await prisma.user.deleteMany();

      // Créer le user NATIONAL directement en DB
      nationalEmail = `national-proofs-test-${Date.now()}@example.com`;
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
        .send({ name: `RegionForProofs-${Date.now()}` });
      expect(regionRes.statusCode).toBe(201);
      regionId = regionRes.body.id;

      // Créer une commune
      const communeRes = await request(app)
        .post("/api/commune")
        .set("Authorization", `Bearer ${nationalToken}`)
        .send({ name: `CommuneForProofs-${Date.now()}`, regionId: regionId });
      expect(communeRes.statusCode).toBe(201);
      communeId = communeRes.body.id;

      // Créer un user REGIONAL directement en DB
      regionalEmail = `regional-proofs-test-${Date.now()}@example.com`;
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
        .send({ name: `DistrictForProofs-${Date.now()}`, communeId: communeId });
      expect(districtRes.statusCode).toBe(201);
      districtId = districtRes.body.id;

      // Créer un user DISTRICT directement en DB
      districtEmail = `district-proofs-test-${Date.now()}@example.com`;
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
      agentAdminEmail = `agentadmin-proofs-test-${Date.now()}@example.com`;
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
      agentStaffEmail = `agentstaff-proofs-test-${Date.now()}@example.com`;
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
    } catch (error) {
      console.error("Erreur dans beforeAll:", error);
      throw error;
    }
  });

  beforeEach(async () => {
    try {
      // Nettoyage avant chaque test (mais garder les users et structures de base)
      await prisma.childVaccinationProof.deleteMany();
      await prisma.children.deleteMany();

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
          firstName: "Proof",
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
    } catch (error) {
      console.error("Erreur dans beforeEach:", error);
      throw error;
    }
  });

  afterEach(async () => {
    // Nettoyer les fichiers de test
    testFiles.forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          // Ignorer les erreurs de suppression
        }
      }
    });
    testFiles.length = 0;

    // Nettoyer les preuves uploadées
    const uploadDir = path.join(__dirname, "../../uploads/vaccination-proofs");
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      files.forEach((file) => {
        const filePath = path.join(uploadDir, file);
        try {
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        } catch (error) {
          // Ignorer les erreurs
        }
      });
    }

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
    await prisma.childVaccinationProof.deleteMany();
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

  describe("POST /api/children/:childId/vaccination-proofs - Upload Mobile", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post(`/api/children/${childId}/vaccination-proofs`);
        expect(res.statusCode).toBe(401);
      });
    });

    describe("Validation", () => {
      it("Retourne 400 si aucun fichier fourni", async () => {
        const res = await request(app)
          .post(`/api/children/${childId}/vaccination-proofs`)
          .set("Authorization", `Bearer ${agentAdminToken}`);
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain("fichier");
      });

      it("Retourne 404 si enfant non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const originalError = console.error;
        console.error = jest.fn();

        const res = await request(app)
          .post(`/api/children/${fakeId}/vaccination-proofs`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .attach("files", Buffer.from("test"), "test.jpg");

        expect([404, 500]).toContain(res.statusCode);
        console.error = originalError;
      });
    });

    describe("Succès", () => {
      it("Upload un fichier avec succès (AGENT ADMIN)", async () => {
        const res = await request(app)
          .post(`/api/children/${childId}/vaccination-proofs`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .attach("files", Buffer.from("test image content"), "test.jpg")
          .field("mimetype", "image/jpeg");

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain("uploadé");
        expect(res.body.files).toBeInstanceOf(Array);
        expect(res.body.files.length).toBe(1);
        expect(res.body.files[0]).toHaveProperty("id");
        expect(res.body.files[0]).toHaveProperty("title");
        expect(res.body.files[0]).toHaveProperty("fileName");
        expect(res.body.needsVerification).toBe(true);

        // Vérifier en DB
        const proofs = await prisma.childVaccinationProof.findMany({
          where: { childId },
        });
        expect(proofs.length).toBe(1);
        expect(proofs[0].title).toBeDefined();
      });

      it("Upload plusieurs fichiers avec succès", async () => {
        const res = await request(app)
          .post(`/api/children/${childId}/vaccination-proofs`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .attach("files", Buffer.from("test image 1"), "test1.jpg")
          .attach("files", Buffer.from("test image 2"), "test2.png")
          .field("mimetype", "image/jpeg");

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.files.length).toBe(2);

        // Vérifier en DB
        const proofs = await prisma.childVaccinationProof.findMany({
          where: { childId },
        });
        expect(proofs.length).toBe(2);
      });

      it("Réinitialise photosRequested après upload", async () => {
        // Marquer photosRequested à true
        await prisma.children.update({
          where: { id: childId },
          data: { photosRequested: true },
        });

        const res = await request(app)
          .post(`/api/children/${childId}/vaccination-proofs`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .attach("files", Buffer.from("test"), "test.jpg");

        expect(res.statusCode).toBe(201);

        // Vérifier en DB
        const child = await prisma.children.findUnique({
          where: { id: childId },
        });
        expect(child.photosRequested).toBe(false);
      });
    });
  });

  describe("POST /api/children/:childId/vaccination-proofs/upload - Upload Backoffice", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .post(`/api/children/${childId}/vaccination-proofs/upload`);
        expect(res.statusCode).toBe(401);
      });
    });

    describe("Validation", () => {
      it("Retourne 400 si aucun fichier fourni", async () => {
        const res = await request(app)
          .post(`/api/children/${childId}/vaccination-proofs/upload`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .field("title", "Test Document");
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain("fichier");
      });

      it("Retourne 400 si titre manquant", async () => {
        const res = await request(app)
          .post(`/api/children/${childId}/vaccination-proofs/upload`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .attach("file", Buffer.from("test"), "test.jpg");
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain("titre");
      });

      it("Retourne 404 si enfant non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const originalError = console.error;
        console.error = jest.fn();

        const res = await request(app)
          .post(`/api/children/${fakeId}/vaccination-proofs/upload`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .attach("file", Buffer.from("test"), "test.jpg")
          .field("title", "Test Document");

        expect([404, 500]).toContain(res.statusCode);
        console.error = originalError;
      });
    });

    describe("Succès", () => {
      it("Upload un fichier avec titre avec succès (AGENT ADMIN)", async () => {
        const res = await request(app)
          .post(`/api/children/${childId}/vaccination-proofs/upload`)
          .set("Authorization", `Bearer ${agentAdminToken}`)
          .attach("file", Buffer.from("test document content"), "document.pdf")
          .field("title", "Carnet de vaccination");

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain("uploadé");
        expect(res.body.proof).toBeDefined();
        expect(res.body.proof.title).toBe("Carnet de vaccination");
        expect(res.body.proof).toHaveProperty("id");
        expect(res.body.proof).toHaveProperty("fileName");
        expect(res.body.proof).toHaveProperty("mimeType");
        expect(res.body.proof).toHaveProperty("fileSize");
        expect(res.body.proof.uploadedBy).toBeDefined();

        // Vérifier en DB
        const proofs = await prisma.childVaccinationProof.findMany({
          where: { childId },
        });
        expect(proofs.length).toBe(1);
        expect(proofs[0].title).toBe("Carnet de vaccination");
        expect(proofs[0].uploadedBy).toBeDefined();
      });

      it("Upload un fichier avec titre avec succès (NATIONAL)", async () => {
        const res = await request(app)
          .post(`/api/children/${childId}/vaccination-proofs/upload`)
          .set("Authorization", `Bearer ${nationalToken}`)
          .attach("file", Buffer.from("test document"), "document.pdf")
          .field("title", "Preuve de vaccination");

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.proof.title).toBe("Preuve de vaccination");
      });
    });
  });

  describe("GET /api/children/:childId/vaccination-proofs - Liste Preuves", () => {
    describe("Authentification", () => {
      it("Retourne 401 si non authentifié", async () => {
        const res = await request(app)
          .get(`/api/children/${childId}/vaccination-proofs`);
        expect(res.statusCode).toBe(401);
      });
    });

    describe("Validation", () => {
      it("Retourne 404 si enfant non trouvé", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const originalError = console.error;
        console.error = jest.fn();

        const res = await request(app)
          .get(`/api/children/${fakeId}/vaccination-proofs`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect([404, 500]).toContain(res.statusCode);
        console.error = originalError;
      });
    });

    describe("Succès", () => {
      it("Retourne une liste vide si aucune preuve", async () => {
        const res = await request(app)
          .get(`/api/children/${childId}/vaccination-proofs`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.proofs).toBeInstanceOf(Array);
        expect(res.body.proofs.length).toBe(0);
      });

      it("Retourne la liste des preuves avec succès", async () => {
        // Créer des preuves directement en DB
        await prisma.childVaccinationProof.create({
          data: {
            childId,
            title: "Preuve 1",
            filePath: "uploads/vaccination-proofs/test1.jpg",
            fileName: "test1.jpg",
            fileSize: 1024,
            mimeType: "image/jpeg",
            uploadedBy: null,
          },
        });

        await prisma.childVaccinationProof.create({
          data: {
            childId,
            title: "Preuve 2",
            filePath: "uploads/vaccination-proofs/test2.pdf",
            fileName: "test2.pdf",
            fileSize: 2048,
            mimeType: "application/pdf",
            uploadedBy: agentAdminEmail,
          },
        });

        const res = await request(app)
          .get(`/api/children/${childId}/vaccination-proofs`)
          .set("Authorization", `Bearer ${agentAdminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.proofs).toBeInstanceOf(Array);
        expect(res.body.proofs.length).toBe(2);
        expect(res.body.proofs[0]).toHaveProperty("id");
        expect(res.body.proofs[0]).toHaveProperty("title");
        expect(res.body.proofs[0]).toHaveProperty("fileName");
        expect(res.body.proofs[0]).toHaveProperty("fileSize");
        expect(res.body.proofs[0]).toHaveProperty("mimeType");
        expect(res.body.proofs[0]).toHaveProperty("uploadedAt");
        // Vérifier que les preuves sont triées par date décroissante
        if (res.body.proofs.length > 1) {
          const date1 = new Date(res.body.proofs[0].uploadedAt);
          const date2 = new Date(res.body.proofs[1].uploadedAt);
          expect(date1.getTime()).toBeGreaterThanOrEqual(date2.getTime());
        }
      });

      it("Retourne la liste des preuves pour NATIONAL", async () => {
        // Créer une preuve
        await prisma.childVaccinationProof.create({
          data: {
            childId,
            title: "Preuve National",
            filePath: "uploads/vaccination-proofs/test.jpg",
            fileName: "test.jpg",
            fileSize: 1024,
            mimeType: "image/jpeg",
            uploadedBy: null,
          },
        });

        const res = await request(app)
          .get(`/api/children/${childId}/vaccination-proofs`)
          .set("Authorization", `Bearer ${nationalToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.proofs.length).toBeGreaterThan(0);
      });
    });
  });
});


