const prisma = require("../config/prismaClient");
const { sendVaccinationNotification } = require("./notification");
const { sendAppointmentReminderEmail } = require("./emailService");
const { createAndSendNotification } = require("./notificationService");

// Seuils de notification en jours (configurables via env)
const APPOINTMENT_WARNING_DAYS = process.env.APPOINTMENT_WARNING_DAYS
  ? process.env.APPOINTMENT_WARNING_DAYS.split(",").map(Number)
  : [7, 2, 0]; // 1 semaine, 2 jours, jour même

/**
 * Calcule les jours restants jusqu'au rendez-vous (en décimal)
 */
const calculateDaysUntilAppointment = (appointmentDate) => {
  const now = new Date();
  const appointment = new Date(appointmentDate);
  // Normaliser à minuit pour comparer les jours
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const appointmentMidnight = new Date(
    appointment.getFullYear(),
    appointment.getMonth(),
    appointment.getDate()
  );
  const diffMs = appointmentMidnight - nowMidnight;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays;
};

/**
 * Trouve le seuil supérieur le plus proche pour un nombre de jours donné
 * Retourne le plus petit seuil qui est >= jours restants
 */
const findNextThreshold = (daysRemaining) => {
  // Trier les seuils par ordre croissant pour trouver le plus petit seuil >= jours restants
  const sortedThresholds = [...APPOINTMENT_WARNING_DAYS].sort((a, b) => a - b);

  // Trouver le premier seuil qui est >= jours restants (le plus petit seuil supérieur)
  for (const threshold of sortedThresholds) {
    if (daysRemaining <= threshold) {
      return threshold;
    }
  }

  // Si tous les seuils sont passés (jours restants < 0), retourner le plus petit (0)
  if (daysRemaining < 0) {
    return sortedThresholds[0];
  }
  // Si jours restants > tous les seuils, retourner le plus grand
  return sortedThresholds[sortedThresholds.length - 1];
};

/**
 * Convertit un seuil en type de notification
 */
const thresholdToNotificationType = (threshold) => {
  switch (threshold) {
    case 7:
      return "1_WEEK";
    case 2:
      return "2_DAYS";
    case 0:
      return "SAME_DAY";
    default:
      return `${threshold}_DAYS`;
  }
};

/**
 * @deprecated - Utiliser la nouvelle logique avec findNextThreshold
 */
