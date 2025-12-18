// tests/unit/campaignController.test.js

const {
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  addMedia,
  removeMedia,
} = require('../../src/controllers/campaignController');

const prisma = require('../../src/config/prismaClient');
const notificationService = require('../../src/services/notificationService');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  campaign: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  region: {
    findUnique: jest.fn(),
  },
  district: {
    findUnique: jest.fn(),
  },
  healthCenter: {
    findMany: jest.fn(),
  },
  children: {
    findMany: jest.fn(),
  },
}));

jest.mock('../../src/services/notificationService', () => ({
  notifyNewCampaign: jest.fn(),
}));

// Mock setImmediate pour les tests
const setImmediateSpy = jest.fn((callback) => {
  // Exécuter immédiatement pour les tests
  return setTimeout(callback, 0);
});
global.setImmediate = setImmediateSpy;

describe('campaignController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {},
      body: {},
      params: {},
      query: {},
      file: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    jest.clearAllMocks();
    setImmediateSpy.mockClear();
  });

  describe('getCampaigns', () => {
    it('devrait retourner toutes les campagnes pour NATIONAL', async () => {
      req.user.role = 'NATIONAL';

      const mockCampaigns = [
        {
          id: 'campaign-1',
          title: 'Campagne 1',
          description: 'Description 1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          region: {
            id: 'region-1',
            name: 'Region 1',
          },
        },
      ];

      prisma.campaign.findMany.mockResolvedValue(mockCampaigns);

      await getCampaigns(req, res, next);

      expect(prisma.campaign.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          region: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          startDate: 'desc',
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        campaigns: mockCampaigns,
      });
    });

    it('devrait filtrer par région pour REGIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';

      const mockCampaigns = [
        {
          id: 'campaign-1',
          title: 'Campagne 1',
          region: {
            id: 'region-1',
            name: 'Region 1',
          },
        },
      ];

      prisma.campaign.findMany.mockResolvedValue(mockCampaigns);

      await getCampaigns(req, res, next);

      expect(prisma.campaign.findMany).toHaveBeenCalledWith({
        where: {
          regionId: 'region-1',
        },
        include: {
          region: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          startDate: 'desc',
        },
      });
    });

    it('devrait filtrer par région du district pour DISTRICT', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';

      const mockDistrict = {
        id: 'district-1',
        commune: {
          regionId: 'region-1',
        },
      };

      const mockCampaigns = [
        {
          id: 'campaign-1',
          title: 'Campagne 1',
          region: {
            id: 'region-1',
            name: 'Region 1',
          },
        },
      ];

      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.campaign.findMany.mockResolvedValue(mockCampaigns);

      await getCampaigns(req, res, next);

      expect(prisma.district.findUnique).toHaveBeenCalledWith({
        where: { id: 'district-1' },
        select: {
          commune: {
            select: {
              regionId: true,
            },
          },
        },
      });
      expect(prisma.campaign.findMany).toHaveBeenCalledWith({
        where: {
          regionId: 'region-1',
        },
        include: {
          region: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          startDate: 'desc',
        },
      });
    });

    it('devrait retourner une liste vide si DISTRICT sans districtId', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = null;

      await getCampaigns(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        campaigns: [],
      });
    });

    it('devrait retourner une liste vide si district sans commune.regionId', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';

      const mockDistrict = {
        id: 'district-1',
        commune: null,
      };

      prisma.district.findUnique.mockResolvedValue(mockDistrict);

      await getCampaigns(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        campaigns: [],
      });
    });

    it('devrait gérer les erreurs', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      req.user.role = 'NATIONAL';

      prisma.campaign.findMany.mockRejectedValue(new Error('DB Error'));

      await getCampaigns(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('createCampaign', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'AGENT';

      await createCampaign(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 400 si champs obligatoires manquants', async () => {
      req.user.role = 'NATIONAL';
      req.body = {};

      await createCampaign(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le titre, la date de début et la date de fin sont requis',
      });
    });

    it('devrait retourner 400 si REGIONAL sans regionId', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = null;
      req.body = {
        title: 'Campagne Test',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      await createCampaign(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Votre compte n\'est pas associé à une région',
      });
    });

    it('devrait retourner 400 si NATIONAL sans regionId', async () => {
      req.user.role = 'NATIONAL';
      req.body = {
        title: 'Campagne Test',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      await createCampaign(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'La région est requise',
      });
    });

    it('devrait retourner 404 si région introuvable', async () => {
      req.user.role = 'NATIONAL';
      req.body = {
        title: 'Campagne Test',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        regionId: 'region-inexistant',
      };

      prisma.region.findUnique.mockResolvedValue(null);

      await createCampaign(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Région introuvable',
      });
    });

    it('devrait créer une campagne avec succès pour NATIONAL', async () => {
      req.user.role = 'NATIONAL';
      req.body = {
        title: 'Campagne Test',
        description: 'Description test',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        regionId: 'region-1',
      };

      const mockRegion = {
        id: 'region-1',
        name: 'Region 1',
      };

      const mockCampaign = {
        id: 'campaign-1',
        title: 'Campagne Test',
        description: 'Description test',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        regionId: 'region-1',
        medias: [],
        region: {
          id: 'region-1',
          name: 'Region 1',
        },
      };

      prisma.region.findUnique.mockResolvedValue(mockRegion);
      prisma.campaign.create.mockResolvedValue(mockCampaign);
      prisma.healthCenter.findMany.mockResolvedValue([]);
      prisma.children.findMany.mockResolvedValue([]);

      await createCampaign(req, res, next);

      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: {
          title: 'Campagne Test',
          description: 'Description test',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          regionId: 'region-1',
          medias: [],
        },
        include: {
          region: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCampaign);
    });

    it('devrait utiliser regionId de l\'utilisateur pour REGIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.body = {
        title: 'Campagne Test',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        regionId: 'region-other', // Ignoré
      };

      const mockRegion = {
        id: 'region-1',
        name: 'Region 1',
      };

      const mockCampaign = {
        id: 'campaign-1',
        title: 'Campagne Test',
        regionId: 'region-1',
        medias: [],
        region: {
          id: 'region-1',
          name: 'Region 1',
        },
      };

      prisma.region.findUnique.mockResolvedValue(mockRegion);
      prisma.campaign.create.mockResolvedValue(mockCampaign);
      prisma.healthCenter.findMany.mockResolvedValue([]);
      prisma.children.findMany.mockResolvedValue([]);

      await createCampaign(req, res, next);

      expect(prisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            regionId: 'region-1', // Utilise req.user.regionId
          }),
        })
      );
    });

    it('devrait créer des notifications pour les enfants après la réponse', async () => {
      req.user.role = 'NATIONAL';
      req.body = {
        title: 'Campagne Test',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        regionId: 'region-1',
      };

      const mockRegion = {
        id: 'region-1',
        name: 'Region 1',
      };

      const mockCampaign = {
        id: 'campaign-1',
        title: 'Campagne Test',
        regionId: 'region-1',
        medias: [],
        region: {
          id: 'region-1',
          name: 'Region 1',
        },
      };

      const mockHealthCenters = [
        { id: 'hc-1' },
        { id: 'hc-2' },
      ];

      const mockChildren = [
        { id: 'child-1' },
        { id: 'child-2' },
      ];

      prisma.region.findUnique.mockResolvedValue(mockRegion);
      prisma.campaign.create.mockResolvedValue(mockCampaign);
      prisma.healthCenter.findMany.mockResolvedValue(mockHealthCenters);
      prisma.children.findMany.mockResolvedValue(mockChildren);
      notificationService.notifyNewCampaign.mockResolvedValue({ success: true });

      await createCampaign(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      
      // Vérifier que setImmediate a été appelé
      expect(setImmediateSpy).toHaveBeenCalled();
      
      // Mock console.log pour éviter la pollution de la sortie
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      // Exécuter le callback de setImmediate
      const setImmediateCallback = setImmediateSpy.mock.calls[0][0];
      await setImmediateCallback();
      
      consoleLogSpy.mockRestore();

      expect(prisma.healthCenter.findMany).toHaveBeenCalledWith({
        where: {
          district: {
            commune: {
              regionId: 'region-1',
            },
          },
        },
        select: {
          id: true,
        },
      });
      expect(prisma.children.findMany).toHaveBeenCalledWith({
        where: {
          healthCenterId: {
            in: ['hc-1', 'hc-2'],
          },
        },
        select: {
          id: true,
        },
      });
      expect(notificationService.notifyNewCampaign).toHaveBeenCalledTimes(2);
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      req.body = {
        title: 'Campagne Test',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        regionId: 'region-1',
      };

      prisma.region.findUnique.mockRejectedValue(new Error('DB Error'));

      await createCampaign(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateCampaign', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'AGENT';
      req.params = { id: 'campaign-1' };

      await updateCampaign(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 404 si campagne introuvable', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-inexistant' };

      prisma.campaign.findUnique.mockResolvedValue(null);

      await updateCampaign(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Campagne introuvable',
      });
    });

    it('devrait retourner 403 si REGIONAL essaie de modifier une campagne d\'une autre région', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params = { id: 'campaign-1' };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-2', // Autre région
        region: {
          id: 'region-2',
          name: 'Region 2',
        },
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);

      await updateCampaign(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Vous ne pouvez modifier que les campagnes de votre région',
      });
    });

    it('devrait mettre à jour une campagne avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.body = {
        title: 'Campagne Mise à Jour',
        description: 'Nouvelle description',
      };

      const mockCampaign = {
        id: 'campaign-1',
        title: 'Campagne Originale',
        regionId: 'region-1',
        region: {
          id: 'region-1',
          name: 'Region 1',
        },
      };

      const mockUpdated = {
        id: 'campaign-1',
        title: 'Campagne Mise à Jour',
        description: 'Nouvelle description',
        regionId: 'region-1',
        region: {
          id: 'region-1',
          name: 'Region 1',
        },
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.campaign.update.mockResolvedValue(mockUpdated);

      await updateCampaign(req, res, next);

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: {
          title: 'Campagne Mise à Jour',
          description: 'Nouvelle description',
        },
        include: {
          region: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait vérifier la nouvelle région si regionId change', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.body = {
        regionId: 'region-2',
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        region: {
          id: 'region-1',
          name: 'Region 1',
        },
      };

      const mockNewRegion = {
        id: 'region-2',
        name: 'Region 2',
      };

      const mockUpdated = {
        id: 'campaign-1',
        regionId: 'region-2',
        region: {
          id: 'region-2',
          name: 'Region 2',
        },
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.region.findUnique.mockResolvedValue(mockNewRegion);
      prisma.campaign.update.mockResolvedValue(mockUpdated);

      await updateCampaign(req, res, next);

      expect(prisma.region.findUnique).toHaveBeenCalledWith({
        where: { id: 'region-2' },
      });
      expect(prisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            regionId: 'region-2',
          }),
        })
      );
    });

    it('devrait retourner 404 si nouvelle région introuvable', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.body = {
        regionId: 'region-inexistant',
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        region: {
          id: 'region-1',
          name: 'Region 1',
        },
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.region.findUnique.mockResolvedValue(null);

      await updateCampaign(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Région introuvable',
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };

      prisma.campaign.findUnique.mockRejectedValue(new Error('DB Error'));

      await updateCampaign(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteCampaign', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'AGENT';
      req.params = { id: 'campaign-1' };

      await deleteCampaign(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 404 si campagne introuvable', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-inexistant' };

      prisma.campaign.findUnique.mockResolvedValue(null);

      await deleteCampaign(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Campagne introuvable',
      });
    });

    it('devrait retourner 403 si REGIONAL essaie de supprimer une campagne d\'une autre région', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params = { id: 'campaign-1' };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-2', // Autre région
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);

      await deleteCampaign(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Vous ne pouvez supprimer que les campagnes de votre région',
      });
    });

    it('devrait supprimer une campagne avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.campaign.delete.mockResolvedValue(mockCampaign);

      await deleteCampaign(req, res, next);

      expect(prisma.campaign.delete).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };

      prisma.campaign.findUnique.mockRejectedValue(new Error('DB Error'));

      await deleteCampaign(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('addMedia', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'AGENT';
      req.params = { id: 'campaign-1' };

      await addMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 400 si fichier uploadé avec extension non supportée', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.file = {
        filename: 'test.jpg',
        originalname: 'test.jpg',
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        medias: [],
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);

      await addMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Type de fichier non supporté',
      });
    });

    it('devrait ajouter un média PDF avec fichier uploadé', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.file = {
        filename: 'document.pdf',
        originalname: 'document.pdf',
      };
      req.body = {
        title: 'Document PDF',
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        medias: [],
      };

      const mockUpdated = {
        id: 'campaign-1',
        medias: [
          {
            url: '/uploads/campaigns/document.pdf',
            type: 'pdf',
            title: 'Document PDF',
          },
        ],
        region: {
          id: 'region-1',
          name: 'Region 1',
        },
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.campaign.update.mockResolvedValue(mockUpdated);

      await addMedia(req, res, next);

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: {
          medias: [
            {
              url: '/uploads/campaigns/document.pdf',
              type: 'pdf',
              title: 'Document PDF',
            },
          ],
        },
        include: {
          region: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait ajouter un média vidéo avec fichier uploadé', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.file = {
        filename: 'video.mp4',
        originalname: 'video.mp4',
      };
      req.body = {
        title: 'Vidéo',
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        medias: [],
      };

      const mockUpdated = {
        id: 'campaign-1',
        medias: [
          {
            url: '/uploads/campaigns/video.mp4',
            type: 'video',
            title: 'Vidéo',
          },
        ],
        region: {
          id: 'region-1',
          name: 'Region 1',
        },
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.campaign.update.mockResolvedValue(mockUpdated);

      await addMedia(req, res, next);

      expect(prisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            medias: expect.arrayContaining([
              expect.objectContaining({
                type: 'video',
              }),
            ]),
          }),
        })
      );
    });

    it('devrait utiliser le nom du fichier comme titre si titre non fourni', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.file = {
        filename: 'document.pdf',
        originalname: 'mon-document.pdf',
      };
      req.body = {}; // Pas de titre

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        medias: [],
      };

      const path = require('path');
      const expectedTitle = path.basename('mon-document.pdf', path.extname('mon-document.pdf'));

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.campaign.update.mockResolvedValue(mockCampaign);

      await addMedia(req, res, next);

      expect(prisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            medias: expect.arrayContaining([
              expect.objectContaining({
                title: expectedTitle,
              }),
            ]),
          }),
        })
      );
    });

    it('devrait ajouter un média avec URL et type dans le body', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.file = null;
      req.body = {
        url: 'https://example.com/video.mp4',
        type: 'video',
        title: 'Vidéo externe',
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        medias: [],
      };

      const mockUpdated = {
        id: 'campaign-1',
        medias: [
          {
            url: 'https://example.com/video.mp4',
            type: 'video',
            title: 'Vidéo externe',
          },
        ],
        region: {
          id: 'region-1',
          name: 'Region 1',
        },
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.campaign.update.mockResolvedValue(mockUpdated);

      await addMedia(req, res, next);

      expect(prisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            medias: expect.arrayContaining([
              expect.objectContaining({
                url: 'https://example.com/video.mp4',
                type: 'video',
                title: 'Vidéo externe',
              }),
            ]),
          }),
        })
      );
    });

    it('devrait retourner 400 si URL ou type manquants dans body', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.file = null;
      req.body = {
        url: 'https://example.com/video.mp4',
        // type manquant
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        medias: [],
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);

      await addMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'L\'URL et le type sont requis, ou un fichier doit être uploadé',
      });
    });

    it('devrait retourner 400 si type invalide dans body', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.file = null;
      req.body = {
        url: 'https://example.com/file.jpg',
        type: 'image', // Type invalide
        title: 'Image',
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        medias: [],
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);

      await addMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le type doit être \'video\' ou \'pdf\'',
      });
    });

    it('devrait retourner 400 si titre manquant', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.file = null;
      req.body = {
        url: 'https://example.com/video.mp4',
        type: 'video',
        // titre manquant
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        medias: [],
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);

      await addMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le titre du média est requis',
      });
    });

    it('devrait retourner 409 si média déjà existant', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.file = null;
      req.body = {
        url: 'https://example.com/video.mp4',
        type: 'video',
        title: 'Vidéo',
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        medias: [
          {
            url: 'https://example.com/video.mp4',
            type: 'video',
            title: 'Vidéo existante',
          },
        ],
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);

      await addMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Ce média existe déjà dans cette campagne',
      });
    });

    it('devrait retourner 404 si campagne introuvable', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-inexistant' };
      req.body = {
        url: 'https://example.com/video.mp4',
        type: 'video',
        title: 'Vidéo',
      };

      prisma.campaign.findUnique.mockResolvedValue(null);

      await addMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Campagne introuvable',
      });
    });

    it('devrait retourner 403 si REGIONAL essaie de modifier une campagne d\'une autre région', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params = { id: 'campaign-1' };
      req.body = {
        url: 'https://example.com/video.mp4',
        type: 'video',
        title: 'Vidéo',
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-2', // Autre région
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);

      await addMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Vous ne pouvez modifier que les campagnes de votre région',
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.body = {
        url: 'https://example.com/video.mp4',
        type: 'video',
        title: 'Vidéo',
      };

      prisma.campaign.findUnique.mockRejectedValue(new Error('DB Error'));

      await addMedia(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('removeMedia', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL ou REGIONAL', async () => {
      req.user.role = 'AGENT';
      req.params = { id: 'campaign-1' };

      await removeMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 400 si URL manquante', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.body = {};

      await removeMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'L\'URL est requise',
      });
    });

    it('devrait retourner 404 si campagne introuvable', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-inexistant' };
      req.body = {
        url: 'https://example.com/video.mp4',
      };

      prisma.campaign.findUnique.mockResolvedValue(null);

      await removeMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Campagne introuvable',
      });
    });

    it('devrait retourner 404 si média introuvable dans la campagne', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.body = {
        url: 'https://example.com/video-inexistant.mp4',
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        medias: [
          {
            url: 'https://example.com/video.mp4',
            type: 'video',
            title: 'Vidéo',
          },
        ],
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);

      await removeMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Média introuvable dans cette campagne',
      });
    });

    it('devrait supprimer un média avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.body = {
        url: 'https://example.com/video.mp4',
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        medias: [
          {
            url: 'https://example.com/video.mp4',
            type: 'video',
            title: 'Vidéo',
          },
          {
            url: 'https://example.com/document.pdf',
            type: 'pdf',
            title: 'Document',
          },
        ],
      };

      const mockUpdated = {
        id: 'campaign-1',
        medias: [
          {
            url: 'https://example.com/document.pdf',
            type: 'pdf',
            title: 'Document',
          },
        ],
        region: {
          id: 'region-1',
          name: 'Region 1',
        },
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.campaign.update.mockResolvedValue(mockUpdated);

      await removeMedia(req, res, next);

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: {
          medias: [
            {
              url: 'https://example.com/document.pdf',
              type: 'pdf',
              title: 'Document',
            },
          ],
        },
        include: {
          region: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait gérer le cas où medias n\'est pas un tableau', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.body = {
        url: 'https://example.com/video.mp4',
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-1',
        medias: null, // Pas un tableau - sera converti en [] par Array.isArray
      };

      const mockUpdated = {
        id: 'campaign-1',
        medias: [], // Résultat après filtrage
        region: {
          id: 'region-1',
          name: 'Region 1',
        },
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      prisma.campaign.update.mockResolvedValue(mockUpdated);

      await removeMedia(req, res, next);

      // Le média n'existe pas dans medias (qui est null), donc filteredMedias sera []
      // et medias.length === filteredMedias.length sera true, donc retourne 404
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Média introuvable dans cette campagne',
      });
    });

    it('devrait retourner 403 si REGIONAL essaie de modifier une campagne d\'une autre région', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params = { id: 'campaign-1' };
      req.body = {
        url: 'https://example.com/video.mp4',
      };

      const mockCampaign = {
        id: 'campaign-1',
        regionId: 'region-2', // Autre région
        medias: [],
      };

      prisma.campaign.findUnique.mockResolvedValue(mockCampaign);

      await removeMedia(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Vous ne pouvez modifier que les campagnes de votre région',
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      req.params = { id: 'campaign-1' };
      req.body = {
        url: 'https://example.com/video.mp4',
      };

      prisma.campaign.findUnique.mockRejectedValue(new Error('DB Error'));

      await removeMedia(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});



