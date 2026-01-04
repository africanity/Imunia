const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");
const bcrypt = require("bcryptjs");

describe("Auth", () => {
  // Liste des emails de test créés pour le cleanup
  const testEmails = new Set();

  beforeAll(async () => {
    // Nettoyage de la base avant les tests
    await prisma.user.deleteMany();
  });

  afterEach(async () => {
    // Cleanup après chaque test pour garantir le nettoyage même en cas d'échec
    if (testEmails.size > 0) {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: Array.from(testEmails)
          }
        }
      });
      testEmails.clear();
    }
  });

  afterAll(async () => {
    // Nettoyage final au cas où
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe("Validation des entrées", () => {
    it("Retourne 400 si email manquant", async () => {
      const res = await request(app).post("/api/auth/login").send({ password: "motdepasse" });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Email et mot de passe requis/);
    });

    it("Retourne 400 si password manquant", async () => {
      const res = await request(app).post("/api/auth/login").send({ email: "national@example.com" });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Email et mot de passe requis/);
    });
  });

  describe("Authentification", () => {
    it("Retourne 401 si utilisateur non trouvé", async () => {
      const res = await request(app).post("/api/auth/login").send({ email: "inexistant@example.com", password: "motdepasse" });
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/Identifiants invalides/);
    });

    it("Retourne 401 si mot de passe incorrect", async () => {
      const testEmail = "wrongpass@example.com";
      testEmails.add(testEmail);
      
      const password = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: testEmail,
          password,
          firstName: "A",
          lastName: "B",
          phone: "1",
          role: "NATIONAL",
          isActive: true
        }
      });
      
      const res = await request(app).post("/api/auth/login").send({ email: testEmail, password: "incorrect" });
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/Identifiants invalides/);
    });

    it("Retourne 401 si utilisateur inactif", async () => {
      const testEmail = "inactive@example.com";
      testEmails.add(testEmail);
      
      const password = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: testEmail,
          password,
          firstName: "A",
          lastName: "B",
          phone: "1",
          role: "NATIONAL",
          isActive: false
        }
      });
      
      const res = await request(app).post("/api/auth/login").send({ email: testEmail, password: "motdepasse" });
      expect(res.statusCode).toBe(401);
    });

    it("Retourne tokens si identifiants valides pour NATIONAL", async () => {
      // Utilisation d'un email unique pour chaque test
      const uniqueEmail = `national+${Date.now()}@example.com`;
      testEmails.add(uniqueEmail);
      
      const password = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: uniqueEmail,
          password,
          firstName: "A",
          lastName: "B",
          phone: "1",
          role: "NATIONAL",
          isActive: true
        }
      });
      
      const res = await request(app).post("/api/auth/login").send({ email: uniqueEmail, password: "motdepasse" });
      expect(res.statusCode).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });
  });

  describe("GET /api/auth/logout", () => {
    it("Retourne 401 si non authentifié", async () => {
      const res = await request(app).get("/api/auth/logout");
      expect(res.statusCode).toBe(401);
    });

    it("Retourne 204 si authentifié avec token valide", async () => {
      // Créer un user et se connecter pour obtenir un token
      const uniqueEmail = `logout+${Date.now()}@example.com`;
      testEmails.add(uniqueEmail);
      
      const password = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: uniqueEmail,
          password,
          firstName: "A",
          lastName: "B",
          phone: "1",
          role: "NATIONAL",
          isActive: true
        }
      });
      
      // Se connecter pour obtenir un token
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: uniqueEmail, password: "motdepasse" });
      
      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body.accessToken).toBeDefined();
      const accessToken = loginRes.body.accessToken;
      
      // Tester le logout avec le token
      const res = await request(app)
        .get("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`);
      
      expect(res.statusCode).toBe(204);
    });

    it("Retourne 401 si token invalide", async () => {
      const res = await request(app)
        .get("/api/auth/logout")
        .set("Authorization", "Bearer invalid-token");
      
      expect(res.statusCode).toBe(401);
    });
  });
});