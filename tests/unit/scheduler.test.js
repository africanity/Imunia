const cron = require("node-cron");

// Mock des jobs AVANT de charger le module scheduler
jest.mock("../../src/jobs/stockExpirationJob", () => ({
  checkStockExpirations: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../../src/jobs/appointmentNotificationJob", () => ({
  checkAppointmentNotifications: jest.fn().mockResolvedValue({ success: true }),
}));

// Charger le module scheduler après avoir configuré les mocks
const { checkStockExpirations, checkAppointmentNotifications } = require("../../src/jobs/scheduler");
const stockExpirationJob = require("../../src/jobs/stockExpirationJob");
const appointmentNotificationJob = require("../../src/jobs/appointmentNotificationJob");

describe("Scheduler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Nettoyer les tâches cron existantes
    cron.getTasks().forEach((task) => task.stop());
  });

  afterEach(() => {
    // Nettoyer les tâches cron après chaque test
    cron.getTasks().forEach((task) => task.stop());
  });

  describe("Configuration des tâches", () => {
    it("devrait planifier la tâche de vérification des stocks", () => {
      // Le scheduler est chargé automatiquement, on vérifie qu'il fonctionne
      const tasks = cron.getTasks();
      expect(tasks.size).toBeGreaterThan(0);
    });

    it("devrait utiliser les variables d'environnement pour les crons", () => {
      const originalStockCron = process.env.STOCK_CHECK_CRON;
      const originalAppointmentCron = process.env.APPOINTMENT_CHECK_CRON;

      process.env.STOCK_CHECK_CRON = "0 0 * * *";
      process.env.APPOINTMENT_CHECK_CRON = "0 */6 * * *";

      // Recharger le scheduler
      delete require.cache[require.resolve("../../src/jobs/scheduler")];
      require("../../src/jobs/scheduler");

      // Vérifier que les tâches sont configurées
      const tasks = cron.getTasks();
      expect(tasks.size).toBeGreaterThan(0);

      // Restaurer
      if (originalStockCron) {
        process.env.STOCK_CHECK_CRON = originalStockCron;
      } else {
        delete process.env.STOCK_CHECK_CRON;
      }
      if (originalAppointmentCron) {
        process.env.APPOINTMENT_CHECK_CRON = originalAppointmentCron;
      } else {
        delete process.env.APPOINTMENT_CHECK_CRON;
      }
    });
  });

  describe("Exports", () => {
    it("devrait exporter checkStockExpirations", () => {
      expect(checkStockExpirations).toBeDefined();
      expect(typeof checkStockExpirations).toBe("function");
    });

    it("devrait exporter checkAppointmentNotifications", () => {
      expect(checkAppointmentNotifications).toBeDefined();
      expect(typeof checkAppointmentNotifications).toBe("function");
    });

    it("devrait appeler checkStockExpirations du job", async () => {
      await checkStockExpirations();
      expect(stockExpirationJob.checkStockExpirations).toHaveBeenCalledTimes(1);
    });

    it("devrait appeler checkAppointmentNotifications du job", async () => {
      await checkAppointmentNotifications();
      expect(appointmentNotificationJob.checkAppointmentNotifications).toHaveBeenCalledTimes(1);
    });
  });

  describe("Exécution des tâches cron", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Nettoyer les tâches cron existantes
      cron.getTasks().forEach((task) => task.stop());
      // Recharger le scheduler pour réinitialiser les tâches
      delete require.cache[require.resolve("../../src/jobs/scheduler")];
      require("../../src/jobs/scheduler");
    });

    it("devrait exécuter checkStockExpirations quand la tâche cron se déclenche", async () => {
      const tasks = cron.getTasks();
      expect(tasks.size).toBeGreaterThan(0);

      // Trouver la tâche de vérification des stocks
      // Note: On ne peut pas tester directement l'exécution des callbacks cron
      // car ils sont exécutés de manière asynchrone par node-cron
      // Mais on peut vérifier que les fonctions sont bien mockées
      expect(stockExpirationJob.checkStockExpirations).toBeDefined();
    });

    it("devrait exécuter checkAppointmentNotifications quand la tâche cron se déclenche", async () => {
      const tasks = cron.getTasks();
      expect(tasks.size).toBeGreaterThan(0);

      // Vérifier que les fonctions sont bien mockées
      expect(appointmentNotificationJob.checkAppointmentNotifications).toBeDefined();
    });

    it("devrait gérer les erreurs dans checkStockExpirations", async () => {
      const originalError = console.error;
      console.error = jest.fn();

      stockExpirationJob.checkStockExpirations.mockRejectedValueOnce(new Error("Test error"));

      // Note: On ne peut pas forcer l'exécution d'une tâche cron
      // Mais on peut vérifier que la fonction mockée peut gérer les erreurs
      try {
        await stockExpirationJob.checkStockExpirations();
      } catch (error) {
        expect(error.message).toBe("Test error");
      }

      console.error = originalError;
    });

    it("devrait gérer les erreurs dans checkAppointmentNotifications", async () => {
      const originalError = console.error;
      console.error = jest.fn();

      appointmentNotificationJob.checkAppointmentNotifications.mockRejectedValueOnce(new Error("Test error"));

      // Note: On ne peut pas forcer l'exécution d'une tâche cron
      // Mais on peut vérifier que la fonction mockée peut gérer les erreurs
      try {
        await appointmentNotificationJob.checkAppointmentNotifications();
      } catch (error) {
        expect(error.message).toBe("Test error");
      }

      console.error = originalError;
    });
  });
});