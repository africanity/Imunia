// tests/unit/auth.test.js

// Mocker les dépendances AVANT l'import
jest.mock("../../src/services/tokenService");
jest.mock("../../src/config/prismaClient", () => ({
  user: {
    findUnique: jest.fn(),
  },
  children: {
    findUnique: jest.fn(),
  },
}));

const { requireAuth, requireMobileAuth, optionalAuth } = require("../../src/middleware/auth");
const tokenService = require("../../src/services/tokenService");
const prisma = require("../../src/config/prismaClient");

describe("auth middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("requireAuth", () => {
    it("devrait retourner 401 si aucun token n'est fourni", async () => {
      req.headers.authorization = "";

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Missing token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("devrait retourner 401 si le token est invalide (format incorrect)", async () => {
      req.headers.authorization = "InvalidFormat token123";

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Missing token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("devrait extraire le token du header Bearer (insensible à la casse)", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: "AGENT",
        agentLevel: "STAFF",
        isActive: true,
        regionId: null,
        districtId: null,
        healthCenterId: "hc-1",
      };

      tokenService.verifyAccessToken.mockReturnValue({ sub: "user-1" });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      req.headers.authorization = "bearer valid-token-123";

      await requireAuth(req, res, next);

      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith("valid-token-123");
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          agentLevel: true,
          isActive: true,
          regionId: true,
          districtId: true,
          healthCenterId: true,
        },
      });
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it("devrait accepter le format Bearer (majuscule)", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: "AGENT",
        agentLevel: "STAFF",
        isActive: true,
        regionId: null,
        districtId: null,
        healthCenterId: "hc-1",
      };

      tokenService.verifyAccessToken.mockReturnValue({ sub: "user-1" });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      req.headers.authorization = "Bearer valid-token-123";

      await requireAuth(req, res, next);

      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith("valid-token-123");
      expect(next).toHaveBeenCalled();
    });

    it("devrait retourner 401 si le token est expiré ou invalide", async () => {
      tokenService.verifyAccessToken.mockImplementation(() => {
        throw new Error("Token expired");
      });

      req.headers.authorization = "Bearer invalid-token";

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Token invalide" });
      expect(next).not.toHaveBeenCalled();
    });

    it("devrait retourner 401 si l'utilisateur n'existe pas", async () => {
      tokenService.verifyAccessToken.mockReturnValue({ sub: "user-1" });
      prisma.user.findUnique.mockResolvedValue(null);

      req.headers.authorization = "Bearer valid-token";

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("devrait retourner 401 si l'utilisateur n'est pas actif", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: "AGENT",
        agentLevel: "STAFF",
        isActive: false,
        regionId: null,
        districtId: null,
        healthCenterId: "hc-1",
      };

      tokenService.verifyAccessToken.mockReturnValue({ sub: "user-1" });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      req.headers.authorization = "Bearer valid-token";

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("devrait trimmer les espaces autour du token", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: "AGENT",
        agentLevel: "STAFF",
        isActive: true,
        regionId: null,
        districtId: null,
        healthCenterId: "hc-1",
      };

      tokenService.verifyAccessToken.mockReturnValue({ sub: "user-1" });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      req.headers.authorization = "Bearer   token-with-spaces   ";

      await requireAuth(req, res, next);

      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith("token-with-spaces");
      expect(next).toHaveBeenCalled();
    });
  });

  describe("requireMobileAuth", () => {
    it("devrait retourner 401 si aucun token n'est fourni", async () => {
      req.headers.authorization = "";

      await requireMobileAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Token manquant" });
      expect(next).not.toHaveBeenCalled();
    });

    it("devrait retourner 401 si le token n'est pas de type parent", async () => {
      tokenService.verifyAccessToken.mockReturnValue({
        sub: "child-1",
        type: "agent",
      });

      req.headers.authorization = "Bearer valid-token";

      await requireMobileAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Token invalide pour mobile" });
      expect(next).not.toHaveBeenCalled();
    });

    it("devrait accepter un token parent valide sans childId dans l'URL", async () => {
      const mockChild = {
        id: "child-1",
        firstName: "Child",
        lastName: "Test",
      };

      tokenService.verifyAccessToken.mockReturnValue({
        sub: "child-1",
        type: "parent",
        phone: "+1234567890",
      });
      prisma.children.findUnique.mockResolvedValue(mockChild);

      req.headers.authorization = "Bearer valid-token";

      await requireMobileAuth(req, res, next);

      expect(prisma.children.findUnique).toHaveBeenCalledWith({
        where: { id: "child-1" },
      });
      expect(req.childId).toBe("child-1");
      expect(req.parentPhone).toBe("+1234567890");
      expect(next).toHaveBeenCalled();
    });

    it("devrait vérifier que le childId dans l'URL correspond au token", async () => {
      const mockChild = {
        id: "child-1",
        phoneParent: "+1234567890",
      };

      tokenService.verifyAccessToken.mockReturnValue({
        sub: "child-1",
        type: "parent",
        phone: "+1234567890",
      });
      // Si urlChildId === payload.sub, le premier findUnique n'est pas appelé
      // Seul le deuxième findUnique (sans select) est appelé
      prisma.children.findUnique.mockResolvedValue(mockChild);

      req.params.childId = "child-1";
      req.headers.authorization = "Bearer valid-token";

      await requireMobileAuth(req, res, next);

      // Le findUnique est appelé sans select pour vérifier que l'enfant existe
      expect(prisma.children.findUnique).toHaveBeenCalledWith({
        where: { id: "child-1" },
      });
      expect(req.childId).toBe("child-1");
      expect(next).toHaveBeenCalled();
    });

    it("devrait retourner 403 si le childId dans l'URL ne correspond pas au téléphone du parent", async () => {
      const mockChildWithPhone = {
        id: "child-2",
        phoneParent: "+9876543210",
      };
      const mockChildFull = {
        id: "child-2",
        phoneParent: "+9876543210",
        firstName: "Child",
        lastName: "Test",
      };

      tokenService.verifyAccessToken.mockReturnValue({
        sub: "child-1", // Le token est pour child-1
        type: "parent",
        phone: "+1234567890",
      });
      // Le code appelle findUnique deux fois :
      // 1. Avec select: { phoneParent: true } pour vérifier l'accès
      // 2. Sans select pour vérifier que l'enfant existe
      prisma.children.findUnique
        .mockResolvedValueOnce(mockChildWithPhone) // Premier appel avec select
        .mockResolvedValueOnce(mockChildFull); // Deuxième appel sans select

      req.params.childId = "child-2"; // Différent de payload.sub
      req.headers.authorization = "Bearer valid-token";

      await requireMobileAuth(req, res, next);

      // Vérifier que le premier appel a été fait avec select
      expect(prisma.children.findUnique).toHaveBeenCalledWith({
        where: { id: "child-2" },
        select: { phoneParent: true },
      });
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Accès refusé" });
      expect(next).not.toHaveBeenCalled();
    });

    it("devrait retourner 401 si l'enfant n'existe pas", async () => {
      tokenService.verifyAccessToken.mockReturnValue({
        sub: "child-1",
        type: "parent",
        phone: "+1234567890",
      });
      prisma.children.findUnique.mockResolvedValue(null);

      req.headers.authorization = "Bearer valid-token";

      await requireMobileAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Enfant non trouvé" });
      expect(next).not.toHaveBeenCalled();
    });

    it("devrait retourner 401 si le token est invalide", async () => {
      tokenService.verifyAccessToken.mockImplementation(() => {
        throw new Error("Token expired");
      });

      req.headers.authorization = "Bearer invalid-token";

      await requireMobileAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Token invalide" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("optionalAuth", () => {
    it("devrait retourner 401 si aucun token n'est fourni", async () => {
      req.headers.authorization = "";
      req.query.token = undefined;

      await optionalAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Missing token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("devrait utiliser le token du header si disponible", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: "AGENT",
        agentLevel: "STAFF",
        isActive: true,
        regionId: null,
        districtId: null,
        healthCenterId: "hc-1",
      };

      tokenService.verifyAccessToken.mockReturnValue({ sub: "user-1" });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      req.headers.authorization = "Bearer header-token";
      req.query.token = "query-token";

      await optionalAuth(req, res, next);

      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith("header-token");
      expect(next).toHaveBeenCalled();
    });

    it("devrait utiliser le token de la query si le header n'est pas disponible", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: "AGENT",
        agentLevel: "STAFF",
        isActive: true,
        regionId: null,
        districtId: null,
        healthCenterId: "hc-1",
      };

      tokenService.verifyAccessToken.mockReturnValue({ sub: "user-1" });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      req.headers.authorization = "";
      req.query.token = "query-token";

      await optionalAuth(req, res, next);

      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith("query-token");
      expect(next).toHaveBeenCalled();
    });

    it("devrait retourner 401 si l'utilisateur n'est pas actif", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: "AGENT",
        agentLevel: "STAFF",
        isActive: false,
        regionId: null,
        districtId: null,
        healthCenterId: "hc-1",
      };

      tokenService.verifyAccessToken.mockReturnValue({ sub: "user-1" });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      req.headers.authorization = "Bearer valid-token";

      await optionalAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("devrait retourner 401 si le token est invalide", async () => {
      tokenService.verifyAccessToken.mockImplementation(() => {
        throw new Error("Token expired");
      });

      req.query.token = "invalid-token";

      await optionalAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Token invalide" });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
