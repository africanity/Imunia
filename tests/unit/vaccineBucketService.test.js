// tests/unit/vaccineBucketService.test.js

const prisma = require("../../src/config/prismaClient");
const {
  rebuildChildVaccinationBuckets,
  rebuildAllVaccinationBuckets,
} = require("../../src/services/vaccineBucketService");
const { buildVaccineDoseMap } = require("../../src/utils/vaccineDose");

jest.mock("../../src/config/prismaClient", () => ({
  vaccineCalendar: {
    findMany: jest.fn(),
  },
  children: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  childVaccineDue: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    count: jest.fn(),
  },
  childVaccineLate: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    count: jest.fn(),
  },
  childVaccineOverdue: {
    count: jest.fn(),
  },
}));

jest.mock("../../src/utils/vaccineDose");

describe("vaccineBucketService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rebuildChildVaccinationBuckets", () => {
    it("devrait retourner sans erreur si l'enfant n'existe pas", async () => {
      prisma.vaccineCalendar.findMany.mockResolvedValue([]);
      prisma.children.findUnique.mockResolvedValue(null);

      await rebuildChildVaccinationBuckets("child-1");

      expect(prisma.children.findUnique).toHaveBeenCalledWith({
        where: { id: "child-1" },
        include: {
          completedVaccines: true,
          scheduledVaccines: true,
          overdueVaccines: true,
          lateVaccines: true,
        },
      });
    });

    it("devrait mettre à jour le statut à A_JOUR si aucun calendrier", async () => {
      const mockChild = {
        id: "child-1",
        birthDate: new Date("2020-01-01"),
        gender: "M",
        completedVaccines: [],
        scheduledVaccines: [],
        overdueVaccines: [],
        lateVaccines: [],
      };

      prisma.vaccineCalendar.findMany.mockResolvedValue([]);
      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.childVaccineDue.deleteMany.mockResolvedValue({});
      prisma.childVaccineLate.deleteMany.mockResolvedValue({});
      prisma.children.update.mockResolvedValue(mockChild);

      await rebuildChildVaccinationBuckets("child-1");

      expect(prisma.childVaccineDue.deleteMany).toHaveBeenCalledWith({
        where: { childId: "child-1" },
      });
      expect(prisma.childVaccineLate.deleteMany).toHaveBeenCalledWith({
        where: { childId: "child-1" },
      });
      expect(prisma.children.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: { status: "A_JOUR" },
      });
    });

    it("devrait utiliser le contexte partagé si fourni", async () => {
      const mockChild = {
        id: "child-1",
        birthDate: new Date("2020-01-01"),
        gender: "M",
        completedVaccines: [],
        scheduledVaccines: [],
        overdueVaccines: [],
        lateVaccines: [],
      };

      const sharedCalendars = [];
      const sharedDoseMap = new Map();
      const sharedVaccineMeta = new Map();

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.childVaccineDue.deleteMany.mockResolvedValue({});
      prisma.childVaccineLate.deleteMany.mockResolvedValue({});
      prisma.children.update.mockResolvedValue(mockChild);

      await rebuildChildVaccinationBuckets("child-1", prisma, {
        calendars: sharedCalendars,
        doseMap: sharedDoseMap,
        vaccineMeta: sharedVaccineMeta,
      });

      expect(prisma.vaccineCalendar.findMany).not.toHaveBeenCalled();
    });

    it("devrait créer des entrées childVaccineDue pour les vaccins dans la plage d'âge", async () => {
      const mockChild = {
        id: "child-1",
        birthDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 jours
        gender: "M",
        completedVaccines: [],
        scheduledVaccines: [],
        overdueVaccines: [],
        lateVaccines: [],
      };

      const mockCalendars = [
        {
          id: "calendar-1",
          doseAssignments: [
            {
              vaccine: {
                id: "vaccine-1",
                gender: null,
                dosesRequired: "2",
              },
              minAge: 0,
              maxAge: 90,
              ageUnit: "DAYS",
              specificAge: null,
            },
          ],
        },
      ];

      const mockDoseMap = {
        doseDefinitionMap: new Map([
          [
            "vaccine-1",
            new Map([
              [
                1,
                {
                  calendarId: "calendar-1",
                  minAge: 0,
                  maxAge: 90,
                  ageUnit: "DAYS",
                  specificAge: null,
                },
              ],
            ]),
          ],
        ]),
      };

      const mockVaccineMeta = new Map([
        [
          "vaccine-1",
          {
            gender: null,
          },
        ],
      ]);

      buildVaccineDoseMap.mockReturnValue(mockDoseMap);

      prisma.vaccineCalendar.findMany.mockResolvedValue(mockCalendars);
      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.childVaccineDue.deleteMany.mockResolvedValue({});
      prisma.childVaccineLate.deleteMany.mockResolvedValue({});
      prisma.childVaccineDue.createMany.mockResolvedValue({});
      prisma.childVaccineLate.count.mockResolvedValue(0);
      prisma.childVaccineOverdue.count.mockResolvedValue(0);
      prisma.children.update.mockResolvedValue(mockChild);

      await rebuildChildVaccinationBuckets("child-1");

      expect(prisma.childVaccineDue.createMany).toHaveBeenCalled();
      const createManyCall = prisma.childVaccineDue.createMany.mock.calls[0][0];
      expect(createManyCall.data).toHaveLength(1);
      expect(createManyCall.data[0].childId).toBe("child-1");
      expect(createManyCall.data[0].vaccineId).toBe("vaccine-1");
      expect(createManyCall.data[0].dose).toBe(1);
    });

    it("devrait créer des entrées childVaccineLate pour les vaccins en retard", async () => {
      const mockChild = {
        id: "child-1",
        birthDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // 120 jours
        gender: "M",
        completedVaccines: [],
        scheduledVaccines: [],
        overdueVaccines: [],
        lateVaccines: [],
      };

      const mockCalendars = [
        {
          id: "calendar-1",
          doseAssignments: [
            {
              vaccine: {
                id: "vaccine-1",
                gender: null,
                dosesRequired: "2",
              },
              minAge: 0,
              maxAge: 90,
              ageUnit: "DAYS",
              specificAge: null,
            },
          ],
        },
      ];

      const mockDoseMap = {
        doseDefinitionMap: new Map([
          [
            "vaccine-1",
            new Map([
              [
                1,
                {
                  calendarId: "calendar-1",
                  minAge: 0,
                  maxAge: 90,
                  ageUnit: "DAYS",
                  specificAge: null,
                },
              ],
            ]),
          ],
        ]),
      };

      buildVaccineDoseMap.mockReturnValue(mockDoseMap);

      prisma.vaccineCalendar.findMany.mockResolvedValue(mockCalendars);
      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.childVaccineDue.deleteMany.mockResolvedValue({});
      prisma.childVaccineLate.deleteMany.mockResolvedValue({});
      prisma.childVaccineLate.createMany.mockResolvedValue({});
      prisma.childVaccineLate.count.mockResolvedValue(1);
      prisma.childVaccineOverdue.count.mockResolvedValue(0);
      prisma.children.update.mockResolvedValue(mockChild);

      await rebuildChildVaccinationBuckets("child-1");

      expect(prisma.childVaccineLate.createMany).toHaveBeenCalled();
      expect(prisma.children.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: { status: "PAS_A_JOUR" },
      });
    });

    it("devrait ignorer les vaccins spécifiques au genre si le genre ne correspond pas", async () => {
      const mockChild = {
        id: "child-1",
        birthDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        gender: "M",
        completedVaccines: [],
        scheduledVaccines: [],
        overdueVaccines: [],
        lateVaccines: [],
      };

      const mockCalendars = [
        {
          id: "calendar-1",
          doseAssignments: [
            {
              vaccine: {
                id: "vaccine-1",
                gender: "F", // Vaccin pour filles uniquement
                dosesRequired: "2",
              },
              minAge: 0,
              maxAge: 90,
              ageUnit: "DAYS",
              specificAge: null,
            },
          ],
        },
      ];

      const mockDoseMap = {
        doseDefinitionMap: new Map([
          [
            "vaccine-1",
            new Map([
              [
                1,
                {
                  calendarId: "calendar-1",
                  minAge: 0,
                  maxAge: 90,
                  ageUnit: "DAYS",
                  specificAge: null,
                },
              ],
            ]),
          ],
        ]),
      };

      buildVaccineDoseMap.mockReturnValue(mockDoseMap);

      prisma.vaccineCalendar.findMany.mockResolvedValue(mockCalendars);
      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.childVaccineDue.deleteMany.mockResolvedValue({});
      prisma.childVaccineLate.deleteMany.mockResolvedValue({});
      prisma.childVaccineLate.count.mockResolvedValue(0);
      prisma.childVaccineOverdue.count.mockResolvedValue(0);
      prisma.children.update.mockResolvedValue(mockChild);

      await rebuildChildVaccinationBuckets("child-1");

      expect(prisma.childVaccineDue.createMany).not.toHaveBeenCalled();
      expect(prisma.childVaccineLate.createMany).not.toHaveBeenCalled();
    });

    it("devrait ignorer les doses déjà complétées, programmées ou en retard", async () => {
      const mockChild = {
        id: "child-1",
        birthDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        gender: "M",
        completedVaccines: [
          {
            vaccineId: "vaccine-1",
            vaccineCalendarId: "calendar-1",
            dose: 1,
          },
        ],
        scheduledVaccines: [],
        overdueVaccines: [],
        lateVaccines: [],
      };

      const mockCalendars = [
        {
          id: "calendar-1",
          doseAssignments: [
            {
              vaccine: {
                id: "vaccine-1",
                gender: null,
                dosesRequired: "2",
              },
              minAge: 0,
              maxAge: 90,
              ageUnit: "DAYS",
              specificAge: null,
            },
          ],
        },
      ];

      const mockDoseMap = {
        doseDefinitionMap: new Map([
          [
            "vaccine-1",
            new Map([
              [
                1,
                {
                  calendarId: "calendar-1",
                  minAge: 0,
                  maxAge: 90,
                  ageUnit: "DAYS",
                  specificAge: null,
                },
              ],
            ]),
          ],
        ]),
      };

      buildVaccineDoseMap.mockReturnValue(mockDoseMap);

      prisma.vaccineCalendar.findMany.mockResolvedValue(mockCalendars);
      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.childVaccineDue.deleteMany.mockResolvedValue({});
      prisma.childVaccineLate.deleteMany.mockResolvedValue({});
      prisma.childVaccineLate.count.mockResolvedValue(0);
      prisma.childVaccineOverdue.count.mockResolvedValue(0);
      prisma.children.update.mockResolvedValue(mockChild);

      await rebuildChildVaccinationBuckets("child-1");

      expect(prisma.childVaccineDue.createMany).not.toHaveBeenCalled();
    });
  });

  describe("rebuildAllVaccinationBuckets", () => {
    it("devrait reconstruire les buckets pour tous les enfants", async () => {
      const mockCalendars = [];
      const mockChildren = [{ id: "child-1" }, { id: "child-2" }];

      prisma.vaccineCalendar.findMany.mockResolvedValue(mockCalendars);
      prisma.children.findMany.mockResolvedValue(mockChildren);
      buildVaccineDoseMap.mockReturnValue({ doseDefinitionMap: new Map() });

      // Mock pour chaque enfant
      prisma.children.findUnique.mockResolvedValue({
        id: "child-1",
        birthDate: new Date(),
        gender: "M",
        completedVaccines: [],
        scheduledVaccines: [],
        overdueVaccines: [],
        lateVaccines: [],
      });
      prisma.childVaccineDue.deleteMany.mockResolvedValue({});
      prisma.childVaccineLate.deleteMany.mockResolvedValue({});
      prisma.children.update.mockResolvedValue({});

      await rebuildAllVaccinationBuckets();

      expect(prisma.vaccineCalendar.findMany).toHaveBeenCalled();
      expect(prisma.children.findMany).toHaveBeenCalled();
      expect(buildVaccineDoseMap).toHaveBeenCalledWith(mockCalendars);
    });
  });
});
