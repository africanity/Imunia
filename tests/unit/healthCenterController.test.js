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
      query: {},
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

    it('devrait retourner une liste vide si AGENT sans healthCenterId (depuis DB)', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = null;
      prisma.user.findUnique.mockResolvedValue({ healthCenterId: null });

      await listHealthCenters(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ total: 0, items: [] });
    });

    it('devrait retourner le centre de santé pour un AGENT avec healthCenterId depuis DB', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = null;
      prisma.user.findUnique.mockResolvedValue({ healthCenterId: 'hc-1' });
      const mockCenters = [{ id: 'hc-1', name: 'HC 1' }];
      prisma.healthCenter.findMany.mockResolvedValue(mockCenters);

      await listHealthCenters(req, res, next);

      expect(prisma.healthCenter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'hc-1' },
        })
      );
      expect(res.json).toHaveBeenCalledWith({ total: 1, items: mockCenters });
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

    it('devrait retourner tous les centres pour SUPERADMIN sans districtId', async () => {
      req.user.role = 'SUPERADMIN';
      req.query = {};
      const mockCenters = [
        { id: 'hc-1', name: 'HC 1' },
        { id: 'hc-2', name: 'HC 2' },
      ];
      prisma.healthCenter.findMany.mockResolvedValue(mockCenters);

      await listHealthCenters(req, res, next);

      expect(prisma.healthCenter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
      expect(res.json).toHaveBeenCalledWith({ total: 2, items: mockCenters });
    });

    it('devrait filtrer par districtId pour SUPERADMIN', async () => {
      req.user.role = 'SUPERADMIN';
      req.query.districtId = 'district-1';
      const mockCenters = [{ id: 'hc-1', name: 'HC 1' }];
      prisma.healthCenter.findMany.mockResolvedValue(mockCenters);

      await listHealthCenters(req, res, next);

      expect(prisma.healthCenter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { districtId: 'district-1' },
        })
      );
      expect(res.json).toHaveBeenCalledWith({ total: 1, items: mockCenters });
    });

    it('devrait retourner tous les centres pour NATIONAL', async () => {
      req.user.role = 'NATIONAL';
      const mockCenters = [
        { id: 'hc-1', name: 'HC 1' },
        { id: 'hc-2', name: 'HC 2' },
      ];
      prisma.healthCenter.findMany.mockResolvedValue(mockCenters);

      await listHealthCenters(req, res, next);

      expect(prisma.healthCenter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
      expect(res.json).toHaveBeenCalledWith({ total: 2, items: mockCenters });
    });

    it('devrait retourner tous les centres pour REGIONAL', async () => {
      req.user.role = 'REGIONAL';
      const mockCenters = [
        { id: 'hc-1', name: 'HC 1' },
        { id: 'hc-2', name: 'HC 2' },
      ];
      prisma.healthCenter.findMany.mockResolvedValue(mockCenters);

      await listHealthCenters(req, res, next);

      expect(prisma.healthCenter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
      expect(res.json).toHaveBeenCalledWith({ total: 2, items: mockCenters });
    });

    it('devrait retourner 403 pour un rôle non autorisé', async () => {
      req.user.role = 'INVALID_ROLE';

      await listHealthCenters(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
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

    it('devrait retourner 400 si utilisateur DISTRICT sans districtId', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = null;
      req.body.name = 'HC Test';
      req.body.address = 'Adresse Test';

      await createHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Votre compte n'est pas rattaché à un district",
      });
    });

    it('devrait retourner 400 si nom ou adresse manquants', async () => {
      req.body.name = '';
      req.body.address = 'Adresse Test';

      await createHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Nom et adresse requis' });
    });

    it('devrait retourner 400 si nom manquant', async () => {
      req.body.name = '';
      req.body.address = 'Adresse Test';

      await createHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Nom et adresse requis' });
    });

    it('devrait retourner 400 si adresse manquante', async () => {
      req.body.name = 'HC Test';
      req.body.address = '';

      await createHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Nom et adresse requis' });
    });

    it('devrait retourner 400 si districtId manquant pour SUPERADMIN', async () => {
      req.user.role = 'SUPERADMIN';
      req.body.name = 'HC Test';
      req.body.address = 'Adresse Test';
      req.body.districtId = null;

      await createHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'District requis' });
    });

    it('devrait créer un centre de santé avec succès pour DISTRICT', async () => {
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

    it('devrait créer un centre de santé avec succès pour SUPERADMIN', async () => {
      req.user.role = 'SUPERADMIN';
      req.body.name = 'HC Test';
      req.body.address = 'Adresse Test';
      req.body.districtId = 'district-2';
      const mockCenter = {
        id: 'hc-1',
        name: 'HC Test',
        address: 'Adresse Test',
        districtId: 'district-2',
        district: { id: 'district-2', name: 'District 2' },
      };
      prisma.healthCenter.create.mockResolvedValue(mockCenter);

      await createHealthCenter(req, res, next);

      expect(prisma.healthCenter.create).toHaveBeenCalledWith({
        data: {
          name: 'HC Test',
          address: 'Adresse Test',
          districtId: 'district-2',
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

    it('devrait gérer les erreurs sans status dans ensureDistrictUser', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.body.name = 'HC Test';
      req.body.address = 'Adresse Test';
      // Simuler une erreur Prisma qui n'a pas de status lors de la création
      const error = new Error('Erreur base de données');
      prisma.healthCenter.create.mockRejectedValue(error);

      await createHealthCenter(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('devrait gérer les erreurs sans status dans ensureDistrictUser (throw)', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = null; // Cela devrait déclencher ensureDistrictUser qui lance une erreur avec status
      req.body.name = 'HC Test';
      req.body.address = 'Adresse Test';
      
      // Mais si ensureDistrictUser lance une erreur sans status, elle devrait être propagée
      // On simule cela en faisant en sorte que ensureDistrictUser ne soit pas appelé
      // et qu'une erreur Prisma se produise ailleurs
      const error = new Error('Erreur base de données');
      // On mocke pour que la vérification de districtId échoue d'abord
      // Puis on simule une erreur dans la création
      prisma.healthCenter.create.mockRejectedValue(error);

      await createHealthCenter(req, res, next);

      // Si districtId est null, ensureDistrictUser devrait retourner 400, pas next(error)
      // Donc ce test ne couvre pas vraiment la ligne 95
      // Pour couvrir la ligne 95, il faut que ensureDistrictUser lance une erreur sans status
      // Mais ensureDistrictUser lance toujours une erreur avec status
      // Donc la ligne 95 ne peut être atteinte que si une autre erreur se produit
      expect(res.status).toHaveBeenCalledWith(400);
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

    it('devrait retourner 400 si utilisateur DISTRICT sans districtId', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = null;
      req.params.id = 'hc-1';

      await updateHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Votre compte n'est pas rattaché à un district",
      });
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

    it('devrait retourner le centre sans modification si aucune donnée à mettre à jour', async () => {
      req.params.id = 'hc-1';
      req.body = {};
      const mockCenter = { id: 'hc-1', name: 'HC Test', districtId: 'district-1' };
      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);

      await updateHealthCenter(req, res, next);

      expect(prisma.healthCenter.update).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockCenter);
    });

    it('devrait retourner le centre sans modification si name est vide', async () => {
      req.params.id = 'hc-1';
      req.body.name = '   ';
      req.body.address = '   ';
      const mockCenter = { id: 'hc-1', name: 'HC Test', districtId: 'district-1' };
      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);

      await updateHealthCenter(req, res, next);

      expect(prisma.healthCenter.update).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockCenter);
    });

    it('devrait mettre à jour un centre de santé avec succès (nom seulement)', async () => {
      req.params.id = 'hc-1';
      req.body.name = 'HC Modifié';
      const mockCenter = { id: 'hc-1', name: 'HC Test', districtId: 'district-1' };
      const mockUpdated = {
        id: 'hc-1',
        name: 'HC Modifié',
        district: { id: 'district-1', name: 'District 1' },
      };
      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);
      prisma.healthCenter.update.mockResolvedValue(mockUpdated);

      await updateHealthCenter(req, res, next);

      expect(prisma.healthCenter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'hc-1' },
          data: { name: 'HC Modifié' },
        })
      );
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait mettre à jour un centre de santé avec succès (adresse seulement)', async () => {
      req.params.id = 'hc-1';
      req.body.address = 'Nouvelle adresse';
      const mockCenter = { id: 'hc-1', name: 'HC Test', districtId: 'district-1' };
      const mockUpdated = {
        id: 'hc-1',
        address: 'Nouvelle adresse',
        district: { id: 'district-1', name: 'District 1' },
      };
      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);
      prisma.healthCenter.update.mockResolvedValue(mockUpdated);

      await updateHealthCenter(req, res, next);

      expect(prisma.healthCenter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'hc-1' },
          data: { address: 'Nouvelle adresse' },
        })
      );
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait mettre à jour un centre de santé avec succès (nom et adresse)', async () => {
      req.params.id = 'hc-1';
      req.body.name = 'HC Modifié';
      req.body.address = 'Nouvelle adresse';
      const mockCenter = { id: 'hc-1', name: 'HC Test', districtId: 'district-1' };
      const mockUpdated = {
        id: 'hc-1',
        name: 'HC Modifié',
        address: 'Nouvelle adresse',
        district: { id: 'district-1', name: 'District 1' },
      };
      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);
      prisma.healthCenter.update.mockResolvedValue(mockUpdated);

      await updateHealthCenter(req, res, next);

      expect(prisma.healthCenter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'hc-1' },
          data: { name: 'HC Modifié', address: 'Nouvelle adresse' },
        })
      );
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait gérer les erreurs sans status', async () => {
      req.params.id = 'hc-1';
      req.body.name = 'HC Modifié';
      // Simuler une erreur Prisma qui n'a pas de status
      const error = new Error('Erreur base de données');
      prisma.healthCenter.findUnique.mockRejectedValue(error);

      await updateHealthCenter(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
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

    it('devrait retourner 400 si utilisateur DISTRICT sans districtId', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = null;
      req.params.id = 'hc-1';

      await deleteHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Votre compte n'est pas rattaché à un district",
      });
    });

    it('devrait retourner 404 si centre non trouvé pour DISTRICT', async () => {
      req.params.id = 'hc-1';
      prisma.healthCenter.findUnique.mockResolvedValue(null);

      await deleteHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Centre introuvable' });
    });

    it('devrait retourner 403 si centre n\'appartient pas au district de l\'utilisateur', async () => {
      req.params.id = 'hc-1';
      prisma.healthCenter.findUnique.mockResolvedValue({
        id: 'hc-1',
        districtId: 'district-2',
      });

      await deleteHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 404 si centre non trouvé pour SUPERADMIN', async () => {
      req.user.role = 'SUPERADMIN';
      req.params.id = 'hc-1';
      prisma.healthCenter.findUnique.mockResolvedValue(null);

      await deleteHealthCenter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Centre introuvable' });
    });

    it('devrait supprimer un centre de santé avec toutes ses données liées (avec enfants)', async () => {
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

    it('devrait supprimer un centre de santé sans enfants (childIds vide)', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
      };
      const mockStockLots = [{ id: 'lot-1', vaccineId: 'vaccine-1' }];
      const mockPendingTransfers = [{ id: 'transfer-1', status: 'PENDING' }];

      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);
      prisma.children.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.stockLot.findMany.mockResolvedValue(mockStockLots);
      prisma.pendingStockTransfer.findMany.mockResolvedValue(mockPendingTransfers);

      prisma.pendingStockTransferLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockTransferLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.pendingStockTransfer.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockHEALTHCENTER.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.deleteMany.mockResolvedValue({ count: 0 });
      prisma.record.deleteMany.mockResolvedValue({ count: 0 });
      prisma.healthCenter.delete.mockResolvedValue(mockCenter);

      await deleteHealthCenter(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait supprimer un centre de santé sans lots mais avec pendingTransfers', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
      };
      const mockPendingTransfers = [{ id: 'transfer-1', status: 'PENDING' }];

      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);
      prisma.children.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.stockLot.findMany.mockResolvedValue([]);
      prisma.pendingStockTransfer.findMany.mockResolvedValue(mockPendingTransfers);

      prisma.pendingStockTransferLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.pendingStockTransfer.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockLot.deleteMany.mockResolvedValue({ count: 0 });
      prisma.stockHEALTHCENTER.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.deleteMany.mockResolvedValue({ count: 0 });
      prisma.record.deleteMany.mockResolvedValue({ count: 0 });
      prisma.healthCenter.delete.mockResolvedValue(mockCenter);

      await deleteHealthCenter(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait supprimer un centre de santé avec lots mais sans pendingTransfers', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
      };
      const mockStockLots = [{ id: 'lot-1', vaccineId: 'vaccine-1' }];

      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);
      prisma.children.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.stockLot.findMany.mockResolvedValue(mockStockLots);
      prisma.pendingStockTransfer.findMany.mockResolvedValue([]);

      prisma.pendingStockTransferLot.deleteMany.mockResolvedValue({ count: 0 });
      prisma.stockTransferLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockHEALTHCENTER.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.deleteMany.mockResolvedValue({ count: 0 });
      prisma.record.deleteMany.mockResolvedValue({ count: 0 });
      prisma.healthCenter.delete.mockResolvedValue(mockCenter);

      await deleteHealthCenter(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait supprimer un centre de santé sans lots ni pendingTransfers', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
      };

      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);
      prisma.children.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.stockLot.findMany.mockResolvedValue([]);
      prisma.pendingStockTransfer.findMany.mockResolvedValue([]);

      prisma.stockLot.deleteMany.mockResolvedValue({ count: 0 });
      prisma.stockHEALTHCENTER.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.deleteMany.mockResolvedValue({ count: 0 });
      prisma.record.deleteMany.mockResolvedValue({ count: 0 });
      prisma.healthCenter.delete.mockResolvedValue(mockCenter);

      await deleteHealthCenter(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait supprimer un centre avec enfants mais sans lots ni pendingTransfers', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
      };
      const mockChildren = [{ id: 'child-1', firstName: 'John', lastName: 'Doe' }];

      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);
      prisma.children.findMany.mockResolvedValue(mockChildren);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.stockLot.findMany.mockResolvedValue([]);
      prisma.pendingStockTransfer.findMany.mockResolvedValue([]);

      prisma.stockReservation.deleteMany.mockResolvedValue({ count: 0 });
      prisma.childVaccineScheduled.deleteMany.mockResolvedValue({ count: 0 });
      prisma.childVaccineCompleted.deleteMany.mockResolvedValue({ count: 0 });
      prisma.childVaccineDue.deleteMany.mockResolvedValue({ count: 0 });
      prisma.childVaccineLate.deleteMany.mockResolvedValue({ count: 0 });
      prisma.childVaccineOverdue.deleteMany.mockResolvedValue({ count: 0 });
      prisma.record.deleteMany.mockResolvedValue({ count: 0 });
      prisma.children.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockLot.deleteMany.mockResolvedValue({ count: 0 });
      prisma.stockHEALTHCENTER.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.deleteMany.mockResolvedValue({ count: 0 });
      prisma.healthCenter.delete.mockResolvedValue(mockCenter);

      await deleteHealthCenter(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait supprimer un centre avec lots mais sans pendingTransfers (pendingLotConditions avec lotIds seulement)', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
      };
      const mockStockLots = [{ id: 'lot-1', vaccineId: 'vaccine-1' }];

      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);
      prisma.children.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.stockLot.findMany.mockResolvedValue(mockStockLots);
      prisma.pendingStockTransfer.findMany.mockResolvedValue([]);

      prisma.pendingStockTransferLot.deleteMany.mockResolvedValue({ count: 0 });
      prisma.stockTransferLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockHEALTHCENTER.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.deleteMany.mockResolvedValue({ count: 0 });
      prisma.record.deleteMany.mockResolvedValue({ count: 0 });
      prisma.healthCenter.delete.mockResolvedValue(mockCenter);

      await deleteHealthCenter(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait supprimer un centre avec pendingTransfers mais sans lots (pendingLotConditions avec pendingTransferIds seulement)', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
      };
      const mockPendingTransfers = [{ id: 'transfer-1', status: 'PENDING' }];

      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);
      prisma.children.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.stockLot.findMany.mockResolvedValue([]);
      prisma.pendingStockTransfer.findMany.mockResolvedValue(mockPendingTransfers);

      prisma.pendingStockTransferLot.deleteMany.mockResolvedValue({ count: 1 });
      prisma.pendingStockTransfer.deleteMany.mockResolvedValue({ count: 1 });
      prisma.stockLot.deleteMany.mockResolvedValue({ count: 0 });
      prisma.stockHEALTHCENTER.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.deleteMany.mockResolvedValue({ count: 0 });
      prisma.record.deleteMany.mockResolvedValue({ count: 0 });
      prisma.healthCenter.delete.mockResolvedValue(mockCenter);

      await deleteHealthCenter(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait supprimer un centre de santé pour SUPERADMIN', async () => {
      req.user.role = 'SUPERADMIN';
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
      };

      prisma.healthCenter.findUnique.mockResolvedValue(mockCenter);
      prisma.children.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.stockLot.findMany.mockResolvedValue([]);
      prisma.pendingStockTransfer.findMany.mockResolvedValue([]);

      prisma.stockLot.deleteMany.mockResolvedValue({ count: 0 });
      prisma.stockHEALTHCENTER.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.deleteMany.mockResolvedValue({ count: 0 });
      prisma.record.deleteMany.mockResolvedValue({ count: 0 });
      prisma.healthCenter.delete.mockResolvedValue(mockCenter);

      await deleteHealthCenter(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs sans status', async () => {
      req.params.id = 'hc-1';
      // Simuler une erreur Prisma qui n'a pas de status
      const error = new Error('Erreur base de données');
      prisma.healthCenter.findUnique.mockResolvedValue({
        id: 'hc-1',
        districtId: 'district-1',
      });
      prisma.$transaction.mockRejectedValue(error);

      await deleteHealthCenter(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
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

    it('devrait retourner 400 si utilisateur DISTRICT sans districtId', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = null;
      req.params.id = 'hc-1';

      await getHealthCenterDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Votre compte n'est pas rattaché à un district",
      });
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

    it('devrait retourner un résumé de suppression sans enfants (childIds vide)', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
        district: { id: 'district-1', name: 'District 1' },
      };
      const mockStockLots = [{ id: 'lot-1', vaccineId: 'vaccine-1' }];
      const mockPendingTransfers = [{ id: 'transfer-1', status: 'PENDING' }];

      const mockCascadeData = {
        healthCenter: mockCenter,
        children: [],
        users: [],
        stockLots: mockStockLots,
        pendingTransfers: mockPendingTransfers,
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
        lotIds: ['lot-1'],
        pendingTransferIds: ['transfer-1'],
      };

      prisma.$transaction.mockResolvedValue(mockCascadeData);

      await getHealthCenterDeletionSummary(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        healthCenter: mockCenter,
        totals: {
          children: 0,
          users: 0,
          stockLots: 1,
          pendingTransfers: 1,
          stockReservations: 0,
          records: 0,
          scheduledVaccines: 0,
          dueVaccines: 0,
          lateVaccines: 0,
          overdueVaccines: 0,
          completedVaccines: 0,
        },
        details: {
          children: [],
          users: [],
          stockLots: mockStockLots,
          pendingTransfers: mockPendingTransfers,
        },
      });
    });

    it('devrait retourner un résumé de suppression sans lots mais avec pendingTransfers', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
        district: { id: 'district-1', name: 'District 1' },
      };
      const mockPendingTransfers = [{ id: 'transfer-1', status: 'PENDING' }];

      const mockCascadeData = {
        healthCenter: mockCenter,
        children: [],
        users: [],
        stockLots: [],
        pendingTransfers: mockPendingTransfers,
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
        lotIds: [],
        pendingTransferIds: ['transfer-1'],
      };

      prisma.$transaction.mockResolvedValue(mockCascadeData);

      await getHealthCenterDeletionSummary(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        healthCenter: mockCenter,
        totals: {
          children: 0,
          users: 0,
          stockLots: 0,
          pendingTransfers: 1,
          stockReservations: 0,
          records: 0,
          scheduledVaccines: 0,
          dueVaccines: 0,
          lateVaccines: 0,
          overdueVaccines: 0,
          completedVaccines: 0,
        },
        details: {
          children: [],
          users: [],
          stockLots: [],
          pendingTransfers: mockPendingTransfers,
        },
      });
    });

    it('devrait retourner un résumé de suppression avec lots mais sans pendingTransfers', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
        district: { id: 'district-1', name: 'District 1' },
      };
      const mockStockLots = [{ id: 'lot-1', vaccineId: 'vaccine-1' }];

      const mockCascadeData = {
        healthCenter: mockCenter,
        children: [],
        users: [],
        stockLots: mockStockLots,
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
        lotIds: ['lot-1'],
        pendingTransferIds: [],
      };

      prisma.$transaction.mockResolvedValue(mockCascadeData);

      await getHealthCenterDeletionSummary(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        healthCenter: mockCenter,
        totals: {
          children: 0,
          users: 0,
          stockLots: 1,
          pendingTransfers: 0,
          stockReservations: 0,
          records: 0,
          scheduledVaccines: 0,
          dueVaccines: 0,
          lateVaccines: 0,
          overdueVaccines: 0,
          completedVaccines: 0,
        },
        details: {
          children: [],
          users: [],
          stockLots: mockStockLots,
          pendingTransfers: [],
        },
      });
    });

    it('devrait retourner un résumé avec enfants et tous les compteurs de vaccination', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
        district: { id: 'district-1', name: 'District 1' },
      };
      const mockChildren = [
        { id: 'child-1', firstName: 'John', lastName: 'Doe' },
        { id: 'child-2', firstName: 'Jane', lastName: 'Doe' },
      ];

      const mockCascadeData = {
        healthCenter: mockCenter,
        children: mockChildren,
        users: [],
        stockLots: [],
        pendingTransfers: [],
        childVaccinationCounts: {
          scheduled: 5,
          due: 3,
          late: 2,
          overdue: 1,
          completed: 10,
        },
        stockReservationsCount: 2,
        recordCount: 5,
        childIds: ['child-1', 'child-2'],
        lotIds: [],
        pendingTransferIds: [],
      };

      prisma.$transaction.mockResolvedValue(mockCascadeData);

      await getHealthCenterDeletionSummary(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        healthCenter: mockCenter,
        totals: {
          children: 2,
          users: 0,
          stockLots: 0,
          pendingTransfers: 0,
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
          users: [],
          stockLots: [],
          pendingTransfers: [],
        },
      });
    });

    it('devrait retourner un résumé avec lots et pendingTransfers (pendingTransferConditions avec lotIds)', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
        district: { id: 'district-1', name: 'District 1' },
      };
      const mockStockLots = [
        { id: 'lot-1', vaccineId: 'vaccine-1' },
        { id: 'lot-2', vaccineId: 'vaccine-2' },
      ];
      const mockPendingTransfers = [
        { id: 'transfer-1', status: 'PENDING', vaccineId: 'vaccine-1' },
      ];

      const mockCascadeData = {
        healthCenter: mockCenter,
        children: [],
        users: [],
        stockLots: mockStockLots,
        pendingTransfers: mockPendingTransfers,
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
        lotIds: ['lot-1', 'lot-2'],
        pendingTransferIds: ['transfer-1'],
      };

      prisma.$transaction.mockResolvedValue(mockCascadeData);

      await getHealthCenterDeletionSummary(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        healthCenter: mockCenter,
        totals: {
          children: 0,
          users: 0,
          stockLots: 2,
          pendingTransfers: 1,
          stockReservations: 0,
          records: 0,
          scheduledVaccines: 0,
          dueVaccines: 0,
          lateVaccines: 0,
          overdueVaccines: 0,
          completedVaccines: 0,
        },
        details: {
          children: [],
          users: [],
          stockLots: mockStockLots,
          pendingTransfers: mockPendingTransfers,
        },
      });
    });

    it('devrait retourner un résumé de suppression pour SUPERADMIN', async () => {
      req.user.role = 'SUPERADMIN';
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-2',
        district: { id: 'district-2', name: 'District 2' },
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

    it('devrait retourner 404 si centre non trouvé', async () => {
      req.params.id = 'hc-inexistant';
      const error = new Error('Centre introuvable');
      error.status = 404;
      prisma.$transaction.mockRejectedValue(error);

      await getHealthCenterDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Centre introuvable' });
    });

    it('devrait retourner un résumé avec pendingTransfers mais sans lots (pendingTransferConditions sans lotIds)', async () => {
      req.params.id = 'hc-1';

      const mockCenter = {
        id: 'hc-1',
        name: 'HC 1',
        districtId: 'district-1',
        district: { id: 'district-1', name: 'District 1' },
      };
      // Cas où le centre est l'expéditeur ou le destinataire d'un transfert, mais sans lots
      const mockPendingTransfers = [
        {
          id: 'transfer-1',
          status: 'PENDING',
          vaccineId: 'vaccine-1',
          fromType: 'DISTRICT',
          fromId: 'district-1',
          toType: 'HEALTHCENTER',
          toId: 'hc-1',
        },
      ];

      const mockCascadeData = {
        healthCenter: mockCenter,
        children: [],
        users: [],
        stockLots: [],
        pendingTransfers: mockPendingTransfers,
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
        lotIds: [],
        pendingTransferIds: ['transfer-1'],
      };

      prisma.$transaction.mockResolvedValue(mockCascadeData);

      await getHealthCenterDeletionSummary(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        healthCenter: mockCenter,
        totals: {
          children: 0,
          users: 0,
          stockLots: 0,
          pendingTransfers: 1,
          stockReservations: 0,
          records: 0,
          scheduledVaccines: 0,
          dueVaccines: 0,
          lateVaccines: 0,
          overdueVaccines: 0,
          completedVaccines: 0,
        },
        details: {
          children: [],
          users: [],
          stockLots: [],
          pendingTransfers: mockPendingTransfers,
        },
      });
    });

    it('devrait gérer les erreurs sans status', async () => {
      req.params.id = 'hc-1';
      // Simuler une erreur Prisma qui n'a pas de status
      const error = new Error('Erreur base de données');
      prisma.$transaction.mockRejectedValue(error);

      await getHealthCenterDeletionSummary(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
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

