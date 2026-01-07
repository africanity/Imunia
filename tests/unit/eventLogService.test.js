// tests/unit/eventLogService.test.js

const prisma = require('../../src/config/prismaClient');
const { logEvent, logEventAsync } = require('../../src/services/eventLogService');

jest.mock('../../src/config/prismaClient', () => ({
  eventLog: {
    create: jest.fn(),
  },
}));

describe('eventLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logEvent', () => {
    it('devrait enregistrer un événement avec tous les paramètres', async () => {
      const params = {
        type: 'ENTITY',
        subtype: 'REGION',
        action: 'CREATE',
        user: {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          role: 'NATIONAL',
        },
        entityType: 'Region',
        entityId: 'region-1',
        entityName: 'Dakar',
        details: { before: null, after: { name: 'Dakar' } },
        metadata: { summary: 'Test' },
      };

      prisma.eventLog.create.mockResolvedValue({ id: 'log-1' });

      await logEvent(params);

      expect(prisma.eventLog.create).toHaveBeenCalledWith({
        data: {
          type: 'ENTITY',
          subtype: 'REGION',
          action: 'CREATE',
          userId: 'user-1',
          userFirstName: 'John',
          userLastName: 'Doe',
          userEmail: 'john@test.com',
          userRole: 'NATIONAL',
          entityType: 'Region',
          entityId: 'region-1',
          entityName: 'Dakar',
          details: { before: null, after: { name: 'Dakar' } },
          metadata: { summary: 'Test' },
        },
      });
    });

    it('devrait enregistrer un événement avec des paramètres optionnels null', async () => {
      const params = {
        type: 'USER',
        action: 'UPDATE',
        user: null,
        entityType: null,
        entityId: null,
        entityName: null,
        details: null,
        metadata: null,
      };

      prisma.eventLog.create.mockResolvedValue({ id: 'log-1' });

      await logEvent(params);

      expect(prisma.eventLog.create).toHaveBeenCalledWith({
        data: {
          type: 'USER',
          subtype: null,
          action: 'UPDATE',
          userId: null,
          userFirstName: null,
          userLastName: null,
          userEmail: null,
          userRole: null,
          entityType: null,
          entityId: null,
          entityName: null,
          details: null,
          metadata: null,
        },
      });
    });

    it('devrait enregistrer un événement avec user partiel', async () => {
      const params = {
        type: 'VACCINE',
        action: 'DELETE',
        user: {
          id: 'user-1',
          firstName: 'Jane',
        },
      };

      prisma.eventLog.create.mockResolvedValue({ id: 'log-1' });

      await logEvent(params);

      expect(prisma.eventLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'VACCINE',
          action: 'DELETE',
          userId: 'user-1',
          userFirstName: 'Jane',
          userLastName: null,
          userEmail: null,
          userRole: null,
        }),
      });
    });

    it('devrait gérer les erreurs silencieusement', async () => {
      const params = {
        type: 'ENTITY',
        action: 'CREATE',
      };

      const error = new Error('Erreur base de données');
      prisma.eventLog.create.mockRejectedValue(error);

      await logEvent(params);

      expect(console.error).toHaveBeenCalledWith(
        'Erreur enregistrement événement dans le journal:',
        error,
      );
    });

    it('devrait sérialiser details et metadata en JSON', async () => {
      const params = {
        type: 'ENTITY',
        action: 'UPDATE',
        details: { complex: { nested: { data: [1, 2, 3] } } },
        metadata: { array: [1, 2, 3] },
      };

      prisma.eventLog.create.mockResolvedValue({ id: 'log-1' });

      await logEvent(params);

      expect(prisma.eventLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: { complex: { nested: { data: [1, 2, 3] } } },
          metadata: { array: [1, 2, 3] },
        }),
      });
    });
  });

  describe('logEventAsync', () => {
    it('devrait enregistrer un événement en arrière-plan', async () => {
      const params = {
        type: 'ENTITY',
        action: 'CREATE',
        user: {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      prisma.eventLog.create.mockResolvedValue({ id: 'log-1' });

      logEventAsync(params);

      // Attendre que setImmediate soit exécuté
      await new Promise((resolve) => setImmediate(resolve));

      expect(prisma.eventLog.create).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs silencieusement en arrière-plan', async () => {
      const params = {
        type: 'ENTITY',
        action: 'CREATE',
      };

      const error = new Error('Erreur base de données');
      prisma.eventLog.create.mockRejectedValue(error);

      logEventAsync(params);

      // Attendre que setImmediate soit exécuté
      await new Promise((resolve) => setImmediate(resolve));

      // logEvent gère l'erreur dans son propre catch et ne la rejette pas,
      // donc le .catch() dans logEventAsync n'est jamais appelé
      // On vérifie donc le message de logEvent
      expect(console.error).toHaveBeenCalledWith(
        'Erreur enregistrement événement dans le journal:',
        error,
      );
    });
  });
});
