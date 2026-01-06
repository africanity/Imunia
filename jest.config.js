module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // Charger jest.env.js qui charge .env.test si disponible
  // Pour les tests unitaires, les variables d'environnement peuvent être mockées
  setupFiles: ['<rootDir>/tests/integration/jest.env.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/**',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};





