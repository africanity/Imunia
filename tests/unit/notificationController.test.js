// tests/unit/notificationController.test.js

const {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationById,
  deleteAll,
  deleteAllRead,
} = require('../../src/controllers/notificationController');

const notificationService = require('../../src/services/notificationService');

// Mock des dépendances
jest.mock('../../src/services/notificationService', () => ({
  getUserNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteNotification: jest.fn(),
  deleteAllNotifications: jest.fn(),
  deleteAllReadNotifications: jest.fn(),
}));

describe('notificationController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {
        id: 'user-1',
      },
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('devrait retourner toutes les notifications de l\'utilisateur', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          title: 'Notification 1',
          message: 'Message 1',
          read: false,
          createdAt: new Date(),
        },
        {
          id: 'notif-2',
          title: 'Notification 2',
          message: 'Message 2',
          read: true,
          createdAt: new Date(),
        },
      ];

      notificationService.getUserNotifications.mockResolvedValue(mockNotifications);

      await getNotifications(req, res, next);

      expect(notificationService.getUserNotifications).toHaveBeenCalledWith('user-1', {
        unreadOnly: false,
        limit: 500,
      });
      expect(res.json).toHaveBeenCalledWith(mockNotifications);
    });

    it('devrait filtrer les notifications non lues si unreadOnly=true', async () => {
      req.query.unreadOnly = 'true';

      const mockNotifications = [
        {
          id: 'notif-1',
          title: 'Notification 1',
          read: false,
        },
      ];

      notificationService.getUserNotifications.mockResolvedValue(mockNotifications);

      await getNotifications(req, res, next);

      expect(notificationService.getUserNotifications).toHaveBeenCalledWith('user-1', {
        unreadOnly: true,
        limit: 500,
      });
      expect(res.json).toHaveBeenCalledWith(mockNotifications);
    });

    it('devrait gérer les erreurs', async () => {
      notificationService.getUserNotifications.mockRejectedValue(new Error('Service Error'));

      await getNotifications(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getUnreadNotificationsCount', () => {
    it('devrait retourner le nombre de notifications non lues', async () => {
      notificationService.getUnreadCount.mockResolvedValue(5);

      await getUnreadNotificationsCount(req, res, next);

      expect(notificationService.getUnreadCount).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ count: 5 });
    });

    it('devrait retourner 0 si aucune notification non lue', async () => {
      notificationService.getUnreadCount.mockResolvedValue(0);

      await getUnreadNotificationsCount(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ count: 0 });
    });

    it('devrait gérer les erreurs', async () => {
      notificationService.getUnreadCount.mockRejectedValue(new Error('Service Error'));

      await getUnreadNotificationsCount(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('markNotificationAsRead', () => {
    it('devrait marquer une notification comme lue', async () => {
      req.params.id = 'notif-1';

      notificationService.markAsRead.mockResolvedValue();

      await markNotificationAsRead(req, res, next);

      expect(notificationService.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('devrait gérer les erreurs', async () => {
      req.params.id = 'notif-1';
      notificationService.markAsRead.mockRejectedValue(new Error('Service Error'));

      await markNotificationAsRead(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('devrait marquer toutes les notifications comme lues', async () => {
      notificationService.markAllAsRead.mockResolvedValue();

      await markAllNotificationsAsRead(req, res, next);

      expect(notificationService.markAllAsRead).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('devrait gérer les erreurs', async () => {
      notificationService.markAllAsRead.mockRejectedValue(new Error('Service Error'));

      await markAllNotificationsAsRead(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteNotificationById', () => {
    it('devrait supprimer une notification avec succès', async () => {
      req.params.id = 'notif-1';

      notificationService.deleteNotification.mockResolvedValue();

      await deleteNotificationById(req, res, next);

      expect(notificationService.deleteNotification).toHaveBeenCalledWith('notif-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('devrait gérer les erreurs', async () => {
      req.params.id = 'notif-1';
      notificationService.deleteNotification.mockRejectedValue(new Error('Service Error'));

      await deleteNotificationById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteAll', () => {
    it('devrait supprimer toutes les notifications de l\'utilisateur', async () => {
      notificationService.deleteAllNotifications.mockResolvedValue();

      await deleteAll(req, res, next);

      expect(notificationService.deleteAllNotifications).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('devrait gérer les erreurs', async () => {
      notificationService.deleteAllNotifications.mockRejectedValue(new Error('Service Error'));

      await deleteAll(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteAllRead', () => {
    it('devrait supprimer toutes les notifications lues de l\'utilisateur', async () => {
      notificationService.deleteAllReadNotifications.mockResolvedValue();

      await deleteAllRead(req, res, next);

      expect(notificationService.deleteAllReadNotifications).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('devrait gérer les erreurs', async () => {
      notificationService.deleteAllReadNotifications.mockRejectedValue(new Error('Service Error'));

      await deleteAllRead(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
