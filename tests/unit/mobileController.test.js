// tests/unit/mobileController.test.js

const {
  requestVerificationCode,
  parentRegister,
  verifyAccessCode,
  parentLogin,
  saveParentPin,
  verifyParentPin,
  getRegions,
  getHealthCenters,
  getVaccineCalendar,
  markVaccinesDone,
  getChildDashboard,
  getAdvice,
  getCampaigns,
  getAppointments,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  getCalendar,
  requestChangePinCode,
  changeParentPin,
} = require('../../src/controllers/mobileController');

const prisma = require('../../src/config/prismaClient');
const notificationService = require('../../src/services/notification');
const accessCodeUtils = require('../../src/utils/accessCode');
const tokenService = require('../../src/services/tokenService');
const bcrypt = require('bcryptjs');
const vaccineBucketService = require('../../src/services/vaccineBucketService');
const emailService = require('../../src/services/emailService');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  children: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  healthCenter: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  vaccineCalendar: {
    findMany: jest.fn(),
  },
  childVaccineDue: {
    createMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  childVaccineLate: {
    createMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  childVaccineOverdue: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  childVaccineScheduled: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  childVaccineCompleted: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  region: {
    findMany: jest.fn(),
  },
  advice: {
    findMany: jest.fn(),
  },
  campaign: {
    findMany: jest.fn(),
  },
  notification: {
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  vaccine: {
    findUnique: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => {
    const mockPrisma = require('../../src/config/prismaClient');
    const mockTx = {
      children: mockPrisma.children,
      childVaccineDue: mockPrisma.childVaccineDue,
      childVaccineLate: mockPrisma.childVaccineLate,
      childVaccineOverdue: mockPrisma.childVaccineOverdue,
      childVaccineCompleted: mockPrisma.childVaccineCompleted,
      childVaccineScheduled: mockPrisma.childVaccineScheduled,
      vaccine: mockPrisma.vaccine,
    };
    return callback(mockTx);
  }),
}));

jest.mock('../../src/services/notification', () => ({
  sendParentAccessCode: jest.fn(),
  sendVerificationCode: jest.fn(),
}));

jest.mock('../../src/utils/accessCode', () => ({
  generateAccessCode: jest.fn(),
}));

