// Mock manuel pour prismaClient
const prisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // Ajouter d'autres modèles si nécessaire
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $pool: null,
};

module.exports = prisma;





