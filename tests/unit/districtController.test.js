// tests/unit/districtController.test.js

const {
  listDistricts,
  createDistrict,
  updateDistrict,
  deleteDistrict,
  getDistrictDeletionSummary,
} = require('../../src/controllers/districtController');
const prisma = require('../../src/config/prismaClient');
const { OWNER_TYPES } = require('../../src/services/stockLotService');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => {
  const mockPrisma = {
    district: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    commune: {
      findUnique: jest.fn(),
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
    $transaction: jest.fn((callback) => {
      const mockPrisma = require('../../src/config/prismaClient');
      const mockTx = {
        district: mockPrisma.district,
        commune: mockPrisma.commune,
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

describe('districtController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      params: {},
      user: {
        role: 'REGIONAL',
        regionId: 'region-1',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    next = jest.fn();
  });

  describe('listDistricts()', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'AGENT';

      await listDistricts(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner une liste vide si REGIONAL sans regionId', async () => {
      req.user.regionId = null;

      await listDistricts(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ total: 0, items: [] });
    });

    it('devrait retourner les districts pour un REGIONAL', async () => {
      const mockDistricts = [
        { id: 'district-1', name: 'District 1', commune: { id: 'commune-1', name: 'Commune 1' } },
      ];
      prisma.district.findMany.mockResolvedValue(mockDistricts);

      await listDistricts(req, res, next);

      expect(prisma.district.findMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ total: 1, items: mockDistricts });
    });

    it('devrait retourner tous les districts pour un NATIONAL', async () => {
      req.user.role = 'NATIONAL';
      const mockDistricts = [{ id: 'district-1', name: 'District 1' }];
      prisma.district.findMany.mockResolvedValue(mockDistricts);

      await listDistricts(req, res, next);

      expect(prisma.district.findMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ total: 1, items: mockDistricts });
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      const error = new Error('Erreur base de données');
      prisma.district.findMany.mockRejectedValue(error);

      await listDistricts(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('createDistrict()', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL', async () => {
      req.user.role = 'NATIONAL';
      req.body.name = 'District Test';
      req.body.communeId = 'commune-1';

      await createDistrict(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.status).toBe(403);
      expect(error.message).toBe('Accès refusé');
    });

    it('devrait retourner 400 si nom ou commune manquants', async () => {
      req.body.name = '';
      req.body.communeId = 'commune-1';

      await createDistrict(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Nom et commune requis' });
    });

    it('devrait retourner 400 si regionId manquant pour REGIONAL', async () => {
      req.user.regionId = null;
      req.body.name = 'District Test';
      req.body.communeId = 'commune-1';

      await createDistrict(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.status).toBe(400);
      expect(error.message).toBe('Region non définie pour cet utilisateur');
    });

    it('devrait permettre de créer plusieurs districts pour la même commune', async () => {
      req.body.name = 'District Test';
      req.body.communeId = 'commune-1';
      const mockDistrict = {
        id: 'district-1',
        name: 'District Test',
        communeId: 'commune-1',
        commune: { id: 'commune-1', name: 'Commune 1', region: { id: 'region-1', name: 'Region 1' } },
      };
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      // Le contrôleur ne vérifie plus si un district existe déjà pour cette commune
      prisma.district.create.mockResolvedValue(mockDistrict);

      await createDistrict(req, res, next);

      // La création doit réussir même si d'autres districts existent déjà pour cette commune
      expect(prisma.district.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockDistrict);
    });

    it('devrait créer un district avec succès', async () => {
      req.body.name = 'District Test';
      req.body.communeId = 'commune-1';
      const mockDistrict = {
        id: 'district-1',
        name: 'District Test',
        communeId: 'commune-1',
        commune: { id: 'commune-1', name: 'Commune 1', region: { id: 'region-1', name: 'Region 1' } },
      };
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      // Le contrôleur ne vérifie plus si un district existe déjà
      prisma.district.create.mockResolvedValue(mockDistrict);

      await createDistrict(req, res, next);

      expect(prisma.district.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockDistrict);
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.body.name = 'District Test';
      req.body.communeId = 'commune-1';
      const error = new Error('Erreur base de données');
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      // Le contrôleur ne vérifie plus si un district existe déjà
      prisma.district.create.mockRejectedValue(error);

      await createDistrict(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateDistrict()', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'district-1';

      await updateDistrict(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.status).toBe(403);
      expect(error.message).toBe('Accès refusé');
    });

    it('devrait retourner 404 si district non trouvé', async () => {
      req.params.id = 'district-1';
      req.body.name = 'District Modifié';
      prisma.district.findUnique.mockResolvedValue(null);
      prisma.commune.findUnique.mockResolvedValue(null);

      await updateDistrict(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.status).toBe(404);
      expect(error.message).toBe('District introuvable');
    });

    it('devrait mettre à jour un district avec succès', async () => {
      req.params.id = 'district-1';
      req.body.name = 'District Modifié';
      const mockDistrict = {
        id: 'district-1',
        name: 'District Test',
        communeId: 'commune-1',
        commune: { regionId: 'region-1' },
      };
      const mockUpdated = { id: 'district-1', name: 'District Modifié' };
      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.district.update.mockResolvedValue(mockUpdated);

      await updateDistrict(req, res, next);

      expect(prisma.district.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait retourner le district sans modification si data est vide', async () => {
      req.params.id = 'district-1';
      req.body = {}; // Pas de name ni communeId
      const mockDistrict = {
        id: 'district-1',
        name: 'District Test',
        communeId: 'commune-1',
        commune: { regionId: 'region-1' },
      };
      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });

      await updateDistrict(req, res, next);

      expect(prisma.district.update).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockDistrict);
    });

    it('devrait mettre à jour communeId si différent', async () => {
      req.params.id = 'district-1';
      req.body.communeId = 'commune-2';
      const mockDistrict = {
        id: 'district-1',
        name: 'District Test',
        communeId: 'commune-1',
        commune: { regionId: 'region-1' },
      };
      const mockUpdated = { id: 'district-1', communeId: 'commune-2' };
      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.district.update.mockResolvedValue(mockUpdated);

      await updateDistrict(req, res, next);

      expect(prisma.commune.findUnique).toHaveBeenCalledWith({
        where: { id: 'commune-2' },
        select: { regionId: true },
      });
      expect(prisma.district.update).toHaveBeenCalled();
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.params.id = 'district-1';
      const error = new Error('Erreur base de données');
      prisma.district.findUnique.mockRejectedValue(error);

      await updateDistrict(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteDistrict()', () => {
    beforeEach(() => {
      prisma.district.findUnique = jest.fn();
      prisma.commune.findUnique = jest.fn();
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
    });

    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'district-1';

      await deleteDistrict(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.status).toBe(403);
      expect(error.message).toBe('Accès refusé');
    });

    it('devrait supprimer un district avec toutes ses données liées', async () => {
      req.params.id = 'district-1';

      const mockDistrict = {
        id: 'district-1',
        name: 'District 1',
        commune: { id: 'commune-1', name: 'Commune 1', regionId: 'region-1' },
      };
      const mockHealthCenters = [{ id: 'hc-1', name: 'HC 1' }];
      const mockChildren = [{ id: 'child-1', firstName: 'John', lastName: 'Doe' }];
      const mockUsers = [{ id: 'user-1', firstName: 'User', lastName: '1', role: 'AGENT' }];
      const mockStockLots = [{ id: 'lot-1', ownerType: OWNER_TYPES.DISTRICT, ownerId: 'district-1' }];
      const mockPendingTransfers = [{ id: 'transfer-1', status: 'PENDING' }];

      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
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
      prisma.stockDISTRICT.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.deleteMany.mockResolvedValue({ count: 1 });
      prisma.healthCenter.deleteMany.mockResolvedValue({ count: 1 });
      prisma.district.delete.mockResolvedValue(mockDistrict);

      await deleteDistrict(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait supprimer un district avec SUPERADMIN', async () => {
      req.user.role = 'SUPERADMIN';
      req.params.id = 'district-1';

      const mockDistrict = { id: 'district-1' };
      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.healthCenter.findMany.mockResolvedValue([]);
      prisma.children.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.stockLot.findMany.mockResolvedValue([]);
      prisma.pendingStockTransfer.findMany.mockResolvedValue([]);

      prisma.stockDISTRICT.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.deleteMany.mockResolvedValue({ count: 0 });
      prisma.district.delete.mockResolvedValue(mockDistrict);

      await deleteDistrict(req, res, next);

      expect(prisma.district.findUnique).toHaveBeenCalledWith({
        where: { id: 'district-1' },
        select: { id: true },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('devrait retourner 404 si district non trouvé pour SUPERADMIN', async () => {
      req.user.role = 'SUPERADMIN';
      req.params.id = 'district-1';
      prisma.district.findUnique.mockResolvedValue(null);

      await deleteDistrict(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'District introuvable' });
    });

    it('devrait supprimer un district sans enfants ni health centers', async () => {
      req.params.id = 'district-1';

      const mockDistrict = {
        id: 'district-1',
        commune: { regionId: 'region-1' },
      };
      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.healthCenter.findMany.mockResolvedValue([]);
      prisma.children.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.stockLot.findMany.mockResolvedValue([]);
      prisma.pendingStockTransfer.findMany.mockResolvedValue([]);

      prisma.stockDISTRICT.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.deleteMany.mockResolvedValue({ count: 0 });
      prisma.district.delete.mockResolvedValue(mockDistrict);

      await deleteDistrict(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.params.id = 'district-1';
      const error = new Error('Erreur base de données');
      const mockDistrict = {
        id: 'district-1',
        commune: { regionId: 'region-1' },
      };
      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.$transaction.mockRejectedValue(error);

      await deleteDistrict(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getDistrictDeletionSummary()', () => {
    beforeEach(() => {
      prisma.district.findUnique = jest.fn();
      prisma.commune.findUnique = jest.fn();
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
    });

    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'district-1';

      await getDistrictDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner un résumé de suppression avec toutes les données', async () => {
      req.params.id = 'district-1';

      const mockDistrict = {
        id: 'district-1',
        name: 'District 1',
        commune: { id: 'commune-1', name: 'Commune 1', regionId: 'region-1' },
      };
      const mockHealthCenters = [{ id: 'hc-1', name: 'HC 1' }];
      const mockChildren = [{ id: 'child-1', firstName: 'John', lastName: 'Doe' }];
      const mockUsers = [{ id: 'user-1', firstName: 'User', lastName: '1', role: 'AGENT' }];
      const mockStockLots = [{ id: 'lot-1', ownerType: OWNER_TYPES.DISTRICT, ownerId: 'district-1' }];
      const mockPendingTransfers = [{ id: 'transfer-1', status: 'PENDING' }];

      const mockCascadeData = {
        district: mockDistrict,
        healthCenters: mockHealthCenters,
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
        healthCenterIds: ['hc-1'],
        lotIds: ['lot-1'],
        pendingTransferIds: ['transfer-1'],
      };

      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.$transaction.mockResolvedValue(mockCascadeData);

      await getDistrictDeletionSummary(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        district: {
          id: mockDistrict.id,
          name: mockDistrict.name,
          commune: mockDistrict.commune,
        },
        totals: {
          healthCenters: 1,
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
          healthCenters: mockHealthCenters,
          children: mockChildren,
          users: mockUsers,
          stockLots: mockStockLots,
          pendingTransfers: mockPendingTransfers,
        },
      });
    });

    it('devrait retourner 404 si district non trouvé pour SUPERADMIN', async () => {
      req.user.role = 'SUPERADMIN';
      req.params.id = 'district-1';
      prisma.district.findUnique.mockResolvedValue(null);

      await getDistrictDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'District introuvable' });
    });

    it('devrait retourner un résumé pour SUPERADMIN', async () => {
      req.user.role = 'SUPERADMIN';
      req.params.id = 'district-1';

      const mockDistrict = {
        id: 'district-1',
        name: 'District 1',
        commune: { id: 'commune-1', name: 'Commune 1', regionId: 'region-1' },
      };
      const mockCascadeData = {
        district: mockDistrict,
        healthCenters: [],
        children: [],
        users: [],
        stockLots: [],
        pendingTransfers: [],
        childVaccinationCounts: {
          scheduled: 0,
          due: 0,
          late: 0,
          overdue: 0,
          completed: 0,
        },
        stockReservationsCount: 0,
        recordCount: 0,
        childIds: [],
        healthCenterIds: [],
        lotIds: [],
        pendingTransferIds: [],
      };

      prisma.district.findUnique.mockResolvedValue({ id: 'district-1' });
      prisma.$transaction.mockResolvedValue(mockCascadeData);

      await getDistrictDeletionSummary(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs avec status', async () => {
      req.params.id = 'district-1';
      const error = new Error('District introuvable');
      error.status = 404;
      const mockDistrict = {
        id: 'district-1',
        commune: { regionId: 'region-1' },
      };
      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.$transaction.mockRejectedValue(error);

      await getDistrictDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'District introuvable' });
    });

    it('devrait appeler next en cas d\'erreur non gérée', async () => {
      req.params.id = 'district-1';
      const error = new Error('Erreur base de données');
      const mockDistrict = {
        id: 'district-1',
        commune: { regionId: 'region-1' },
      };
      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.commune.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.$transaction.mockRejectedValue(error);

      await getDistrictDeletionSummary(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

