const {
  sendAccessCodeWhatsApp,
  sendVerificationCodeWhatsApp,
  sendVaccinationReminder,
} = require("./whatsapp");

async function sendParentAccessCode({ to, parentName, childName, accessCode }) {
  const result = { success: false, detail: null };

  try {
    result.detail = await sendAccessCodeWhatsApp(
      to,
      parentName,
      childName,
      accessCode
    );
    result.success = result.detail?.success ?? false;
    return result;
  } catch (error) {
    console.error("Erreur envoi code parent WhatsApp :", error);
    result.error = error.message;
    return result;
  }
}

async function sendVerificationCode({ to, parentName, verificationCode }) {
  const result = { success: false, detail: null };

  try {
    result.detail = await sendVerificationCodeWhatsApp(
      to,
      parentName,
      verificationCode
    );
    result.success = result.detail?.success ?? false;
    return result;
  } catch (error) {
    console.error("Erreur envoi code vérification WhatsApp :", error);
    result.error = error.message;
    return result;
  }
}

async function sendVaccinationNotification({
  to,
  parentName,
  childName,
  vaccineName,
  appointmentDate,
}) {
  const result = { success: false, detail: null };

  try {
    result.detail = await sendVaccinationReminder(
      to,
      parentName,
      childName,
      vaccineName,
      appointmentDate
    );
    result.success = result.detail?.success ?? false;
    return result;
  } catch (error) {
    console.error("Erreur envoi rappel WhatsApp :", error);
    result.error = error.message;
    return result;
  }
}

module.exports = {
  sendParentAccessCode,
  sendVerificationCode,
  sendVaccinationNotification,
};