jest.mock('../../src/services/tokenService', () => ({
  signAccessToken: jest.fn(),
  verifyAccessToken: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('../../src/services/vaccineBucketService', () => ({
  rebuildChildVaccinationBuckets: jest.fn(),
}));

jest.mock('../../src/services/emailService', () => ({
  sendChildAccountActivatedEmail: jest.fn(),
}));

describe('mobileController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('requestVerificationCode', () => {
    it('devrait retourner 400 si champs obligatoires manquants', async () => {
      req.body = {};

      await requestVerificationCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Tous les champs obligatoires doivent être remplis',
      });
    });

    it('devrait créer un enfant et envoyer le code de vérification', async () => {
      req.body = {
        parentPhone: '+261341234567',
        parentEmail: 'parent@test.com',
        childFirstName: 'Jean',
        childLastName: 'Dupont',
        childBirthDate: '2020-01-01',
        childGender: 'M',
        birthPlace: 'Antananarivo',
        fatherName: 'Pierre',
        motherName: 'Marie',
        address: '123 Rue Test',
        healthCenterId: 'hc-1',
      };

      const mockHealthCenter = { id: 'hc-1' };
      const mockChild = {
        id: 'child-1',
        firstName: 'Jean',
        lastName: 'Dupont',
      };

      prisma.healthCenter.findUnique.mockResolvedValue(mockHealthCenter);
      prisma.children.deleteMany.mockResolvedValue({ count: 0 });
      prisma.children.create.mockResolvedValue(mockChild);
      accessCodeUtils.generateAccessCode.mockReturnValue('123456');
      notificationService.sendVerificationCode.mockResolvedValue({ success: true });

      await requestVerificationCode(req, res, next);

      expect(prisma.children.deleteMany).toHaveBeenCalledWith({
        where: {
          phoneParent: '+261341234567',
          code: { startsWith: 'VERIFY_' },
        },
      });
      expect(prisma.children.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Code de vérification envoyé par WhatsApp',
        registrationId: 'child-1',
      });
      expect(notificationService.sendVerificationCode).toHaveBeenCalled();
    });

    it('devrait utiliser le premier centre de santé si healthCenterId non fourni', async () => {
      req.body = {
        parentPhone: '+261341234567',
        childFirstName: 'Jean',
        childLastName: 'Dupont',
        childBirthDate: '2020-01-01',
        childGender: 'M',
        birthPlace: 'Antananarivo',
        fatherName: 'Pierre',
        motherName: 'Marie',
        address: '123 Rue Test',
      };

      const mockHealthCenter = { id: 'hc-default' };
      const mockChild = { id: 'child-1' };

      prisma.healthCenter.findUnique.mockResolvedValue(null);
      prisma.healthCenter.findFirst.mockResolvedValue(mockHealthCenter);
      prisma.children.deleteMany.mockResolvedValue({ count: 0 });
      prisma.children.create.mockResolvedValue(mockChild);
      accessCodeUtils.generateAccessCode.mockReturnValue('123456');
      notificationService.sendVerificationCode.mockResolvedValue({ success: true });

      await requestVerificationCode(req, res, next);

      expect(prisma.healthCenter.findFirst).toHaveBeenCalled();
      expect(prisma.children.create).toHaveBeenCalled();
    });

    it('devrait retourner 400 si aucun centre de santé disponible', async () => {
      req.body = {
        parentPhone: '+261341234567',
        childFirstName: 'Jean',
        childLastName: 'Dupont',
        childBirthDate: '2020-01-01',
        childGender: 'M',
        birthPlace: 'Antananarivo',
        fatherName: 'Pierre',
        motherName: 'Marie',
        address: '123 Rue Test',
      };

      prisma.healthCenter.findUnique.mockResolvedValue(null);
      prisma.healthCenter.findFirst.mockResolvedValue(null);

      await requestVerificationCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Aucun centre de santé disponible. Contactez un agent pour enregistrer votre enfant.',
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.body = {
        parentPhone: '+261341234567',
        childFirstName: 'Jean',
        childLastName: 'Dupont',
        childBirthDate: '2020-01-01',
        childGender: 'M',
        birthPlace: 'Antananarivo',
        fatherName: 'Pierre',
        motherName: 'Marie',
        address: '123 Rue Test',
      };

      prisma.children.deleteMany.mockRejectedValue(new Error('DB Error'));

      await requestVerificationCode(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('parentRegister', () => {
    it('devrait retourner 400 si registrationId ou verificationCode manquants', async () => {
      req.body = {};

      await parentRegister(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'registrationId et verificationCode requis',
      });
    });

    it('devrait retourner 404 si inscription introuvable', async () => {
      req.body = {
        registrationId: 'child-1',
        verificationCode: '123456',
      };

      prisma.children.findUnique.mockResolvedValue(null);

      await parentRegister(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Inscription introuvable ou expirée',
      });
    });

    it('devrait retourner 400 si code de vérification expiré', async () => {
      req.body = {
        registrationId: 'child-1',
        verificationCode: '123456',
      };

      const expiredTime = Date.now() - 11 * 60 * 1000; // 11 minutes ago
      const mockChild = {
        id: 'child-1',
        code: `VERIFY_123456_${expiredTime}`,
        birthDate: new Date('2020-01-01'),
        gender: 'M',
        phoneParent: '+261341234567',
        fatherName: 'Pierre',
        motherName: 'Marie',
        firstName: 'Jean',
        lastName: 'Dupont',
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.children.delete.mockResolvedValue(mockChild);

      await parentRegister(req, res, next);

      expect(prisma.children.delete).toHaveBeenCalledWith({ where: { id: 'child-1' } });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Le code de vérification a expiré. Veuillez recommencer.',
      });
    });

    it('devrait retourner 400 si code de vérification incorrect', async () => {
      req.body = {
        registrationId: 'child-1',
        verificationCode: 'wrong-code',
      };

      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now
      const mockChild = {
        id: 'child-1',
        code: `VERIFY_123456_${expiresAt}`,
        birthDate: new Date('2020-01-01'),
        gender: 'M',
        phoneParent: '+261341234567',
        fatherName: 'Pierre',
        motherName: 'Marie',
        firstName: 'Jean',
        lastName: 'Dupont',
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);

      await parentRegister(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Code de vérification incorrect',
      });
    });

    it('devrait activer le compte avec succès', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      req.body = {
        registrationId: 'child-1',
        verificationCode: '123456',
      };

      const expiresAt = Date.now() + 5 * 60 * 1000;
      const mockChild = {
        id: 'child-1',
        code: `VERIFY_123456_${expiresAt}`,
        birthDate: new Date('2020-01-01'),
        gender: 'M',
        phoneParent: '+261341234567',
        fatherName: 'Pierre',
        motherName: 'Marie',
        firstName: 'Jean',
        lastName: 'Dupont',
        healthCenterId: 'hc-1',
      };

      const mockCalendarEntries = [];
      const mockFullChild = {
        id: 'child-1',
        firstName: 'Jean',
        lastName: 'Dupont',
        gender: 'M',
        birthDate: new Date('2020-01-01'),
        phoneParent: '+261341234567',
        fatherName: 'Pierre',
        motherName: 'Marie',
        healthCenter: {
          name: 'Centre Test',
          district: {
            name: 'District Test',
            commune: {
              region: { name: 'Region Test' },
            },
          },
        },
        dueVaccines: [],
        lateVaccines: [],
        completedVaccines: [],
        scheduledVaccines: [],
        overdueVaccines: [],
      };

      prisma.children.findUnique
        .mockResolvedValueOnce(mockChild)
        .mockResolvedValueOnce(mockFullChild);
      prisma.vaccineCalendar.findMany.mockResolvedValue(mockCalendarEntries);
      prisma.children.update.mockResolvedValue({ id: 'child-1', code: 'ACCESS123' });
      accessCodeUtils.generateAccessCode.mockReturnValue('ACCESS123');
      tokenService.signAccessToken.mockReturnValue('jwt-token');
      notificationService.sendParentAccessCode.mockResolvedValue({ success: true });
      prisma.user.findMany.mockResolvedValue([]); // Pas d'agents pour éviter l'erreur email

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          children: {
            update: jest.fn().mockResolvedValue({ id: 'child-1', code: 'ACCESS123' }),
          },
          childVaccineDue: {
            createMany: jest.fn(),
          },
          childVaccineLate: {
            createMany: jest.fn(),
          },
        };
        return callback(mockTx);
      });

      await parentRegister(req, res, next);
      
      consoleErrorSpy.mockRestore();

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'jwt-token',
        isActive: true,
        hasVaccinesToSelect: false,
        child: expect.objectContaining({
          id: 'child-1',
          firstName: 'Jean',
        }),
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.body = {
        registrationId: 'child-1',
        verificationCode: '123456',
      };

      prisma.children.findUnique.mockRejectedValue(new Error('DB Error'));

      await parentRegister(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('verifyAccessCode', () => {
    it('devrait retourner 400 si phone ou accessCode manquants', async () => {
      req.body = {};

      await verifyAccessCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Numéro de téléphone et code d\'accès requis',
      });
    });

    it('devrait retourner 401 si code d\'accès invalide', async () => {
      req.body = {
        phone: '+261341234567',
        accessCode: 'wrong-code',
      };

      prisma.children.findFirst.mockResolvedValue(null);

      await verifyAccessCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Code d\'accès invalide',
      });
    });

    it('devrait retourner un token si code valide', async () => {
      req.body = {
        phone: '+261341234567',
        accessCode: 'ACCESS123',
      };

      const mockChild = {
        id: 'child-1',
        firstName: 'Jean',
        lastName: 'Dupont',
        gender: 'M',
        birthDate: new Date('2020-01-01'),
        phoneParent: '+261341234567',
        fatherName: 'Pierre',
        motherName: 'Marie',
        passwordParent: '0000',
        healthCenter: {
          name: 'Centre Test',
          district: {
            name: 'District Test',
            commune: {
              region: { name: 'Region Test' },
            },
          },
        },
      };

      prisma.children.findFirst.mockResolvedValue(mockChild);
      tokenService.signAccessToken.mockReturnValue('jwt-token');

      await verifyAccessCode(req, res, next);

      expect(tokenService.signAccessToken).toHaveBeenCalledWith({
        sub: 'child-1',
        type: 'parent',
        phone: '+261341234567',
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'jwt-token',
        hasPin: false,
        child: expect.objectContaining({
          id: 'child-1',
        }),
      });
    });

    it('devrait indiquer hasPin: true si PIN configuré', async () => {
      req.body = {
        phone: '+261341234567',
        accessCode: 'ACCESS123',
      };

      const mockChild = {
        id: 'child-1',
        firstName: 'Jean',
        lastName: 'Dupont',
        gender: 'M',
        birthDate: new Date('2020-01-01'),
        phoneParent: '+261341234567',
        fatherName: 'Pierre',
        motherName: 'Marie',
        passwordParent: 'hashed-pin',
        healthCenter: {
          name: 'Centre Test',
          district: {
            name: 'District Test',
            commune: {
              region: { name: 'Region Test' },
            },
          },
        },
      };

      prisma.children.findFirst.mockResolvedValue(mockChild);
      tokenService.signAccessToken.mockReturnValue('jwt-token');

      await verifyAccessCode(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          hasPin: true,
        })
      );
    });

    it('devrait gérer les erreurs', async () => {
      req.body = {
        phone: '+261341234567',
        accessCode: 'ACCESS123',
      };

      prisma.children.findFirst.mockRejectedValue(new Error('DB Error'));

      await verifyAccessCode(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('parentLogin', () => {
    it('devrait retourner 400 si phone ou pin manquants', async () => {
      req.body = {};

      await parentLogin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Numéro de téléphone et PIN requis',
      });
    });

    it('devrait retourner 401 si aucun compte trouvé', async () => {
      req.body = {
        phone: '+261341234567',
        pin: '1234',
      };

      prisma.children.findMany.mockResolvedValue([]);

      await parentLogin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Aucun compte trouvé avec ce numéro de téléphone',
      });
    });

    it('devrait retourner 401 si PIN incorrect', async () => {
      req.body = {
        phone: '+261341234567',
        pin: 'wrong-pin',
      };

      const mockChild = {
        id: 'child-1',
        firstName: 'Jean',
        lastName: 'Dupont',
        passwordParent: 'hashed-pin',
      };

      prisma.children.findMany.mockResolvedValue([mockChild]);
      bcrypt.compare.mockResolvedValue(false);

      await parentLogin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'PIN incorrect',
      });
    });

    it('devrait retourner un token si un seul enfant avec PIN valide', async () => {
      req.body = {
        phone: '+261341234567',
        pin: '1234',
      };

      const mockChild = {
        id: 'child-1',
        firstName: 'Jean',
        lastName: 'Dupont',
        gender: 'M',
        birthDate: new Date('2020-01-01'),
        phoneParent: '+261341234567',
        fatherName: 'Pierre',
        motherName: 'Marie',
        passwordParent: 'hashed-pin',
        healthCenter: {
          name: 'Centre Test',
          district: {
            name: 'District Test',
            commune: {
              region: { name: 'Region Test' },
            },
          },
        },
      };

      prisma.children.findMany.mockResolvedValue([mockChild]);
      bcrypt.compare.mockResolvedValue(true);
      tokenService.signAccessToken.mockReturnValue('jwt-token');

      await parentLogin(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'jwt-token',
        child: expect.objectContaining({
          id: 'child-1',
        }),
        children: null,
      });
    });

    it('devrait retourner la liste des enfants si plusieurs enfants avec même PIN', async () => {
      req.body = {
        phone: '+261341234567',
        pin: '1234',
      };

      const mockChildren = [
        {
          id: 'child-1',
          firstName: 'Jean',
          lastName: 'Dupont',
          gender: 'M',
          birthDate: new Date('2020-01-01'),
          phoneParent: '+261341234567',
          fatherName: 'Pierre',
          motherName: 'Marie',
          passwordParent: 'hashed-pin',
          healthCenter: {
            name: 'Centre Test',
            district: {
              name: 'District Test',
              commune: {
                region: { name: 'Region Test' },
              },
            },
          },
        },
        {
          id: 'child-2',
          firstName: 'Marie',
          lastName: 'Dupont',
          gender: 'F',
          birthDate: new Date('2021-01-01'),
          phoneParent: '+261341234567',
          fatherName: 'Pierre',
          motherName: 'Marie',
          passwordParent: 'hashed-pin',
          healthCenter: {
            name: 'Centre Test',
            district: {
              name: 'District Test',
              commune: {
                region: { name: 'Region Test' },
              },
            },
          },
        },
      ];

      prisma.children.findMany.mockResolvedValue(mockChildren);
      bcrypt.compare.mockResolvedValue(true);
      tokenService.signAccessToken.mockReturnValue('jwt-token');

      await parentLogin(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'jwt-token',
        children: expect.arrayContaining([
          expect.objectContaining({ id: 'child-1' }),
          expect.objectContaining({ id: 'child-2' }),
        ]),
        child: null,
      });
    });

    it('devrait ignorer les enfants sans PIN configuré', async () => {
      req.body = {
        phone: '+261341234567',
        pin: '1234',
      };

      const mockChildren = [
        {
          id: 'child-1',
          passwordParent: '0000', // PIN par défaut
        },
        {
          id: 'child-2',
          passwordParent: 'hashed-pin',
          firstName: 'Marie',
          lastName: 'Dupont',
          gender: 'F',
          birthDate: new Date('2021-01-01'),
          phoneParent: '+261341234567',
          fatherName: 'Pierre',
          motherName: 'Marie',
          healthCenter: {
            name: 'Centre Test',
            district: {
              name: 'District Test',
              commune: {
                region: { name: 'Region Test' },
              },
            },
          },
        },
      ];

      prisma.children.findMany.mockResolvedValue(mockChildren);
      bcrypt.compare.mockResolvedValue(true);
      tokenService.signAccessToken.mockReturnValue('jwt-token');

      await parentLogin(req, res, next);

      expect(bcrypt.compare).toHaveBeenCalledTimes(1); // Seulement pour child-2
    });

    it('devrait gérer les erreurs', async () => {
      req.body = {
        phone: '+261341234567',
        pin: '1234',
      };

      prisma.children.findMany.mockRejectedValue(new Error('DB Error'));

      await parentLogin(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('saveParentPin', () => {
    it('devrait retourner 400 si champs manquants ou PIN invalide', async () => {
      req.body = {};

      await saveParentPin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'childId, parentPhone et PIN (4 chiffres) requis',
      });
    });

    it('devrait retourner 400 si PIN n\'a pas 4 chiffres', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        pin: '123', // 3 chiffres
      };

      await saveParentPin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 404 si enfant non trouvé', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        pin: '1234',
      };

      prisma.children.findUnique.mockResolvedValue(null);

      await saveParentPin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Enfant non trouvé',
      });
    });

    it('devrait sauvegarder le PIN avec succès', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        pin: '1234',
      };

      const mockChild = {
        id: 'child-1',
        phoneParent: '+261341234567',
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      bcrypt.hash.mockResolvedValue('hashed-pin');
      prisma.children.update.mockResolvedValue(mockChild);

      await saveParentPin(req, res, next);

      expect(bcrypt.hash).toHaveBeenCalledWith('1234', 10);
      expect(prisma.children.update).toHaveBeenCalledWith({
        where: { id: 'child-1' },
        data: {
          passwordParent: 'hashed-pin',
          code: null,
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'PIN sauvegardé avec succès',
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        pin: '1234',
      };

      prisma.children.findUnique.mockRejectedValue(new Error('DB Error'));

      await saveParentPin(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('verifyParentPin', () => {
    it('devrait retourner 400 si champs manquants', async () => {
      req.body = {};

      await verifyParentPin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'childId, parentPhone et PIN requis',
      });
    });

    it('devrait retourner 404 si enfant non trouvé', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        pin: '1234',
      };

      prisma.children.findUnique.mockResolvedValue(null);

      await verifyParentPin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('devrait retourner 401 si PIN non configuré', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        pin: '1234',
      };

      const mockChild = {
        id: 'child-1',
        phoneParent: '+261341234567',
        passwordParent: '0000',
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);

      await verifyParentPin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'PIN non configuré',
      });
    });

    it('devrait retourner 401 si PIN incorrect', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        pin: 'wrong-pin',
      };

      const mockChild = {
        id: 'child-1',
        phoneParent: '+261341234567',
        passwordParent: 'hashed-pin',
        firstName: 'Jean',
        lastName: 'Dupont',
        gender: 'M',
        birthDate: new Date('2020-01-01'),
        fatherName: 'Pierre',
        motherName: 'Marie',
        healthCenter: {
          name: 'Centre Test',
          district: {
            name: 'District Test',
            commune: {
              region: { name: 'Region Test' },
            },
          },
        },
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      bcrypt.compare.mockResolvedValue(false);

      await verifyParentPin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'PIN incorrect',
      });
    });

    it('devrait retourner un token si PIN valide', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        pin: '1234',
      };

      const mockChild = {
        id: 'child-1',
        phoneParent: '+261341234567',
        passwordParent: 'hashed-pin',
        firstName: 'Jean',
        lastName: 'Dupont',
        gender: 'M',
        birthDate: new Date('2020-01-01'),
        fatherName: 'Pierre',
        motherName: 'Marie',
        healthCenter: {
          name: 'Centre Test',
          district: {
            name: 'District Test',
            commune: {
              region: { name: 'Region Test' },
            },
          },
        },
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      bcrypt.compare.mockResolvedValue(true);
      tokenService.signAccessToken.mockReturnValue('jwt-token');

      await verifyParentPin(req, res, next);

      expect(tokenService.signAccessToken).toHaveBeenCalledWith({
        sub: 'child-1',
        type: 'parent',
        phone: '+261341234567',
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'jwt-token',
        child: expect.objectContaining({
          id: 'child-1',
        }),
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        pin: '1234',
      };

      prisma.children.findUnique.mockRejectedValue(new Error('DB Error'));

      await verifyParentPin(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getRegions', () => {
    it('devrait retourner la liste des régions', async () => {
      const mockRegions = [
        { id: 'region-1', name: 'Region 1' },
        { id: 'region-2', name: 'Region 2' },
      ];

      prisma.region.findMany.mockResolvedValue(mockRegions);

      await getRegions(req, res, next);

      expect(prisma.region.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        total: 2,
        items: mockRegions,
      });
    });

    it('devrait gérer les erreurs', async () => {
      prisma.region.findMany.mockRejectedValue(new Error('DB Error'));

      await getRegions(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getHealthCenters', () => {
    it('devrait retourner tous les centres de santé si regionId non fourni', async () => {
      const mockCenters = [
        {
          id: 'hc-1',
          name: 'Centre 1',
          address: 'Address 1',
          district: {
            id: 'dist-1',
            name: 'District 1',
            commune: {
              id: 'commune-1',
              name: 'Commune 1',
              region: {
                id: 'region-1',
                name: 'Region 1',
              },
            },
          },
        },
      ];

      prisma.healthCenter.findMany.mockResolvedValue(mockCenters);

      await getHealthCenters(req, res, next);

      expect(prisma.healthCenter.findMany).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        total: 1,
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'hc-1',
            name: 'Centre 1',
          }),
        ]),
      });
    });

    it('devrait filtrer par regionId si fourni', async () => {
      req.query = { regionId: 'region-1' };

      const mockCenters = [
        {
          id: 'hc-1',
          name: 'Centre 1',
          address: 'Address 1',
          district: {
            id: 'dist-1',
            name: 'District 1',
            commune: {
              id: 'commune-1',
              name: 'Commune 1',
              region: {
                id: 'region-1',
                name: 'Region 1',
              },
            },
          },
        },
      ];

      prisma.healthCenter.findMany.mockResolvedValue(mockCenters);

      await getHealthCenters(req, res, next);

      expect(prisma.healthCenter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            district: expect.objectContaining({
              commune: expect.objectContaining({
                regionId: 'region-1',
              }),
            }),
          }),
        })
      );
    });

    it('devrait gérer les erreurs', async () => {
      prisma.healthCenter.findMany.mockRejectedValue(new Error('DB Error'));

      await getHealthCenters(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getVaccineCalendar', () => {
    it('devrait retourner le calendrier vaccinal sans filtre de genre', async () => {
      const mockCalendars = [
        {
          id: 'cal-1',
          description: 'Calendrier test',
          ageUnit: 'WEEKS',
          specificAge: 6,
          minAge: 0,
          maxAge: 12,
          doseAssignments: [
            {
              doseNumber: 1,
              vaccine: {
                id: 'vac-1',
                name: 'Vaccin 1',
                dosesRequired: '2',
                gender: null,
              },
            },
          ],
        },
      ];

      prisma.vaccineCalendar.findMany.mockResolvedValue(mockCalendars);

      await getVaccineCalendar(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'cal-1',
            description: 'Calendrier test',
          }),
        ])
      );
    });

    it('devrait filtrer par genre si childId fourni', async () => {
      req.query = { childId: 'child-1' };

      const mockChild = {
        gender: 'M',
      };

      const mockCalendars = [
        {
          id: 'cal-1',
          description: 'Calendrier test',
          ageUnit: 'WEEKS',
          specificAge: 6,
          minAge: 0,
          maxAge: 12,
          doseAssignments: [
            {
              doseNumber: 1,
              vaccine: {
                id: 'vac-1',
                name: 'Vaccin 1',
                dosesRequired: '2',
                gender: 'M', // Correspond au genre de l'enfant
              },
            },
            {
              doseNumber: 1,
              vaccine: {
                id: 'vac-2',
                name: 'Vaccin 2',
                dosesRequired: '1',
                gender: 'F', // Ne correspond pas
              },
            },
          ],
        },
      ];

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.vaccineCalendar.findMany.mockResolvedValue(mockCalendars);

      await getVaccineCalendar(req, res, next);

      expect(prisma.children.findUnique).toHaveBeenCalledWith({
        where: { id: 'child-1' },
        select: { gender: true },
      });
    });

    it('devrait gérer les erreurs', async () => {
      prisma.vaccineCalendar.findMany.mockRejectedValue(new Error('DB Error'));

      await getVaccineCalendar(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('markVaccinesDone', () => {
    it('devrait retourner 400 si vaccines n\'est pas un tableau', async () => {
      req.params = { childId: 'child-1' };
      req.body = { vaccines: 'not-an-array' };

      await markVaccinesDone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'vaccines doit être un tableau',
      });
    });

    it('devrait retourner 404 si enfant non trouvé', async () => {
      req.params = { childId: 'child-1' };
      req.body = { vaccines: [] };

      prisma.children.findUnique.mockResolvedValue(null);

      await markVaccinesDone(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Enfant non trouvé',
      });
    });

    it('devrait marquer les vaccins comme effectués avec succès', async () => {
      req.params = { childId: 'child-1' };
      req.body = {
        vaccines: [
          {
            vaccineId: 'vac-1',
            vaccineCalendarId: 'cal-1',
            administeredAt: '2024-01-01',
          },
        ],
      };

      const mockChild = {
        id: 'child-1',
        gender: 'M',
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      vaccineBucketService.rebuildChildVaccinationBuckets.mockResolvedValue();

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          vaccine: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'vac-1',
              gender: null,
              dosesRequired: '2',
            }),
          },
          childVaccineDue: {
            findFirst: jest.fn().mockResolvedValue({ dose: 1 }),
            deleteMany: jest.fn(),
          },
          childVaccineLate: {
            findFirst: jest.fn().mockResolvedValue(null),
            deleteMany: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
          },
          childVaccineOverdue: {
            findFirst: jest.fn().mockResolvedValue(null),
            deleteMany: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
          },
          childVaccineScheduled: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          childVaccineCompleted: {
            create: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
            findFirst: jest.fn().mockResolvedValue(null),
          },
          children: {
            update: jest.fn(),
          },
        };
        const result = await callback(mockTx);
        // rebuildChildVaccinationBuckets est appelé après la transaction
        await vaccineBucketService.rebuildChildVaccinationBuckets('child-1', mockTx);
        return result;
      });

      await markVaccinesDone(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(vaccineBucketService.rebuildChildVaccinationBuckets).toHaveBeenCalledWith('child-1', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Vaccins marqués comme effectués',
        isActive: true,
      });
    });

    it('devrait ignorer les vaccins qui ne correspondent pas au genre', async () => {
      req.params = { childId: 'child-1' };
      req.body = {
        vaccines: [
          {
            vaccineId: 'vac-1',
            vaccineCalendarId: 'cal-1',
          },
        ],
      };

      const mockChild = {
        id: 'child-1',
        gender: 'M',
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          vaccine: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'vac-1',
              gender: 'F', // Ne correspond pas au genre M
              dosesRequired: '2',
            }),
          },
          childVaccineDue: {
            findFirst: jest.fn(),
          },
          childVaccineLate: {
            findFirst: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
          },
          childVaccineOverdue: {
            findFirst: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
          },
          childVaccineScheduled: {
            findFirst: jest.fn(),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(0),
            findFirst: jest.fn(),
          },
          children: {
            update: jest.fn(),
          },
        };
        const result = await callback(mockTx);
        // rebuildChildVaccinationBuckets est appelé après la transaction
        await vaccineBucketService.rebuildChildVaccinationBuckets('child-1', mockTx);
        return result;
      });

      await markVaccinesDone(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Vaccins marqués comme effectués',
        isActive: true,
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.params = { childId: 'child-1' };
      req.body = { vaccines: [] };

      prisma.children.findUnique.mockRejectedValue(new Error('DB Error'));

      await markVaccinesDone(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getChildDashboard', () => {
    it('devrait retourner 404 si enfant non trouvé', async () => {
      req.params = { childId: 'child-1' };

      prisma.children.findUnique.mockResolvedValue(null);

      await getChildDashboard(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Enfant non trouvé',
      });
    });

    it('devrait retourner le dashboard complet', async () => {
      req.params = { childId: 'child-1' };

      const mockChild = {
        id: 'child-1',
        firstName: 'Jean',
        lastName: 'Dupont',
        gender: 'M',
        birthDate: new Date('2020-01-01'),
        birthPlace: 'Antananarivo',
        address: '123 Rue Test',
        status: 'A_JOUR',
        fatherName: 'Pierre',
        motherName: 'Marie',
        phoneParent: '+261341234567',
        nextAppointment: new Date('2024-12-31'),
        isActive: true,
        photosRequested: false,
        healthCenter: {
          id: 'hc-1',
          name: 'Centre Test',
          address: 'Address Test',
          district: {
            id: 'dist-1',
            name: 'District Test',
            commune: {
              id: 'commune-1',
              name: 'Commune Test',
              region: {
                id: 'region-1',
                name: 'Region Test',
              },
            },
          },
        },
        dueVaccines: [],
        scheduledVaccines: [],
        lateVaccines: [],
        overdueVaccines: [],
        completedVaccines: [],
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.notification.count.mockResolvedValue(5);

      await getChildDashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        child: expect.objectContaining({
          id: 'child-1',
          firstName: 'Jean',
        }),
        vaccinations: {
          due: [],
          scheduled: [],
          late: [],
          overdue: [],
          completed: [],
        },
        stats: {
          totalDue: 0,
          totalScheduled: 0,
          totalLate: 0,
          totalOverdue: 0,
          totalCompleted: 0,
        },
        unreadNotifications: 5,
      });
    });

    it('devrait calculer correctement l\'âge de l\'enfant', async () => {
      req.params = { childId: 'child-1' };

      const birthDate = new Date('2020-01-01');
      const mockChild = {
        id: 'child-1',
        firstName: 'Jean',
        lastName: 'Dupont',
        gender: 'M',
        birthDate,
        birthPlace: 'Antananarivo',
        address: '123 Rue Test',
        status: 'A_JOUR',
        fatherName: 'Pierre',
        motherName: 'Marie',
        phoneParent: '+261341234567',
        nextAppointment: null,
        isActive: true,
        photosRequested: false,
        healthCenter: {
          id: 'hc-1',
          name: 'Centre Test',
          address: 'Address Test',
          district: {
            id: 'dist-1',
            name: 'District Test',
            commune: {
              id: 'commune-1',
              name: 'Commune Test',
              region: {
                id: 'region-1',
                name: 'Region Test',
              },
            },
          },
        },
        dueVaccines: [],
        scheduledVaccines: [],
        lateVaccines: [],
        overdueVaccines: [],
        completedVaccines: [],
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.notification.count.mockResolvedValue(0);

      await getChildDashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          child: expect.objectContaining({
            age: expect.objectContaining({
              days: expect.any(Number),
              weeks: expect.any(Number),
              months: expect.any(Number),
              years: expect.any(Number),
            }),
          }),
        })
      );
    });

    it('devrait gérer les erreurs', async () => {
      req.params = { childId: 'child-1' };

      prisma.children.findUnique.mockRejectedValue(new Error('DB Error'));

      await getChildDashboard(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getAdvice', () => {
    it('devrait retourner tous les conseils actifs si childId non fourni', async () => {
      const mockAdvice = [
        {
          id: 'advice-1',
          title: 'Conseil 1',
          content: 'Contenu 1',
          category: 'santé',
          ageUnit: null,
          minAge: null,
          maxAge: null,
          specificAge: null,
          createdAt: new Date(),
        },
      ];

      prisma.advice.findMany.mockResolvedValue(mockAdvice);

      await getAdvice(req, res, next);

      expect(prisma.advice.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
        },
        orderBy: expect.any(Array),
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        total: 1,
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'advice-1',
            title: 'Conseil 1',
          }),
        ]),
      });
    });

    it('devrait filtrer par âge si childId fourni', async () => {
      req.query = { childId: 'child-1' };

      const mockChild = {
        birthDate: new Date('2020-01-01'),
      };

      const mockAdvice = [
        {
          id: 'advice-1',
          title: 'Conseil pour 6 semaines',
          content: 'Contenu',
          category: 'santé',
          ageUnit: 'WEEKS',
          specificAge: 6,
          minAge: null,
          maxAge: null,
          createdAt: new Date(),
        },
      ];

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.advice.findMany.mockResolvedValue(mockAdvice);

      await getAdvice(req, res, next);

      expect(prisma.children.findUnique).toHaveBeenCalledWith({
        where: { id: 'child-1' },
        select: { birthDate: true },
      });
      expect(prisma.advice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.any(Array),
          }),
        })
      );
    });

    it('devrait gérer les erreurs', async () => {
      prisma.advice.findMany.mockRejectedValue(new Error('DB Error'));

      await getAdvice(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getCampaigns', () => {
    it('devrait retourner toutes les campagnes', async () => {
      const mockCampaigns = [
        {
          id: 'campaign-1',
          title: 'Campagne 1',
          description: 'Description 1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          region: {
            id: 'region-1',
            name: 'Region 1',
          },
          medias: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.campaign.findMany.mockResolvedValue(mockCampaigns);

      await getCampaigns(req, res, next);

      expect(prisma.campaign.findMany).toHaveBeenCalledWith({
        include: expect.objectContaining({
          region: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              name: true,
            }),
          }),
        }),
        orderBy: {
          startDate: 'desc',
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        total: 1,
        campaigns: expect.arrayContaining([
          expect.objectContaining({
            id: 'campaign-1',
            title: 'Campagne 1',
          }),
        ]),
      });
    });

    it('devrait gérer les erreurs', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      prisma.campaign.findMany.mockRejectedValue(new Error('DB Error'));

      await getCampaigns(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getAppointments', () => {
    it('devrait retourner les rendez-vous programmés', async () => {
      req.params = { childId: 'child-1' };

      const mockScheduled = [
        {
          id: 'scheduled-1',
          vaccineId: 'vac-1',
          scheduledFor: new Date('2024-12-31'),
          dose: 1,
          vaccine: {
            id: 'vac-1',
            name: 'Vaccin 1',
          },
          planner: {
            id: 'user-1',
            firstName: 'Agent',
            lastName: 'Test',
          },
        },
      ];

      prisma.childVaccineScheduled.findMany.mockResolvedValue(mockScheduled);

      await getAppointments(req, res, next);

      expect(prisma.childVaccineScheduled.findMany).toHaveBeenCalledWith({
        where: {
          childId: 'child-1',
        },
        include: expect.objectContaining({
          vaccine: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              name: true,
            }),
          }),
        }),
        orderBy: {
          scheduledFor: 'asc',
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        total: 1,
        appointments: expect.arrayContaining([
          expect.objectContaining({
            id: 'scheduled-1',
            vaccineName: 'Vaccin 1',
            status: 'scheduled',
          }),
        ]),
      });
    });

    it('devrait gérer les erreurs', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      req.params = { childId: 'child-1' };

      prisma.childVaccineScheduled.findMany.mockRejectedValue(new Error('DB Error'));

      await getAppointments(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getNotifications', () => {
    it('devrait retourner 400 si childId manquant', async () => {
      req.params = {};
      req.childId = null;

      await getNotifications(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'childId requis',
      });
    });

    it('devrait retourner les notifications', async () => {
      req.params = { childId: 'child-1' };
      req.childId = 'child-1';

      const mockNotifications = [
        {
          id: 'notif-1',
          title: 'Notification 1',
          message: 'Message 1',
          type: 'VACCINE_SCHEDULED',
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.notification.findMany.mockResolvedValue(mockNotifications);

      await getNotifications(req, res, next);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          childId: 'child-1',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        total: 1,
        notifications: expect.arrayContaining([
          expect.objectContaining({
            id: 'notif-1',
            title: 'Notification 1',
            read: false,
          }),
        ]),
      });
    });

    it('devrait utiliser req.childId du middleware si disponible', async () => {
      req.params = { childId: 'child-other' };
      req.childId = 'child-1'; // Du middleware

      const mockNotifications = [
        {
          id: 'notif-1',
          title: 'Notification 1',
          message: 'Message 1',
          type: 'VACCINE_SCHEDULED',
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.notification.findMany.mockResolvedValue(mockNotifications);

      await getNotifications(req, res, next);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          childId: 'child-1', // Utilise req.childId du middleware
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('devrait gérer les erreurs avec gestion personnalisée', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      req.params = { childId: 'child-1' };
      req.childId = 'child-1';

      prisma.notification.findMany.mockRejectedValue(new Error('DB Error'));

      await getNotifications(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Erreur lors de la récupération des notifications',
        })
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getUnreadNotificationCount', () => {
    it('devrait retourner 400 si childId manquant', async () => {
      req.params = {};
      req.childId = null;

      await getUnreadNotificationCount(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'childId requis',
      });
    });

    it('devrait retourner le nombre de notifications non lues', async () => {
      req.params = { childId: 'child-1' };
      req.childId = 'child-1';

      prisma.notification.count.mockResolvedValue(5);

      await getUnreadNotificationCount(req, res, next);

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: {
          childId: 'child-1',
          isRead: false,
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 5,
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.params = { childId: 'child-1' };
      req.childId = 'child-1';

      prisma.notification.count.mockRejectedValue(new Error('DB Error'));

      await getUnreadNotificationCount(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('devrait retourner 400 si childId manquant', async () => {
      req.params = {};
      req.childId = null;

      await markAllNotificationsAsRead(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'childId requis',
      });
    });

    it('devrait marquer toutes les notifications comme lues', async () => {
      req.params = { childId: 'child-1' };
      req.childId = 'child-1';

      prisma.notification.updateMany.mockResolvedValue({ count: 3 });

      await markAllNotificationsAsRead(req, res, next);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          childId: 'child-1',
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '3 notification(s) marquée(s) comme lue(s)',
        count: 3,
      });
    });

    it('devrait gérer les erreurs', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      req.params = { childId: 'child-1' };
      req.childId = 'child-1';

      prisma.notification.updateMany.mockRejectedValue(new Error('DB Error'));

      await markAllNotificationsAsRead(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getCalendar', () => {
    it('devrait retourner 404 si enfant non trouvé', async () => {
      req.params = { childId: 'child-1' };

      prisma.children.findUnique.mockResolvedValue(null);

      await getCalendar(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Enfant non trouvé',
      });
    });

    it('devrait retourner le calendrier fusionné', async () => {
      req.params = { childId: 'child-1' };

      const mockChild = {
        id: 'child-1',
        healthCenter: {
          name: 'Centre Test',
          district: {
            name: 'District Test',
            commune: {
              region: { name: 'Region Test' },
            },
          },
        },
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);

      const mockCompleted = [];
      const mockScheduled = [];
      const mockOverdue = [];
      const mockDue = [];

      prisma.childVaccineCompleted.findMany = jest.fn().mockResolvedValue(mockCompleted);
      prisma.childVaccineScheduled.findMany = jest.fn().mockResolvedValue(mockScheduled);
      prisma.childVaccineOverdue.findMany = jest.fn().mockResolvedValue(mockOverdue);
      prisma.childVaccineDue.findMany = jest.fn().mockResolvedValue(mockDue);

      await getCalendar(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        total: 0,
        merged: [],
      });
    });

    it('devrait fusionner tous les types de vaccins', async () => {
      req.params = { childId: 'child-1' };

      const mockChild = {
        id: 'child-1',
        healthCenter: {
          name: 'Centre Test',
          district: {
            name: 'District Test',
            commune: {
              region: { name: 'Region Test' },
            },
          },
        },
      };

      const mockCompleted = [
        {
          id: 'completed-1',
          vaccineId: 'vac-1',
          administeredAt: new Date('2024-01-01'),
          vaccine: { id: 'vac-1', name: 'Vaccin 1' },
          vaccineCalendar: {
            id: 'cal-1',
            description: 'Calendrier 1',
            ageUnit: 'WEEKS',
            specificAge: 6,
            minAge: 0,
            maxAge: 12,
          },
        },
      ];

      const mockScheduled = [
        {
          id: 'scheduled-1',
          vaccineId: 'vac-2',
          scheduledFor: new Date('2024-12-31'),
          vaccine: { id: 'vac-2', name: 'Vaccin 2' },
          vaccineCalendar: {
            id: 'cal-2',
            description: 'Calendrier 2',
            ageUnit: 'MONTHS',
            specificAge: 2,
            minAge: 0,
            maxAge: 6,
          },
        },
      ];

      const mockOverdue = [
        {
          id: 'overdue-1',
          vaccineId: 'vac-3',
          dueDate: new Date('2023-12-31'),
          vaccine: { id: 'vac-3', name: 'Vaccin 3' },
          vaccineCalendar: {
            id: 'cal-3',
            description: 'Calendrier 3',
            ageUnit: 'YEARS',
            specificAge: 1,
            minAge: 0,
            maxAge: 2,
          },
        },
      ];

      const mockDue = [
        {
          id: 'due-1',
          vaccineId: 'vac-4',
          scheduledFor: new Date('2025-01-01'),
          vaccine: { id: 'vac-4', name: 'Vaccin 4' },
          vaccineCalendar: {
            id: 'cal-4',
            description: 'Calendrier 4',
            ageUnit: 'WEEKS',
            specificAge: 12,
            minAge: 0,
            maxAge: 24,
          },
        },
      ];

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.childVaccineCompleted.findMany = jest.fn().mockResolvedValue(mockCompleted);
      prisma.childVaccineScheduled.findMany = jest.fn().mockResolvedValue(mockScheduled);
      prisma.childVaccineOverdue.findMany = jest.fn().mockResolvedValue(mockOverdue);
      prisma.childVaccineDue.findMany = jest.fn().mockResolvedValue(mockDue);

      await getCalendar(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        total: 4,
        merged: expect.arrayContaining([
          expect.objectContaining({
            id: 'completed-1',
            status: 'done',
            name: 'Vaccin 1',
          }),
          expect.objectContaining({
            id: 'scheduled-1',
            status: 'scheduled',
            name: 'Vaccin 2',
          }),
          expect.objectContaining({
            id: 'overdue-1',
            status: 'missed',
            name: 'Vaccin 3',
          }),
          expect.objectContaining({
            id: 'due-1',
            status: 'due',
            name: 'Vaccin 4',
          }),
        ]),
      });
    });

    it('devrait gérer les erreurs', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      req.params = { childId: 'child-1' };

      prisma.children.findUnique.mockRejectedValue(new Error('DB Error'));

      await getCalendar(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('requestChangePinCode', () => {
    it('devrait retourner 400 si champs manquants', async () => {
      req.body = {};

      await requestChangePinCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'childId, parentPhone et oldPin requis',
      });
    });

    it('devrait retourner 404 si enfant non trouvé', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        oldPin: '1234',
      };

      prisma.children.findUnique.mockResolvedValue(null);

      await requestChangePinCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Enfant non trouvé',
      });
    });

    it('devrait retourner 401 si PIN non configuré', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        oldPin: '1234',
      };

      const mockChild = {
        id: 'child-1',
        phoneParent: '+261341234567',
        passwordParent: '0000',
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);

      await requestChangePinCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'PIN non configuré',
      });
    });

    it('devrait retourner 401 si ancien PIN incorrect', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        oldPin: 'wrong-pin',
      };

      const mockChild = {
        id: 'child-1',
        phoneParent: '+261341234567',
        passwordParent: 'hashed-pin',
        fatherName: 'Pierre',
        motherName: 'Marie',
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      bcrypt.compare.mockResolvedValue(false);

      await requestChangePinCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Ancien PIN incorrect',
      });
    });

    it('devrait envoyer le code de vérification avec succès', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        oldPin: '1234',
      };

      const mockChild = {
        id: 'child-1',
        phoneParent: '+261341234567',
        passwordParent: 'hashed-pin',
        fatherName: 'Pierre',
        motherName: 'Marie',
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      bcrypt.compare.mockResolvedValue(true);
      accessCodeUtils.generateAccessCode.mockReturnValue('654321');
      prisma.children.update.mockResolvedValue(mockChild);
      notificationService.sendVerificationCode.mockResolvedValue({ success: true });

      await requestChangePinCode(req, res, next);

      expect(bcrypt.compare).toHaveBeenCalledWith('1234', 'hashed-pin');
      expect(accessCodeUtils.generateAccessCode).toHaveBeenCalledWith(6);
      expect(prisma.children.update).toHaveBeenCalledWith({
        where: { id: 'child-1' },
        data: expect.objectContaining({
          code: expect.stringContaining('CHANGE_PIN_654321_'),
        }),
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Code de vérification envoyé par WhatsApp',
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        oldPin: '1234',
      };

      prisma.children.findUnique.mockRejectedValue(new Error('DB Error'));

      await requestChangePinCode(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('changeParentPin', () => {
    it('devrait retourner 400 si champs manquants ou PIN invalide', async () => {
      req.body = {};

      await changeParentPin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'childId, parentPhone, verificationCode et newPin (4 chiffres) requis',
      });
    });

    it('devrait retourner 400 si PIN n\'a pas 4 chiffres', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        verificationCode: '654321',
        newPin: '123', // 3 chiffres
      };

      await changeParentPin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 404 si enfant non trouvé', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        verificationCode: '654321',
        newPin: '5678',
      };

      prisma.children.findUnique.mockResolvedValue(null);

      await changeParentPin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Enfant non trouvé',
      });
    });

    it('devrait retourner 400 si aucune demande de changement en cours', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        verificationCode: '654321',
        newPin: '5678',
      };

      const mockChild = {
        id: 'child-1',
        phoneParent: '+261341234567',
        code: null, // Pas de code CHANGE_PIN
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);

      await changeParentPin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Aucune demande de changement de PIN en cours',
      });
    });

    it('devrait retourner 401 si code de vérification incorrect', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        verificationCode: 'wrong-code',
        newPin: '5678',
      };

      const expiresAt = Date.now() + 5 * 60 * 1000;
      const mockChild = {
        id: 'child-1',
        phoneParent: '+261341234567',
        code: `CHANGE_PIN_654321_${expiresAt}`,
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);

      await changeParentPin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Code de vérification incorrect',
      });
    });

    it('devrait retourner 400 si code expiré', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        verificationCode: '654321',
        newPin: '5678',
      };

      const expiredTime = Date.now() - 11 * 60 * 1000; // 11 minutes ago
      const mockChild = {
        id: 'child-1',
        phoneParent: '+261341234567',
        code: `CHANGE_PIN_654321_${expiredTime}`,
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.children.update.mockResolvedValue(mockChild);

      await changeParentPin(req, res, next);

      expect(prisma.children.update).toHaveBeenCalledWith({
        where: { id: 'child-1' },
        data: { code: null },
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Code de vérification expiré',
      });
    });

    it('devrait changer le PIN avec succès', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        verificationCode: '654321',
        newPin: '5678',
      };

      const expiresAt = Date.now() + 5 * 60 * 1000;
      const mockChild = {
        id: 'child-1',
        phoneParent: '+261341234567',
        code: `CHANGE_PIN_654321_${expiresAt}`,
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      bcrypt.hash.mockResolvedValue('hashed-new-pin');
      prisma.children.update.mockResolvedValue(mockChild);

      await changeParentPin(req, res, next);

      expect(bcrypt.hash).toHaveBeenCalledWith('5678', 10);
      expect(prisma.children.update).toHaveBeenCalledWith({
        where: { id: 'child-1' },
        data: {
          passwordParent: 'hashed-new-pin',
          code: null,
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'PIN modifié avec succès',
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.body = {
        childId: 'child-1',
        parentPhone: '+261341234567',
        verificationCode: '654321',
        newPin: '5678',
      };

      prisma.children.findUnique.mockRejectedValue(new Error('DB Error'));

      await changeParentPin(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});




