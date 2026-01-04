// tests/unit/communeController.test.js

const {
  listCommunes,
  createCommune,
  updateCommune,
  deleteCommune,
  getCommuneDeletionSummary,
} = require('../../src/controllers/communeController');
const prisma = require('../../src/config/prismaClient');
const { OWNER_TYPES } = require('../../src/services/stockLotService');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => {
  const mockPrisma = {
    commune: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    district: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    healthCenter: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    children: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
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
    stockDISTRICT: {
      deleteMany: jest.fn(),
    },
    vaccineRequest: {
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      const mockPrisma = require('../../src/config/prismaClient');
      const mockTx = {
        commune: mockPrisma.commune,
        district: mockPrisma.district,
        healthCenter: mockPrisma.healthCenter,
        children: mockPrisma.children,
        user: mockPrisma.user,
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
        stockDISTRICT: mockPrisma.stockDISTRICT,
        vaccineRequest: mockPrisma.vaccineRequest,
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

describe('communeController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      params: {},
      user: {
        role: 'NATIONAL',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    next = jest.fn();
  });

  describe('listCommunes()', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'AGENT';

      await listCommunes(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner une liste vide si REGIONAL sans regionId', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = null;

      await listCommunes(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ total: 0, items: [] });
    });

    it('devrait retourner les communes pour un REGIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      const mockCommunes = [
        { id: 'commune-1', name: 'Commune 1', region: { id: 'region-1', name: 'Dakar' } },
      ];
      prisma.commune.findMany.mockResolvedValue(mockCommunes);

      await listCommunes(req, res, next);

      expect(prisma.commune.findMany).toHaveBeenCalledWith({
        where: { regionId: 'region-1' },
        include: {
          region: { select: { id: true, name: true } },
          districts: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      });
      expect(res.json).toHaveBeenCalledWith({ total: 1, items: mockCommunes });
    });

    it('devrait retourner toutes les communes pour un NATIONAL', async () => {
      const mockCommunes = [
        { id: 'commune-1', name: 'Commune 1' },
      ];
      prisma.commune.findMany.mockResolvedValue(mockCommunes);

      await listCommunes(req, res, next);

      expect(prisma.commune.findMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ total: 1, items: mockCommunes });
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      const error = new Error('Erreur base de données');
      prisma.commune.findMany.mockRejectedValue(error);

      await listCommunes(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('createCommune()', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'AGENT';
      req.body.name = 'Commune Test';
      req.body.regionId = 'region-1';

      await createCommune(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 400 si nom ou région manquants', async () => {
      req.body.name = '';
      req.body.regionId = 'region-1';

      await createCommune(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Nom et région requis' });
    });

    it('devrait créer une commune avec succès pour NATIONAL', async () => {
      req.body.name = 'Commune Test';
      req.body.regionId = 'region-1';
      const mockCommune = {
        id: 'commune-1',
        name: 'Commune Test',
        regionId: 'region-1',
        region: { id: 'region-1', name: 'Dakar' },
      };
      prisma.commune.create.mockResolvedValue(mockCommune);

      await createCommune(req, res, next);

      expect(prisma.commune.create).toHaveBeenCalledWith({
        data: { name: 'Commune Test', regionId: 'region-1' },
        include: { region: { select: { id: true, name: true } } },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCommune);
    });

    it('devrait utiliser regionId de l\'utilisateur REGIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.body.name = 'Commune Test';
      const mockCommune = {
        id: 'commune-1',
        name: 'Commune Test',
        regionId: 'region-1',
      };
      prisma.commune.create.mockResolvedValue(mockCommune);

      await createCommune(req, res, next);

      expect(prisma.commune.create).toHaveBeenCalledWith({
        data: { name: 'Commune Test', regionId: 'region-1' },
        include: { region: { select: { id: true, name: true } } },
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.body.name = 'Commune Test';
      req.body.regionId = 'region-1';
      const error = new Error('Erreur base de données');
      prisma.commune.create.mockRejectedValue(error);

      await createCommune(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateCommune()', () => {
    it('devrait retourner 404 si commune non trouvée', async () => {
      req.params.id = 'commune-1';
      req.body.name = 'Commune Modifiée';
      prisma.commune.findUnique.mockResolvedValue(null);

      await updateCommune(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Commune introuvable' });
    });

    it('devrait retourner 403 si REGIONAL essaie de modifier une commune d\'une autre région', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'commune-1';
      req.body.name = 'Commune Modifiée';
      prisma.commune.findUnique.mockResolvedValue({
        id: 'commune-1',
        region: { id: 'region-2' },
      });

      await updateCommune(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait mettre à jour une commune avec succès', async () => {
      req.params.id = 'commune-1';
      req.body.name = 'Commune Modifiée';
      const mockCommune = { id: 'commune-1', name: 'Commune Test', region: { id: 'region-1' } };
      const mockUpdated = { id: 'commune-1', name: 'Commune Modifiée' };
      prisma.commune.findUnique.mockResolvedValue(mockCommune);
      prisma.commune.update.mockResolvedValue(mockUpdated);

      await updateCommune(req, res, next);

      expect(prisma.commune.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.params.id = 'commune-1';
      const error = new Error('Erreur base de données');
      prisma.commune.findUnique.mockRejectedValue(error);

      await updateCommune(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteCommune()', () => {
    beforeEach(() => {
      prisma.commune.findUnique = jest.fn();
      prisma.district.findMany = jest.fn();
      prisma.healthCenter.findMany = jest.fn();
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
      prisma.vaccineRequest.count = jest.fn();
    });

    it('devrait retourner 404 si commune non trouvée', async () => {
      req.params.id = 'commune-1';
      prisma.commune.findUnique.mockResolvedValue(null);

      await deleteCommune(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Commune introuvable' });
    });

    it('devrait retourner 403 si REGIONAL essaie de supprimer une commune d\'une autre région', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'commune-1';
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-2' });

      await deleteCommune(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait supprimer une commune avec toutes ses données liées', async () => {
      req.params.id = 'commune-1';

      const mockCommune = { id: 'commune-1', name: 'Commune 1', region: { id: 'region-1', name: 'Dakar' } };
      const mockDistricts = [{ id: 'district-1', name: 'District 1' }];
      const mockHealthCenters = [{ id: 'hc-1', name: 'HC 1' }];
      const mockChildren = [{ id: 'child-1', firstName: 'John', lastName: 'Doe' }];
      const mockUsers = [{ id: 'user-1', firstName: 'User', lastName: '1', role: 'AGENT' }];
      const mockStockLots = [{ id: 'lot-1', ownerType: OWNER_TYPES.DISTRICT, ownerId: 'district-1' }];
      const mockPendingTransfers = [{ id: 'transfer-1', status: 'PENDING' }];

      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.commune.findUnique.mockResolvedValueOnce(mockCommune);
      prisma.district.findMany.mockResolvedValue(mockDistricts);
      prisma.healthCenter.findMany.mockResolvedValue(mockHealthCenters);
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
      prisma.vaccineRequest.count.mockResolvedValue(1);

      // Mock toutes les opérations de suppression
      prisma.stockReservation.deleteMany.mockResolvedValue({ count: 2 });
      prisma.childVaccineScheduled.deleteMany.mockResolvedValue({ count: 5 });
      prisma.childVaccineCompleted.deleteMany.mockResolvedValue({ count: 10 });
      prisma.childVaccineDue.deleteMany.mockResolvedValue({ count: 3 });
      prisma.childVaccineLate.deleteMany.mockResolvedValue({ count: 2 });
      prisma.childVaccineOverdue.deleteMany.mockResolvedValue({ count: 1 });
      prisma.vaccineRequest.deleteMany.mockResolvedValue({ count: 1 });
      prisma.record.deleteMany.mockResolvedValue({ count: 5 });
      prisma.children.deleteMany.mockResolvedValue({ count: 1 });
      prisma.pendingStockTransferLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockTransferLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockHEALTHCENTER.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockDISTRICT.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.deleteMany.mockResolvedValue({ count: 1 });
      prisma.healthCenter.deleteMany.mockResolvedValue({ count: 1 });
      prisma.district.deleteMany.mockResolvedValue({ count: 1 });
      prisma.commune.delete.mockResolvedValue(mockCommune);

      await deleteCommune(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.params.id = 'commune-1';
      const error = new Error('Erreur base de données');
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.$transaction.mockRejectedValue(error);

      await deleteCommune(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getCommuneDeletionSummary()', () => {
    beforeEach(() => {
      prisma.commune.findUnique = jest.fn();
      prisma.district.findMany = jest.fn();
      prisma.healthCenter.findMany = jest.fn();
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
      prisma.vaccineRequest.count = jest.fn();
    });

    it('devrait retourner 404 si commune non trouvée', async () => {
      req.params.id = 'commune-1';
      prisma.commune.findUnique.mockResolvedValue(null);

      await getCommuneDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Commune introuvable' });
    });

    it('devrait retourner un résumé de suppression avec toutes les données', async () => {
      req.params.id = 'commune-1';

      const mockCommune = {
        id: 'commune-1',
        name: 'Commune 1',
        region: { id: 'region-1', name: 'Dakar' },
      };
      const mockDistricts = [{ id: 'district-1', name: 'District 1' }];
      const mockHealthCenters = [{ id: 'hc-1', name: 'HC 1' }];
      const mockChildren = [{ id: 'child-1', firstName: 'John', lastName: 'Doe' }];
      const mockUsers = [{ id: 'user-1', firstName: 'User', lastName: '1', role: 'AGENT' }];
      const mockStockLots = [{ id: 'lot-1', ownerType: OWNER_TYPES.DISTRICT, ownerId: 'district-1' }];
      const mockPendingTransfers = [{ id: 'transfer-1', status: 'PENDING' }];

      const mockCascadeData = {
        commune: mockCommune,
        districts: mockDistricts,
        healthCenters: mockHealthCenters,
        children: mockChildren,
        users: mockUsers,
        childIds: ['child-1'],
        healthCenterIds: ['hc-1'],
        districtIds: ['district-1'],
        lotIds: ['lot-1'],
        pendingTransferIds: ['transfer-1'],
        stockLots: mockStockLots,
        pendingTransfers: mockPendingTransfers,
        summary: {
          scheduled: 5,
          due: 3,
          late: 2,
          overdue: 1,
          completed: 10,
          stockReservations: 2,
          records: 5,
          stockLots: 1,
          pendingTransfers: 1,
          vaccineRequests: 1,
        },
      };

      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.$transaction.mockResolvedValue(mockCascadeData);

      await getCommuneDeletionSummary(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        commune: {
          id: mockCommune.id,
          name: mockCommune.name,
          region: mockCommune.region,
        },
        totals: {
          districts: 1,
          healthCenters: 1,
          children: 1,
          users: 1,
          stockLots: 1,
          pendingTransfers: 1,
          stockReservations: 2,
          records: 5,
          vaccineRequests: 1,
          scheduledVaccines: 5,
          dueVaccines: 3,
          lateVaccines: 2,
          overdueVaccines: 1,
          completedVaccines: 10,
        },
        details: {
          districts: mockDistricts,
          healthCenters: mockHealthCenters,
          children: mockChildren,
          users: mockUsers,
          stockLots: mockStockLots,
          pendingTransfers: mockPendingTransfers,
        },
      });
    });

    it('devrait appeler next en cas d\'erreur non gérée', async () => {
      req.params.id = 'commune-1';
      const error = new Error('Erreur base de données');
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.$transaction.mockRejectedValue(error);

      await getCommuneDeletionSummary(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

