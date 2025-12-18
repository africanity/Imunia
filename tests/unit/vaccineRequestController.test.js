// tests/unit/vaccineRequestController.test.js

const {
  createVaccineRequest,
  getVaccineRequests,
  scheduleVaccineRequest,
  cancelVaccineRequest,
} = require('../../src/controllers/vaccineRequestController');

const prisma = require('../../src/config/prismaClient');
const stockLotService = require('../../src/services/stockLotService');
const emailService = require('../../src/services/emailService');
const notificationService = require('../../src/services/notificationService');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  children: {
    findUnique: jest.fn(),
  },
  vaccine: {
    findUnique: jest.fn(),
  },
  vaccineRequest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  childVaccineScheduled: {
    create: jest.fn(),
    findFirst: jest.fn(),
    aggregate: jest.fn(),
  },
  childVaccineCompleted: {
    aggregate: jest.fn(),
  },
  childVaccineDue: {
    findFirst: jest.fn(),
  },
  childVaccineLate: {
    findFirst: jest.fn(),
  },
  childVaccineOverdue: {
    findFirst: jest.fn(),
  },
  stockReservation: {
    create: jest.fn(),
  },
  $transaction: jest.fn((callback) => {
    const mockPrisma = require('../../src/config/prismaClient');
    const mockTx = {
      children: mockPrisma.children,
      vaccine: mockPrisma.vaccine,
      vaccineRequest: mockPrisma.vaccineRequest,
      childVaccineScheduled: mockPrisma.childVaccineScheduled,
      stockReservation: mockPrisma.stockReservation,
    };
    return callback(mockTx);
  }),
}));

jest.mock('../../src/services/stockLotService', () => ({
  reserveDoseForHealthCenter: jest.fn(),
}));

jest.mock('../../src/services/emailService', () => ({
  sendVaccineRequestEmail: jest.fn(),
}));

jest.mock('../../src/services/notificationService', () => ({
  notifyVaccineScheduled: jest.fn(),
}));

