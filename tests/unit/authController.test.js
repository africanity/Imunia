// tests/unit/authController.test.js

const { login, logout, refreshToken, requestPasswordReset, verifyPasswordResetCode, resendPasswordResetCode, updatePasswordAfterReset } = require('../../src/controllers/authController');
const prisma = require('../../src/config/prismaClient');
const tokenService = require('../../src/services/tokenService');
const bcrypt = require('bcryptjs');
const emailService = require('../../src/services/emailService');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('../../src/services/tokenService', () => ({
  signAccessToken: jest.fn(),
  signRefreshToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  generatePasswordResetToken: jest.fn(),
  verifyPasswordResetToken: jest.fn(),
}));
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));
jest.mock('../../src/services/emailService', () => ({
  sendPasswordResetCode: jest.fn(),
}));
jest.mock('../../src/controllers/vaccineController', () => ({
  missVaccine: {
    forPlanner: jest.fn().mockResolvedValue(undefined),
    forHealthCenter: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/stockLotService', () => ({
  refreshExpiredLots: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../src/services/vaccineBucketService', () => ({
  rebuildAllVaccinationBuckets: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/eventLogService', () => ({
  logEventAsync: jest.fn(),
}));

describe('authController', () => {
  let req, res, next;

  beforeEach(() => {
    // Réinitialiser les mocks avant chaque test
    jest.clearAllMocks();
    
    // Réinitialiser les mocks de missVaccine pour qu'ils retournent des Promises
    const { missVaccine } = require('../../src/controllers/vaccineController');
    if (missVaccine && missVaccine.forPlanner) {
      missVaccine.forPlanner.mockResolvedValue(undefined);
    }
    if (missVaccine && missVaccine.forHealthCenter) {
      missVaccine.forHealthCenter.mockResolvedValue(undefined);
    }
    
    req = {
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    next = jest.fn();
  });

  describe('login()', () => {
    it('devrait retourner 400 si email manquant', async () => {
      req.body = { password: 'password123' };

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email et mot de passe requis.'
      });
    });

    it('devrait retourner 400 si password manquant', async () => {
      req.body = { email: 'test@example.com' };

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email et mot de passe requis.'
      });
    });

    it('devrait retourner 401 si utilisateur non trouvé', async () => {
      req.body = { email: 'inexistant@example.com', password: 'password123' };
      
      prisma.user.findMany.mockResolvedValue([]);

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Identifiants invalides.'
      });
    });

    it('devrait retourner 401 si mot de passe incorrect', async () => {
      req.body = { email: 'test@example.com', password: 'mauvaispassword' };
      
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        role: 'AGENT',
        agentLevel: 'ADMIN',
        healthCenterId: 'hc-123',
        region: null,
        district: null,
        healthCenter: { id: 'hc-123', name: 'Centre de santé' }
      };

      prisma.user.findMany.mockResolvedValue([mockUser]);
      bcrypt.compare.mockResolvedValue(false);

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Identifiants invalides.'
      });
    });

    it('devrait retourner tokens si identifiants valides pour AGENT avec healthCenterId', async () => {
      req.body = { email: 'test@example.com', password: 'password123' };
      
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashedpassword',
        isActive: true,
        role: 'AGENT',
        agentLevel: 'ADMIN',
        healthCenterId: 'hc-123',
        region: null,
        district: null,
        healthCenter: { id: 'hc-123', name: 'Centre de santé' }
      };

      prisma.user.findMany.mockResolvedValue([mockUser]);
      bcrypt.compare.mockResolvedValue(true);
      tokenService.signAccessToken.mockReturnValue('access-token');
      tokenService.signRefreshToken.mockReturnValue('refresh-token');

      await login(req, res, next);

      // Vérifier que next n'a pas été appelé (pas d'erreur)
      expect(next).not.toHaveBeenCalled();
      
      // Vérifier que res.json a été appelé
      expect(res.json).toHaveBeenCalled();
      
      expect(tokenService.signAccessToken).toHaveBeenCalledWith({
        sub: 'user-123',
        role: 'AGENT',
        agentLevel: 'ADMIN'
      });
      expect(res.json).toHaveBeenCalledWith({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiredLots: []
      });
    });

    it('devrait retourner 403 si AGENT sans healthCenterId', async () => {
      req.body = { email: 'agent@example.com', password: 'password123' };
      
      const mockUser = {
        id: 'user-123',
        email: 'agent@example.com',
        password: 'hashedpassword',
        isActive: true,
        role: 'AGENT',
        agentLevel: 'ADMIN',
        healthCenterId: null,
        region: null,
        district: null,
        healthCenter: null
      };

      prisma.user.findMany.mockResolvedValue([mockUser]);
      bcrypt.compare.mockResolvedValue(true);

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Compte incomplet : l'agent doit être associé à un centre de santé."
      });
    });

    it('devrait retourner 403 si DISTRICT sans district', async () => {
      req.body = { email: 'district@example.com', password: 'password123' };
      
      const mockUser = {
        id: 'user-123',
        email: 'district@example.com',
        password: 'hashedpassword',
        isActive: true,
        role: 'DISTRICT',
        agentLevel: null,
        region: null,
        district: null,
        healthCenter: null
      };

      prisma.user.findMany.mockResolvedValue([mockUser]);
      bcrypt.compare.mockResolvedValue(true);

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Compte incomplet : l'utilisateur DISTRICT doit être associé à un district."
      });
    });

    it('devrait retourner 403 si REGIONAL sans region', async () => {
      req.body = { email: 'regional@example.com', password: 'password123' };
      
      const mockUser = {
        id: 'user-123',
        email: 'regional@example.com',
        password: 'hashedpassword',
        isActive: true,
        role: 'REGIONAL',
        agentLevel: null,
        region: null,
        district: null,
        healthCenter: null
      };

      prisma.user.findMany.mockResolvedValue([mockUser]);
      bcrypt.compare.mockResolvedValue(true);

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Compte incomplet : l'utilisateur REGIONAL doit être associé à une région."
      });
    });

    it('devrait retourner tokens si DISTRICT avec district valide', async () => {
      req.body = { email: 'district@example.com', password: 'password123' };
      
      const mockUser = {
        id: 'user-123',
        email: 'district@example.com',
        password: 'hashedpassword',
        isActive: true,
        role: 'DISTRICT',
        agentLevel: null,
        region: null,
        district: { id: 'd-1', name: 'Dakar' },
        healthCenter: null
      };

      prisma.user.findMany.mockResolvedValue([mockUser]);
      bcrypt.compare.mockResolvedValue(true);
      tokenService.signAccessToken.mockReturnValue('access-token');
      tokenService.signRefreshToken.mockReturnValue('refresh-token');

      await login(req, res, next);

      expect(tokenService.signAccessToken).toHaveBeenCalledWith({
        sub: 'user-123',
        role: 'DISTRICT',
        agentLevel: null
      });
      expect(res.json).toHaveBeenCalledWith({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiredLots: []
      });
    });

    it('devrait retourner tokens si REGIONAL avec region valide', async () => {
      req.body = { email: 'regional@example.com', password: 'password123' };
      
      const mockUser = {
        id: 'user-123',
        email: 'regional@example.com',
        password: 'hashedpassword',
        isActive: true,
        role: 'REGIONAL',
        agentLevel: null,
        region: { id: 'r-1', name: 'Dakar' },
        district: null,
        healthCenter: null
      };

      prisma.user.findMany.mockResolvedValue([mockUser]);
      bcrypt.compare.mockResolvedValue(true);
      tokenService.signAccessToken.mockReturnValue('access-token');
      tokenService.signRefreshToken.mockReturnValue('refresh-token');

      await login(req, res, next);

      expect(tokenService.signAccessToken).toHaveBeenCalledWith({
        sub: 'user-123',
        role: 'REGIONAL',
        agentLevel: null
      });
      expect(res.json).toHaveBeenCalledWith({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiredLots: []
      });
    });

    it('devrait demander sélection de rôle si plusieurs comptes avec même email', async () => {
      req.body = { email: 'multi@example.com', password: 'password123' };
      
      const mockUsers = [
        { 
          id: 'user-1',
          email: 'multi@example.com',
          password: 'hashedpassword',
          isActive: true,
          role: 'AGENT', 
          agentLevel: 'ADMIN', 
          healthCenterId: 'hc-1',
          region: null, 
          district: null, 
          healthCenter: { id: 'hc-1', name: 'Centre 1' }
        },
        { 
          id: 'user-2',
          email: 'multi@example.com',
          password: 'hashedpassword',
          isActive: true,
          role: 'DISTRICT', 
          agentLevel: null, 
          region: null, 
          district: { id: 'd-1', name: 'Dakar' }, 
          healthCenter: null 
        }
      ];

      prisma.user.findMany.mockResolvedValue(mockUsers);
      // bcrypt.compare doit retourner true pour chaque utilisateur
      bcrypt.compare.mockResolvedValue(true);

      await login(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        requiresRoleSelection: true,
        roles: expect.arrayContaining([
          expect.objectContaining({ role: 'AGENT' }),
          expect.objectContaining({ role: 'DISTRICT' })
        ])
      });
    });
  });

  describe('logout()', () => {
    it('devrait retourner 204', async () => {
      await logout(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('refreshToken()', () => {
    it('devrait retourner 400 si refreshToken manquant', async () => {
      req.body = {};

      await refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Refresh token requis'
      });
    });

    it('devrait retourner 401 si refreshToken invalide', async () => {
      req.body = { refreshToken: 'invalid-token' };
      tokenService.verifyRefreshToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Refresh token invalide ou expiré'
      });
    });

    it('devrait retourner 401 si utilisateur non trouvé', async () => {
      req.body = { refreshToken: 'valid-token' };
      tokenService.verifyRefreshToken.mockReturnValue({ sub: 'user-123' });
      prisma.user.findUnique.mockResolvedValue(null);

      await refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé ou inactif'
      });
    });

    it('devrait retourner 401 si utilisateur inactif', async () => {
      req.body = { refreshToken: 'valid-token' };
      tokenService.verifyRefreshToken.mockReturnValue({ sub: 'user-123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'AGENT',
        agentLevel: 'ADMIN',
        isActive: false,
      });

      await refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé ou inactif'
      });
    });

    it('devrait retourner de nouveaux tokens si refreshToken valide', async () => {
      req.body = { refreshToken: 'valid-token' };
      tokenService.verifyRefreshToken.mockReturnValue({ sub: 'user-123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'AGENT',
        agentLevel: 'ADMIN',
        isActive: true,
      });
      tokenService.signAccessToken.mockReturnValue('new-access-token');
      tokenService.signRefreshToken.mockReturnValue('new-refresh-token');

      await refreshToken(req, res, next);

      expect(tokenService.signAccessToken).toHaveBeenCalledWith({
        sub: 'user-123',
        role: 'AGENT',
        agentLevel: 'ADMIN',
      });
      expect(res.json).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.body = { refreshToken: 'valid-token' };
      tokenService.verifyRefreshToken.mockReturnValue({ sub: 'user-123' });
      prisma.user.findUnique.mockRejectedValue(new Error('DB Error'));

      await refreshToken(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('requestPasswordReset()', () => {
    it('devrait retourner 400 si email manquant', async () => {
      req.body = {};

      await requestPasswordReset(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email requis.'
      });
    });

    it('devrait retourner message générique si utilisateur non trouvé', async () => {
      req.body = { email: 'inexistant@example.com' };
      prisma.user.findUnique.mockResolvedValue(null);

      await requestPasswordReset(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Si cet email existe, un code de réinitialisation a été envoyé.'
      });
    });

    it('devrait retourner message générique si utilisateur inactif', async () => {
      req.body = { email: 'inactive@example.com' };
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'inactive@example.com',
        firstName: 'John',
        isActive: false,
      });

      await requestPasswordReset(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Si cet email existe, un code de réinitialisation a été envoyé.'
      });
    });

    it('devrait envoyer un code de réinitialisation si utilisateur valide', async () => {
      req.body = { email: 'test@example.com' };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        isActive: true,
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      emailService.sendPasswordResetCode.mockResolvedValue({ success: true });

      await requestPasswordReset(req, res, next);

      expect(prisma.user.update).toHaveBeenCalled();
      expect(emailService.sendPasswordResetCode).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Si cet email existe, un code de réinitialisation a été envoyé.',
        email: 'test@example.com',
      });
    });

    it('devrait gérer les erreurs d\'envoi d\'email', async () => {
      req.body = { email: 'test@example.com' };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        isActive: true,
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      emailService.sendPasswordResetCode.mockRejectedValue(new Error('Email error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await requestPasswordReset(req, res, next);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.body = { email: 'test@example.com' };
      prisma.user.findUnique.mockRejectedValue(new Error('DB Error'));

      await requestPasswordReset(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('verifyPasswordResetCode()', () => {
    it('devrait retourner 400 si email manquant', async () => {
      req.body = { code: '123456' };

      await verifyPasswordResetCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email et code requis.'
      });
    });

    it('devrait retourner 400 si code manquant', async () => {
      req.body = { email: 'test@example.com' };

      await verifyPasswordResetCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email et code requis.'
      });
    });

    it('devrait retourner 404 si utilisateur non trouvé', async () => {
      req.body = { email: 'test@example.com', code: '123456' };
      prisma.user.findUnique.mockResolvedValue(null);

      await verifyPasswordResetCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email introuvable.'
      });
    });

    it('devrait retourner 400 si code incorrect', async () => {
      req.body = { email: 'test@example.com', code: '123456' };
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        code: '654321',
        passwordResetCodeExpiry: new Date(Date.now() + 60000),
        passwordResetAttempts: 0,
      });
      prisma.user.update.mockResolvedValue({});

      await verifyPasswordResetCode(req, res, next);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { passwordResetAttempts: 1 },
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Code incorrect'),
          remainingAttempts: expect.any(Number),
        })
      );
    });

    it('devrait retourner 400 si code expiré', async () => {
      req.body = { email: 'test@example.com', code: '123456' };
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        code: '123456',
        passwordResetCodeExpiry: new Date(Date.now() - 60000),
        passwordResetAttempts: 0,
      });

      await verifyPasswordResetCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le code a expiré. Veuillez demander un nouveau code.',
        expired: true,
      });
    });

    it('devrait retourner 400 si trop de tentatives', async () => {
      req.body = { email: 'test@example.com', code: '123456' };
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        code: '123456',
        passwordResetCodeExpiry: new Date(Date.now() + 60000),
        passwordResetAttempts: 3,
      });

      await verifyPasswordResetCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Nombre maximum de tentatives atteint. Veuillez demander un nouveau code.',
        maxAttemptsReached: true,
      });
    });

    it('devrait retourner success si code valide', async () => {
      req.body = { email: 'test@example.com', code: '123456' };
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        code: '123456',
        passwordResetCodeExpiry: new Date(Date.now() + 60000),
        passwordResetAttempts: 0,
      });
      tokenService.generatePasswordResetToken.mockReturnValue('reset-token');

      await verifyPasswordResetCode(req, res, next);

      expect(tokenService.generatePasswordResetToken).toHaveBeenCalledWith('user-123');
      expect(res.json).toHaveBeenCalledWith({
        message: 'Code vérifié avec succès.',
        resetToken: 'reset-token',
      });
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.body = { email: 'test@example.com', code: '123456' };
      prisma.user.findUnique.mockRejectedValue(new Error('DB Error'));

      await verifyPasswordResetCode(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('resendPasswordResetCode()', () => {
    it('devrait retourner 400 si email manquant', async () => {
      req.body = {};

      await resendPasswordResetCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email requis.'
      });
    });

    it('devrait retourner message générique si utilisateur non trouvé', async () => {
      req.body = { email: 'inexistant@example.com' };
      prisma.user.findUnique.mockResolvedValue(null);

      await resendPasswordResetCode(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Si cet email existe, un nouveau code a été envoyé.'
      });
    });

    it('devrait renvoyer un code si utilisateur valide', async () => {
      req.body = { email: 'test@example.com' };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        isActive: true,
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      emailService.sendPasswordResetCode.mockResolvedValue({ success: true });

      await resendPasswordResetCode(req, res, next);

      expect(prisma.user.update).toHaveBeenCalled();
      expect(emailService.sendPasswordResetCode).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Si cet email existe, un nouveau code a été envoyé.',
      });
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.body = { email: 'test@example.com' };
      prisma.user.findUnique.mockRejectedValue(new Error('DB Error'));

      await resendPasswordResetCode(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updatePasswordAfterReset()', () => {
    it('devrait retourner 400 si resetToken manquant', async () => {
      req.body = { password: 'newpassword123', confirmPassword: 'newpassword123' };

      await updatePasswordAfterReset(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Token, mot de passe et confirmation requis.'
      });
    });

    it('devrait retourner 400 si password manquant', async () => {
      req.body = { resetToken: 'token', confirmPassword: 'newpassword123' };

      await updatePasswordAfterReset(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Token, mot de passe et confirmation requis.'
      });
    });

    it('devrait retourner 400 si confirmPassword manquant', async () => {
      req.body = { resetToken: 'token', password: 'newpassword123' };

      await updatePasswordAfterReset(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Token, mot de passe et confirmation requis.'
      });
    });

    it('devrait retourner 400 si mots de passe ne correspondent pas', async () => {
      req.body = { resetToken: 'token', password: 'newpassword123', confirmPassword: 'different' };

      await updatePasswordAfterReset(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Les mots de passe ne correspondent pas.'
      });
    });

    it('devrait retourner 400 si mot de passe trop court', async () => {
      req.body = { resetToken: 'token', password: '12345', confirmPassword: '12345' };

      await updatePasswordAfterReset(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le mot de passe doit contenir au moins 6 caractères.'
      });
    });

    it('devrait retourner 400 si resetToken invalide', async () => {
      req.body = { resetToken: 'invalid-token', password: 'newpassword123', confirmPassword: 'newpassword123' };
      tokenService.verifyPasswordResetToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await updatePasswordAfterReset(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Token invalide ou expiré.'
      });
    });

    it('devrait retourner 404 si utilisateur non trouvé', async () => {
      req.body = { resetToken: 'valid-token', password: 'newpassword123', confirmPassword: 'newpassword123' };
      tokenService.verifyPasswordResetToken.mockReturnValue({ userId: 'user-123' });
      prisma.user.findUnique.mockResolvedValue(null);

      await updatePasswordAfterReset(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur introuvable.'
      });
    });

    it('devrait retourner 400 si code expiré', async () => {
      req.body = { resetToken: 'valid-token', password: 'newpassword123', confirmPassword: 'newpassword123' };
      tokenService.verifyPasswordResetToken.mockReturnValue({ userId: 'user-123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        passwordResetCodeExpiry: new Date(Date.now() - 60000),
        code: '123456',
      });

      await updatePasswordAfterReset(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Le code a expiré. Veuillez recommencer le processus.'
      });
    });

    it('devrait mettre à jour le mot de passe si token valide', async () => {
      req.body = { resetToken: 'valid-token', password: 'newpassword123', confirmPassword: 'newpassword123' };
      tokenService.verifyPasswordResetToken.mockReturnValue({ userId: 'user-123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        passwordResetCodeExpiry: new Date(Date.now() + 60000),
        code: '123456',
      });
      bcrypt.hash.mockResolvedValue('hashed-password');
      prisma.user.update.mockResolvedValue({});

      await updatePasswordAfterReset(req, res, next);

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          password: 'hashed-password',
          code: null,
          passwordResetCodeExpiry: null,
          passwordResetAttempts: 0,
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        message: 'Mot de passe mis à jour avec succès.',
      });
    });

    it('devrait appeler next en cas d\'erreur', async () => {
      req.body = { resetToken: 'token', password: 'newpassword123', confirmPassword: 'newpassword123' };
      tokenService.verifyPasswordResetToken.mockReturnValue({ userId: 'user-123' });
      prisma.user.findUnique.mockRejectedValue(new Error('DB Error'));

      await updatePasswordAfterReset(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});