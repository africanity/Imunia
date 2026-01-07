const prisma = require("../../src/config/prismaClient");
const {
  findAllValidAppointments,
  findAppointmentsToNotify,
  sendAppointmentNotification,
  calculateDaysUntilAppointment,
  findNextThreshold,
  thresholdToNotificationType,
  hasNotificationBeenSent,
  recordNotificationSent,
  getNotificationTypesForAppointment,
} = require("../../src/services/appointmentNotificationService");
const { sendVaccinationNotification } = require("../../src/services/notification");
const { createAndSendNotification } = require("../../src/services/notificationService");

// Mocker les dépendances
jest.mock("../../src/services/notification");
jest.mock("../../src/services/notificationService");

describe("appointmentNotificationService", () => {
  let regionId;
  let communeId;
  let districtId;
  let healthCenterId;
  let vaccineId;
  let childId;

  beforeAll(async () => {
    // Setup de données de test
    const region = await prisma.region.create({
      data: { name: "Test Region Appointment Service" },
    });
    regionId = region.id;

    const commune = await prisma.commune.create({
      data: {
        name: "Test Commune Appointment Service",
        regionId,
      },
    });
    communeId = commune.id;

    const district = await prisma.district.create({
      data: {
        name: "Test District Appointment Service",
        communeId,
      },
    });
    districtId = district.id;

    const healthCenter = await prisma.healthCenter.create({
      data: {
        name: "Test Health Center Appointment Service",
        address: "Test Address",
        districtId,
      },
    });
    healthCenterId = healthCenter.id;

    const vaccine = await prisma.vaccine.create({
      data: {
        name: "Test Vaccine Appointment Service",
        description: "Vaccin de test pour les notifications de rendez-vous",
        dosesRequired: "1",
      },
    });
    vaccineId = vaccine.id;

    const child = await prisma.children.create({
      data: {
        firstName: "Test",
        lastName: "Child Appointment",
        birthDate: new Date("2020-01-01"),
        gender: "M",
        birthPlace: "Dakar",
        address: "Test Address",
        phoneParent: "+221701234567",
        healthCenterId,
        status: "A_JOUR",
        passwordParent: "0000",
      },
    });
    childId = child.id;
  });

  afterAll(async () => {
    // Nettoyage
    await prisma.appointmentNotification.deleteMany({});
    await prisma.childVaccineScheduled.deleteMany({});
    if (childId) {
      await prisma.children.delete({ where: { id: childId } }).catch(() => {});
    }
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
  });

  describe("findAllValidAppointments", () => {
    it("devrait retourner uniquement les rendez-vous valides", async () => {
      const appointment = await prisma.childVaccineScheduled.create({
        data: {
          childId,
          vaccineId,
          scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000), // +1 jour
          dose: 1,
        },
      });

      const appointments = await findAllValidAppointments();
      expect(appointments).toContainEqual(
        expect.objectContaining({ scheduledVaccineId: appointment.id })
      );

      // Nettoyer
      await prisma.childVaccineScheduled.delete({ where: { id: appointment.id } });
    });

    it("ne devrait pas retourner les rendez-vous passés", async () => {
      const appointment = await prisma.childVaccineScheduled.create({
        data: {
          childId,
          vaccineId,
          scheduledFor: new Date(Date.now() - 24 * 60 * 60 * 1000), // -1 jour (passé)
          dose: 1,
        },
      });

      const appointments = await findAllValidAppointments();
      expect(appointments).not.toContainEqual(
        expect.objectContaining({ scheduledVaccineId: appointment.id })
      );

      // Nettoyer
      await prisma.childVaccineScheduled.delete({ where: { id: appointment.id } });
    });
  });

  describe("findAppointmentsToNotify", () => {
    it("devrait trouver les rendez-vous à notifier dans 24h", async () => {
      const appointment = await prisma.childVaccineScheduled.create({
        data: {
          childId,
          vaccineId,
          scheduledFor: new Date(Date.now() + 23 * 60 * 60 * 1000), // +23 heures
          dose: 1,
        },
      });

      const appointments = await findAppointmentsToNotify();
      expect(appointments).toContainEqual(
        expect.objectContaining({ scheduledVaccineId: appointment.id })
      );

      // Nettoyer
      await prisma.childVaccineScheduled.delete({ where: { id: appointment.id } });
    });

    it("ne devrait pas retourner les rendez-vous déjà notifiés", async () => {
      const appointment = await prisma.childVaccineScheduled.create({
        data: {
          childId,
          vaccineId,
          scheduledFor: new Date(Date.now() + 23 * 60 * 60 * 1000),
          dose: 1,
        },
      });

      // Enregistrer une notification
      const appointmentDate = new Date(appointment.scheduledFor);
      appointmentDate.setHours(0, 0, 0, 0);
      
      await prisma.appointmentNotification.create({
        data: {
          childId,
          scheduledVaccineId: appointment.id,
          appointmentDate: appointmentDate,
          notificationType: "2_DAYS",
          sentVia: "EMAIL",
        },
      });

      const appointments = await findAppointmentsToNotify();
      expect(appointments).not.toContainEqual(
        expect.objectContaining({ scheduledVaccineId: appointment.id })
      );

      // Nettoyer
      await prisma.appointmentNotification.deleteMany({
        where: { scheduledVaccineId: appointment.id },
      });
      await prisma.childVaccineScheduled.delete({ where: { id: appointment.id } });
    });
  });

  describe("calculateDaysUntilAppointment", () => {
    it("devrait calculer correctement les jours restants pour un rendez-vous futur", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const days = calculateDaysUntilAppointment(futureDate);
      expect(days).toBeCloseTo(7, 1);
    });

    it("devrait retourner 0 pour un rendez-vous aujourd'hui", () => {
      const today = new Date();
      const days = calculateDaysUntilAppointment(today);
      expect(days).toBeCloseTo(0, 1);
    });

    it("devrait retourner un nombre négatif pour un rendez-vous passé", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);
      const days = calculateDaysUntilAppointment(pastDate);
      expect(days).toBeCloseTo(-3, 1);
    });
  });

  describe("findNextThreshold", () => {
    it("devrait retourner le seuil le plus proche supérieur", () => {
      // Les seuils par défaut sont [7, 2, 0], triés en [0, 2, 7]
      // La logique trouve le premier seuil >= jours restants
      expect(findNextThreshold(8)).toBe(7); // 8 > 7, mais 8 <= 7 est faux, donc on continue jusqu'à trouver 7 (le plus grand)
      expect(findNextThreshold(7)).toBe(7); // 7 <= 7, donc retourne 7
      expect(findNextThreshold(6)).toBe(7); // 6 <= 7, donc retourne 7
      expect(findNextThreshold(3)).toBe(7); // 3 <= 7, donc retourne 7 (pas 2 car on cherche le premier >=)
      expect(findNextThreshold(2)).toBe(2); // 2 <= 2, donc retourne 2
      expect(findNextThreshold(1)).toBe(2); // 1 <= 2, donc retourne 2
      expect(findNextThreshold(0)).toBe(0); // 0 <= 0, donc retourne 0
    });

    it("devrait retourner le plus petit seuil pour un rendez-vous passé", () => {
      expect(findNextThreshold(-1)).toBe(0); // Passé, retourne le plus petit (0)
    });

    it("devrait retourner le plus grand seuil si jours restants > tous les seuils", () => {
      expect(findNextThreshold(30)).toBe(7); // 30 > 7, retourne le plus grand (7)
    });
  });

  describe("thresholdToNotificationType", () => {
    it("devrait convertir correctement les seuils en types de notification", () => {
      expect(thresholdToNotificationType(7)).toBe("1_WEEK");
      expect(thresholdToNotificationType(2)).toBe("2_DAYS");
      expect(thresholdToNotificationType(0)).toBe("SAME_DAY");
      expect(thresholdToNotificationType(5)).toBe("5_DAYS"); // Seuil personnalisé
    });
  });

  describe("hasNotificationBeenSent", () => {
    it("devrait retourner true si la notification a déjà été envoyée", async () => {
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 1);
      appointmentDate.setHours(0, 0, 0, 0);

      await prisma.appointmentNotification.create({
        data: {
          childId,
          scheduledVaccineId: null,
          appointmentDate: appointmentDate,
          notificationType: "1_WEEK",
          sentVia: "EMAIL",
        },
      });

      const result = await hasNotificationBeenSent(
        childId,
        null,
        "1_WEEK",
        appointmentDate
      );
      expect(result).toBe(true);

      // Nettoyer
      await prisma.appointmentNotification.deleteMany({
        where: { childId },
      });
    });

    it("devrait retourner false si la notification n'a pas été envoyée", async () => {
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 1);
      appointmentDate.setHours(0, 0, 0, 0);

      const result = await hasNotificationBeenSent(
        childId,
        null,
        "1_WEEK",
        appointmentDate
      );
      expect(result).toBe(false);
    });
  });

  describe("recordNotificationSent", () => {
    it("devrait enregistrer une notification envoyée", async () => {
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 1);

      await recordNotificationSent(
        childId,
        null,
        appointmentDate,
        "1_WEEK",
        "EMAIL"
      );

      const notification = await prisma.appointmentNotification.findUnique({
        where: {
          childId_notificationType_appointmentDate: {
            childId,
            notificationType: "1_WEEK",
            appointmentDate: new Date(
              appointmentDate.getFullYear(),
              appointmentDate.getMonth(),
              appointmentDate.getDate()
            ),
          },
        },
      });

      expect(notification).toBeTruthy();
      expect(notification.sentVia).toBe("EMAIL");

      // Nettoyer
      await prisma.appointmentNotification.deleteMany({
        where: { childId },
      });
    });
  });

  describe("sendAppointmentNotification", () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      sendVaccinationNotification.mockResolvedValue({ success: true });
      createAndSendNotification.mockResolvedValue({ success: true });
      // Nettoyer les notifications avant chaque test
      await prisma.appointmentNotification.deleteMany({
        where: { childId },
      });
    });

    it("devrait envoyer une notification avec succès via WhatsApp", async () => {
      const appointment = {
        childId,
        scheduledVaccineId: null,
        appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        notificationType: "1_WEEK",
        child: {
          id: childId,
          firstName: "Test",
          lastName: "Child",
          phoneParent: "+221701234567",
          healthCenter: { name: "Test Health Center" },
        },
        vaccine: {
          id: vaccineId,
          name: "Test Vaccine",
        },
      };

      const result = await sendAppointmentNotification(appointment);

      expect(result.success).toBe(true);
      expect(result.sentVia).toContain("WHATSAPP");
      expect(sendVaccinationNotification).toHaveBeenCalled();
      expect(createAndSendNotification).toHaveBeenCalled();
    });

    it("devrait retourner already_sent si la notification a déjà été envoyée", async () => {
      const appointmentDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const appointmentDateOnly = new Date(
        appointmentDate.getFullYear(),
        appointmentDate.getMonth(),
        appointmentDate.getDate()
      );

      // S'assurer qu'il n'y a pas de notification existante
      await prisma.appointmentNotification.deleteMany({
        where: {
          childId,
          notificationType: "1_WEEK",
          appointmentDate: appointmentDateOnly,
        },
      });

      await prisma.appointmentNotification.create({
        data: {
          childId,
          scheduledVaccineId: null,
          appointmentDate: appointmentDateOnly,
          notificationType: "1_WEEK",
          sentVia: "EMAIL",
        },
      });

      const appointment = {
        childId,
        scheduledVaccineId: null,
        appointmentDate,
        notificationType: "1_WEEK",
        child: {
          id: childId,
          firstName: "Test",
          lastName: "Child",
          phoneParent: "+221701234567",
          healthCenter: { name: "Test Health Center" },
        },
        vaccine: {
          id: vaccineId,
          name: "Test Vaccine",
        },
      };

      const result = await sendAppointmentNotification(appointment);

      expect(result.success).toBe(false);
      expect(result.reason).toBe("already_sent");
      expect(sendVaccinationNotification).not.toHaveBeenCalled();

      // Nettoyer
      await prisma.appointmentNotification.deleteMany({
        where: { childId },
      });
    });

    it("devrait retourner no_contact si l'enfant n'a pas de contact", async () => {
      // S'assurer qu'il n'y a pas de notification existante
      await prisma.appointmentNotification.deleteMany({
        where: { childId },
      });

      const appointment = {
        childId,
        scheduledVaccineId: null,
        appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        notificationType: "1_WEEK",
        child: {
          id: childId,
          firstName: "Test",
          lastName: "Child",
          phoneParent: null,
          healthCenter: { name: "Test Health Center" },
        },
        vaccine: {
          id: vaccineId,
          name: "Test Vaccine",
        },
      };

      const result = await sendAppointmentNotification(appointment);

      expect(result.success).toBe(false);
      expect(result.reason).toBe("no_contact");
      expect(sendVaccinationNotification).not.toHaveBeenCalled();
    });

    it("devrait créer une notification mobile même si WhatsApp échoue", async () => {
      // S'assurer qu'il n'y a pas de notification existante
      await prisma.appointmentNotification.deleteMany({
        where: { childId },
      });

      sendVaccinationNotification.mockResolvedValue({ success: false, error: "Erreur WhatsApp" });

      const appointment = {
        childId,
        scheduledVaccineId: null,
        appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        notificationType: "1_WEEK",
        child: {
          id: childId,
          firstName: "Test",
          lastName: "Child",
          phoneParent: "+221701234567",
          healthCenter: { name: "Test Health Center" },
        },
        vaccine: {
          id: vaccineId,
          name: "Test Vaccine",
        },
      };

      const result = await sendAppointmentNotification(appointment);

      expect(result.success).toBe(true);
      expect(result.sentVia).toContain("MOBILE");
      expect(createAndSendNotification).toHaveBeenCalled();

      // Nettoyer
      await prisma.appointmentNotification.deleteMany({
        where: { childId },
      });
    });

    it("devrait gérer différents types de notification (1_WEEK, 2_DAYS, SAME_DAY)", async () => {
      const types = ["1_WEEK", "2_DAYS", "SAME_DAY"];

      for (const notificationType of types) {
        // S'assurer qu'il n'y a pas de notification existante pour ce type
        await prisma.appointmentNotification.deleteMany({
          where: { childId, notificationType },
        });

        const appointmentDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const appointment = {
          childId,
          scheduledVaccineId: null,
          appointmentDate,
          notificationType,
          child: {
            id: childId,
            firstName: "Test",
            lastName: "Child",
            phoneParent: "+221701234567",
            healthCenter: { name: "Test Health Center" },
          },
          vaccine: {
            id: vaccineId,
            name: "Test Vaccine",
          },
        };

        const result = await sendAppointmentNotification(appointment);
        expect(result.success).toBe(true);

        // Nettoyer
        await prisma.appointmentNotification.deleteMany({
          where: { childId, notificationType },
        });
      }
    });
  });

  describe("getNotificationTypesForAppointment (deprecated)", () => {
    it("devrait retourner les types de notification pour un rendez-vous", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 8); // 8 jours dans le futur

      const types = getNotificationTypesForAppointment(futureDate);
      expect(Array.isArray(types)).toBe(true);
    });

    it("devrait retourner SAME_DAY pour un rendez-vous aujourd'hui", () => {
      const today = new Date();
      const types = getNotificationTypesForAppointment(today);
      expect(types.some((t) => t.type === "SAME_DAY")).toBe(true);
    });
  });
});