
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env")
});


const cron = require("node-cron");
const { checkStockExpirations } = require("./stockExpirationJob");
const { checkAppointmentNotifications } = require("./appointmentNotificationJob");

// Configuration des tâches planifiées (configurable via env)
// TEST: Toutes les minutes pour vérifier que le cron fonctionne
const STOCK_CHECK_CRON = process.env.STOCK_CHECK_CRON || "*/1 * * * *"; // Toutes les minutes (pour test)
const APPOINTMENT_CHECK_CRON =
  process.env.APPOINTMENT_CHECK_CRON || "*/5 * * * *"; // Toutes les 5 minutes (pour tests)

console.log("🕐 Initialisation du planificateur de tâches...");

// Tâche pour vérifier les stocks expirés
cron.schedule(STOCK_CHECK_CRON, async () => {
  console.log(`\n⏰ [${new Date().toISOString()}] Exécution de la vérification des stocks expirés...`);
  console.log(`📧 SMTP_USER: ${process.env.SMTP_USER || 'NON DÉFINI'}`);
  console.log(`📧 SMTP_PASS: ${process.env.SMTP_PASS ? 'DÉFINI' : 'NON DÉFINI'}`);
  try {
    const result = await checkStockExpirations();
    console.log(`✅ Résultat du cron:`, JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`❌ Erreur dans le cron:`, error);
    console.error(error.stack);
  }
});

console.log(`  ✅ Tâche stocks expirés planifiée : ${STOCK_CHECK_CRON}`);
console.log(`  📅 Heure actuelle : ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`);

// Tâche pour vérifier les rendez-vous
cron.schedule(APPOINTMENT_CHECK_CRON, async () => {
  console.log(`\n⏰ [${new Date().toISOString()}] Exécution de la vérification des rendez-vous...`);
  await checkAppointmentNotifications();
});

console.log(`  ✅ Tâche rendez-vous planifiée : ${APPOINTMENT_CHECK_CRON}`);
console.log("✅ Planificateur de tâches démarré\n");

// Exporter pour permettre l'exécution manuelle si nécessaire
module.exports = {
  checkStockExpirations,
  checkAppointmentNotifications,
};

