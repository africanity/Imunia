const prisma = require("../config/prismaClient");
const { sendNotificationToChild, sendNotificationToParent } = require("../socket");

/**
 * Récupère les IDs des agents actifs d'un centre de santé
 * @param {string} healthCenterId - ID du centre de santé
 * @returns {Promise<string[]>} - Liste des IDs des agents
 */
const getHealthCenterAgentIds = async (healthCenterId) => {
  if (!healthCenterId) {
    return [];
  }

  try {
    const agents = await prisma.user.findMany({
      where: {
        role: "AGENT",
        healthCenterId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    return agents.map((agent) => agent.id);
  } catch (error) {
    console.error("Erreur récupération agents du centre:", error);
    return [];
  }
};

/**
 * Notifie tous les agents actifs d'un centre de santé
 * @param {Object} params
 * @param {string} params.healthCenterId - ID du centre de santé
 * @param {string} params.title - Titre de la notification
 * @param {string} params.message - Message de la notification
 * @param {string} params.type - Type de notification
 * @param {string} params.excludeUserId - ID de l'utilisateur à exclure (celui qui a fait l'action)
 */
const notifyHealthCenterAgents = async ({ healthCenterId, title, message, type, excludeUserId = null }) => {
  try {
    const agentIds = await getHealthCenterAgentIds(healthCenterId);
    
    // Exclure l'utilisateur qui a fait l'action
    const filteredAgentIds = excludeUserId 
      ? agentIds.filter((id) => id !== excludeUserId)
      : agentIds;

    if (filteredAgentIds.length === 0) {
      return [];
    }

    return await createNotificationsForUsers({
      userIds: filteredAgentIds,
      title,
      message,
      type,
    });
  } catch (error) {
    console.error("Erreur notification agents du centre:", error);
    return [];
  }
};

/**
 * Crée une notification pour un utilisateur
 * @param {Object} params
 * @param {string} params.userId - ID de l'utilisateur
 * @param {string} params.title - Titre de la notification
 * @param {string} params.message - Message de la notification
 * @param {string} params.type - Type de notification (ex: "STOCK_TRANSFER", "ENTITY_CREATED", etc.)
 */
const createNotification = async ({ userId, title, message, type }) => {
  try {
    const notification = await prisma.userNotification.create({
      data: {
        userId,
        title,
        message,
        type,
        read: false,
      },
    });
    return notification;
  } catch (error) {
    console.error("Erreur création notification:", error);
    // Ne pas faire échouer l'opération si la création de notification échoue
    return null;
  }
};

/**
 * Crée des notifications pour plusieurs utilisateurs
 * @param {Array} userIds - Liste des IDs d'utilisateurs
 * @param {string} title - Titre de la notification
 * @param {string} message - Message de la notification
 * @param {string} type - Type de notification
 */
const createNotificationsForUsers = async ({ userIds, title, message, type }) => {
  if (!userIds || userIds.length === 0) {
    return [];
  }

  try {
    // Vérifier que tous les userIds existent dans la base de données
    const existingUsers = await prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
      },
    });

    const validUserIds = existingUsers.map((user) => user.id);

    if (validUserIds.length === 0) {
      return [];
    }

    const notifications = await prisma.userNotification.createMany({
      data: validUserIds.map((userId) => ({
        userId,
        title,
        message,
        type,
        read: false,
      })),
    });
    return notifications;
  } catch (error) {
    console.error("Erreur création notifications:", error);
    // Ne pas faire échouer l'opération si la création de notifications échoue
    return [];
  }
};

/**
 * Récupère les notifications d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} options - Options de récupération
 * @param {boolean} options.unreadOnly - Récupérer uniquement les non lues
 * @param {number} options.limit - Nombre maximum de notifications
 */
const getUserNotifications = async (userId, options = {}) => {
  const { unreadOnly = false, limit = 500 } = options;

  try {
    const where = {
      userId,
      ...(unreadOnly && { read: false }),
    };

    const notifications = await prisma.userNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return notifications;
  } catch (error) {
    console.error("Erreur récupération notifications:", error);
    return [];
  }
};

/**
 * Compte les notifications non lues d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 */
const getUnreadCount = async (userId) => {
  try {
    const count = await prisma.userNotification.count({
      where: {
        userId,
        read: false,
      },
    });
    return count;
  } catch (error) {
    console.error("Erreur comptage notifications non lues:", error);
    return 0;
  }
};

/**
 * Marque une notification comme lue
 * @param {string} notificationId - ID de la notification
 * @param {string} userId - ID de l'utilisateur (pour vérification)
 */
