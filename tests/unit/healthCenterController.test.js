// tests/unit/healthCenterController.test.js

const {
  listHealthCenters,
  createHealthCenter,
  updateHealthCenter,
  deleteHealthCenter,
  getHealthCenterDeletionSummary,
} = require('../../src/controllers/healthCenterController');
const prisma = require('../../src/config/prismaClient');
const { OWNER_TYPES } = require('../../src/services/stockLotService');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => {
  const mockPrisma = {
    healthCenter: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    children: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    childVaccineScheduled: {
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    childVaccineDue: {
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    childVaccineLate: {
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    childVaccineOverdue: {
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    childVaccineCompleted: {
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    stockReservation: {
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    record: {
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    stockLot: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    pendingStockTransfer: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    pendingStockTransferLot: {
      deleteMany: jest.fn(),
    },
    stockTransferLot: {
      deleteMany: jest.fn(),
    },
    stockHEALTHCENTER: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      const mockPrisma = require('../../src/config/prismaClient');
      const mockTx = {
        healthCenter: mockPrisma.healthCenter,
        user: mockPrisma.user,
        children: mockPrisma.children,
        childVaccineScheduled: mockPrisma.childVaccineScheduled,
        childVaccineDue: mockPrisma.childVaccineDue,
        childVaccineLate: mockPrisma.childVaccineLate,
        childVaccineOverdue: mockPrisma.childVaccineOverdue,
        childVaccineCompleted: mockPrisma.childVaccineCompleted,
        stockReservation: mockPrisma.stockReservation,
        record: mockPrisma.record,
        stockLot: mockPrisma.stockLot,
        pendingStockTransfer: mockPrisma.pendingStockTransfer,
        pendingStockTransferLot: mockPrisma.pendingStockTransferLot,
        stockTransferLot: mockPrisma.stockTransferLot,
        stockHEALTHCENTER: mockPrisma.stockHEALTHCENTER,
      };
      return callback(mockTx);
    }),
  };
  return mockPrisma;
});

jest.mock('../../src/services/stockLotService', () => ({
  OWNER_TYPES: {
    REGIONAL: 'REGIONAL',
    DISTRICT: 'DISTRICT',
    HEALTHCENTER: 'HEALTHCENTER',
  },
}));

describe('healthCenterController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      params: {},
      user: {
        role: 'DISTRICT',
        districtId: 'district-1',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    next = jest.fn();
  });

  describe('listHealthCenters()', () => {
    it('devrait retourner une liste vide si AGENT sans healthCenterId', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = null;
      prisma.user.findUnique.mockResolvedValue({ healthCenterId: null });

      await listHealthCenters(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ total: 0, items: [] });
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait retourner une liste vide si DISTRICT sans districtId', async () => {
      req.user.districtId = null;

      await listHealthCenters(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ total: 0, items: [] });
    });

    it('devrait retourner les centres de santé pour un DISTRICT', async () => {
      const mockCenters = [
        { id: 'hc-1', name: 'HC 1', district: { id: 'district-1', name: 'District 1' } },
      ];
      prisma.healthCenter.findMany.mockResolvedValue(mockCenters);

      await listHealthCenters(req, res, next);

      expect(prisma.healthCenter.findMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ total: 1, items: mockCenters });
    });

    it('devrait retourner le centre de santé pour un AGENT', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'hc-1';
      const mockCenters = [{ id: 'hc-1', name: 'HC 1' }];
      prisma.healthCenter.findMany.mockResolvedValue(mockCenters);

      await listHealthCenters(req, res, next);

      expect(prisma.healthCenter.findMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ total: 1, items: mockCenters });
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      const error = new Error('Erreur base de données');
      prisma.healthCenter.findMany.mockRejectedValue(error);

      await listHealthCenters(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('createHealthCenter()', () => {
    it('devrait retourner 403 si utilisateur n\'est pas DISTRICT', async () => {
      req.user.role = 'AGENT';
      req.body.name = 'HC Test';
      req.body.address = 'Adresse Test';

      await createHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 400 si nom ou adresse manquants', async () => {
      req.body.name = '';
      req.body.address = 'Adresse Test';

      await createHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Nom et adresse requis' });
    });

    it('devrait créer un centre de santé avec succès', async () => {
      req.body.name = 'HC Test';
      req.body.address = 'Adresse Test';
      const mockCenter = {
        id: 'hc-1',
        name: 'HC Test',
        address: 'Adresse Test',
        districtId: 'district-1',
        district: { id: 'district-1', name: 'District 1' },
      };
      prisma.healthCenter.create.mockResolvedValue(mockCenter);

      await createHealthCenter(req, res, next);

      expect(prisma.healthCenter.create).toHaveBeenCalledWith({
        data: {
          name: 'HC Test',
          address: 'Adresse Test',
          districtId: 'district-1',
        },
        include: {
          district: {
            select: {
              id: true,
              name: true,
              commune: {
                select: {
                  id: true,
                  name: true,
                  region: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCenter);
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.body.name = 'HC Test';
      req.body.address = 'Adresse Test';
      const error = new Error('Erreur base de données');
      prisma.healthCenter.create.mockRejectedValue(error);

      await createHealthCenter(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateHealthCenter()', () => {
    it('devrait retourner 403 si utilisateur n\'est pas DISTRICT', async () => {
      req.user.role = 'AGENT';
      req.params.id = 'hc-1';

      await updateHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 404 si centre non trouvé', async () => {
      req.params.id = 'hc-1';
      req.body.name = 'HC Modifié';
      prisma.healthCenter.findUnique.mockResolvedValue(null);

      await updateHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Centre introuvable' });
    });

    it('devrait retourner 403 si centre n\'appartient pas au district de l\'utilisateur', async () => {
      req.params.id = 'hc-1';
      req.body.name = 'HC Modifié';
      prisma.healthCenter.findUnique.mockResolvedValue({
        id: 'hc-1',
        districtId: 'district-2',
      });

      await updateHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait mettre à jour un centre de santé avec succès', async () => {
      req.params.id = 'hc-1';
      req.body.name = 'HC Modifié';
      const mockCenter = { id: 'hc-1', name: 'HC Test', districtId: 'district-1' };
      const mockUpdated = { id: 'hc-1', name: 'HC Modifié' };
      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);
      prisma.healthCenter.update.mockResolvedValue(mockUpdated);

      await updateHealthCenter(req, res, next);

      expect(prisma.healthCenter.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.params.id = 'hc-1';
      const error = new Error('Erreur base de données');
      prisma.healthCenter.findUnique.mockRejectedValue(error);

      await updateHealthCenter(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteHealthCenter()', () => {
    beforeEach(() => {
      prisma.healthCenter.findUnique = jest.fn();
      prisma.children.findMany = jest.fn();
      prisma.user.findMany = jest.fn();
      prisma.childVaccineScheduled.count = jest.fn();
      prisma.childVaccineDue.count = jest.fn();
      prisma.childVaccineLate.count = jest.fn();
      prisma.childVaccineOverdue.count = jest.fn();
      prisma.childVaccineCompleted.count = jest.fn();
      prisma.stockReservation.count = jest.fn();
      prisma.record.count = jest.fn();
      prisma.stockLot.findMany = jest.fn();
      prisma.pendingStockTransfer.findMany = jest.fn();
    });

    it('devrait retourner 403 si utilisateur n\'est pas DISTRICT', async () => {
      req.user.role = 'AGENT';
      req.params.id = 'hc-1';

      await deleteHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 404 si centre non trouvé', async () => {
      req.params.id = 'hc-1';
      prisma.healthCenter.findUnique.mockResolvedValue(null);

      await deleteHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Centre introuvable' });
    });

    it('devrait supprimer un centre de santé avec toutes ses données liées', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
        district: { id: 'district-1', name: 'District 1' },
      };
      const mockChildren = [{ id: 'child-1', firstName: 'John', lastName: 'Doe' }];
      const mockUsers = [{ id: 'user-1', firstName: 'User', lastName: '1', role: 'AGENT' }];
      const mockStockLots = [{ id: 'lot-1', vaccineId: 'vaccine-1' }];
      const mockPendingTransfers = [{ id: 'transfer-1', status: 'PENDING' }];

      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);
      prisma.children.findMany.mockResolvedValue(mockChildren);
      prisma.user.findMany.mockResolvedValue(mockUsers);
      prisma.childVaccineScheduled.count.mockResolvedValue(5);
      prisma.childVaccineDue.count.mockResolvedValue(3);
      prisma.childVaccineLate.count.mockResolvedValue(2);
      prisma.childVaccineOverdue.count.mockResolvedValue(1);
      prisma.childVaccineCompleted.count.mockResolvedValue(10);
      prisma.stockReservation.count.mockResolvedValue(2);
      prisma.record.count.mockResolvedValue(5);
      prisma.stockLot.findMany.mockResolvedValue(mockStockLots);
      prisma.pendingStockTransfer.findMany.mockResolvedValue(mockPendingTransfers);

      // Mock toutes les opérations de suppression
      prisma.stockReservation.deleteMany.mockResolvedValue({ count: 2 });
      prisma.childVaccineScheduled.deleteMany.mockResolvedValue({ count: 5 });
      prisma.childVaccineCompleted.deleteMany.mockResolvedValue({ count: 10 });
      prisma.childVaccineDue.deleteMany.mockResolvedValue({ count: 3 });
      prisma.childVaccineLate.deleteMany.mockResolvedValue({ count: 2 });
      prisma.childVaccineOverdue.deleteMany.mockResolvedValue({ count: 1 });
      prisma.record.deleteMany.mockResolvedValue({ count: 5 });
      prisma.children.deleteMany.mockResolvedValue({ count: 1 });
      prisma.pendingStockTransferLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockTransferLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockHEALTHCENTER.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.deleteMany.mockResolvedValue({ count: 1 });
      prisma.healthCenter.delete.mockResolvedValue(mockCenter);

      await deleteHealthCenter(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.params.id = 'hc-1';
      const error = new Error('Erreur base de données');
      prisma.healthCenter.findUnique.mockResolvedValue({
        id: 'hc-1',
        districtId: 'district-1',
      });
      prisma.$transaction.mockRejectedValue(error);

      await deleteHealthCenter(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getHealthCenterDeletionSummary()', () => {
    beforeEach(() => {
      prisma.healthCenter.findUnique = jest.fn();
      prisma.children.findMany = jest.fn();
      prisma.user.findMany = jest.fn();
      prisma.childVaccineScheduled.count = jest.fn();
      prisma.childVaccineDue.count = jest.fn();
      prisma.childVaccineLate.count = jest.fn();
      prisma.childVaccineOverdue.count = jest.fn();
      prisma.childVaccineCompleted.count = jest.fn();
      prisma.stockReservation.count = jest.fn();
      prisma.record.count = jest.fn();
      prisma.stockLot.findMany = jest.fn();
      prisma.pendingStockTransfer.findMany = jest.fn();
    });

    it('devrait retourner 403 si utilisateur n\'est pas DISTRICT', async () => {
      req.user.role = 'AGENT';
      req.params.id = 'hc-1';

      await getHealthCenterDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner un résumé de suppression avec toutes les données', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
        district: { id: 'district-1', name: 'District 1' },
      };
      const mockChildren = [{ id: 'child-1', firstName: 'John', lastName: 'Doe' }];
      const mockUsers = [{ id: 'user-1', firstName: 'User', lastName: '1', role: 'AGENT' }];
      const mockStockLots = [{ id: 'lot-1', vaccineId: 'vaccine-1' }];
      const mockPendingTransfers = [{ id: 'transfer-1', status: 'PENDING' }];

      const mockCascadeData = {
        healthCenter: mockCenter,
        children: mockChildren,
        users: mockUsers,
        stockLots: mockStockLots,
        pendingTransfers: mockPendingTransfers,
        childVaccinationCounts: {
          scheduled: 5,
          due: 3,
          late: 2,
          overdue: 1,
          completed: 10,
        },
        stockReservationsCount: 2,
        recordCount: 5,
        childIds: ['child-1'],
        lotIds: ['lot-1'],
        pendingTransferIds: ['transfer-1'],
      };

      prisma.$transaction.mockResolvedValue(mockCascadeData);

      await getHealthCenterDeletionSummary(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        healthCenter: mockCenter,
        totals: {
          children: 1,
          users: 1,
          stockLots: 1,
          pendingTransfers: 1,
          stockReservations: 2,
          records: 5,
          scheduledVaccines: 5,
          dueVaccines: 3,
          lateVaccines: 2,
          overdueVaccines: 1,
          completedVaccines: 10,
        },
        details: {
          children: mockChildren,
          users: mockUsers,
          stockLots: mockStockLots,
          pendingTransfers: mockPendingTransfers,
        },
      });
    });

    it('devrait retourner 403 si centre n\'appartient pas au district de l\'utilisateur', async () => {
      req.params.id = 'hc-1';

      const mockCascadeData = {
        healthCenter: {
          id: 'hc-1',
          districtId: 'district-2',
        },
      };

      prisma.$transaction.mockResolvedValue(mockCascadeData);

      await getHealthCenterDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait appeler next en cas d\'erreur non gérée', async () => {
      req.params.id = 'hc-1';
      const error = new Error('Erreur base de données');
      prisma.$transaction.mockRejectedValue(error);

      await getHealthCenterDeletionSummary(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

