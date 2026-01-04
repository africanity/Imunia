// tests/unit/eventLogController.test.js

const {
  getEventLogs,
  getEventLogStats,
  deleteEventLog,
  deleteMultipleEventLogs,
} = require('../../src/controllers/eventLogController');

const prisma = require('../../src/config/prismaClient');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  eventLog: {
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
  },
}));

describe('eventLogController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {
        id: 'user-1',
        role: 'SUPERADMIN',
      },
      params: {},
      query: {},
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('getEventLogs', () => {
    it('devrait retourner 403 si utilisateur n\'est pas SUPERADMIN ou NATIONAL', async () => {
      req.user.role = 'REGIONAL';

      await getEventLogs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner les événements avec pagination par défaut', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          type: 'USER',
          subtype: null,
          action: 'CREATE',
          createdAt: new Date(),
          user: null,
          userFirstName: null,
          userLastName: null,
          userEmail: null,
          userRole: null,
          entityType: null,
          entityId: null,
          entityName: null,
          details: null,
          metadata: null,
        },
      ];

      prisma.eventLog.findMany.mockResolvedValue(mockLogs);
      prisma.eventLog.count.mockResolvedValue(1);

      await getEventLogs(req, res, next);

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
          orderBy: {
            createdAt: 'desc',
          },
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        events: [
          expect.objectContaining({
            id: 'log-1',
            type: 'USER',
            action: 'CREATE',
            user: {
              firstName: null,
              lastName: null,
              email: null,
              role: null,
            },
          }),
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
        },
      });
    });

    it('devrait filtrer par type', async () => {
      req.query.type = 'USER';

      prisma.eventLog.findMany.mockResolvedValue([]);
      prisma.eventLog.count.mockResolvedValue(0);

      await getEventLogs(req, res, next);

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'USER',
          }),
        })
      );
    });

    it('devrait filtrer par plage de dates', async () => {
      req.query.dateFrom = '2024-01-01';
      req.query.dateTo = '2024-12-31';

      prisma.eventLog.findMany.mockResolvedValue([]);
      prisma.eventLog.count.mockResolvedValue(0);

      await getEventLogs(req, res, next);

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('devrait filtrer par date précise', async () => {
      req.query.date = '2024-06-15';

      prisma.eventLog.findMany.mockResolvedValue([]);
      prisma.eventLog.count.mockResolvedValue(0);

      await getEventLogs(req, res, next);

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('devrait gérer la pagination personnalisée', async () => {
      req.query.page = '2';
      req.query.limit = '25';

      prisma.eventLog.findMany.mockResolvedValue([]);
      prisma.eventLog.count.mockResolvedValue(100);

      await getEventLogs(req, res, next);

      expect(prisma.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            page: 2,
            limit: 25,
            totalPages: 4,
          }),
        })
      );
    });

    it('devrait gérer les erreurs', async () => {
      prisma.eventLog.findMany.mockRejectedValue(new Error('DB Error'));

      await getEventLogs(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getEventLogStats', () => {
    it('devrait retourner les statistiques des événements', async () => {
      const mockStats = [
        {
          type: 'USER',
          action: 'CREATE',
          _count: { id: 10 },
        },
      ];

      prisma.eventLog.groupBy.mockResolvedValue(mockStats);

      await getEventLogStats(req, res, next);

      expect(prisma.eventLog.groupBy).toHaveBeenCalledWith({
        by: ['type', 'subtype'],
        _count: { id: true },
      });
      expect(res.json).toHaveBeenCalledWith({
        stats: mockStats,
      });
    });

    it('devrait retourner 403 si utilisateur n\'est pas SUPERADMIN ou NATIONAL', async () => {
      req.user.role = 'REGIONAL';

      await getEventLogStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait gérer les erreurs', async () => {
      prisma.eventLog.groupBy.mockRejectedValue(new Error('DB Error'));

      await getEventLogStats(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteEventLog', () => {
    it('devrait supprimer un événement avec succès', async () => {
      req.params.id = 'log-1';

      prisma.eventLog.delete.mockResolvedValue({
        id: 'log-1',
      });

      await deleteEventLog(req, res, next);

      expect(prisma.eventLog.delete).toHaveBeenCalledWith({
        where: { id: 'log-1' },
      });
      expect(res.json).toHaveBeenCalledWith({
        message: 'Événement supprimé avec succès',
      });
    });

    it('devrait retourner 403 si utilisateur n\'est pas SUPERADMIN ou NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'log-1';

      await deleteEventLog(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.params.id = 'log-1';
      prisma.eventLog.delete.mockRejectedValue(new Error('DB Error'));

      await deleteEventLog(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteMultipleEventLogs', () => {
    it('devrait supprimer plusieurs événements avec succès', async () => {
      req.body.ids = ['log-1', 'log-2', 'log-3'];

      prisma.eventLog.deleteMany.mockResolvedValue({
        count: 3,
      });

      await deleteMultipleEventLogs(req, res, next);

      expect(prisma.eventLog.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['log-1', 'log-2', 'log-3'] },
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        message: '3 événement(s) supprimé(s) avec succès',
      });
    });

    it('devrait retourner 400 si ids manquant ou invalide', async () => {
      req.body = {};

      await deleteMultipleEventLogs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Liste d\'IDs invalide',
      });
    });

    it('devrait retourner 400 si ids est un tableau vide', async () => {
      req.body.ids = [];

      await deleteMultipleEventLogs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Liste d\'IDs invalide',
      });
    });

    it('devrait retourner 403 si utilisateur n\'est pas SUPERADMIN ou NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.body.ids = ['log-1'];

      await deleteMultipleEventLogs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.body.ids = ['log-1'];
      prisma.eventLog.deleteMany.mockRejectedValue(new Error('DB Error'));

      await deleteMultipleEventLogs(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
