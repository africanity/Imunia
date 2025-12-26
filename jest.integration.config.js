module.exports = {
  testEnvironment: "node",

  // On ne lance que les tests d'intégration dans tests/integration
  testMatch: ["**/tests/integration/**/*.test.js"],

  // Charge automatiquement .env.test avant tous les tests
  setupFiles: ["<rootDir>/tests/integration/jest.env.js"],

  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
