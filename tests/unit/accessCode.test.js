// tests/unit/accessCode.test.js
const { generateAccessCode } = require("../../src/utils/accessCode");

describe("accessCode", () => {
  describe("generateAccessCode", () => {
    it("devrait générer un code de 6 chiffres par défaut", () => {
      const code = generateAccessCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(Number(code)).toBeGreaterThanOrEqual(100000);
      expect(Number(code)).toBeLessThanOrEqual(999999);
    });

    it("devrait générer un code de la longueur spécifiée", () => {
      const code4 = generateAccessCode(4);
      expect(code4).toMatch(/^\d{4}$/);
      expect(Number(code4)).toBeGreaterThanOrEqual(1000);
      expect(Number(code4)).toBeLessThanOrEqual(9999);

      const code8 = generateAccessCode(8);
      expect(code8).toMatch(/^\d{8}$/);
      expect(Number(code8)).toBeGreaterThanOrEqual(10000000);
      expect(Number(code8)).toBeLessThanOrEqual(99999999);
    });

    it("devrait générer des codes différents à chaque appel", () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateAccessCode());
      }
      // Il est très peu probable d'avoir 100 codes identiques
      expect(codes.size).toBeGreaterThan(1);
    });

    it("devrait retourner une string", () => {
      const code = generateAccessCode();
      expect(typeof code).toBe("string");
    });
  });
});
