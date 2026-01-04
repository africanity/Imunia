// tests/unit/stockController.test.js

const {
  createStockNATIONAL,
  createStockREGIONAL,
  createStockDISTRICT,
  createStockHEALTHCENTER,
  addStockNATIONAL,
  addStockREGIONAL,
  addStockDISTRICT,
  addStockHEALTHCENTER,
  updateStockNATIONAL,
  updateStockREGIONAL,
  updateStockDISTRICT,
  updateStockHEALTHCENTER,
  reduceStockNATIONAL,
  reduceStockREGIONAL,
  reduceStockDISTRICT,
  reduceStockHEALTHCENTER,
  deleteStockNATIONAL,
  deleteStockREGIONAL,
  deleteStockDISTRICT,
  deleteStockHEALTHCENTER,
  getStockNATIONAL,
  getStockREGIONAL,
  getStockDISTRICT,
  getStockHEALTHCENTER,
  listNationalLots,
  listRegionalLots,
  listDistrictLots,
  listHealthCenterLots,
  reduceLotNATIONAL,
  reduceLotREGIONAL,
  reduceLotDISTRICT,
  reduceLotHEALTHCENTER,
  deleteLot,
  getNationalStockStats,
  getRegionalStockStats,
  getDistrictStockStats,
  getHealthCenterStockStats,
  getHealthCenterReservations,
  getPendingTransfers,
  confirmPendingTransfer,
} = require('../../src/controllers/stockController');

const prisma = require('../../src/config/prismaClient');
const stockLotService = require('../../src/services/stockLotService');
const emailService = require('../../src/services/emailService');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  StockNATIONAL: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  StockREGIONAL: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  StockDISTRICT: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  StockHEALTHCENTER: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  stockNATIONAL: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  stockREGIONAL: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  stockDISTRICT: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  stockHEALTHCENTER: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  stockLot: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  stockReservation: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  pendingStockTransfer: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  pendingStockTransferLot: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  district: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  commune: {
    findUnique: jest.fn(),
  },
  healthCenter: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  region: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((callback) => {
    const mockPrisma = require('../../src/config/prismaClient');
    const mockTx = {
      StockNATIONAL: mockPrisma.StockNATIONAL,
      StockREGIONAL: mockPrisma.StockREGIONAL,
      StockDISTRICT: mockPrisma.StockDISTRICT,
      StockHEALTHCENTER: mockPrisma.StockHEALTHCENTER,
      stockNATIONAL: mockPrisma.stockNATIONAL,
      stockREGIONAL: mockPrisma.stockREGIONAL,
      stockDISTRICT: mockPrisma.stockDISTRICT,
      stockHEALTHCENTER: mockPrisma.stockHEALTHCENTER,
      stockLot: mockPrisma.stockLot,
      stockReservation: mockPrisma.stockReservation,
      pendingStockTransfer: mockPrisma.pendingStockTransfer,
      pendingStockTransferLot: mockPrisma.pendingStockTransferLot,
      user: mockPrisma.user,
      district: mockPrisma.district,
      commune: mockPrisma.commune,
      healthCenter: mockPrisma.healthCenter,
      region: mockPrisma.region,
    };
    return callback(mockTx);
  }),
}));

jest.mock('../../src/services/stockLotService', () => ({
  OWNER_TYPES: {
    NATIONAL: 'NATIONAL',
    REGIONAL: 'REGIONAL',
    DISTRICT: 'DISTRICT',
    HEALTHCENTER: 'HEALTHCENTER',
  },
  LOT_STATUS: {
    VALID: 'VALID',
    EXPIRED: 'EXPIRED',
    PENDING: 'PENDING',
  },
  deleteLotDirect: jest.fn(),
  createLot: jest.fn(),
  consumeLots: jest.fn(),
  recordTransfer: jest.fn(),
  deleteLotCascade: jest.fn(),
  updateNearestExpiration: jest.fn(),
}));

jest.mock('../../src/services/emailService', () => ({
  sendStockTransferNotificationEmail: jest.fn(),
}));

