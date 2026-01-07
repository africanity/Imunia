// tests/unit/superadminController.test.js

const {
  requireSuperAdmin,
  getAllEntities,
  getEntityDetails,
  updateEntity,
  getEntityDeletionSummary,
  deleteEntity,
  getAllUsers,
  getUserDetails,
  createUser,
  updateUser,
  getUserDeletionSummary,
  deleteUser,
  getAppSettings,
  updateAppSettings,
} = require('../../src/controllers/superadminController');

const prisma = require('../../src/config/prismaClient');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const emailService = require('../../src/services/emailService');
const eventLogService = require('../../src/services/eventLogService');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  region: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  commune: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  district: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  healthCenter: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  children: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  stockREGIONAL: {
    deleteMany: jest.fn(),
  },
  stockDISTRICT: {
    deleteMany: jest.fn(),
  },
  stockHEALTHCENTER: {
    deleteMany: jest.fn(),
  },
  appSettings: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((callback) => {
    const mockPrisma = require('../../src/config/prismaClient');
    const mockTx = {
      region: mockPrisma.region,
      commune: mockPrisma.commune,
      district: mockPrisma.district,
      healthCenter: mockPrisma.healthCenter,
      user: mockPrisma.user,
      children: mockPrisma.children,
      stockREGIONAL: mockPrisma.stockREGIONAL,
      stockDISTRICT: mockPrisma.stockDISTRICT,
      stockHEALTHCENTER: mockPrisma.stockHEALTHCENTER,
    };
    return callback(mockTx);
  }),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

jest.mock('../../src/services/tokenService', () => ({
  generateActivationToken: jest.fn(() => ({
    token: 'activation-token-123',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })),
}));

jest.mock('../../src/controllers/regionController', () => ({
  getRegionDeletionSummary: jest.fn(),
  deleteRegion: jest.fn(),
}));

jest.mock('../../src/controllers/communeController', () => ({
  getCommuneDeletionSummary: jest.fn(),
  deleteCommune: jest.fn(),
}));

jest.mock('../../src/controllers/districtController', () => ({
  getDistrictDeletionSummary: jest.fn(),
  deleteDistrict: jest.fn(),
}));

jest.mock('../../src/controllers/healthCenterController', () => ({
  getHealthCenterDeletionSummary: jest.fn(),
  deleteHealthCenter: jest.fn(),
}));

jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn(),
  },
}));

jest.mock('../../src/services/emailService', () => ({
  sendInvitationEmail: jest.fn(),
  sendSuperAdminEntityNotification: jest.fn(),
  sendSuperAdminUserNotification: jest.fn(),
  sendSuperAdminSettingsNotification: jest.fn(),
}));

jest.mock('../../src/services/eventLogService', () => ({
  logEventAsync: jest.fn(),
}));

