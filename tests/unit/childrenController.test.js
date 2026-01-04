// tests/unit/childrenController.test.js

const {
  createChildren,
  updateChildren,
  getChildren,
  getChildVaccinations,
  createManualVaccinationEntry,
  updateManualVaccinationEntry,
  deleteManualVaccinationEntry,
  getParentsOverview,
  deleteChild,
  activateChild,
  requestPhotos,
} = require('../../src/controllers/childrenController');

const prisma = require('../../src/config/prismaClient');
const notificationService = require('../../src/services/notification');
const accessCodeUtils = require('../../src/utils/accessCode');
const vaccineBucketService = require('../../src/services/vaccineBucketService');
const vaccineDoseUtils = require('../../src/utils/vaccineDose');
const whatsappService = require('../../src/services/whatsapp');
const notificationService2 = require('../../src/services/notificationService');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  children: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  vaccine: {
    findUnique: jest.fn(),
  },
  vaccineCalendar: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  childVaccineDue: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  childVaccineLate: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  childVaccineOverdue: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  childVaccineCompleted: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  childVaccineScheduled: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  stockReservation: {
    deleteMany: jest.fn(),
  },
  vaccineRequest: {
    deleteMany: jest.fn(),
  },
  record: {
    deleteMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((callback) => {
    const mockPrisma = require('../../src/config/prismaClient');
    const mockTx = {
      children: mockPrisma.children,
      childVaccineDue: mockPrisma.childVaccineDue,
      childVaccineLate: mockPrisma.childVaccineLate,
      childVaccineOverdue: mockPrisma.childVaccineOverdue,
      childVaccineCompleted: mockPrisma.childVaccineCompleted,
      childVaccineScheduled: mockPrisma.childVaccineScheduled,
      stockReservation: mockPrisma.stockReservation,
      vaccineRequest: mockPrisma.vaccineRequest,
      record: mockPrisma.record,
    };
    return callback(mockTx);
  }),
}));

jest.mock('../../src/services/notification', () => ({
  sendParentAccessCode: jest.fn(),
}));

jest.mock('../../src/utils/accessCode', () => ({
  generateAccessCode: jest.fn(() => '123456'),
}));

jest.mock('../../src/services/vaccineBucketService', () => ({
  rebuildChildVaccinationBuckets: jest.fn(),
}));

jest.mock('../../src/utils/vaccineDose', () => ({
  buildVaccineDoseMap: jest.fn(() => new Map()),
}));

jest.mock('../../src/services/whatsapp', () => ({
  sendAccountActivationWhatsApp: jest.fn(),
  sendPhotoRequestWhatsApp: jest.fn(),
}));

jest.mock('../../src/services/notificationService', () => ({
  notifyAccountActivated: jest.fn(),
  notifyPhotoRequest: jest.fn(),
}));

