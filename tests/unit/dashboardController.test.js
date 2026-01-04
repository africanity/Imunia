// tests/unit/dashboardController.test.js

const {
  getNationalDashboardStats,
  getAgentDashboardStats,
  getRegionalDashboardStats,
  getDistrictDashboardStats,
} = require('../../src/controllers/dashboardController');

const prisma = require('../../src/config/prismaClient');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  children: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  childVaccineCompleted: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  childVaccineScheduled: {
    count: jest.fn(),
  },
  childVaccineLate: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  vaccine: {
    findMany: jest.fn(),
  },
  stockHEALTHCENTER: {
    findMany: jest.fn(),
  },
  stockLot: {
    findMany: jest.fn(),
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
  $queryRaw: jest.fn(),
}));

describe('dashboardController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {},
      body: {},
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('getNationalDashboardStats', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';

      await getNationalDashboardStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès réservé au niveau national.',
      });
    });

    it('devrait retourner les statistiques nationales avec succès', async () => {
      req.user.role = 'NATIONAL';

      const mockRecentVaccinations = [
        { administeredAt: new Date('2024-01-15') },
        { administeredAt: new Date('2024-02-20') },
      ];

      const mockVaccinesWithCoverage = [
        {
          id: 'vac-1',
          name: 'Vaccin 1',
          _count: {
            completedByChildren: 100,
          },
        },
        {
          id: 'vac-2',
          name: 'Vaccin 2',
          _count: {
            completedByChildren: 50,
          },
        },
      ];

      const mockLateVaccines = [
        {
          id: 'late-1',
          child: {
            healthCenter: {
              district: {
                commune: {
                  region: {
                    name: 'Region 1',
                  },
                },
              },
            },
          },
        },
        {
          id: 'late-2',
          child: {
            healthCenter: {
              district: {
                commune: {
                  region: {
                    name: 'Region 1',
                  },
                },
              },
            },
          },
        },
        {
          id: 'late-3',
          child: {
            healthCenter: {
              district: {
                commune: {
                  region: {
                    name: 'Region 2',
                  },
                },
              },
            },
          },
        },
      ];

      prisma.children.count.mockResolvedValue(1000);
      prisma.childVaccineCompleted.count.mockResolvedValue(5000);
      prisma.childVaccineCompleted.findMany.mockResolvedValue(mockRecentVaccinations);
      prisma.vaccine.findMany.mockResolvedValue(mockVaccinesWithCoverage);
      prisma.childVaccineLate.findMany.mockResolvedValue(mockLateVaccines);

      await getNationalDashboardStats(req, res, next);

      expect(prisma.children.count).toHaveBeenCalled();
      expect(prisma.childVaccineCompleted.count).toHaveBeenCalled();
      expect(prisma.childVaccineCompleted.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            administeredAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      );
      expect(prisma.vaccine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            _count: expect.objectContaining({
              select: expect.objectContaining({
                completedByChildren: expect.anything(),
              }),
            }),
          }),
        })
      );
      // Vérifier que orderBy et take ne sont plus présents (tri fait en JavaScript)
      expect(prisma.vaccine.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.anything(),
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        totalChildren: 1000,
        totalVaccinations: 5000,
        monthlyVaccinations: expect.any(Array),
        coverageByVaccine: expect.arrayContaining([
          expect.objectContaining({
            name: 'Vaccin 1',
            value: 100,
          }),
          expect.objectContaining({
            name: 'Vaccin 2',
            value: 50,
          }),
        ]),
        topRegions: expect.arrayContaining([
          expect.objectContaining({
            region: 'Region 1',
            retard: 2,
          }),
          expect.objectContaining({
            region: 'Region 2',
            retard: 1,
          }),
        ]),
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';

      prisma.children.count.mockRejectedValue(new Error('DB Error'));

      await getNationalDashboardStats(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getAgentDashboardStats', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT', async () => {
      req.user.role = 'NATIONAL';

      await getAgentDashboardStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès réservé aux agents.',
      });
    });

    it('devrait retourner 400 si healthCenterId manquant', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = null;

      await getAgentDashboardStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Aucun centre de santé n\'est associé à cet agent.',
      });
    });

    it('devrait retourner les statistiques agent avec succès', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'hc-1';

      const mockLowStocks = [
        {
          id: 'stock-1',
          quantity: 30,
          vaccine: {
            name: 'Vaccin 1',
          },
        },
        {
          id: 'stock-2',
          quantity: 20,
          vaccine: {
            name: 'Vaccin 2',
          },
        },
      ];

      const mockExpiringLots = [
        {
          id: 'lot-1',
          expiration: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 jours
          vaccine: {
            name: 'Vaccin 1',
          },
        },
      ];

      const mockDosesRaw = [
        { administeredAt: new Date() },
        { administeredAt: new Date() },
      ];

      const mockMonthlyVaccinationsRaw = [
        { administeredAt: new Date('2024-01-15') },
        { administeredAt: new Date('2024-02-20') },
      ];

      const mockCoverageByVaccineGroup = [
        {
          vaccineId: 'vac-1',
          _count: {
            _all: 50,
          },
        },
        {
          vaccineId: 'vac-2',
          _count: {
            _all: 30,
          },
        },
      ];

      const mockTopLateChildrenGroup = [
        {
          childId: 'child-1',
          _count: {
            _all: 3,
          },
        },
        {
          childId: 'child-2',
          _count: {
            _all: 2,
          },
        },
      ];

      const mockVaccineNameList = [
        { id: 'vac-1', name: 'Vaccin 1' },
        { id: 'vac-2', name: 'Vaccin 2' },
      ];

      const mockChildNameList = [
        { id: 'child-1', firstName: 'Jean', lastName: 'Dupont' },
        { id: 'child-2', firstName: 'Marie', lastName: 'Martin' },
      ];

      prisma.children.count.mockResolvedValue(100);
      prisma.childVaccineScheduled.count
        .mockResolvedValueOnce(5) // appointmentsToday
        .mockResolvedValueOnce(20); // totalAppointmentsPlanned
      prisma.childVaccineCompleted.count.mockResolvedValue(150);
      prisma.childVaccineLate.count.mockResolvedValue(10);
      prisma.stockHEALTHCENTER.findMany.mockResolvedValue(mockLowStocks);
      prisma.stockLot.findMany.mockResolvedValue(mockExpiringLots);
      prisma.childVaccineCompleted.findMany
        .mockResolvedValueOnce(mockDosesRaw) // dosesRaw
        .mockResolvedValueOnce(mockMonthlyVaccinationsRaw); // monthlyVaccinationsRaw
      prisma.childVaccineCompleted.groupBy.mockResolvedValue(mockCoverageByVaccineGroup);
      prisma.childVaccineLate.groupBy.mockResolvedValue(mockTopLateChildrenGroup);
      prisma.vaccine.findMany.mockResolvedValue(mockVaccineNameList);
      prisma.children.findMany.mockResolvedValue(mockChildNameList);

      await getAgentDashboardStats(req, res, next);

      expect(prisma.children.count).toHaveBeenCalledWith({
        where: { healthCenterId: 'hc-1' },
      });
      expect(prisma.stockHEALTHCENTER.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            healthCenterId: 'hc-1',
            quantity: expect.objectContaining({
              lte: 50,
            }),
          }),
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        totalChildren: 100,
        appointmentsToday: 5,
        totalAppointmentsPlanned: 20,
        vaccinationsSaisies: 150,
        remindersSent: 10,
        lowStocks: expect.arrayContaining([
          expect.objectContaining({
            vaccine: 'Vaccin 1',
            remaining: 30,
          }),
          expect.objectContaining({
            vaccine: 'Vaccin 2',
            remaining: 20,
          }),
        ]),
        expiringLots: expect.arrayContaining([
          expect.objectContaining({
            vaccine: 'Vaccin 1',
            lot: 'lot-1',
            expiresInDays: expect.any(Number),
          }),
        ]),
        dosesPerDay: expect.any(Array),
        monthlyVaccinations: expect.any(Array),
        coverageByVaccine: expect.arrayContaining([
          expect.objectContaining({
            name: 'Vaccin 1',
            value: 50,
          }),
          expect.objectContaining({
            name: 'Vaccin 2',
            value: 30,
          }),
        ]),
        topLateChildren: expect.arrayContaining([
          expect.objectContaining({
            name: 'Jean Dupont',
            retard: 3,
          }),
          expect.objectContaining({
            name: 'Marie Martin',
            retard: 2,
          }),
        ]),
      });
    });

    it('devrait gérer les cas où vaccine ou child est null dans les résultats', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'hc-1';

      const mockLowStocks = [
        {
          id: 'stock-1',
          quantity: 30,
          vaccine: null, // Vaccine null
        },
      ];

      const mockExpiringLots = [
        {
          id: 'lot-1',
          expiration: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          vaccine: null, // Vaccine null
        },
      ];

      const mockChildNameList = [
        { id: 'child-1', firstName: null, lastName: null }, // Nom null
      ];

      prisma.children.count.mockResolvedValue(100);
      prisma.childVaccineScheduled.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(20);
      prisma.childVaccineCompleted.count.mockResolvedValue(150);
      prisma.childVaccineLate.count.mockResolvedValue(10);
      prisma.stockHEALTHCENTER.findMany.mockResolvedValue(mockLowStocks);
      prisma.stockLot.findMany.mockResolvedValue(mockExpiringLots);
      prisma.childVaccineCompleted.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prisma.childVaccineCompleted.groupBy.mockResolvedValue([]);
      prisma.childVaccineLate.groupBy.mockResolvedValue([
        {
          childId: 'child-1',
          _count: { _all: 3 },
        },
      ]);
      prisma.vaccine.findMany.mockResolvedValue([]);
      prisma.children.findMany.mockResolvedValue(mockChildNameList);

      await getAgentDashboardStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          lowStocks: expect.arrayContaining([
            expect.objectContaining({
              vaccine: 'Vaccin inconnu',
              remaining: 30,
            }),
          ]),
          expiringLots: expect.arrayContaining([
            expect.objectContaining({
              vaccine: 'Vaccin inconnu',
            }),
          ]),
          topLateChildren: expect.arrayContaining([
            expect.objectContaining({
              name: 'Enfant',
            }),
          ]),
        })
      );
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'hc-1';

      prisma.children.count.mockRejectedValue(new Error('DB Error'));

      await getAgentDashboardStats(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getRegionalDashboardStats', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL', async () => {
      req.user.role = 'NATIONAL';

      await getRegionalDashboardStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès réservé au niveau régional.',
      });
    });

    it('devrait retourner 400 si regionId manquant', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = null;

      await getRegionalDashboardStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Aucune région n\'est associée à cet utilisateur.',
      });
    });

    it('devrait retourner les statistiques régionales avec succès', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';

      const mockRegion = {
        id: 'region-1',
        name: 'Region Test',
      };

      const mockRecentVaccinations = [
        { administeredAt: new Date('2024-01-15') },
        { administeredAt: new Date('2024-02-20') },
      ];

      const mockCoverageRaw = [
        { vaccineId: 'vac-1', count: 100 },
        { vaccineId: 'vac-2', count: 50 },
      ];

      const mockLateVaccines = [
        {
          id: 'late-1',
          child: {
            healthCenter: {
              district: {
                name: 'District 1',
              },
            },
          },
        },
        {
          id: 'late-2',
          child: {
            healthCenter: {
              district: {
                name: 'District 1',
              },
            },
          },
        },
        {
          id: 'late-3',
          child: {
            healthCenter: {
              district: {
                name: 'District 2',
              },
            },
          },
        },
      ];

      const mockVaccineNames = [
        { id: 'vac-1', name: 'Vaccin 1' },
        { id: 'vac-2', name: 'Vaccin 2' },
      ];

      prisma.region.findUnique.mockResolvedValue(mockRegion);
      prisma.children.count
        .mockResolvedValueOnce(1000) // totalChildren
        .mockResolvedValueOnce(800); // vaccinatedChildren
      prisma.childVaccineCompleted.findMany.mockResolvedValue(mockRecentVaccinations);
      prisma.$queryRaw.mockResolvedValue(mockCoverageRaw);
      prisma.childVaccineLate.findMany.mockResolvedValue(mockLateVaccines);
      prisma.vaccine.findMany.mockResolvedValue(mockVaccineNames);

      await getRegionalDashboardStats(req, res, next);

      expect(prisma.region.findUnique).toHaveBeenCalledWith({
        where: { id: 'region-1' },
        select: { name: true },
      });
      expect(prisma.children.count).toHaveBeenCalledTimes(2);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        region: 'Region Test',
        totalChildren: 1000,
        vaccinatedChildren: 800,
        coverageRate: 80,
        activeCampaigns: 0,
        monthlyVaccinations: expect.any(Array),
        coverageByVaccine: expect.arrayContaining([
          expect.objectContaining({
            name: 'Vaccin 1',
            value: 100,
          }),
          expect.objectContaining({
            name: 'Vaccin 2',
            value: 50,
          }),
        ]),
        topDistricts: expect.arrayContaining([
          expect.objectContaining({
            name: 'District 1',
            retard: 2,
          }),
          expect.objectContaining({
            name: 'District 2',
            retard: 1,
          }),
        ]),
      });
    });

    it('devrait gérer le cas où coverageRaw n\'est pas un tableau', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';

      prisma.region.findUnique.mockResolvedValue({ name: 'Region Test' });
      prisma.children.count
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(800);
      prisma.childVaccineCompleted.findMany.mockResolvedValue([]);
      prisma.$queryRaw.mockResolvedValue(null); // Pas un tableau
      prisma.childVaccineLate.findMany.mockResolvedValue([]);
      prisma.vaccine.findMany.mockResolvedValue([]);

      await getRegionalDashboardStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          coverageByVaccine: [],
        })
      );
    });

    it('devrait gérer le cas où region est null', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';

      prisma.region.findUnique.mockResolvedValue(null);
      prisma.children.count
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(800);
      prisma.childVaccineCompleted.findMany.mockResolvedValue([]);
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.childVaccineLate.findMany.mockResolvedValue([]);
      prisma.vaccine.findMany.mockResolvedValue([]);

      await getRegionalDashboardStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'Région',
        })
      );
    });

    it('devrait calculer coverageRate à 0 si totalChildren est 0', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';

      prisma.region.findUnique.mockResolvedValue({ name: 'Region Test' });
      prisma.children.count
        .mockResolvedValueOnce(0) // totalChildren = 0
        .mockResolvedValueOnce(0);
      prisma.childVaccineCompleted.findMany.mockResolvedValue([]);
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.childVaccineLate.findMany.mockResolvedValue([]);
      prisma.vaccine.findMany.mockResolvedValue([]);

      await getRegionalDashboardStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          coverageRate: 0,
        })
      );
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';

      prisma.region.findUnique.mockRejectedValue(new Error('DB Error'));

      await getRegionalDashboardStats(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getDistrictDashboardStats', () => {
    it('devrait retourner 403 si utilisateur n\'est pas DISTRICT', async () => {
      req.user.role = 'REGIONAL';

      await getDistrictDashboardStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès réservé au niveau district.',
      });
    });

    it('devrait retourner 400 si districtId manquant', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = null;

      await getDistrictDashboardStats(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Aucun district n\'est associé à cet utilisateur.',
      });
    });

    it('devrait retourner les statistiques district avec succès', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';

      const mockDistrict = {
        id: 'district-1',
        name: 'District Test',
      };

      const mockCoverageRaw = [
        { vaccineId: 'vac-1', count: 100 },
        { vaccineId: 'vac-2', count: 50 },
      ];

      const mockLateVaccines = [
        {
          id: 'late-1',
          child: {
            healthCenter: {
              name: 'Centre 1',
            },
          },
        },
        {
          id: 'late-2',
          child: {
            healthCenter: {
              name: 'Centre 1',
            },
          },
        },
        {
          id: 'late-3',
          child: {
            healthCenter: {
              name: 'Centre 2',
            },
          },
        },
      ];

      const mockHealthCenters = [
        { id: 'hc-1', name: 'Centre 1' },
        { id: 'hc-2', name: 'Centre 2' },
      ];

      const mockMonthlyRaw = [
        {
          healthCenterId: 'hc-1',
          month_key: new Date('2024-01-01'),
          count: 10,
        },
        {
          healthCenterId: 'hc-1',
          month_key: new Date('2024-02-01'),
          count: 15,
        },
        {
          healthCenterId: 'hc-2',
          month_key: new Date('2024-01-01'),
          count: 5,
        },
      ];

      const mockVaccineNames = [
        { id: 'vac-1', name: 'Vaccin 1' },
        { id: 'vac-2', name: 'Vaccin 2' },
      ];

      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.children.count
        .mockResolvedValueOnce(500) // totalChildren
        .mockResolvedValueOnce(400); // vaccinatedChildren
      prisma.$queryRaw
        .mockResolvedValueOnce(mockCoverageRaw) // coverageRaw
        .mockResolvedValueOnce(mockMonthlyRaw); // monthlyRaw
      prisma.childVaccineLate.findMany.mockResolvedValue(mockLateVaccines);
      prisma.healthCenter.findMany.mockResolvedValue(mockHealthCenters);
      prisma.vaccine.findMany.mockResolvedValue(mockVaccineNames);

      await getDistrictDashboardStats(req, res, next);

      expect(prisma.district.findUnique).toHaveBeenCalledWith({
        where: { id: 'district-1' },
        select: { name: true },
      });
      expect(prisma.children.count).toHaveBeenCalledTimes(2);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({
        district: 'District Test',
        totalChildren: 500,
        vaccinatedChildren: 400,
        coverageRate: 80,
        activeCampaigns: 0,
        coverageByVaccine: expect.arrayContaining([
          expect.objectContaining({
            name: 'Vaccin 1',
            value: 100,
          }),
          expect.objectContaining({
            name: 'Vaccin 2',
            value: 50,
          }),
        ]),
        topHealthCenters: expect.arrayContaining([
          expect.objectContaining({
            name: 'Centre 1',
            retard: 2,
          }),
          expect.objectContaining({
            name: 'Centre 2',
            retard: 1,
          }),
        ]),
        monthlyByHealthCenter: expect.any(Array),
      });
    });

    it('devrait gérer le cas où monthlyRaw n\'est pas un tableau', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';

      prisma.district.findUnique.mockResolvedValue({ name: 'District Test' });
      prisma.children.count
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(400);
      prisma.$queryRaw
        .mockResolvedValueOnce([]) // coverageRaw
        .mockResolvedValueOnce(null); // monthlyRaw pas un tableau
      prisma.childVaccineLate.findMany.mockResolvedValue([]);
      prisma.healthCenter.findMany.mockResolvedValue([
        { id: 'hc-1', name: 'Centre 1' },
      ]);
      prisma.vaccine.findMany.mockResolvedValue([]);

      await getDistrictDashboardStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          monthlyByHealthCenter: expect.any(Array),
        })
      );
    });

    it('devrait gérer le cas où district est null', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';

      prisma.district.findUnique.mockResolvedValue(null);
      prisma.children.count
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(400);
      prisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prisma.childVaccineLate.findMany.mockResolvedValue([]);
      prisma.healthCenter.findMany.mockResolvedValue([]);
      prisma.vaccine.findMany.mockResolvedValue([]);

      await getDistrictDashboardStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          district: 'District',
        })
      );
    });

    it('devrait filtrer monthlyByHealthCenter pour ne garder que ceux avec total > 0, puis limiter à 5', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';

      prisma.district.findUnique.mockResolvedValue({ name: 'District Test' });
      prisma.children.count
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(400);
      prisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prisma.childVaccineLate.findMany.mockResolvedValue([]);
      prisma.healthCenter.findMany.mockResolvedValue([
        { id: 'hc-1', name: 'Centre 1' },
        { id: 'hc-2', name: 'Centre 2' },
        { id: 'hc-3', name: 'Centre 3' },
        { id: 'hc-4', name: 'Centre 4' },
        { id: 'hc-5', name: 'Centre 5' },
        { id: 'hc-6', name: 'Centre 6' },
      ]);
      prisma.vaccine.findMany.mockResolvedValue([]);

      await getDistrictDashboardStats(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.monthlyByHealthCenter.length).toBeLessThanOrEqual(5);
    });

    it('devrait calculer coverageRate à 0 si totalChildren est 0', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';

      prisma.district.findUnique.mockResolvedValue({ name: 'District Test' });
      prisma.children.count
        .mockResolvedValueOnce(0) // totalChildren = 0
        .mockResolvedValueOnce(0);
      prisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prisma.childVaccineLate.findMany.mockResolvedValue([]);
      prisma.healthCenter.findMany.mockResolvedValue([]);
      prisma.vaccine.findMany.mockResolvedValue([]);

      await getDistrictDashboardStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          coverageRate: 0,
        })
      );
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';

      prisma.district.findUnique.mockRejectedValue(new Error('DB Error'));

      await getDistrictDashboardStats(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});



