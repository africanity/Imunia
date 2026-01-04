const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.test") });

// ⚠️ Vérification de sécurité : s'assurer qu'on n'utilise pas la DB de production
const dbUrl = process.env.DATABASE_URL || "";

if (!dbUrl) {
  throw new Error(
    "❌ DATABASE_URL n'est pas défini dans .env.test. " +
    "Veuillez créer un fichier .env.test avec une base de données de test."
  );
}

// Vérifier que ce n'est pas une base de production
const productionIndicators = [
  "production",
  "prod",
  "localhost:5432", // Port par défaut PostgreSQL (à adapter selon votre config)
];

const isProduction = productionIndicators.some((indicator) =>
  dbUrl.toLowerCase().includes(indicator)
);

if (isProduction && !dbUrl.includes("test")) {
  console.warn(
    "⚠️  ATTENTION: DATABASE_URL semble pointer vers une base de production !"
  );
  console.warn("   Assurez-vous d'utiliser une base de données de test.");
  console.warn(`   DATABASE_URL actuel: ${dbUrl.replace(/:[^:@]+@/, ":****@")}`);
  
  // En mode CI/CD ou si FORCE_TEST_DB=true, on peut forcer l'arrêt
  if (process.env.FORCE_TEST_DB === "true") {
    throw new Error(
      "❌ FORCE_TEST_DB=true mais DATABASE_URL semble pointer vers la production. " +
      "Arrêt par sécurité."
    );
  }
}

console.log("✅ Configuration de test chargée depuis .env.test");