const { hasRole, requireRole } = require("../../src/utils/permissions");

describe("permissions", () => {
  describe("hasRole", () => {
    it("devrait retourner true si l'utilisateur a le rôle requis", () => {
      const user = { role: "AGENT" };
      expect(hasRole(user, "AGENT")).toBe(true);
    });

    it("devrait retourner false si l'utilisateur n'a pas le rôle requis", () => {
      const user = { role: "AGENT" };
      expect(hasRole(user, "REGIONAL")).toBe(false);
    });

    it("devrait retourner true si l'utilisateur est SUPERADMIN", () => {
      const user = { role: "SUPERADMIN" };
      expect(hasRole(user, "AGENT")).toBe(true);
      expect(hasRole(user, "REGIONAL")).toBe(true);
      expect(hasRole(user, "NATIONAL")).toBe(true);
    });

    it("devrait accepter un tableau de rôles", () => {
      const user = { role: "AGENT" };
      expect(hasRole(user, ["AGENT", "REGIONAL"])).toBe(true);
      expect(hasRole(user, ["REGIONAL", "DISTRICT"])).toBe(false);
    });

    it("devrait retourner false si l'utilisateur est null", () => {
      expect(hasRole(null, "AGENT")).toBe(false);
    });

    it("devrait retourner false si l'utilisateur n'a pas de rôle", () => {
      const user = {};
      expect(hasRole(user, "AGENT")).toBe(false);
    });
  });

  describe("requireRole", () => {
    it("devrait appeler next() si l'utilisateur a le rôle requis", () => {
      const middleware = requireRole("AGENT");
      const req = { user: { role: "AGENT" } };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("devrait retourner 401 si l'utilisateur n'est pas authentifié", () => {
      const middleware = requireRole("AGENT");
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Non authentifié",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("devrait retourner 403 si l'utilisateur n'a pas le rôle requis", () => {
      const middleware = requireRole("REGIONAL");
      const req = { user: { role: "AGENT" } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Accès refusé",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});