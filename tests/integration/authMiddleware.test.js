const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");
const { signAccessToken } = require("../../src/services/tokenService");
const fs = require("fs");
const path = require("path");

describe("Auth Middleware - requireAuth", () => {
  let userId;
  let inactiveUserId;
  let testEmail;
  let inactiveEmail;
  let userToken;
  let inactiveUserToken;

  beforeAll(async () => {
    // Créer un utilisateur actif
    testEmail = `test-auth-middleware-${Date.now()}@test.com`;
    const hashedPassword = await bcrypt.hash("password123", 10);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        password: hashedPassword,
        firstName: "Test",
        lastName: "User",
        role: "NATIONAL",
        isActive: true,
      },
    });
    userId = user.id;
    userToken = signAccessToken({ sub: userId, role: "NATIONAL" });

    // Créer un utilisateur inactif
    inactiveEmail = `test-auth-middleware-inactive-${Date.now()}@test.com`;
    const inactiveUser = await prisma.user.create({
      data: {
        email: inactiveEmail,
        password: hashedPassword,
        firstName: "Inactive",
        lastName: "User",
        role: "NATIONAL",
        isActive: false,
      },
    });
    inactiveUserId = inactiveUser.id;
    inactiveUserToken = signAccessToken({ sub: inactiveUserId, role: "NATIONAL" });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [testEmail, inactiveEmail],
        },
      },
    });
    await prisma.$disconnect();
  });

  describe("requireAuth - Chemins d'erreur", () => {
    it("Retourne 401 si aucun token n'est fourni", async () => {
      const res = await request(app)
        .get("/api/users/me")
        .expect(401);

      expect(res.body.message).toBe("Missing token");
    });

    it("Retourne 401 si le token est vide", async () => {
      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", "Bearer ")
        .expect(401);

      expect(res.body.message).toBe("Missing token");
    });

    it("Retourne 401 si le token est invalide (format incorrect)", async () => {
      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(401);

      expect(res.body.message).toBe("Token invalide");
    });

    it("Retourne 401 si le token est expiré", async () => {
      const jwt = require("jsonwebtoken");
      const expiredToken = jwt.sign(
        { sub: userId },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "-1h" } // Expiré il y a 1 heure
      );

      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${expiredToken}`)
        .expect(401);

      expect(res.body.message).toBe("Token invalide");
    });

    it("Retourne 401 si le token est signé avec un mauvais secret", async () => {
      const jwt = require("jsonwebtoken");
      const wrongSecretToken = jwt.sign(
        { sub: userId },
        "wrong-secret",
        { expiresIn: "1h" }
      );

      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${wrongSecretToken}`)
        .expect(401);

      expect(res.body.message).toBe("Token invalide");
    });

    it("Retourne 401 si l'utilisateur n'existe pas dans la base", async () => {
      const jwt = require("jsonwebtoken");
      const nonExistentUserId = "00000000-0000-0000-0000-000000000000";
      const token = jwt.sign(
        { sub: nonExistentUserId },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );

      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);

      expect(res.body.message).toBe("Invalid token");
    });

    it("Retourne 401 si l'utilisateur est inactif", async () => {
      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${inactiveUserToken}`)
        .expect(401);

      expect(res.body.message).toBe("Invalid token");
    });

    it("Autorise l'accès si le token est valide et l'utilisateur est actif", async () => {
      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.email).toBe(testEmail);
    });
  });

  describe("requireAuth - Format du header Authorization", () => {
    it("Accepte le format 'Bearer <token>'", async () => {
      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.email).toBe(testEmail);
    });

    it("Accepte le format 'bearer <token>' (minuscule)", async () => {
      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `bearer ${userToken}`)
        .expect(200);

      expect(res.body.email).toBe(testEmail);
    });

    it("Retourne 401 si le format est incorrect (pas de 'Bearer')", async () => {
      // Le middleware vérifie maintenant le format Bearer/bearer
      // Si on envoie juste le token sans "Bearer ", il sera considéré comme manquant
      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", userToken)
        .expect(401);

      expect(res.body.message).toBe("Missing token");
    });
  });
});

describe("Auth Middleware - requireMobileAuth", () => {
  let childId;
  let childId2;
  let parentToken;
  let parentToken2;
  let invalidParentToken;

  beforeAll(async () => {
    // Créer une région, commune, district, centre de santé
    const region = await prisma.region.create({
      data: {
        name: "Test Region Mobile Auth",
      },
    });

    const commune = await prisma.commune.create({
      data: {
        name: "Test Commune Mobile Auth",
        regionId: region.id,
      },
    });

    const district = await prisma.district.create({
      data: {
        name: "Test District Mobile Auth",
        communeId: commune.id,
      },
    });

    const healthCenter = await prisma.healthCenter.create({
      data: {
        name: "Test Health Center Mobile Auth",
        address: "Test Address",
        districtId: district.id,
      },
    });

    // Créer un enfant avec numéro de téléphone parent
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 2); // 2 ans
    const child = await prisma.children.create({
      data: {
        firstName: "Test",
        lastName: "Child Mobile Auth",
        phoneParent: "+261341234567",
        healthCenterId: healthCenter.id,
        birthDate: birthDate,
        birthPlace: "Test Birth Place",
        gender: "M",
        address: "Test Address",
        status: "A_JOUR",
        isActive: true,
      },
    });
    childId = child.id;

    // Créer un autre enfant avec un numéro différent
    const birthDate2 = new Date();
    birthDate2.setFullYear(birthDate2.getFullYear() - 2); // 2 ans
    const child2 = await prisma.children.create({
      data: {
        firstName: "Test",
        lastName: "Child Mobile Auth 2",
        phoneParent: "+261349876543",
        healthCenterId: healthCenter.id,
        birthDate: birthDate2,
        birthPlace: "Test Birth Place",
        gender: "M",
        address: "Test Address",
        status: "A_JOUR",
        isActive: true,
      },
    });
    childId2 = child2.id;

    // Créer des tokens pour les parents
    parentToken = signAccessToken({
      sub: childId,
      type: "parent",
      phone: "+261341234567",
    });

    parentToken2 = signAccessToken({
      sub: childId2,
      type: "parent",
      phone: "+261349876543",
    });

    // Créer un token invalide (pas de type "parent")
    invalidParentToken = signAccessToken({
      sub: childId,
      type: "other",
      phone: "+261341234567",
    });
  });

  afterAll(async () => {
    // Filtrer les IDs undefined
    const childIds = [childId, childId2].filter(id => id !== undefined);
    if (childIds.length > 0) {
      await prisma.children.deleteMany({
        where: {
          id: { in: childIds },
        },
      });
    }
    await prisma.healthCenter.deleteMany({
      where: {
        name: { contains: "Test Health Center Mobile Auth" },
      },
    });
    await prisma.district.deleteMany({
      where: {
        name: { contains: "Test District Mobile Auth" },
      },
    });
    await prisma.commune.deleteMany({
      where: {
        name: { contains: "Test Commune Mobile Auth" },
      },
    });
    await prisma.region.deleteMany({
      where: {
        name: { contains: "Test Region Mobile Auth" },
      },
    });
    await prisma.$disconnect();
  });

  describe("requireMobileAuth - Chemins d'erreur", () => {
    it("Retourne 401 si aucun token n'est fourni", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/dashboard`)
        .expect(401);

      expect(res.body.message).toBe("Token manquant");
    });

    it("Retourne 401 si le token n'est pas de type 'parent'", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/dashboard`)
        .set("Authorization", `Bearer ${invalidParentToken}`)
        .expect(401);

      expect(res.body.message).toBe("Token invalide pour mobile");
    });

    it("Retourne 403 si le parent essaie d'accéder à un enfant qui n'est pas le sien", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId2}/dashboard`)
        .set("Authorization", `Bearer ${parentToken}`)
        .expect(403);

      expect(res.body.message).toBe("Accès refusé");
    });

    it("Retourne 401 si l'enfant n'existe pas", async () => {
      const nonExistentChildId = "00000000-0000-0000-0000-000000000000";
      const token = signAccessToken({
        sub: nonExistentChildId,
        type: "parent",
        phone: "+261341234567",
      });

      const res = await request(app)
        .get(`/api/mobile/children/${nonExistentChildId}/dashboard`)
        .set("Authorization", `Bearer ${token}`)
        .expect(401);

      expect(res.body.message).toBe("Enfant non trouvé");
    });

    it("Retourne 401 si le token est invalide", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/dashboard`)
        .set("Authorization", "Bearer invalid.token")
        .expect(401);

      expect(res.body.message).toBe("Token invalide");
    });

    it("Autorise l'accès si le token est valide et correspond à l'enfant", async () => {
      const res = await request(app)
        .get(`/api/mobile/children/${childId}/dashboard`)
        .set("Authorization", `Bearer ${parentToken}`)
        .expect(200);

      expect(res.body).toBeTruthy();
    });
  });
});

describe("Auth Middleware - optionalAuth", () => {
  let userId;
  let testEmail;
  let userToken;

  beforeAll(async () => {
    testEmail = `test-optional-auth-${Date.now()}@test.com`;
    const hashedPassword = await bcrypt.hash("password123", 10);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        password: hashedPassword,
        firstName: "Test",
        lastName: "User",
        role: "NATIONAL",
        isActive: true,
      },
    });
    userId = user.id;
    userToken = signAccessToken({ sub: userId, role: "NATIONAL" });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: testEmail,
      },
    });
    await prisma.$disconnect();
  });

  describe("optionalAuth - Chemins d'erreur", () => {
    let proofId;
    let regionId;
    let communeId;
    let districtId;
    let healthCenterId;
    let vaccineId;
    let childId;

    beforeAll(async () => {
      // Créer une preuve de vaccination pour les tests
      // Note: On a besoin d'un enfant et d'un vaccin pour créer une preuve
      const region = await prisma.region.create({
        data: { name: "Test Region Optional Auth" },
      });
      regionId = region.id;
      const commune = await prisma.commune.create({
        data: { name: "Test Commune Optional Auth", regionId: region.id },
      });
      communeId = commune.id;
      const district = await prisma.district.create({
        data: { name: "Test District Optional Auth", communeId: commune.id },
      });
      districtId = district.id;
      const healthCenter = await prisma.healthCenter.create({
        data: {
          name: "Test Health Center Optional Auth",
          address: "Test Address",
          districtId: district.id,
        },
      });
      healthCenterId = healthCenter.id;
      const vaccine = await prisma.vaccine.create({
        data: {
          name: "Test Vaccine Optional Auth",
          description: "Test",
          dosesRequired: "1",
        },
      });
      vaccineId = vaccine.id;
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 2);
      const child = await prisma.children.create({
        data: {
          firstName: "Test",
          lastName: "Child Optional Auth",
          phoneParent: "+261341234567",
          healthCenterId: healthCenter.id,
          birthDate: birthDate,
          birthPlace: "Test Birth Place",
          gender: "M",
          address: "Test Address",
          status: "A_JOUR",
          isActive: true,
        },
      });
      childId = child.id;
      
      // Créer le répertoire s'il n'existe pas
      const uploadDir = path.join(__dirname, "../../uploads/vaccination-proofs");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Créer un fichier de test minimal (image JPEG valide de 1x1 pixel)
      const testFilePath = path.join(uploadDir, "test.jpg");
      const testFileContent = Buffer.from(
        "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A",
        "base64"
      );
      fs.writeFileSync(testFilePath, testFileContent);
      
      const proof = await prisma.childVaccinationProof.create({
        data: {
          childId: child.id,
          filePath: "uploads/vaccination-proofs/test.jpg",
          fileName: "test.jpg",
          fileSize: testFileContent.length,
          mimeType: "image/jpeg",
          title: "Test Proof",
        },
      });
      proofId = proof.id;
    });

    afterAll(async () => {
      // Nettoyer les données créées dans le beforeAll
      if (proofId) {
        await prisma.childVaccinationProof.delete({ where: { id: proofId } }).catch(() => {});
      }
      
      // Supprimer le fichier de test
      const testFilePath = path.join(__dirname, "../../uploads/vaccination-proofs/test.jpg");
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
      
      if (childId) {
        await prisma.children.delete({ where: { id: childId } }).catch(() => {});
      }
      if (vaccineId) {
        await prisma.vaccine.delete({ where: { id: vaccineId } }).catch(() => {});
      }
      if (healthCenterId) {
        await prisma.healthCenter.delete({ where: { id: healthCenterId } }).catch(() => {});
      }
      if (districtId) {
        await prisma.district.delete({ where: { id: districtId } }).catch(() => {});
      }
      if (communeId) {
        await prisma.commune.delete({ where: { id: communeId } }).catch(() => {});
      }
      if (regionId) {
        await prisma.region.delete({ where: { id: regionId } }).catch(() => {});
      }
    });

    it("Retourne 401 si aucun token n'est fourni (ni header ni query)", async () => {
      // Note: optionalAuth nécessite un token, donc il retourne 401 si aucun token
      // Il n'est "optionnel" que dans le sens où il peut être dans le header OU dans query
      const res = await request(app)
        .get(`/api/vaccination-proofs/${proofId}/file`)
        .expect(401);

      expect(res.body.message).toBe("Missing token");
    });

    it("Accepte le token dans le header Authorization", async () => {
      const res = await request(app)
        .get(`/api/vaccination-proofs/${proofId}/file`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      // Si l'endpoint existe et utilise optionalAuth, il devrait fonctionner
    });

    it("Accepte le token dans les paramètres de requête", async () => {
      const res = await request(app)
        .get(`/api/vaccination-proofs/${proofId}/file?token=${userToken}`)
        .expect(200);

      // Le token dans query devrait être accepté
    });

    it("Retourne 401 si le token dans query est invalide", async () => {
      const res = await request(app)
        .get(`/api/vaccination-proofs/${proofId}/file?token=invalid.token`)
        .expect(401);

      // Le middleware devrait gérer l'erreur via next(error)
    });

    it("Retourne 401 si l'utilisateur est inactif", async () => {
      // Créer un utilisateur inactif
      const inactiveEmail = `test-optional-auth-inactive-${Date.now()}@test.com`;
      const hashedPassword = await bcrypt.hash("password123", 10);
      const inactiveUser = await prisma.user.create({
        data: {
          email: inactiveEmail,
          password: hashedPassword,
          firstName: "Inactive",
          lastName: "User",
          role: "NATIONAL",
          isActive: false,
        },
      });
      const inactiveToken = signAccessToken({
        sub: inactiveUser.id,
        role: "NATIONAL",
      });

      const res = await request(app)
        .get(`/api/vaccination-proofs/${proofId}/file?token=${inactiveToken}`)
        .expect(401);

      expect(res.body.message).toBe("Invalid token");

      // Nettoyer
      await prisma.user.delete({ where: { id: inactiveUser.id } });
    });
  });
});
