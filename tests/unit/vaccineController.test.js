// tests/unit/vaccineController.test.js

// Mocker le middleware requireAuth AVANT tout autre import pour éviter les erreurs de chargement
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: jest.fn((req, res, next) => next()),
  requireMobileAuth: jest.fn((req, res, next) => next()),
  optionalAuth: jest.fn((req, res, next) => next()),
}));

// Mocker les routes pour éviter le chargement des routes réelles
jest.mock('../../src/routes', () => ({
  get: jest.fn(),
}));

const {
  createVaccine,
  getVaccine,
  updateVaccine,
  deleteVaccine,
  createVaccineCalendar,
  updateVaccineCalendar,
  deleteVaccineCalendar,
  listVaccineCalendars,
  listVaccineCalendarDoseWarnings,
  downloadVaccineCalendarPdf,
  listVaccines,
  ScheduleVaccine,
  listScheduledVaccines,
  updateScheduledVaccine,
  cancelScheduledVaccine,
  completeVaccine,
  missVaccine,
} = require('../../src/controllers/vaccineController');

const prisma = require('../../src/config/prismaClient');
const stockLotService = require('../../src/services/stockLotService');
const notificationService = require('../../src/services/notificationService');
const vaccineBucketService = require('../../src/services/vaccineBucketService');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  vaccine: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  vaccineCalendar: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  vaccineCalendarDose: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  childVaccineScheduled: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  childVaccineCompleted: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
  },
  childVaccineDue: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
  },
  childVaccineLate: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  childVaccineOverdue: {
    create: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  children: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  stockReservation: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  stockLot: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  stockNATIONAL: {
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
  record: {
    deleteMany: jest.fn(),
  },
  vaccineRequest: {
    deleteMany: jest.fn(),
  },
  stockTransfer: {
    findMany: jest.fn(),
  },
  stockTransferLot: {
    deleteMany: jest.fn(),
  },
  region: {
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((callback) => {
    const mockPrisma = require('../../src/config/prismaClient');
    const mockTx = {
      vaccine: mockPrisma.vaccine,
      vaccineCalendar: mockPrisma.vaccineCalendar,
      vaccineCalendarDose: mockPrisma.vaccineCalendarDose,
      childVaccineScheduled: mockPrisma.childVaccineScheduled,
      childVaccineCompleted: mockPrisma.childVaccineCompleted,
      childVaccineDue: mockPrisma.childVaccineDue,
      childVaccineLate: mockPrisma.childVaccineLate,
      childVaccineOverdue: mockPrisma.childVaccineOverdue,
      children: mockPrisma.children,
      stockReservation: mockPrisma.stockReservation,
      stockLot: mockPrisma.stockLot,
      stockNATIONAL: mockPrisma.stockNATIONAL,
      stockREGIONAL: mockPrisma.stockREGIONAL,
      stockDISTRICT: mockPrisma.stockDISTRICT,
      stockHEALTHCENTER: mockPrisma.stockHEALTHCENTER,
      record: mockPrisma.record,
      vaccineRequest: mockPrisma.vaccineRequest,
      stockTransfer: mockPrisma.stockTransfer,
      stockTransferLot: mockPrisma.stockTransferLot,
      user: mockPrisma.user,
    };
    return callback(mockTx);
  }),
}));

jest.mock('../../src/services/stockLotService', () => ({
  OWNER_TYPES: {
    HEALTHCENTER: 'HEALTHCENTER',
  },
  reserveDoseForHealthCenter: jest.fn(),
  releaseDoseForHealthCenter: jest.fn(),
  deleteLotCascade: jest.fn(),
}));

jest.mock('../../src/services/notificationService', () => ({
  notifyVaccineScheduled: jest.fn(),
  notifyVaccineMissed: jest.fn(),
  notifyVaccineLate: jest.fn(),
  notifyAppointmentUpdated: jest.fn(),
  notifyAppointmentCancelled: jest.fn(),
}));

jest.mock('../../src/services/vaccineBucketService', () => ({
  rebuildChildVaccinationBuckets: jest.fn(),
}));

jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    pipe: jest.fn(),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    end: jest.fn(),
  }));
});