describe('vaccineRequestController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: {
        id: 'user-1',
        role: 'AGENT',
        healthCenterId: 'healthcenter-1',
        districtId: 'district-1',
        regionId: 'region-1',
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

  describe('createVaccineRequest', () => {
    it('devrait créer une demande de vaccin avec succès', async () => {
      req.params.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.vaccineCalendarId = 'calendar-1';
      const mockChild = {
        id: 'child-1',
        firstName: 'John',
        lastName: 'Doe',
        gender: 'M',
        healthCenterId: 'healthcenter-1',
        healthCenter: {
          name: 'Centre de Santé Test',
          district: {
            commune: {
              region: { id: 'region-1' },
            },
          },
        },
      };
      const mockVaccine = {
        id: 'vaccine-1',
        name: 'BCG',
        dosesRequired: 1,
        gender: null,
      };
      const mockRequest = {
        id: 'request-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        vaccineCalendarId: 'calendar-1',
        dose: 1,
        status: 'PENDING',
        child: {
          firstName: 'John',
          lastName: 'Doe',
          healthCenter: { name: 'Centre de Santé Test' },
        },
        vaccine: { name: 'BCG' },
      };
      const mockAgents = [
        { email: 'agent@test.com', firstName: 'Agent', lastName: 'Test' },
      ];

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.vaccine.findUnique.mockResolvedValue(mockVaccine);
      prisma.childVaccineDue.findFirst.mockResolvedValue(null);
      prisma.childVaccineLate.findFirst.mockResolvedValue(null);
      prisma.childVaccineOverdue.findFirst.mockResolvedValue(null);
      prisma.childVaccineScheduled.findFirst.mockResolvedValue(null);
      prisma.childVaccineCompleted.aggregate.mockResolvedValue({ _max: { dose: null } });
      prisma.childVaccineScheduled.aggregate.mockResolvedValue({ _max: { dose: null } });
      prisma.vaccineRequest.aggregate.mockResolvedValue({ _max: { dose: null } });
      prisma.vaccineRequest.findFirst.mockResolvedValue(null);
      prisma.vaccineRequest.create.mockResolvedValue(mockRequest);
      prisma.user.findMany.mockResolvedValue(mockAgents);
      emailService.sendVaccineRequestEmail.mockResolvedValue();

      await createVaccineRequest(req, res, next);

      expect(prisma.vaccineRequest.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.request).toBeDefined();
    });

    it('devrait retourner 400 si vaccineId manquant', async () => {
      req.params.childId = 'child-1';
      await createVaccineRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'vaccineId est requis',
      });
    });

    it('devrait retourner 404 si enfant introuvable', async () => {
      req.params.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      prisma.children.findUnique.mockResolvedValue(null);

      await createVaccineRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Enfant non trouvé',
      });
    });

    it('devrait retourner 404 si vaccin introuvable', async () => {
      req.params.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      const mockChild = {
        id: 'child-1',
        gender: 'M',
        healthCenterId: 'healthcenter-1',
      };
      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.vaccine.findUnique.mockResolvedValue(null);

      await createVaccineRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Vaccin non trouvé',
      });
    });

    it('devrait retourner 400 si vaccin non adapté au genre de l\'enfant', async () => {
      req.params.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      const mockChild = {
        id: 'child-1',
        gender: 'M',
        healthCenterId: 'healthcenter-1',
      };
      const mockVaccine = {
        id: 'vaccine-1',
        name: 'Vaccin Filles',
        dosesRequired: 1,
        gender: 'F', // Pour filles seulement
      };
      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.vaccine.findUnique.mockResolvedValue(mockVaccine);

      await createVaccineRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Ce vaccin n\'est pas adapté au genre de l\'enfant',
      });
    });

    it('devrait permettre de créer une demande même si toutes les doses sont déjà administrées ou programmées (flexibilité)', async () => {
      req.params.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      const mockChild = {
        id: 'child-1',
        firstName: 'John',
        lastName: 'Doe',
        gender: 'M',
        healthCenterId: 'healthcenter-1',
        healthCenter: {
          name: 'Centre de Santé Test',
        },
      };
      const mockVaccine = {
        id: 'vaccine-1',
        name: 'BCG',
        dosesRequired: 1,
        gender: null,
      };
      const mockRequest = {
        id: 'request-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        status: 'PENDING',
        dose: 2,
        child: {
          firstName: 'John',
          lastName: 'Doe',
          healthCenter: {
            name: 'Centre de Santé Test',
          },
        },
        vaccine: {
          name: 'BCG',
        },
      };
      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.vaccine.findUnique.mockResolvedValue(mockVaccine);
      prisma.childVaccineDue.findFirst.mockResolvedValue(null);
      prisma.childVaccineLate.findFirst.mockResolvedValue(null);
      prisma.childVaccineOverdue.findFirst.mockResolvedValue(null);
      prisma.childVaccineScheduled.findFirst.mockResolvedValue(null);
      prisma.childVaccineCompleted.aggregate.mockResolvedValue({ _max: { dose: 1 } });
      prisma.childVaccineScheduled.aggregate.mockResolvedValue({ _max: { dose: null } });
      prisma.vaccineRequest.aggregate.mockResolvedValue({ _max: { dose: null } });
      prisma.vaccineRequest.findFirst.mockResolvedValue(null);
      prisma.vaccineRequest.create.mockResolvedValue(mockRequest);
      prisma.user.findMany.mockResolvedValue([]); // Aucun agent pour simplifier le test

      await createVaccineRequest(req, res, next);

      // Le système permet maintenant de créer des demandes même si toutes les doses sont complétées
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('devrait retourner 400 si une demande en attente existe déjà', async () => {
      req.params.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      const mockChild = {
        id: 'child-1',
        gender: 'M',
        healthCenterId: 'healthcenter-1',
      };
      const mockVaccine = {
        id: 'vaccine-1',
        name: 'BCG',
        dosesRequired: 1,
        gender: null,
      };
      const existingRequest = {
        id: 'request-existing',
        status: 'PENDING',
      };
      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.vaccine.findUnique.mockResolvedValue(mockVaccine);
      prisma.childVaccineDue.findFirst.mockResolvedValue(null);
      prisma.childVaccineLate.findFirst.mockResolvedValue(null);
      prisma.childVaccineOverdue.findFirst.mockResolvedValue(null);
      prisma.childVaccineScheduled.findFirst.mockResolvedValue(null);
      prisma.childVaccineCompleted.aggregate.mockResolvedValue({ _max: { dose: null } });
      prisma.childVaccineScheduled.aggregate.mockResolvedValue({ _max: { dose: null } });
      prisma.vaccineRequest.aggregate.mockResolvedValue({ _max: { dose: null } });
      prisma.vaccineRequest.findFirst.mockResolvedValue(existingRequest);

      await createVaccineRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Une demande est déjà en attente pour cette dose de ce vaccin.',
      });
    });
  });

  describe('getVaccineRequests', () => {
    it('devrait retourner la liste des demandes pour AGENT', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      const mockRequests = [
        {
          id: 'request-1',
          childId: 'child-1',
          vaccineId: 'vaccine-1',
          status: 'PENDING',
          child: {
            id: 'child-1',
            firstName: 'John',
            lastName: 'Doe',
            healthCenter: { id: 'healthcenter-1', name: 'Centre Test' },
          },
          vaccine: {
            id: 'vaccine-1',
            name: 'BCG',
          },
        },
      ];
      prisma.vaccineRequest.findMany.mockResolvedValue(mockRequests);
      prisma.vaccineRequest.count.mockResolvedValue(1);

      await getVaccineRequests(req, res, next);

      expect(prisma.vaccineRequest.findMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        total: 1,
        requests: mockRequests,
      });
    });

    it('devrait filtrer par statut si fourni', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.query.status = 'PENDING';
      prisma.vaccineRequest.findMany.mockResolvedValue([]);
      prisma.vaccineRequest.count.mockResolvedValue(0);

      await getVaccineRequests(req, res, next);

      expect(prisma.vaccineRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
          }),
        }),
      );
    });

    it('devrait filtrer par district pour DISTRICT', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      prisma.vaccineRequest.findMany.mockResolvedValue([]);
      prisma.vaccineRequest.count.mockResolvedValue(0);

      await getVaccineRequests(req, res, next);

      expect(prisma.vaccineRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            child: expect.objectContaining({
              healthCenter: expect.objectContaining({
                districtId: 'district-1',
              }),
            }),
          }),
        }),
      );
    });

    it('devrait filtrer par région pour REGIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      prisma.vaccineRequest.findMany.mockResolvedValue([]);
      prisma.vaccineRequest.count.mockResolvedValue(0);

      await getVaccineRequests(req, res, next);

      expect(prisma.vaccineRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            child: expect.objectContaining({
              healthCenter: expect.objectContaining({
                district: expect.objectContaining({
                  commune: expect.objectContaining({
                    regionId: 'region-1',
                  }),
                }),
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('scheduleVaccineRequest', () => {
    it('devrait programmer une demande avec succès', async () => {
      req.params.id = 'request-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      req.body.notes = 'Notes de programmation';
      const mockRequest = {
        id: 'request-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        vaccineCalendarId: 'calendar-1',
        dose: 1,
        status: 'PENDING',
        child: {
          id: 'child-1',
          healthCenterId: 'healthcenter-1',
          gender: 'M',
        },
        vaccine: {
          id: 'vaccine-1',
          name: 'BCG',
          dosesRequired: 1,
          gender: null,
        },
      };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
      };
      const mockUpdatedRequest = {
        ...mockRequest,
        status: 'SCHEDULED',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        scheduledById: 'user-1',
        appointmentId: 'scheduled-1',
        notes: 'Notes de programmation',
        child: {
          id: 'child-1',
          firstName: 'John',
          lastName: 'Doe',
        },
        vaccine: {
          id: 'vaccine-1',
          name: 'BCG',
        },
        scheduledBy: {
          id: 'user-1',
          firstName: 'Agent',
          lastName: 'Test',
        },
      };

      prisma.vaccineRequest.findUnique.mockResolvedValue(mockRequest);
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          vaccineRequest: {
            findUnique: prisma.vaccineRequest.findUnique,
            update: jest.fn().mockResolvedValue(mockUpdatedRequest),
          },
          childVaccineScheduled: {
            create: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
          children: {
            update: jest.fn().mockResolvedValue({}),
          },
          childVaccineCompleted: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        const result = await callback(mockTx);
        return result;
      });
      notificationService.notifyVaccineScheduled.mockResolvedValue();

      await scheduleVaccineRequest(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Rendez-vous programmé avec succès',
        appointment: mockScheduled,
        request: mockUpdatedRequest,
      });
    });

    it('devrait retourner 400 si scheduledFor manquant', async () => {
      req.params.id = 'request-1';
      await scheduleVaccineRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'scheduledFor est requis',
      });
    });

    it('devrait retourner 400 si date invalide', async () => {
      req.params.id = 'request-1';
      req.body.scheduledFor = 'date-invalide';
      await scheduleVaccineRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'La date de rendez-vous est invalide',
      });
    });

    it('devrait retourner 404 si demande introuvable', async () => {
      req.params.id = 'request-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      prisma.vaccineRequest.findUnique.mockResolvedValue(null);

      await scheduleVaccineRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Demande non trouvée',
      });
    });

    it('devrait retourner 403 si agent n\'appartient pas au même centre de santé', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'request-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockRequest = {
        id: 'request-1',
        status: 'PENDING',
        child: {
          id: 'child-1',
          healthCenterId: 'healthcenter-2', // Différent
          gender: 'M',
        },
        vaccine: {
          id: 'vaccine-1',
          name: 'BCG',
          dosesRequired: 1,
          gender: null,
        },
      };
      prisma.vaccineRequest.findUnique.mockResolvedValue(mockRequest);

      await scheduleVaccineRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 400 si demande déjà traitée', async () => {
      req.params.id = 'request-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockRequest = {
        id: 'request-1',
        status: 'SCHEDULED', // Déjà traitée
        child: {
          id: 'child-1',
          healthCenterId: 'healthcenter-1',
          gender: 'M',
        },
        vaccine: {
          id: 'vaccine-1',
          name: 'BCG',
          dosesRequired: 1,
          gender: null,
        },
      };
      prisma.vaccineRequest.findUnique.mockResolvedValue(mockRequest);

      await scheduleVaccineRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cette demande a déjà été traitée',
      });
    });

    it('devrait retourner 400 si stock insuffisant', async () => {
      req.params.id = 'request-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockRequest = {
        id: 'request-1',
        status: 'PENDING',
        child: {
          id: 'child-1',
          healthCenterId: 'healthcenter-1',
          gender: 'M',
        },
        vaccine: {
          id: 'vaccine-1',
          name: 'BCG',
          dosesRequired: 1,
          gender: null,
        },
      };
      prisma.vaccineRequest.findUnique.mockResolvedValue(mockRequest);
      const stockError = new Error('Stock insuffisant');
      stockError.status = 400;
      stockLotService.reserveDoseForHealthCenter.mockRejectedValue(stockError);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {};
        return callback(mockTx);
      });

      await scheduleVaccineRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Stock insuffisant',
      });
    });
  });

  describe('cancelVaccineRequest', () => {
    it('devrait annuler une demande avec succès', async () => {
      req.params.id = 'request-1';
      const mockRequest = {
        id: 'request-1',
        status: 'PENDING',
        child: {
          healthCenterId: 'healthcenter-1',
        },
      };
      prisma.vaccineRequest.findUnique.mockResolvedValue(mockRequest);
      prisma.vaccineRequest.update.mockResolvedValue({
        ...mockRequest,
        status: 'CANCELLED',
      });

      await cancelVaccineRequest(req, res, next);

      expect(prisma.vaccineRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: { status: 'CANCELLED' },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Demande annulée avec succès',
      });
    });

    it('devrait retourner 404 si demande introuvable', async () => {
      req.params.id = 'request-1';
      prisma.vaccineRequest.findUnique.mockResolvedValue(null);

      await cancelVaccineRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Demande non trouvée',
      });
    });

    it('devrait retourner 403 si agent n\'appartient pas au même centre de santé', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'request-1';
      const mockRequest = {
        id: 'request-1',
        status: 'PENDING',
        child: {
          healthCenterId: 'healthcenter-2', // Différent
        },
      };
      prisma.vaccineRequest.findUnique.mockResolvedValue(mockRequest);

      await cancelVaccineRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 400 si demande déjà traitée', async () => {
      req.params.id = 'request-1';
      const mockRequest = {
        id: 'request-1',
        status: 'SCHEDULED', // Déjà traitée
        child: {
          healthCenterId: 'healthcenter-1',
        },
      };
      prisma.vaccineRequest.findUnique.mockResolvedValue(mockRequest);

      await cancelVaccineRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Seules les demandes en attente peuvent être annulées',
      });
    });
  });
});







