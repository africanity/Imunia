// tests/unit/regionController.test.js

const {
  createRegion,
  getRegions,
  updateRegion,
  deleteRegion,
  getRegionDeletionSummary,
} = require('../../src/controllers/regionController');
const prisma = require('../../src/config/prismaClient');
const { OWNER_TYPES } = require('../../src/services/stockLotService');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  region: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  commune: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
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
  stockREGIONAL: {
    deleteMany: jest.fn(),
  },
  vaccineRequest: {
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => {
    // Créer un objet mock qui contient toutes les méthodes nécessaires
    // Utiliser require pour obtenir le module mocké
    const mockPrisma = require('../../src/config/prismaClient');
    const mockTx = {
      region: mockPrisma.region,
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
      stockREGIONAL: mockPrisma.stockREGIONAL,
    };
    return callback(mockTx);
  }),
}));

jest.mock('../../src/services/stockLotService', () => ({
  OWNER_TYPES: {
    REGIONAL: 'REGIONAL',
    DISTRICT: 'DISTRICT',
    HEALTHCENTER: 'HEALTHCENTER',
  },
}));

describe('regionController', () => {
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
      end: jest.fn(),
    };
    next = jest.fn();
  });

  describe('createRegion()', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';

      await createRegion(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
      expect(prisma.region.create).not.toHaveBeenCalled();
    });

    it('devrait créer une région avec succès', async () => {
      req.body.name = 'Dakar';
      const mockRegion = { id: 'region-1', name: 'Dakar' };
      prisma.region.create.mockResolvedValue(mockRegion);

      await createRegion(req, res, next);

      expect(prisma.region.create).toHaveBeenCalledWith({
        data: { name: 'Dakar' },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockRegion);
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.body.name = 'Dakar';
      const error = new Error('Erreur base de données');
      prisma.region.create.mockRejectedValue(error);

      await createRegion(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getRegions()', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'DISTRICT';

      await getRegions(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
      expect(prisma.region.findMany).not.toHaveBeenCalled();
    });

    it('devrait retourner toutes les régions avec le total', async () => {
      const mockRegions = [
        { id: 'region-1', name: 'Dakar' },
        { id: 'region-2', name: 'Thiès' },
      ];
      prisma.region.findMany.mockResolvedValue(mockRegions);
      prisma.region.count.mockResolvedValue(2);

      await getRegions(req, res, next);

      expect(prisma.region.findMany).toHaveBeenCalled();
      expect(prisma.region.count).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        total: 2,
        regions: mockRegions,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      const error = new Error('Erreur base de données');
      prisma.region.findMany.mockRejectedValue(error);

      await getRegions(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateRegion()', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'region-1';

      await updateRegion(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
      expect(prisma.region.findUnique).not.toHaveBeenCalled();
    });

    it('devrait retourner 404 si région non trouvée', async () => {
      req.params.id = 'region-1';
      req.body.name = 'Dakar Modifié';
      prisma.region.findUnique.mockResolvedValue(null);

      await updateRegion(req, res, next);

      expect(prisma.region.findUnique).toHaveBeenCalledWith({
        where: { id: 'region-1' },
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Région non trouvée' });
      expect(prisma.region.update).not.toHaveBeenCalled();
    });

    it('devrait mettre à jour une région avec succès', async () => {
      req.params.id = 'region-1';
      req.body.name = 'Dakar Modifié';
      const mockRegion = { id: 'region-1', name: 'Dakar' };
      const mockUpdatedRegion = { id: 'region-1', name: 'Dakar Modifié' };
      prisma.region.findUnique.mockResolvedValue(mockRegion);
      prisma.region.update.mockResolvedValue(mockUpdatedRegion);

      await updateRegion(req, res, next);

      expect(prisma.region.findUnique).toHaveBeenCalledWith({
        where: { id: 'region-1' },
      });
      expect(prisma.region.update).toHaveBeenCalledWith({
        where: { id: 'region-1' },
        data: { name: 'Dakar Modifié' },
      });
      expect(res.json).toHaveBeenCalledWith(mockUpdatedRegion);
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.params.id = 'region-1';
      req.body.name = 'Dakar Modifié';
      const error = new Error('Erreur base de données');
      prisma.region.findUnique.mockRejectedValue(error);

      await updateRegion(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteRegion()', () => {
    beforeEach(() => {
      // Mock de la transaction avec toutes les données nécessaires
      prisma.region.findUnique = jest.fn();
      prisma.commune.findMany = jest.fn();
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
    });

    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'region-1';

      await deleteRegion(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('devrait supprimer une région avec toutes ses données liées', async () => {
      req.params.id = 'region-1';
      req.user = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        role: 'NATIONAL',
      };

      // Mock des données de cascade
      const mockRegion = { id: 'region-1', name: 'Dakar' };
      const mockCommunes = [{ id: 'commune-1', name: 'Commune 1' }];
      const mockDistricts = [{ id: 'district-1', name: 'District 1' }];
      const mockHealthCenters = [{ id: 'hc-1', name: 'HC 1' }];
      const mockChildren = [{ id: 'child-1', firstName: 'John', lastName: 'Doe' }];
      const mockUsers = [{ id: 'user-1', firstName: 'User', lastName: '1', role: 'AGENT' }];
      const mockStockLots = [{ id: 'lot-1', ownerType: OWNER_TYPES.REGIONAL, ownerId: 'region-1', vaccineId: 'vaccine-1' }];
      const mockPendingTransfers = [{ id: 'transfer-1', status: 'PENDING' }];

      const cascadeData = {
        region: mockRegion,
        communes: mockCommunes,
        districts: mockDistricts,
        healthCenters: mockHealthCenters,
        children: mockChildren,
        users: mockUsers,
        childIds: ['child-1'],
        healthCenterIds: ['hc-1'],
        districtIds: ['district-1'],
        communeIds: ['commune-1'],
        childVaccinationCounts: {
          scheduled: 5,
          due: 3,
          late: 2,
          overdue: 1,
          completed: 10,
        },
        stockReservationsCount: 2,
        recordCount: 5,
        stockLots: mockStockLots,
        lotIds: ['lot-1'],
        lotConditions: [{ ownerType: OWNER_TYPES.REGIONAL, ownerId: 'region-1' }],
        pendingTransfers: mockPendingTransfers,
        pendingTransferIds: ['transfer-1'],
      };

      prisma.region.findUnique.mockResolvedValue(mockRegion);
      
      // Mock pour la première transaction (collectRegionCascadeData pour logging)
      prisma.$transaction.mockImplementationOnce(async (callback) => {
        const mockTx = {
          region: { findUnique: jest.fn().mockResolvedValue(mockRegion) },
          commune: { findMany: jest.fn().mockResolvedValue(mockCommunes) },
          district: { findMany: jest.fn().mockResolvedValue(mockDistricts) },
          healthCenter: { findMany: jest.fn().mockResolvedValue(mockHealthCenters) },
          children: { findMany: jest.fn().mockResolvedValue(mockChildren) },
          user: { findMany: jest.fn().mockResolvedValue(mockUsers) },
          childVaccineScheduled: { count: jest.fn().mockResolvedValue(5) },
          childVaccineDue: { count: jest.fn().mockResolvedValue(3) },
          childVaccineLate: { count: jest.fn().mockResolvedValue(2) },
          childVaccineOverdue: { count: jest.fn().mockResolvedValue(1) },
          childVaccineCompleted: { count: jest.fn().mockResolvedValue(10) },
          stockReservation: { count: jest.fn().mockResolvedValue(2) },
          record: { count: jest.fn().mockResolvedValue(5) },
          stockLot: { findMany: jest.fn().mockResolvedValue(mockStockLots) },
          pendingStockTransfer: { findMany: jest.fn().mockResolvedValue(mockPendingTransfers) },
        };
        return await callback(mockTx);
      });

      // Mock pour la deuxième transaction (suppression)
      prisma.$transaction.mockImplementationOnce(async (callback) => {
        const mockTx = {
          region: { findUnique: jest.fn().mockResolvedValue(mockRegion), delete: jest.fn().mockResolvedValue(mockRegion) },
          commune: { findMany: jest.fn().mockResolvedValue(mockCommunes), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          district: { findMany: jest.fn().mockResolvedValue(mockDistricts), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          healthCenter: { findMany: jest.fn().mockResolvedValue(mockHealthCenters), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          children: { findMany: jest.fn().mockResolvedValue(mockChildren), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          user: { findMany: jest.fn().mockResolvedValue(mockUsers), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          childVaccineScheduled: { count: jest.fn().mockResolvedValue(5), deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
          childVaccineDue: { count: jest.fn().mockResolvedValue(3), deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
          childVaccineLate: { count: jest.fn().mockResolvedValue(2), deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
          childVaccineOverdue: { count: jest.fn().mockResolvedValue(1), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          childVaccineCompleted: { count: jest.fn().mockResolvedValue(10), deleteMany: jest.fn().mockResolvedValue({ count: 10 }) },
          stockReservation: { count: jest.fn().mockResolvedValue(2), deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
          record: { count: jest.fn().mockResolvedValue(5), deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
          stockLot: { findMany: jest.fn().mockResolvedValue(mockStockLots), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          pendingStockTransfer: { findMany: jest.fn().mockResolvedValue(mockPendingTransfers), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          pendingStockTransferLot: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          stockTransferLot: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          stockHEALTHCENTER: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          stockDISTRICT: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          stockREGIONAL: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          vaccineRequest: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        };
        return await callback(mockTx);
      });

      await deleteRegion(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait gérer le cas où la région n\'a pas de données liées', async () => {
      req.params.id = 'region-1';
      req.user = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        role: 'NATIONAL',
      };

      const mockRegion = { id: 'region-1', name: 'Dakar' };

      prisma.region.findUnique.mockResolvedValue(mockRegion);

      const emptyCascadeData = {
        region: mockRegion,
        communes: [],
        districts: [],
        healthCenters: [],
        children: [],
        users: [],
        childIds: [],
        healthCenterIds: [],
        districtIds: [],
        communeIds: [],
        childVaccinationCounts: {
          scheduled: 0,
          due: 0,
          late: 0,
          overdue: 0,
          completed: 0,
        },
        stockReservationsCount: 0,
        recordCount: 0,
        stockLots: [],
        lotIds: [],
        lotConditions: [],
        pendingTransfers: [],
        pendingTransferIds: [],
      };

      // Mock pour la première transaction (collectRegionCascadeData pour logging)
      prisma.$transaction.mockImplementationOnce(async (callback) => {
        const mockTx = {
          region: { findUnique: jest.fn().mockResolvedValue(mockRegion) },
          commune: { findMany: jest.fn().mockResolvedValue([]) },
          district: { findMany: jest.fn().mockResolvedValue([]) },
          healthCenter: { findMany: jest.fn().mockResolvedValue([]) },
          children: { findMany: jest.fn().mockResolvedValue([]) },
          user: { findMany: jest.fn().mockResolvedValue([]) },
          childVaccineScheduled: { count: jest.fn().mockResolvedValue(0) },
          childVaccineDue: { count: jest.fn().mockResolvedValue(0) },
          childVaccineLate: { count: jest.fn().mockResolvedValue(0) },
          childVaccineOverdue: { count: jest.fn().mockResolvedValue(0) },
          childVaccineCompleted: { count: jest.fn().mockResolvedValue(0) },
          stockReservation: { count: jest.fn().mockResolvedValue(0) },
          record: { count: jest.fn().mockResolvedValue(0) },
          stockLot: { findMany: jest.fn().mockResolvedValue([]) },
          pendingStockTransfer: { findMany: jest.fn().mockResolvedValue([]) },
        };
        return await callback(mockTx);
      });

      // Mock pour la deuxième transaction (suppression)
      prisma.$transaction.mockImplementationOnce(async (callback) => {
        const mockTx = {
          region: { findUnique: jest.fn().mockResolvedValue(mockRegion), delete: jest.fn().mockResolvedValue(mockRegion) },
          commune: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          district: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          healthCenter: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          children: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          user: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          childVaccineScheduled: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          childVaccineDue: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          childVaccineLate: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          childVaccineOverdue: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          childVaccineCompleted: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          stockReservation: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          record: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          stockLot: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          pendingStockTransfer: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          pendingStockTransferLot: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          stockTransferLot: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          stockHEALTHCENTER: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          stockDISTRICT: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          stockREGIONAL: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          vaccineRequest: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        };
        return await callback(mockTx);
      });

      await deleteRegion(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.params.id = 'region-1';
      req.user = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        role: 'NATIONAL',
      };
      
      const mockRegion = { id: 'region-1', name: 'Dakar' };
      prisma.region.findUnique.mockResolvedValue(mockRegion);
      
      const error = new Error('Erreur base de données');
      
      // Mock pour la première transaction (succès)
      prisma.$transaction.mockImplementationOnce(async (callback) => {
        const mockTx = {
          region: { findUnique: jest.fn().mockResolvedValue(mockRegion) },
          commune: { findMany: jest.fn().mockResolvedValue([]) },
          district: { findMany: jest.fn().mockResolvedValue([]) },
          healthCenter: { findMany: jest.fn().mockResolvedValue([]) },
          children: { findMany: jest.fn().mockResolvedValue([]) },
          user: { findMany: jest.fn().mockResolvedValue([]) },
          childVaccineScheduled: { count: jest.fn().mockResolvedValue(0) },
          childVaccineDue: { count: jest.fn().mockResolvedValue(0) },
          childVaccineLate: { count: jest.fn().mockResolvedValue(0) },
          childVaccineOverdue: { count: jest.fn().mockResolvedValue(0) },
          childVaccineCompleted: { count: jest.fn().mockResolvedValue(0) },
          stockReservation: { count: jest.fn().mockResolvedValue(0) },
          record: { count: jest.fn().mockResolvedValue(0) },
          stockLot: { findMany: jest.fn().mockResolvedValue([]) },
          pendingStockTransfer: { findMany: jest.fn().mockResolvedValue([]) },
        };
        return await callback(mockTx);
      });
      
      // Mock pour la deuxième transaction (erreur)
      prisma.$transaction.mockImplementationOnce(async () => {
        throw error;
      });

      await deleteRegion(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getRegionDeletionSummary()', () => {
    beforeEach(() => {
      prisma.region.findUnique = jest.fn();
      prisma.commune.findMany = jest.fn();
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
    });

    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'region-1';

      await getRegionDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('devrait retourner un résumé de suppression avec toutes les données', async () => {
      req.params.id = 'region-1';

      const mockRegion = { id: 'region-1', name: 'Dakar' };
      const mockCommunes = [{ id: 'commune-1', name: 'Commune 1' }];
      const mockDistricts = [{ id: 'district-1', name: 'District 1' }];
      const mockHealthCenters = [{ id: 'hc-1', name: 'HC 1' }];
      const mockChildren = [{ id: 'child-1', firstName: 'John', lastName: 'Doe' }];
      const mockUsers = [{ id: 'user-1', firstName: 'User', lastName: '1', role: 'AGENT' }];
      const mockStockLots = [{ id: 'lot-1', ownerType: OWNER_TYPES.REGIONAL, ownerId: 'region-1' }];
      const mockPendingTransfers = [{ id: 'transfer-1', status: 'PENDING' }];

      // Mock de la transaction qui retourne les données de cascade
      const mockCascadeData = {
        region: mockRegion,
        communes: mockCommunes,
        districts: mockDistricts,
        healthCenters: mockHealthCenters,
        children: mockChildren,
        users: mockUsers,
        childIds: ['child-1'],
        healthCenterIds: ['hc-1'],
        districtIds: ['district-1'],
        communeIds: ['commune-1'],
        childVaccinationCounts: {
          scheduled: 5,
          due: 3,
          late: 2,
          overdue: 1,
          completed: 10,
        },
        stockReservationsCount: 2,
        recordCount: 5,
        stockLots: mockStockLots,
        lotIds: ['lot-1'],
        lotConditions: [],
        pendingTransfers: mockPendingTransfers,
        pendingTransferIds: ['transfer-1'],
      };

      prisma.$transaction.mockResolvedValue(mockCascadeData);

      await getRegionDeletionSummary(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        region: mockRegion,
        totals: {
          communes: 1,
          districts: 1,
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
          communes: mockCommunes,
          districts: mockDistricts,
          healthCenters: mockHealthCenters,
          children: mockChildren,
          users: mockUsers,
          stockLots: mockStockLots,
          pendingTransfers: mockPendingTransfers,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait retourner 404 si région non trouvée', async () => {
      req.params.id = 'region-1';
      const error = new Error('Région non trouvée');
      error.status = 404;
      
      // Mock de la transaction qui lance l'erreur
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          region: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        try {
          return await callback(mockTx);
        } catch (err) {
          throw err;
        }
      });

      await getRegionDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Région non trouvée' });
    });

    it('devrait appeler next en cas d\'erreur non gérée', async () => {
      req.params.id = 'region-1';
      const error = new Error('Erreur base de données');
      prisma.$transaction.mockRejectedValue(error);

      await getRegionDeletionSummary(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

