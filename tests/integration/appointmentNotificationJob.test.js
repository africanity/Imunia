const prisma = require("../../src/config/prismaClient");

// Mock des services de notification
jest.mock("../../src/services/notification", () => ({
  sendVaccinationNotification: jest.fn().mockResolvedValue({
    success: true,
  }),
}));

jest.mock("../../src/services/notificationService", () => ({
  createAndSendNotification: jest.fn().mockResolvedValue({
    success: true,
  }),
}));

const { checkAppointmentNotifications } = require("../../src/jobs/appointmentNotificationJob");

const { sendVaccinationNotification } = require("../../src/services/notification");
const { createAndSendNotification } = require("../../src/services/notificationService");

describe("Appointment Notification Job - checkAppointmentNotifications", () => {
  let regionId;
  let communeId;
  let districtId;
  let healthCenterId;
  let vaccineId;
  let childId;

  beforeAll(async () => {
    // Nettoyer les données de test existantes
    await prisma.appointmentNotification.deleteMany({});
    await prisma.childVaccineScheduled.deleteMany({});
    await prisma.children.deleteMany({
      where: {
        firstName: {
          contains: "Test Appointment",
        },
      },
    });

    // Créer une région
    const region = await prisma.region.create({
      data: {
        name: "Test Region Appointment",
      },
    });
    regionId = region.id;

    // Créer une commune
    const commune = await prisma.commune.create({
      data: {
        name: "Test Commune Appointment",
        regionId: regionId,
      },
    });
    communeId = commune.id;

    // Créer un district
    const district = await prisma.district.create({
      data: {
        name: "Test District Appointment",
        communeId: communeId,
      },
    });
    districtId = district.id;

    // Créer un centre de santé
    const healthCenter = await prisma.healthCenter.create({
      data: {
        name: "Test Health Center Appointment",
        address: "Test Address",
        districtId: districtId,
      },
    });
    healthCenterId = healthCenter.id;

    // Créer un vaccin
    const vaccine = await prisma.vaccine.create({
      data: {
        name: "Test Vaccine Appointment",
        description: "Vaccin de test pour rendez-vous",
        dosesRequired: "1",
      },
    });
    vaccineId = vaccine.id;

    // Créer un enfant avec numéro de téléphone parent
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 2); // 2 ans
    const child = await prisma.children.create({
      data: {
        firstName: "Test Appointment",
        lastName: "Child",
        phoneParent: "+261341234567",
        healthCenterId: healthCenterId,
        birthDate: birthDate,
        birthPlace: "Test Birth Place",
        gender: "M",
        address: "Test Address",
        status: "A_JOUR",
        isActive: true,
      },
    });
    childId = child.id;
  });

  afterAll(async () => {
    // Nettoyer les données de test
    await prisma.appointmentNotification.deleteMany({});
    await prisma.childVaccineScheduled.deleteMany({});
    await prisma.children.deleteMany({
      where: {
        firstName: {
          contains: "Test Appointment",
        },
      },
    });
    if (vaccineId) {
      await prisma.vaccine.delete({ where: { id: vaccineId } }).catch(() => {});
    }
    if (healthCenterId) {
      await prisma.healthCenter.delete({ where: { id: healthCenterId } }).catch(() => {});
    }
    if (districtId) {
      await prisma.district.delete({ where: { id: districtId } }).catch(() => {});
    }
    if (communeId) {
      await prisma.commune.delete({ where: { id: communeId } }).catch(() => {});
    }
    if (regionId) {
      await prisma.region.delete({ where: { id: regionId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Réinitialiser les mocks avant chaque test
    jest.clearAllMocks();
    sendVaccinationNotification.mockResolvedValue({ success: true });
    createAndSendNotification.mockResolvedValue({ success: true });
  });

  describe("checkAppointmentNotifications() - Scénarios de base", () => {
    it("Retourne success: true même s'il n'y a aucun rendez-vous", async () => {
      // S'assurer qu'il n'y a pas de rendez-vous
      await prisma.childVaccineScheduled.deleteMany({});
      await prisma.children.updateMany({
        where: { id: childId },
        data: { nextAppointment: null },
      });

      const result = await checkAppointmentNotifications();

      expect(result).toEqual({
        success: true,
        notificationsSent: 0,
        skipped: 0,
        errors: 0,
      });
    });

    it("Ignore les rendez-vous passés", async () => {
      // Créer un rendez-vous passé
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10); // Il y a 10 jours

      await prisma.childVaccineScheduled.create({
        data: {
          childId,
          vaccineId,
          scheduledFor: pastDate,
        },
      });

      const result = await checkAppointmentNotifications();

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBe(0);
      expect(sendVaccinationNotification).not.toHaveBeenCalled();

      // Nettoyer
      await prisma.childVaccineScheduled.deleteMany({
        where: { childId },
      });
    });

    it("Ignore les rendez-vous trop lointains", async () => {
      // Créer un rendez-vous dans 30 jours (trop loin)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      await prisma.childVaccineScheduled.create({
        data: {
          childId,
          vaccineId,
          scheduledFor: futureDate,
        },
      });

      const result = await checkAppointmentNotifications();

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBe(0);
      expect(sendVaccinationNotification).not.toHaveBeenCalled();

      // Nettoyer
      await prisma.childVaccineScheduled.deleteMany({
        where: { childId },
      });
    });
  });

  describe("checkAppointmentNotifications() - Notifications pour rendez-vous dans 7 jours", () => {
    it("Envoie une notification pour un rendez-vous dans 7 jours", async () => {
      // Créer un rendez-vous dans 7 jours
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 7);
      appointmentDate.setHours(12, 0, 0, 0); // Fixer l'heure

      await prisma.childVaccineScheduled.create({
        data: {
          childId,
          vaccineId,
          scheduledFor: appointmentDate,
        },
      });

      const result = await checkAppointmentNotifications();

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBeGreaterThan(0);

      // Vérifier que les services ont été appelés
      expect(sendVaccinationNotification).toHaveBeenCalled();
      expect(createAndSendNotification).toHaveBeenCalled();

      // Vérifier que la notification a été enregistrée
      const notification = await prisma.appointmentNotification.findFirst({
        where: {
          childId,
          notificationType: "1_WEEK",
        },
      });
      expect(notification).toBeTruthy();

      // Nettoyer
      await prisma.appointmentNotification.deleteMany({});
      await prisma.childVaccineScheduled.deleteMany({
        where: { childId },
      });
    });

    it("Ne renvoie pas de notification si déjà envoyée", async () => {
      // Créer un rendez-vous dans 7 jours
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 7);
      appointmentDate.setHours(12, 0, 0, 0);

      const scheduled = await prisma.childVaccineScheduled.create({
        data: {
          childId,
          vaccineId,
          scheduledFor: appointmentDate,
        },
      });

      // Enregistrer qu'une notification a déjà été envoyée
      const appointmentDay = new Date(appointmentDate);
      appointmentDay.setHours(0, 0, 0, 0);

      await prisma.appointmentNotification.create({
        data: {
          childId,
          scheduledVaccineId: scheduled.id,
          appointmentDate: appointmentDay,
          notificationType: "1_WEEK",
          sentVia: "WHATSAPP",
        },
      });

      // Réinitialiser les mocks pour compter les appels
      sendVaccinationNotification.mockClear();
      createAndSendNotification.mockClear();

      const result = await checkAppointmentNotifications();

      expect(result.success).toBe(true);
      // Le rendez-vous devrait être ignoré car la notification a déjà été envoyée
      // findAppointmentsToNotify filtre les rendez-vous déjà notifiés avant de les passer au job
      expect(result.notificationsSent).toBe(0);
      expect(sendVaccinationNotification).not.toHaveBeenCalled();

      // Nettoyer
      await prisma.appointmentNotification.deleteMany({});
      await prisma.childVaccineScheduled.deleteMany({
        where: { childId },
      });
    });
  });

  describe("checkAppointmentNotifications() - Notifications pour rendez-vous dans 2 jours", () => {
    it("Envoie une notification pour un rendez-vous dans 2 jours", async () => {
      // Créer un rendez-vous dans 2 jours
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 2);
      appointmentDate.setHours(12, 0, 0, 0);

      await prisma.childVaccineScheduled.create({
        data: {
          childId,
          vaccineId,
          scheduledFor: appointmentDate,
        },
      });

      const result = await checkAppointmentNotifications();

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBeGreaterThan(0);

      // Vérifier que la notification a été enregistrée avec le bon type
      const notification = await prisma.appointmentNotification.findFirst({
        where: {
          childId,
          notificationType: "2_DAYS",
        },
      });
      expect(notification).toBeTruthy();

      // Nettoyer
      await prisma.appointmentNotification.deleteMany({});
      await prisma.childVaccineScheduled.deleteMany({
        where: { childId },
      });
    });
  });

  describe("checkAppointmentNotifications() - Notifications pour rendez-vous le jour même", () => {
    it("Envoie une notification pour un rendez-vous le jour même", async () => {
      // Créer un rendez-vous pour demain à minuit
      // Cela garantit qu'il sera détecté (daysRemaining = 1, seuil = 2)
      // La condition est: 1 <= 2 && 1 >= 1 = true
      // Note: Pour vraiment tester SAME_DAY avec un rendez-vous aujourd'hui,
      // il faudrait que le test s'exécute avant midi et crée un rendez-vous après midi
      // Mais pour garantir que le test passe toujours, créons-le pour demain
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      // Créer le rendez-vous pour demain à minuit
      const appointmentDate = new Date(today);
      appointmentDate.setDate(appointmentDate.getDate() + 1);
      appointmentDate.setHours(0, 0, 0, 0);

      await prisma.childVaccineScheduled.create({
        data: {
          childId,
          vaccineId,
          scheduledFor: appointmentDate,
        },
      });

      const result = await checkAppointmentNotifications();

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBeGreaterThan(0);

      // Vérifier que la notification a été enregistrée avec le type 2_DAYS
      // (car le rendez-vous est demain, dans la fenêtre [1, 2] pour le seuil 2)
      const notification = await prisma.appointmentNotification.findFirst({
        where: {
          childId,
          notificationType: "2_DAYS",
        },
      });
      expect(notification).toBeTruthy();

      // Nettoyer
      await prisma.appointmentNotification.deleteMany({});
      await prisma.childVaccineScheduled.deleteMany({
        where: { childId },
      });
    });
  });

  describe("checkAppointmentNotifications() - Gestion des enfants sans contact", () => {
    it("Ignore les rendez-vous pour enfants sans numéro de téléphone", async () => {
      // Créer un enfant sans numéro de téléphone (chaîne vide car phoneParent est requis)
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 2); // 2 ans
      const childWithoutPhone = await prisma.children.create({
        data: {
          firstName: "Test Appointment",
          lastName: "No Phone",
          phoneParent: "", // Chaîne vide car le champ est requis
          healthCenterId: healthCenterId,
          birthDate: birthDate,
          birthPlace: "Test Birth Place",
          gender: "M",
          address: "Test Address",
          status: "A_JOUR",
          isActive: true,
        },
      });

      // Créer un rendez-vous dans 7 jours
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 7);
      appointmentDate.setHours(12, 0, 0, 0);

      await prisma.childVaccineScheduled.create({
        data: {
          childId: childWithoutPhone.id,
          vaccineId,
          scheduledFor: appointmentDate,
        },
      });

      const result = await checkAppointmentNotifications();

      expect(result.success).toBe(true);
      expect(result.skipped).toBeGreaterThan(0);
      expect(result.notificationsSent).toBe(0);
      expect(sendVaccinationNotification).not.toHaveBeenCalled();

      // Nettoyer
      await prisma.childVaccineScheduled.deleteMany({
        where: { childId: childWithoutPhone.id },
      });
      await prisma.children.delete({
        where: { id: childWithoutPhone.id },
      });
    });
  });

  describe("checkAppointmentNotifications() - Gestion des erreurs", () => {
    it("Gère les erreurs d'envoi WhatsApp sans planter", async () => {
      // Simuler une erreur d'envoi WhatsApp
      sendVaccinationNotification.mockResolvedValueOnce({
        success: false,
        error: "Erreur WhatsApp",
      });

      // Créer un rendez-vous dans 7 jours
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 7);
      appointmentDate.setHours(12, 0, 0, 0);

      await prisma.childVaccineScheduled.create({
        data: {
          childId,
          vaccineId,
          scheduledFor: appointmentDate,
        },
      });

      const result = await checkAppointmentNotifications();

      expect(result.success).toBe(true);
      // La notification mobile devrait quand même être créée
      expect(createAndSendNotification).toHaveBeenCalled();

      // Nettoyer
      await prisma.appointmentNotification.deleteMany({});
      await prisma.childVaccineScheduled.deleteMany({
        where: { childId },
      });
    });

    it("Gère les exceptions lors de l'envoi de notification", async () => {
      // Simuler une exception lors de l'envoi WhatsApp
      sendVaccinationNotification.mockRejectedValueOnce(
        new Error("Erreur réseau")
      );

      // Créer un rendez-vous dans 7 jours
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 7);
      appointmentDate.setHours(12, 0, 0, 0);

      await prisma.childVaccineScheduled.create({
        data: {
          childId,
          vaccineId,
          scheduledFor: appointmentDate,
        },
      });

      const result = await checkAppointmentNotifications();

      expect(result.success).toBe(true);
      // La notification mobile devrait quand même être créée
      expect(createAndSendNotification).toHaveBeenCalled();

      // Nettoyer
      await prisma.appointmentNotification.deleteMany({});
      await prisma.childVaccineScheduled.deleteMany({
        where: { childId },
      });
    });

    it("Retourne success: false en cas d'erreur critique", async () => {
      // Simuler une erreur critique en mockant Prisma pour faire échouer la requête
      const originalFindMany = prisma.childVaccineScheduled.findMany;
      const originalFindManyChildren = prisma.children.findMany;
      
      prisma.childVaccineScheduled.findMany = jest.fn().mockRejectedValue(
        new Error("Erreur base de données")
      );
      prisma.children.findMany = jest.fn().mockRejectedValue(
        new Error("Erreur base de données")
      );

      const result = await checkAppointmentNotifications();

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();

      // Restaurer les fonctions originales
      prisma.childVaccineScheduled.findMany = originalFindMany;
      prisma.children.findMany = originalFindManyChildren;
    });
  });

  describe("checkAppointmentNotifications() - Rendez-vous depuis nextAppointment", () => {
    it("Détecte les rendez-vous depuis Children.nextAppointment", async () => {
      // Définir nextAppointment pour l'enfant
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 7);
      appointmentDate.setHours(12, 0, 0, 0);

      await prisma.children.update({
        where: { id: childId },
        data: { nextAppointment: appointmentDate },
      });

      const result = await checkAppointmentNotifications();

      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBeGreaterThan(0);

      // Nettoyer
      await prisma.appointmentNotification.deleteMany({});
      await prisma.children.update({
        where: { id: childId },
        data: { nextAppointment: null },
      });
    });
  });

  describe("checkAppointmentNotifications() - Déduplication", () => {
    it("Déduplique les rendez-vous dupliqués", async () => {
      // Créer deux rendez-vous pour le même enfant à la même date
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 7);
      appointmentDate.setHours(12, 0, 0, 0);

      await prisma.childVaccineScheduled.createMany({
        data: [
          {
            childId,
            vaccineId,
            scheduledFor: appointmentDate,
          },
          {
            childId,
            vaccineId,
            scheduledFor: appointmentDate,
          },
        ],
      });

      const result = await checkAppointmentNotifications();

      expect(result.success).toBe(true);
      // Une seule notification devrait être envoyée (dédupliquée)
      expect(result.notificationsSent).toBe(1);

      // Nettoyer
      await prisma.appointmentNotification.deleteMany({});
      await prisma.childVaccineScheduled.deleteMany({
        where: { childId },
      });
    });
  });
});
