// tests/unit/authController.test.js

const { login, logout, refreshToken } = require('../../src/controllers/authController');
const prisma = require('../../src/config/prismaClient');
const tokenService = require('../../src/services/tokenService');
const bcrypt = require('bcryptjs');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
}));
jest.mock('../../src/services/tokenService', () => ({
  signAccessToken: jest.fn(),
  signRefreshToken: jest.fn(),
}));
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
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
});