// jest.setup.js
// Configuration globale pour Jest afin de corriger les fuites de ressources

// S'assurer que tous les setImmediate sont exécutés avant la fin de chaque test
afterEach(async () => {
  // Attendre que tous les setImmediate en attente soient exécutés
  // On utilise process.nextTick et setTimeout pour s'assurer que tous les callbacks sont traités
  // Note: setImmediate est exécuté après process.nextTick dans l'event loop
  for (let i = 0; i < 3; i++) {
    // Attendre un cycle de process.nextTick
    await new Promise(resolve => process.nextTick(resolve));
    // Attendre un cycle de setImmediate (utiliser setTimeout(0) pour éviter la récursion)
    await new Promise(resolve => setTimeout(resolve, 0));
  }
});

// Nettoyer les connexions Prisma après tous les tests
afterAll(async () => {
  // Fermer les connexions Prisma
  // Note: Certains tests d'intégration ferment déjà Prisma dans leur afterAll
  // On essaie de fermer ici aussi pour s'assurer qu'il n'y a pas de fuites
  try {
    const prisma = require('./src/config/prismaClient');
    if (prisma && typeof prisma.$disconnect === 'function') {
      try {
        await prisma.$disconnect();
      } catch (disconnectError) {
        // Ignorer si déjà déconnecté
        // Les erreurs de déconnexion sont généralement non critiques
      }
    }
    
    // Fermer aussi le pool de connexions si disponible
    if (prisma.$pool && typeof prisma.$pool.end === 'function') {
      try {
        await prisma.$pool.end();
      } catch (poolError) {
        // Ignorer si déjà fermé
      }
    }
  } catch (error) {
    // Ignorer les erreurs de déconnexion (peut ne pas exister dans certains tests)
  }
});
