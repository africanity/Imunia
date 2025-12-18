// tests/unit/adviceController.test.js

const {
  getAdvice,
  createAdvice,
  updateAdvice,
  deleteAdvice,
} = require('../../src/controllers/adviceController');

const prisma = require('../../src/config/prismaClient');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  advice: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('adviceController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {},
      body: {},
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('getAdvice', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';

      await getAdvice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner la liste des conseils pour NATIONAL', async () => {
      req.user.role = 'NATIONAL';

      const mockAdvice = [
        {
          id: 'advice-1',
          title: 'Conseil 1',
          content: 'Contenu 1',
          category: 'santé',
          isActive: true,
        },
        {
          id: 'advice-2',
          title: 'Conseil 2',
          content: 'Contenu 2',
          category: 'nutrition',
          isActive: true,
        },
      ];

      prisma.advice.findMany.mockResolvedValue(mockAdvice);

      await getAdvice(req, res, next);

      expect(prisma.advice.findMany).toHaveBeenCalledWith({
        orderBy: [
          { createdAt: 'desc' },
        ],
      });
      expect(res.json).toHaveBeenCalledWith({
        total: 2,
        items: mockAdvice,
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';

      prisma.advice.findMany.mockRejectedValue(new Error('DB Error'));

      await getAdvice(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('createAdvice', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';

      await createAdvice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 400 si titre ou contenu manquants', async () => {
      req.user.role = 'NATIONAL';
      req.body = {};

      await createAdvice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le titre et le contenu sont requis',
      });
    });

    it('devrait retourner 400 si specificAge et minAge/maxAge sont tous fournis', async () => {
      req.user.role = 'NATIONAL';
      req.body = {
        title: 'Conseil Test',
        content: 'Contenu test',
        specificAge: 6,
        minAge: 0,
        maxAge: 12,
      };

      await createAdvice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisez soit specificAge, soit minAge/maxAge, pas les deux',
      });
    });

    it('devrait créer un conseil avec succès sans âge', async () => {
      req.user.role = 'NATIONAL';
      req.body = {
        title: 'Conseil Test',
        content: 'Contenu test',
        category: 'santé',
        specificAge: null,
        minAge: null,
        maxAge: null,
      };

      const mockAdvice = {
        id: 'advice-1',
        title: 'Conseil Test',
        content: 'Contenu test',
        category: 'santé',
        ageUnit: null,
        minAge: null,
        maxAge: null,
        specificAge: null,
        isActive: true,
      };

      prisma.advice.create.mockResolvedValue(mockAdvice);

      await createAdvice(req, res, next);

      expect(prisma.advice.create).toHaveBeenCalledWith({
        data: {
          title: 'Conseil Test',
          content: 'Contenu test',
          category: 'santé',
          ageUnit: null,
          minAge: null,
          maxAge: null,
          specificAge: null,
          isActive: true,
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockAdvice);
    });

    it('devrait créer un conseil avec specificAge', async () => {
      req.user.role = 'NATIONAL';
      req.body = {
        title: 'Conseil Test',
        content: 'Contenu test',
        ageUnit: 'WEEKS',
        specificAge: 6,
        minAge: null,
        maxAge: null,
      };

      const mockAdvice = {
        id: 'advice-1',
        title: 'Conseil Test',
        content: 'Contenu test',
        ageUnit: 'WEEKS',
        specificAge: 6,
        minAge: null,
        maxAge: null,
        isActive: true,
      };

      prisma.advice.create.mockResolvedValue(mockAdvice);

      await createAdvice(req, res, next);

      expect(prisma.advice.create).toHaveBeenCalledWith({
        data: {
          title: 'Conseil Test',
          content: 'Contenu test',
          category: null,
          ageUnit: 'WEEKS',
          minAge: null,
          maxAge: null,
          specificAge: 6,
          isActive: true,
        },
      });
    });

    it('devrait créer un conseil avec minAge et maxAge', async () => {
      req.user.role = 'NATIONAL';
      req.body = {
        title: 'Conseil Test',
        content: 'Contenu test',
        ageUnit: 'MONTHS',
        minAge: 0,
        maxAge: 12,
        specificAge: null,
      };

      const mockAdvice = {
        id: 'advice-1',
        title: 'Conseil Test',
        content: 'Contenu test',
        ageUnit: 'MONTHS',
        minAge: 0,
        maxAge: 12,
        specificAge: null,
        isActive: true,
      };

      prisma.advice.create.mockResolvedValue(mockAdvice);

      await createAdvice(req, res, next);

      expect(prisma.advice.create).toHaveBeenCalledWith({
        data: {
          title: 'Conseil Test',
          content: 'Contenu test',
          category: null,
          ageUnit: 'MONTHS',
          minAge: 0,
          maxAge: 12,
          specificAge: null,
          isActive: true,
        },
      });
    });

    it('devrait convertir NaN en null pour les valeurs d\'âge invalides', async () => {
      req.user.role = 'NATIONAL';
      req.body = {
        title: 'Conseil Test',
        content: 'Contenu test',
        minAge: '', // Chaîne vide -> NaN
        maxAge: 'invalid', // Chaîne invalide -> NaN
        specificAge: null,
      };

      const mockAdvice = {
        id: 'advice-1',
        title: 'Conseil Test',
        content: 'Contenu test',
        minAge: null,
        maxAge: null,
        isActive: true,
      };

      prisma.advice.create.mockResolvedValue(mockAdvice);

      await createAdvice(req, res, next);

      expect(prisma.advice.create).toHaveBeenCalledWith({
        data: {
          title: 'Conseil Test',
          content: 'Contenu test',
          category: null,
          ageUnit: null,
          minAge: null, // NaN converti en null
          maxAge: null, // NaN converti en null
          specificAge: null,
          isActive: true,
        },
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      req.body = {
        title: 'Conseil Test',
        content: 'Contenu test',
        specificAge: null,
        minAge: null,
        maxAge: null,
      };

      prisma.advice.create.mockRejectedValue(new Error('DB Error'));

      await createAdvice(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateAdvice', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params = { id: 'advice-1' };

      await updateAdvice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 404 si conseil introuvable', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'advice-inexistant' };

      prisma.advice.findUnique.mockResolvedValue(null);

      await updateAdvice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Conseil introuvable',
      });
    });

    it('devrait retourner 400 si specificAge et minAge/maxAge sont tous fournis', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'advice-1' };
      req.body = {
        specificAge: 6,
        minAge: 0,
        maxAge: 12,
      };

      const mockAdvice = {
        id: 'advice-1',
        title: 'Conseil Test',
        content: 'Contenu test',
      };

      prisma.advice.findUnique.mockResolvedValue(mockAdvice);

      await updateAdvice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisez soit specificAge, soit minAge/maxAge, pas les deux',
      });
    });

    it('devrait mettre à jour un conseil avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'advice-1' };
      req.body = {
        title: 'Conseil Mis à Jour',
        content: 'Nouveau contenu',
        // Ne pas inclure specificAge, minAge, maxAge pour éviter la validation
      };

      const mockAdvice = {
        id: 'advice-1',
        title: 'Conseil Original',
        content: 'Contenu original',
        specificAge: null,
        minAge: null,
        maxAge: null,
      };

      const mockUpdated = {
        id: 'advice-1',
        title: 'Conseil Mis à Jour',
        content: 'Nouveau contenu',
      };

      prisma.advice.findUnique.mockResolvedValue(mockAdvice);
      prisma.advice.update.mockResolvedValue(mockUpdated);

      await updateAdvice(req, res, next);

      expect(prisma.advice.update).toHaveBeenCalledWith({
        where: { id: 'advice-1' },
        data: {
          title: 'Conseil Mis à Jour',
          content: 'Nouveau contenu',
        },
      });
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait mettre à jour seulement les champs fournis', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'advice-1' };
      req.body = {
        title: 'Conseil Mis à Jour',
        // content non fourni
        // Ne pas inclure specificAge, minAge, maxAge pour éviter la validation
      };

      const mockAdvice = {
        id: 'advice-1',
        title: 'Conseil Original',
        content: 'Contenu original',
        specificAge: null,
        minAge: null,
        maxAge: null,
      };

      const mockUpdated = {
        id: 'advice-1',
        title: 'Conseil Mis à Jour',
        content: 'Contenu original',
      };

      prisma.advice.findUnique.mockResolvedValue(mockAdvice);
      prisma.advice.update.mockResolvedValue(mockUpdated);

      await updateAdvice(req, res, next);

      expect(prisma.advice.update).toHaveBeenCalledWith({
        where: { id: 'advice-1' },
        data: {
          title: 'Conseil Mis à Jour',
        },
      });
    });

    it('devrait convertir NaN en null pour les valeurs d\'âge invalides', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'advice-1' };
      req.body = {
        minAge: '', // Chaîne vide -> NaN
        maxAge: 'invalid', // Chaîne invalide -> NaN
        // Ne pas inclure specificAge pour éviter la validation
      };

      const mockAdvice = {
        id: 'advice-1',
        title: 'Conseil Test',
        content: 'Contenu test',
        specificAge: null,
        minAge: null,
        maxAge: null,
      };

      const mockUpdated = {
        id: 'advice-1',
        minAge: null,
        maxAge: null,
      };

      prisma.advice.findUnique.mockResolvedValue(mockAdvice);
      prisma.advice.update.mockResolvedValue(mockUpdated);

      await updateAdvice(req, res, next);

      expect(prisma.advice.update).toHaveBeenCalledWith({
        where: { id: 'advice-1' },
        data: {
          minAge: null, // NaN converti en null
          maxAge: null, // NaN converti en null
        },
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'advice-1' };

      prisma.advice.findUnique.mockRejectedValue(new Error('DB Error'));

      await updateAdvice(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteAdvice', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params = { id: 'advice-1' };

      await deleteAdvice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 404 si conseil introuvable', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'advice-inexistant' };

      prisma.advice.findUnique.mockResolvedValue(null);

      await deleteAdvice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Conseil introuvable',
      });
    });

    it('devrait supprimer un conseil avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'advice-1' };

      const mockAdvice = {
        id: 'advice-1',
        title: 'Conseil Test',
        content: 'Contenu test',
      };

      prisma.advice.findUnique.mockResolvedValue(mockAdvice);
      prisma.advice.delete.mockResolvedValue(mockAdvice);

      await deleteAdvice(req, res, next);

      expect(prisma.advice.delete).toHaveBeenCalledWith({
        where: { id: 'advice-1' },
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'advice-1' };

      prisma.advice.findUnique.mockRejectedValue(new Error('DB Error'));

      await deleteAdvice(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});



