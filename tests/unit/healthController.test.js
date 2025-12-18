// tests/unit/healthController.test.js

const { check } = require('../../src/controllers/healthController');

const prisma = require('../../src/config/prismaClient');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  $queryRaw: jest.fn(),
}));

describe('healthController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      prisma: undefined, // Par défaut, utilise le prisma global
    };
    res = {
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('check', () => {
    it('devrait retourner { status: "healthy" } si la base de données répond', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await check(req, res, next);

      expect(prisma.$queryRaw).toHaveBeenCalledWith(expect.anything());
      expect(res.json).toHaveBeenCalledWith({ status: 'healthy' });
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait utiliser req.prisma si fourni', async () => {
      const mockPrisma = {
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      };
      req.prisma = mockPrisma;

      await check(req, res, next);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(expect.anything());
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ status: 'healthy' });
    });

    it('devrait appeler next avec l\'erreur si la base de données échoue', async () => {
      const error = new Error('Database connection failed');
      prisma.$queryRaw.mockRejectedValue(error);

      await check(req, res, next);

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});