const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await prisma.userNotification.updateMany({
      where: {
        id: notificationId,
        userId, // S'assurer que la notification appartient à l'utilisateur
      },
      data: {
        read: true,
      },
    });
    return notification;
  } catch (error) {
    console.error("Erreur marquage notification comme lue:", error);
    throw error;
  }
};

/**
 * Marque toutes les notifications d'un utilisateur comme lues
 * @param {string} userId - ID de l'utilisateur
 */
const markAllAsRead = async (userId) => {
  try {
    const result = await prisma.userNotification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });
    return result;
  } catch (error) {
    console.error("Erreur marquage toutes notifications comme lues:", error);
    throw error;
  }
};

/**
 * Supprime une notification
 * @param {string} notificationId - ID de la notification
 * @param {string} userId - ID de l'utilisateur (pour vérification)
 */
const deleteNotification = async (notificationId, userId) => {
  try {
    const result = await prisma.userNotification.deleteMany({
      where: {
        id: notificationId,
        userId, // S'assurer que la notification appartient à l'utilisateur
      },
    });
    return result;
  } catch (error) {
    console.error("Erreur suppression notification:", error);
    throw error;
  }
};

/**
 * Supprime toutes les notifications d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 */
const deleteAllNotifications = async (userId) => {
  try {
    const result = await prisma.userNotification.deleteMany({
      where: {
        userId,
      },
    });
    return result;
  } catch (error) {
    console.error("Erreur suppression toutes notifications:", error);
    throw error;
  }
};

/**
 * Supprime toutes les notifications lues d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 */
const deleteAllReadNotifications = async (userId) => {
  try {
    const result = await prisma.userNotification.deleteMany({
      where: {
        userId,
        read: true,
      },
    });
    return result;
  } catch (error) {
    console.error("Erreur suppression notifications lues:", error);
    throw error;
  }
};

/**
 * Crée et envoie une notification pour un enfant (mobile)
 * @param {Object} params
 * @param {string} params.childId - ID de l'enfant
 * @param {string} params.title - Titre de la notification
 * @param {string} params.message - Message de la notification
 * @param {string} params.type - Type de notification
 * @param {boolean} params.sendSocket - Envoyer via Socket.io (défaut: true)
 */
const createAndSendNotification = async ({ childId, title, message, type, sendSocket = true }) => {
  try {
    // Récupérer les informations de l'enfant pour obtenir le numéro du parent
    const child = await prisma.children.findUnique({
      where: { id: childId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneParent: true,
      },
    });

    if (!child) {
      console.error(`Enfant ${childId} non trouvé`);
      return null;
    }

    // Créer la notification dans la base de données
    const notification = await prisma.notification.create({
      data: {
        childId,
        title,
        message,
        type,
        isRead: false,
      },
    });

    // Envoyer via Socket.io si demandé
    if (sendSocket) {
      const notificationData = {
        id: notification.id,
        childId: notification.childId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        read: notification.isRead,
        createdAt: notification.createdAt.toISOString(),
        updatedAt: notification.updatedAt.toISOString(),
      };

      // Envoyer à la room de l'enfant
      sendNotificationToChild(childId, notificationData);

      // Envoyer aussi à la room "parent" si le parent a un numéro de téléphone
      if (child.phoneParent) {
        sendNotificationToParent(child.phoneParent, notificationData);
      }
    }

    return notification;
  } catch (error) {
    console.error("Erreur création/envoi notification enfant:", error);
    return null;
  }
};

/**
 * Notifie le parent qu'un rendez-vous de vaccination a été programmé
 * @param {Object} params
 * @param {string} params.childId - ID de l'enfant
 * @param {string} params.vaccineName - Nom du vaccin
 * @param {Date|string} params.scheduledDate - Date du rendez-vous
 */
const notifyVaccineScheduled = async ({ childId, vaccineName, scheduledDate }) => {
  try {
    const formattedDate = new Date(scheduledDate).toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return await createAndSendNotification({
      childId,
      title: "Nouveau rendez-vous de vaccination",
      message: `Un rendez-vous de vaccination a été programmé pour le vaccin ${vaccineName} le ${formattedDate}.`,
      type: "appointment",
      sendSocket: true,
    });
  } catch (error) {
    console.error("Erreur notification rendez-vous programmé:", error);
    return null;
  }
};

/**
 * Notifie le parent qu'un rendez-vous de vaccination a été manqué
 */
