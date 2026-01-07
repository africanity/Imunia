// tests/unit/notificationService.test.js
const prisma = require("../../src/config/prismaClient");
const { sendNotificationToChild, sendNotificationToParent } = require("../../src/socket");

jest.mock("../../src/config/prismaClient", () => ({
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  userNotification: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  children: {
    findUnique: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
}));

jest.mock("../../src/socket", () => ({
  sendNotificationToChild: jest.fn(),
  sendNotificationToParent: jest.fn(),
}));

const {
  getHealthCenterAgentIds,
  notifyHealthCenterAgents,
  createNotification,
  createNotificationsForUsers,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  deleteAllReadNotifications,
  createAndSendNotification,
  notifyVaccineScheduled,
  notifyVaccineMissed,
  notifyVaccineLate,
  notifyAppointmentUpdated,
  notifyAppointmentCancelled,
  notifyNewAdvice,
  notifyNewCampaign,
  notifyAppointment,
  notifyAccountActivated,
} = require("../../src/services/notificationService");

describe("notificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getHealthCenterAgentIds", () => {
    it("devrait retourner les IDs des agents actifs d'un centre", async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: "agent-1" },
        { id: "agent-2" },
      ]);

      const result = await getHealthCenterAgentIds("center-123");

      expect(result).toEqual(["agent-1", "agent-2"]);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: "AGENT",
          healthCenterId: "center-123",
          isActive: true,
        },
        select: {
          id: true,
        },
      });
    });

    it("devrait retourner un tableau vide si healthCenterId est null", async () => {
      const result = await getHealthCenterAgentIds(null);
      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it("devrait retourner un tableau vide en cas d'erreur", async () => {
      prisma.user.findMany.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await getHealthCenterAgentIds("center-123");

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("notifyHealthCenterAgents", () => {
    it("devrait notifier tous les agents d'un centre", async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: "agent-1" },
        { id: "agent-2" },
      ]);
      prisma.userNotification.createMany.mockResolvedValue({ count: 2 });

      const result = await notifyHealthCenterAgents({
        healthCenterId: "center-123",
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
      });

      expect(result).toBeDefined();
      expect(prisma.user.findMany).toHaveBeenCalled();
    });

    it("devrait exclure l'utilisateur spécifié", async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: "agent-1" },
        { id: "agent-2" },
      ]);
      prisma.userNotification.createMany.mockResolvedValue({ count: 1 });

      await notifyHealthCenterAgents({
        healthCenterId: "center-123",
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
        excludeUserId: "agent-1",
      });

      expect(prisma.userNotification.createMany).toHaveBeenCalled();
    });

    it("devrait retourner un tableau vide si aucun agent", async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await notifyHealthCenterAgents({
        healthCenterId: "center-123",
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
      });

      expect(result).toEqual([]);
    });

    it("devrait gérer les erreurs", async () => {
      prisma.user.findMany.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await notifyHealthCenterAgents({
        healthCenterId: "center-123",
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
      });

      expect(result).toEqual([]);
      consoleErrorSpy.mockRestore();
    });
  });

  describe("createNotification", () => {
    it("devrait créer une notification", async () => {
      const mockNotification = {
        id: "notif-1",
        userId: "user-1",
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
        read: false,
      };

      prisma.userNotification.create.mockResolvedValue(mockNotification);

      const result = await createNotification({
        userId: "user-1",
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
      });

      expect(result).toEqual(mockNotification);
      expect(prisma.userNotification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          title: "Test Title",
          message: "Test Message",
          type: "TEST",
          read: false,
        },
      });
    });

    it("devrait retourner null en cas d'erreur", async () => {
      prisma.userNotification.create.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await createNotification({
        userId: "user-1",
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
      });

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("createNotificationsForUsers", () => {
    it("devrait créer des notifications pour plusieurs utilisateurs", async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: "user-1" },
        { id: "user-2" },
      ]);
      prisma.userNotification.createMany.mockResolvedValue({ count: 2 });

      const result = await createNotificationsForUsers({
        userIds: ["user-1", "user-2"],
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
      });

      expect(result).toBeDefined();
      expect(prisma.userNotification.createMany).toHaveBeenCalled();
    });

    it("devrait retourner un tableau vide si userIds est vide", async () => {
      const result = await createNotificationsForUsers({
        userIds: [],
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
      });

      expect(result).toEqual([]);
      expect(prisma.userNotification.createMany).not.toHaveBeenCalled();
    });

    it("devrait filtrer les userIds invalides", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "user-1" }]);
      prisma.userNotification.createMany.mockResolvedValue({ count: 1 });

      await createNotificationsForUsers({
        userIds: ["user-1", "user-invalid"],
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
      });

      expect(prisma.userNotification.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: "user-1",
            title: "Test Title",
            message: "Test Message",
            type: "TEST",
            read: false,
          },
        ],
      });
    });

    it("devrait gérer les erreurs", async () => {
      prisma.user.findMany.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await createNotificationsForUsers({
        userIds: ["user-1"],
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
      });

      expect(result).toEqual([]);
      consoleErrorSpy.mockRestore();
    });
  });

  describe("getUserNotifications", () => {
    it("devrait récupérer les notifications d'un utilisateur", async () => {
      const mockNotifications = [
        { id: "notif-1", userId: "user-1", read: false },
        { id: "notif-2", userId: "user-1", read: true },
      ];

      prisma.userNotification.findMany.mockResolvedValue(mockNotifications);

      const result = await getUserNotifications("user-1");

      expect(result).toEqual(mockNotifications);
      expect(prisma.userNotification.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
    });

    it("devrait filtrer les notifications non lues si unreadOnly est true", async () => {
      prisma.userNotification.findMany.mockResolvedValue([]);

      await getUserNotifications("user-1", { unreadOnly: true });

      expect(prisma.userNotification.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", read: false },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
    });

    it("devrait respecter la limite", async () => {
      prisma.userNotification.findMany.mockResolvedValue([]);

      await getUserNotifications("user-1", { limit: 10 });

      expect(prisma.userNotification.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    });

    it("devrait gérer les erreurs", async () => {
      prisma.userNotification.findMany.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await getUserNotifications("user-1");

      expect(result).toEqual([]);
      consoleErrorSpy.mockRestore();
    });
  });

  describe("getUnreadCount", () => {
    it("devrait compter les notifications non lues", async () => {
      prisma.userNotification.count.mockResolvedValue(5);

      const result = await getUnreadCount("user-1");

      expect(result).toBe(5);
      expect(prisma.userNotification.count).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          read: false,
        },
      });
    });

    it("devrait retourner 0 en cas d'erreur", async () => {
      prisma.userNotification.count.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await getUnreadCount("user-1");

      expect(result).toBe(0);
      consoleErrorSpy.mockRestore();
    });
  });

  describe("markAsRead", () => {
    it("devrait marquer une notification comme lue", async () => {
      prisma.userNotification.updateMany.mockResolvedValue({ count: 1 });

      const result = await markAsRead("notif-1", "user-1");

      expect(result).toBeDefined();
      expect(prisma.userNotification.updateMany).toHaveBeenCalledWith({
        where: {
          id: "notif-1",
          userId: "user-1",
        },
        data: {
          read: true,
        },
      });
    });

    it("devrait lancer une erreur en cas d'échec", async () => {
      prisma.userNotification.updateMany.mockRejectedValue(new Error("DB Error"));

      await expect(markAsRead("notif-1", "user-1")).rejects.toThrow("DB Error");
    });
  });

  describe("markAllAsRead", () => {
    it("devrait marquer toutes les notifications comme lues", async () => {
      prisma.userNotification.updateMany.mockResolvedValue({ count: 5 });

      const result = await markAllAsRead("user-1");

      expect(result).toBeDefined();
      expect(prisma.userNotification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          read: false,
        },
        data: {
          read: true,
        },
      });
    });

    it("devrait lancer une erreur en cas d'échec", async () => {
      prisma.userNotification.updateMany.mockRejectedValue(new Error("DB Error"));

      await expect(markAllAsRead("user-1")).rejects.toThrow("DB Error");
    });
  });

  describe("deleteNotification", () => {
    it("devrait supprimer une notification", async () => {
      prisma.userNotification.deleteMany.mockResolvedValue({ count: 1 });

      const result = await deleteNotification("notif-1", "user-1");

      expect(result).toBeDefined();
      expect(prisma.userNotification.deleteMany).toHaveBeenCalledWith({
        where: {
          id: "notif-1",
          userId: "user-1",
        },
      });
    });

    it("devrait lancer une erreur en cas d'échec", async () => {
      prisma.userNotification.deleteMany.mockRejectedValue(new Error("DB Error"));

      await expect(deleteNotification("notif-1", "user-1")).rejects.toThrow("DB Error");
    });
  });

  describe("deleteAllNotifications", () => {
    it("devrait supprimer toutes les notifications", async () => {
      prisma.userNotification.deleteMany.mockResolvedValue({ count: 10 });

      const result = await deleteAllNotifications("user-1");

      expect(result).toBeDefined();
      expect(prisma.userNotification.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
        },
      });
    });

    it("devrait lancer une erreur en cas d'échec", async () => {
      prisma.userNotification.deleteMany.mockRejectedValue(new Error("DB Error"));

      await expect(deleteAllNotifications("user-1")).rejects.toThrow("DB Error");
    });
  });

  describe("deleteAllReadNotifications", () => {
    it("devrait supprimer toutes les notifications lues", async () => {
      prisma.userNotification.deleteMany.mockResolvedValue({ count: 5 });

      const result = await deleteAllReadNotifications("user-1");

      expect(result).toBeDefined();
      expect(prisma.userNotification.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          read: true,
        },
      });
    });

    it("devrait lancer une erreur en cas d'échec", async () => {
      prisma.userNotification.deleteMany.mockRejectedValue(new Error("DB Error"));

      await expect(deleteAllReadNotifications("user-1")).rejects.toThrow("DB Error");
    });
  });

  describe("createAndSendNotification", () => {
    it("devrait créer et envoyer une notification", async () => {
      const mockChild = {
        id: "child-1",
        firstName: "John",
        lastName: "Doe",
        phoneParent: "+1234567890",
      };

      const mockNotification = {
        id: "notif-1",
        childId: "child-1",
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await createAndSendNotification({
        childId: "child-1",
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
      });

      expect(result).toEqual(mockNotification);
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(sendNotificationToChild).toHaveBeenCalled();
      expect(sendNotificationToParent).toHaveBeenCalled();
    });

    it("ne devrait pas envoyer via socket si sendSocket est false", async () => {
      const mockChild = {
        id: "child-1",
        firstName: "John",
        lastName: "Doe",
        phoneParent: "+1234567890",
      };

      const mockNotification = {
        id: "notif-1",
        childId: "child-1",
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.notification.create.mockResolvedValue(mockNotification);

      await createAndSendNotification({
        childId: "child-1",
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
        sendSocket: false,
      });

      expect(sendNotificationToChild).not.toHaveBeenCalled();
      expect(sendNotificationToParent).not.toHaveBeenCalled();
    });

    it("devrait retourner null si l'enfant n'existe pas", async () => {
      prisma.children.findUnique.mockResolvedValue(null);
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await createAndSendNotification({
        childId: "child-1",
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
      });

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });

    it("devrait gérer les erreurs", async () => {
      prisma.children.findUnique.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await createAndSendNotification({
        childId: "child-1",
        title: "Test Title",
        message: "Test Message",
        type: "TEST",
      });

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("notifyVaccineScheduled", () => {
    it("devrait notifier un rendez-vous programmé", async () => {
      const mockChild = {
        id: "child-1",
        firstName: "John",
        lastName: "Doe",
        phoneParent: "+1234567890",
      };

      const mockNotification = {
        id: "notif-1",
        childId: "child-1",
        title: "Nouveau rendez-vous de vaccination",
        message: "Test",
        type: "appointment",
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await notifyVaccineScheduled({
        childId: "child-1",
        vaccineName: "Test Vaccine",
        scheduledDate: new Date(),
      });

      expect(result).toBeDefined();
      expect(prisma.notification.create).toHaveBeenCalled();
    });

    it("devrait gérer les erreurs", async () => {
      prisma.children.findUnique.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await notifyVaccineScheduled({
        childId: "child-1",
        vaccineName: "Test Vaccine",
        scheduledDate: new Date(),
      });

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("notifyVaccineMissed", () => {
    it("devrait notifier un vaccin raté", async () => {
      const mockChild = {
        id: "child-1",
        firstName: "John",
        lastName: "Doe",
        phoneParent: "+1234567890",
      };

      const mockNotification = {
        id: "notif-1",
        childId: "child-1",
        title: "Vaccin raté",
        message: "Test",
        type: "vaccination",
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await notifyVaccineMissed({
        childId: "child-1",
        vaccineName: "Test Vaccine",
        dueDate: new Date(),
      });

      expect(result).toBeDefined();
    });

    it("devrait gérer les erreurs", async () => {
      prisma.children.findUnique.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await notifyVaccineMissed({
        childId: "child-1",
        vaccineName: "Test Vaccine",
        dueDate: new Date(),
      });

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("notifyVaccineLate", () => {
    it("devrait notifier un vaccin en retard", async () => {
      const mockChild = {
        id: "child-1",
        firstName: "John",
        lastName: "Doe",
        phoneParent: "+1234567890",
      };

      const mockNotification = {
        id: "notif-1",
        childId: "child-1",
        title: "Vaccin en retard",
        message: "Test",
        type: "vaccination",
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await notifyVaccineLate({
        childId: "child-1",
        vaccineName: "Test Vaccine",
        dueDate: new Date(),
      });

      expect(result).toBeDefined();
    });

    it("devrait gérer les erreurs", async () => {
      prisma.children.findUnique.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await notifyVaccineLate({
        childId: "child-1",
        vaccineName: "Test Vaccine",
        dueDate: new Date(),
      });

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("notifyAppointmentUpdated", () => {
    it("devrait notifier des rendez-vous modifiés", async () => {
      const mockChild = {
        id: "child-1",
        firstName: "John",
        lastName: "Doe",
        phoneParent: "+1234567890",
      };

      const mockNotification = {
        id: "notif-1",
        childId: "child-1",
        title: "Rendez-vous modifié",
        message: "Test",
        type: "appointment",
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await notifyAppointmentUpdated({
        childId: "child-1",
        updates: [
          { title: "Update 1", message: "Message 1" },
          { title: "Update 2", message: "Message 2" },
        ],
      });

      expect(result).toBeDefined();
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });

    it("devrait retourner null si childId est manquant", async () => {
      const result = await notifyAppointmentUpdated({
        childId: null,
        updates: [{ title: "Update 1", message: "Message 1" }],
      });

      expect(result).toBeNull();
    });

    it("devrait retourner null si updates est vide", async () => {
      const result = await notifyAppointmentUpdated({
        childId: "child-1",
        updates: [],
      });

      expect(result).toBeNull();
    });

    it("devrait gérer les erreurs", async () => {
      prisma.children.findUnique.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await notifyAppointmentUpdated({
        childId: "child-1",
        updates: [{ title: "Update 1", message: "Message 1" }],
      });

      // Promise.all retourne un tableau même si tous les éléments sont null
      expect(result).toEqual([null]);
      consoleErrorSpy.mockRestore();
    });
  });

  describe("notifyAppointmentCancelled", () => {
    it("devrait notifier un rendez-vous annulé", async () => {
      const mockChild = {
        id: "child-1",
        firstName: "John",
        lastName: "Doe",
        phoneParent: "+1234567890",
      };

      const mockNotification = {
        id: "notif-1",
        childId: "child-1",
        title: "Rendez-vous annulé",
        message: "Test",
        type: "appointment",
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await notifyAppointmentCancelled({
        childId: "child-1",
        vaccineName: "Test Vaccine",
        scheduledDate: new Date(),
      });

      expect(result).toBeDefined();
    });

    it("devrait gérer les erreurs", async () => {
      prisma.children.findUnique.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await notifyAppointmentCancelled({
        childId: "child-1",
        vaccineName: "Test Vaccine",
        scheduledDate: new Date(),
      });

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("notifyNewAdvice", () => {
    it("devrait notifier un nouveau conseil", async () => {
      const mockChild = {
        id: "child-1",
        firstName: "John",
        lastName: "Doe",
        phoneParent: "+1234567890",
      };

      const mockNotification = {
        id: "notif-1",
        childId: "child-1",
        title: "Nouveau conseil disponible",
        message: "Test",
        type: "advice",
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await notifyNewAdvice({
        childId: "child-1",
        adviceTitle: "Test Advice",
      });

      expect(result).toBeDefined();
    });

    it("devrait gérer les erreurs", async () => {
      prisma.children.findUnique.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await notifyNewAdvice({
        childId: "child-1",
        adviceTitle: "Test Advice",
      });

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("notifyNewCampaign", () => {
    it("devrait notifier une nouvelle campagne", async () => {
      const mockChild = {
        id: "child-1",
        firstName: "John",
        lastName: "Doe",
        phoneParent: "+1234567890",
      };

      const mockNotification = {
        id: "notif-1",
        childId: "child-1",
        title: "Nouvelle campagne de vaccination",
        message: "Test",
        type: "campaign",
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await notifyNewCampaign({
        childId: "child-1",
        campaignTitle: "Test Campaign",
      });

      expect(result).toBeDefined();
    });

    it("devrait gérer les erreurs", async () => {
      prisma.children.findUnique.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await notifyNewCampaign({
        childId: "child-1",
        campaignTitle: "Test Campaign",
      });

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("notifyAppointment", () => {
    it("devrait notifier un rendez-vous", async () => {
      const mockChild = {
        id: "child-1",
        firstName: "John",
        lastName: "Doe",
        phoneParent: "+1234567890",
      };

      const mockNotification = {
        id: "notif-1",
        childId: "child-1",
        title: "Rendez-vous de vaccination",
        message: "Test",
        type: "appointment",
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await notifyAppointment({
        childId: "child-1",
        vaccineName: "Test Vaccine",
        appointmentDate: new Date(),
      });

      expect(result).toBeDefined();
    });

    it("devrait gérer les erreurs", async () => {
      prisma.children.findUnique.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await notifyAppointment({
        childId: "child-1",
        vaccineName: "Test Vaccine",
        appointmentDate: new Date(),
      });

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("notifyAccountActivated", () => {
    it("devrait notifier l'activation d'un compte", async () => {
      const mockChild = {
        id: "child-1",
        firstName: "John",
        lastName: "Doe",
        phoneParent: "+1234567890",
      };

      const mockNotification = {
        id: "notif-1",
        childId: "child-1",
        title: "Compte activé",
        message: "Test",
        type: "account",
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await notifyAccountActivated({
        childId: "child-1",
        childName: "John Doe",
      });

      expect(result).toBeDefined();
    });

    it("devrait gérer les erreurs", async () => {
      prisma.children.findUnique.mockRejectedValue(new Error("DB Error"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await notifyAccountActivated({
        childId: "child-1",
        childName: "John Doe",
      });

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });
  });
});
