// tests/unit/appointmentNotificationJob.test.js

jest.mock("../../src/services/appointmentNotificationService");
jest.mock("../../src/services/emailService");
jest.mock("../../src/services/notificationService");

const { checkAppointmentNotifications } = require("../../src/jobs/appointmentNotificationJob");
const appointmentNotificationService = require("../../src/services/appointmentNotificationService");

describe("appointmentNotificationJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.log pour éviter les logs dans les tests
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("checkAppointmentNotifications", () => {
    it("devrait retourner un succès avec 0 notifications si aucun rendez-vous à notifier", async () => {
      appointmentNotificationService.findAllValidAppointments.mockResolvedValue([]);
      appointmentNotificationService.findAppointmentsToNotify.mockResolvedValue([]);

      const result = await checkAppointmentNotifications();

      expect(result).toEqual({
        success: true,
        notificationsSent: 0,
        skipped: 0,
        errors: 0,
      });
      expect(appointmentNotificationService.findAllValidAppointments).toHaveBeenCalled();
      expect(appointmentNotificationService.findAppointmentsToNotify).toHaveBeenCalled();
    });

    it("devrait envoyer des notifications avec succès", async () => {
      const mockAppointments = [
        {
          id: "appt-1",
          child: {
            firstName: "John",
            lastName: "Doe",
          },
          appointmentDate: new Date("2024-12-20"),
          notificationType: "REMINDER",
        },
        {
          id: "appt-2",
          child: {
            firstName: "Jane",
            lastName: "Smith",
          },
          appointmentDate: new Date("2024-12-21"),
          notificationType: "REMINDER",
        },
      ];

      appointmentNotificationService.findAllValidAppointments.mockResolvedValue(mockAppointments);
      appointmentNotificationService.findAppointmentsToNotify.mockResolvedValue(mockAppointments);
      appointmentNotificationService.sendAppointmentNotification.mockResolvedValue({
        success: true,
        sentVia: "email",
      });

      const result = await checkAppointmentNotifications();

      expect(result).toEqual({
        success: true,
        notificationsSent: 2,
        skipped: 0,
        errors: 0,
      });
      expect(appointmentNotificationService.sendAppointmentNotification).toHaveBeenCalledTimes(2);
    });

    it("devrait ignorer les notifications sans contact", async () => {
      const mockAppointments = [
        {
          id: "appt-1",
          child: {
            firstName: "John",
            lastName: "Doe",
          },
          appointmentDate: new Date("2024-12-20"),
          notificationType: "REMINDER",
        },
      ];

      appointmentNotificationService.findAllValidAppointments.mockResolvedValue(mockAppointments);
      appointmentNotificationService.findAppointmentsToNotify.mockResolvedValue(mockAppointments);
      appointmentNotificationService.sendAppointmentNotification.mockResolvedValue({
        success: false,
        reason: "no_contact",
      });

      const result = await checkAppointmentNotifications();

      expect(result).toEqual({
        success: true,
        notificationsSent: 0,
        skipped: 1,
        errors: 0,
      });
    });

    it("devrait ignorer les notifications déjà envoyées", async () => {
      const mockAppointments = [
        {
          id: "appt-1",
          child: {
            firstName: "John",
            lastName: "Doe",
          },
          appointmentDate: new Date("2024-12-20"),
          notificationType: "REMINDER",
        },
      ];

      appointmentNotificationService.findAllValidAppointments.mockResolvedValue(mockAppointments);
      appointmentNotificationService.findAppointmentsToNotify.mockResolvedValue(mockAppointments);
      appointmentNotificationService.sendAppointmentNotification.mockResolvedValue({
        success: false,
        reason: "already_sent",
      });

      const result = await checkAppointmentNotifications();

      expect(result).toEqual({
        success: true,
        notificationsSent: 0,
        skipped: 1,
        errors: 0,
      });
    });

    it("devrait compter les erreurs lors de l'envoi de notifications", async () => {
      const mockAppointments = [
        {
          id: "appt-1",
          child: {
            firstName: "John",
            lastName: "Doe",
          },
          appointmentDate: new Date("2024-12-20"),
          notificationType: "REMINDER",
        },
      ];

      appointmentNotificationService.findAllValidAppointments.mockResolvedValue(mockAppointments);
      appointmentNotificationService.findAppointmentsToNotify.mockResolvedValue(mockAppointments);
      appointmentNotificationService.sendAppointmentNotification.mockResolvedValue({
        success: false,
        reason: "error",
        error: "Erreur d'envoi",
      });

      const result = await checkAppointmentNotifications();

      expect(result).toEqual({
        success: true,
        notificationsSent: 0,
        skipped: 0,
        errors: 1,
      });
    });

    it("devrait gérer les exceptions lors de l'envoi de notifications", async () => {
      const mockAppointments = [
        {
          id: "appt-1",
          child: {
            firstName: "John",
            lastName: "Doe",
          },
          appointmentDate: new Date("2024-12-20"),
          notificationType: "REMINDER",
        },
      ];

      appointmentNotificationService.findAllValidAppointments.mockResolvedValue(mockAppointments);
      appointmentNotificationService.findAppointmentsToNotify.mockResolvedValue(mockAppointments);
      appointmentNotificationService.sendAppointmentNotification.mockRejectedValue(
        new Error("Erreur réseau")
      );

      const result = await checkAppointmentNotifications();

      expect(result).toEqual({
        success: true,
        notificationsSent: 0,
        skipped: 0,
        errors: 1,
      });
    });

    it("devrait gérer un mélange de succès, ignorés et erreurs", async () => {
      const mockAppointments = [
        {
          id: "appt-1",
          child: { firstName: "John", lastName: "Doe" },
          appointmentDate: new Date("2024-12-20"),
          notificationType: "REMINDER",
        },
        {
          id: "appt-2",
          child: { firstName: "Jane", lastName: "Smith" },
          appointmentDate: new Date("2024-12-21"),
          notificationType: "REMINDER",
        },
        {
          id: "appt-3",
          child: { firstName: "Bob", lastName: "Johnson" },
          appointmentDate: new Date("2024-12-22"),
          notificationType: "REMINDER",
        },
      ];

      appointmentNotificationService.findAllValidAppointments.mockResolvedValue(mockAppointments);
      appointmentNotificationService.findAppointmentsToNotify.mockResolvedValue(mockAppointments);
      appointmentNotificationService.sendAppointmentNotification
        .mockResolvedValueOnce({ success: true, sentVia: "email" })
        .mockResolvedValueOnce({ success: false, reason: "no_contact" })
        .mockResolvedValueOnce({ success: false, reason: "error", error: "Erreur" });

      const result = await checkAppointmentNotifications();

      expect(result).toEqual({
        success: true,
        notificationsSent: 1,
        skipped: 1,
        errors: 1,
      });
    });

    it("devrait gérer les erreurs lors de la récupération des rendez-vous", async () => {
      appointmentNotificationService.findAllValidAppointments.mockRejectedValue(
        new Error("Erreur base de données")
      );

      const result = await checkAppointmentNotifications();

      expect(result).toEqual({
        success: false,
        error: "Erreur base de données",
      });
    });

    it("devrait gérer les erreurs lors de la recherche des rendez-vous à notifier", async () => {
      appointmentNotificationService.findAllValidAppointments.mockResolvedValue([]);
      appointmentNotificationService.findAppointmentsToNotify.mockRejectedValue(
        new Error("Erreur recherche")
      );

      const result = await checkAppointmentNotifications();

      expect(result).toEqual({
        success: false,
        error: "Erreur recherche",
      });
    });
  });
});
