const prisma = require("../config/prismaClient");

/**
 * Enregistre un événement dans le journal
 * @param {Object} params
 * @param {string} params.type - Type d'événement (ENTITY, USER, VACCINE, etc.)
 * @param {string} [params.subtype] - Sous-type (REGION, DISTRICT, SUPERADMIN, etc.)
 * @param {string} params.action - Action (CREATE, UPDATE, DELETE, etc.)
 * @param {Object} [params.user] - Utilisateur qui a initié l'événement (doit avoir id, firstName, lastName, email, role)
 * @param {string} [params.entityType] - Type d'entité concernée
 * @param {string} [params.entityId] - ID de l'entité concernée
 * @param {string} [params.entityName] - Nom de l'entité concernée
 * @param {Object} [params.details] - Détails de l'événement (données avant/après, etc.)
 * @param {Object} [params.metadata] - Métadonnées supplémentaires (résumé de cascade, etc.)
 */
const logEvent = async ({
  type,
  subtype = null,
  action,
  user = null,
  entityType = null,
  entityId = null,
  entityName = null,
  details = null,
  metadata = null,
}) => {
  try {
    await prisma.eventLog.create({
      data: {
        type,
        subtype,
        action,
        userId: user?.id || null,
        userFirstName: user?.firstName || null,
        userLastName: user?.lastName || null,
        userEmail: user?.email || null,
        userRole: user?.role || null,
        entityType,
        entityId,
        entityName,
        details: details ? JSON.parse(JSON.stringify(details)) : null,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      },
    });
  } catch (error) {
    // Ne pas bloquer l'application si l'enregistrement du journal échoue
    console.error("Erreur enregistrement événement dans le journal:", error);
  }
};

/**
 * Enregistre un événement en arrière-plan (non bloquant)
 */
const logEventAsync = (params) => {
  setImmediate(() => {
    logEvent(params).catch((error) => {
      console.error("Erreur enregistrement événement asynchrone:", error);
    });
  });
};

module.exports = {
  logEvent,
  logEventAsync,
};
