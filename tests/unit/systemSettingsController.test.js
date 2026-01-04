// tests/unit/systemSettingsController.test.js

const { getSystemSettings } = require('../../src/controllers/systemSettingsController');
const prisma = require('../../src/config/prismaClient');

jest.mock('../../src/config/prismaClient', () => ({
  appSettings: {
    findFirst: jest.fn(),
  },
}));

describe('systemSettingsController', () => {
  let req, res;

  beforeEach(() => {
    req = {};
    res = {
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  describe('getSystemSettings', () => {
    it('devrait retourner les paramètres système par défaut', async () => {
      prisma.appSettings.findFirst.mockResolvedValue(null);

      await getSystemSettings(req, res);

      expect(res.json).toHaveBeenCalledWith({
        appName: 'Imunia',
        appSubtitle: 'Plateforme de gestion de vaccination',
        logoUrl: '/logo.png',
      });
    });

    it('devrait toujours retourner les mêmes valeurs', async () => {
      prisma.appSettings.findFirst.mockResolvedValue(null);

      await getSystemSettings(req, res);
      const firstCall = res.json.mock.calls[0][0];

      res.json.mockClear();
      await getSystemSettings(req, res);
      const secondCall = res.json.mock.calls[0][0];

      expect(firstCall).toEqual(secondCall);
      expect(firstCall.appName).toBe('Imunia');
      expect(firstCall.appSubtitle).toBe('Plateforme de gestion de vaccination');
      expect(firstCall.logoUrl).toBe('/logo.png');
    });
  });
});