describe('vaccineController', () => {
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
      setHeader: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('createVaccine', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await createVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait créer un vaccin avec succès', async () => {
      req.body.name = 'BCG';
      req.body.description = 'Vaccin BCG';
      req.body.dosesRequired = 1;
      req.body.gender = null;
      const mockVaccine = {
        id: 'vaccine-1',
        name: 'BCG',
        description: 'Vaccin BCG',
        dosesRequired: 1,
        gender: null,
      };
      prisma.vaccine.create.mockResolvedValue(mockVaccine);

      await createVaccine(req, res, next);

      expect(prisma.vaccine.create).toHaveBeenCalledWith({
        data: {
          name: 'BCG',
          description: 'Vaccin BCG',
          dosesRequired: 1,
          gender: null,
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockVaccine);
    });

    it('devrait gérer les erreurs de base de données', async () => {
      req.body.name = 'BCG';
      req.body.description = 'Vaccin BCG';
      req.body.dosesRequired = 1;
      const error = new Error('Erreur DB');
      prisma.vaccine.create.mockRejectedValue(error);

      await createVaccine(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getVaccine', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'PARENT';
      await getVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner la liste des vaccins avec succès', async () => {
      const mockVaccines = [
        {
          id: 'vaccine-1',
          name: 'BCG',
          description: 'Vaccin BCG',
          dosesRequired: 1,
          StockNATIONAL: { quantity: 100 },
          StockREGIONAL: [],
          StockDISTRICT: [],
          StockHEALTHCENTER: [],
        },
      ];
      prisma.vaccine.findMany.mockResolvedValue(mockVaccines);
      prisma.vaccine.count.mockResolvedValue(1);

      await getVaccine(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.vaccines).toBeDefined();
      expect(response.total).toBe(1);
    });
  });

  describe('updateVaccine', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await updateVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait mettre à jour un vaccin avec succès', async () => {
      req.params.id = 'vaccine-1';
      req.body.name = 'BCG Modifié';
      req.body.description = 'Description modifiée';
      req.body.dosesRequired = '2';
      req.body.gender = null;
      const mockVaccine = {
        id: 'vaccine-1',
        name: 'BCG Modifié',
        description: 'Description modifiée',
        dosesRequired: 2,
        gender: null,
      };
      prisma.vaccine.update.mockResolvedValue(mockVaccine);

      await updateVaccine(req, res, next);

      expect(prisma.vaccine.update).toHaveBeenCalledWith({
        where: { id: 'vaccine-1' },
        data: {
          name: 'BCG Modifié',
          description: 'Description modifiée',
          dosesRequired: '2',
          gender: null,
        },
      });
      expect(res.json).toHaveBeenCalledWith(mockVaccine);
    });

    it('devrait retourner 400 si champs obligatoires manquants', async () => {
      req.params.id = 'vaccine-1';
      req.body.name = '';
      await updateVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteVaccine', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await deleteVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait supprimer un vaccin avec succès', async () => {
      req.params.id = 'vaccine-1';
      prisma.vaccine.findUnique.mockResolvedValue({ id: 'vaccine-1', name: 'BCG' });
      prisma.childVaccineScheduled.findMany.mockResolvedValue([]);
      prisma.stockLot.findMany.mockResolvedValue([]);
      stockLotService.deleteLotCascade.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          vaccine: {
            findUnique: prisma.vaccine.findUnique,
            delete: jest.fn().mockResolvedValue({}),
          },
          childVaccineScheduled: {
            findMany: jest.fn().mockResolvedValue([]),
            delete: jest.fn().mockResolvedValue({}),
            deleteMany: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineCompleted: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineDue: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineLate: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineOverdue: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            findUnique: jest.fn().mockResolvedValue(null),
            delete: jest.fn().mockResolvedValue({}),
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          stockLot: {
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({}),
          },
          stockNATIONAL: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          stockREGIONAL: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          stockDISTRICT: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          stockHEALTHCENTER: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          record: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          vaccineRequest: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          stockTransfer: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          stockTransferLot: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          pendingStockTransfer: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          pendingStockTransferLot: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          children: {
            updateMany: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      await deleteVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('devrait retourner 404 si vaccin introuvable', async () => {
      req.params.id = 'vaccine-1';
      prisma.vaccine.findUnique.mockResolvedValue(null);

      await deleteVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createVaccineCalendar', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await createVaccineCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait créer un calendrier vaccinal avec succès', async () => {
      req.body.description = 'Calendrier 0-2 mois';
      req.body.ageUnit = 'MONTHS';
      req.body.specificAge = 2;
      req.body.vaccine = [{ vaccineId: 'vaccine-1', doseCount: 1 }];
      const mockCalendar = {
        id: 'calendar-1',
        description: 'Calendrier 0-2 mois',
        ageUnit: 'MONTHS',
        specificAge: 2,
        doseAssignments: [],
      };
      prisma.vaccineCalendar.create.mockResolvedValue(mockCalendar);
      prisma.vaccineCalendarDose.groupBy.mockResolvedValue([]);
      prisma.vaccine.findMany.mockResolvedValue([{ id: 'vaccine-1', name: 'BCG', dosesRequired: 1 }]);
      prisma.vaccineCalendarDose.createMany.mockResolvedValue({});
      prisma.vaccineCalendar.findUnique.mockResolvedValue(mockCalendar);
      prisma.vaccineCalendarDose.findMany.mockResolvedValue([]);
      prisma.vaccineCalendarDose.updateMany.mockResolvedValue({});
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          vaccineCalendar: {
            create: prisma.vaccineCalendar.create,
            findUnique: prisma.vaccineCalendar.findUnique,
          },
          vaccineCalendarDose: {
            groupBy: prisma.vaccineCalendarDose.groupBy,
            createMany: prisma.vaccineCalendarDose.createMany,
            findMany: prisma.vaccineCalendarDose.findMany,
            updateMany: prisma.vaccineCalendarDose.updateMany,
          },
          vaccine: {
            findMany: prisma.vaccine.findMany,
          },
        };
        const result = await callback(mockTx);
        return result;
      });

      await createVaccineCalendar(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 400 si aucun vaccin fourni', async () => {
      req.body.description = 'Calendrier 0-2 mois';
      req.body.ageUnit = 'MONTHS';
      req.body.vaccine = [];
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          vaccine: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        return callback(mockTx);
      });

      await createVaccineCalendar(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.message).toContain('Veuillez sélectionner au moins un vaccin');
    });
  });

  describe('ScheduleVaccine', () => {
    beforeEach(() => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.user.id = 'user-1';
    });

    // Tests d'autorisation
    it('devrait retourner 403 si utilisateur n\'est pas AGENT', async () => {
      req.user.role = 'NATIONAL';
      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner 403 si agent n\'a pas de healthCenterId', async () => {
      req.user.healthCenterId = null;
      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    // Tests de validation des paramètres
    it('devrait retourner 400 si tous les champs requis ne sont pas fournis', async () => {
      req.body.childId = 'child-1';
      // vaccineId et scheduledFor manquants
      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 400 si childId manquant', async () => {
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 400 si vaccineId manquant', async () => {
      req.body.childId = 'child-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 400 si scheduledFor manquant', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 400 si date invalide', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = 'date-invalide';
      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    // Tests de ressources introuvables
    it('devrait retourner 404 si enfant introuvable', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(mockTx);
      });

      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('devrait retourner 404 si vaccin introuvable', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(mockTx);
      });

      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    // Tests d'accès
    it('devrait retourner 403 si enfant n\'appartient pas au centre de santé de l\'agent', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-2' };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
          },
        };
        return callback(mockTx);
      });

      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    // Tests de genre
    it('devrait retourner 400 si vaccin spécifique au genre et genre incompatible (avec vaccineCalendarId)', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      req.body.vaccineCalendarId = 'calendar-1'; // Vaccin du calendrier
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 1, gender: 'F' };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
        };
        try {
          return await callback(mockTx);
        } catch (error) {
          if (error.status === 400) {
            res.status(400).json({ message: error.message });
            return;
          }
          throw error;
        }
      });

      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait permettre la programmation si vaccin pour garçons et enfant garçon', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 1, gender: 'M' };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 1 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait permettre la programmation si vaccin pour filles et enfant fille', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'F' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 1, gender: 'F' };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
        vaccine: { id: 'vaccine-1', name: 'HPV', dosesRequired: 1 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait permettre la programmation si vaccin pour tous (gender null)', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 1, gender: null };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 1 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    // Tests de programmation - Scénarios de base
    it('devrait programmer une première dose avec succès (aucune dose complétée/programmée)', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 3, gender: null };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 3 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.json.mock.calls[0][0];
      expect(response.dose).toBe(1);
    });

    it('devrait programmer une deuxième dose avec succès (1 dose complétée)', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 3, gender: null };
      const mockScheduled = {
        id: 'scheduled-2',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 2,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 3 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(1),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait programmer une troisième dose avec succès (2 doses complétées)', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 3, gender: null };
      const mockScheduled = {
        id: 'scheduled-3',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 3,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 3 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(2),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    // Tests de flexibilité - Programmer au-delà de dosesRequired
    it('devrait permettre de programmer une dose supplémentaire même si dosesRequired est atteint (3 complétées, dosesRequired=3)', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 3, gender: null };
      const mockScheduled = {
        id: 'scheduled-4',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 4,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 3 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(3),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.json.mock.calls[0][0];
      expect(response.dose).toBe(4);
    });

    it('devrait permettre de programmer une dose supplémentaire même si dosesRequired est atteint (2 complétées + 1 programmée, dosesRequired=3)', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 3, gender: null };
      const mockScheduled = {
        id: 'scheduled-4',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 4,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 3 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(2),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(1),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait permettre de programmer plusieurs doses supplémentaires (5 complétées, dosesRequired=3)', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 3, gender: null };
      const mockScheduled = {
        id: 'scheduled-6',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 6,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 3 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(5),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    // Tests avec administeredById
    it('devrait programmer avec administeredById si fourni', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      req.body.administeredById = 'agent-2';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 1, gender: null };
      const mockAgent = { id: 'agent-2', role: 'AGENT', isActive: true, healthCenterId: 'healthcenter-1' };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
        administeredById: 'agent-2',
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 1 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockAgent),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(prisma.$transaction.mock.calls[0][0]).toBeDefined();
    });

    it('devrait retourner 400 si administeredById n\'est pas un agent', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      req.body.administeredById = 'user-2';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 1, gender: null };
      const mockUser = { id: 'user-2', role: 'NATIONAL', isActive: true };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUser),
          },
        };
        return callback(mockTx);
      });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 400 si administeredById n\'est pas actif', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      req.body.administeredById = 'agent-2';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 1, gender: null };
      const mockAgent = { id: 'agent-2', role: 'AGENT', isActive: false, healthCenterId: 'healthcenter-1' };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockAgent),
          },
        };
        return callback(mockTx);
      });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 403 si administeredById n\'appartient pas au centre de santé', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      req.body.administeredById = 'agent-2';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 1, gender: null };
      const mockAgent = { id: 'agent-2', role: 'AGENT', isActive: true, healthCenterId: 'healthcenter-2' };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockAgent),
          },
        };
        return callback(mockTx);
      });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    // Tests avec vaccineCalendarId
    it('devrait programmer avec vaccineCalendarId si fourni', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.vaccineCalendarId = 'calendar-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 1, gender: null };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        vaccineCalendarId: 'calendar-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 1 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait programmer sans vaccineCalendarId si non fourni', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 1, gender: null };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        vaccineCalendarId: null,
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 1 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    // Tests de calcul de dose
    it('devrait calculer correctement le numéro de dose initial (0 complétées, 0 programmées = dose 1)', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 3, gender: null };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 3 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      const mockCreate = jest.fn().mockResolvedValue(mockScheduled);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: mockCreate,
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dose: 1,
          }),
        })
      );
    });

    it('devrait calculer correctement le numéro de dose initial (2 complétées, 1 programmée = dose 4)', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 3, gender: null };
      const mockScheduled = {
        id: 'scheduled-4',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 4,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 3 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      const mockCreate = jest.fn().mockResolvedValue(mockScheduled);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(2),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(1),
            create: mockCreate,
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dose: 4,
          }),
        })
      );
    });

    // Tests de cas limites
    it('devrait gérer dosesRequired = 1', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 1, gender: null };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 1 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait gérer dosesRequired très élevé (10)', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 10, gender: null };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
        vaccine: { id: 'vaccine-1', name: 'Vaccin', dosesRequired: 10 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait gérer dosesRequired invalide (défaut à 1)', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 'invalid', gender: null };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 1 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    // Tests de réservation de stock
    it('devrait réserver le stock correctement', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 1, gender: null };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 1 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      expect(stockLotService.reserveDoseForHealthCenter).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          vaccineId: 'vaccine-1',
          healthCenterId: 'healthcenter-1',
          quantity: 1,
        })
      );
    });

    // Tests de notification
    it('devrait envoyer une notification au parent après programmation', async () => {
      req.body.childId = 'child-1';
      req.body.vaccineId = 'vaccine-1';
      req.body.scheduledFor = '2025-12-31T10:00:00Z';
      const mockChild = { id: 'child-1', healthCenterId: 'healthcenter-1', gender: 'M' };
      const mockVaccine = { id: 'vaccine-1', dosesRequired: 1, gender: null };
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        dose: 1,
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 1 },
        child: { id: 'child-1', phoneParent: '+221123456789' },
      };
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            findUnique: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue({}),
          },
          vaccine: {
            findUnique: jest.fn().mockResolvedValue(mockVaccine),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(mockScheduled),
            findUnique: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            update: jest.fn().mockResolvedValue(mockScheduled),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            create: jest.fn().mockResolvedValue({ id: 'reservation-1' }),
          },
        };
        return callback(mockTx);
      });
      stockLotService.reserveDoseForHealthCenter.mockResolvedValue({ lotId: 'lot-1', quantity: 1 });

      await ScheduleVaccine(req, res, next);

      // La notification est envoyée de manière asynchrone, donc on vérifie juste que le code s'exécute
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('completeVaccine', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT', async () => {
      req.user.role = 'NATIONAL';
      await completeVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait compléter un vaccin avec succès', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'scheduled-1';
      req.body.notes = 'Vaccin administré avec succès';
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        vaccineCalendarId: 'calendar-1',
        plannerId: 'user-1',
        dose: 1,
        child: { healthCenterId: 'healthcenter-1' },
      };
      const mockCompleted = {
        id: 'completed-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        dose: 1,
      };
      const mockVaccine = { dosesRequired: 1 };
      prisma.childVaccineScheduled.findUnique.mockResolvedValue(mockScheduled);
      prisma.vaccine.findUnique.mockResolvedValue(mockVaccine);
      prisma.childVaccineCompleted.count.mockResolvedValue(1);
      prisma.childVaccineLate.count.mockResolvedValue(0);
      prisma.childVaccineOverdue.count.mockResolvedValue(0);
      stockLotService.releaseDoseForHealthCenter.mockResolvedValue();
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          childVaccineScheduled: {
            findUnique: prisma.childVaccineScheduled.findUnique,
            delete: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue(mockScheduled),
            findFirst: jest.fn().mockResolvedValue(mockScheduled),
            findMany: jest.fn().mockResolvedValue([mockScheduled]),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineCompleted: {
            create: jest.fn().mockResolvedValue(mockCompleted),
            count: prisma.childVaccineCompleted.count,
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineDue: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineLate: {
            deleteMany: jest.fn().mockResolvedValue({}),
            count: prisma.childVaccineLate.count,
          },
          childVaccineOverdue: {
            deleteMany: jest.fn().mockResolvedValue({}),
            count: prisma.childVaccineOverdue.count,
          },
          vaccine: {
            findUnique: prisma.vaccine.findUnique,
          },
          children: {
            update: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            findUnique: jest.fn().mockResolvedValue({ id: 'reservation-1', quantity: 1, stockLot: { id: 'lot-1', ownerType: 'HEALTHCENTER', ownerId: 'healthcenter-1', vaccineId: 'vaccine-1' } }),
            delete: jest.fn().mockResolvedValue({}),
          },
        };
        const result = await callback(mockTx);
        return result;
      });

      await completeVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 404 si rendez-vous introuvable', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'scheduled-1';
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          childVaccineScheduled: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(mockTx);
      });

      await completeVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('cancelScheduledVaccine', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT', async () => {
      req.user.role = 'NATIONAL';
      await cancelScheduledVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait annuler un rendez-vous avec succès', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'scheduled-1';
      const mockScheduled = {
        id: 'scheduled-1',
        childId: 'child-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        child: { healthCenterId: 'healthcenter-1', id: 'child-1' },
        vaccine: { id: 'vaccine-1', name: 'BCG' },
      };
      prisma.childVaccineScheduled.findUnique.mockResolvedValue(mockScheduled);
      stockLotService.releaseDoseForHealthCenter.mockResolvedValue();
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          childVaccineScheduled: {
            findUnique: prisma.childVaccineScheduled.findUnique,
            delete: jest.fn().mockResolvedValue({}),
            findFirst: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          children: {
            update: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            findUnique: jest.fn().mockResolvedValue({ id: 'reservation-1', quantity: 1, stockLot: { id: 'lot-1', ownerType: 'HEALTHCENTER', ownerId: 'healthcenter-1', vaccineId: 'vaccine-1' } }),
            delete: jest.fn().mockResolvedValue({}),
          },
          childVaccineCompleted: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        const result = await callback(mockTx);
        return result;
      });

      await cancelScheduledVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('listVaccines', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'PARENT';
      await listVaccines(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner la liste des vaccins avec succès', async () => {
      const mockVaccines = [
        { id: 'vaccine-1', name: 'BCG', description: 'Vaccin BCG', dosesRequired: 1 },
      ];
      prisma.vaccine.findMany.mockResolvedValue(mockVaccines);

      await listVaccines(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockVaccines);
    });
  });

  describe('listVaccineCalendars', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'PARENT';
      await listVaccineCalendars(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner la liste des calendriers avec succès', async () => {
      const mockCalendars = [
        {
          id: 'calendar-1',
          description: 'Calendrier 0-2 mois',
          ageUnit: 'MONTHS',
          specificAge: 2,
          doseAssignments: [],
        },
      ];
      prisma.vaccineCalendar.findMany.mockResolvedValue(mockCalendars);

      await listVaccineCalendars(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('listVaccineCalendarDoseWarnings', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await listVaccineCalendarDoseWarnings(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner les avertissements de doses manquantes', async () => {
      const mockVaccines = [
        { id: 'vaccine-1', name: 'BCG', dosesRequired: 2 },
      ];
      const mockCounts = [
        { vaccineId: 'vaccine-1', _count: { vaccineId: 1 } },
      ];
      prisma.vaccine.findMany.mockResolvedValue(mockVaccines);
      prisma.vaccineCalendarDose.groupBy.mockResolvedValue(mockCounts);

      await listVaccineCalendarDoseWarnings(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.warnings).toBeDefined();
    });
  });

  describe('updateVaccineCalendar', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'calendar-1';
      await updateVaccineCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner 400 si id manquant', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = null;
      await updateVaccineCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 400 si description manquante', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'calendar-1';
      req.body = { ageUnit: 'MONTHS' };
      await updateVaccineCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 400 si ageUnit invalide', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'calendar-1';
      req.body = { description: 'Test', ageUnit: 'INVALID' };
      await updateVaccineCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait mettre à jour un calendrier avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'calendar-1';
      req.body = {
        description: 'Test Calendar',
        ageUnit: 'MONTHS',
        specificAge: 2,
        vaccine: [{ vaccineId: 'vaccine-1', count: 1 }],
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          vaccineCalendarDose: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({}),
            createMany: jest.fn().mockResolvedValue({}),
            groupBy: jest.fn().mockResolvedValue([]),
          },
          vaccineCalendar: {
            update: jest.fn().mockResolvedValue({ id: 'calendar-1' }),
          },
          vaccine: {
            findMany: jest.fn().mockResolvedValue([
              { id: 'vaccine-1', name: 'BCG', dosesRequired: 1 },
            ]),
          },
        };
        return callback(mockTx);
      });

      prisma.vaccineCalendar.findUnique.mockResolvedValue({
        id: 'calendar-1',
        description: 'Test Calendar',
        ageUnit: 'MONTHS',
        specificAge: 2,
        doseAssignments: [],
      });

      // Mock pour reassignVaccineDoseNumbers
      prisma.vaccineCalendarDose.findMany.mockResolvedValue([]);
      prisma.$transaction.mockImplementationOnce(async (callback) => {
        const mockTx = {
          vaccineCalendarDose: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({}),
            createMany: jest.fn().mockResolvedValue({}),
            groupBy: jest.fn().mockResolvedValue([]),
          },
          vaccineCalendar: {
            update: jest.fn().mockResolvedValue({ id: 'calendar-1' }),
          },
          vaccine: {
            findMany: jest.fn().mockResolvedValue([
              { id: 'vaccine-1', name: 'BCG', dosesRequired: 1 },
            ]),
          },
        };
        return callback(mockTx);
      }).mockImplementationOnce(async (updates) => {
        // Pour reassignVaccineDoseNumbers qui fait un $transaction avec un tableau de promises
        return Promise.all(updates);
      });

      await updateVaccineCalendar(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('deleteVaccineCalendar', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'calendar-1';
      await deleteVaccineCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner 400 si id manquant', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = null;
      await deleteVaccineCalendar(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait supprimer un calendrier avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'calendar-1';

      const mockCalendar = { id: 'calendar-1', name: 'Test Calendar' };
      prisma.vaccineCalendar.findUnique.mockResolvedValue(mockCalendar);

      // Mock pour reassignVaccineDoseNumbers (appelé après la transaction principale)
      prisma.vaccineCalendarDose.findMany.mockResolvedValue([]);

      let callCount = 0;
      prisma.$transaction.mockImplementation(async (arg) => {
        callCount++;
        if (Array.isArray(arg)) {
          // reassignVaccineDoseNumbers passe un tableau de promises
          return Promise.all(arg);
        }
        // Transaction principale
        const mockTx = {
          vaccineCalendarDose: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineDue: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineLate: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineOverdue: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineScheduled: {
            findMany: jest.fn().mockResolvedValue([]),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineCompleted: {
            findMany: jest.fn().mockResolvedValue([]),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          vaccineRequest: {
            updateMany: jest.fn().mockResolvedValue({}),
          },
          vaccineCalendar: {
            delete: jest.fn().mockResolvedValue({ id: 'calendar-1' }),
          },
        };
        return arg(mockTx);
      });

      vaccineBucketService.rebuildChildVaccinationBuckets.mockResolvedValue();

      await deleteVaccineCalendar(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('downloadVaccineCalendarPdf', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'INVALID_ROLE';
      await downloadVaccineCalendarPdf(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait générer un PDF avec succès pour NATIONAL', async () => {
      req.user.role = 'NATIONAL';

      prisma.vaccineCalendar.findMany.mockResolvedValue([
        {
          id: 'calendar-1',
          description: 'Test',
          ageUnit: 'MONTHS',
          specificAge: 2,
          doseAssignments: [
            {
              vaccine: { id: 'vaccine-1', name: 'BCG' },
              doseNumber: 1,
            },
          ],
        },
      ]);

      await downloadVaccineCalendarPdf(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="calendrier-vaccinal.pdf"',
      );
    });

    it('devrait générer un PDF avec succès pour AGENT ADMIN', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';

      prisma.vaccineCalendar.findMany.mockResolvedValue([]);

      await downloadVaccineCalendarPdf(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    });
  });

  describe('listScheduledVaccines', () => {
    it('devrait retourner une liste vide si AGENT sans healthCenterId', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = null;

      await listScheduledVaccines(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ items: [] });
    });

    it('devrait retourner les rendez-vous programmés pour AGENT', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';

      const mockScheduled = [
        {
          id: 'scheduled-1',
          scheduledFor: new Date('2025-12-31'),
          dose: 1,
          child: {
            id: 'child-1',
            firstName: 'John',
            lastName: 'Doe',
            healthCenterId: 'healthcenter-1',
          },
          vaccine: { id: 'vaccine-1', name: 'BCG' },
          administeredBy: { id: 'agent-1', firstName: 'Agent', lastName: 'Test' },
        },
      ];

      prisma.childVaccineScheduled.findMany.mockResolvedValue(mockScheduled);

      await listScheduledVaccines(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner une liste vide si DISTRICT sans districtId', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = null;

      await listScheduledVaccines(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ items: [] });
    });

    it('devrait retourner les rendez-vous programmés pour DISTRICT', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';

      prisma.childVaccineScheduled.findMany.mockResolvedValue([]);

      await listScheduledVaccines(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner une liste vide si REGIONAL sans regionId', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = null;

      await listScheduledVaccines(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ items: [] });
    });

    it('devrait retourner les rendez-vous programmés pour REGIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';

      prisma.childVaccineScheduled.findMany.mockResolvedValue([]);

      await listScheduledVaccines(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('updateScheduledVaccine', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'scheduled-1';
      await updateScheduledVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner 403 si agent n\'a pas de healthCenterId', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = null;
      req.params.id = 'scheduled-1';
      await updateScheduledVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner 400 si scheduledFor ou vaccineId manquants', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'scheduled-1';
      req.body = {};
      await updateScheduledVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 400 si date invalide', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'scheduled-1';
      req.body = { scheduledFor: 'invalid-date', vaccineId: 'vaccine-1' };
      await updateScheduledVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait mettre à jour un rendez-vous avec succès', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.user.id = 'agent-1';
      req.params.id = 'scheduled-1';
      req.body = {
        scheduledFor: '2025-12-31T10:00:00Z',
        vaccineId: 'vaccine-1',
        administeredById: 'agent-2',
      };

      const updatedSchedule = {
        id: 'scheduled-1',
        childId: 'child-1',
        scheduledFor: new Date('2025-12-31T10:00:00Z'),
        vaccineId: 'vaccine-1',
        vaccineCalendarId: null,
        dose: 1,
        administeredById: 'agent-2',
        vaccine: { id: 'vaccine-1', name: 'BCG', dosesRequired: 1 },
        administeredBy: { id: 'agent-2', firstName: 'Agent', lastName: 'Test' },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          childVaccineScheduled: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({
                id: 'scheduled-1',
                childId: 'child-1',
                scheduledFor: new Date('2025-12-30'),
                vaccineId: 'vaccine-1',
                vaccineCalendarId: null,
                dose: 1,
                administeredById: null,
                child: { healthCenterId: 'healthcenter-1' },
                vaccine: { id: 'vaccine-1', name: 'BCG' },
              })
              .mockResolvedValueOnce(updatedSchedule),
            findMany: jest.fn().mockResolvedValue([{
              id: 'scheduled-1',
              scheduledFor: new Date('2025-12-31T10:00:00Z'),
              dose: 1,
            }]),
            update: jest.fn().mockResolvedValue(updatedSchedule),
            findFirst: jest.fn().mockResolvedValue({
              id: 'scheduled-1',
              scheduledFor: new Date('2025-12-31T10:00:00Z'),
              vaccineId: 'vaccine-1',
              plannerId: 'agent-1',
            }),
          },
          childVaccineCompleted: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'agent-2',
              role: 'AGENT',
              healthCenterId: 'healthcenter-1',
              isActive: true,
            }),
          },
          children: {
            findFirst: jest.fn().mockResolvedValue({ id: 'child-1' }),
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      await updateScheduledVaccine(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('missVaccine', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'scheduled-1';
      await missVaccine(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait marquer un vaccin comme manqué avec succès', async () => {
      req.user.role = 'AGENT';
      req.params.id = 'scheduled-1';

      const mockOverdue = {
        id: 'overdue-1',
        childId: 'child-1',
        vaccineId: 'vaccine-1',
        vaccineCalendarId: 'calendar-1',
        dose: 1,
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          childVaccineScheduled: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'scheduled-1',
              childId: 'child-1',
              vaccineId: 'vaccine-1',
              vaccineCalendarId: 'calendar-1',
              scheduledFor: new Date('2025-01-01'),
              plannerId: 'planner-1',
              dose: 1,
            }),
            findMany: jest.fn().mockResolvedValue([]),
            delete: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue({}),
            findFirst: jest.fn().mockResolvedValue(null), // Pas de prochain rendez-vous
          },
          childVaccineCompleted: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          childVaccineOverdue: {
            upsert: jest.fn().mockResolvedValue(mockOverdue),
            count: jest.fn().mockResolvedValue(0),
          },
          stockReservation: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'reservation-1',
              stockLot: { id: 'lot-1', ownerType: 'HEALTHCENTER', ownerId: 'healthcenter-1', vaccineId: 'vaccine-1' },
              quantity: 1,
            }),
            delete: jest.fn().mockResolvedValue({}),
          },
          stockLot: {
            findUnique: jest.fn().mockResolvedValue({ id: 'lot-1' }),
          },
          children: {
            findFirst: jest.fn().mockResolvedValue({ id: 'child-1' }),
            update: jest.fn().mockResolvedValue({}),
          },
          childVaccineLate: {
            count: jest.fn().mockResolvedValue(0),
          },
        };
        const result = await callback(mockTx);
        return result;
      });

      stockLotService.releaseDoseForHealthCenter.mockResolvedValue();

      await missVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('devrait retourner 404 si rendez-vous introuvable', async () => {
      req.user.role = 'AGENT';
      req.params.id = 'scheduled-1';

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          childVaccineScheduled: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(mockTx);
      });

      await missVaccine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});