describe('superadminController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {
        id: 'superadmin-1',
        role: 'SUPERADMIN',
      },
      params: {},
      query: {},
      body: {},
      file: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('requireSuperAdmin', () => {
    it('devrait appeler next() si utilisateur est SUPERADMIN', () => {
      req.user.role = 'SUPERADMIN';
      requireSuperAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('devrait retourner 403 si utilisateur n\'est pas SUPERADMIN', () => {
      req.user = { role: 'NATIONAL' };
      requireSuperAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé. Rôle superadmin requis.',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getAllEntities', () => {
    it('devrait retourner toutes les entités sans filtres', async () => {
      const mockRegions = [{ id: 'region-1', name: 'Region 1' }];
      const mockCommunes = [{ id: 'commune-1', name: 'Commune 1' }];
      const mockDistricts = [{ id: 'district-1', name: 'District 1' }];
      const mockHealthCenters = [{ id: 'hc-1', name: 'Health Center 1' }];

      prisma.region.findMany.mockResolvedValue(mockRegions);
      prisma.commune.findMany.mockResolvedValue(mockCommunes);
      prisma.district.findMany.mockResolvedValue(mockDistricts);
      prisma.healthCenter.findMany.mockResolvedValue(mockHealthCenters);

      await getAllEntities(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        regions: mockRegions,
        communes: mockCommunes,
        districts: mockDistricts,
        healthCenters: mockHealthCenters,
      });
    });

    it('devrait filtrer par regionId', async () => {
      req.query.regionId = 'region-1';
      prisma.region.findMany.mockResolvedValue([]);
      prisma.commune.findMany.mockResolvedValue([]);
      prisma.district.findMany.mockResolvedValue([]);
      prisma.healthCenter.findMany.mockResolvedValue([]);

      await getAllEntities(req, res, next);

      expect(prisma.region.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'region-1' },
        })
      );
    });

    it('devrait filtrer par districtId', async () => {
      req.query.districtId = 'district-1';
      const mockDistrict = {
        id: 'district-1',
        commune: {
          regionId: 'region-1',
        },
      };
      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.region.findMany.mockResolvedValue([]);
      prisma.commune.findMany.mockResolvedValue([]);
      prisma.district.findMany.mockResolvedValue([]);
      prisma.healthCenter.findMany.mockResolvedValue([]);

      await getAllEntities(req, res, next);

      expect(prisma.district.findUnique).toHaveBeenCalled();
      expect(prisma.district.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'district-1' },
        })
      );
    });

    it('devrait retourner 404 si district non trouvé', async () => {
      req.query.districtId = 'district-inexistant';
      prisma.district.findUnique.mockResolvedValue(null);

      await getAllEntities(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'District non trouvé',
      });
    });

    it('devrait filtrer par healthCenterId', async () => {
      req.query.healthCenterId = 'hc-1';
      const mockHealthCenter = {
        id: 'hc-1',
        district: {
          id: 'district-1',
          commune: {
            regionId: 'region-1',
          },
        },
      };
      prisma.healthCenter.findUnique.mockResolvedValue(mockHealthCenter);
      prisma.region.findMany.mockResolvedValue([]);
      prisma.commune.findMany.mockResolvedValue([]);
      prisma.district.findMany.mockResolvedValue([]);
      prisma.healthCenter.findMany.mockResolvedValue([]);

      await getAllEntities(req, res, next);

      expect(prisma.healthCenter.findUnique).toHaveBeenCalled();
      expect(prisma.healthCenter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'hc-1' },
        })
      );
    });

    it('devrait retourner 404 si healthCenter non trouvé', async () => {
      req.query.healthCenterId = 'hc-inexistant';
      prisma.healthCenter.findUnique.mockResolvedValue(null);

      await getAllEntities(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Centre de santé non trouvé',
      });
    });

    it('devrait gérer les erreurs', async () => {
      prisma.region.findMany.mockRejectedValue(new Error('DB Error'));

      await getAllEntities(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getEntityDetails', () => {
    it('devrait retourner les détails d\'une région', async () => {
      req.params.type = 'region';
      req.params.id = 'region-1';
      const mockRegion = {
        id: 'region-1',
        name: 'Region 1',
        communes: [],
        users: [],
      };

      prisma.region.findUnique.mockResolvedValue(mockRegion);

      await getEntityDetails(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockRegion);
    });

    it('devrait retourner les détails d\'une commune', async () => {
      req.params.type = 'commune';
      req.params.id = 'commune-1';
      const mockCommune = {
        id: 'commune-1',
        name: 'Commune 1',
        region: { id: 'region-1', name: 'Region 1' },
        districts: [],
      };

      prisma.commune.findUnique.mockResolvedValue(mockCommune);

      await getEntityDetails(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockCommune);
    });

    it('devrait retourner les détails d\'un district', async () => {
      req.params.type = 'district';
      req.params.id = 'district-1';
      const mockDistrict = {
        id: 'district-1',
        name: 'District 1',
        commune: { region: { id: 'region-1', name: 'Region 1' } },
        healthCenters: [],
        users: [],
      };

      prisma.district.findUnique.mockResolvedValue(mockDistrict);

      await getEntityDetails(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockDistrict);
    });

    it('devrait retourner les détails d\'un healthcenter', async () => {
      req.params.type = 'healthcenter';
      req.params.id = 'hc-1';
      const mockHealthCenter = {
        id: 'hc-1',
        name: 'Health Center 1',
        district: {
          commune: {
            region: { id: 'region-1', name: 'Region 1' },
          },
        },
        users: [],
      };

      prisma.healthCenter.findUnique.mockResolvedValue(mockHealthCenter);

      await getEntityDetails(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockHealthCenter);
    });

    it('devrait retourner 404 si entité non trouvée', async () => {
      req.params.type = 'region';
      req.params.id = 'region-inexistant';
      prisma.region.findUnique.mockResolvedValue(null);

      await getEntityDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Entité non trouvée',
      });
    });

    it('devrait retourner 400 si type invalide', async () => {
      req.params.type = 'invalid';
      req.params.id = 'id-1';

      await getEntityDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Type d\'entité invalide',
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.params.type = 'region';
      req.params.id = 'region-1';
      prisma.region.findUnique.mockRejectedValue(new Error('DB Error'));

      await getEntityDetails(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateEntity', () => {
    it('devrait mettre à jour une région avec succès', async () => {
      req.params.type = 'region';
      req.params.id = 'region-1';
      req.body.name = 'Region Updated';
      req.body.address = 'New Address';

      const mockRegion = {
        id: 'region-1',
        name: 'Region Updated',
        address: 'New Address',
      };

      prisma.region.findUnique.mockResolvedValue({ id: 'region-1' });
      prisma.region.update.mockResolvedValue(mockRegion);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', email: 'test@test.com' },
      ]);
      emailService.sendSuperAdminEntityNotification.mockResolvedValue();
      eventLogService.logEventAsync.mockResolvedValue();

      await updateEntity(req, res, next);

      expect(prisma.region.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Region Updated',
        })
      );
    });

    it('devrait mettre à jour une commune avec succès', async () => {
      req.params.type = 'commune';
      req.params.id = 'commune-1';
      req.body.name = 'Commune Updated';

      const mockCommune = {
        id: 'commune-1',
        name: 'Commune Updated',
      };

      prisma.commune.findUnique.mockResolvedValue({ id: 'commune-1' });
      prisma.commune.update.mockResolvedValue(mockCommune);
      prisma.user.findMany.mockResolvedValue([]);
      emailService.sendSuperAdminEntityNotification.mockResolvedValue();
      eventLogService.logEventAsync.mockResolvedValue();

      await updateEntity(req, res, next);

      expect(prisma.commune.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockCommune);
    });

    it('devrait mettre à jour un district avec succès', async () => {
      req.params.type = 'district';
      req.params.id = 'district-1';
      req.body.name = 'District Updated';

      const mockDistrict = {
        id: 'district-1',
        name: 'District Updated',
      };

      prisma.district.findUnique.mockResolvedValue({ id: 'district-1' });
      prisma.district.update.mockResolvedValue(mockDistrict);
      prisma.user.findMany.mockResolvedValue([]);
      emailService.sendSuperAdminEntityNotification.mockResolvedValue();
      eventLogService.logEventAsync.mockResolvedValue();

      await updateEntity(req, res, next);

      expect(prisma.district.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockDistrict);
    });

    it('devrait mettre à jour un healthcenter avec succès', async () => {
      req.params.type = 'healthcenter';
      req.params.id = 'hc-1';
      req.body.name = 'Health Center Updated';
      req.body.address = 'New Address';

      const mockHealthCenter = {
        id: 'hc-1',
        name: 'Health Center Updated',
        address: 'New Address',
      };

      prisma.healthCenter.findUnique.mockResolvedValue({ id: 'hc-1' });
      prisma.healthCenter.update.mockResolvedValue(mockHealthCenter);
      prisma.user.findMany.mockResolvedValue([]);
      emailService.sendSuperAdminEntityNotification.mockResolvedValue();
      eventLogService.logEventAsync.mockResolvedValue();

      await updateEntity(req, res, next);

      expect(prisma.healthCenter.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(mockHealthCenter);
    });

    it('devrait retourner 400 si nom manquant pour région', async () => {
      req.params.type = 'region';
      req.params.id = 'region-1';
      req.body.name = '';

      await updateEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le nom de la région est requis',
      });
    });

    it('devrait retourner 400 si nom manquant pour commune', async () => {
      req.params.type = 'commune';
      req.params.id = 'commune-1';
      req.body.name = '';

      await updateEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le nom de la commune est requis',
      });
    });

    it('devrait retourner 400 si nom manquant pour district', async () => {
      req.params.type = 'district';
      req.params.id = 'district-1';
      req.body.name = '';

      await updateEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le nom du district est requis',
      });
    });

    it('devrait retourner 400 si nom manquant pour healthcenter', async () => {
      req.params.type = 'healthcenter';
      req.params.id = 'hc-1';
      req.body.name = '';

      await updateEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le nom du centre de santé est requis',
      });
    });

    it('devrait retourner 400 si type invalide', async () => {
      req.params.type = 'invalid';
      req.params.id = 'id-1';
      req.body.name = 'Name';

      await updateEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Type d\'entité invalide',
      });
    });

    it('devrait retourner 404 si entité non trouvée', async () => {
      req.params.type = 'region';
      req.params.id = 'region-inexistant';
      req.body.name = 'Region Updated';

      prisma.region.findUnique.mockResolvedValue(null);
      prisma.region.update.mockRejectedValue({ code: 'P2025' });

      await updateEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Entité non trouvée',
      });
    });

    it('devrait retourner 409 si nom déjà utilisé', async () => {
      req.params.type = 'region';
      req.params.id = 'region-1';
      req.body.name = 'Region Updated';

      prisma.region.findUnique.mockResolvedValue({ id: 'region-1' });
      prisma.region.update.mockRejectedValue({ code: 'P2002' });

      await updateEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Ce nom est déjà utilisé',
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.params.type = 'region';
      req.params.id = 'region-1';
      req.body.name = 'Region Updated';

      prisma.region.findUnique.mockResolvedValue({ id: 'region-1' });
      prisma.region.update.mockRejectedValue(new Error('DB Error'));

      await updateEntity(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getEntityDeletionSummary', () => {
    it('devrait retourner le résumé de suppression pour une région', async () => {
      req.params.type = 'region';
      req.params.id = 'region-1';

      const regionController = require('../../src/controllers/regionController');
      regionController.getRegionDeletionSummary.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.json({
          success: true,
          region: { id: fakeReq.params.id, name: 'Region 1' },
          totals: {
            communes: 5,
            districts: 10,
            healthCenters: 20,
            children: 100,
            users: 3,
          },
        });
      });

      await getEntityDeletionSummary(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          region: expect.any(Object),
          totals: expect.any(Object),
        })
      );
    });

    it('devrait retourner le résumé de suppression pour une commune', async () => {
      req.params.type = 'commune';
      req.params.id = 'commune-1';

      const communeController = require('../../src/controllers/communeController');
      communeController.getCommuneDeletionSummary.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.json({
          success: true,
          commune: { id: fakeReq.params.id, name: 'Commune 1' },
          totals: {
            districts: 3,
            healthCenters: 5,
            children: 50,
          },
        });
      });

      await getEntityDeletionSummary(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          commune: expect.any(Object),
          totals: expect.any(Object),
        })
      );
    });

    it('devrait retourner le résumé de suppression pour un district', async () => {
      req.params.type = 'district';
      req.params.id = 'district-1';

      const districtController = require('../../src/controllers/districtController');
      districtController.getDistrictDeletionSummary.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.json({
          success: true,
          district: { id: fakeReq.params.id, name: 'District 1' },
          totals: {
            healthCenters: 5,
            children: 30,
            users: 2,
          },
        });
      });

      await getEntityDeletionSummary(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          district: expect.any(Object),
          totals: expect.any(Object),
        })
      );
    });

    it('devrait retourner le résumé de suppression pour un healthcenter', async () => {
      req.params.type = 'healthcenter';
      req.params.id = 'hc-1';

      const healthCenterController = require('../../src/controllers/healthCenterController');
      healthCenterController.getHealthCenterDeletionSummary.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.json({
          success: true,
          healthCenter: { id: fakeReq.params.id, name: 'Health Center 1' },
          totals: {
            children: 20,
            users: 1,
          },
        });
      });

      await getEntityDeletionSummary(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          healthCenter: expect.any(Object),
          totals: expect.any(Object),
        })
      );
    });

    it('devrait retourner 400 si type invalide', async () => {
      req.params.type = 'invalid';
      req.params.id = 'id-1';

      await getEntityDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Type d\'entité invalide',
      });
    });

    it('devrait retourner 404 si entité non trouvée', async () => {
      req.params.type = 'region';
      req.params.id = 'region-inexistant';

      const regionController = require('../../src/controllers/regionController');
      regionController.getRegionDeletionSummary.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.status(404).json({ message: 'Région non trouvée' });
      });

      await getEntityDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('devrait gérer les erreurs avec status', async () => {
      req.params.type = 'region';
      req.params.id = 'region-1';

      const regionController = require('../../src/controllers/regionController');
      regionController.getRegionDeletionSummary.mockRejectedValue({
        status: 500,
        message: 'Erreur serveur',
      });

      await getEntityDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Erreur serveur',
      });
    });

    it('devrait gérer les erreurs génériques', async () => {
      req.params.type = 'region';
      req.params.id = 'region-1';

      const regionController = require('../../src/controllers/regionController');
      regionController.getRegionDeletionSummary.mockRejectedValue(new Error('DB Error'));

      await getEntityDeletionSummary(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteEntity', () => {
    it('devrait supprimer une région avec cascade', async () => {
      req.params.type = 'region';
      req.params.id = 'region-1';

      const regionController = require('../../src/controllers/regionController');
      prisma.region.findUnique.mockResolvedValue({
        id: 'region-1',
        name: 'Region 1',
      });
      prisma.user.findMany.mockResolvedValue([]);
      regionController.getRegionDeletionSummary.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.json({
          success: true,
          region: { id: fakeReq.params.id, name: 'Region 1' },
          totals: { communes: 0, districts: 0, healthCenters: 0, children: 0, users: 0 },
        });
      });
      regionController.deleteRegion.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.status(204).end();
      });
      eventLogService.logEventAsync.mockResolvedValue();

      await deleteEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('devrait supprimer une commune avec cascade', async () => {
      req.params.type = 'commune';
      req.params.id = 'commune-1';

      const communeController = require('../../src/controllers/communeController');
      prisma.commune.findUnique.mockResolvedValue({
        id: 'commune-1',
        name: 'Commune 1',
      });
      communeController.getCommuneDeletionSummary.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.json({
          success: true,
          commune: { id: fakeReq.params.id, name: 'Commune 1' },
          totals: { districts: 0, healthCenters: 0, children: 0 },
        });
      });
      communeController.deleteCommune.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.status(204).end();
      });
      eventLogService.logEventAsync.mockResolvedValue();

      await deleteEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('devrait supprimer un district avec cascade', async () => {
      req.params.type = 'district';
      req.params.id = 'district-1';

      const districtController = require('../../src/controllers/districtController');
      prisma.district.findUnique.mockResolvedValue({
        id: 'district-1',
        name: 'District 1',
      });
      prisma.user.findMany.mockResolvedValue([]);
      districtController.getDistrictDeletionSummary.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.json({
          success: true,
          district: { id: fakeReq.params.id, name: 'District 1' },
          totals: { healthCenters: 0, children: 0, users: 0 },
        });
      });
      districtController.deleteDistrict.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.status(204).end();
      });
      eventLogService.logEventAsync.mockResolvedValue();

      await deleteEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('devrait supprimer un healthcenter avec cascade', async () => {
      req.params.type = 'healthcenter';
      req.params.id = 'hc-1';

      const healthCenterController = require('../../src/controllers/healthCenterController');
      prisma.healthCenter.findUnique.mockResolvedValue({
        id: 'hc-1',
        name: 'Health Center 1',
      });
      prisma.user.findMany.mockResolvedValue([]);
      healthCenterController.getHealthCenterDeletionSummary.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.json({
          success: true,
          healthCenter: { id: fakeReq.params.id, name: 'Health Center 1' },
          totals: { children: 0, users: 0 },
        });
      });
      healthCenterController.deleteHealthCenter.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.status(204).end();
      });
      eventLogService.logEventAsync.mockResolvedValue();

      await deleteEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('devrait retourner 400 si type invalide', async () => {
      req.params.type = 'invalid';
      req.params.id = 'id-1';

      await deleteEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Type d\'entité invalide',
      });
    });

    it('devrait retourner 404 si région non trouvée', async () => {
      req.params.type = 'region';
      req.params.id = 'region-inexistant';
      prisma.region.findUnique.mockResolvedValue(null);

      await deleteEntity(req, res, next);

      expect(prisma.region.findUnique).toHaveBeenCalledWith({
        where: { id: 'region-inexistant' },
        select: { name: true },
      });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Région non trouvée',
      });
    });

    it('devrait retourner 404 si district non trouvé', async () => {
      req.params.type = 'district';
      req.params.id = 'district-inexistant';
      prisma.district.findUnique.mockResolvedValue(null);

      await deleteEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'District non trouvé',
      });
    });

    it('devrait retourner 404 si healthcenter non trouvé', async () => {
      req.params.type = 'healthcenter';
      req.params.id = 'hc-inexistant';
      prisma.healthCenter.findUnique.mockResolvedValue(null);

      await deleteEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Centre de santé non trouvé',
      });
    });

    it('devrait retourner 404 si commune non trouvée', async () => {
      req.params.type = 'commune';
      req.params.id = 'commune-inexistant';
      prisma.commune.findUnique.mockResolvedValue(null);

      await deleteEntity(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Commune non trouvée',
      });
    });

    it('devrait gérer les erreurs lors de la récupération de l\'entité', async () => {
      req.params.type = 'region';
      req.params.id = 'region-1';
      prisma.region.findUnique.mockRejectedValue(new Error('DB Error'));

      await deleteEntity(req, res, next);

      // L'erreur est capturée dans le try/catch et retourne une réponse 500
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Erreur lors de la récupération de l\'entité',
      });
    });

    it('devrait gérer les erreurs lors de la suppression', async () => {
      req.params.type = 'region';
      req.params.id = 'region-1';

      const regionController = require('../../src/controllers/regionController');
      prisma.region.findUnique.mockResolvedValue({
        id: 'region-1',
        name: 'Region 1',
      });
      prisma.user.findMany.mockResolvedValue([]);
      regionController.getRegionDeletionSummary.mockImplementation(async (fakeReq, fakeRes) => {
        fakeRes.json({
          success: true,
          region: { id: fakeReq.params.id, name: 'Region 1' },
          totals: { communes: 0, districts: 0, healthCenters: 0, children: 0, users: 0 },
        });
      });
      regionController.deleteRegion.mockImplementation(async (fakeReq, fakeRes) => {
        throw new Error('Erreur lors de la suppression');
      });

      await deleteEntity(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getAllUsers', () => {
    it('devrait retourner tous les utilisateurs sans filtres', async () => {
      const mockUsers = [
        { id: 'user-1', email: 'user1@test.com', role: 'NATIONAL' },
      ];
      prisma.user.findMany.mockResolvedValue(mockUsers);

      await getAllUsers(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ users: mockUsers });
    });

    it('devrait filtrer par rôle', async () => {
      req.query.role = 'NATIONAL';
      prisma.user.findMany.mockResolvedValue([]);

      await getAllUsers(req, res, next);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'NATIONAL',
          }),
        })
      );
    });
  });

  describe('getUserDetails', () => {
    it('devrait retourner les détails d\'un utilisateur', async () => {
      req.params.id = 'user-1';
      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
        role: 'NATIONAL',
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await getUserDetails(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockUser);
    });

    it('devrait retourner 404 si utilisateur non trouvé', async () => {
      req.params.id = 'user-inexistant';
      prisma.user.findUnique.mockResolvedValue(null);

      await getUserDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });
  });

  describe('createUser', () => {
    it('devrait créer un utilisateur NATIONAL avec succès', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        role: 'NATIONAL',
        code: 'CODE123',
      };

      const mockUser = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        role: 'NATIONAL',
        agentLevel: null,
        isActive: false,
        createdAt: new Date(),
      };

      const tokenService = require('../../src/services/tokenService');
      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      prisma.user.findUnique.mockResolvedValue(null); // Email n'existe pas
      prisma.user.findMany.mockResolvedValue([]); // Pour les notifications
      prisma.user.create.mockResolvedValue(mockUser);
      emailService.sendInvitationEmail.mockResolvedValue();

      await createUser(req, res, next);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@test.com',
            role: 'NATIONAL',
            isActive: false,
            activationToken: 'activation-token-123',
            password: '',
          }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            id: 'user-1',
            email: 'john@test.com',
          }),
        })
      );
    });

    it('devrait créer un utilisateur REGIONAL avec succès', async () => {
      req.body = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@test.com',
        role: 'REGIONAL',
        regionId: 'region-1',
      };

      const mockUser = {
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@test.com',
        role: 'REGIONAL',
        agentLevel: null,
        isActive: false,
        createdAt: new Date(),
      };

      const tokenService = require('../../src/services/tokenService');
      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-456',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.region.findUnique.mockResolvedValue({ id: 'region-1', name: 'Region 1' });
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.create.mockResolvedValue(mockUser);
      emailService.sendInvitationEmail.mockResolvedValue();

      await createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait créer un utilisateur DISTRICT avec succès', async () => {
      req.body = {
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob@test.com',
        role: 'DISTRICT',
        districtId: 'district-1',
      };

      const mockUser = {
        id: 'user-3',
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob@test.com',
        role: 'DISTRICT',
        agentLevel: null,
        isActive: false,
        createdAt: new Date(),
      };

      const tokenService = require('../../src/services/tokenService');
      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-789',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.district.findUnique.mockResolvedValue({
        id: 'district-1',
        commune: {
          regionId: 'region-1',
          region: { name: 'Region 1' },
        },
      });
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.create.mockResolvedValue(mockUser);
      emailService.sendInvitationEmail.mockResolvedValue();

      await createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait créer un utilisateur AGENT avec succès', async () => {
      req.body = {
        firstName: 'Alice',
        lastName: 'Williams',
        email: 'alice@test.com',
        role: 'AGENT',
        healthCenterId: 'hc-1',
        agentLevel: 'ADMIN',
      };

      const mockUser = {
        id: 'user-4',
        firstName: 'Alice',
        lastName: 'Williams',
        email: 'alice@test.com',
        role: 'AGENT',
        agentLevel: 'ADMIN',
        isActive: false,
        createdAt: new Date(),
      };

      const tokenService = require('../../src/services/tokenService');
      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-abc',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.healthCenter.findUnique.mockResolvedValue({
        id: 'hc-1',
        name: 'Health Center 1',
        districtId: 'district-1',
        district: {
          commune: {
            regionId: 'region-1',
          },
        },
      });
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.create.mockResolvedValue(mockUser);
      emailService.sendInvitationEmail.mockResolvedValue();

      await createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait retourner 400 si rôle invalide', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        role: 'INVALID',
      };

      await createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Rôle invalide',
      });
    });

    it('devrait retourner 400 si email déjà utilisé', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'existing@test.com',
        role: 'NATIONAL',
      };

      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'existing@test.com',
      });

      await createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Cet email est déjà utilisé',
      });
    });

    it('devrait retourner 400 si email manquant', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        role: 'NATIONAL',
      };

      await createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Les champs prénom, nom et email sont obligatoires',
      });
    });

    it('devrait retourner 400 si regionId manquant pour REGIONAL', async () => {
      req.body = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@test.com',
        role: 'REGIONAL',
      };

      prisma.user.findUnique.mockResolvedValue(null);

      await createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'La région est obligatoire pour un utilisateur régional',
      });
    });

    it('devrait retourner 400 si districtId manquant pour DISTRICT', async () => {
      req.body = {
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob@test.com',
        role: 'DISTRICT',
      };

      prisma.user.findUnique.mockResolvedValue(null);

      await createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le district est obligatoire pour un utilisateur district',
      });
    });

    it('devrait retourner 400 si healthCenterId manquant pour AGENT', async () => {
      req.body = {
        firstName: 'Alice',
        lastName: 'Williams',
        email: 'alice@test.com',
        role: 'AGENT',
        agentLevel: 'ADMIN',
      };

      prisma.user.findUnique.mockResolvedValue(null);

      await createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le centre de santé est obligatoire pour un agent',
      });
    });

    it('devrait retourner 400 si agentLevel manquant pour AGENT', async () => {
      req.body = {
        firstName: 'Alice',
        lastName: 'Williams',
        email: 'alice@test.com',
        role: 'AGENT',
        healthCenterId: 'hc-1',
      };

      prisma.user.findUnique.mockResolvedValue(null);

      await createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le niveau d\'agent (ADMIN ou STAFF) est obligatoire',
      });
    });

    it('devrait gérer les erreurs Prisma P2002', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        role: 'NATIONAL',
      };

      const tokenService = require('../../src/services/tokenService');
      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue({ code: 'P2002' });

      await createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Cet email est déjà utilisé',
      });
    });

    it('devrait gérer les erreurs Prisma P2003', async () => {
      req.body = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@test.com',
        role: 'REGIONAL',
        regionId: 'region-inexistant',
      };

      const tokenService = require('../../src/services/tokenService');
      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue({ code: 'P2003' });

      await createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Une référence invalide a été fournie. Veuillez vérifier les informations saisies (région, district ou centre de santé).',
      });
    });

    it('devrait gérer les erreurs génériques', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        role: 'NATIONAL',
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(new Error('DB Error'));

      await createUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateUser', () => {
    it('devrait mettre à jour un utilisateur avec succès', async () => {
      req.params.id = 'user-1';
      req.body = {
        firstName: 'John Updated',
        lastName: 'Doe Updated',
        email: 'john.updated@test.com',
      };

      const existingUser = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        role: 'NATIONAL',
        agentLevel: null,
        isActive: true,
      };

      const mockUser = {
        id: 'user-1',
        firstName: 'John Updated',
        lastName: 'Doe Updated',
        email: 'john.updated@test.com',
        role: 'NATIONAL',
        agentLevel: null,
        isActive: true,
        region: null,
        district: null,
        healthCenter: null,
        updatedAt: new Date(),
      };

      prisma.user.findUnique
        .mockResolvedValueOnce(existingUser) // Vérification existence
        .mockResolvedValueOnce(null); // Vérification email unique
      prisma.user.findMany.mockResolvedValue([]); // Pour les notifications
      prisma.user.update.mockResolvedValue(mockUser);
      emailService.sendSuperAdminUserNotification.mockResolvedValue();
      eventLogService.logEventAsync.mockResolvedValue();

      await updateUser(req, res, next);

      expect(prisma.user.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ user: mockUser });
    });

    it('devrait retourner 404 si utilisateur non trouvé', async () => {
      req.params.id = 'user-inexistant';
      req.body = { firstName: 'John' };
      prisma.user.findUnique.mockResolvedValue(null);

      await updateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getUserDeletionSummary', () => {
    it('devrait retourner le résumé de suppression pour un utilisateur', async () => {
      req.params.id = 'user-1';

      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
        role: 'AGENT',
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
          },
          children: {
            findMany: jest.fn().mockResolvedValue([{ id: 'child-1' }]),
          },
          record: {
            findMany: jest.fn().mockResolvedValue([{ id: 'record-1' }]),
          },
          childVaccineCompleted: {
            findMany: jest.fn().mockResolvedValue([{ id: 'vaccine-1' }]),
          },
          childVaccineScheduled: {
            findMany: jest.fn().mockResolvedValue([{ id: 'scheduled-1' }]),
          },
          childVaccineOverdue: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          pendingStockTransfer: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          vaccineRequest: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          stockExpirationNotification: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          appSettings: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        return callback(mockTx);
      });

      await getUserDeletionSummary(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          user: expect.any(Object),
          totals: expect.any(Object),
          details: expect.any(Object),
        })
      );
    });

    it('devrait retourner 404 si utilisateur non trouvé', async () => {
      req.params.id = 'user-inexistant';

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        try {
          return await callback(mockTx);
        } catch (error) {
          if (error.status === 404) {
            res.status(404).json({ message: error.message });
            return;
          }
          throw error;
        }
      });

      await getUserDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteUser', () => {
    it('devrait supprimer un utilisateur avec succès', async () => {
      req.params.id = 'user-1';
      req.user.id = 'superadmin-1';

      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'NATIONAL',
        regionId: null,
        districtId: null,
        healthCenterId: null,
        agentLevel: null,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.delete.mockResolvedValue({});
      prisma.user.findMany.mockResolvedValue([]); // Pour les notifications
      eventLogService.logEventAsync.mockResolvedValue();

      await deleteUser(req, res, next);

      expect(prisma.user.delete).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur supprimé avec succès',
      });
    });

    it('devrait retourner 400 si utilisateur essaie de se supprimer lui-même', async () => {
      req.params.id = 'superadmin-1';
      req.user.id = 'superadmin-1';

      const mockUser = {
        id: 'superadmin-1',
        email: 'superadmin@test.com',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPERADMIN',
        regionId: null,
        districtId: null,
        healthCenterId: null,
        agentLevel: null,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await deleteUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Vous ne pouvez pas supprimer votre propre compte',
      });
    });
  });

  describe('deleteUser', () => {
    it('devrait supprimer un utilisateur avec succès', async () => {
      req.params.id = 'user-1';
      req.user.id = 'superadmin-1';

      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'NATIONAL',
        regionId: null,
        districtId: null,
        healthCenterId: null,
        agentLevel: null,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.delete.mockResolvedValue({});
      prisma.user.findMany.mockResolvedValue([]); // Pour les notifications
      eventLogService.logEventAsync.mockResolvedValue();

      await deleteUser(req, res, next);

      expect(prisma.user.delete).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur supprimé avec succès',
      });
    });

    it('devrait retourner 400 si utilisateur essaie de se supprimer lui-même', async () => {
      req.params.id = 'superadmin-1';
      req.user.id = 'superadmin-1';

      const mockUser = {
        id: 'superadmin-1',
        email: 'superadmin@test.com',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPERADMIN',
        regionId: null,
        districtId: null,
        healthCenterId: null,
        agentLevel: null,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await deleteUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Vous ne pouvez pas supprimer votre propre compte',
      });
    });

    it('devrait retourner 404 si utilisateur non trouvé', async () => {
      req.params.id = 'user-inexistant';
      prisma.user.findUnique.mockResolvedValue(null);

      await deleteUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getAppSettings', () => {
    it('devrait retourner les paramètres de l\'application', async () => {
      const mockSettings = {
        id: 'settings-1',
        appName: 'Test App',
        logoPath: '/uploads/logo.png',
      };

      prisma.appSettings.findFirst.mockResolvedValue(mockSettings);

      await getAppSettings(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        appName: 'Test App',
        logoPath: '/uploads/logo.png',
        hasCustomName: true,
        hasCustomLogo: true,
      });
    });

    it('devrait retourner les valeurs par défaut si aucun paramètre', async () => {
      prisma.appSettings.findFirst.mockResolvedValue(null);
      prisma.appSettings.create.mockResolvedValue({
        id: 'settings-1',
        appName: null,
        logoPath: null,
      });

      await getAppSettings(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        appName: 'Imunia',
        logoPath: '/logo.png',
        hasCustomName: false,
        hasCustomLogo: false,
      });
    });
  });

  describe('updateAppSettings', () => {
    it('devrait mettre à jour les paramètres avec un nouveau nom', async () => {
      req.body = { appName: 'New App Name' };

      const mockSettings = {
        id: 'settings-1',
        appName: 'New App Name',
        logoPath: '/logo.png',
      };

      prisma.appSettings.findFirst.mockResolvedValue({ id: 'settings-1', appName: 'Old App Name', logoPath: '/logo.png' });
      prisma.appSettings.update.mockResolvedValue(mockSettings);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', email: 'user@test.com' },
      ]);
      emailService.sendSuperAdminSettingsNotification.mockResolvedValue();

      await updateAppSettings(req, res, next);

      expect(prisma.appSettings.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        appName: 'New App Name',
        logoPath: '/logo.png',
        hasCustomName: true,
        hasCustomLogo: true,
      });
    });

    it('devrait créer les paramètres s\'ils n\'existent pas', async () => {
      req.body = { appName: 'New App Name' };

      prisma.appSettings.findFirst.mockResolvedValue(null);
      prisma.appSettings.create.mockResolvedValue({
        id: 'settings-1',
        appName: 'New App Name',
        logoPath: null,
      });
      prisma.user.findMany.mockResolvedValue([]);
      emailService.sendSuperAdminSettingsNotification.mockResolvedValue();

      await updateAppSettings(req, res, next);

      expect(prisma.appSettings.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('devrait gérer l\'upload d\'un nouveau logo', async () => {
      req.body = { appName: 'Test App' };
      req.file = {
        filename: 'logo-123456789.png',
        path: '/tmp/logo-123456789.png',
      };

      const mockSettings = {
        id: 'settings-1',
        appName: 'Test App',
        logoPath: '/uploads/logo-123456789.png',
      };

      prisma.appSettings.findFirst.mockResolvedValue({
        id: 'settings-1',
        logoPath: '/uploads/old-logo.png',
      });
      prisma.appSettings.update.mockResolvedValue(mockSettings);
      prisma.user.findMany.mockResolvedValue([]);
      fs.unlink.mockResolvedValue();
      emailService.sendSuperAdminSettingsNotification.mockResolvedValue();

      await updateAppSettings(req, res, next);

      expect(prisma.appSettings.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('devrait supprimer le logo si logoPath est vide string', async () => {
      req.body = { logoPath: '' };

      const mockSettings = {
        id: 'settings-1',
        appName: 'Test App',
        logoPath: null,
      };

      prisma.appSettings.findFirst.mockResolvedValue({
        id: 'settings-1',
        logoPath: '/uploads/old-logo.png',
      });
      prisma.appSettings.update.mockResolvedValue(mockSettings);
      prisma.user.findMany.mockResolvedValue([]);
      fs.unlink.mockResolvedValue();
      emailService.sendSuperAdminSettingsNotification.mockResolvedValue();

      await updateAppSettings(req, res, next);

      expect(fs.unlink).toHaveBeenCalled();
      expect(prisma.appSettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            logoPath: null,
          }),
        })
      );
    });

    it('devrait garder l\'ancien logo si aucun nouveau logo n\'est fourni', async () => {
      req.body = { appName: 'Test App' };

      const mockSettings = {
        id: 'settings-1',
        appName: 'Test App',
        logoPath: '/uploads/existing-logo.png',
      };

      prisma.appSettings.findFirst.mockResolvedValue({
        id: 'settings-1',
        appName: 'Old App Name',
        logoPath: '/uploads/existing-logo.png',
      });
      prisma.appSettings.update.mockResolvedValue(mockSettings);
      prisma.user.findMany.mockResolvedValue([]);
      emailService.sendSuperAdminSettingsNotification.mockResolvedValue();

      await updateAppSettings(req, res, next);

      expect(prisma.appSettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            logoPath: '/uploads/existing-logo.png',
          }),
        })
      );
    });

    it('devrait gérer les erreurs lors de la suppression de l\'ancien logo', async () => {
      req.body = { appName: 'Test App' };
      req.file = {
        filename: 'logo-123456789.png',
        path: '/tmp/logo-123456789.png',
      };

      const mockSettings = {
        id: 'settings-1',
        appName: 'Test App',
        logoPath: '/uploads/logo-123456789.png',
      };

      prisma.appSettings.findFirst.mockResolvedValue({
        id: 'settings-1',
        logoPath: '/uploads/old-logo.png',
      });
      prisma.appSettings.update.mockResolvedValue(mockSettings);
      prisma.user.findMany.mockResolvedValue([]);
      fs.unlink.mockRejectedValue(new Error('File not found'));
      emailService.sendSuperAdminSettingsNotification.mockResolvedValue();

      await updateAppSettings(req, res, next);

      expect(prisma.appSettings.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.body = { appName: 'Test App' };
      prisma.appSettings.findFirst.mockRejectedValue(new Error('DB Error'));

      await updateAppSettings(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
