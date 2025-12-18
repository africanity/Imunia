// tests/unit/userController.test.js

const {
  createRegional,
  createDistricit,
  createAgentAdmin,
  createAgentStaff,
  activateUser,
  listUsers,
  updateSelf,
  verifyEmail,
  getUserDeletionSummary,
  deleteUser,
  updateRegional,
  updateDistrict,
  updateAgentAdmin,
  updateAgentStaff,
  deleteRegional,
  deleteDistrict,
  deleteAgentAdmin,
  deleteAgentStaff,
  getSelf,
  getHealthCenterAgents,
} = require('../../src/controllers/userController');

const prisma = require('../../src/config/prismaClient');
const bcrypt = require('bcryptjs');
const tokenService = require('../../src/services/tokenService');
const emailService = require('../../src/services/emailService');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  region: {
    findUnique: jest.fn(),
  },
  district: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  healthCenter: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  record: {
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  childVaccineScheduled: {
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  childVaccineCompleted: {
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  childVaccineOverdue: {
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  children: {
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  vaccineRequest: {
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  pendingStockTransfer: {
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => {
    const mockPrisma = require('../../src/config/prismaClient');
    const mockTx = {
      user: mockPrisma.user,
      record: mockPrisma.record,
      childVaccineScheduled: mockPrisma.childVaccineScheduled,
      childVaccineCompleted: mockPrisma.childVaccineCompleted,
      childVaccineOverdue: mockPrisma.childVaccineOverdue,
      children: mockPrisma.children,
      vaccineRequest: mockPrisma.vaccineRequest,
      pendingStockTransfer: mockPrisma.pendingStockTransfer,
    };
    return callback(mockTx);
  }),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('../../src/services/tokenService', () => ({
  generateActivationToken: jest.fn(() => ({
    token: 'activation-token-123',
    expiresAt: new Date('2026-12-31'),
  })),
  generateEmailCode: jest.fn(() => ({
    code: '123456',
    expiresAt: new Date('2026-12-31'),
  })),
}));

jest.mock('../../src/services/emailService', () => ({
  sendInvitationEmail: jest.fn(),
  sendTwoFactorCode: jest.fn(),
}));

describe('userController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: {
        id: 'user-1',
        role: 'NATIONAL',
        regionId: 'region-1',
        districtId: 'district-1',
        healthCenterId: 'healthcenter-1',
        agentLevel: 'ADMIN',
        email: 'user@test.com',
      },
      body: {},
      params: {},
      query: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('createRegional', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      await createRegional(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 400 si champs obligatoires manquants', async () => {
      req.body = {};
      // Le code génère le token avant de vérifier les champs
      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-123',
        expiresAt: new Date('2026-12-31'),
      });
      await createRegional(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Remplir les champs obligatoires pour ce rôle.',
      });
    });

    it('devrait créer un utilisateur régional avec succès', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'regional@test.com',
        phone: '+221123456789',
        regionId: 'region-1',
      };

      const mockUser = {
        id: 'user-2',
        firstName: 'John',
        lastName: 'Doe',
        email: 'regional@test.com',
        phone: '+221123456789',
        role: 'REGIONAL',
        regionId: 'region-1',
        isActive: false,
        activationToken: 'activation-token-123',
        activationExpires: new Date('2026-12-31'),
        password: '',
      };

      const mockRegion = {
        id: 'region-1',
        name: 'Region Test',
      };

      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-123',
        expiresAt: new Date('2026-12-31'),
      });
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.region.findUnique.mockResolvedValue(mockRegion);
      emailService.sendInvitationEmail.mockResolvedValue();

      await createRegional(req, res, next);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          email: 'regional@test.com',
          phone: '+221123456789',
          role: 'REGIONAL',
          regionId: 'region-1',
          isActive: false,
          activationToken: 'activation-token-123',
          password: '',
        }),
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockUser);
      expect(emailService.sendInvitationEmail).toHaveBeenCalled();
    });

    it('devrait retourner 409 si email déjà utilisé', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'existing@test.com',
        phone: '+221123456789',
        regionId: 'region-1',
      };

      const duplicateError = new Error('Duplicate email');
      duplicateError.code = 'P2002';
      duplicateError.meta = { target: ['email'] };

      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-123',
        expiresAt: new Date('2026-12-31'),
      });
      prisma.user.create.mockRejectedValue(duplicateError);

      await createRegional(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Cet email est déjà utilisé. Veuillez utiliser un autre email.',
      });
    });

    it('devrait retourner 400 si référence invalide (P2003)', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'regional@test.com',
        phone: '+221123456789',
        regionId: 'invalid-region',
      };

      const foreignKeyError = new Error('Foreign key constraint');
      foreignKeyError.code = 'P2003';

      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-123',
        expiresAt: new Date('2026-12-31'),
      });
      prisma.user.create.mockRejectedValue(foreignKeyError);

      await createRegional(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Une référence invalide a été fournie. Veuillez vérifier les informations saisies.',
      });
    });

    it('devrait gérer les erreurs non gérées', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'regional@test.com',
        phone: '+221123456789',
        regionId: 'region-1',
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Erreur DB');
      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-123',
        expiresAt: new Date('2026-12-31'),
      });
      prisma.user.create.mockRejectedValue(error);

      await createRegional(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('createDistricit', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL', async () => {
      req.user.role = 'NATIONAL';
      await createDistricit(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 400 si champs obligatoires manquants', async () => {
      req.user.role = 'REGIONAL';
      req.body = {};
      await createDistricit(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Remplir les champs obligatoires pour ce rôle.',
      });
    });

    it('devrait retourner 400 si REGIONAL sans regionId', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = null;
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'district@test.com',
        phone: '+221123456789',
        districtId: 'district-1',
      };

      await createDistricit(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Votre compte n\'est pas associé à une région.',
      });
    });

    it('devrait retourner 404 si district introuvable', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'district@test.com',
        phone: '+221123456789',
        districtId: 'district-1',
      };

      prisma.district.findUnique.mockResolvedValue(null);

      await createDistricit(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'District introuvable' });
    });

    it('devrait retourner 403 si district n\'appartient pas à la région', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'district@test.com',
        phone: '+221123456789',
        districtId: 'district-1',
      };

      const mockDistrict = {
        id: 'district-1',
        commune: {
          regionId: 'region-2', // Différent
        },
      };

      prisma.district.findUnique.mockResolvedValue(mockDistrict);

      await createDistricit(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Ce district n\'appartient pas à votre région.',
      });
    });

    it('devrait créer un utilisateur district avec succès', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'district@test.com',
        phone: '+221123456789',
        districtId: 'district-1',
      };

      const mockDistrict = {
        id: 'district-1',
        commune: {
          regionId: 'region-1',
        },
      };

      const mockUser = {
        id: 'user-2',
        firstName: 'John',
        lastName: 'Doe',
        email: 'district@test.com',
        phone: '+221123456789',
        role: 'DISTRICT',
        regionId: 'region-1',
        districtId: 'district-1',
        isActive: false,
        activationToken: 'activation-token-123',
        activationExpires: new Date('2026-12-31'),
        password: '',
        district: {
          name: 'District Test',
        },
      };

      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-123',
        expiresAt: new Date('2026-12-31'),
      });
      prisma.district.findUnique.mockResolvedValue(mockDistrict);
      prisma.user.create.mockResolvedValue(mockUser);
      emailService.sendInvitationEmail.mockResolvedValue();

      await createDistricit(req, res, next);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          email: 'district@test.com',
          phone: '+221123456789',
          role: 'DISTRICT',
          regionId: 'region-1',
          districtId: 'district-1',
        }),
        include: {
          district: { select: { name: true } },
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockUser);
      expect(emailService.sendInvitationEmail).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'district@test.com',
        phone: '+221123456789',
        districtId: 'district-1',
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Erreur DB');
      prisma.district.findUnique.mockRejectedValue(error);

      await createDistricit(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('createAgentAdmin', () => {
    it('devrait retourner 403 si utilisateur n\'est pas DISTRICT', async () => {
      req.user.role = 'REGIONAL';
      await createAgentAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 400 si champs obligatoires manquants', async () => {
      req.user.role = 'DISTRICT';
      req.body = {};
      await createAgentAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 400 si DISTRICT sans districtId', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = null;
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'agent@test.com',
        phone: '+221123456789',
        healthCenterId: 'healthcenter-1',
      };

      await createAgentAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Votre compte n\'est pas associé à un district.',
      });
    });

    it('devrait retourner 403 si centre de santé hors du district', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'agent@test.com',
        phone: '+221123456789',
        healthCenterId: 'healthcenter-1',
      };

      const mockHealthCenter = {
        id: 'healthcenter-1',
        name: 'Centre Test',
        districtId: 'district-2', // Différent
      };

      prisma.healthCenter.findUnique.mockResolvedValue(mockHealthCenter);

      await createAgentAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Centre de santé hors de votre district',
      });
    });

    it('devrait créer un agent ADMIN avec succès', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'agent@test.com',
        phone: '+221123456789',
        healthCenterId: 'healthcenter-1',
      };

      const mockHealthCenter = {
        id: 'healthcenter-1',
        name: 'Centre Test',
        districtId: 'district-1',
      };

      const mockUser = {
        id: 'user-2',
        firstName: 'John',
        lastName: 'Doe',
        email: 'agent@test.com',
        phone: '+221123456789',
        role: 'AGENT',
        agentLevel: 'ADMIN',
        districtId: 'district-1',
        healthCenterId: 'healthcenter-1',
        isActive: false,
        activationToken: 'activation-token-123',
        activationExpires: new Date('2026-12-31'),
        password: '',
        healthCenter: {
          name: 'Centre Test',
        },
      };

      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-123',
        expiresAt: new Date('2026-12-31'),
      });
      prisma.healthCenter.findUnique.mockResolvedValue(mockHealthCenter);
      prisma.user.create.mockResolvedValue(mockUser);
      emailService.sendInvitationEmail.mockResolvedValue();

      await createAgentAdmin(req, res, next);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          email: 'agent@test.com',
          phone: '+221123456789',
          role: 'AGENT',
          agentLevel: 'ADMIN',
          districtId: 'district-1',
          healthCenterId: 'healthcenter-1',
        }),
        include: {
          healthCenter: { select: { name: true } },
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockUser);
      expect(emailService.sendInvitationEmail).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'agent@test.com',
        phone: '+221123456789',
        healthCenterId: 'healthcenter-1',
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Erreur DB');
      prisma.healthCenter.findUnique.mockRejectedValue(error);

      await createAgentAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('createAgentStaff', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT ADMIN', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'STAFF';
      await createAgentStaff(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 400 si champs obligatoires manquants', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.body = {};
      await createAgentStaff(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devrait retourner 403 si healthCenterId différent', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'staff@test.com',
        phone: '+221123456789',
        healthCenterId: 'healthcenter-2', // Différent
      };

      await createAgentStaff(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Centre de santé invalide',
      });
    });

    it('devrait créer un agent STAFF avec succès', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.user.districtId = 'district-1';
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'staff@test.com',
        phone: '+221123456789',
        code: 'STAFF001',
        healthCenterId: 'healthcenter-1',
      };

      const mockUser = {
        id: 'user-2',
        firstName: 'John',
        lastName: 'Doe',
        email: 'staff@test.com',
        phone: '+221123456789',
        code: 'STAFF001',
        role: 'AGENT',
        agentLevel: 'STAFF',
        healthCenterId: 'healthcenter-1',
        districtId: 'district-1',
        isActive: false,
        activationToken: 'activation-token-123',
        activationExpires: new Date('2026-12-31'),
        password: '',
        healthCenter: {
          name: 'Centre Test',
        },
      };

      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-123',
        expiresAt: new Date('2026-12-31'),
      });
      prisma.user.create.mockResolvedValue(mockUser);
      emailService.sendInvitationEmail.mockResolvedValue();

      await createAgentStaff(req, res, next);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          email: 'staff@test.com',
          phone: '+221123456789',
          code: 'STAFF001',
          role: 'AGENT',
          agentLevel: 'STAFF',
          healthCenterId: 'healthcenter-1',
          districtId: 'district-1',
        }),
        include: {
          healthCenter: { select: { name: true } },
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockUser);
      expect(emailService.sendInvitationEmail).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'staff@test.com',
        phone: '+221123456789',
        healthCenterId: 'healthcenter-1',
      };

      const error = new Error('Erreur DB');
      tokenService.generateActivationToken.mockReturnValue({
        token: 'activation-token-123',
        expiresAt: new Date('2026-12-31'),
      });
      prisma.user.create.mockRejectedValue(error);

      await createAgentStaff(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('activateUser', () => {
    it('devrait retourner 400 si mots de passe ne correspondent pas', async () => {
      req.params.id = 'user-1';
      req.body = {
        token: 'activation-token-123',
        password: 'password123',
        confirmPassword: 'password456', // Différent
      };

      await activateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Les mots de passe ne correspondent pas.',
      });
    });

    it('devrait retourner 400 si utilisateur introuvable', async () => {
      req.params.id = 'user-1';
      req.body = {
        token: 'activation-token-123',
        password: 'password123',
        confirmPassword: 'password123',
      };

      prisma.user.findUnique.mockResolvedValue(null);

      await activateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Activation invalide.',
      });
    });

    it('devrait retourner 400 si utilisateur déjà actif', async () => {
      req.params.id = 'user-1';
      req.body = {
        token: 'activation-token-123',
        password: 'password123',
        confirmPassword: 'password123',
      };

      const mockUser = {
        id: 'user-1',
        isActive: true,
        activationToken: 'activation-token-123',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await activateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Activation invalide.',
      });
    });

    it('devrait retourner 400 si token invalide', async () => {
      req.params.id = 'user-1';
      req.body = {
        token: 'wrong-token',
        password: 'password123',
        confirmPassword: 'password123',
      };

      const mockUser = {
        id: 'user-1',
        isActive: false,
        activationToken: 'activation-token-123', // Différent
        activationExpires: new Date('2026-12-31'),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await activateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.message).toContain("Token");
      expect(response.message).toContain("invalide");
    });

    it('devrait retourner 400 si token expiré', async () => {
      req.params.id = 'user-1';
      req.body = {
        token: 'activation-token-123',
        password: 'password123',
        confirmPassword: 'password123',
      };

      const mockUser = {
        id: 'user-1',
        isActive: false,
        activationToken: 'activation-token-123',
        activationExpires: new Date('2020-01-01'), // Expiré
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await activateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.message).toContain("Token");
      expect(response.message).toContain("expiré");
    });

    it('devrait activer un utilisateur avec succès', async () => {
      req.params.id = 'user-1';
      req.body = {
        token: 'activation-token-123',
        password: 'password123',
        confirmPassword: 'password123',
      };

      const mockUser = {
        id: 'user-1',
        isActive: false,
        activationToken: 'activation-token-123',
        activationExpires: new Date('2026-12-31'),
      };

      const hashedPassword = 'hashed-password-123';

      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.hash.mockResolvedValue(hashedPassword);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        isActive: true,
        password: hashedPassword,
      });

      await activateUser(req, res, next);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          password: hashedPassword,
          isActive: true,
          activationToken: null,
          activationExpires: null,
        },
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.params.id = 'user-1';
      req.body = {
        token: 'activation-token-123',
        password: 'password123',
        confirmPassword: 'password123',
      };

      const error = new Error('Erreur DB');
      prisma.user.findUnique.mockRejectedValue(error);

      await activateUser(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('listUsers', () => {
    it('devrait retourner tous les utilisateurs pour NATIONAL', async () => {
      req.user.role = 'NATIONAL';

      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@test.com',
          role: 'REGIONAL',
          firstName: 'John',
          lastName: 'Doe',
        },
      ];

      prisma.user.findMany.mockResolvedValue(mockUsers);

      await listUsers(req, res, next);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
        select: expect.objectContaining({
          id: true,
          email: true,
          role: true,
        }),
      });
      expect(res.json).toHaveBeenCalledWith(mockUsers);
    });

    it('devrait retourner une liste vide si REGIONAL sans regionId', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = null;

      await listUsers(req, res, next);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('devrait filtrer par districts pour REGIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';

      const mockDistricts = [{ id: 'district-1' }, { id: 'district-2' }];
      const mockUsers = [];

      prisma.district.findMany.mockResolvedValue(mockDistricts);
      prisma.user.findMany.mockResolvedValue(mockUsers);

      await listUsers(req, res, next);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'DISTRICT',
          districtId: { in: ['district-1', 'district-2'] },
        },
        orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
        select: expect.any(Object),
      });
    });

    it('devrait retourner une liste vide si REGIONAL sans districts', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';

      prisma.district.findMany.mockResolvedValue([]);

      await listUsers(req, res, next);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('devrait filtrer par centres de santé pour DISTRICT', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';

      const mockHealthCenters = [{ id: 'healthcenter-1' }];
      const mockUsers = [];

      prisma.healthCenter.findMany.mockResolvedValue(mockHealthCenters);
      prisma.user.findMany.mockResolvedValue(mockUsers);

      await listUsers(req, res, next);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'AGENT',
          healthCenterId: { in: ['healthcenter-1'] },
        },
        orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
        select: expect.any(Object),
      });
    });

    it('devrait retourner une liste vide si DISTRICT sans healthCenters', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';

      prisma.healthCenter.findMany.mockResolvedValue([]);

      await listUsers(req, res, next);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('devrait filtrer les STAFF pour AGENT ADMIN', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';

      const mockUsers = [];

      prisma.user.findMany.mockResolvedValue(mockUsers);

      await listUsers(req, res, next);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'AGENT',
          agentLevel: 'STAFF',
          healthCenterId: 'healthcenter-1',
        },
        orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
        select: expect.any(Object),
      });
    });

    it('devrait retourner une liste vide si AGENT non ADMIN', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'STAFF';

      await listUsers(req, res, next);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      const error = new Error('Erreur DB');
      prisma.user.findMany.mockRejectedValue(error);

      await listUsers(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateSelf', () => {
    it('devrait mettre à jour le profil utilisateur avec succès', async () => {
      req.body = {
        firstName: 'John Updated',
        lastName: 'Doe Updated',
      };

      const mockUpdatedUser = {
        id: 'user-1',
        firstName: 'John Updated',
        lastName: 'Doe Updated',
        email: 'user@test.com',
      };

      prisma.user.update.mockResolvedValue(mockUpdatedUser);

      await updateSelf(req, res, next);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          firstName: 'John Updated',
          lastName: 'Doe Updated',
        },
      });
      expect(res.json).toHaveBeenCalledWith(mockUpdatedUser);
    });

    it('devrait gérer le changement d\'email avec code de vérification', async () => {
      req.body = {
        email: 'newemail@test.com',
      };
      req.user.email = 'user@test.com'; // Email actuel différent

      const mockUpdatedUser = {
        id: 'user-1',
        email: 'user@test.com',
        pendingEmail: 'newemail@test.com',
        emailVerificationCode: '123456',
        emailVerified: false,
      };

      tokenService.generateEmailCode.mockReturnValue({
        code: '123456',
        expiresAt: new Date('2026-12-31'),
      });
      prisma.user.update.mockResolvedValue(mockUpdatedUser);
      emailService.sendTwoFactorCode.mockResolvedValue();

      await updateSelf(req, res, next);

      expect(tokenService.generateEmailCode).toHaveBeenCalled();
      expect(emailService.sendTwoFactorCode).toHaveBeenCalledWith({
        email: 'newemail@test.com',
        code: '123456',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          pendingEmail: 'newemail@test.com',
          emailVerificationCode: '123456',
          emailVerified: false,
        }),
      });
      expect(res.json).toHaveBeenCalledWith(mockUpdatedUser);
    });

    it('ne devrait pas permettre de modifier le rôle', async () => {
      req.body = {
        role: 'ADMIN', // Tentative de modification
        firstName: 'John',
      };

      const mockUpdatedUser = {
        id: 'user-1',
        firstName: 'John',
        role: 'NATIONAL', // Rôle original préservé
      };

      prisma.user.update.mockResolvedValue(mockUpdatedUser);

      await updateSelf(req, res, next);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          firstName: 'John',
          // role ne doit pas être dans data
        },
      });
    });

    it('devrait gérer les erreurs', async () => {
      req.body = { firstName: 'John' };
      const error = new Error('Erreur DB');
      prisma.user.update.mockRejectedValue(error);

      await updateSelf(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('verifyEmail', () => {
    it('devrait retourner 400 si code invalide', async () => {
      req.body = { code: 'wrong-code' };

      const mockUser = {
        id: 'user-1',
        pendingEmail: 'newemail@test.com',
        emailVerificationCode: '123456', // Différent
        emailVerificationExpiry: new Date('2026-12-31'),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await verifyEmail(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Code de vérification invalide.',
      });
    });

    it('devrait retourner 400 si code expiré', async () => {
      req.body = { code: '123456' };

      const mockUser = {
        id: 'user-1',
        pendingEmail: 'newemail@test.com',
        emailVerificationCode: '123456',
        emailVerificationExpiry: new Date('2020-01-01'), // Expiré
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await verifyEmail(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Code de vérification invalide.',
      });
    });

    it('devrait vérifier l\'email avec succès', async () => {
      req.body = { code: '123456' };

      const mockUser = {
        id: 'user-1',
        pendingEmail: 'newemail@test.com',
        emailVerificationCode: '123456',
        emailVerificationExpiry: new Date('2026-12-31'),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        email: 'newemail@test.com',
        pendingEmail: null,
        emailVerificationCode: null,
        emailVerificationExpiry: null,
        emailVerified: true,
      });

      await verifyEmail(req, res, next);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          email: 'newemail@test.com',
          pendingEmail: null,
          emailVerificationCode: null,
          emailVerificationExpiry: null,
          emailVerified: true,
        },
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.body = { code: '123456' };
      const error = new Error('Erreur DB');
      prisma.user.findUnique.mockRejectedValue(error);

      await verifyEmail(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getUserDeletionSummary', () => {
    it('devrait retourner 404 si utilisateur introuvable', async () => {
      req.params.id = 'user-1';
      prisma.user.findUnique.mockResolvedValue(null);

      await getUserDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur introuvable.',
      });
    });

    it('devrait retourner 403 si action non autorisée', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';

      const mockTarget = {
        id: 'user-1',
        role: 'DISTRICT',
        districtId: 'district-1',
        regionId: 'region-2', // Différent
      };

      prisma.user.findUnique.mockResolvedValue(mockTarget);

      await getUserDeletionSummary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Action non autorisée.',
      });
    });

    it('devrait retourner le résumé de suppression avec succès', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'user-1';

      const mockTarget = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'user@test.com',
        role: 'REGIONAL',
      };

      const mockSummary = {
        user: {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'user@test.com',
          role: 'REGIONAL',
        },
        totals: {
          recordsDeleted: 5,
          scheduledPlannerCleared: 3,
          completedAdminCleared: 2,
          overdueEscalationCleared: 1,
          childrenNextAgentCleared: 4,
          vaccineRequestsCleared: 2,
          pendingTransfersCleared: 1,
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockTarget);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue(mockTarget),
          },
          record: {
            count: jest.fn().mockResolvedValue(5),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(3),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(2),
          },
          childVaccineOverdue: {
            count: jest.fn().mockResolvedValue(1),
          },
          children: {
            count: jest.fn().mockResolvedValue(4),
          },
          vaccineRequest: {
            count: jest.fn().mockResolvedValue(2),
          },
          pendingStockTransfer: {
            count: jest.fn().mockResolvedValue(1),
          },
        };
        return callback(mockTx);
      });

      await getUserDeletionSummary(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockSummary);
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'user-1';
      const error = new Error('Erreur DB');
      prisma.user.findUnique.mockRejectedValue(error);

      await getUserDeletionSummary(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteUser', () => {
    it('devrait retourner 404 si utilisateur introuvable', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'user-1';
      prisma.user.findUnique.mockResolvedValue(null);

      await deleteUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur introuvable.',
      });
    });

    it('devrait retourner 403 si action non autorisée', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';

      const mockTarget = {
        id: 'user-1',
        role: 'DISTRICT',
        districtId: 'district-1',
        regionId: 'region-2', // Différent
      };

      prisma.user.findUnique.mockResolvedValue(mockTarget);

      await deleteUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Action non autorisée.',
      });
    });

    it('devrait supprimer un utilisateur avec toutes ses données liées', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'user-1';

      const mockTarget = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'user@test.com',
        role: 'REGIONAL',
        regionId: 'region-1',
        districtId: null,
        healthCenterId: null,
        agentLevel: null,
      };

      prisma.user.findUnique.mockResolvedValue(mockTarget);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue(mockTarget),
            delete: jest.fn().mockResolvedValue({}),
          },
          record: {
            count: jest.fn().mockResolvedValue(5),
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineScheduled: {
            count: jest.fn().mockResolvedValue(3),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineCompleted: {
            count: jest.fn().mockResolvedValue(2),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          childVaccineOverdue: {
            count: jest.fn().mockResolvedValue(1),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          children: {
            count: jest.fn().mockResolvedValue(4),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          vaccineRequest: {
            count: jest.fn().mockResolvedValue(2),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          pendingStockTransfer: {
            count: jest.fn().mockResolvedValue(1),
            updateMany: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      await deleteUser(req, res, next);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'user-1';
      const error = new Error('Erreur DB');
      prisma.user.findUnique.mockRejectedValue(error);

      await deleteUser(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateRegional', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'user-1';
      await updateRegional(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 404 si utilisateur introuvable', async () => {
      req.params.id = 'user-1';
      req.body = { regionId: 'region-1' };
      prisma.user.findUnique.mockResolvedValue(null);

      await updateRegional(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait mettre à jour un régional avec succès', async () => {
      req.params.id = 'user-1';
      req.body = { regionId: 'region-2' };

      const mockRegional = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        role: 'REGIONAL',
        regionId: 'region-1',
      };

      const mockUpdated = {
        ...mockRegional,
        regionId: 'region-2',
      };

      prisma.user.findUnique.mockResolvedValue(mockRegional);
      prisma.user.update.mockResolvedValue(mockUpdated);

      await updateRegional(req, res, next);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          regionId: 'region-2',
        },
      });
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait gérer les erreurs', async () => {
      req.params.id = 'user-1';
      req.body = { regionId: 'region-1' };
      const error = new Error('Erreur DB');
      prisma.user.findUnique.mockRejectedValue(error);

      await updateRegional(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateDistrict', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'user-1';
      await updateDistrict(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 400 si REGIONAL sans regionId', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = null;
      req.params.id = 'user-1';
      req.body = { districtId: 'district-1' };

      await updateDistrict(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Votre compte n\'est pas associé à une région.',
      });
    });

    it('devrait retourner 404 si utilisateur introuvable', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';
      req.body = { districtId: 'district-1' };

      prisma.user.findUnique.mockResolvedValue(null);

      await updateDistrict(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait retourner 404 si utilisateur n\'est pas DISTRICT', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';
      req.body = { districtId: 'district-1' };

      const mockUser = {
        id: 'user-1',
        role: 'AGENT', // Pas DISTRICT
        district: null,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await updateDistrict(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait retourner 403 si district n\'appartient pas à la région', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';
      req.body = { districtId: 'district-1' };

      const mockUser = {
        id: 'user-1',
        role: 'DISTRICT',
        district: {
          commune: {
            regionId: 'region-2', // Différent
          },
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await updateDistrict(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Vous ne pouvez pas modifier cet utilisateur',
      });
    });

    it('devrait retourner 403 si nouveau district hors de la région', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';
      req.body = { districtId: 'district-2' };

      const mockUser = {
        id: 'user-1',
        role: 'DISTRICT',
        districtId: 'district-1',
        district: {
          commune: {
            regionId: 'region-1',
          },
        },
      };

      const mockNewDistrict = {
        id: 'district-2',
        commune: {
          regionId: 'region-2', // Différent
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.district.findUnique.mockResolvedValue(mockNewDistrict);

      await updateDistrict(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'District hors de votre région',
      });
    });

    it('devrait mettre à jour un district avec succès', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';
      req.body = { districtId: 'district-2' };

      const mockUser = {
        id: 'user-1',
        role: 'DISTRICT',
        districtId: 'district-1',
        district: {
          commune: {
            regionId: 'region-1',
          },
        },
      };

      const mockNewDistrict = {
        id: 'district-2',
        commune: {
          regionId: 'region-1',
        },
      };

      const mockUpdated = {
        ...mockUser,
        districtId: 'district-2',
        district: {
          name: 'District 2',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.district.findUnique.mockResolvedValue(mockNewDistrict);
      prisma.user.update.mockResolvedValue(mockUpdated);

      await updateDistrict(req, res, next);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          districtId: 'district-2',
        },
        include: { district: { select: { name: true } } },
      });
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait retourner l\'utilisateur sans modification si districtId identique', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';
      req.body = { districtId: 'district-1' };

      const mockUser = {
        id: 'user-1',
        role: 'DISTRICT',
        districtId: 'district-1',
        district: {
          commune: {
            regionId: 'region-1',
          },
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await updateDistrict(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockUser);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';
      req.body = { districtId: 'district-1' };
      const error = new Error('Erreur DB');
      prisma.user.findUnique.mockRejectedValue(error);

      await updateDistrict(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateAgentAdmin', () => {
    it('devrait retourner 403 si utilisateur n\'est pas DISTRICT', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'user-1';
      await updateAgentAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 404 si utilisateur introuvable', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.params.id = 'user-1';
      req.body = { healthCenterId: 'healthcenter-1' };

      prisma.user.findUnique.mockResolvedValue(null);

      await updateAgentAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait retourner 404 si utilisateur n\'est pas AGENT ADMIN', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.params.id = 'user-1';
      req.body = { healthCenterId: 'healthcenter-1' };

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'STAFF', // Pas ADMIN
        healthCenter: {
          districtId: 'district-1',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await updateAgentAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait retourner 403 si agent n\'appartient pas au district', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.params.id = 'user-1';
      req.body = { healthCenterId: 'healthcenter-1' };

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'ADMIN',
        healthCenter: {
          districtId: 'district-2', // Différent
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await updateAgentAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Vous ne pouvez pas modifier cet utilisateur',
      });
    });

    it('devrait retourner 403 si nouveau centre hors du district', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.params.id = 'user-1';
      req.body = { healthCenterId: 'healthcenter-2' };

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'ADMIN',
        healthCenter: {
          districtId: 'district-1',
        },
      };

      const mockHealthCenter = {
        id: 'healthcenter-2',
        districtId: 'district-2', // Différent
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.healthCenter.findUnique.mockResolvedValue(mockHealthCenter);

      await updateAgentAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Centre de santé hors de votre district',
      });
    });

    it('devrait mettre à jour un agent ADMIN avec succès', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.params.id = 'user-1';
      req.body = { healthCenterId: 'healthcenter-2' };

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'ADMIN',
        healthCenter: {
          districtId: 'district-1',
        },
      };

      const mockHealthCenter = {
        id: 'healthcenter-2',
        districtId: 'district-1',
      };

      const mockUpdated = {
        ...mockUser,
        healthCenterId: 'healthcenter-2',
        districtId: 'district-1',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.healthCenter.findUnique.mockResolvedValue(mockHealthCenter);
      prisma.user.update.mockResolvedValue(mockUpdated);

      await updateAgentAdmin(req, res, next);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          healthCenterId: 'healthcenter-2',
          districtId: 'district-1',
        },
      });
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait retourner l\'utilisateur sans modification si healthCenterId manquant', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.params.id = 'user-1';
      req.body = {};

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'ADMIN',
        healthCenter: {
          districtId: 'district-1',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await updateAgentAdmin(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockUser);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.params.id = 'user-1';
      req.body = { healthCenterId: 'healthcenter-1' };
      const error = new Error('Erreur DB');
      prisma.user.findUnique.mockRejectedValue(error);

      await updateAgentAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateAgentStaff', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT ADMIN', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'STAFF';
      req.params.id = 'user-1';
      await updateAgentStaff(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 404 si utilisateur introuvable', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'user-1';
      req.body = { healthCenterId: 'healthcenter-1' };

      prisma.user.findUnique.mockResolvedValue(null);

      await updateAgentStaff(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait retourner 404 si utilisateur n\'est pas AGENT STAFF', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'user-1';
      req.body = { healthCenterId: 'healthcenter-1' };

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'ADMIN', // Pas STAFF
        healthCenterId: 'healthcenter-1',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await updateAgentStaff(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait retourner 403 si agent n\'appartient pas au même centre', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'user-1';
      req.body = { healthCenterId: 'healthcenter-1' };

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'STAFF',
        healthCenterId: 'healthcenter-2', // Différent
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await updateAgentStaff(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Vous ne pouvez pas modifier cet utilisateur',
      });
    });

    it('devrait retourner l\'utilisateur sans modification si healthCenterId identique', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'user-1';
      req.body = { healthCenterId: 'healthcenter-1' };

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'STAFF',
        healthCenterId: 'healthcenter-1',
      };

      const mockUpdated = {
        ...mockUser,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      // Le code vérifie : if (!healthCenterId || healthCenterId !== req.user.healthCenterId)
      // Si healthCenterId === req.user.healthCenterId, la condition est false, donc il continue
      // et appelle prisma.user.update puis res.json(updatedAgentStaff)
      prisma.user.update.mockResolvedValue(mockUpdated);

      await updateAgentStaff(req, res, next);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { healthCenterId: 'healthcenter-1' },
      });
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('devrait retourner l\'utilisateur sans modification si healthCenterId différent', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'user-1';
      req.body = { healthCenterId: 'healthcenter-2' }; // Différent mais doit être rejeté

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'STAFF',
        healthCenterId: 'healthcenter-1',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await updateAgentStaff(req, res, next);

      // Le code retourne l'utilisateur sans modification si healthCenterId !== req.user.healthCenterId
      expect(res.json).toHaveBeenCalledWith(mockUser);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'user-1';
      req.body = { healthCenterId: 'healthcenter-1' };
      const error = new Error('Erreur DB');
      prisma.user.findUnique.mockRejectedValue(error);

      await updateAgentStaff(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteRegional', () => {
    it('devrait retourner 403 si utilisateur n\'est pas NATIONAL', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'user-1';
      await deleteRegional(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 404 si utilisateur introuvable', async () => {
      req.params.id = 'user-1';
      prisma.user.findUnique.mockResolvedValue(null);

      await deleteRegional(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait supprimer un régional avec succès', async () => {
      req.params.id = 'user-1';

      const mockRegional = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        role: 'REGIONAL',
      };

      prisma.user.findUnique.mockResolvedValue(mockRegional);
      prisma.user.delete.mockResolvedValue(mockRegional);

      await deleteRegional(req, res, next);

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.params.id = 'user-1';
      const error = new Error('Erreur DB');
      prisma.user.findUnique.mockRejectedValue(error);

      await deleteRegional(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteDistrict', () => {
    it('devrait retourner 403 si utilisateur n\'est pas REGIONAL', async () => {
      req.user.role = 'NATIONAL';
      req.params.id = 'user-1';
      await deleteDistrict(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 404 si utilisateur introuvable', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';

      prisma.user.findUnique.mockResolvedValue(null);

      await deleteDistrict(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait retourner 404 si utilisateur n\'est pas DISTRICT', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';

      const mockUser = {
        id: 'user-1',
        role: 'AGENT', // Pas DISTRICT
        district: null,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await deleteDistrict(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait retourner 403 si district n\'appartient pas à la région', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';

      const mockUser = {
        id: 'user-1',
        role: 'DISTRICT',
        district: {
          commune: {
            regionId: 'region-2', // Différent
          },
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await deleteDistrict(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Vous ne pouvez pas supprimer cet utilisateur',
      });
    });

    it('devrait supprimer un district avec succès', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';

      const mockUser = {
        id: 'user-1',
        role: 'DISTRICT',
        district: {
          commune: {
            regionId: 'region-1',
          },
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.delete.mockResolvedValue(mockUser);

      await deleteDistrict(req, res, next);

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'REGIONAL';
      req.user.regionId = 'region-1';
      req.params.id = 'user-1';
      const error = new Error('Erreur DB');
      prisma.user.findUnique.mockRejectedValue(error);

      await deleteDistrict(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteAgentAdmin', () => {
    it('devrait retourner 403 si utilisateur n\'est pas DISTRICT', async () => {
      req.user.role = 'REGIONAL';
      req.params.id = 'user-1';
      await deleteAgentAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 404 si utilisateur introuvable', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.params.id = 'user-1';

      prisma.user.findUnique.mockResolvedValue(null);

      await deleteAgentAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait retourner 404 si utilisateur n\'est pas AGENT ADMIN', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.params.id = 'user-1';

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'STAFF', // Pas ADMIN
        healthCenter: {
          districtId: 'district-1',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await deleteAgentAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait retourner 403 si agent n\'appartient pas au district', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.params.id = 'user-1';

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'ADMIN',
        healthCenter: {
          districtId: 'district-2', // Différent
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await deleteAgentAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Vous ne pouvez pas supprimer cet utilisateur',
      });
    });

    it('devrait supprimer un agent ADMIN avec succès', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.params.id = 'user-1';

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'ADMIN',
        healthCenter: {
          districtId: 'district-1',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.delete.mockResolvedValue(mockUser);

      await deleteAgentAdmin(req, res, next);

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'DISTRICT';
      req.user.districtId = 'district-1';
      req.params.id = 'user-1';
      const error = new Error('Erreur DB');
      prisma.user.findUnique.mockRejectedValue(error);

      await deleteAgentAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteAgentStaff', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT ADMIN', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'STAFF';
      req.params.id = 'user-1';
      await deleteAgentStaff(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 404 si utilisateur introuvable', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'user-1';

      prisma.user.findUnique.mockResolvedValue(null);

      await deleteAgentStaff(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait retourner 404 si utilisateur n\'est pas AGENT STAFF', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'user-1';

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'ADMIN', // Pas STAFF
        healthCenterId: 'healthcenter-1',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await deleteAgentStaff(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé',
      });
    });

    it('devrait retourner 403 si agent n\'appartient pas au même centre', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'user-1';

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'STAFF',
        healthCenterId: 'healthcenter-2', // Différent
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await deleteAgentStaff(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Vous ne pouvez pas supprimer cet utilisateur',
      });
    });

    it('devrait supprimer un agent STAFF avec succès', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'user-1';

      const mockUser = {
        id: 'user-1',
        role: 'AGENT',
        agentLevel: 'STAFF',
        healthCenterId: 'healthcenter-1',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.delete.mockResolvedValue(mockUser);

      await deleteAgentStaff(req, res, next);

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'AGENT';
      req.user.agentLevel = 'ADMIN';
      req.user.healthCenterId = 'healthcenter-1';
      req.params.id = 'user-1';
      const error = new Error('Erreur DB');
      prisma.user.findUnique.mockRejectedValue(error);

      await deleteAgentStaff(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getSelf', () => {
    it('devrait retourner 404 si utilisateur introuvable', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await getSelf(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur introuvable',
      });
    });

    it('devrait retourner les informations de l\'utilisateur avec région directe', async () => {
      const mockUser = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'user@test.com',
        role: 'REGIONAL',
        agentLevel: null,
        regionId: 'region-1',
        districtId: null,
        healthCenterId: null,
        region: {
          id: 'region-1',
          name: 'Region Test',
        },
        district: null,
        healthCenter: null,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await getSelf(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'user@test.com',
        role: 'REGIONAL',
        agentLevel: null,
        regionId: 'region-1',
        regionName: 'Region Test',
        districtId: null,
        districtName: null,
        healthCenterId: null,
        healthCenterName: null,
      });
    });

    it('devrait inférer la région depuis le district', async () => {
      const mockUser = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'user@test.com',
        role: 'DISTRICT',
        agentLevel: null,
        regionId: null,
        districtId: 'district-1',
        healthCenterId: null,
        region: null,
        district: {
          id: 'district-1',
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
        healthCenter: null,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await getSelf(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'user@test.com',
        role: 'DISTRICT',
        agentLevel: null,
        regionId: 'region-1',
        regionName: 'Region Test',
        districtId: 'district-1',
        districtName: 'District Test',
        healthCenterId: null,
        healthCenterName: null,
      });
    });

    it('devrait inférer la région et le district depuis le centre de santé', async () => {
      const mockUser = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'user@test.com',
        role: 'AGENT',
        agentLevel: 'ADMIN',
        regionId: null,
        districtId: null,
        healthCenterId: 'healthcenter-1',
        region: null,
        district: null,
        healthCenter: {
          id: 'healthcenter-1',
          name: 'Centre Test',
          district: {
            id: 'district-1',
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
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await getSelf(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'user@test.com',
        role: 'AGENT',
        agentLevel: 'ADMIN',
        regionId: 'region-1',
        regionName: 'Region Test',
        districtId: 'district-1',
        districtName: 'District Test',
        healthCenterId: 'healthcenter-1',
        healthCenterName: 'Centre Test',
      });
    });

    it('devrait gérer les erreurs', async () => {
      const error = new Error('Erreur DB');
      prisma.user.findUnique.mockRejectedValue(error);

      await getSelf(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getHealthCenterAgents', () => {
    it('devrait retourner 403 si utilisateur n\'est pas AGENT', async () => {
      req.user.role = 'NATIONAL';
      req.user.healthCenterId = 'healthcenter-1';

      await getHealthCenterAgents(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner 403 si agent n\'a pas de healthCenterId', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = null;

      await getHealthCenterAgents(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Accès refusé' });
    });

    it('devrait retourner la liste des agents du centre de santé avec succès', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';

      const mockAgents = [
        {
          id: 'agent-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          phone: '+221123456789',
          agentLevel: 'ADMIN',
        },
        {
          id: 'agent-2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@test.com',
          phone: '+221987654321',
          agentLevel: 'STAFF',
        },
      ];

      prisma.user.findMany.mockResolvedValue(mockAgents);

      await getHealthCenterAgents(req, res, next);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'AGENT',
          healthCenterId: 'healthcenter-1',
          isActive: true,
        },
        orderBy: [
          { agentLevel: 'asc' },
          { lastName: 'asc' },
          { firstName: 'asc' },
        ],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          agentLevel: true,
        },
      });
      expect(res.json).toHaveBeenCalledWith(mockAgents);
    });

    it('devrait retourner une liste vide si aucun agent trouvé', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';

      prisma.user.findMany.mockResolvedValue([]);

      await getHealthCenterAgents(req, res, next);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('devrait gérer les erreurs', async () => {
      req.user.role = 'AGENT';
      req.user.healthCenterId = 'healthcenter-1';

      const error = new Error('Erreur DB');
      prisma.user.findMany.mockRejectedValue(error);

      await getHealthCenterAgents(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});






