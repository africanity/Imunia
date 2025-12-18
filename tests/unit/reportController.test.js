// tests/unit/reportController.test.js

const {
  getAgentReports,
  getRegionalReports,
  getNationalReports,
  getDistrictReports,
  getRegionDetails,
  getDistrictDetails,
  getHealthCenterDetails,
} = require('../../src/controllers/reportController');

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
  childVaccineDue: {
    count: jest.fn(),
  },
  childVaccineLate: {
    count: jest.fn(),
  },
  childVaccineOverdue: {
    count: jest.fn(),
  },
  stockHEALTHCENTER: {
    findMany: jest.fn(),
  },
  stockDISTRICT: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  stockREGIONAL: {
    count: jest.fn(),
  },
  stockNATIONAL: {
    count: jest.fn(),
  },
  vaccine: {
    findUnique: jest.fn(),
  },
  region: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  district: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  healthCenter: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  campaign: {
    count: jest.fn(),
  },
  user: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
}));

describe('reportController', () => {
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

  describe('getAgentReports', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT', async () => {
      req.user.role = 'NATIONAL';

      await getAgentReports(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 403 si healthCenterId manquant', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = null;

      await getAgentReports(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner les rapports agent avec succès', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'hc-1';
      req.query = { period: '6months' };

      const mockVaccinations = [
        { administeredAt: new Date('2024-01-15') },
        { administeredAt: new Date('2024-02-20') },
      ];

      const mockStocks = [
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

      const mockRecentActivity = [
        {
          administeredAt: new Date(),
          child: {
            firstName: 'Jean',
            lastName: 'Dupont',
          },
          vaccine: {
            name: 'Vaccin 1',
          },
        },
      ];

      prisma.childVaccineCompleted.count
        .mockResolvedValueOnce(100) // totalVaccinations
        .mockResolvedValueOnce(10) // thisMonth
        .mockResolvedValueOnce(5); // thisWeek
      prisma.childVaccineCompleted.findMany
        .mockResolvedValueOnce(mockVaccinations) // Monthly trend
        .mockResolvedValueOnce(mockRecentActivity); // Recent activity
      prisma.stockHEALTHCENTER.findMany.mockResolvedValue(mockStocks);

      await getAgentReports(req, res, next);

      expect(prisma.childVaccineCompleted.count).toHaveBeenCalledTimes(3);
      expect(prisma.stockHEALTHCENTER.findMany).toHaveBeenCalledWith({
        where: { healthCenterId: 'hc-1' },
        include: {
          vaccine: { select: { name: true } },
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        totalVaccinations: 100,
        thisMonth: 10,
        thisWeek: 5,
        criticalStocks: 1, // 1 stock avec quantity < 30 (Vaccin 2)
        stockStatus: expect.arrayContaining([
          expect.objectContaining({
            vaccine: 'Vaccin 1',
            quantity: 30,
            status: 'warning', // 30 n'est pas < 30, donc warning
          }),
          expect.objectContaining({
            vaccine: 'Vaccin 2',
            quantity: 20,
            status: 'critical', // 20 < 30, donc critical
          }),
        ]),
        recentActivity: expect.arrayContaining([
          expect.objectContaining({
            child: 'Jean Dupont',
            vaccine: 'Vaccin 1',
          }),
        ]),
        monthlyTrend: expect.any(Array),
      });
    });

    it('devrait gérer les cas où vaccine est null dans stockStatus', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'hc-1';
      req.query = { period: '6months' };

      const mockStocks = [
        {
          id: 'stock-1',
          quantity: 30,
          vaccine: null, // Vaccine null
        },
      ];

      prisma.childVaccineCompleted.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);
      prisma.childVaccineCompleted.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prisma.stockHEALTHCENTER.findMany.mockResolvedValue(mockStocks);

      await getAgentReports(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stockStatus: expect.arrayContaining([
            expect.objectContaining({
              vaccine: 'Vaccin inconnu',
            }),
          ]),
        })
      );
    });

    it('devrait gérer les cas où child ou vaccine est null dans recentActivity', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'hc-1';
      req.query = { period: '6months' };

      const mockRecentActivity = [
        {
          administeredAt: new Date(),
          child: null, // Child null
          vaccine: {
            name: 'Vaccin 1',
          },
        },
        {
          administeredAt: new Date(),
          child: {
            firstName: null,
            lastName: null,
          },
          vaccine: null, // Vaccine null
        },
      ];

      prisma.childVaccineCompleted.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);
      prisma.childVaccineCompleted.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockRecentActivity);
      prisma.stockHEALTHCENTER.findMany.mockResolvedValue([]);

      await getAgentReports(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          recentActivity: expect.arrayContaining([
            expect.objectContaining({
              child: 'Enfant inconnu',
            }),
            expect.objectContaining({
              vaccine: 'Vaccin inconnu',
            }),
          ]),
        })
      );
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'hc-1';

      prisma.childVaccineCompleted.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10)
        .mockRejectedValue(new Error('DB Error'));

      await getAgentReports(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getRegionalReports', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL', async () => {
      req.user.role = 'NATIONAL';

      await getRegionalReports(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 400 si regionId manquant', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = null;

      await getRegionalReports(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Région non associée',
      });
    });

    it('devrait retourner les rapports régionaux avec succès', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.query = { period: '6months' };

      const mockDistricts = [
        {
          id: 'dist-1',
          name: 'District 1',
          healthCenters: [
            { id: 'hc-1', childrens: [] },
          ],
        },
      ];

      const mockChildren = [];
      const mockVaccinations = [
        { administeredAt: new Date('2024-01-15') },
      ];

      const mockVaccineStats = [
        {
          vaccineId: 'vac-1',
          _count: { id: 50 },
        },
      ];

      const mockVaccine = {
        id: 'vac-1',
        name: 'Vaccin 1',
      };

      const mockDistrictStocks = [
        { quantity: 50 },
        { quantity: 30 },
      ];

      prisma.district.findMany.mockResolvedValue(mockDistricts);
      prisma.children.findMany.mockResolvedValue(mockChildren);
      prisma.childVaccineCompleted.count
        .mockResolvedValueOnce(100) // totalVaccinations
        .mockResolvedValueOnce(50); // districtVaccinations
      prisma.childVaccineDue.count
        .mockResolvedValueOnce(20) // totalDueVaccines
        .mockResolvedValueOnce(10); // districtDue
      prisma.campaign.count.mockResolvedValue(2);
      prisma.childVaccineCompleted.findMany.mockResolvedValue(mockVaccinations);
      prisma.childVaccineCompleted.groupBy.mockResolvedValue(mockVaccineStats);
      prisma.vaccine.findUnique.mockResolvedValue(mockVaccine);
      prisma.children.findMany.mockResolvedValue(mockChildren);
      prisma.stockDISTRICT.findMany.mockResolvedValue(mockDistrictStocks);
      prisma.stockREGIONAL.count.mockResolvedValue(3);

      await getRegionalReports(req, res, next);

      expect(prisma.district.findMany).toHaveBeenCalledWith({
        where: {
          commune: { regionId: 'region-1' },
        },
        include: {
          healthCenters: {
            include: {
              childrens: true,
            },
          },
        },
      });
      expect(prisma.stockREGIONAL.count).toHaveBeenCalledWith({
        where: {
          regionId: 'region-1',
          quantity: { lt: 30 },
        },
      });

      expect(res.json).toHaveBeenCalledWith({
        totalCenters: 1,
        totalVaccinations: 100,
        coverageRate: expect.any(Number),
        activeCampaigns: 2,
        criticalStocks: 3,
        centerPerformance: expect.any(Array),
        vaccineDistribution: expect.any(Array),
        monthlyTrend: expect.any(Array),
        alerts: expect.any(Array),
      });
    });

    it('devrait générer des alertes si coverageRate < 75', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.query = { period: '6months' };

      prisma.district.findMany.mockResolvedValue([]);
      prisma.children.findMany.mockResolvedValue([]);
      prisma.childVaccineCompleted.count
        .mockResolvedValueOnce(50) // totalVaccinations
        .mockResolvedValueOnce(0);
      prisma.childVaccineDue.count
        .mockResolvedValueOnce(50) // totalDueVaccines
        .mockResolvedValueOnce(0);
      prisma.childVaccineLate.count.mockResolvedValueOnce(0); // totalLateVaccines
      prisma.campaign.count.mockResolvedValue(0);
      prisma.childVaccineCompleted.findMany.mockResolvedValue([]);
      prisma.childVaccineCompleted.groupBy.mockResolvedValue([]);
      prisma.stockDISTRICT.findMany.mockResolvedValue([]);
      prisma.stockREGIONAL.count.mockResolvedValue(0);

      await getRegionalReports(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          alerts: expect.arrayContaining([
            expect.objectContaining({
              type: 'coverage',
              severity: 'high',
            }),
          ]),
        })
      );
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';

      prisma.district.findMany.mockRejectedValue(new Error('DB Error'));

      await getRegionalReports(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getNationalReports', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';

      await getNationalReports(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner les rapports nationaux avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.query = { period: '6months' };

      const mockVaccinations = [
        { administeredAt: new Date('2024-01-15') },
      ];

      const mockVaccineStats = [
        {
          vaccineId: 'vac-1',
          _count: { id: 100 },
        },
      ];

      const mockVaccine = {
        id: 'vac-1',
        name: 'Vaccin 1',
      };

      const mockRegions = [
        {
          id: 'region-1',
          name: 'Region 1',
          communes: [
            {
              district: {
                healthCenters: [
                  { childrens: [] },
                ],
              },
            },
          ],
        },
      ];

      prisma.children.count.mockResolvedValue(1000);
      prisma.childVaccineCompleted.count.mockResolvedValue(5000);
      prisma.region.count.mockResolvedValue(5);
      prisma.healthCenter.count.mockResolvedValue(50);
      prisma.childVaccineDue.count.mockResolvedValue(200);
      prisma.campaign.count.mockResolvedValue(3);
      prisma.stockNATIONAL.count.mockResolvedValue(2);
      prisma.childVaccineCompleted.findMany.mockResolvedValue(mockVaccinations);
      prisma.childVaccineCompleted.groupBy.mockResolvedValue(mockVaccineStats);
      prisma.vaccine.findUnique.mockResolvedValue(mockVaccine);
      prisma.region.findMany.mockResolvedValue(mockRegions);
      prisma.children.findMany.mockResolvedValue([]);

      await getNationalReports(req, res, next);

      expect(prisma.stockNATIONAL.count).toHaveBeenCalledWith({
        where: {
          quantity: { lt: 30 },
        },
      });

      expect(res.json).toHaveBeenCalledWith({
        summary: expect.objectContaining({
          totalChildren: 1000,
          totalVaccinations: 5000,
          totalRegions: 5,
          totalHealthCenters: 50,
          campaigns: 3,
          coverageRate: expect.any(Number),
          criticalStocks: 2,
        }),
        monthlyVaccinations: expect.any(Array),
        coverageByVaccine: expect.any(Array),
        regionPerformance: expect.any(Array),
        top5BestRegions: expect.any(Array),
        top5WorstRegions: expect.any(Array),
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';

      prisma.children.count.mockRejectedValue(new Error('DB Error'));

      await getNationalReports(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getDistrictReports', () => {
    it('devrait retourner 403 si utilisateur n\'est pas DISTRICT', async () => {
      req.user.role = 'REGIONAL';

      await getDistrictReports(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 403 si districtId manquant', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = null;

      await getDistrictReports(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 404 si district non trouvé', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.query = { period: '6months' };

      prisma.district.findUnique.mockResolvedValue(null);

      await getDistrictReports(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'District non trouvé',
      });
    });

    it('devrait retourner les rapports district avec succès', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.query = { period: '6months' };

      const mockDistrict = {
        id: 'district-1',
        name: 'District Test',
        commune: {
          region: {
            name: 'Region Test',
          },
        },
        healthCenters: [
          { id: 'hc-1', name: 'Centre 1' },
        ],
      };

      const mockChildren = [];
      const mockVaccinations = [
        { administeredAt: new Date('2024-01-15') },
      ];

      const mockVaccineStats = [
        {
          vaccineId: 'vac-1',
          _count: { id: 50 },
        },
      ];

      const mockVaccine = {
        id: 'vac-1',
        name: 'Vaccin 1',
      };

      const mockHcStocks = [
        { quantity: 30 },
      ];

      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.children.findMany.mockResolvedValue(mockChildren);
      prisma.childVaccineCompleted.count
        .mockResolvedValueOnce(100) // totalVaccinations
        .mockResolvedValueOnce(50); // hcVaccinations
      prisma.childVaccineDue.count
        .mockResolvedValueOnce(20) // totalDueVaccines
        .mockResolvedValueOnce(10); // hcDue
      prisma.childVaccineCompleted.findMany.mockResolvedValue(mockVaccinations);
      prisma.childVaccineCompleted.groupBy.mockResolvedValue(mockVaccineStats);
      prisma.vaccine.findUnique.mockResolvedValue(mockVaccine);
      prisma.children.count.mockResolvedValue(0);
      prisma.stockHEALTHCENTER.findMany.mockResolvedValue(mockHcStocks);
      prisma.stockDISTRICT.count.mockResolvedValue(2);

      await getDistrictReports(req, res, next);

      expect(prisma.stockDISTRICT.count).toHaveBeenCalledWith({
        where: {
          districtId: 'district-1',
          quantity: { lt: 30 },
        },
      });

      expect(res.json).toHaveBeenCalledWith({
        totalCenters: 1,
        totalVaccinations: 100,
        coverageRate: expect.any(Number),
        criticalStocks: 2,
        centerPerformance: expect.any(Array),
        vaccineDistribution: expect.any(Array),
        monthlyTrend: expect.any(Array),
        alerts: expect.any(Array),
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';

      prisma.district.findUnique.mockRejectedValue(new Error('DB Error'));

      await getDistrictReports(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getRegionDetails', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params = { regionName: 'Region 1' };

      await getRegionDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 404 si région non trouvée', async () => {
      req.user.role = 'NATIONAL';
      req.params = { regionName: 'Region Inexistante' };
      req.query = { period: '6months' };

      prisma.region.findFirst.mockResolvedValue(null);

      await getRegionDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Région non trouvée',
      });
    });

    it('devrait retourner les détails de la région avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.params = { regionName: 'Region 1' };
      req.query = { period: '6months' };

      const mockRegion = {
        id: 'region-1',
        name: 'Region 1',
        communes: [
          {
            district: {
              id: 'dist-1',
              name: 'District 1',
            },
          },
        ],
      };

      const mockDistricts = [
        { id: 'dist-1', name: 'District 1' },
      ];

      const mockVaccinations = [
        { administeredAt: new Date('2024-01-15') },
      ];

      const mockVaccineStats = [
        {
          vaccineId: 'vac-1',
          _count: { id: 50 },
        },
      ];

      const mockVaccine = {
        id: 'vac-1',
        name: 'Vaccin 1',
      };

      prisma.region.findFirst.mockResolvedValue(mockRegion);
      prisma.children.count
        .mockResolvedValueOnce(100) // totalChildren
        .mockResolvedValueOnce(50); // districtChildren
      prisma.childVaccineCompleted.count
        .mockResolvedValueOnce(80) // totalVaccinations
        .mockResolvedValueOnce(40); // districtVaccinations
      prisma.childVaccineDue.count
        .mockResolvedValueOnce(20) // totalDue
        .mockResolvedValueOnce(10); // districtDue
      prisma.childVaccineOverdue.count.mockResolvedValue(5);
      prisma.district.findMany.mockResolvedValue(mockDistricts);
      prisma.user.count.mockResolvedValue(10);
      prisma.childVaccineCompleted.findMany.mockResolvedValue(mockVaccinations);
      prisma.childVaccineCompleted.groupBy.mockResolvedValue(mockVaccineStats);
      prisma.vaccine.findUnique.mockResolvedValue(mockVaccine);

      await getRegionDetails(req, res, next);

      expect(prisma.region.findFirst).toHaveBeenCalledWith({
        where: { name: 'Region 1' },
        include: {
          communes: {
            include: {
              district: true,
            },
          },
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        region: 'Region 1',
        summary: expect.objectContaining({
          totalChildren: 100,
          totalVaccinations: 80,
          coverageRate: expect.any(Number),
          totalDistricts: 1,
          overdueVaccinations: 5,
        }),
        districtStats: expect.any(Array),
        vaccineDistribution: expect.any(Array),
        monthlyVaccinations: expect.any(Array),
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      req.params = { regionName: 'Region 1' };

      prisma.region.findFirst.mockRejectedValue(new Error('DB Error'));

      await getRegionDetails(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getDistrictDetails', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params = { regionName: 'Region 1', districtName: 'District 1' };

      await getDistrictDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 404 si région non trouvée', async () => {
      req.user.role = 'NATIONAL';
      req.params = { regionName: 'Region Inexistante', districtName: 'District 1' };
      req.query = { period: '6months' };

      prisma.region.findFirst.mockResolvedValue(null);

      await getDistrictDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Région non trouvée',
      });
    });

    it('devrait retourner 404 si district non trouvé', async () => {
      req.user.role = 'NATIONAL';
      req.params = { regionName: 'Region 1', districtName: 'District Inexistant' };
      req.query = { period: '6months' };

      const mockRegion = {
        id: 'region-1',
        name: 'Region 1',
      };

      prisma.region.findFirst.mockResolvedValue(mockRegion);
      prisma.district.findFirst.mockResolvedValue(null);

      await getDistrictDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'District non trouvé',
      });
    });

    it('devrait retourner les détails du district avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.params = { regionName: 'Region 1', districtName: 'District 1' };
      req.query = { period: '6months' };

      const mockRegion = {
        id: 'region-1',
        name: 'Region 1',
      };

      const mockDistrict = {
        id: 'district-1',
        name: 'District 1',
        healthCenters: [
          { id: 'hc-1', name: 'Centre 1' },
        ],
      };

      const mockVaccinations = [
        { administeredAt: new Date('2024-01-15') },
      ];

      const mockVaccineStats = [
        {
          vaccineId: 'vac-1',
          _count: { id: 50 },
        },
      ];

      const mockVaccine = {
        id: 'vac-1',
        name: 'Vaccin 1',
      };

      prisma.region.findFirst.mockResolvedValue(mockRegion);
      prisma.district.findFirst.mockResolvedValue(mockDistrict);
      prisma.children.count
        .mockResolvedValueOnce(100) // totalChildren
        .mockResolvedValueOnce(50); // hcChildren
      prisma.childVaccineCompleted.count
        .mockResolvedValueOnce(80) // totalVaccinations
        .mockResolvedValueOnce(40); // hcVaccinations
      prisma.childVaccineDue.count
        .mockResolvedValueOnce(20) // totalDue
        .mockResolvedValueOnce(10); // hcDue
      prisma.childVaccineOverdue.count.mockResolvedValue(5);
      prisma.user.count
        .mockResolvedValueOnce(10) // totalAgents
        .mockResolvedValueOnce(8) // activeAgents
        .mockResolvedValueOnce(5) // agentsCount
        .mockResolvedValueOnce(4); // activeAgentsCount
      prisma.childVaccineCompleted.findMany.mockResolvedValue(mockVaccinations);
      prisma.childVaccineCompleted.groupBy.mockResolvedValue(mockVaccineStats);
      prisma.vaccine.findUnique.mockResolvedValue(mockVaccine);

      await getDistrictDetails(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        region: 'Region 1',
        district: 'District 1',
        summary: expect.objectContaining({
          totalChildren: 100,
          totalVaccinations: 80,
          coverageRate: expect.any(Number),
          totalHealthCenters: 1,
          activeHealthCenters: 1,
          totalAgents: 10,
          activeAgents: 8,
          overdueVaccinations: 5,
        }),
        healthCenterStats: expect.any(Array),
        monthlyVaccinations: expect.any(Array),
        vaccineDistribution: expect.any(Array),
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      req.params = { regionName: 'Region 1', districtName: 'District 1' };

      prisma.region.findFirst.mockRejectedValue(new Error('DB Error'));

      await getDistrictDetails(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getHealthCenterDetails', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params = {
        regionName: 'Region 1',
        districtName: 'District 1',
        healthCenterName: 'Centre 1',
      };

      await getHealthCenterDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 404 si région non trouvée', async () => {
      req.user.role = 'NATIONAL';
      req.params = {
        regionName: 'Region Inexistante',
        districtName: 'District 1',
        healthCenterName: 'Centre 1',
      };
      req.query = { period: '6months' };

      prisma.region.findFirst.mockResolvedValue(null);

      await getHealthCenterDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Région non trouvée',
      });
    });

    it('devrait retourner 404 si district non trouvé', async () => {
      req.user.role = 'NATIONAL';
      req.params = {
        regionName: 'Region 1',
        districtName: 'District Inexistant',
        healthCenterName: 'Centre 1',
      };
      req.query = { period: '6months' };

      const mockRegion = {
        id: 'region-1',
        name: 'Region 1',
      };

      prisma.region.findFirst.mockResolvedValue(mockRegion);
      prisma.district.findFirst.mockResolvedValue(null);

      await getHealthCenterDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'District non trouvé',
      });
    });

    it('devrait retourner 404 si centre de santé non trouvé', async () => {
      req.user.role = 'NATIONAL';
      req.params = {
        regionName: 'Region 1',
        districtName: 'District 1',
        healthCenterName: 'Centre Inexistant',
      };
      req.query = { period: '6months' };

      const mockRegion = {
        id: 'region-1',
        name: 'Region 1',
      };

      const mockDistrict = {
        id: 'district-1',
        name: 'District 1',
      };

      prisma.region.findFirst.mockResolvedValue(mockRegion);
      prisma.district.findFirst.mockResolvedValue(mockDistrict);
      prisma.healthCenter.findFirst.mockResolvedValue(null);

      await getHealthCenterDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Centre de santé non trouvé',
      });
    });

    it('devrait retourner les détails du centre de santé avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.params = {
        regionName: 'Region 1',
        districtName: 'District 1',
        healthCenterName: 'Centre 1',
      };
      req.query = { period: '6months' };

      const mockRegion = {
        id: 'region-1',
        name: 'Region 1',
      };

      const mockDistrict = {
        id: 'district-1',
        name: 'District 1',
      };

      const mockHealthCenter = {
        id: 'hc-1',
        name: 'Centre 1',
      };

      const mockAgents = [
        {
          id: 'agent-1',
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean@test.com',
          phone: '123456789',
          agentLevel: 'ADMIN',
          isActive: true,
        },
      ];

      const mockVaccinations = [
        { administeredAt: new Date('2024-01-15') },
      ];

      const mockVaccineStats = [
        {
          vaccineId: 'vac-1',
          _count: { id: 50 },
        },
      ];

      const mockVaccine = {
        id: 'vac-1',
        name: 'Vaccin 1',
      };

      const mockChildrenVaccinated = [
        { childId: 'child-1' },
      ];

      prisma.region.findFirst.mockResolvedValue(mockRegion);
      prisma.district.findFirst.mockResolvedValue(mockDistrict);
      prisma.healthCenter.findFirst.mockResolvedValue(mockHealthCenter);
      prisma.children.count.mockResolvedValue(100);
      prisma.childVaccineCompleted.count
        .mockResolvedValueOnce(80) // totalVaccinations
        .mockResolvedValueOnce(40) // vaccinations (agent)
        .mockResolvedValueOnce(0); // completedAppointments
      prisma.childVaccineDue.count.mockResolvedValue(20);
      prisma.childVaccineOverdue.count.mockResolvedValue(5);
      prisma.user.count
        .mockResolvedValueOnce(10) // totalAgents
        .mockResolvedValueOnce(8); // activeAgents
      prisma.user.findMany.mockResolvedValue(mockAgents);
      prisma.childVaccineCompleted.groupBy
        .mockResolvedValueOnce(mockChildrenVaccinated) // childrenVaccinated
        .mockResolvedValueOnce(mockVaccineStats); // vaccineStats
      prisma.childVaccineScheduled.count.mockResolvedValue(0);
      prisma.childVaccineCompleted.findMany.mockResolvedValue(mockVaccinations);
      prisma.vaccine.findUnique.mockResolvedValue(mockVaccine);

      await getHealthCenterDetails(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        region: 'Region 1',
        district: 'District 1',
        healthCenter: 'Centre 1',
        healthCenterType: 'Centre de santé',
        summary: expect.objectContaining({
          totalChildren: 100,
          totalVaccinations: 80,
          coverageRate: expect.any(Number),
          totalAgents: 10,
          activeAgents: 8,
          overdueVaccinations: 5,
        }),
        agentStats: expect.arrayContaining([
          expect.objectContaining({
            agentId: 'agent-1',
            agentName: 'Jean Dupont',
            agentEmail: 'jean@test.com',
            agentPhone: '123456789',
            agentLevel: 'ADMIN',
            active: true,
            vaccinations: 40,
            childrenVaccinated: 1,
            completedAppointments: 0,
            missedAppointments: 5,
            cancelledAppointments: 0,
            successRate: 0,
          }),
        ]),
        monthlyVaccinations: expect.any(Array),
        vaccineDistribution: expect.any(Array),
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      req.params = {
        regionName: 'Region 1',
        districtName: 'District 1',
        healthCenterName: 'Centre 1',
      };

      prisma.region.findFirst.mockRejectedValue(new Error('DB Error'));

      await getHealthCenterDetails(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});



