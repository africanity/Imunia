const {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  deleteAllReadNotifications,
} = require("../services/notificationService");

// Récupérer les notifications de l'utilisateur connecté
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { unreadOnly } = req.query;

    const notifications = await getUserNotifications(userId, {
      unreadOnly: unreadOnly === "true",
      limit: 500, // Augmenter la limite pour la page complète
    });

    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

// Récupérer le nombre de notifications non lues
const getUnreadNotificationsCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await getUnreadCount(userId);
    res.json({ count });
  } catch (error) {
    next(error);
  }
};

// Marquer une notification comme lue
const markNotificationAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await markAsRead(id, userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Marquer toutes les notifications comme lues
const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await markAllAsRead(userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Supprimer une notification
const deleteNotificationById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await deleteNotification(id, userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Supprimer toutes les notifications
const deleteAll = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await deleteAllNotifications(userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Supprimer toutes les notifications lues
const deleteAllRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await deleteAllReadNotifications(userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationById,
  deleteAll,
  deleteAllRead,
};