describe('childrenController', () => {
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
        agentLevel: 'ADMIN',
      },
      body: {},
      params: {},
      query: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('createChildren', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT', async () => {
      req.user.role = 'NATIONAL';
      await createChildren(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé. Seuls les agents peuvent créer des enfants.',
      });
    });

    it('devrait retourner 400 si agent n\'a pas de healthCenterId', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = null;
      await createChildren(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Votre compte n\'est pas associé à un centre de santé.',
      });
    });

    it('devrait créer un enfant avec succès', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '2024-01-01',
        birthPlace: 'Dakar',
        address: '123 Rue Test',
        gender: 'M',
        emailParent: 'parent@test.com',
        phoneParent: '+221123456789',
        fatherName: 'Father',
        motherName: 'Mother',
      };

      const mockChild = {
        id: 'child-1',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: new Date('2024-01-01'),
        healthCenterId: 'healthcenter-1',
        status: 'A_JOUR',
        code: '123456',
        isActive: false,
        photosRequested: false,
      };

      const mockCalendarEntries = [
        {
          id: 'calendar-1',
          ageUnit: 'MONTHS',
          specificAge: 2,
          minAge: 0,
          maxAge: 2,
          doseAssignments: [
            {
              doseNumber: 1,
              vaccine: {
                id: 'vaccine-1',
                name: 'BCG',
                gender: null,
                dosesRequired: 1,
              },
            },
          ],
        },
      ];

      const mockFullChild = {
        ...mockChild,
        healthCenter: {
          name: 'Centre Test',
          district: {
            name: 'District Test',
            commune: {
              region: { name: 'Region Test' },
            },
          },
        },
        completedVaccines: [],
        dueVaccines: [],
        scheduledVaccines: [],
        lateVaccines: [],
        overdueVaccines: [],
      };

      prisma.vaccineCalendar.findMany.mockResolvedValue(mockCalendarEntries);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            create: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue(mockChild),
          },
          childVaccineDue: {
            createMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineLate: {
            createMany: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });
      prisma.children.findUnique.mockResolvedValue(mockFullChild);
      vaccineBucketService.rebuildChildVaccinationBuckets.mockResolvedValue();
      notificationService.sendParentAccessCode.mockResolvedValue();

      await createChildren(req, res, next);

      expect(prisma.vaccineCalendar.findMany).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
      expect(vaccineBucketService.rebuildChildVaccinationBuckets).toHaveBeenCalledWith('child-1');
      expect(notificationService.sendParentAccessCode).toHaveBeenCalled();
    });

    it('devrait créer un enfant avec statut PAS_A_JOUR si des vaccins sont en retard', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '2020-01-01', // Enfant de 4 ans
        birthPlace: 'Dakar',
        address: '123 Rue Test',
        gender: 'M',
        emailParent: 'parent@test.com',
        phoneParent: '+221123456789',
        fatherName: 'Father',
        motherName: 'Mother',
      };

      const mockChild = {
        id: 'child-1',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: new Date('2020-01-01'),
        healthCenterId: 'healthcenter-1',
        status: 'PAS_A_JOUR',
        code: '123456',
        isActive: false,
        photosRequested: false,
      };

      const mockCalendarEntries = [
        {
          id: 'calendar-1',
          ageUnit: 'MONTHS',
          specificAge: 2,
          minAge: 0,
          maxAge: 2, // Enfant de 4 ans dépasse cette plage
          doseAssignments: [
            {
              doseNumber: 1,
              vaccine: {
                id: 'vaccine-1',
                name: 'BCG',
                gender: null,
                dosesRequired: 1,
              },
            },
          ],
        },
      ];

      const mockFullChild = {
        ...mockChild,
        healthCenter: {
          name: 'Centre Test',
          district: {
            name: 'District Test',
            commune: {
              region: { name: 'Region Test' },
            },
          },
        },
        completedVaccines: [],
        dueVaccines: [],
        scheduledVaccines: [],
        lateVaccines: [{ id: 'late-1', vaccine: { name: 'BCG' } }],
        overdueVaccines: [],
      };

      prisma.vaccineCalendar.findMany.mockResolvedValue(mockCalendarEntries);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            create: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue(mockChild),
          },
          childVaccineDue: {
            createMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineLate: {
            createMany: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });
      prisma.children.findUnique.mockResolvedValue(mockFullChild);
      vaccineBucketService.rebuildChildVaccinationBuckets.mockResolvedValue();
      notificationService.sendParentAccessCode.mockResolvedValue();

      await createChildren(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('devrait filtrer les vaccins selon le genre de l\'enfant', async () => {
      req.body = {
        firstName: 'Jane',
        lastName: 'Doe',
        birthDate: '2024-01-01',
        birthPlace: 'Dakar',
        address: '123 Rue Test',
        gender: 'F',
        emailParent: 'parent@test.com',
        phoneParent: '+221123456789',
        fatherName: 'Father',
        motherName: 'Mother',
      };

      const mockChild = {
        id: 'child-1',
        firstName: 'Jane',
        lastName: 'Doe',
        birthDate: new Date('2024-01-01'),
        healthCenterId: 'healthcenter-1',
        status: 'A_JOUR',
        code: '123456',
        isActive: false,
        photosRequested: false,
      };

      const mockCalendarEntries = [
        {
          id: 'calendar-1',
          ageUnit: 'MONTHS',
          specificAge: 2,
          minAge: 0,
          maxAge: 2,
          doseAssignments: [
            {
              doseNumber: 1,
              vaccine: {
                id: 'vaccine-1',
                name: 'Vaccin Filles',
                gender: 'F', // Pour filles seulement
                dosesRequired: 1,
              },
            },
            {
              doseNumber: 1,
              vaccine: {
                id: 'vaccine-2',
                name: 'BCG',
                gender: null, // Pour tous
                dosesRequired: 1,
              },
            },
          ],
        },
      ];

      const mockFullChild = {
        ...mockChild,
        healthCenter: {
          name: 'Centre Test',
          district: {
            name: 'District Test',
            commune: {
              region: { name: 'Region Test' },
            },
          },
        },
        completedVaccines: [],
        dueVaccines: [],
        scheduledVaccines: [],
        lateVaccines: [],
        overdueVaccines: [],
      };

      prisma.vaccineCalendar.findMany.mockResolvedValue(mockCalendarEntries);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            create: jest.fn().mockResolvedValue(mockChild),
            update: jest.fn().mockResolvedValue(mockChild),
          },
          childVaccineDue: {
            createMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineLate: {
            createMany: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });
      prisma.children.findUnique.mockResolvedValue(mockFullChild);
      vaccineBucketService.rebuildChildVaccinationBuckets.mockResolvedValue();
      notificationService.sendParentAccessCode.mockResolvedValue();

      await createChildren(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('devrait gérer les erreurs de base de données', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '2024-01-01',
        birthPlace: 'Dakar',
        address: '123 Rue Test',
        gender: 'M',
        emailParent: 'parent@test.com',
        phoneParent: '+221123456789',
        fatherName: 'Father',
        motherName: 'Mother',
      };

      const error = new Error('Erreur DB');
      prisma.vaccineCalendar.findMany.mockRejectedValue(error);

      await createChildren(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateChildren', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT ou DISTRICT', async () => {
      req.user.role = 'REGIONAL';
      await updateChildren(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait mettre à jour un enfant avec succès', async () => {
      req.params.id = 'child-1';
      req.body = {
        nextVaccineId: 'vaccine-1',
        nextAgentId: 'user-1',
        nextAppointment: '2025-12-31T10:00:00Z',
      };

      const mockChild = {
        id: 'child-1',
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockUpdatedChild = {
        ...mockChild,
        nextVaccineId: 'vaccine-1',
        nextAgentId: 'user-1',
        nextAppointment: new Date('2025-12-31T10:00:00Z'),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.children.update.mockResolvedValue(mockUpdatedChild);

      await updateChildren(req, res, next);

      expect(prisma.children.update).toHaveBeenCalledWith({
        where: { id: 'child-1' },
        data: {
          nextVaccineId: 'vaccine-1',
          nextAgentId: 'user-1',
          nextAppointment: '2025-12-31T10:00:00Z', // Le code passe la valeur telle quelle
        },
      });
      expect(res.json).toHaveBeenCalledWith(mockUpdatedChild);
    });

    it('devrait retourner 404 si enfant introuvable', async () => {
      req.params.id = 'child-1';
      req.body = { nextVaccineId: 'vaccine-1' };
      prisma.children.findUnique.mockResolvedValue(null);

      await updateChildren(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Enfant non trouvé' });
    });

    it('devrait gérer les erreurs de base de données', async () => {
      req.params.id = 'child-1';
      req.body = { nextVaccineId: 'vaccine-1' };
      const error = new Error('Erreur DB');
      prisma.children.findUnique.mockRejectedValue(error);

      await updateChildren(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getChildren', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'PARENT';
      await getChildren(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner la liste des enfants pour NATIONAL', async () => {
      req.user.role = 'NATIONAL';
      const mockChildren = [
        {
          id: 'child-1',
          firstName: 'John',
          lastName: 'Doe',
          gender: 'M',
          birthDate: new Date('2024-01-01'),
          status: 'A_JOUR',
          healthCenter: {
            name: 'Centre Test',
            district: {
              name: 'District Test',
              commune: {
                region: { name: 'Region Test' },
              },
            },
          },
          completedVaccines: [],
          dueVaccines: [],
          scheduledVaccines: [],
          lateVaccines: [],
          overdueVaccines: [],
        },
      ];

      prisma.children.findMany.mockResolvedValue(mockChildren);

      await getChildren(req, res, next);

      expect(prisma.children.findMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        total: 1,
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'child-1',
            firstName: 'John',
            lastName: 'Doe',
          }),
        ]),
      });
    });

    it('devrait filtrer par région pour REGIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';

      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.children.findMany.mockResolvedValue([]);

      await getChildren(req, res, next);

      expect(prisma.children.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            healthCenter: expect.objectContaining({
              district: expect.objectContaining({
                commune: expect.objectContaining({
                  regionId: 'region-1',
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('devrait retourner une liste vide si REGIONAL sans regionId', async () => {
      req.user.role = 'REGIONAL';
      prisma.user.findUnique.mockResolvedValue({ regionId: null });

      await getChildren(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ total: 0, items: [] });
    });

    it('devrait filtrer par district pour DISTRICT', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';

      prisma.user.findUnique.mockResolvedValue({ districtId: 'district-1' });
      prisma.children.findMany.mockResolvedValue([]);

      await getChildren(req, res, next);

      expect(prisma.children.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            healthCenter: expect.objectContaining({
              districtId: 'district-1',
            }),
          }),
        }),
      );
    });

    it('devrait filtrer par centre de santé pour AGENT', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';

      prisma.user.findUnique.mockResolvedValue({ healthCenterId: 'healthcenter-1' });
      prisma.children.findMany.mockResolvedValue([]);

      await getChildren(req, res, next);

      expect(prisma.children.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            healthCenterId: 'healthcenter-1',
          }),
        }),
      );
    });

    it('devrait filtrer par statut actif', async () => {
      req.user.role = 'NATIONAL';
      req.query.status = 'active';

      prisma.children.findMany.mockResolvedValue([]);

      await getChildren(req, res, next);

      expect(prisma.children.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });

    it('devrait filtrer par statut inactif', async () => {
      req.user.role = 'NATIONAL';
      req.query.status = 'inactive';

      prisma.children.findMany.mockResolvedValue([]);

      await getChildren(req, res, next);

      expect(prisma.children.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: false,
          }),
        }),
      );
    });

    it('devrait gérer les erreurs', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      req.user.role = 'NATIONAL';
      const error = new Error('Erreur DB');
      prisma.children.findMany.mockRejectedValue(error);

      await getChildren(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getChildVaccinations', () => {
    it('devrait retourner 404 si enfant introuvable', async () => {
      req.params.id = 'child-1';
      prisma.children.findUnique.mockResolvedValue(null);

      await getChildVaccinations(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Enfant non trouvé' });
    });

    it('devrait retourner 403 si accès refusé', async () => {
      req.params.id = 'child-1';
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';

      const mockChild = {
        id: 'child-1',
        healthCenterId: 'healthcenter-2', // Différent
        healthCenter: {
          district: {
            commune: {
              region: { id: 'region-1' },
            },
          },
        },
        dueVaccines: [],
        scheduledVaccines: [],
        lateVaccines: [],
        overdueVaccines: [],
        completedVaccines: [],
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);

      await getChildVaccinations(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner les vaccinations d\'un enfant avec succès', async () => {
      req.params.id = 'child-1';
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';

      const mockChild = {
        id: 'child-1',
        firstName: 'John',
        lastName: 'Doe',
        gender: 'M',
        birthDate: new Date('2024-01-01'),
        status: 'A_JOUR',
        healthCenterId: 'healthcenter-1',
        healthCenter: {
          id: 'healthcenter-1',
          name: 'Centre Test',
          district: {
            id: 'district-1',
            name: 'District Test',
            commune: {
              id: 'commune-1',
              name: 'Commune Test',
              region: { id: 'region-1', name: 'Region Test' },
            },
          },
        },
        dueVaccines: [
          {
            id: 'due-1',
            vaccineId: 'vaccine-1',
            vaccine: { id: 'vaccine-1', name: 'BCG' },
            scheduledFor: new Date('2024-03-01'),
            vaccineCalendarId: 'calendar-1',
            vaccineCalendar: {
              id: 'calendar-1',
              ageUnit: 'MONTHS',
              specificAge: 2,
              minAge: 0,
              maxAge: 2,
            },
            dose: 1,
          },
        ],
        scheduledVaccines: [],
        lateVaccines: [],
        overdueVaccines: [],
        completedVaccines: [],
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);

      await getChildVaccinations(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        child: expect.objectContaining({
          id: 'child-1',
          firstName: 'John',
          lastName: 'Doe',
        }),
        vaccinations: expect.objectContaining({
          due: expect.arrayContaining([
            expect.objectContaining({
              vaccineId: 'vaccine-1',
              vaccineName: 'BCG',
            }),
          ]),
          scheduled: [],
          late: [],
          overdue: [],
          completed: [],
        }),
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.params.id = 'child-1';
      const error = new Error('Erreur DB');
      prisma.children.findUnique.mockRejectedValue(error);

      await getChildVaccinations(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('createManualVaccinationEntry', () => {
    const buckets = ['due', 'late', 'overdue', 'completed'];

    buckets.forEach((bucket) => {
      describe(`pour le bucket ${bucket}`, () => {
        it('devrait retourner 400 si type d\'entrée invalide', async () => {
          req.params.id = 'child-1';
          req.params.bucket = 'invalid';
          await createManualVaccinationEntry(req, res, next);
          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith({
            message: 'Type d\'entrée invalide.',
          });
        });

        it('devrait retourner 404 si enfant introuvable', async () => {
          req.params.id = 'child-1';
          req.params.bucket = bucket;
          prisma.children.findUnique.mockResolvedValue(null);

          await createManualVaccinationEntry(req, res, next);

          expect(res.status).toHaveBeenCalledWith(404);
          expect(res.json).toHaveBeenCalledWith({ message: 'Enfant non trouvé.' });
        });

        it('devrait retourner 403 si accès refusé (AGENT non ADMIN)', async () => {
          req.params.id = 'child-1';
          req.params.bucket = bucket;
          req.user.role = 'AGENT';
          req.user.agentLevel = 'STAFF'; // Pas ADMIN

          const mockChild = {
            id: 'child-1',
            healthCenterId: 'healthcenter-1',
            healthCenter: {
              district: {
                id: 'district-1',
                commune: {
                  region: { id: 'region-1' },
                },
              },
            },
          };

          prisma.children.findUnique.mockResolvedValue(mockChild);

          await createManualVaccinationEntry(req, res, next);

          expect(res.status).toHaveBeenCalledWith(403);
          expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
        });

        it('devrait créer une entrée avec succès pour NATIONAL', async () => {
          req.params.id = 'child-1';
          req.params.bucket = bucket;
          req.user.role = 'NATIONAL';

          if (bucket === 'due') {
            req.body = {
              vaccineId: 'vaccine-1',
              vaccineCalendarId: 'calendar-1',
              scheduledFor: '2025-12-31T10:00:00Z',
              dose: 1,
            };
          } else if (bucket === 'late' || bucket === 'overdue') {
            req.body = {
              vaccineId: 'vaccine-1',
              vaccineCalendarId: 'calendar-1',
              dueDate: '2025-12-31T10:00:00Z',
              dose: 1,
            };
          } else if (bucket === 'completed') {
            req.body = {
              vaccineId: 'vaccine-1',
              vaccineCalendarId: 'calendar-1',
              administeredAt: '2025-12-31T10:00:00Z',
              dose: 1,
            };
          }

          const mockChild = {
            id: 'child-1',
            healthCenterId: 'healthcenter-1',
            healthCenter: {
              district: {
                id: 'district-1',
                commune: {
                  region: { id: 'region-1' },
                },
              },
            },
          };

          const mockEntry = { id: 'entry-1' };

          prisma.children.findUnique.mockResolvedValue(mockChild);
          prisma.vaccine.findUnique.mockResolvedValue({ id: 'vaccine-1' });
          prisma.vaccineCalendar.findUnique.mockResolvedValue({ id: 'calendar-1' });

          if (bucket === 'due') {
            prisma.childVaccineDue.create.mockResolvedValue(mockEntry);
          } else if (bucket === 'late') {
            prisma.childVaccineLate.create.mockResolvedValue(mockEntry);
          } else if (bucket === 'overdue') {
            prisma.childVaccineOverdue.create.mockResolvedValue(mockEntry);
          } else if (bucket === 'completed') {
            prisma.childVaccineCompleted.create.mockResolvedValue(mockEntry);
          }

          await createManualVaccinationEntry(req, res, next);

          expect(res.status).toHaveBeenCalledWith(201);
          expect(res.json).toHaveBeenCalledWith({ success: true, id: 'entry-1' });
        });

        it('devrait retourner 400 si vaccineId manquant', async () => {
          req.params.id = 'child-1';
          req.params.bucket = bucket;
          req.user.role = 'NATIONAL';
          req.body = {};

          const mockChild = {
            id: 'child-1',
            healthCenterId: 'healthcenter-1',
            healthCenter: {
              district: {
                id: 'district-1',
                commune: {
                  region: { id: 'region-1' },
                },
              },
            },
          };

          prisma.children.findUnique.mockResolvedValue(mockChild);

          await createManualVaccinationEntry(req, res, next);

          expect(res.status).toHaveBeenCalledWith(400);
        });

        it('devrait retourner 404 si vaccin introuvable', async () => {
          req.params.id = 'child-1';
          req.params.bucket = bucket;
          req.user.role = 'NATIONAL';
          req.body = {
            vaccineId: 'vaccine-1',
            vaccineCalendarId: 'calendar-1',
            dose: 1,
          };

          const mockChild = {
            id: 'child-1',
            healthCenterId: 'healthcenter-1',
            healthCenter: {
              district: {
                id: 'district-1',
                commune: {
                  region: { id: 'region-1' },
                },
              },
            },
          };

          prisma.children.findUnique.mockResolvedValue(mockChild);
          prisma.vaccine.findUnique.mockResolvedValue(null);

          await createManualVaccinationEntry(req, res, next);

          expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devrait retourner 409 si entrée dupliquée', async () => {
          req.params.id = 'child-1';
          req.params.bucket = bucket;
          req.user.role = 'NATIONAL';
          
          if (bucket === 'due') {
            req.body = {
              vaccineId: 'vaccine-1',
              vaccineCalendarId: 'calendar-1',
              scheduledFor: '2025-12-31T10:00:00Z',
              dose: 1,
            };
          } else if (bucket === 'late' || bucket === 'overdue') {
            req.body = {
              vaccineId: 'vaccine-1',
              vaccineCalendarId: 'calendar-1',
              dueDate: '2025-12-31T10:00:00Z',
              dose: 1,
            };
          } else if (bucket === 'completed') {
            req.body = {
              vaccineId: 'vaccine-1',
              vaccineCalendarId: 'calendar-1',
              administeredAt: '2025-12-31T10:00:00Z',
              dose: 1,
            };
          }

          const mockChild = {
            id: 'child-1',
            healthCenterId: 'healthcenter-1',
            healthCenter: {
              district: {
                id: 'district-1',
                commune: {
                  region: { id: 'region-1' },
                },
              },
            },
          };

          const duplicateError = new Error('Duplicate');
          duplicateError.code = 'P2002';

          prisma.children.findUnique.mockResolvedValue(mockChild);
          prisma.vaccine.findUnique.mockResolvedValue({ id: 'vaccine-1' });
          prisma.vaccineCalendar.findUnique.mockResolvedValue({ id: 'calendar-1' });

          if (bucket === 'due') {
            prisma.childVaccineDue.create.mockRejectedValue(duplicateError);
          } else if (bucket === 'late') {
            prisma.childVaccineLate.create.mockRejectedValue(duplicateError);
          } else if (bucket === 'overdue') {
            prisma.childVaccineOverdue.create.mockRejectedValue(duplicateError);
          } else if (bucket === 'completed') {
            prisma.childVaccineCompleted.create.mockRejectedValue(duplicateError);
          }

          await createManualVaccinationEntry(req, res, next);

          expect(res.status).toHaveBeenCalledWith(409);
          expect(res.json).toHaveBeenCalledWith({
            message: 'Une entrée existe déjà pour cette dose.',
          });
        });
      });
    });
  });

  describe('updateManualVaccinationEntry', () => {
    const buckets = ['due', 'late', 'overdue', 'completed'];

    buckets.forEach((bucket) => {
      describe(`pour le bucket ${bucket}`, () => {
        it('devrait retourner 400 si type d\'entrée invalide', async () => {
          req.params.id = 'child-1';
          req.params.bucket = 'invalid';
          req.params.entryId = 'entry-1';
          await updateManualVaccinationEntry(req, res, next);
          expect(res.status).toHaveBeenCalledWith(400);
        });

        it('devrait retourner 404 si entrée introuvable', async () => {
          req.params.id = 'child-1';
          req.params.bucket = bucket;
          req.params.entryId = 'entry-1';

          if (bucket === 'due') {
            prisma.childVaccineDue.findUnique.mockResolvedValue(null);
          } else if (bucket === 'late') {
            prisma.childVaccineLate.findUnique.mockResolvedValue(null);
          } else if (bucket === 'overdue') {
            prisma.childVaccineOverdue.findUnique.mockResolvedValue(null);
          } else if (bucket === 'completed') {
            prisma.childVaccineCompleted.findUnique.mockResolvedValue(null);
          }

          await updateManualVaccinationEntry(req, res, next);

          expect(res.status).toHaveBeenCalledWith(404);
          expect(res.json).toHaveBeenCalledWith({ message: 'Entrée introuvable.' });
        });

        it('devrait retourner 404 si childId ne correspond pas', async () => {
          req.params.id = 'child-1';
          req.params.bucket = bucket;
          req.params.entryId = 'entry-1';

          const mockEntry = {
            id: 'entry-1',
            childId: 'child-2', // Différent
            child: {
              id: 'child-2',
              healthCenterId: 'healthcenter-1',
              healthCenter: {
                district: {
                  id: 'district-1',
                  commune: {
                    region: { id: 'region-1' },
                  },
                },
              },
            },
          };

          if (bucket === 'due') {
            prisma.childVaccineDue.findUnique.mockResolvedValue(mockEntry);
          } else if (bucket === 'late') {
            prisma.childVaccineLate.findUnique.mockResolvedValue(mockEntry);
          } else if (bucket === 'overdue') {
            prisma.childVaccineOverdue.findUnique.mockResolvedValue(mockEntry);
          } else if (bucket === 'completed') {
            prisma.childVaccineCompleted.findUnique.mockResolvedValue(mockEntry);
          }

          await updateManualVaccinationEntry(req, res, next);

          expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devrait mettre à jour une entrée avec succès', async () => {
          req.params.id = 'child-1';
          req.params.bucket = bucket;
          req.params.entryId = 'entry-1';
          req.user.role = 'NATIONAL';
          req.body = { dose: 2 };

          const mockEntry = {
            id: 'entry-1',
            childId: 'child-1',
            child: {
              id: 'child-1',
              healthCenterId: 'healthcenter-1',
              healthCenter: {
                district: {
                  id: 'district-1',
                  commune: {
                    region: { id: 'region-1' },
                  },
                },
              },
            },
          };

          if (bucket === 'due') {
            prisma.childVaccineDue.findUnique.mockResolvedValue(mockEntry);
            prisma.childVaccineDue.update.mockResolvedValue(mockEntry);
          } else if (bucket === 'late') {
            prisma.childVaccineLate.findUnique.mockResolvedValue(mockEntry);
            prisma.childVaccineLate.update.mockResolvedValue(mockEntry);
          } else if (bucket === 'overdue') {
            prisma.childVaccineOverdue.findUnique.mockResolvedValue(mockEntry);
            prisma.childVaccineOverdue.update.mockResolvedValue(mockEntry);
          } else if (bucket === 'completed') {
            prisma.childVaccineCompleted.findUnique.mockResolvedValue(mockEntry);
            prisma.childVaccineCompleted.update.mockResolvedValue(mockEntry);
          }

          await updateManualVaccinationEntry(req, res, next);

          expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it('devrait retourner 400 si aucune donnée à mettre à jour', async () => {
          req.params.id = 'child-1';
          req.params.bucket = bucket;
          req.params.entryId = 'entry-1';
          req.user.role = 'NATIONAL';
          req.body = {};

          const mockEntry = {
            id: 'entry-1',
            childId: 'child-1',
            child: {
              id: 'child-1',
              healthCenterId: 'healthcenter-1',
              healthCenter: {
                district: {
                  id: 'district-1',
                  commune: {
                    region: { id: 'region-1' },
                  },
                },
              },
            },
          };

          if (bucket === 'due') {
            prisma.childVaccineDue.findUnique.mockResolvedValue(mockEntry);
          } else if (bucket === 'late') {
            prisma.childVaccineLate.findUnique.mockResolvedValue(mockEntry);
          } else if (bucket === 'overdue') {
            prisma.childVaccineOverdue.findUnique.mockResolvedValue(mockEntry);
          } else if (bucket === 'completed') {
            prisma.childVaccineCompleted.findUnique.mockResolvedValue(mockEntry);
          }

          await updateManualVaccinationEntry(req, res, next);

          expect(res.status).toHaveBeenCalledWith(400);
        });
      });
    });
  });

  describe('deleteManualVaccinationEntry', () => {
    const buckets = ['due', 'late', 'overdue', 'completed'];

    buckets.forEach((bucket) => {
      describe(`pour le bucket ${bucket}`, () => {
        it('devrait retourner 400 si type d\'entrée invalide', async () => {
          req.params.id = 'child-1';
          req.params.bucket = 'invalid';
          req.params.entryId = 'entry-1';
          await deleteManualVaccinationEntry(req, res, next);
          expect(res.status).toHaveBeenCalledWith(400);
        });

        it('devrait retourner 404 si entrée introuvable', async () => {
          req.params.id = 'child-1';
          req.params.bucket = bucket;
          req.params.entryId = 'entry-1';

          if (bucket === 'due') {
            prisma.childVaccineDue.findUnique.mockResolvedValue(null);
          } else if (bucket === 'late') {
            prisma.childVaccineLate.findUnique.mockResolvedValue(null);
          } else if (bucket === 'overdue') {
            prisma.childVaccineOverdue.findUnique.mockResolvedValue(null);
          } else if (bucket === 'completed') {
            prisma.childVaccineCompleted.findUnique.mockResolvedValue(null);
          }

          await deleteManualVaccinationEntry(req, res, next);

          expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devrait supprimer une entrée avec succès', async () => {
          req.params.id = 'child-1';
          req.params.bucket = bucket;
          req.params.entryId = 'entry-1';
          req.user.role = 'NATIONAL';

          const mockEntry = {
            id: 'entry-1',
            childId: 'child-1',
            child: {
              id: 'child-1',
              healthCenterId: 'healthcenter-1',
              healthCenter: {
                district: {
                  id: 'district-1',
                  commune: {
                    region: { id: 'region-1' },
                  },
                },
              },
            },
          };

          if (bucket === 'due') {
            prisma.childVaccineDue.findUnique.mockResolvedValue(mockEntry);
            prisma.childVaccineDue.delete.mockResolvedValue(mockEntry);
          } else if (bucket === 'late') {
            prisma.childVaccineLate.findUnique.mockResolvedValue(mockEntry);
            prisma.childVaccineLate.delete.mockResolvedValue(mockEntry);
          } else if (bucket === 'overdue') {
            prisma.childVaccineOverdue.findUnique.mockResolvedValue(mockEntry);
            prisma.childVaccineOverdue.delete.mockResolvedValue(mockEntry);
          } else if (bucket === 'completed') {
            prisma.childVaccineCompleted.findUnique.mockResolvedValue(mockEntry);
            prisma.childVaccineCompleted.delete.mockResolvedValue(mockEntry);
          }

          await deleteManualVaccinationEntry(req, res, next);

          expect(res.json).toHaveBeenCalledWith({ success: true });
        });
      });
    });
  });

  describe('getParentsOverview', () => {
    it('devrait retourner 403 si utilisateur n\'a pas les permissions', async () => {
      req.user.role = 'PARENT';
      await getParentsOverview(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 403 si AGENT n\'est pas ADMIN ou STAFF', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'BASIC';
      await getParentsOverview(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner la vue d\'ensemble des parents pour NATIONAL', async () => {
      req.user.role = 'NATIONAL';

      const mockChildren = [
        {
          id: 'child-1',
          firstName: 'John',
          lastName: 'Doe',
          gender: 'M',
          birthDate: new Date('2024-01-01'),
          status: 'A_JOUR',
          phoneParent: '+221123456789',
          fatherName: 'Father',
          motherName: 'Mother',
          emailParent: 'parent@test.com',
          nextAppointment: new Date('2025-12-31'),
          healthCenter: {
            name: 'Centre Test',
            district: {
              name: 'District Test',
              commune: {
                region: { name: 'Region Test' },
              },
            },
          },
        },
      ];

      prisma.children.findMany.mockResolvedValue(mockChildren);

      await getParentsOverview(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            parentPhone: '+221123456789',
            parentName: 'Father',
            childrenCount: 1,
          }),
        ]),
      });
    });

    it('devrait filtrer par région pour REGIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';

      prisma.user.findUnique.mockResolvedValue({ regionId: 'region-1' });
      prisma.children.findMany.mockResolvedValue([]);

      await getParentsOverview(req, res, next);

      expect(prisma.children.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            healthCenter: expect.objectContaining({
              district: expect.objectContaining({
                commune: expect.objectContaining({
                  regionId: 'region-1',
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('devrait retourner une liste vide si REGIONAL sans regionId', async () => {
      req.user.role = 'REGIONAL';
      prisma.user.findUnique.mockResolvedValue({ regionId: null });

      await getParentsOverview(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
    });

    it('devrait grouper les enfants par parent (même téléphone)', async () => {
      req.user.role = 'NATIONAL';

      const mockChildren = [
        {
          id: 'child-1',
          firstName: 'John',
          lastName: 'Doe',
          phoneParent: '+221123456789',
          fatherName: 'Father',
          healthCenter: {
            name: 'Centre Test',
            district: {
              name: 'District Test',
              commune: {
                region: { name: 'Region Test' },
              },
            },
          },
        },
        {
          id: 'child-2',
          firstName: 'Jane',
          lastName: 'Doe',
          phoneParent: '+221123456789', // Même téléphone
          fatherName: 'Father',
          healthCenter: {
            name: 'Centre Test',
            district: {
              name: 'District Test',
              commune: {
                region: { name: 'Region Test' },
              },
            },
          },
        },
      ];

      prisma.children.findMany.mockResolvedValue(mockChildren);

      await getParentsOverview(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.data).toHaveLength(1);
      expect(response.data[0].childrenCount).toBe(2);
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      const error = new Error('Erreur DB');
      prisma.children.findMany.mockRejectedValue(error);

      await getParentsOverview(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteChild', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'child-1';
      await deleteChild(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 403 si agent n\'a pas de healthCenterId', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = null;
      req.params.id = 'child-1';
      await deleteChild(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner 404 si enfant introuvable', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'child-1';
      prisma.children.findUnique.mockResolvedValue(null);

      await deleteChild(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Enfant introuvable' });
    });

    it('devrait retourner 403 si enfant n\'appartient pas au centre de santé', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'child-1';

      const mockChild = {
        id: 'child-1',
        healthCenterId: 'healthcenter-2', // Différent
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);

      await deleteChild(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé pour cet enfant',
      });
    });

    it('devrait supprimer un enfant avec toutes ses données liées', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'child-1';

      const mockChild = {
        id: 'child-1',
        firstName: 'John',
        lastName: 'Doe',
        healthCenterId: 'healthcenter-1',
      };

      const mockScheduled = [{ id: 'scheduled-1' }];

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          childVaccineScheduled: {
            findMany: jest.fn().mockResolvedValue(mockScheduled),
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          stockReservation: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineCompleted: {
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
          vaccineRequest: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          record: {
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          children: {
            delete: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      await deleteChild(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Enfant supprimé avec succès',
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'child-1';

      const error = new Error('Erreur DB');
      prisma.children.findUnique.mockRejectedValue(error);

      await deleteChild(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('activateChild', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT ou NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'child-1';
      await activateChild(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 404 si enfant introuvable', async () => {
      req.user.role = 'AGENT';
      req.params.id = 'child-1';
      prisma.children.findUnique.mockResolvedValue(null);

      await activateChild(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Enfant non trouvé' });
    });

    it('devrait retourner 403 si accès géographique refusé', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'child-1';

      const mockChild = {
        id: 'child-1',
        healthCenterId: 'healthcenter-2', // Différent
        healthCenter: {
          district: {
            commune: {
              region: { id: 'region-1' },
            },
          },
        },
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);

      await activateChild(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait activer un enfant avec succès', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'child-1';

      const mockChild = {
        id: 'child-1',
        firstName: 'John',
        lastName: 'Doe',
        healthCenterId: 'healthcenter-1',
        phoneParent: '+221123456789',
        fatherName: 'Father',
        motherName: 'Mother',
        healthCenter: {
          district: {
            commune: {
              region: { id: 'region-1' },
            },
          },
        },
      };

      const mockUpdatedChild = {
        ...mockChild,
        isActive: true,
        photosRequested: false,
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.children.update.mockResolvedValue(mockUpdatedChild);
      whatsappService.sendAccountActivationWhatsApp.mockResolvedValue();
      notificationService2.notifyAccountActivated.mockResolvedValue();

      await activateChild(req, res, next);

      expect(prisma.children.update).toHaveBeenCalledWith({
        where: { id: 'child-1' },
        data: {
          isActive: true,
          photosRequested: false,
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Compte activé avec succès',
        child: mockUpdatedChild,
      });
      expect(whatsappService.sendAccountActivationWhatsApp).toHaveBeenCalled();
      expect(notificationService2.notifyAccountActivated).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs WhatsApp sans bloquer', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'child-1';

      const mockChild = {
        id: 'child-1',
        firstName: 'John',
        lastName: 'Doe',
        healthCenterId: 'healthcenter-1',
        phoneParent: '+221123456789',
        fatherName: 'Father',
        healthCenter: {
          district: {
            commune: {
              region: { id: 'region-1' },
            },
          },
        },
      };

      const mockUpdatedChild = {
        ...mockChild,
        isActive: true,
        photosRequested: false,
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.children.update.mockResolvedValue(mockUpdatedChild);
      whatsappService.sendAccountActivationWhatsApp.mockRejectedValue(new Error('WhatsApp error'));
      notificationService2.notifyAccountActivated.mockResolvedValue();

      await activateChild(req, res, next);

      // L'activation doit réussir même si WhatsApp échoue
      consoleErrorSpy.mockRestore();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Compte activé avec succès',
        child: mockUpdatedChild,
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'AGENT';
      req.params.id = 'child-1';
      const error = new Error('Erreur DB');
      prisma.children.findUnique.mockRejectedValue(error);

      await activateChild(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('requestPhotos', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT ou NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'child-1';
      await requestPhotos(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 404 si enfant introuvable', async () => {
      req.user.role = 'AGENT';
      req.params.id = 'child-1';
      prisma.children.findUnique.mockResolvedValue(null);

      await requestPhotos(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Enfant non trouvé' });
    });

    it('devrait retourner 403 si accès géographique refusé', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'child-1';

      const mockChild = {
        id: 'child-1',
        healthCenterId: 'healthcenter-2', // Différent
        healthCenter: {
          district: {
            commune: {
              region: { id: 'region-1' },
            },
          },
        },
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);

      await requestPhotos(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait demander des photos avec succès', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'child-1';

      const mockChild = {
        id: 'child-1',
        firstName: 'John',
        lastName: 'Doe',
        healthCenterId: 'healthcenter-1',
        phoneParent: '+221123456789',
        fatherName: 'Father',
        motherName: 'Mother',
        healthCenter: {
          district: {
            commune: {
              region: { id: 'region-1' },
            },
          },
        },
      };

      const mockUpdatedChild = {
        ...mockChild,
        photosRequested: true,
        isActive: false,
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.children.update.mockResolvedValue(mockUpdatedChild);
      whatsappService.sendPhotoRequestWhatsApp.mockResolvedValue();

      await requestPhotos(req, res, next);

      expect(prisma.children.update).toHaveBeenCalledWith({
        where: { id: 'child-1' },
        data: {
          photosRequested: true,
          isActive: false,
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Demande de nouvelles photos envoyée',
        child: mockUpdatedChild,
      });
      expect(whatsappService.sendPhotoRequestWhatsApp).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'AGENT';
      req.params.id = 'child-1';
      const error = new Error('Erreur DB');
      prisma.children.findUnique.mockRejectedValue(error);

      await requestPhotos(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});







