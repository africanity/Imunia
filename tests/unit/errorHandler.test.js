const errorHandler = require("../../src/middleware/errorHandler");

describe("errorHandler", () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe("Erreurs Prisma", () => {
    it("devrait gérer P2002 (contrainte unique) pour email", () => {
      const error = {
        code: "P2002",
        meta: {
          target: ["email"],
          modelName: "User",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Cet email est déjà utilisé. Veuillez utiliser un autre email.",
        })
      );
    });

    it("devrait gérer P2002 pour phone", () => {
      const error = {
        code: "P2002",
        meta: {
          target: ["phone"],
          modelName: "User",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Ce numéro de téléphone est déjà utilisé. Veuillez utiliser un autre numéro.",
        })
      );
    });

    it("devrait gérer P2002 pour code", () => {
      const error = {
        code: "P2002",
        meta: {
          target: ["code"],
          modelName: "User",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Ce code est déjà utilisé. Veuillez utiliser un autre code.",
        })
      );
    });

    it("devrait gérer P2002 pour name", () => {
      const error = {
        code: "P2002",
        meta: {
          target: ["name"],
          modelName: "User",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Ce nom est déjà utilisé. Veuillez utiliser un autre nom.",
        })
      );
    });

    it("devrait gérer P2002 pour communeid", () => {
      const error = {
        code: "P2002",
        meta: {
          target: ["communeid"],
          modelName: "User",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("commune"),
        })
      );
    });

    it("devrait gérer P2002 pour districtid", () => {
      const error = {
        code: "P2002",
        meta: {
          target: ["districtid"],
          modelName: "User",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("district"),
        })
      );
    });

    it("devrait gérer P2002 pour regionid", () => {
      const error = {
        code: "P2002",
        meta: {
          target: ["regionid"],
          modelName: "User",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("région"),
        })
      );
    });

    it("devrait gérer P2002 pour healthcenterid", () => {
      const error = {
        code: "P2002",
        meta: {
          target: ["healthcenterid"],
          modelName: "User",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("centre de santé"),
        })
      );
    });

    it("devrait gérer P2002 pour ChildVaccineScheduled", () => {
      const error = {
        code: "P2002",
        meta: {
          modelName: "ChildVaccineScheduled",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("rendez-vous existe déjà"),
        })
      );
    });

    it("devrait gérer P2002 pour ChildVaccineCompleted", () => {
      const error = {
        code: "P2002",
        meta: {
          modelName: "ChildVaccineCompleted",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("dose a déjà été administrée"),
        })
      );
    });

    it("devrait gérer P2002 pour ChildVaccineDue", () => {
      const error = {
        code: "P2002",
        meta: {
          modelName: "ChildVaccineDue",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("enregistrement existe déjà"),
        })
      );
    });

    it("devrait gérer P2002 pour ChildVaccineLate", () => {
      const error = {
        code: "P2002",
        meta: {
          modelName: "ChildVaccineLate",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("enregistrement existe déjà"),
        })
      );
    });

    it("devrait gérer P2002 pour ChildVaccineOverdue", () => {
      const error = {
        code: "P2002",
        meta: {
          modelName: "ChildVaccineOverdue",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("enregistrement existe déjà"),
        })
      );
    });

    it("devrait gérer P2002 avec metaField au lieu de target", () => {
      const error = {
        code: "P2002",
        meta: {
          field_name: "email",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("email"),
        })
      );
    });

    it("devrait gérer P2002 avec constraintName contenant email", () => {
      const error = {
        code: "P2002",
        meta: {
          constraint: "user_email_unique",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("email"),
        })
      );
    });

    it("devrait gérer P2002 avec constraintName contenant phone", () => {
      const error = {
        code: "P2002",
        meta: {
          constraint: "user_phone_unique",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("téléphone"),
        })
      );
    });

    it("devrait gérer P2002 avec constraintName contenant code", () => {
      const error = {
        code: "P2002",
        meta: {
          constraint: "user_code_unique",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("code"),
        })
      );
    });

    it("devrait gérer P2002 avec constraintName contenant name", () => {
      const error = {
        code: "P2002",
        meta: {
          constraint: "user_name_unique",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("nom"),
        })
      );
    });

    it("devrait gérer P2002 avec constraintName complexe (extraction du champ)", () => {
      // Le code extrait parts[parts.length - 2] d'abord
      // Pour "communeid_unique", parts = ["communeid", "unique"]
      // parts.length = 2, donc parts[parts.length - 2] = parts[0] = "communeid"
      // "communeid" est dans fieldLabels, donc ça devrait fonctionner
      const error = {
        code: "P2002",
        meta: {
          constraint: "communeid_unique",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("commune"),
        })
      );
    });

    it("devrait gérer P2002 avec message générique si aucun cas ne correspond", () => {
      const error = {
        code: "P2002",
        meta: {
          constraint: "unknown_constraint",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Une des informations saisies est déjà utilisée. Veuillez vérifier et modifier les champs concernés.",
        })
      );
    });

    it("devrait gérer P2003 (contrainte de clé étrangère)", () => {
      const error = {
        code: "P2003",
        meta: {
          modelName: "User",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Une référence invalide a été fournie. Veuillez vérifier les informations saisies.",
        })
      );
    });

    it("devrait gérer P2014 (contrainte de relation)", () => {
      const error = {
        code: "P2014",
        meta: {
          modelName: "User",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Impossible de supprimer cet élément car il est encore utilisé dans le système.",
        })
      );
    });

    it("devrait gérer P2025 (enregistrement non trouvé)", () => {
      const error = {
        code: "P2025",
        meta: {
          modelName: "User",
        },
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "L'enregistrement demandé n'existe pas.",
        })
      );
    });

    it("devrait gérer d'autres erreurs Prisma avec status >= 500", () => {
      const error = {
        code: "P9999",
        status: 500,
        message: "Unknown Prisma error",
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Une erreur de base de données est survenue. Veuillez réessayer plus tard.",
        })
      );
    });

    it("devrait gérer d'autres erreurs Prisma avec status < 500", () => {
      const error = {
        code: "P9999",
        status: 400,
        message: "Bad request",
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Bad request",
        })
      );
    });
  });

  describe("Erreurs JWT", () => {
    it("devrait gérer les erreurs JWT expiré", () => {
      const error = {
        name: "TokenExpiredError",
        message: "jwt expired",
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Token expiré",
        })
      );
    });

    it("devrait gérer les erreurs JWT invalide", () => {
      const error = {
        name: "JsonWebTokenError",
        message: "invalid token",
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Token invalide",
        })
      );
    });
  });

  describe("Erreurs génériques", () => {
    it("devrait utiliser le status de l'erreur si défini", () => {
      const error = {
        status: 400,
        message: "Bad request",
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Bad request",
        })
      );
    });

    it("devrait utiliser 500 par défaut", () => {
      const error = {
        message: "Internal error",
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Une erreur est survenue lors du traitement de votre demande. Veuillez réessayer plus tard.",
        })
      );
    });

    it("devrait utiliser le message par défaut si status < 500", () => {
      const error = {
        status: 400,
        message: "Bad request",
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Bad request",
        })
      );
    });

    it("devrait inclure stack trace en développement", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const error = {
        message: "Test error",
        stack: "Error: Test error\n    at test.js:1:1",
      };

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Test error",
          stack: expect.stringContaining("Test error"),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("ne devrait pas inclure stack trace en production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const error = {
        message: "Test error",
        stack: "Error: Test error\n    at test.js:1:1",
      };

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.not.objectContaining({
          error: expect.anything(),
          stack: expect.anything(),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });
});