// tests/unit/vaccinationProofController.test.js

const {
  uploadVaccinationProofs,
  uploadProofFromBackoffice,
  getVaccinationProofs,
  getProofFileBase64,
  getProofFile,
  deleteProof,
} = require('../../src/controllers/vaccinationProofController');

const prisma = require('../../src/config/prismaClient');
const fs = require('fs');
const path = require('path');

// Mock des dépendances
jest.mock('../../src/config/prismaClient', () => ({
  children: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  childVaccinationProof: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  renameSync: jest.fn(),
  readFileSync: jest.fn(),
  createReadStream: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock('../../src/services/emailService', () => ({
  sendNewPhotosUploadedEmail: jest.fn(),
}));

describe('vaccinationProofController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {
        id: 'user-1',
        role: 'AGENT',
        healthCenterId: 'healthcenter-1',
        districtId: 'district-1',
        regionId: 'region-1',
      },
      params: {},
      body: {},
      files: [],
      file: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('uploadVaccinationProofs', () => {
    it('devrait retourner 400 si aucun fichier fourni', async () => {
      req.params.childId = 'child-1';
      req.files = [];

      await uploadVaccinationProofs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Aucun fichier fourni',
      });
    });

    it('devrait retourner 404 si enfant non trouvé', async () => {
      req.params.childId = 'child-1';
      req.files = [{ originalname: 'test.jpg', mimetype: 'image/jpeg', size: 1000, path: '/tmp/test.jpg' }];
      prisma.children.findUnique.mockResolvedValue(null);

      await uploadVaccinationProofs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Enfant non trouvé',
      });
    });

    it('devrait retourner 400 si type de fichier non autorisé', async () => {
      req.params.childId = 'child-1';
      req.files = [{ originalname: 'test.exe', mimetype: 'application/x-msdownload', size: 1000, path: '/tmp/test.exe' }];
      prisma.children.findUnique.mockResolvedValue({
        id: 'child-1',
        firstName: 'John',
        lastName: 'Doe',
        healthCenterId: 'healthcenter-1',
        healthCenter: { id: 'healthcenter-1', name: 'Centre Test' },
      });

      await uploadVaccinationProofs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Type de fichier non autorisé'),
        }),
      );
    });

    it('devrait retourner 400 si fichier trop volumineux', async () => {
      req.params.childId = 'child-1';
      req.files = [{ originalname: 'test.jpg', mimetype: 'image/jpeg', size: 11 * 1024 * 1024, path: '/tmp/test.jpg' }];
      prisma.children.findUnique.mockResolvedValue({
        id: 'child-1',
        firstName: 'John',
        lastName: 'Doe',
        healthCenterId: 'healthcenter-1',
        healthCenter: { id: 'healthcenter-1', name: 'Centre Test' },
      });

      await uploadVaccinationProofs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Fichier trop volumineux'),
        }),
      );
    });

    it('devrait uploader un fichier valide avec succès', async () => {
      req.params.childId = 'child-1';
      const mockFile = {
        originalname: 'vaccination.jpg',
        mimetype: 'image/jpeg',
        size: 1000,
        path: '/tmp/test.jpg',
      };
      req.files = [mockFile];
      const mockChild = {
        id: 'child-1',
        firstName: 'John',
        lastName: 'Doe',
        fatherName: 'Father',
        healthCenterId: 'healthcenter-1',
        healthCenter: { id: 'healthcenter-1', name: 'Centre Test' },
      };
      const mockProof = {
        id: 'proof-1',
        title: 'vaccination',
        fileName: 'vaccination.jpg',
        fileSize: 1000,
        mimeType: 'image/jpeg',
        uploadedAt: new Date(),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.childVaccinationProof.create.mockResolvedValue(mockProof);
      prisma.children.update.mockResolvedValue({});
      prisma.user.findMany.mockResolvedValue([]);
      fs.existsSync.mockReturnValue(true);
      fs.renameSync.mockImplementation(() => {});

      await uploadVaccinationProofs(req, res, next);

      expect(prisma.childVaccinationProof.create).toHaveBeenCalled();
      expect(prisma.children.update).toHaveBeenCalledWith({
        where: { id: 'child-1' },
        data: { photosRequested: false },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          files: expect.arrayContaining([
            expect.objectContaining({
              id: 'proof-1',
            }),
          ]),
        }),
      );
    });
  });

  describe('uploadProofFromBackoffice', () => {
    it('devrait retourner 400 si aucun fichier fourni', async () => {
      req.params.childId = 'child-1';
      req.body.title = 'Titre';
      req.file = null;

      await uploadProofFromBackoffice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Aucun fichier fourni',
      });
    });

    it('devrait retourner 400 si titre manquant', async () => {
      req.params.childId = 'child-1';
      req.body.title = '';
      req.file = { originalname: 'test.jpg', mimetype: 'image/jpeg', size: 1000, filename: 'test.jpg' };
      fs.existsSync.mockReturnValue(true);

      await uploadProofFromBackoffice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Le titre du document est requis',
      });
    });

    it('devrait retourner 404 si enfant non trouvé', async () => {
      req.params.childId = 'child-1';
      req.body.title = 'Titre valide';
      req.file = { originalname: 'test.jpg', mimetype: 'image/jpeg', size: 1000, filename: 'test.jpg' };
      prisma.children.findUnique.mockResolvedValue(null);
      fs.existsSync.mockReturnValue(true);

      await uploadProofFromBackoffice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Enfant non trouvé',
      });
    });

    it('devrait uploader un fichier depuis le backoffice avec succès', async () => {
      req.params.childId = 'child-1';
      req.body.title = 'Titre valide';
      req.file = { originalname: 'test.jpg', mimetype: 'image/jpeg', size: 1000, filename: 'test.jpg' };
      const mockChild = { id: 'child-1' };
      const mockProof = {
        id: 'proof-1',
        title: 'Titre valide',
        fileName: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1000,
        uploadedBy: 'user-1',
        uploadedAt: new Date(),
      };

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.childVaccinationProof.create.mockResolvedValue(mockProof);
      fs.existsSync.mockReturnValue(true);

      await uploadProofFromBackoffice(req, res, next);

      expect(prisma.childVaccinationProof.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Titre valide',
            uploadedBy: 'user-1',
          }),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      );
    });
  });

  describe('getVaccinationProofs', () => {
    it('devrait retourner 404 si enfant non trouvé', async () => {
      req.params.childId = 'child-1';
      prisma.children.findUnique.mockResolvedValue(null);

      await getVaccinationProofs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Enfant non trouvé',
        proofs: [],
      });
    });

    it('devrait retourner la liste des preuves de vaccination', async () => {
      req.params.childId = 'child-1';
      const mockChild = { id: 'child-1' };
      const mockProofs = [
        {
          id: 'proof-1',
          title: 'Preuve 1',
          fileName: 'file1.jpg',
          fileSize: 1000,
          mimeType: 'image/jpeg',
          uploadedBy: null,
          uploadedAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'proof-2',
          title: 'Preuve 2',
          fileName: 'file2.pdf',
          fileSize: 2000,
          mimeType: 'application/pdf',
          uploadedBy: 'user-1',
          uploadedAt: new Date(),
          createdAt: new Date(),
        },
      ];

      prisma.children.findUnique.mockResolvedValue(mockChild);
      prisma.childVaccinationProof.findMany.mockResolvedValue(mockProofs);

      await getVaccinationProofs(req, res, next);

      expect(prisma.childVaccinationProof.findMany).toHaveBeenCalledWith({
        where: { childId: 'child-1' },
        orderBy: { uploadedAt: 'desc' },
        select: expect.objectContaining({
          id: true,
          title: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          uploadedBy: true,
          uploadedAt: true,
          createdAt: true,
        }),
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        proofs: mockProofs,
      });
    });
  });

  describe('getProofFileBase64', () => {
    it('devrait retourner 404 si preuve non trouvée', async () => {
      req.params.proofId = 'proof-1';
      req.user = { role: 'AGENT', healthCenterId: 'healthcenter-1' };
      prisma.childVaccinationProof.findUnique.mockResolvedValue(null);

      await getProofFileBase64(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Preuve de vaccination non trouvée',
      });
    });

    it('devrait retourner 401 si utilisateur non authentifié', async () => {
      req.params.proofId = 'proof-1';
      req.user = null;
      const mockProof = {
        id: 'proof-1',
        filePath: 'uploads/vaccination-proofs/test.jpg',
        fileName: 'test.jpg',
        mimeType: 'image/jpeg',
        child: { id: 'child-1', healthCenterId: 'healthcenter-1' },
      };
      prisma.childVaccinationProof.findUnique.mockResolvedValue(mockProof);

      await getProofFileBase64(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Non authentifié',
      });
    });

    it('devrait retourner 403 si accès refusé (AGENT d\'un autre centre)', async () => {
      req.params.proofId = 'proof-1';
      req.user = { role: 'AGENT', healthCenterId: 'healthcenter-2' };
      const mockProof = {
        id: 'proof-1',
        filePath: 'uploads/vaccination-proofs/test.jpg',
        fileName: 'test.jpg',
        mimeType: 'image/jpeg',
        child: {
          id: 'child-1',
          healthCenterId: 'healthcenter-1',
          healthCenter: { id: 'healthcenter-1' },
        },
      };
      prisma.childVaccinationProof.findUnique.mockResolvedValue(mockProof);

      await getProofFileBase64(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner 400 si ce n\'est pas une image', async () => {
      req.params.proofId = 'proof-1';
      req.user = { role: 'NATIONAL' };
      const mockProof = {
        id: 'proof-1',
        filePath: 'uploads/vaccination-proofs/test.pdf',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        child: { id: 'child-1', healthCenterId: 'healthcenter-1' },
      };
      prisma.childVaccinationProof.findUnique.mockResolvedValue(mockProof);

      await getProofFileBase64(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Ce endpoint est uniquement pour les images',
      });
    });

    it('devrait retourner 404 si fichier non trouvé sur le serveur', async () => {
      req.params.proofId = 'proof-1';
      req.user = { role: 'NATIONAL' };
      const mockProof = {
        id: 'proof-1',
        filePath: 'uploads/vaccination-proofs/test.jpg',
        fileName: 'test.jpg',
        mimeType: 'image/jpeg',
        child: { id: 'child-1', healthCenterId: 'healthcenter-1' },
      };
      prisma.childVaccinationProof.findUnique.mockResolvedValue(mockProof);
      fs.existsSync.mockReturnValue(false);

      await getProofFileBase64(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Fichier non trouvé sur le serveur',
      });
    });

    it('devrait retourner le fichier en base64 avec succès (NATIONAL)', async () => {
      req.params.proofId = 'proof-1';
      req.user = { role: 'NATIONAL' };
      const mockProof = {
        id: 'proof-1',
        filePath: 'uploads/vaccination-proofs/test.jpg',
        fileName: 'test.jpg',
        mimeType: 'image/jpeg',
        child: { id: 'child-1', healthCenterId: 'healthcenter-1' },
      };
      const mockBuffer = Buffer.from('test image content');

      prisma.childVaccinationProof.findUnique.mockResolvedValue(mockProof);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockBuffer);

      await getProofFileBase64(req, res, next);

      expect(fs.readFileSync).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-store, must-revalidate');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          dataUrl: expect.stringContaining('data:image/jpeg;base64,'),
          mimeType: 'image/jpeg',
          fileName: 'test.jpg',
        }),
      );
    });

    it('devrait autoriser l\'accès pour REGIONAL de la même région', async () => {
      req.params.proofId = 'proof-1';
      req.user = { role: 'REGIONAL', regionId: 'region-1' };
      const mockProof = {
        id: 'proof-1',
        filePath: 'uploads/vaccination-proofs/test.jpg',
        fileName: 'test.jpg',
        mimeType: 'image/jpeg',
        child: {
          id: 'child-1',
          healthCenterId: 'healthcenter-1',
          healthCenter: {
            id: 'healthcenter-1',
            districtId: 'district-1',
            district: {
              id: 'district-1',
              communeId: 'commune-1',
              commune: {
                id: 'commune-1',
                regionId: 'region-1',
                region: { id: 'region-1' },
              },
            },
          },
        },
      };
      const mockBuffer = Buffer.from('test image content');

      prisma.childVaccinationProof.findUnique.mockResolvedValue(mockProof);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockBuffer);

      await getProofFileBase64(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      );
    });
  });

  describe('getProofFile', () => {
    it('devrait retourner 404 si preuve non trouvée', async () => {
      req.params.proofId = 'proof-1';
      req.user = { role: 'AGENT', healthCenterId: 'healthcenter-1' };
      prisma.childVaccinationProof.findUnique.mockResolvedValue(null);

      await getProofFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Preuve de vaccination non trouvée',
      });
    });

    it('devrait retourner 403 si accès refusé', async () => {
      req.params.proofId = 'proof-1';
      req.user = { role: 'AGENT', healthCenterId: 'healthcenter-2' };
      const mockProof = {
        id: 'proof-1',
        filePath: 'uploads/vaccination-proofs/test.jpg',
        fileName: 'test.jpg',
        mimeType: 'image/jpeg',
        child: {
          id: 'child-1',
          healthCenterId: 'healthcenter-1',
          healthCenter: { id: 'healthcenter-1' },
        },
      };
      prisma.childVaccinationProof.findUnique.mockResolvedValue(mockProof);

      await getProofFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait retourner le fichier avec succès', async () => {
      req.params.proofId = 'proof-1';
      req.user = { role: 'NATIONAL' };
      const mockProof = {
        id: 'proof-1',
        filePath: 'uploads/vaccination-proofs/test.jpg',
        fileName: 'test.jpg',
        mimeType: 'image/jpeg',
        child: { id: 'child-1', healthCenterId: 'healthcenter-1' },
      };
      const mockStream = {
        pipe: jest.fn(),
      };

      prisma.childVaccinationProof.findUnique.mockResolvedValue(mockProof);
      fs.existsSync.mockReturnValue(true);
      fs.createReadStream.mockReturnValue(mockStream);

      await getProofFile(req, res, next);

      expect(fs.createReadStream).toHaveBeenCalled();
      expect(mockStream.pipe).toHaveBeenCalledWith(res);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-store, must-revalidate');
    });
  });

  describe('deleteProof', () => {
    it('devrait retourner 404 si preuve non trouvée', async () => {
      req.params.proofId = 'proof-1';
      req.user = { role: 'AGENT', healthCenterId: 'healthcenter-1' };
      prisma.childVaccinationProof.findUnique.mockResolvedValue(null);

      await deleteProof(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Preuve de vaccination non trouvée',
      });
    });

    it('devrait retourner 403 si accès refusé', async () => {
      req.params.proofId = 'proof-1';
      req.user = { role: 'AGENT', healthCenterId: 'healthcenter-2' };
      const mockProof = {
        id: 'proof-1',
        filePath: 'uploads/vaccination-proofs/test.jpg',
        child: {
          id: 'child-1',
          healthCenterId: 'healthcenter-1',
          healthCenter: { id: 'healthcenter-1' },
        },
      };
      prisma.childVaccinationProof.findUnique.mockResolvedValue(mockProof);

      await deleteProof(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Accès refusé',
      });
    });

    it('devrait supprimer une preuve avec succès', async () => {
      req.params.proofId = 'proof-1';
      req.user = { role: 'NATIONAL' };
      const mockProof = {
        id: 'proof-1',
        filePath: 'uploads/vaccination-proofs/test.jpg',
        child: {
          id: 'child-1',
          healthCenterId: 'healthcenter-1',
          healthCenter: { id: 'healthcenter-1' },
        },
      };

      prisma.childVaccinationProof.findUnique.mockResolvedValue(mockProof);
      prisma.childVaccinationProof.delete.mockResolvedValue({});
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {});

      await deleteProof(req, res, next);

      expect(fs.unlinkSync).toHaveBeenCalled();
      expect(prisma.childVaccinationProof.delete).toHaveBeenCalledWith({
        where: { id: 'proof-1' },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Preuve de vaccination supprimée avec succès',
      });
    });

    it('devrait gérer le cas où le fichier n\'existe pas sur le système de fichiers', async () => {
      req.params.proofId = 'proof-1';
      req.user = { role: 'NATIONAL' };
      const mockProof = {
        id: 'proof-1',
        filePath: 'uploads/vaccination-proofs/test.jpg',
        child: {
          id: 'child-1',
          healthCenterId: 'healthcenter-1',
          healthCenter: { id: 'healthcenter-1' },
        },
      };

      prisma.childVaccinationProof.findUnique.mockResolvedValue(mockProof);
      prisma.childVaccinationProof.delete.mockResolvedValue({});
      fs.existsSync.mockReturnValue(false);

      await deleteProof(req, res, next);

      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(prisma.childVaccinationProof.delete).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Preuve de vaccination supprimée avec succès',
      });
    });
  });
});


