// tests/unit/appName.test.js
const prisma = require("../../src/config/prismaClient");
const { getAppName } = require("../../src/utils/appName");

// Mocker Prisma
jest.mock("../../src/config/prismaClient", () => ({
  appSettings: {
    findFirst: jest.fn(),
  },
}));

describe("appName", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAppName", () => {
    it("devrait retourner le nom de l'application depuis les paramètres", async () => {
      prisma.appSettings.findFirst.mockResolvedValue({
        appName: "TestApp",
      });

      const appName = await getAppName();
      expect(appName).toBe("TestApp");
      expect(prisma.appSettings.findFirst).toHaveBeenCalled();
    });

    it("devrait retourner 'Imunia' par défaut si aucun paramètre n'est trouvé", async () => {
      prisma.appSettings.findFirst.mockResolvedValue(null);

      const appName = await getAppName();
      expect(appName).toBe("Imunia");
    });

    it("devrait retourner 'Imunia' par défaut si appName est null", async () => {
      prisma.appSettings.findFirst.mockResolvedValue({
        appName: null,
      });

      const appName = await getAppName();
      expect(appName).toBe("Imunia");
    });

    it("devrait retourner 'Imunia' en cas d'erreur", async () => {
      prisma.appSettings.findFirst.mockRejectedValue(new Error("Erreur DB"));

      const appName = await getAppName();
      expect(appName).toBe("Imunia");
    });
  });
});
