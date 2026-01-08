const twilio = require("twilio");
const { getAppName } = require("../utils/appName");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom =
  process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886"; // sandbox Twilio

let twilioClient = null;

if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
  console.log("✅ Client Twilio WhatsApp initialisé");
} else {
  console.warn("⚠️ Twilio credentials manquants - WhatsApp désactivé");
}

const normalizeWhatsAppNumber = (to) => {
  let phone = (to || "").trim();

  if (!phone.length) {
    throw new Error("Numéro de téléphone vide");
  }

  if (!phone.startsWith("whatsapp:")) {
    if (!phone.startsWith("+")) {
      if (phone.startsWith("221")) {
        phone = `+${phone}`;
      } else if (phone.startsWith("0")) {
        phone = `+221${phone.slice(1)}`;
      } else if (phone.length === 9) {
        phone = `+221${phone}`;
      } else {
        phone = `+${phone}`;
      }
    }
    phone = `whatsapp:${phone}`;
  }

  return phone;
};

const sendWhatsApp = async (to, message, maxRetries = 3) => {
  if (!twilioClient) {
    console.warn("⚠️ WhatsApp non configuré - message non envoyé");
    return {
      success: false,
      error: "WhatsApp non configuré",
      simulated: true,
    };
  }

  const phone = normalizeWhatsAppNumber(to);
  let lastError = null;

  // Tentative d'envoi avec retry
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`🔄 Nouvelle tentative (${attempt}/${maxRetries}) pour ${phone}...`);
        // Attendre avant de réessayer : 2 secondes pour la 2ème tentative, 4 secondes pour la 3ème
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt - 1)));
      } else {
        console.log(`📱 Envoi WhatsApp à ${phone}...`);
      }

      const result = await twilioClient.messages.create({
        from: whatsappFrom,
        to: phone,
        body: message,
      });

      console.log(`✅ WhatsApp envoyé - SID: ${result.sid}${attempt > 1 ? ` (après ${attempt} tentative(s))` : ''}`);

      return {
        success: true,
        sid: result.sid,
        status: result.status,
        to: phone,
      };
    } catch (error) {
      lastError = error;
      console.error(`❌ Erreur envoi WhatsApp (tentative ${attempt}/${maxRetries}):`, error.message);
      
      // Si ce n'est pas la dernière tentative, continuer la boucle
      if (attempt < maxRetries) {
        continue;
      }
    }
  }

  // Toutes les tentatives ont échoué
  console.error(`❌ Échec définitif après ${maxRetries} tentatives pour ${phone}`);
  return {
    success: false,
    error: lastError?.message || "Erreur inconnue",
    code: lastError?.code,
    moreInfo: lastError?.moreInfo,
  };
};

const sendAccessCodeWhatsApp = async (
  to,
  parentName,
  childName,
  accessCode
) => {
  const appName = await getAppName();
  const message = `👶 *Bienvenue sur ${appName} !*
Bonjour ${parentName}, votre enfant *${childName}* a été enregistré.

🔐 *Code d'accès :* ${accessCode}

Utilisez ce code avec votre numéro de téléphone pour activer votre espace parent dans l'application ${appName}.

💬 Besoin d'aide ? Répondez à ce message.
_${appName} - Protéger la santé de nos enfants_`;

  return sendWhatsApp(to, message);
};

const sendVerificationCodeWhatsApp = async (to, parentName, verificationCode) => {
  const appName = await getAppName();
  const message = `🔐 *Code de vérification ${appName}*

Bonjour ${parentName},

Votre code de vérification est : *${verificationCode}*

Ce code expire dans 10 minutes.

Utilisez ce code pour finaliser votre inscription dans l'application ${appName}.

💬 Besoin d'aide ? Répondez à ce message.
_${appName} - Protéger la santé de nos enfants_`;

  return sendWhatsApp(to, message);
};

const sendPhoneChangeVerificationCodeWhatsApp = async (to, parentName, verificationCode) => {
  const appName = await getAppName();
  const message = `📱 *Changement de numéro de téléphone - ${appName}*

Bonjour ${parentName},

Vous avez demandé à changer votre numéro de téléphone dans l'application ${appName}.

Votre code de vérification est : *${verificationCode}*

Ce code expire dans 10 minutes.

Utilisez ce code dans l'application pour confirmer le changement de votre numéro de téléphone.

💬 Besoin d'aide ? Répondez à ce message.
_${appName} - Protéger la santé de nos enfants_`;

  return sendWhatsApp(to, message);
};

const sendPinResetVerificationCodeWhatsApp = async (to, parentName, verificationCode) => {
  const appName = await getAppName();
  const message = `🔐 *Réinitialisation du code PIN - ${appName}*

Bonjour ${parentName},

Vous avez demandé à réinitialiser votre code PIN dans l'application ${appName}.

Votre code de vérification est : *${verificationCode}*

Ce code expire dans 10 minutes.

Utilisez ce code dans l'application pour créer un nouveau code PIN et retrouver l'accès à votre compte.

⚠️ Si vous n'avez pas fait cette demande, ignorez ce message.

💬 Besoin d'aide ? Répondez à ce message.
_${appName} - Protéger la santé de nos enfants_`;

  return sendWhatsApp(to, message);
};

const sendVaccinationReminder = async (
  to,
  parentName,
  childName,
  vaccineName,
  appointmentDate
) => {
  const appName = await getAppName();
  const message = `👋 Bonjour ${parentName},

📅 Rappel : vaccination de ${childName}
💉 ${vaccineName}
🗓️ ${appointmentDate}

N'oubliez pas d'apporter le carnet !

${appName}`;

  return sendWhatsApp(to, message);
};

const sendPhotoRequestWhatsApp = async (to, parentName, childName) => {
  const appName = await getAppName();
  const message = `📸 *Demande de nouvelles photos - ${appName}*

Bonjour ${parentName},

Nous avons besoin de photos plus claires du carnet de vaccination de *${childName}*.

Veuillez vous connecter à l'application ${appName} et télécharger de nouvelles photos pour continuer à utiliser l'application.

💬 Besoin d'aide ? Répondez à ce message.
_${appName} - Protéger la santé de nos enfants_`;

  return sendWhatsApp(to, message);
};

const sendAccountActivationWhatsApp = async (to, parentName, childName) => {
  const appName = await getAppName();
  const message = `✅ *Compte activé - ${appName}*

Bonjour ${parentName},

Le compte de *${childName}* a été activé avec succès. Vous pouvez maintenant utiliser toutes les fonctionnalités de l'application ${appName}.

💬 Besoin d'aide ? Répondez à ce message.
_${appName} - Protéger la santé de nos enfants_`;

  return sendWhatsApp(to, message);
};

module.exports = {
  sendWhatsApp,
  sendAccessCodeWhatsApp,
  sendVerificationCodeWhatsApp,
  sendPhoneChangeVerificationCodeWhatsApp,
  sendPinResetVerificationCodeWhatsApp,
  sendVaccinationReminder,
  sendPhotoRequestWhatsApp,
  sendAccountActivationWhatsApp,
};
