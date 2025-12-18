const {
  findAllValidAppointments,
  findAppointmentsToNotify,
  sendAppointmentNotification,
} = require("../services/appointmentNotificationService");

/**
 * Job principal pour vérifier et notifier les rendez-vous
 * Nouvelle logique : vérifie le seuil supérieur le plus proche pour chaque rendez-vous
 */

const checkAppointmentNotifications = async () => {
  console.log("📅 Début de la vérification des rendez-vous...");

  try {
    // Récupérer tous les rendez-vous valides pour les logs
    const allAppointments = await findAllValidAppointments();
    console.log(`  Trouvé ${allAppointments.length} rendez-vous valide(s) à vérifier`);

    // Trouver les rendez-vous à notifier (avec la nouvelle logique)
    const appointmentsToNotify = await findAppointmentsToNotify();
    console.log(
      `  ${appointmentsToNotify.length} rendez-vous à notifier`
    );

    let totalNotificationsSent = 0;
    let totalErrors = 0;
    let totalSkipped = 0;

    for (const appointment of appointmentsToNotify) {
      try {
        console.log(
          `  📋 Traitement rendez-vous: ${appointment.child.firstName} ${appointment.child.lastName}, date: ${new Date(appointment.appointmentDate).toLocaleDateString('fr-FR')}, type: ${appointment.notificationType}`
        );
        const result = await sendAppointmentNotification(appointment);

        console.log(`  📊 Résultat:`, JSON.stringify(result, null, 2));

        if (result.success) {
          totalNotificationsSent++;
          console.log(
            `  ✅ Notification envoyée pour ${appointment.child.firstName} ${appointment.child.lastName} (${appointment.notificationType}) via ${result.sentVia}`
          );
        } else if (result.reason === "no_contact") {
          totalSkipped++;
          console.log(
            `  ⏭️  Notification ignorée pour ${appointment.child.firstName} ${appointment.child.lastName} (aucun contact)`
          );
        } else if (result.reason === "already_sent") {
          totalSkipped++;
          console.log(
            `  ⏭️  Notification déjà envoyée pour ${appointment.child.firstName} ${appointment.child.lastName}`
          );
        } else {
          totalErrors++;
          console.error(
            `  ❌ Erreur notification pour ${appointment.child.firstName} ${appointment.child.lastName}:`,
            result.error || result.reason || "Erreur inconnue"
          );
        }
      } catch (error) {
        totalErrors++;
        console.error(
          `  ❌ Erreur lors de la notification pour ${appointment.child.firstName} ${appointment.child.lastName}:`,
          error.message
        );
      }
    }

    console.log(
      `✅ Vérification terminée : ${totalNotificationsSent} notification(s) envoyée(s), ${totalSkipped} ignorée(s), ${totalErrors} erreur(s)`
    );

    return {
      success: true,
      notificationsSent: totalNotificationsSent,
      skipped: totalSkipped,
      errors: totalErrors,
    };
  } catch (error) {
    console.error("❌ Erreur lors de la vérification des rendez-vous:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  checkAppointmentNotifications,
};