describe('stockController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: {
        id: 'user-1',
        role: 'NATIONAL',
        regionId: 'region-1',
        districtId: 'district-1',
        healthCenterId: 'healthcenter-1',
        agentLevel: 'ADMIN',
      },
      body: {},
      params: {},
      query: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('createStockNATIONAL', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await createStockNATIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait créer un stock national avec succès', async () => {
      req.body.vaccineId = 'vaccine-1';
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1' };
      prisma.StockNATIONAL.create.mockResolvedValue(mockStock);

      await createStockNATIONAL(req, res, next);

      expect(prisma.StockNATIONAL.create).toHaveBeenCalledWith({
        data: { vaccineId: 'vaccine-1' },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockStock);
    });

    it('devrait gérer les erreurs de base de données', async () => {
      req.body.vaccineId = 'vaccine-1';
      const error = new Error('Erreur DB');
      prisma.StockNATIONAL.create.mockRejectedValue(error);

      await createStockNATIONAL(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('createStockREGIONAL', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'DISTRICT';
      await createStockREGIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait créer un stock régional avec succès (NATIONAL)', async () => {
      req.body.vaccineId = 'vaccine-1';
      req.body.regionId = 'region-1';
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', regionId: 'region-1' };
      prisma.StockREGIONAL.create.mockResolvedValue(mockStock);

      await createStockREGIONAL(req, res, next);

      expect(prisma.StockREGIONAL.create).toHaveBeenCalledWith({
        data: { vaccineId: 'vaccine-1', regionId: 'region-1' },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockStock);
    });

    it('devrait créer un stock régional avec succès (REGIONAL)', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.body.vaccineId = 'vaccine-1';
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', regionId: 'region-1' };
      prisma.StockREGIONAL.create.mockResolvedValue(mockStock);

      await createStockREGIONAL(req, res, next);

      expect(prisma.StockREGIONAL.create).toHaveBeenCalledWith({
        data: { vaccineId: 'vaccine-1', regionId: 'region-1' },
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait retourner 400 si vaccineId manquant', async () => {
      req.body.regionId = 'region-1';
      await createStockREGIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'vaccineId est requis pour créer un stock régional',
      });
    });

    it('devrait retourner 400 si regionId manquant pour NATIONAL', async () => {
      req.body.vaccineId = 'vaccine-1';
      await createStockREGIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'regionId est requis pour créer un stock régional',
      });
    });
  });

  describe('createStockDISTRICT', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL ou DISTRICT', async () => {
      req.user.role = 'NATIONAL';
      await createStockDISTRICT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait créer un stock district avec succès (REGIONAL)', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.districtId = 'district-1';
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.district.findUnique.mockResolvedValue({
        id: 'district-1',
        commune: { regionId: 'region-1' },
      });
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', districtId: 'district-1' };
      prisma.StockDISTRICT.create.mockResolvedValue(mockStock);

      await createStockDISTRICT(req, res, next);

      expect(prisma.StockDISTRICT.create).toHaveBeenCalledWith({
        data: { vaccineId: 'vaccine-1', districtId: 'district-1' },
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait retourner 400 si vaccineId ou districtId manquant', async () => {
      req.user.role = 'REGIONAL';
      await createStockDISTRICT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'vaccineId et districtId sont requis',
      });
    });
  });

  describe('createStockHEALTHCENTER', () => {
    it('devrait retourner 403 si utilisateur n\'est pas DISTRICT ou AGENT', async () => {
      req.user.role = 'NATIONAL';
      await createStockHEALTHCENTER(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait créer un stock health center avec succès (AGENT ADMIN)', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.body.vaccineId = 'vaccine-1';
      prisma.user.findUnique.mockResolvedValue({ healthCenterId: 'healthcenter-1' });
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', healthCenterId: 'healthcenter-1' };
      prisma.StockHEALTHCENTER.create.mockResolvedValue(mockStock);

      await createStockHEALTHCENTER(req, res, next);

      expect(prisma.StockHEALTHCENTER.create).toHaveBeenCalledWith({
        data: { vaccineId: 'vaccine-1', healthCenterId: 'healthcenter-1' },
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait retourner 403 si agent n\'est pas ADMIN', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'STAFF';
      req.body.vaccineId = 'vaccine-1';
      await createStockHEALTHCENTER(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });
  });

  describe('addStockNATIONAL', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await addStockNATIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait ajouter du stock national avec succès', async () => {
      req.body.vaccineId = 'vaccine-1';
      req.body.quantity = 100;
      req.body.expiration = '2025-12-31';
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', quantity: 100 };
      const mockLot = { id: 'lot-1', quantity: 100 };
      prisma.stockNATIONAL.findUnique.mockResolvedValue({ id: 'stock-1', quantity: 0 });
      prisma.stockNATIONAL.update.mockResolvedValue(mockStock);
      stockLotService.createLot.mockResolvedValue(mockLot);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockNATIONAL: {
            findUnique: prisma.stockNATIONAL.findUnique,
            update: prisma.stockNATIONAL.update,
          },
        };
        return callback(mockTx);
      });

      await addStockNATIONAL(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.stock).toBeDefined();
      expect(response.lot).toBeDefined();
    });

    it('devrait retourner 400 si quantity invalide', async () => {
      req.body.vaccineId = 'vaccine-1';
      req.body.quantity = -10;
      await addStockNATIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 400 si expiration manquante', async () => {
      req.body.vaccineId = 'vaccine-1';
      req.body.quantity = 100;
      await addStockNATIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 404 si stock national introuvable', async () => {
      req.body.vaccineId = 'vaccine-1';
      req.body.quantity = 100;
      req.body.expiration = '2025-12-31';
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockNATIONAL: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(mockTx);
      });

      await addStockNATIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('addStockREGIONAL', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await addStockREGIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait ajouter du stock régional avec succès', async () => {
      req.body.vaccineId = 'vaccine-1';
      req.body.regionId = 'region-1';
      req.body.quantity = 100;
      req.user.role = 'NATIONAL';
      
      const mockRegionalStock = { 
        id: 'stock-1', 
        vaccineId: 'vaccine-1', 
        regionId: 'region-1', 
        quantity: 0, 
        region: { name: 'Dakar' }, 
        vaccine: { name: 'BCG' } 
      };
      const mockNationalStock = { 
        id: 'stock-1', 
        vaccineId: 'vaccine-1', 
        quantity: 200,
        vaccine: { name: 'BCG' }
      };
      const mockAllocations = [{ lotId: 'lot-1', quantity: 100 }];
      const mockFirstLot = { id: 'lot-1', expiration: new Date('2025-12-31') };
      const mockPendingTransfer = { 
        id: 'transfer-1',
        vaccine: { name: 'BCG' },
        lots: [{ lot: { id: 'lot-1' } }],
      };
      const mockUpdatedNational = { 
        id: 'stock-1', 
        vaccineId: 'vaccine-1', 
        quantity: 100,
        vaccine: { name: 'BCG' }
      };

      stockLotService.consumeLots.mockResolvedValue([{ lotId: 'lot-1', quantity: 100 }]);
      stockLotService.createLot.mockResolvedValue({ id: 'pending-lot-1' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockREGIONAL: {
            findUnique: jest.fn().mockResolvedValue(mockRegionalStock),
            create: jest.fn().mockResolvedValue(mockRegionalStock),
          },
          stockNATIONAL: {
            findUnique: jest.fn()
              .mockResolvedValueOnce(mockNationalStock) // Vérification quantité
              .mockResolvedValueOnce(mockUpdatedNational), // Récupération après update
            update: jest.fn().mockResolvedValue({ ...mockNationalStock, quantity: 100 }),
          },
          stockLot: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ remainingQuantity: 0, quantity: 0 }) // Vérification lot vide
              .mockResolvedValueOnce(mockFirstLot), // Récupération expiration
            delete: jest.fn().mockResolvedValue({}),
          },
          pendingStockTransfer: {
            create: jest.fn().mockResolvedValue(mockPendingTransfer),
          },
        };
        return callback(mockTx);
      });

      await addStockREGIONAL(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          national: expect.any(Object),
          pendingTransfer: expect.any(Object),
          message: expect.any(String),
        })
      );
    });

    it('devrait retourner 400 si quantité insuffisante dans stock national', async () => {
      req.body.vaccineId = 'vaccine-1';
      req.body.regionId = 'region-1';
      req.body.quantity = 100;
      const mockRegionalStock = { id: 'stock-1', vaccineId: 'vaccine-1', regionId: 'region-1', quantity: 100, region: { name: 'Dakar' }, vaccine: { name: 'BCG' } };
      const mockNationalStock = { id: 'stock-1', vaccineId: 'vaccine-1', quantity: 50 };
      prisma.stockREGIONAL.findUnique.mockResolvedValue(mockRegionalStock);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockREGIONAL: {
            findUnique: prisma.stockREGIONAL.findUnique,
          },
          stockNATIONAL: {
            findUnique: jest.fn().mockResolvedValue(mockNationalStock),
          },
        };
        // La transaction doit lancer une erreur avec status 400
        const error = Object.assign(new Error('Quantité insuffisante dans le stock national'), { status: 400 });
        throw error;
      });

      await addStockREGIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Quantité insuffisante dans le stock national',
      });
    });
  });

  describe('updateStockNATIONAL', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await updateStockNATIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait mettre à jour le stock national avec succès', async () => {
      req.body.vaccineId = 'vaccine-1';
      req.body.quantity = 200;
      req.body.expiration = '2025-12-31';
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', quantity: 200 };
      prisma.stockNATIONAL.findUnique.mockResolvedValue({ id: 'stock-1', quantity: 100 });
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockNATIONAL: {
            findUnique: prisma.stockNATIONAL.findUnique,
            update: jest.fn().mockResolvedValue(mockStock),
          },
        };
        stockLotService.createLot.mockResolvedValue({ id: 'lot-1' });
        stockLotService.updateNearestExpiration.mockResolvedValue();
        return callback(mockTx);
      });

      await updateStockNATIONAL(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 404 si stock national introuvable', async () => {
      req.body.vaccineId = 'vaccine-1';
      req.body.quantity = 200;
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockNATIONAL: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(mockTx);
      });

      await updateStockNATIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteStockNATIONAL', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await deleteStockNATIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait supprimer le stock national avec succès', async () => {
      req.body.vaccineId = 'vaccine-1';
      prisma.stockNATIONAL.findUnique.mockResolvedValue({ id: 'stock-1', vaccineId: 'vaccine-1' });
      prisma.stockLot.findMany.mockResolvedValue([{ id: 'lot-1' }]);
      stockLotService.deleteLotDirect.mockResolvedValue('lot-1');
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockNATIONAL: {
            findUnique: jest.fn().mockResolvedValue({ id: 'stock-1', vaccineId: 'vaccine-1' }),
            delete: jest.fn().mockResolvedValue({}),
          },
          stockLot: {
            findMany: jest.fn().mockResolvedValue([{ id: 'lot-1' }]),
          },
        };
        return callback(mockTx);
      });

      await deleteStockNATIONAL(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('devrait retourner 400 si vaccineId manquant', async () => {
      await deleteStockNATIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getStockNATIONAL', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await getStockNATIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner la liste des stocks nationaux avec succès', async () => {
      const mockStocks = [
        { id: 'stock-1', vaccineId: 'vaccine-1', vaccine: { name: 'BCG' } },
      ];
      prisma.stockNATIONAL.findMany.mockResolvedValue(mockStocks);
      prisma.stockLot.findMany.mockResolvedValue([]);

      await getStockNATIONAL(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.national).toBeDefined();
    });
  });

  describe('listNationalLots', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await listNationalLots(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner la liste des lots nationaux avec succès', async () => {
      req.params.vaccineId = 'vaccine-1';
      const mockLots = [
        { id: 'lot-1', vaccineId: 'vaccine-1', quantity: 100, remainingQuantity: 100, expiration: new Date(), status: 'VALID', _count: { derivedLots: 0 } },
      ];
      prisma.stockLot.findMany.mockResolvedValue(mockLots);

      await listNationalLots(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.lots).toBeDefined();
      expect(response.totalRemaining).toBeDefined();
    });

    it('devrait retourner 400 si vaccineId manquant', async () => {
      await listNationalLots(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('reduceLotNATIONAL', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      req.user = { role: 'NATIONAL', id: 'user-1' };
      req.params = {};
      req.body = {};
    });

    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou SUPERADMIN', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      await reduceLotNATIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait réduire la quantité d\'un lot avec succès', async () => {
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      
      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'NATIONAL',
        ownerId: null,
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      const mockUpdatedLot = {
        ...mockLot,
        remainingQuantity: 90,
      };

      const mockAllLots = [
        { remainingQuantity: 90 },
        { remainingQuantity: 50 },
      ];

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
            findMany: jest.fn().mockResolvedValue(mockAllLots),
            update: jest.fn().mockResolvedValue(mockUpdatedLot),
          },
          stockNATIONAL: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        stockLotService.updateNearestExpiration.mockResolvedValue();
        return callback(mockTx);
      });

      await reduceLotNATIONAL(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.remainingQuantity).toBe(90);
    });

    it('devrait recalculer la quantité totale du stock après réduction', async () => {
      req.params.id = 'lot-1';
      req.body.quantity = 20;
      
      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'NATIONAL',
        ownerId: null,
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      const mockAllLots = [
        { remainingQuantity: 80 }, // lot-1 après réduction
        { remainingQuantity: 50 }, // autre lot
      ];

      let stockUpdateCalled = false;
      let stockUpdateQuantity = null;

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
            findMany: jest.fn().mockResolvedValue(mockAllLots),
            update: jest.fn().mockResolvedValue({ ...mockLot, remainingQuantity: 80 }),
          },
          stockNATIONAL: {
            update: jest.fn().mockImplementation(async (args) => {
              stockUpdateCalled = true;
              stockUpdateQuantity = args.data.quantity;
              return {};
            }),
          },
        };
        stockLotService.updateNearestExpiration.mockResolvedValue();
        return callback(mockTx);
      });

      await reduceLotNATIONAL(req, res, next);

      expect(stockUpdateCalled).toBe(true);
      expect(stockUpdateQuantity).toBe(130); // 80 + 50
    });

    it('devrait appeler updateNearestExpiration après réduction', async () => {
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      
      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'NATIONAL',
        ownerId: null,
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      const mockAllLots = [{ remainingQuantity: 90 }];

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
            findMany: jest.fn().mockResolvedValue(mockAllLots),
            update: jest.fn().mockResolvedValue({ ...mockLot, remainingQuantity: 90 }),
          },
          stockNATIONAL: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        stockLotService.updateNearestExpiration.mockResolvedValue();
        return callback(mockTx);
      });

      await reduceLotNATIONAL(req, res, next);

      expect(stockLotService.updateNearestExpiration).toHaveBeenCalledWith(
        expect.any(Object), // mockTx
        expect.objectContaining({
          vaccineId: 'vaccine-1',
          ownerType: 'NATIONAL',
          ownerId: null,
        })
      );
    });

    it('devrait retourner 404 si lot introuvable', async () => {
      req.params.id = 'lot-inexistant';
      req.body.quantity = 10;

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(mockTx);
      });

      await reduceLotNATIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Lot introuvable' });
    });

    it('devrait retourner 400 si quantité supérieure à la quantité restante du lot', async () => {
      req.params.id = 'lot-1';
      req.body.quantity = 150; // Supérieur à remainingQuantity

      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'NATIONAL',
        ownerId: null,
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
          },
        };
        return callback(mockTx);
      });

      await reduceLotNATIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.stringContaining('dépasse la quantité restante'),
      });
    });

    it('devrait retourner 403 si le lot n\'appartient pas au stock national', async () => {
      req.params.id = 'lot-1';
      req.body.quantity = 10;

      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'REGIONAL', // Pas NATIONAL
        ownerId: 'region-1',
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
          },
        };
        return callback(mockTx);
      });

      await reduceLotNATIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Ce lot n'appartient pas au stock national",
      });
    });

    it('devrait retourner 400 si lotId manquant', async () => {
      req.params.id = undefined;
      req.body.quantity = 10;

      await reduceLotNATIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'lotId est requis' });
    });

    it('devrait retourner 400 si quantity manquant ou invalide', async () => {
      req.params.id = 'lot-1';
      req.body.quantity = undefined;

      await reduceLotNATIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'quantity doit être un nombre positif',
      });
    });

    it('devrait retourner 400 si quantity est négatif', async () => {
      req.params.id = 'lot-1';
      req.body.quantity = -10;

      await reduceLotNATIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'quantity doit être un nombre positif',
      });
    });

    it('devrait retourner 400 si quantity est zéro', async () => {
      req.params.id = 'lot-1';
      req.body.quantity = 0;

      await reduceLotNATIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'quantity doit être un nombre positif',
      });
    });

    it('devrait gérer plusieurs lots et recalculer correctement la quantité totale', async () => {
      req.params.id = 'lot-1';
      req.body.quantity = 30;
      
      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'NATIONAL',
        ownerId: null,
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      const mockAllLots = [
        { remainingQuantity: 70 }, // lot-1 après réduction de 30
        { remainingQuantity: 50 }, // lot-2
        { remainingQuantity: 25 }, // lot-3
      ];

      let stockUpdateQuantity = null;

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
            findMany: jest.fn().mockResolvedValue(mockAllLots),
            update: jest.fn().mockResolvedValue({ ...mockLot, remainingQuantity: 70 }),
          },
          stockNATIONAL: {
            update: jest.fn().mockImplementation(async (args) => {
              stockUpdateQuantity = args.data.quantity;
              return {};
            }),
          },
        };
        stockLotService.updateNearestExpiration.mockResolvedValue();
        return callback(mockTx);
      });

      await reduceLotNATIONAL(req, res, next);

      expect(stockUpdateQuantity).toBe(145); // 70 + 50 + 25
    });
  });

  describe('getNationalStockStats', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await getNationalStockStats(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner les statistiques du stock national avec succès', async () => {
      prisma.stockNATIONAL.aggregate.mockResolvedValue({
        _sum: { quantity: 1000 },
        _count: { _all: 5 },
      });
      prisma.stockNATIONAL.count.mockResolvedValue(2);
      prisma.stockLot.count.mockResolvedValue(1);

      await getNationalStockStats(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.totalLots).toBe(5);
      expect(response.totalQuantity).toBe(1000);
      expect(response.lowStockCount).toBe(2);
      expect(response.expiredLots).toBe(1);
    });
  });

  describe('deleteLot', () => {
    it('devrait retourner 403 si utilisateur n\'est pas autorisé', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'STAFF'; // STAFF ne peut pas supprimer
      req.params.id = 'lot-1';
      await deleteLot(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait supprimer un lot avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'lot-1';
      const mockLot = { 
        id: 'lot-1', 
        ownerType: 'NATIONAL', 
        ownerId: null,
        status: 'ACTIVE',
        expiration: new Date('2025-12-31')
      };
      stockLotService.deleteLotDirect.mockResolvedValue('lot-1');
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
          },
        };
        return callback(mockTx);
      });

      await deleteLot(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.deletedId).toEqual('lot-1');
    });

    it('devrait retourner 404 si lot introuvable', async () => {
      req.params.id = 'lot-1';
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(mockTx);
      });

      await deleteLot(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('reduceLotREGIONAL', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      req.user = { role: 'REGIONAL', id: 'user-1', regionId: 'region-1' };
      req.params = {};
      req.body = {};
    });

    it('devrait retourner 403 si utilisateur n\'est pas SUPERADMIN, NATIONAL ou REGIONAL', async () => {
      req.user.role = 'DISTRICT';
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      await reduceLotREGIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait réduire la quantité d\'un lot régional avec succès (REGIONAL)', async () => {
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      
      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'REGIONAL',
        ownerId: 'region-1',
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      const mockUpdatedLot = {
        ...mockLot,
        remainingQuantity: 90,
      };

      const mockAllLots = [
        { remainingQuantity: 90 },
        { remainingQuantity: 50 },
      ];

      prisma.user.findUnique = jest.fn().mockResolvedValue({ regionId: 'region-1' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
            findMany: jest.fn().mockResolvedValue(mockAllLots),
            update: jest.fn().mockResolvedValue(mockUpdatedLot),
          },
          stockREGIONAL: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        stockLotService.updateNearestExpiration.mockResolvedValue();
        return callback(mockTx);
      });

      await reduceLotREGIONAL(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.remainingQuantity).toBe(90);
    });

    it('devrait permettre à SUPERADMIN de réduire un lot régional', async () => {
      req.user.role = 'SUPERADMIN';
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      
      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'REGIONAL',
        ownerId: 'region-1',
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      const mockAllLots = [{ remainingQuantity: 90 }];

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
            findMany: jest.fn().mockResolvedValue(mockAllLots),
            update: jest.fn().mockResolvedValue({ ...mockLot, remainingQuantity: 90 }),
          },
          stockREGIONAL: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        stockLotService.updateNearestExpiration.mockResolvedValue();
        return callback(mockTx);
      });

      await reduceLotREGIONAL(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 403 si REGIONAL essaie de réduire un lot d\'une autre région', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      
      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'REGIONAL',
        ownerId: 'region-2', // Autre région
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      prisma.user.findUnique = jest.fn().mockResolvedValue({ regionId: 'region-1' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
          },
        };
        return callback(mockTx);
      });

      await reduceLotREGIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé pour cette région',
      });
    });

    it('devrait retourner 403 si le lot n\'appartient pas au stock régional', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'lot-1';
      req.body.quantity = 10;

      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'NATIONAL', // Pas REGIONAL
        ownerId: null,
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
          },
        };
        return callback(mockTx);
      });

      await reduceLotREGIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Ce lot n'appartient pas à une région",
      });
    });
  });

  describe('reduceLotDISTRICT', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      req.user = { role: 'DISTRICT', id: 'user-1', districtId: 'district-1' };
      req.params = {};
      req.body = {};
    });

    it('devrait retourner 403 si utilisateur n\'est pas SUPERADMIN, REGIONAL ou DISTRICT', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      await reduceLotDISTRICT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait réduire la quantité d\'un lot district avec succès (DISTRICT)', async () => {
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      
      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'DISTRICT',
        ownerId: 'district-1',
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      const mockAllLots = [{ remainingQuantity: 90 }];

      prisma.user.findUnique = jest.fn().mockResolvedValue({ districtId: 'district-1' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
            findMany: jest.fn().mockResolvedValue(mockAllLots),
            update: jest.fn().mockResolvedValue({ ...mockLot, remainingQuantity: 90 }),
          },
          stockDISTRICT: {
            update: jest.fn().mockResolvedValue({}),
          },
          district: {
            findUnique: jest.fn().mockResolvedValue({ commune: { regionId: 'region-1' } }),
          },
        };
        stockLotService.updateNearestExpiration.mockResolvedValue();
        return callback(mockTx);
      });

      await reduceLotDISTRICT(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait permettre à SUPERADMIN de réduire un lot district', async () => {
      req.user.role = 'SUPERADMIN';
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      
      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'DISTRICT',
        ownerId: 'district-1',
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      const mockAllLots = [{ remainingQuantity: 90 }];

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
            findMany: jest.fn().mockResolvedValue(mockAllLots),
            update: jest.fn().mockResolvedValue({ ...mockLot, remainingQuantity: 90 }),
          },
          stockDISTRICT: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        stockLotService.updateNearestExpiration.mockResolvedValue();
        return callback(mockTx);
      });

      await reduceLotDISTRICT(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 403 si le lot n\'appartient pas au stock district', async () => {
      req.user.role = 'DISTRICT';
      req.params.id = 'lot-1';
      req.body.quantity = 10;

      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'REGIONAL', // Pas DISTRICT
        ownerId: 'region-1',
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
          },
        };
        return callback(mockTx);
      });

      await reduceLotDISTRICT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Ce lot n'appartient pas à un district",
      });
    });
  });

  describe('reduceLotHEALTHCENTER', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      req.user = { role: 'AGENT', id: 'user-1', agentLevel: 'ADMIN', healthCenterId: 'healthcenter-1' };
      req.params = {};
      req.body = {};
    });

    it('devrait retourner 403 si utilisateur n\'est pas SUPERADMIN, DISTRICT ou AGENT', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      await reduceLotHEALTHCENTER(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner 403 si AGENT n\'est pas ADMIN', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'STAFF';
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      await reduceLotHEALTHCENTER(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait réduire la quantité d\'un lot health center avec succès (AGENT ADMIN)', async () => {
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      
      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'HEALTHCENTER',
        ownerId: 'healthcenter-1',
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      const mockAllLots = [{ remainingQuantity: 90 }];

      prisma.user.findUnique = jest.fn().mockResolvedValue({ healthCenterId: 'healthcenter-1' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
            findMany: jest.fn().mockResolvedValue(mockAllLots),
            update: jest.fn().mockResolvedValue({ ...mockLot, remainingQuantity: 90 }),
          },
          stockHEALTHCENTER: {
            update: jest.fn().mockResolvedValue({}),
          },
          healthCenter: {
            findUnique: jest.fn().mockResolvedValue({ districtId: 'district-1' }),
          },
        };
        stockLotService.updateNearestExpiration.mockResolvedValue();
        return callback(mockTx);
      });

      await reduceLotHEALTHCENTER(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait permettre à SUPERADMIN de réduire un lot health center', async () => {
      req.user.role = 'SUPERADMIN';
      req.params.id = 'lot-1';
      req.body.quantity = 10;
      
      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'HEALTHCENTER',
        ownerId: 'healthcenter-1',
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      const mockAllLots = [{ remainingQuantity: 90 }];

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
            findMany: jest.fn().mockResolvedValue(mockAllLots),
            update: jest.fn().mockResolvedValue({ ...mockLot, remainingQuantity: 90 }),
          },
          stockHEALTHCENTER: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        stockLotService.updateNearestExpiration.mockResolvedValue();
        return callback(mockTx);
      });

      await reduceLotHEALTHCENTER(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 403 si le lot n\'appartient pas au stock health center', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.params.id = 'lot-1';
      req.body.quantity = 10;

      const mockLot = {
        id: 'lot-1',
        vaccineId: 'vaccine-1',
        ownerType: 'DISTRICT', // Pas HEALTHCENTER
        ownerId: 'district-1',
        remainingQuantity: 100,
        vaccine: { name: 'BCG' },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockLot: {
            findUnique: jest.fn().mockResolvedValue(mockLot),
          },
        };
        return callback(mockTx);
      });

      await reduceLotHEALTHCENTER(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Ce lot n'appartient pas à un centre de santé",
      });
    });
  });

  describe('getPendingTransfers', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL, DISTRICT ou AGENT', async () => {
      req.user.role = 'NATIONAL';
      await getPendingTransfers(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner les transferts en attente pour REGIONAL', async () => {
      req.user.role = 'REGIONAL';
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.pendingStockTransfer.findMany.mockResolvedValue([
        { id: 'transfer-1', status: 'PENDING' },
      ]);

      await getPendingTransfers(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.transfers).toBeDefined();
    });
  });

  describe('confirmPendingTransfer', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL, DISTRICT ou AGENT', async () => {
      req.user.role = 'NATIONAL';
      await confirmPendingTransfer(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait confirmer un transfert avec succès (REGIONAL)', async () => {
      req.user.role = 'REGIONAL';
      req.params.transferId = 'transfer-1';
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      const mockTransfer = {
        id: 'transfer-1',
        vaccineId: 'vaccine-1',
        toType: 'REGIONAL',
        toId: 'region-1',
        status: 'PENDING',
        quantity: 100,
        lots: [
          { lotId: 'lot-1', quantity: 100, lot: { id: 'lot-1', expiration: new Date('2025-12-31'), status: 'VALID' } },
        ],
        vaccine: { name: 'BCG' },
      };
      const mockPendingLot = {
        id: 'pending-lot-1',
        pendingTransferId: 'transfer-1',
        status: 'PENDING',
        ownerType: 'REGIONAL',
        ownerId: 'region-1',
        expiration: new Date('2025-12-31'),
      };
      const mockUpdatedStock = {
        id: 'stock-1',
        quantity: 100,
        vaccine: { name: 'BCG' },
        region: { name: 'Dakar' },
      };
      const mockConfirmedTransfer = {
        ...mockTransfer,
        confirmedBy: {
          id: req.user.id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
        },
      };
      stockLotService.recordTransfer.mockResolvedValue();
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pendingStockTransfer: {
            findUnique: jest.fn()
              .mockResolvedValueOnce(mockTransfer) // Premier appel pour vérifier
              .mockResolvedValueOnce(mockConfirmedTransfer), // Deuxième appel pour confirmedTransfer
            delete: jest.fn().mockResolvedValue({}),
          },
          stockREGIONAL: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ id: 'stock-1', quantity: 0 })
              .mockResolvedValueOnce(mockUpdatedStock),
            update: jest.fn().mockResolvedValue({ id: 'stock-1', quantity: 100 }),
            create: jest.fn().mockResolvedValue({ id: 'stock-1', quantity: 0 }),
          },
          stockLot: {
            findFirst: jest.fn().mockResolvedValue(mockPendingLot),
            update: jest.fn().mockResolvedValue({ ...mockPendingLot, status: 'VALID', quantity: 100 }),
          },
          stockTransferHistory: {
            create: jest.fn().mockResolvedValue({ id: 'history-1' }),
          },
          region: {
            findUnique: jest.fn().mockResolvedValue({ name: 'Dakar' }),
          },
        };
        return callback(mockTx);
      });

      await confirmPendingTransfer(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 404 si transfert introuvable', async () => {
      req.user.role = 'REGIONAL';
      req.params.transferId = 'transfer-1';
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pendingStockTransfer: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(mockTx);
      });

      await confirmPendingTransfer(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('devrait retourner 403 si transfert n\'appartient pas à l\'utilisateur', async () => {
      req.user.role = 'REGIONAL';
      req.params.transferId = 'transfer-1';
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      const mockTransfer = {
        id: 'transfer-1',
        toType: 'REGIONAL',
        toId: 'region-2', // Différent de region-1
        status: 'PENDING',
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          pendingStockTransfer: {
            findUnique: jest.fn().mockResolvedValue(mockTransfer),
          },
        };
        return callback(mockTx);
      });

      await confirmPendingTransfer(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('createStockDISTRICT', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL ou DISTRICT', async () => {
      req.user.role = 'NATIONAL';
      await createStockDISTRICT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait créer un stock district avec succès (REGIONAL)', async () => {
      req.user.role = 'REGIONAL';
      req.body.vaccineId = 'vaccine-1';
      req.body.districtId = 'district-1';
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.district.findUnique.mockResolvedValue({ 
        id: 'district-1',
        communeId: 'commune-1',
        commune: { regionId: 'region-1' }
      });
      prisma.StockDISTRICT.create.mockResolvedValue({ id: 'stock-1', vaccineId: 'vaccine-1', districtId: 'district-1' });

      await createStockDISTRICT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 400 si vaccineId ou districtId manquants', async () => {
      req.user.role = 'REGIONAL';
      req.body.vaccineId = 'vaccine-1';
      await createStockDISTRICT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createStockHEALTHCENTER', () => {
    it('devrait retourner 403 si utilisateur n\'est pas DISTRICT ou AGENT', async () => {
      req.user.role = 'REGIONAL';
      await createStockHEALTHCENTER(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait créer un stock health center avec succès (AGENT ADMIN)', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.body.vaccineId = 'vaccine-1';
      req.body.healthCenterId = 'healthcenter-1';
      prisma.user.findUnique.mockResolvedValue({ healthCenterId: 'healthcenter-1' });
      prisma.StockHEALTHCENTER.create.mockResolvedValue({ id: 'stock-1', vaccineId: 'vaccine-1', healthCenterId: 'healthcenter-1' });

      await createStockHEALTHCENTER(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 403 si agent n\'est pas ADMIN', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'STAFF';
      req.body.vaccineId = 'vaccine-1';
      await createStockHEALTHCENTER(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('addStockDISTRICT', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL ou NATIONAL', async () => {
      req.user.role = 'DISTRICT';
      await addStockDISTRICT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait ajouter du stock district avec succès (REGIONAL)', async () => {
      req.user.role = 'REGIONAL';
      req.body.vaccineId = 'vaccine-1';
      req.body.districtId = 'district-1';
      req.body.quantity = 100;
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.user.findMany.mockResolvedValue([]); // Mock pour les utilisateurs du district (email)
      prisma.district.findUnique.mockResolvedValue({ 
        id: 'district-1',
        communeId: 'commune-1',
        commune: { regionId: 'region-1' }
      });
      const mockDistrictStock = {
        id: 'stock-1',
        vaccineId: 'vaccine-1',
        districtId: 'district-1',
        quantity: 0,
        district: { name: 'District Test' },
        vaccine: { name: 'BCG' },
      };
      const mockRegionalStock = {
        id: 'stock-regional-1',
        vaccineId: 'vaccine-1',
        regionId: 'region-1',
        quantity: 200,
      };
      stockLotService.consumeLots.mockResolvedValue([{ lotId: 'lot-1', quantity: 100 }]);
      stockLotService.createLot.mockResolvedValue({ id: 'pending-lot-1' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockDISTRICT: {
            findUnique: jest.fn()
              .mockResolvedValueOnce(mockDistrictStock)
              .mockResolvedValueOnce({ ...mockDistrictStock, quantity: 0 }),
            create: jest.fn().mockResolvedValue(mockDistrictStock),
          },
          stockREGIONAL: {
            findUnique: jest.fn()
              .mockResolvedValueOnce(mockRegionalStock)
              .mockResolvedValueOnce({ ...mockRegionalStock, quantity: 100 }),
            update: jest.fn().mockResolvedValue({ ...mockRegionalStock, quantity: 100 }),
          },
          stockLot: {
            findUnique: jest.fn().mockResolvedValue({ id: 'lot-1', expiration: new Date('2025-12-31') }),
          },
          pendingStockTransfer: {
            create: jest.fn().mockResolvedValue({ 
              id: 'transfer-1', 
              status: 'PENDING',
              vaccine: { name: 'BCG' },
              lots: [{ lot: { id: 'lot-1' } }],
            }),
          },
        };
        return callback(mockTx);
      });

      await addStockDISTRICT(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 400 si quantité insuffisante dans stock régional', async () => {
      req.user.role = 'REGIONAL';
      req.body.vaccineId = 'vaccine-1';
      req.body.districtId = 'district-1';
      req.body.quantity = 100;
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.district.findUnique.mockResolvedValue({ 
        id: 'district-1',
        communeId: 'commune-1',
        commune: { regionId: 'region-1' }
      });
      const mockDistrictStock = {
        id: 'stock-1',
        vaccineId: 'vaccine-1',
        districtId: 'district-1',
        quantity: 0,
        district: { name: 'District Test' },
        vaccine: { name: 'BCG' },
      };
      const mockRegionalStock = {
        id: 'stock-regional-1',
        vaccineId: 'vaccine-1',
        regionId: 'region-1',
        quantity: 50, // Insuffisant
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockDISTRICT: {
            findUnique: jest.fn().mockResolvedValue(mockDistrictStock),
          },
          stockREGIONAL: {
            findUnique: jest.fn().mockResolvedValue(mockRegionalStock),
          },
        };
        try {
          return await callback(mockTx);
        } catch (error) {
          throw error;
        }
      });

      await addStockDISTRICT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('addStockHEALTHCENTER', () => {
    it('devrait retourner 403 si utilisateur n\'est pas DISTRICT ou AGENT', async () => {
      req.user.role = 'REGIONAL';
      await addStockHEALTHCENTER(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait ajouter du stock health center avec succès (DISTRICT)', async () => {
      req.user.role = 'DISTRICT';
      req.body.vaccineId = 'vaccine-1';
      req.body.healthCenterId = 'healthcenter-1';
      req.body.quantity = 100;
      prisma.user.findUnique.mockResolvedValue({ districtId: 'district-1' });
      prisma.healthCenter.findUnique.mockResolvedValue({ districtId: 'district-1' });
      prisma.user.findMany.mockResolvedValue([]); // Mock pour les agents admin
      const mockHealthCenterStock = {
        id: 'stock-1',
        vaccineId: 'vaccine-1',
        healthCenterId: 'healthcenter-1',
        quantity: 0,
        healthCenter: { name: 'Centre Test' },
        vaccine: { name: 'BCG' },
      };
      const mockDistrictStock = {
        id: 'stock-district-1',
        vaccineId: 'vaccine-1',
        districtId: 'district-1',
        quantity: 200,
      };
      stockLotService.consumeLots.mockResolvedValue([{ lotId: 'lot-1', quantity: 100 }]);
      stockLotService.createLot.mockResolvedValue({ id: 'pending-lot-1' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockHEALTHCENTER: {
            findUnique: jest.fn().mockResolvedValue(mockHealthCenterStock),
            create: jest.fn().mockResolvedValue(mockHealthCenterStock),
          },
          stockDISTRICT: {
            findUnique: jest.fn()
              .mockResolvedValueOnce(mockDistrictStock)
              .mockResolvedValueOnce({ ...mockDistrictStock, quantity: 100 }),
            update: jest.fn().mockResolvedValue({ ...mockDistrictStock, quantity: 100 }),
          },
          stockLot: {
            findUnique: jest.fn().mockResolvedValue({ id: 'lot-1', expiration: new Date('2025-12-31') }),
          },
          pendingStockTransfer: {
            create: jest.fn().mockResolvedValue({ 
              id: 'transfer-1', 
              status: 'PENDING',
              vaccine: { name: 'BCG' },
              lots: [{ lot: { id: 'lot-1' } }],
            }),
          },
        };
        return callback(mockTx);
      });

      await addStockHEALTHCENTER(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('reduceStockNATIONAL', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await reduceStockNATIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait réduire le stock national avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.body.vaccineId = 'vaccine-1';
      req.body.quantity = 50;
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', quantity: 200 };
      prisma.stockNATIONAL.findUnique.mockResolvedValue(mockStock);
      prisma.stockNATIONAL.update.mockResolvedValue({ ...mockStock, quantity: 150 });

      await reduceStockNATIONAL(req, res, next);

      expect(prisma.stockNATIONAL.update).toHaveBeenCalledWith({
        where: { vaccineId: 'vaccine-1' },
        data: { quantity: 150 },
      });
      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 400 si quantité insuffisante', async () => {
      req.user.role = 'NATIONAL';
      req.body.vaccineId = 'vaccine-1';
      req.body.quantity = 300;
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', quantity: 200 };
      prisma.stockNATIONAL.findUnique.mockResolvedValue(mockStock);

      await reduceStockNATIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Quantité insuffisante' });
    });
  });

  describe('reduceStockREGIONAL', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'DISTRICT';
      await reduceStockREGIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait réduire le stock régional avec succès (REGIONAL)', async () => {
      req.user.role = 'REGIONAL';
      req.body.vaccineId = 'vaccine-1';
      req.body.quantity = 50;
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', regionId: 'region-1', quantity: 200 };
      prisma.stockREGIONAL.findUnique.mockResolvedValue(mockStock);
      prisma.stockREGIONAL.update.mockResolvedValue({ ...mockStock, quantity: 150 });

      await reduceStockREGIONAL(req, res, next);

      expect(prisma.stockREGIONAL.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 400 si quantité insuffisante', async () => {
      req.user.role = 'REGIONAL';
      req.body.vaccineId = 'vaccine-1';
      req.body.quantity = 300;
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', regionId: 'region-1', quantity: 200 };
      prisma.stockREGIONAL.findUnique.mockResolvedValue(mockStock);

      await reduceStockREGIONAL(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('reduceStockDISTRICT', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL ou DISTRICT', async () => {
      req.user.role = 'NATIONAL';
      await reduceStockDISTRICT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait réduire le stock district avec succès (DISTRICT)', async () => {
      req.user.role = 'DISTRICT';
      req.body.vaccineId = 'vaccine-1';
      req.body.districtId = 'district-1';
      req.body.quantity = 50;
      prisma.user.findUnique.mockResolvedValue({ districtId: 'district-1' });
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', districtId: 'district-1', quantity: 200 };
      prisma.stockDISTRICT.findUnique.mockResolvedValue(mockStock);
      prisma.stockDISTRICT.update.mockResolvedValue({ ...mockStock, quantity: 150 });

      await reduceStockDISTRICT(req, res, next);

      expect(prisma.stockDISTRICT.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('reduceStockHEALTHCENTER', () => {
    it('devrait retourner 403 si utilisateur n\'est pas DISTRICT ou AGENT', async () => {
      req.user.role = 'REGIONAL';
      await reduceStockHEALTHCENTER(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait réduire le stock health center avec succès (AGENT ADMIN)', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.body.vaccineId = 'vaccine-1';
      req.body.healthCenterId = 'healthcenter-1';
      req.body.quantity = 50;
      prisma.user.findUnique.mockResolvedValue({ healthCenterId: 'healthcenter-1' });
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', healthCenterId: 'healthcenter-1', quantity: 200 };
      prisma.stockHEALTHCENTER.findUnique.mockResolvedValue(mockStock);
      prisma.stockHEALTHCENTER.update.mockResolvedValue({ ...mockStock, quantity: 150 });

      await reduceStockHEALTHCENTER(req, res, next);

      expect(prisma.stockHEALTHCENTER.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('updateStockREGIONAL', () => {
    it('devrait retourner 403 si utilisateur n\'est pas SUPERADMIN', async () => {
      req.user.role = 'NATIONAL';
      await updateStockREGIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 403 si utilisateur est REGIONAL', async () => {
      req.user.role = 'REGIONAL';
      await updateStockREGIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait mettre à jour le stock régional avec succès (SUPERADMIN)', async () => {
      req.user.role = 'SUPERADMIN';
      req.body.vaccineId = 'vaccine-1';
      req.body.regionId = 'region-1';
      req.body.quantity = 300;
      req.body.expiration = '2025-12-31';
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', regionId: 'region-1', quantity: 200 };
      stockLotService.createLot.mockResolvedValue({ id: 'lot-1' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockREGIONAL: {
            findUnique: jest.fn()
              .mockResolvedValueOnce(mockStock)
              .mockResolvedValueOnce({ ...mockStock, quantity: 300, vaccine: { name: 'BCG' }, region: { name: 'Région Test' } }),
            update: jest.fn().mockResolvedValue({ ...mockStock, quantity: 300 }),
          },
        };
        return callback(mockTx);
      });

      await updateStockREGIONAL(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 400 si regionId manquant', async () => {
      req.user.role = 'SUPERADMIN';
      req.body.vaccineId = 'vaccine-1';
      req.body.quantity = 300;
      await updateStockREGIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateStockDISTRICT', () => {
    it('devrait retourner 403 si utilisateur n\'est pas SUPERADMIN', async () => {
      req.user.role = 'REGIONAL';
      await updateStockDISTRICT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 403 si utilisateur est DISTRICT', async () => {
      req.user.role = 'DISTRICT';
      await updateStockDISTRICT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait mettre à jour le stock district avec succès (SUPERADMIN)', async () => {
      req.user.role = 'SUPERADMIN';
      req.body.vaccineId = 'vaccine-1';
      req.body.districtId = 'district-1';
      req.body.quantity = 300;
      req.body.expiration = '2025-12-31';
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', districtId: 'district-1', quantity: 200 };
      stockLotService.createLot.mockResolvedValue({ id: 'lot-1' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockDISTRICT: {
            findUnique: jest.fn()
              .mockResolvedValueOnce(mockStock)
              .mockResolvedValueOnce({ ...mockStock, quantity: 300, vaccine: { name: 'BCG' }, district: { name: 'District Test', commune: {} } }),
            update: jest.fn().mockResolvedValue({ ...mockStock, quantity: 300 }),
          },
        };
        return callback(mockTx);
      });

      await updateStockDISTRICT(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 404 si stock district introuvable', async () => {
      req.user.role = 'SUPERADMIN';
      req.body.vaccineId = 'vaccine-1';
      req.body.districtId = 'district-1';
      req.body.quantity = 300;
      req.body.expiration = '2025-12-31';
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockDISTRICT: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(mockTx);
      });

      await updateStockDISTRICT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateStockHEALTHCENTER', () => {
    it('devrait retourner 403 si utilisateur n\'est pas SUPERADMIN', async () => {
      req.user.role = 'DISTRICT';
      await updateStockHEALTHCENTER(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 403 si utilisateur est AGENT ADMIN', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      await updateStockHEALTHCENTER(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait mettre à jour le stock health center avec succès (SUPERADMIN)', async () => {
      req.user.role = 'SUPERADMIN';
      req.body.vaccineId = 'vaccine-1';
      req.body.healthCenterId = 'healthcenter-1';
      req.body.quantity = 300;
      req.body.expiration = '2025-12-31';
      const mockStock = { id: 'stock-1', vaccineId: 'vaccine-1', healthCenterId: 'healthcenter-1', quantity: 200 };
      stockLotService.createLot.mockResolvedValue({ id: 'lot-1' });
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockHEALTHCENTER: {
            findUnique: jest.fn()
              .mockResolvedValueOnce(mockStock)
              .mockResolvedValueOnce({ ...mockStock, quantity: 300, vaccine: { name: 'BCG' }, healthCenter: { name: 'Centre Test' } }),
            update: jest.fn().mockResolvedValue({ ...mockStock, quantity: 300 }),
          },
        };
        return callback(mockTx);
      });

      await updateStockHEALTHCENTER(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 404 si stock health center introuvable', async () => {
      req.user.role = 'SUPERADMIN';
      req.body.vaccineId = 'vaccine-1';
      req.body.healthCenterId = 'healthcenter-1';
      req.body.quantity = 300;
      req.body.expiration = '2025-12-31';
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockHEALTHCENTER: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(mockTx);
      });

      await updateStockHEALTHCENTER(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('listRegionalLots', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'DISTRICT';
      req.params.vaccineId = 'vaccine-1';
      await listRegionalLots(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner la liste des lots régionaux avec succès', async () => {
      req.user.role = 'REGIONAL';
      req.params.vaccineId = 'vaccine-1';
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.stockLot.findMany.mockResolvedValue([
        { id: 'lot-1', remainingQuantity: 100, expiration: new Date(), vaccine: { name: 'BCG' } },
      ]);

      await listRegionalLots(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 400 si vaccineId manquant', async () => {
      req.user.role = 'REGIONAL';
      req.params.vaccineId = '';
      await listRegionalLots(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('listDistrictLots', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'AGENT';
      req.params.vaccineId = 'vaccine-1';
      await listDistrictLots(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner la liste des lots de district avec succès', async () => {
      req.user.role = 'DISTRICT';
      req.params.vaccineId = 'vaccine-1';
      req.query.districtId = 'district-1';
      prisma.user.findUnique.mockResolvedValue({ districtId: 'district-1' });
      prisma.stockLot.findMany.mockResolvedValue([
        { id: 'lot-1', remainingQuantity: 100, expiration: new Date(), vaccine: { name: 'BCG' } },
      ]);

      await listDistrictLots(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('listHealthCenterLots', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'INVALID_ROLE';
      req.params.vaccineId = 'vaccine-1';
      await listHealthCenterLots(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner la liste des lots de centre de santé avec succès (AGENT ADMIN)', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.params.vaccineId = 'vaccine-1';
      prisma.user.findUnique.mockResolvedValue({ healthCenterId: 'healthcenter-1' });
      prisma.stockLot.findMany.mockResolvedValue([
        { id: 'lot-1', remainingQuantity: 100, expiration: new Date(), vaccine: { name: 'BCG' } },
      ]);
      prisma.stockReservation.findMany.mockResolvedValue([]);

      await listHealthCenterLots(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getStockREGIONAL', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'DISTRICT';
      await getStockREGIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner la liste des stocks régionaux avec succès (REGIONAL)', async () => {
      req.user.role = 'REGIONAL';
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      const mockStocks = [
        {
          id: 'stock-1',
          vaccineId: 'vaccine-1',
          regionId: 'region-1',
          quantity: 100,
          vaccine: { name: 'BCG' },
          region: { name: 'Région Test' },
        },
      ];
      prisma.stockREGIONAL.findMany.mockResolvedValue(mockStocks);
      // Mock pour fetchExpiredLotsSet
      prisma.stockLot.findMany.mockResolvedValueOnce([]);
      // Mock pour calculateNearestExpirations
      prisma.stockLot.findMany.mockResolvedValueOnce([]);

      await getStockREGIONAL(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          regional: expect.any(Array),
        }),
      );
    });
  });

  describe('getStockDISTRICT', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'AGENT';
      await getStockDISTRICT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner la liste des stocks de district avec succès (DISTRICT)', async () => {
      req.user.role = 'DISTRICT';
      prisma.user.findUnique.mockResolvedValue({ districtId: 'district-1' });
      const mockStocks = [
        {
          id: 'stock-1',
          vaccineId: 'vaccine-1',
          districtId: 'district-1',
          quantity: 100,
          vaccine: { name: 'BCG' },
          district: { name: 'District Test' },
        },
      ];
      prisma.stockDISTRICT.findMany.mockResolvedValue(mockStocks);
      prisma.district.findMany.mockResolvedValue([{ id: 'district-1' }]);
      // Mock pour fetchExpiredLotsSet
      prisma.stockLot.findMany.mockResolvedValueOnce([]);
      // Mock pour calculateNearestExpirations
      prisma.stockLot.findMany.mockResolvedValueOnce([]);

      await getStockDISTRICT(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          district: expect.any(Array),
        }),
      );
    });
  });

  describe('getStockHEALTHCENTER', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'INVALID_ROLE';
      await getStockHEALTHCENTER(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner la liste des stocks de centre de santé avec succès (AGENT)', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      prisma.user.findUnique.mockResolvedValue({ healthCenterId: 'healthcenter-1' });
      const mockStocks = [
        {
          id: 'stock-1',
          vaccineId: 'vaccine-1',
          healthCenterId: 'healthcenter-1',
          quantity: 100,
          vaccine: { name: 'BCG' },
          healthCenter: { name: 'Centre Test' },
        },
      ];
      prisma.stockHEALTHCENTER.findMany.mockResolvedValue(mockStocks);
      // Mock pour fetchExpiredLotsSet
      prisma.stockLot.findMany.mockResolvedValueOnce([]);
      // Mock pour calculateNearestExpirations
      prisma.stockLot.findMany.mockResolvedValueOnce([]);

      await getStockHEALTHCENTER(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          healthCenter: expect.any(Array),
        }),
      );
    });
  });

  describe('deleteStockREGIONAL', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'DISTRICT';
      req.body.vaccineId = 'vaccine-1';
      await deleteStockREGIONAL(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait supprimer le stock régional avec succès (REGIONAL)', async () => {
      req.user.role = 'REGIONAL';
      req.body.vaccineId = 'vaccine-1';
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.stockLot.findFirst.mockResolvedValue({ id: 'lot-1', status: 'EXPIRED' }); // Lot expiré requis
      prisma.stockLot.findMany.mockResolvedValue([{ id: 'lot-1' }]);
      stockLotService.deleteLotDirect.mockResolvedValue('lot-1');
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockREGIONAL: {
            findUnique: jest.fn().mockResolvedValue({ id: 'stock-1', vaccineId: 'vaccine-1', regionId: 'region-1' }),
            delete: jest.fn().mockResolvedValue({}),
          },
          stockLot: {
            findFirst: prisma.stockLot.findFirst,
            findMany: jest.fn().mockResolvedValue([{ id: 'lot-1' }]),
          },
        };
        return callback(mockTx);
      });

      await deleteStockREGIONAL(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('deleteStockDISTRICT', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL ou DISTRICT', async () => {
      req.user.role = 'AGENT';
      req.body.vaccineId = 'vaccine-1';
      await deleteStockDISTRICT(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait supprimer le stock district avec succès (DISTRICT)', async () => {
      req.user.role = 'DISTRICT';
      req.body.vaccineId = 'vaccine-1';
      prisma.user.findUnique.mockResolvedValue({ districtId: 'district-1' });
      prisma.stockLot.findFirst.mockResolvedValue({ id: 'lot-1', status: 'EXPIRED' }); // Lot expiré requis
      prisma.stockLot.findMany.mockResolvedValue([{ id: 'lot-1' }]);
      stockLotService.deleteLotDirect.mockResolvedValue('lot-1');
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockDISTRICT: {
            findUnique: jest.fn().mockResolvedValue({ id: 'stock-1', vaccineId: 'vaccine-1', districtId: 'district-1' }),
            delete: jest.fn().mockResolvedValue({}),
          },
          stockLot: {
            findFirst: prisma.stockLot.findFirst,
            findMany: jest.fn().mockResolvedValue([{ id: 'lot-1' }]),
          },
        };
        return callback(mockTx);
      });

      await deleteStockDISTRICT(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('deleteStockHEALTHCENTER', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'INVALID_ROLE';
      req.body.vaccineId = 'vaccine-1';
      await deleteStockHEALTHCENTER(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait supprimer le stock health center avec succès (AGENT ADMIN)', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.body.vaccineId = 'vaccine-1';
      prisma.user.findUnique.mockResolvedValue({ healthCenterId: 'healthcenter-1' });
      prisma.stockLot.findFirst.mockResolvedValue({ id: 'lot-1', status: 'EXPIRED' }); // Lot expiré requis
      prisma.stockLot.findMany.mockResolvedValue([{ id: 'lot-1' }]);
      stockLotService.deleteLotDirect.mockResolvedValue('lot-1');
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          stockHEALTHCENTER: {
            findUnique: jest.fn().mockResolvedValue({ id: 'stock-1', vaccineId: 'vaccine-1', healthCenterId: 'healthcenter-1' }),
            delete: jest.fn().mockResolvedValue({}),
          },
          stockLot: {
            findFirst: prisma.stockLot.findFirst,
            findMany: jest.fn().mockResolvedValue([{ id: 'lot-1' }]),
          },
        };
        return callback(mockTx);
      });

      await deleteStockHEALTHCENTER(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('getRegionalStockStats', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'DISTRICT';
      await getRegionalStockStats(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner les statistiques du stock régional avec succès (REGIONAL)', async () => {
      req.user.role = 'REGIONAL';
      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.stockREGIONAL.aggregate.mockResolvedValue({
        _sum: { quantity: 1000 },
        _count: { _all: 5 },
      });
      prisma.stockREGIONAL.count.mockResolvedValue(2);
      prisma.stockLot.count.mockResolvedValue(1);

      await getRegionalStockStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalLots: 5,
          totalQuantity: 1000,
          lowStockCount: 2,
          expiredLots: 1,
          threshold: expect.any(Number),
        }),
      );
    });
  });

  describe('getDistrictStockStats', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'AGENT';
      await getDistrictStockStats(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner les statistiques du stock district avec succès (DISTRICT)', async () => {
      req.user.role = 'DISTRICT';
      prisma.user.findUnique.mockResolvedValue({ districtId: 'district-1' });
      prisma.stockDISTRICT.aggregate.mockResolvedValue({
        _sum: { quantity: 500 },
        _count: { _all: 3 },
      });
      prisma.stockDISTRICT.count.mockResolvedValue(1);
      prisma.stockLot.count.mockResolvedValue(0);

      await getDistrictStockStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalLots: 3,
          totalQuantity: 500,
          lowStockCount: 1,
          expiredLots: 0,
          threshold: expect.any(Number),
        }),
      );
    });
  });

  describe('getHealthCenterStockStats', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'INVALID_ROLE';
      await getHealthCenterStockStats(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner les statistiques du stock centre de santé avec succès (AGENT ADMIN)', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.query.healthCenterId = 'healthcenter-1';
      prisma.user.findUnique.mockResolvedValue({ healthCenterId: 'healthcenter-1' });
      prisma.stockHEALTHCENTER.aggregate.mockResolvedValue({
        _sum: { quantity: 200 },
        _count: { _all: 2 },
      });
      prisma.stockHEALTHCENTER.count.mockResolvedValue(1);
      prisma.stockLot.count.mockResolvedValue(0);

      await getHealthCenterStockStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalLots: 2,
          totalQuantity: 200,
          lowStockCount: 1,
          expiredLots: 0,
          threshold: expect.any(Number),
        }),
      );
    });
  });

  describe('getHealthCenterReservations', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'INVALID_ROLE';
      await getHealthCenterReservations(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner les réservations du centre de santé avec succès (AGENT ADMIN)', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      prisma.user.findUnique.mockResolvedValue({ healthCenterId: 'healthcenter-1' });
      const mockReservations = [
        {
          id: 'reservation-1',
          scheduleId: 'schedule-1',
          quantity: 1,
          stockLot: { 
            id: 'lot-1', 
            expiration: new Date(),
            vaccine: { id: 'vaccine-1', name: 'BCG' }
          },
          schedule: {
            id: 'schedule-1',
            scheduledFor: new Date(),
            child: { id: 'child-1', firstName: 'John', lastName: 'Doe' },
            vaccine: { id: 'vaccine-1', name: 'BCG' },
          },
        },
      ];
      prisma.stockReservation.findMany.mockResolvedValue(mockReservations);

      await getHealthCenterReservations(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          reservations: expect.any(Array),
        }),
      );
    });

    it('devrait retourner 403 si agent n\'est pas ADMIN ou STAFF', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = null;
      await getHealthCenterReservations(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});