const notifyVaccineMissed = async ({ childId, vaccineName, dueDate }) => {
  try {
    return await createAndSendNotification({
      childId,
      title: "Vaccin raté",
      message: `Le vaccin ${vaccineName} était prévu pour le ${new Date(dueDate).toLocaleDateString("fr-FR")} et n'a pas été effectué`,
      type: "vaccination",
      sendSocket: true,
    });
  } catch (error) {
    console.error("Erreur notification rendez-vous manqué:", error);
    return null;
  }
};

/**
 * Notifie le parent qu'un vaccin est en retard
 */
const notifyVaccineLate = async ({ childId, vaccineName, dueDate }) => {
  try {
    return await createAndSendNotification({
      childId,
      title: "Vaccin en retard",
      message: `Le vaccin ${vaccineName} était prévu pour le ${new Date(dueDate).toLocaleDateString("fr-FR")} et est maintenant en retard`,
      type: "vaccination",
      sendSocket: true,
    });
  } catch (error) {
    console.error("Erreur notification vaccin en retard:", error);
    return null;
  }
};

/**
 * Notifie le parent qu'un rendez-vous a été modifié
 */
const notifyAppointmentUpdated = async ({ childId, updates }) => {
  if (!childId || !Array.isArray(updates) || updates.length === 0) {
    return null;
  }

  try {
    return await Promise.all(
      updates.map((update) =>
        createAndSendNotification({
          childId,
          title: update.title ?? "Rendez-vous modifié",
          message: update.message ?? "Un rendez-vous a été modifié.",
          type: "appointment",
          sendSocket: true,
        }),
      ),
    );
  } catch (error) {
    console.error("Erreur notification rendez-vous modifié:", error);
    return null;
  }
};

/**
 * Notifie le parent qu'un rendez-vous a été annulé
 */
const notifyAppointmentCancelled = async ({ childId, vaccineName, scheduledDate }) => {
  try {
    return await createAndSendNotification({
      childId,
      title: "Rendez-vous annulé",
      message: `Le rendez-vous pour le vaccin ${vaccineName} prévu le ${new Date(scheduledDate).toLocaleDateString("fr-FR")} a été annulé.`,
      type: "appointment",
      sendSocket: true,
    });
  } catch (error) {
    console.error("Erreur notification rendez-vous annulé:", error);
    return null;
  }
};

/**
 * Créer une notification pour un nouveau conseil
 */
const notifyNewAdvice = async ({ childId, adviceTitle }) => {
  try {
    return await createAndSendNotification({
      childId,
      title: "Nouveau conseil disponible",
      message: `Un nouveau conseil est disponible : ${adviceTitle}`,
      type: "advice",
      sendSocket: true,
    });
  } catch (error) {
    console.error("Erreur notification nouveau conseil:", error);
    return null;
  }
};

/**
 * Créer une notification pour une nouvelle campagne
 */
const notifyNewCampaign = async ({ childId, campaignTitle }) => {
  try {
    return await createAndSendNotification({
      childId,
      title: "Nouvelle campagne de vaccination",
      message: `Une nouvelle campagne est disponible : ${campaignTitle}`,
      type: "campaign",
      sendSocket: true,
    });
  } catch (error) {
    console.error("Erreur notification nouvelle campagne:", error);
    return null;
  }
};

/**
 * Créer une notification pour un rendez-vous
 */
const notifyAppointment = async ({ childId, vaccineName, appointmentDate }) => {
  try {
    return await createAndSendNotification({
      childId,
      title: "Rendez-vous de vaccination",
      message: `Rendez-vous pour le vaccin ${vaccineName} le ${new Date(appointmentDate).toLocaleDateString("fr-FR")}`,
      type: "appointment",
      sendSocket: true,
    });
  } catch (error) {
    console.error("Erreur notification rendez-vous:", error);
    return null;
  }
};

/**
 * Créer une notification pour l'activation du compte enfant
 */
const notifyAccountActivated = async ({ childId, childName }) => {
  try {
    return await createAndSendNotification({
      childId,
      title: "Compte activé",
      message: `Le compte de ${childName} a été activé avec succès. Vous pouvez maintenant accéder à toutes les fonctionnalités de l'application.`,
      type: "account",
      sendSocket: true,
    });
  } catch (error) {
    console.error("Erreur notification activation compte:", error);
    return null;
  }
};

module.exports = {
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
  notifyNewAdvice,
  notifyNewCampaign,
  notifyAppointment,
  notifyAppointmentUpdated,
  notifyAppointmentCancelled,
  notifyAccountActivated,
  getHealthCenterAgentIds,
  notifyHealthCenterAgents,
};
