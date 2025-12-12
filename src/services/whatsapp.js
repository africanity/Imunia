const twilio = require("twilio");

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

const sendWhatsApp = async (to, message) => {
  if (!twilioClient) {
    console.warn("⚠️ WhatsApp non configuré - message non envoyé");
    return {
      success: false,
      error: "WhatsApp non configuré",
      simulated: true,
    };
  }

  try {
    const phone = normalizeWhatsAppNumber(to);
    console.log(`📱 Envoi WhatsApp à ${phone}...`);

    const result = await twilioClient.messages.create({
      from: whatsappFrom,
      to: phone,
      body: message,
    });

    console.log(`✅ WhatsApp envoyé - SID: ${result.sid}`);

    return {
      success: true,
      sid: result.sid,
      status: result.status,
      to: phone,
    };
  } catch (error) {
    console.error("❌ Erreur envoi WhatsApp:", error.message);
    return {
      success: false,
      error: error.message,
      code: error.code,
      moreInfo: error.moreInfo,
    };
  }
};

const sendAccessCodeWhatsApp = async (
  to,
  parentName,
  childName,
  accessCode
) => {
  const message = `👶 *Bienvenue sur Imunia !*
Bonjour ${parentName}, votre enfant *${childName}* a été enregistré.

🔐 *Code d'accès :* ${accessCode}

Utilisez ce code avec votre numéro de téléphone pour activer votre espace parent dans l'application Imunia.

💬 Besoin d'aide ? Répondez à ce message.
_Imunia - Protéger la santé de nos enfants_`;

  return sendWhatsApp(to, message);
};

const sendVerificationCodeWhatsApp = async (to, parentName, verificationCode) => {
  const message = `🔐 *Code de vérification Imunia*

Bonjour ${parentName},

Votre code de vérification est : *${verificationCode}*

Ce code expire dans 10 minutes.

Utilisez ce code pour finaliser votre inscription dans l'application Imunia.

💬 Besoin d'aide ? Répondez à ce message.
_Imunia - Protéger la santé de nos enfants_`;

  return sendWhatsApp(to, message);
};

const sendVaccinationReminder = async (
  to,
  parentName,
  childName,
  vaccineName,
  appointmentDate
) => {
  const message = `👋 Bonjour ${parentName},

📅 Rappel : vaccination de ${childName}
💉 ${vaccineName}
🗓️ ${appointmentDate}

N'oubliez pas d'apporter le carnet !

Imunia`;

  return sendWhatsApp(to, message);
};

const sendPhotoRequestWhatsApp = async (to, parentName, childName) => {
  const message = `📸 *Demande de nouvelles photos - Imunia*

Bonjour ${parentName},

Nous avons besoin de photos plus claires du carnet de vaccination de *${childName}*.

Veuillez vous connecter à l'application Imunia et télécharger de nouvelles photos pour continuer à utiliser l'application.

💬 Besoin d'aide ? Répondez à ce message.
_Imunia - Protéger la santé de nos enfants_`;

  return sendWhatsApp(to, message);
};

const sendAccountActivationWhatsApp = async (to, parentName, childName) => {
  const message = `✅ *Compte activé - Imunia*

Bonjour ${parentName},

Le compte de *${childName}* a été activé avec succès. Vous pouvez maintenant utiliser toutes les fonctionnalités de l'application Imunia.

💬 Besoin d'aide ? Répondez à ce message.
_Imunia - Protéger la santé de nos enfants_`;

  return sendWhatsApp(to, message);
};

module.exports = {
  sendWhatsApp,
  sendAccessCodeWhatsApp,
  sendVerificationCodeWhatsApp,
  sendVaccinationReminder,
  sendPhotoRequestWhatsApp,
  sendAccountActivationWhatsApp,
};
