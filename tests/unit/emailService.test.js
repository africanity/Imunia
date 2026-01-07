// Mock nodemailer AVANT de charger le module
const mockTransporter = {
  sendMail: jest.fn().mockResolvedValue({
    messageId: "test-message-id",
  }),
};

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => mockTransporter),
}));

jest.mock("../../src/utils/appName", () => ({
  getAppName: jest.fn().mockResolvedValue("Imunia"),
}));

jest.mock("../../src/services/notificationService", () => ({
  createNotificationsForUsers: jest.fn().mockResolvedValue({}),
}));

const {
  sendStockExpirationAlert,
  sendAppointmentReminderEmail,
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendPasswordResetCode,
  sendTwoFactorCode,
  sendVaccineRequestEmail,
  sendStockTransferNotificationEmail,
  sendTransferRejectedEmail,
  sendTransferCancelledEmail,
  sendChildAccountActivatedEmail,
  sendChildAccountPendingEmail,
  sendNewPhotosUploadedEmail,
  sendSuperAdminEntityNotification,
  sendSuperAdminUserNotification,
  sendSuperAdminStockAdjustmentNotification,
  sendSuperAdminSettingsNotification,
} = require("../../src/services/emailService");

describe("emailService", () => {
  beforeEach(() => {
    // Réinitialiser le mock pour chaque test
    mockTransporter.sendMail.mockClear();
    mockTransporter.sendMail.mockResolvedValue({
      messageId: "test-message-id",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("sendStockExpirationAlert", () => {
    it("devrait envoyer un email d'alerte d'expiration", async () => {
      const lots = [
        {
          vaccine: { name: "Test Vaccine" },
          expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          remainingQuantity: 50,
          daysBeforeExpiration: 7,
        },
      ];

      const result = await sendStockExpirationAlert({
        email: "agent@test.com",
        agentName: "Test Agent",
        lots,
        ownerInfo: {
          type: "Centre",
          name: "Test Center",
          location: "Test Location",
        },
      });

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("agent@test.com");
      expect(callArgs.subject).toMatch(/expir/i); // "expiré" ou "expiration"
    });

    it("devrait gérer les erreurs d'envoi", async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));

      const lots = [
        {
          vaccine: { name: "Test Vaccine" },
          expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          remainingQuantity: 50,
          daysBeforeExpiration: 7,
        },
      ];

      const result = await sendStockExpirationAlert({
        email: "agent@test.com",
        agentName: "Test Agent",
        lots,
        ownerInfo: {
          type: "Centre",
          name: "Test Center",
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("sendAppointmentReminderEmail", () => {
    it("devrait envoyer un rappel de rendez-vous", async () => {
      const appointmentDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const formattedDate = appointmentDate.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const result = await sendAppointmentReminderEmail({
        email: "parent@test.com",
        childName: "Child Test",
        vaccineName: "Test Vaccine",
        appointmentDate: formattedDate,
        healthCenterName: "Test Health Center",
        notificationType: "2_DAYS",
      });

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("parent@test.com");
      expect(callArgs.subject).toMatch(/rendez-vous/i); // "Rendez-vous" ou "rendez-vous"
    });
  });

  describe("sendInvitationEmail", () => {
    it("devrait envoyer un email d'invitation pour AGENT", async () => {
      await sendInvitationEmail({
        email: "agent@test.com",
        token: "test-token",
        role: "AGENT",
        healthCenter: "Test Center",
        user: { id: "user-123" },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("agent@test.com");
      expect(callArgs.subject).toMatch(/invitation/i);
      expect(callArgs.html).toContain("Agent de santé");
    });

    it("devrait envoyer un email d'invitation pour REGIONAL", async () => {
      await sendInvitationEmail({
        email: "regional@test.com",
        token: "test-token",
        role: "REGIONAL",
        region: "Test Region",
        user: { id: "user-123" },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Administrateur régional");
    });

    it("devrait envoyer un email d'invitation pour DISTRICT", async () => {
      await sendInvitationEmail({
        email: "district@test.com",
        token: "test-token",
        role: "DISTRICT",
        district: "Test District",
        user: { id: "user-123" },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Administrateur de district");
    });

    it("devrait envoyer un email d'invitation pour NATIONAL", async () => {
      await sendInvitationEmail({
        email: "national@test.com",
        token: "test-token",
        role: "NATIONAL",
        user: { id: "user-123" },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Administrateur national");
    });

    it("devrait gérer les erreurs d'envoi", async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      await sendInvitationEmail({
        email: "test@test.com",
        token: "test-token",
        role: "AGENT",
        user: { id: "user-123" },
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("devrait envoyer un email de réinitialisation de mot de passe", async () => {
      await sendPasswordResetEmail({
        email: "user@test.com",
        resetLink: "https://example.com/reset?token=abc123",
      });

      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("user@test.com");
      expect(callArgs.subject).toMatch(/réinitialisation/i);
      expect(callArgs.html).toContain("Réinitialiser mon mot de passe");
    });

    it("devrait gérer les erreurs d'envoi", async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      await sendPasswordResetEmail({
        email: "user@test.com",
        resetLink: "https://example.com/reset?token=abc123",
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("sendPasswordResetCode", () => {
    it("devrait envoyer un code de réinitialisation", async () => {
      await sendPasswordResetCode({
        email: "user@test.com",
        code: "123456",
        firstName: "John",
      });

      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("user@test.com");
      expect(callArgs.subject).toMatch(/code/i);
      expect(callArgs.html).toContain("123456");
    });

    it("devrait gérer les erreurs d'envoi", async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));

      await expect(
        sendPasswordResetCode({
          email: "user@test.com",
          code: "123456",
          firstName: "John",
        })
      ).rejects.toThrow("SMTP Error");
    });
  });

  describe("sendTwoFactorCode", () => {
    it("devrait envoyer un code 2FA", async () => {
      await sendTwoFactorCode({
        email: "user@test.com",
        code: "654321",
      });

      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("user@test.com");
      expect(callArgs.subject).toMatch(/vérification/i);
      expect(callArgs.html).toContain("654321");
    });

    it("devrait gérer les erreurs d'envoi", async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      await sendTwoFactorCode({
        email: "user@test.com",
        code: "654321",
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });


  describe("sendVaccineRequestEmail", () => {
    it("devrait envoyer un email de demande de vaccin", async () => {
      const result = await sendVaccineRequestEmail({
        agentEmail: "agent@test.com",
        agentName: "Agent Test",
        childName: "Child Test",
        vaccineName: "Test Vaccine",
        dose: "1",
        healthCenter: "Test Center",
      });

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("agent@test.com");
      expect(callArgs.subject).toContain("Nouvelle demande de vaccination");
    });

    it("devrait gérer les erreurs d'envoi", async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Error"));

      const result = await sendVaccineRequestEmail({
        agentEmail: "agent@test.com",
        agentName: "Agent Test",
        childName: "Child Test",
        vaccineName: "Test Vaccine",
        dose: "1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("sendStockTransferNotificationEmail", () => {
    it("devrait envoyer des emails de notification de transfert", async () => {
      const { createNotificationsForUsers } = require("../../src/services/notificationService");

      const results = await sendStockTransferNotificationEmail({
        emails: ["user1@test.com", "user2@test.com"],
        userIds: ["user-1", "user-2"],
        vaccineName: "Test Vaccine",
        quantity: 100,
        regionName: "Test Region",
      });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
      expect(createNotificationsForUsers).toHaveBeenCalled();
    });

    it("devrait gérer les erreurs d'envoi pour certains emails", async () => {
      mockTransporter.sendMail
        .mockResolvedValueOnce({ messageId: "msg-1" })
        .mockRejectedValueOnce(new Error("SMTP Error"));

      const results = await sendStockTransferNotificationEmail({
        emails: ["user1@test.com", "user2@test.com"],
        vaccineName: "Test Vaccine",
        quantity: 100,
      });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe("sendTransferRejectedEmail", () => {
    it("devrait envoyer des emails de transfert refusé", async () => {
      const { createNotificationsForUsers } = require("../../src/services/notificationService");

      const results = await sendTransferRejectedEmail({
        emails: ["user@test.com"],
        userIds: ["user-1"],
        vaccineName: "Test Vaccine",
        quantity: 50,
        fromName: "Sender",
        toName: "Receiver",
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toMatch(/refusé/i);
      expect(createNotificationsForUsers).toHaveBeenCalled();
    });
  });

  describe("sendTransferCancelledEmail", () => {
    it("devrait envoyer des emails de transfert annulé", async () => {
      const { createNotificationsForUsers } = require("../../src/services/notificationService");

      const results = await sendTransferCancelledEmail({
        emails: ["user@test.com"],
        userIds: ["user-1"],
        vaccineName: "Test Vaccine",
        quantity: 50,
        fromName: "Sender",
        toName: "Receiver",
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toMatch(/annulé/i);
      expect(createNotificationsForUsers).toHaveBeenCalled();
    });
  });

  describe("sendChildAccountActivatedEmail", () => {
    it("devrait envoyer des emails de compte activé", async () => {
      const results = await sendChildAccountActivatedEmail({
        agentEmails: ["agent1@test.com", "agent2@test.com"],
        childName: "Child Test",
        parentName: "Parent Test",
        healthCenterName: "Test Center",
      });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });
  });

  describe("sendChildAccountPendingEmail", () => {
    it("devrait envoyer des emails de compte en attente", async () => {
      const results = await sendChildAccountPendingEmail({
        agentEmails: ["agent@test.com"],
        childName: "Child Test",
        parentName: "Parent Test",
        healthCenterName: "Test Center",
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toMatch(/attente/i);
    });
  });

  describe("sendNewPhotosUploadedEmail", () => {
    it("devrait envoyer des emails de nouvelles photos", async () => {
      const results = await sendNewPhotosUploadedEmail({
        agentEmails: ["agent@test.com"],
        childName: "Child Test",
        parentName: "Parent Test",
        healthCenterName: "Test Center",
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toMatch(/photos/i);
    });
  });

  describe("sendSuperAdminEntityNotification", () => {
    it("devrait envoyer des notifications d'entité créée", async () => {
      const { createNotificationsForUsers } = require("../../src/services/notificationService");

      const results = await sendSuperAdminEntityNotification({
        emails: ["user@test.com"],
        userIds: ["user-1"],
        action: "created",
        entityType: "region",
        entityName: "Test Region",
        details: "Test details",
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      expect(createNotificationsForUsers).toHaveBeenCalled();
    });

    it("devrait envoyer des notifications d'entité modifiée", async () => {
      const results = await sendSuperAdminEntityNotification({
        emails: ["user@test.com"],
        action: "updated",
        entityType: "district",
        entityName: "Test District",
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it("devrait envoyer des notifications d'entité supprimée", async () => {
      const results = await sendSuperAdminEntityNotification({
        emails: ["user@test.com"],
        action: "deleted",
        entityType: "healthcenter",
        entityName: "Test Center",
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });
  });

  describe("sendSuperAdminUserNotification", () => {
    it("devrait envoyer des notifications d'utilisateur", async () => {
      const { createNotificationsForUsers } = require("../../src/services/notificationService");

      const results = await sendSuperAdminUserNotification({
        emails: ["user@test.com"],
        userIds: ["user-1"],
        action: "created",
        userName: "Test User",
        role: "AGENT",
        details: "Test details",
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(createNotificationsForUsers).toHaveBeenCalled();
    });
  });

  describe("sendSuperAdminStockAdjustmentNotification", () => {
    it("devrait envoyer des notifications d'ajustement de stock (ajout)", async () => {
      const { createNotificationsForUsers } = require("../../src/services/notificationService");

      const results = await sendSuperAdminStockAdjustmentNotification({
        emails: ["user@test.com"],
        userIds: ["user-1"],
        entityType: "Région",
        entityName: "Test Region",
        vaccineName: "Test Vaccine",
        quantity: 100,
        adjustmentType: "add",
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(createNotificationsForUsers).toHaveBeenCalled();
    });

    it("devrait envoyer des notifications d'ajustement de stock (retrait)", async () => {
      const results = await sendSuperAdminStockAdjustmentNotification({
        emails: ["user@test.com"],
        entityType: "District",
        entityName: "Test District",
        vaccineName: "Test Vaccine",
        quantity: -50,
        adjustmentType: "remove",
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });
  });

  describe("sendSuperAdminSettingsNotification", () => {
    it("devrait envoyer des notifications de modification de paramètres (logo)", async () => {
      const results = await sendSuperAdminSettingsNotification({
        emails: ["user@test.com"],
        userIds: ["user-1"],
        settingType: "logo",
        details: "Nouveau logo uploadé",
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it("devrait envoyer des notifications de modification de paramètres (nom)", async () => {
      const results = await sendSuperAdminSettingsNotification({
        emails: ["user@test.com"],
        settingType: "name",
        details: "Nouveau nom: Imunia Pro",
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });
  });
});