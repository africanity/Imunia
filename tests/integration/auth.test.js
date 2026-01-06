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

  describe("POST /api/auth/refresh - Rafraîchissement du token", () => {
    it("Retourne 400 si refreshToken manquant", async () => {
      const res = await request(app).post("/api/auth/refresh").send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("Refresh token requis");
    });

    it("Retourne 401 si refreshToken invalide", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-token" });
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toContain("invalide ou expiré");
    });

    it("Retourne de nouveaux tokens avec un refreshToken valide", async () => {
      const uniqueEmail = `refresh+${Date.now()}@example.com`;
      testEmails.add(uniqueEmail);
      
      const password = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: uniqueEmail,
          password,
          firstName: "A",
          lastName: "B",
          role: "NATIONAL",
          isActive: true
        }
      });
      
      // Se connecter pour obtenir un refreshToken
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: uniqueEmail, password: "motdepasse" });
      
      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body.refreshToken).toBeDefined();
      const refreshToken = loginRes.body.refreshToken;
      
      // Utiliser le refreshToken pour obtenir de nouveaux tokens
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      
      // Vérifier que les nouveaux tokens sont valides en les utilisant
      const verifyRes = await request(app)
        .get("/api/auth/logout")
        .set("Authorization", `Bearer ${res.body.accessToken}`);
      expect(verifyRes.statusCode).toBe(204);
      
      // Les tokens peuvent être identiques s'ils sont générés dans la même seconde
      // L'important est qu'ils soient valides et fonctionnels
    });

    it("Retourne 401 si utilisateur inactif", async () => {
      const uniqueEmail = `refresh-inactive+${Date.now()}@example.com`;
      testEmails.add(uniqueEmail);
      
      const password = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: uniqueEmail,
          password,
          firstName: "A",
          lastName: "B",
          role: "NATIONAL",
          isActive: true
        }
      });
      
      // Se connecter pour obtenir un refreshToken
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: uniqueEmail, password: "motdepasse" });
      
      const refreshToken = loginRes.body.refreshToken;
      
      // Désactiver l'utilisateur
      await prisma.user.update({
        where: { email: uniqueEmail },
        data: { isActive: false }
      });
      
      // Essayer de rafraîchir le token
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });
      
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toContain("non trouvé ou inactif");
    });
  });

  describe("POST /api/auth/password-reset/request - Demande de réinitialisation", () => {
    it("Retourne 400 si email manquant", async () => {
      const res = await request(app)
        .post("/api/auth/password-reset/request")
        .send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("Email requis");
    });

    it("Retourne toujours 200 même si email n'existe pas (sécurité)", async () => {
      const res = await request(app)
        .post("/api/auth/password-reset/request")
        .send({ email: "nonexistent@example.com" });
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBeDefined();
    });

    it("Génère un code pour un utilisateur actif", async () => {
      const uniqueEmail = `reset+${Date.now()}@example.com`;
      testEmails.add(uniqueEmail);
      
      const password = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: uniqueEmail,
          password,
          firstName: "A",
          lastName: "B",
          role: "NATIONAL",
          isActive: true
        }
      });
      
      const res = await request(app)
        .post("/api/auth/password-reset/request")
        .send({ email: uniqueEmail });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBeDefined();
      
      // Vérifier que le code a été généré
      const user = await prisma.user.findUnique({
        where: { email: uniqueEmail },
        select: { code: true, passwordResetCodeExpiry: true }
      });
      expect(user.code).toBeDefined();
      expect(user.passwordResetCodeExpiry).toBeDefined();
    });
  });

  describe("POST /api/auth/password-reset/verify - Vérification du code", () => {
    let testEmail;
    let testCode;

    beforeEach(async () => {
      testEmail = `verify+${Date.now()}@example.com`;
      testEmails.add(testEmail);
      
      const password = await bcrypt.hash("motdepasse", 10);
      testCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiryDate = new Date();
      expiryDate.setMinutes(expiryDate.getMinutes() + 10);
      
      await prisma.user.create({
        data: {
          email: testEmail,
          password,
          firstName: "A",
          lastName: "B",
          role: "NATIONAL",
          isActive: true,
          code: testCode,
          passwordResetCodeExpiry: expiryDate,
          passwordResetAttempts: 0
        }
      });
    });

    it("Retourne 400 si email ou code manquant", async () => {
      const res1 = await request(app)
        .post("/api/auth/password-reset/verify")
        .send({ code: testCode });
      expect(res1.statusCode).toBe(400);
      
      const res2 = await request(app)
        .post("/api/auth/password-reset/verify")
        .send({ email: testEmail });
      expect(res2.statusCode).toBe(400);
    });

    it("Retourne 404 si email introuvable", async () => {
      const res = await request(app)
        .post("/api/auth/password-reset/verify")
        .send({ email: "nonexistent@example.com", code: testCode });
      expect(res.statusCode).toBe(404);
    });

    it("Retourne 400 si code incorrect", async () => {
      const res = await request(app)
        .post("/api/auth/password-reset/verify")
        .send({ email: testEmail, code: "000000" });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("incorrect");
      expect(res.body.remainingAttempts).toBeDefined();
    });

    it("Retourne 400 si code expiré", async () => {
      // Mettre à jour l'utilisateur avec un code expiré
      await prisma.user.update({
        where: { email: testEmail },
        data: {
          passwordResetCodeExpiry: new Date(Date.now() - 1000) // Expiré
        }
      });
      
      const res = await request(app)
        .post("/api/auth/password-reset/verify")
        .send({ email: testEmail, code: testCode });
      expect(res.statusCode).toBe(400);
      expect(res.body.expired).toBe(true);
    });

    it("Retourne un resetToken si code correct", async () => {
      const res = await request(app)
        .post("/api/auth/password-reset/verify")
        .send({ email: testEmail, code: testCode });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain("vérifié");
      expect(res.body.resetToken).toBeDefined();
    });
  });

  describe("POST /api/auth/password-reset/resend - Renvoi du code", () => {
    it("Retourne 400 si email manquant", async () => {
      const res = await request(app)
        .post("/api/auth/password-reset/resend")
        .send({});
      expect(res.statusCode).toBe(400);
    });

    it("Retourne toujours 200 même si email n'existe pas", async () => {
      const res = await request(app)
        .post("/api/auth/password-reset/resend")
        .send({ email: "nonexistent@example.com" });
      expect(res.statusCode).toBe(200);
    });

    it("Génère un nouveau code pour un utilisateur actif", async () => {
      const uniqueEmail = `resend+${Date.now()}@example.com`;
      testEmails.add(uniqueEmail);
      
      const password = await bcrypt.hash("motdepasse", 10);
      await prisma.user.create({
        data: {
          email: uniqueEmail,
          password,
          firstName: "A",
          lastName: "B",
          role: "NATIONAL",
          isActive: true,
          code: "123456",
          passwordResetAttempts: 2
        }
      });
      
      const res = await request(app)
        .post("/api/auth/password-reset/resend")
        .send({ email: uniqueEmail });
      
      expect(res.statusCode).toBe(200);
      
      // Vérifier que le code et les tentatives ont été réinitialisés
      const user = await prisma.user.findUnique({
        where: { email: uniqueEmail },
        select: { code: true, passwordResetAttempts: true }
      });
      expect(user.code).not.toBe("123456");
      expect(user.passwordResetAttempts).toBe(0);
    });
  });

  describe("POST /api/auth/password-reset/update - Mise à jour du mot de passe", () => {
    let testEmail;
    let resetToken;

    beforeEach(async () => {
      testEmail = `update+${Date.now()}@example.com`;
      testEmails.add(testEmail);
      
      const password = await bcrypt.hash("oldpassword", 10);
      const testCode = "123456";
      const expiryDate = new Date();
      expiryDate.setMinutes(expiryDate.getMinutes() + 10);
      
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          password,
          firstName: "A",
          lastName: "B",
          role: "NATIONAL",
          isActive: true,
          code: testCode,
          passwordResetCodeExpiry: expiryDate
        }
      });
      
      // Générer un resetToken (simuler le processus de vérification)
      const tokenService = require("../../src/services/tokenService");
      resetToken = tokenService.generatePasswordResetToken(user.id);
    });

    it("Retourne 400 si resetToken, password ou confirmPassword manquant", async () => {
      const res1 = await request(app)
        .post("/api/auth/password-reset/update")
        .send({ password: "newpass", confirmPassword: "newpass" });
      expect(res1.statusCode).toBe(400);
      
      const res2 = await request(app)
        .post("/api/auth/password-reset/update")
        .send({ resetToken, confirmPassword: "newpass" });
      expect(res2.statusCode).toBe(400);
      
      const res3 = await request(app)
        .post("/api/auth/password-reset/update")
        .send({ resetToken, password: "newpass" });
      expect(res3.statusCode).toBe(400);
    });

    it("Retourne 400 si password trop court", async () => {
      const res = await request(app)
        .post("/api/auth/password-reset/update")
        .send({
          resetToken,
          password: "12345",
          confirmPassword: "12345"
        });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("6 caractères");
    });

    it("Retourne 400 si password !== confirmPassword", async () => {
      const res = await request(app)
        .post("/api/auth/password-reset/update")
        .send({
          resetToken,
          password: "newpassword",
          confirmPassword: "different"
        });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("ne correspondent pas");
    });

    it("Retourne 400 si resetToken invalide", async () => {
      const res = await request(app)
        .post("/api/auth/password-reset/update")
        .send({
          resetToken: "invalid-token",
          password: "newpassword",
          confirmPassword: "newpassword"
        });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("invalide ou expiré");
    });

    it("Met à jour le mot de passe avec succès", async () => {
      const res = await request(app)
        .post("/api/auth/password-reset/update")
        .send({
          resetToken,
          password: "newpassword",
          confirmPassword: "newpassword"
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain("mis à jour");
      
      // Vérifier que le mot de passe a été changé
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
        select: { password: true, code: true, passwordResetCodeExpiry: true }
      });
      
      // Vérifier que l'ancien mot de passe ne fonctionne plus
      const loginResOld = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password: "oldpassword" });
      expect(loginResOld.statusCode).toBe(401);
      
      // Vérifier que le nouveau mot de passe fonctionne
      const loginResNew = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password: "newpassword" });
      expect(loginResNew.statusCode).toBe(200);
      
      // Vérifier que les champs de réinitialisation ont été nettoyés
      expect(user.code).toBeNull();
      expect(user.passwordResetCodeExpiry).toBeNull();
    });
  });
});
