const prisma = require("../config/prismaClient");

/**
 * Récupère le nom de l'application depuis les paramètres système
 * @returns {Promise<string>} Le nom de l'application ou "Imunia" par défaut
 */
const getAppName = async () => {
  try {
    const settings = await prisma.appSettings.findFirst();
    return settings?.appName || "Imunia";
  } catch (error) {
    console.error("Erreur récupération nom application:", error);
    return "Imunia";
  }
};

module.exports = { getAppName };
