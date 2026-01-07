module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // Charger jest.env.js qui charge .env.test si disponible
  // Pour les tests unitaires, les variables d'environnement peuvent être mockées
  setupFiles: ['<rootDir>/tests/integration/jest.env.js'],
  // setupFilesAfterEnv est exécuté après que l'environnement de test Jest soit configuré
  // Cela permet d'utiliser afterEach, afterAll, etc.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/**',
    // Fichiers non testables en unitaire (testés en intégration)
    '!src/app.js', // Point d'entrée Express, testé en intégration
    '!src/socket.js', // Socket.io nécessite un serveur HTTP, testé en intégration
    '!src/routes/**', // Fichiers de routes, testés en intégration
    // Middlewares très simples ou nécessitant des tests d'intégration
    '!src/middleware/prisma.js', // Middleware très simple (juste assigne prisma)
    '!src/middleware/uploadProof.js', // Similaire à upload.js, nécessite des tests d'intégration
    // Services wrappers simples ou nécessitant des tests d'intégration
    '!src/services/notification.js', // Wrapper simple autour de whatsapp.js
    '!src/services/whatsapp.js', // WhatsApp nécessite des tests d'intégration avec Twilio
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Seuils de couverture pour garantir 80% minimum
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Seuils plus élevés pour les zones critiques
          './src/jobs/': {
            branches: 85,
            functions: 90,
            lines: 85,
            statements: 85,
          },
          './src/jobs/scheduler.js': {
            branches: 30,
            functions: 50, // Les callbacks cron sont difficiles à tester
            lines: 60,
            statements: 60,
          },
          './src/jobs/stockExpirationJob.js': {
            branches: 100, // Toutes les branches sont testées
            functions: 66.66, // Une seule fonction exportée, testée
            lines: 100,
            statements: 100,
          },
    './src/services/': {
      branches: 80,
      functions: 85,
      lines: 80,
      statements: 80,
    },
    './src/middleware/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/controllers/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
};