const getNotificationTypesForAppointment = (appointmentDate) => {
  const now = new Date();
  const appointment = new Date(appointmentDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const appointmentDay = new Date(
    appointment.getFullYear(),
    appointment.getMonth(),
    appointment.getDate()
  );

  const daysDiff = Math.ceil(
    (appointmentDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  const types = [];

  // 1 semaine avant (7 jours)
  if (daysDiff > 7) {
    const oneWeekBefore = new Date(appointment);
    oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
    const oneWeekBeforeDay = new Date(
      oneWeekBefore.getFullYear(),
      oneWeekBefore.getMonth(),
      oneWeekBefore.getDate()
    );
    const oneWeekDiff = Math.ceil(
      (oneWeekBeforeDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (oneWeekDiff === 0) {
      types.push({ type: "1_WEEK", targetDate: oneWeekBeforeDay });
    }
  }

  // 2 jours avant
  if (daysDiff >= 2 && daysDiff <= 7) {
    const twoDaysBefore = new Date(appointment);
    twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
    const twoDaysBeforeDay = new Date(
      twoDaysBefore.getFullYear(),
      twoDaysBefore.getMonth(),
      twoDaysBefore.getDate()
    );
    const twoDaysDiff = Math.ceil(
      (twoDaysBeforeDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (twoDaysDiff === 0) {
      types.push({ type: "2_DAYS", targetDate: twoDaysBeforeDay });
    }
  }

  // Veille (1 jour avant)
  if (daysDiff === 1) {
    types.push({ type: "1_DAY", targetDate: today });
  }

  // Jour même
  if (daysDiff === 0) {
    types.push({ type: "SAME_DAY", targetDate: today });
  }

  return types;
};

/**
 * Trouve tous les rendez-vous valides qui peuvent être notifiés
 */
const findAllValidAppointments = async () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Récupérer tous les rendez-vous futurs depuis ChildVaccineScheduled
  const scheduledVaccines = await prisma.childVaccineScheduled.findMany({
    where: {
      scheduledFor: {
        gte: today,
      },
    },
    include: {
      child: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneParent: true,
          healthCenter: {
            select: {
              name: true,
            },
          },
        },
      },
      vaccine: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Récupérer aussi depuis Children.nextAppointment
  const childrenWithAppointments = await prisma.children.findMany({
    where: {
      nextAppointment: {
        gte: today,
        not: null,
      },
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneParent: true,
      nextAppointment: true,
      healthCenter: {
        select: {
          name: true,
        },
      },
    },
  });

  const allAppointments = [];

  // Traiter les ChildVaccineScheduled
  for (const scheduled of scheduledVaccines) {
    allAppointments.push({
      childId: scheduled.childId,
      scheduledVaccineId: scheduled.id,
      appointmentDate: scheduled.scheduledFor,
      child: scheduled.child,
      vaccine: scheduled.vaccine,
    });
  }

  // Traiter les Children.nextAppointment
  for (const child of childrenWithAppointments) {
    if (!child.nextAppointment) continue;

    allAppointments.push({
      childId: child.id,
      scheduledVaccineId: null,
      appointmentDate: child.nextAppointment,
      child: {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        phoneParent: child.phoneParent,
        healthCenter: child.healthCenter,
      },
      vaccine: null, // Pas de vaccin spécifique pour nextAppointment
    });
  }

  return allAppointments;
};

/**
 * Trouve les rendez-vous à notifier selon la nouvelle logique (seuil supérieur le plus proche)
 */
const findAppointmentsToNotify = async () => {
  const allAppointments = await findAllValidAppointments();
  const appointmentsToNotify = [];
  const now = new Date();

  // Dédupliquer les rendez-vous (même enfant, même date, même type de notification)
  const seenAppointments = new Set();

  for (const appointment of allAppointments) {
    const daysRemaining = calculateDaysUntilAppointment(appointment.appointmentDate);
    const nextThreshold = findNextThreshold(daysRemaining);

    if (!nextThreshold) {
      continue;
    }

    // Vérifier si on est à moins de 24h du seuil
    // On envoie si : jours restants <= seuil ET jours restants >= seuil - 1
    const isWithin24Hours = daysRemaining <= nextThreshold && daysRemaining >= nextThreshold - 1;

    if (!isWithin24Hours) {
      continue;
    }

    const notificationType = thresholdToNotificationType(nextThreshold);

    // Créer une clé unique pour dédupliquer
    const appointmentDay = new Date(appointment.appointmentDate);
    appointmentDay.setHours(0, 0, 0, 0);
    const uniqueKey = `${appointment.childId}_${notificationType}_${appointmentDay.toISOString()}`;

    if (seenAppointments.has(uniqueKey)) {
      console.log(`    ⏭️  Rendez-vous dupliqué ignoré pour ${appointment.child.firstName} ${appointment.child.lastName} (${notificationType})`);
      continue;
    }
    seenAppointments.add(uniqueKey);

    // Vérifier si la notification a déjà été envoyée
    const alreadySent = await hasNotificationBeenSent(
      appointment.childId,
      appointment.scheduledVaccineId,
      notificationType,
      appointment.appointmentDate
    );

    if (alreadySent) {
      console.log(`    ⏭️  Notification déjà envoyée pour ${appointment.child.firstName} ${appointment.child.lastName} (${notificationType})`);
      continue;
    }

    console.log(`    📧 Notification à envoyer pour ${appointment.child.firstName} ${appointment.child.lastName} (${notificationType}, dans ${daysRemaining.toFixed(2)} jours)`);

    appointmentsToNotify.push({
      ...appointment,
      notificationType,
    });
  }

  return appointmentsToNotify;
};

/**
 * Vérifie si une notification a déjà été envoyée
 */
const hasNotificationBeenSent = async (
  childId,
  scheduledVaccineId,
  notificationType,
  appointmentDate
) => {
  const appointmentDay = new Date(appointmentDate);
  appointmentDay.setHours(0, 0, 0, 0);

  const existing = await prisma.appointmentNotification.findUnique({
    where: {
      childId_notificationType_appointmentDate: {
        childId,
        notificationType,
        appointmentDate: appointmentDay,
      },
    },
  });

  return !!existing;
};

/**
 * Enregistre qu'une notification a été envoyée
 */
const recordNotificationSent = async (
  childId,
  scheduledVaccineId,
  appointmentDate,
  notificationType,
  sentVia
) => {
  const appointmentDay = new Date(appointmentDate);
  appointmentDay.setHours(0, 0, 0, 0);

  await prisma.appointmentNotification.create({
    data: {
      childId,
      scheduledVaccineId: scheduledVaccineId || null,
      appointmentDate: appointmentDay,
      notificationType,
      sentVia,
    },
  });
};

/**
 * Envoie une notification pour un rendez-vous
 */
const sendAppointmentNotification = async (appointment) => {
  const { child, vaccine, appointmentDate, notificationType, childId, scheduledVaccineId } = appointment;

  // Vérifier si la notification a déjà été envoyée
  const alreadySent = await hasNotificationBeenSent(
    childId,
    scheduledVaccineId,
    notificationType,
    appointmentDate
  );

  if (alreadySent) {
    return { success: false, reason: "already_sent" };
  }

  if (!child.phoneParent) {
    console.warn(
      `Aucun contact pour l'enfant ${child.firstName} ${child.lastName}`
    );
    return { success: false, reason: "no_contact" };
  }

  const childName = `${child.firstName} ${child.lastName}`;
  const vaccineName = vaccine?.name || "vaccination";
  const healthCenterName = child.healthCenter?.name || "Centre de santé";

  // Formater la date
  const appointmentDateObj = new Date(appointmentDate);
  const formattedDate = appointmentDateObj.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let sentVia = "";
  let success = false;
  let errorMessage = null;

  // Essayer WhatsApp d'abord
  if (child.phoneParent) {
    try {
      console.log(`      📱 Tentative envoi WhatsApp à ${child.phoneParent}...`);
      const whatsappResult = await sendVaccinationNotification({
        to: child.phoneParent,
        parentName: "Parent",
        childName,
        vaccineName,
        appointmentDate: formattedDate,
      });

      if (whatsappResult.success) {
        sentVia = "WHATSAPP";
        success = true;
        console.log(`      ✅ WhatsApp envoyé avec succès`);
      } else {
        console.log(`      ⚠️ WhatsApp échoué: ${whatsappResult.error || 'Erreur inconnue'}`);
        errorMessage = whatsappResult.error || "Erreur WhatsApp";
      }
    } catch (error) {
      console.error(`      ❌ Erreur envoi WhatsApp:`, error.message);
      errorMessage = error.message;
    }
  }


  // Créer une notification mobile (toujours, même si WhatsApp/Email échoue)
  try {
    // Déterminer le message selon le type de notification
    let notificationTitle = "Rappel de rendez-vous";
    let notificationMessage = `Rendez-vous de vaccination pour ${childName}`;
    
    if (notificationType === "1_WEEK") {
      notificationTitle = "Rappel : Rendez-vous dans 1 semaine";
      notificationMessage = `Rappel : Vous avez un rendez-vous de vaccination pour ${childName} le ${formattedDate}`;
    } else if (notificationType === "2_DAYS") {
      notificationTitle = "Rappel : Rendez-vous dans 2 jours";
      notificationMessage = `Rappel : Vous avez un rendez-vous de vaccination pour ${childName} le ${formattedDate}`;
    } else if (notificationType === "1_DAY") {
      notificationTitle = "Rappel : Rendez-vous demain";
      notificationMessage = `Rappel : Vous avez un rendez-vous de vaccination pour ${childName} demain (${formattedDate})`;
    } else if (notificationType === "SAME_DAY") {
      notificationTitle = "Rappel : Rendez-vous aujourd'hui";
      notificationMessage = `Rappel : Vous avez un rendez-vous de vaccination pour ${childName} aujourd'hui (${formattedDate})`;
    }

    if (vaccineName) {
      notificationMessage += ` - Vaccin : ${vaccineName}`;
    }
    if (healthCenterName) {
      notificationMessage += ` - Centre : ${healthCenterName}`;
    }

    console.log(`      📱 Création notification mobile pour ${childName}...`);
    await createAndSendNotification({
      childId,
      title: notificationTitle,
      message: notificationMessage,
      type: "appointment",
      sendSocket: true, // Envoyer via Socket.io pour les clients connectés
    });
    console.log(`      ✅ Notification mobile créée avec succès`);
    
    // Si WhatsApp/Email a échoué mais qu'on a créé la notification mobile, considérer comme succès
    if (!success) {
      success = true;
      sentVia = sentVia ? `${sentVia},MOBILE` : "MOBILE";
    } else {
      sentVia = `${sentVia},MOBILE`;
    }
  } catch (error) {
    console.error(`      ❌ Erreur création notification mobile:`, error.message);
    // Ne pas faire échouer l'opération si la notification mobile échoue
    errorMessage = errorMessage || `Erreur notification mobile: ${error.message}`;
  }

  if (success) {
    try {
      await recordNotificationSent(
        childId,
        scheduledVaccineId,
        appointmentDate,
        notificationType,
        sentVia
      );
      console.log(`      ✅ Notification enregistrée en base`);
    } catch (error) {
      console.error(`      ❌ Erreur enregistrement notification:`, error.message);
      errorMessage = errorMessage || `Erreur enregistrement: ${error.message}`;
    }
  }

  return { 
    success, 
    sentVia,
    error: errorMessage || (success ? null : "Aucun moyen de contact disponible ou erreur d'envoi")
  };
};

module.exports = {
  APPOINTMENT_WARNING_DAYS,
  calculateDaysUntilAppointment,
  findNextThreshold,
  thresholdToNotificationType,
  findAllValidAppointments,
  findAppointmentsToNotify,
  hasNotificationBeenSent,
  recordNotificationSent,
  sendAppointmentNotification,
  // Garder l'ancienne fonction pour compatibilité
  getNotificationTypesForAppointment,
};

