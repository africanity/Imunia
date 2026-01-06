const {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateActivationToken,
  generateEmailCode,
  decodeAccessToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
} = require("../../src/services/tokenService");

describe("tokenService", () => {
  const originalAccessSecret = process.env.ACCESS_TOKEN_SECRET;
  const originalRefreshSecret = process.env.REFRESH_TOKEN_SECRET;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    // S'assurer que les secrets sont définis pour les tests
    process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "test-access-secret";
    process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "test-refresh-secret";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
  });

  afterAll(() => {
    // Restaurer les secrets originaux
    if (originalAccessSecret) process.env.ACCESS_TOKEN_SECRET = originalAccessSecret;
    if (originalRefreshSecret) process.env.REFRESH_TOKEN_SECRET = originalRefreshSecret;
    if (originalJwtSecret) process.env.JWT_SECRET = originalJwtSecret;
  });

  describe("signAccessToken()", () => {
    it("Génère un token d'accès valide", () => {
      const payload = { sub: "user123", role: "AGENT" };
      const token = signAccessToken(payload);

      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // Format JWT: header.payload.signature
    });

    it("Génère des tokens différents pour des payloads différents", () => {
      const payload1 = { sub: "user1", role: "AGENT" };
      const payload2 = { sub: "user2", role: "REGIONAL" };

      const token1 = signAccessToken(payload1);
      const token2 = signAccessToken(payload2);

      expect(token1).not.toBe(token2);
    });

    it("Génère des tokens différents à chaque appel même avec le même payload", () => {
      const payload = { sub: "user123", role: "AGENT" };
      const token1 = signAccessToken(payload);
      const token2 = signAccessToken(payload);

      // Les tokens doivent être différents car ils contiennent un timestamp
      expect(token1).not.toBe(token2);
    });
  });

  describe("verifyAccessToken()", () => {
    it("Vérifie correctement un token valide", () => {
      const payload = { sub: "user123", role: "AGENT" };
      const token = signAccessToken(payload);

      const decoded = verifyAccessToken(token);

      expect(decoded.sub).toBe("user123");
      expect(decoded.role).toBe("AGENT");
      expect(decoded.exp).toBeTruthy(); // Expiration timestamp
      expect(decoded.iat).toBeTruthy(); // Issued at timestamp
    });

    it("Lance une erreur pour un token invalide", () => {
      const invalidToken = "invalid.token.here";

      expect(() => {
        verifyAccessToken(invalidToken);
      }).toThrow();
    });

    it("Lance une erreur pour un token expiré", (done) => {
      const jwt = require("jsonwebtoken");
      const expiredToken = jwt.sign(
        { sub: "user123" },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "-1h" } // Expiré il y a 1 heure
      );

      expect(() => {
        verifyAccessToken(expiredToken);
      }).toThrow();

      done();
    });

    it("Lance une erreur pour un token signé avec un mauvais secret", () => {
      const jwt = require("jsonwebtoken");
      const wrongSecretToken = jwt.sign(
        { sub: "user123" },
        "wrong-secret",
        { expiresIn: "1h" }
      );

      expect(() => {
        verifyAccessToken(wrongSecretToken);
      }).toThrow();
    });
  });

  describe("signRefreshToken()", () => {
    it("Génère un refresh token valide", () => {
      const payload = { sub: "user123", role: "AGENT" };
      const token = signRefreshToken(payload);

      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    it("Génère des tokens différents des access tokens", () => {
      const payload = { sub: "user123", role: "AGENT" };
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      expect(accessToken).not.toBe(refreshToken);
    });
  });

  describe("verifyRefreshToken()", () => {
    it("Vérifie correctement un refresh token valide", () => {
      const payload = { sub: "user123", role: "AGENT" };
      const token = signRefreshToken(payload);

      const decoded = verifyRefreshToken(token);

      expect(decoded.sub).toBe("user123");
      expect(decoded.role).toBe("AGENT");
    });

    it("Lance une erreur pour un refresh token invalide", () => {
      const invalidToken = "invalid.refresh.token";

      expect(() => {
        verifyRefreshToken(invalidToken);
      }).toThrow();
    });

    it("Ne peut pas vérifier un access token comme refresh token", () => {
      const payload = { sub: "user123" };
      const accessToken = signAccessToken(payload);

      expect(() => {
        verifyRefreshToken(accessToken);
      }).toThrow();
    });
  });

  describe("generateActivationToken()", () => {
    it("Génère un token d'activation avec UUID", () => {
      const result = generateActivationToken();

      expect(result).toHaveProperty("token");
      expect(result).toHaveProperty("expiresAt");
      expect(typeof result.token).toBe("string");
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("Génère des tokens différents à chaque appel", () => {
      const token1 = generateActivationToken();
      const token2 = generateActivationToken();

      expect(token1.token).not.toBe(token2.token);
    });

    it("Génère une date d'expiration dans le futur", () => {
      const result = generateActivationToken();
      const now = new Date();

      expect(result.expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });

    it("Génère une date d'expiration à 24h", () => {
      const result = generateActivationToken();
      const now = Date.now();
      const expiresIn = result.expiresAt.getTime() - now;
      const expectedExpiresIn = 60 * 60 * 24 * 1000; // 24h en millisecondes

      // Tolérance de 1 seconde pour les différences de timing
      expect(Math.abs(expiresIn - expectedExpiresIn)).toBeLessThan(1000);
    });
  });

  describe("generateEmailCode()", () => {
    it("Génère un code à 6 chiffres", () => {
      const result = generateEmailCode();

      expect(result).toHaveProperty("code");
      expect(result).toHaveProperty("expiresAt");
      expect(typeof result.code).toBe("string");
      expect(result.code.length).toBe(6);
      expect(/^\d{6}$/.test(result.code)).toBe(true);
    });

    it("Génère des codes différents à chaque appel", () => {
      const code1 = generateEmailCode();
      const code2 = generateEmailCode();

      expect(code1.code).not.toBe(code2.code);
    });

    it("Génère une date d'expiration dans le futur", () => {
      const result = generateEmailCode();
      const now = new Date();

      expect(result.expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });

    it("Génère une date d'expiration à 10 minutes", () => {
      const result = generateEmailCode();
      const now = Date.now();
      const expiresIn = result.expiresAt.getTime() - now;
      const expectedExpiresIn = 60 * 10 * 1000; // 10 minutes en millisecondes

      // Tolérance de 1 seconde
      expect(Math.abs(expiresIn - expectedExpiresIn)).toBeLessThan(1000);
    });

    it("Génère un code entre 100000 et 999999", () => {
      const result = generateEmailCode();
      const codeNumber = parseInt(result.code, 10);

      expect(codeNumber).toBeGreaterThanOrEqual(100000);
      expect(codeNumber).toBeLessThanOrEqual(999999);
    });
  });

  describe("decodeAccessToken()", () => {
    it("Décode correctement un token valide", () => {
      const payload = { sub: "user123", role: "AGENT" };
      const token = signAccessToken(payload);

      const decoded = decodeAccessToken(token);

      expect(decoded.sub).toBe("user123");
      expect(decoded.role).toBe("AGENT");
    });

    it("Lance une erreur pour un token invalide", () => {
      const invalidToken = "invalid.token.here";

      expect(() => {
        decodeAccessToken(invalidToken);
      }).toThrow("Token invalide");
    });

    it("Lance une erreur pour un token expiré", () => {
      const jwt = require("jsonwebtoken");
      const expiredToken = jwt.sign(
        { sub: "user123" },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "-1h" }
      );

      expect(() => {
        decodeAccessToken(expiredToken);
      }).toThrow("Token invalide");
    });

    it("Lance une erreur pour un token signé avec un mauvais secret", () => {
      const jwt = require("jsonwebtoken");
      const wrongSecretToken = jwt.sign(
        { sub: "user123" },
        "wrong-secret",
        { expiresIn: "1h" }
      );

      expect(() => {
        decodeAccessToken(wrongSecretToken);
      }).toThrow("Token invalide");
    });
  });

  describe("generatePasswordResetToken()", () => {
    it("Génère un token de réinitialisation de mot de passe", () => {
      const userId = "user123";
      const token = generatePasswordResetToken(userId);

      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    it("Génère des tokens différents pour des utilisateurs différents", () => {
      const token1 = generatePasswordResetToken("user1");
      const token2 = generatePasswordResetToken("user2");

      expect(token1).not.toBe(token2);
    });

    it("Génère des tokens différents à chaque appel", () => {
      const userId = "user123";
      const token1 = generatePasswordResetToken(userId);
      const token2 = generatePasswordResetToken(userId);

      expect(token1).not.toBe(token2);
    });
  });

  describe("verifyPasswordResetToken()", () => {
    it("Vérifie correctement un token de réinitialisation valide", () => {
      const userId = "user123";
      const token = generatePasswordResetToken(userId);

      const decoded = verifyPasswordResetToken(token);

      expect(decoded.userId).toBe("user123");
      expect(decoded.type).toBe("password-reset");
    });

    it("Lance une erreur pour un token invalide", () => {
      const invalidToken = "invalid.token.here";

      expect(() => {
        verifyPasswordResetToken(invalidToken);
      }).toThrow("Token invalide ou expiré");
    });

    it("Lance une erreur pour un token sans type password-reset", () => {
      const jwt = require("jsonwebtoken");
      const wrongTypeToken = jwt.sign(
        { userId: "user123", type: "other-type" },
        process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET,
        { expiresIn: "15m" }
      );

      expect(() => {
        verifyPasswordResetToken(wrongTypeToken);
      }).toThrow("Token invalide");
    });

    it("Lance une erreur pour un token expiré", () => {
      const jwt = require("jsonwebtoken");
      const expiredToken = jwt.sign(
        { userId: "user123", type: "password-reset" },
        process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET,
        { expiresIn: "-1h" }
      );

      expect(() => {
        verifyPasswordResetToken(expiredToken);
      }).toThrow("Token invalide ou expiré");
    });

    it("Lance une erreur pour un token signé avec un mauvais secret", () => {
      const jwt = require("jsonwebtoken");
      const wrongSecretToken = jwt.sign(
        { userId: "user123", type: "password-reset" },
        "wrong-secret",
        { expiresIn: "15m" }
      );

      expect(() => {
        verifyPasswordResetToken(wrongSecretToken);
      }).toThrow("Token invalide ou expiré");
    });
  });

  describe("Intégration - Flux complet", () => {
    it("Permet de signer et vérifier un access token", () => {
      const payload = { sub: "user123", role: "AGENT" };
      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.role).toBe(payload.role);
    });

    it("Permet de signer et vérifier un refresh token", () => {
      const payload = { sub: "user123", role: "AGENT" };
      const token = signRefreshToken(payload);
      const decoded = verifyRefreshToken(token);

      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.role).toBe(payload.role);
    });

    it("Permet de générer et vérifier un token de réinitialisation", () => {
      const userId = "user123";
      const token = generatePasswordResetToken(userId);
      const decoded = verifyPasswordResetToken(token);

      expect(decoded.userId).toBe(userId);
      expect(decoded.type).toBe("password-reset");
    });
  });
});
