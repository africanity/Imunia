const {
  findAllValidLots,
  calculateDaysUntilExpiration,
  findNextThreshold,
  getConcernedAgents,
  hasNotificationBeenSent,
  recordNotificationSent,
  getOwnerInfo,
} = require("../services/stockExpirationService");
const { sendStockExpirationAlert } = require("../services/emailService");

/**
 * Job principal pour vérifier et notifier les stocks expirés
 * Nouvelle logique : vérifie le seuil supérieur le plus proche pour chaque lot
 */
const checkStockExpirations = async () => {
  console.log("📦 Début de la vérification des stocks expirés...");

  try {
    let totalNotificationsSent = 0;
    let totalErrors = 0;
    let totalLotsChecked = 0;
    let totalLotsSkipped = 0;

    // Récupérer tous les lots valides
    const allLots = await findAllValidLots();
    console.log(`  Trouvé ${allLots.length} lot(s) valide(s) à vérifier`);

    // Grouper les lots par agent pour éviter les emails multiples
    const lotsByAgent = new Map();

    // Pour chaque lot, trouver le seuil supérieur le plus proche
    for (const lot of allLots) {
      totalLotsChecked++;

      const daysRemaining = calculateDaysUntilExpiration(lot.expiration);
      const nextThreshold = findNextThreshold(daysRemaining);
      
      // Debug pour le lot qui expire le 18/12
      if (lot.id === '1e3c039e-a40b-44cd-87e1-8366b67a966d') {
        const { EXPIRATION_WARNING_DAYS } = require("../services/stockExpirationService");
        console.log(`    DEBUG - Seuils: ${EXPIRATION_WARNING_DAYS.join(', ')}, Triés: ${[...EXPIRATION_WARNING_DAYS].sort((a, b) => a - b).join(', ')}`);
      }

      if (!nextThreshold) {
        totalLotsSkipped++;
        continue;
      }

      // Vérifier si on est à moins de 24h du seuil
      // On envoie si : jours restants <= seuil ET jours restants >= seuil - 1
      // Cela signifie qu'on est dans la fenêtre de 24h avant le seuil
      const isWithin24Hours = daysRemaining <= nextThreshold && daysRemaining >= nextThreshold - 1;

      console.log(
        `  Lot ${lot.id} (vaccine: ${lot.vaccine?.name}): expire le ${new Date(lot.expiration).toLocaleDateString('fr-FR')}, jours restants: ${daysRemaining.toFixed(2)}, seuil: ${nextThreshold} jours, dans fenêtre 24h: ${isWithin24Hours}`
      );

      if (!isWithin24Hours) {
        totalLotsSkipped++;
        continue;
      }

      // Récupérer les agents concernés
      const agents = await getConcernedAgents(lot);
      console.log(`    ${agents.length} agent(s) concerné(s)`);

      for (const agent of agents) {
        const notificationType = `${nextThreshold}_DAYS`;

        // Vérifier si la notification a déjà été envoyée
        const alreadySent = await hasNotificationBeenSent(
          lot.id,
          agent.id,
          notificationType
        );

        if (alreadySent) {
          console.log(`    ⏭️  Notification déjà envoyée à ${agent.email} pour le seuil ${nextThreshold} jours`);
          continue;
        }

        console.log(`    📧 Notification à envoyer à ${agent.email} pour le seuil ${nextThreshold} jours`);

        // Ajouter le lot à la liste de l'agent
        if (!lotsByAgent.has(agent.email)) {
          lotsByAgent.set(agent.email, {
            agent,
            lots: [],
          });
        }

        const agentData = lotsByAgent.get(agent.email);
        agentData.lots.push({
          ...lot,
          daysBeforeExpiration: nextThreshold,
        });
      }
    }

    console.log(
      `  ${totalLotsChecked} lot(s) vérifié(s), ${totalLotsSkipped} lot(s) ignoré(s) (pas encore au seuil)`
    );

    // Envoyer les emails groupés par agent
    for (const [email, { agent, lots }] of lotsByAgent.entries()) {
      try {
        const ownerInfo = await getOwnerInfo(lots[0]);

        const result = await sendStockExpirationAlert({
          email: agent.email,
          agentName: `${agent.firstName} ${agent.lastName}`,
          lots: lots.map((lot) => ({
            vaccine: lot.vaccine,
            remainingQuantity: lot.remainingQuantity,
            expiration: lot.expiration,
            daysBeforeExpiration: lot.daysBeforeExpiration,
          })),
          ownerInfo,
        });

        if (result.success) {
          // Enregistrer chaque notification
          for (const lot of lots) {
            await recordNotificationSent(
              lot.id,
              agent.id,
              lot.expiration,
              lot.daysBeforeExpiration,
              `${lot.daysBeforeExpiration}_DAYS`
            );
          }

          totalNotificationsSent += lots.length;
          console.log(
            `  ✅ Email envoyé à ${agent.email} pour ${lots.length} lot(s)`
          );
        } else {
          console.error(
            `  ❌ Erreur envoi email à ${agent.email}:`,
            result.error
          );
          totalErrors++;
        }
      } catch (error) {
        console.error(
          `  ❌ Erreur lors de l'envoi à ${agent.email}:`,
          error.message
        );
        totalErrors++;
      }
    }

    console.log(
      `✅ Vérification terminée : ${totalNotificationsSent} notification(s) envoyée(s), ${totalErrors} erreur(s)`
    );

    return {
      success: true,
      notificationsSent: totalNotificationsSent,
      errors: totalErrors,
    };
  } catch (error) {
    console.error("❌ Erreur lors de la vérification des stocks:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  checkStockExpirations,
};

