const nodemailer = require("nodemailer");
const { getAppName } = require("../utils/appName");

if (process.env.NODE_ENV !== "production") {
  console.log("SMTP_USER:", process.env.SMTP_USER);
  console.log("SMTP_PASS défini ? ", process.env.SMTP_PASS ? "oui" : "non");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 5000, // 5 secondes pour la connexion
  socketTimeout: 10000, // 10 secondes pour l'envoi
  greetingTimeout: 5000, // 5 secondes pour le greeting
});

const sendInvitationEmail = async ({
  email,
  token,
  role,
  region,
  healthCenter,
  district,
  user,
}) => {
  let roleDescription;

  switch (role) {
    case "AGENT":
      roleDescription = `en tant qu'<b>Agent de santé</b> du centre <b>${healthCenter || "inconnu"}</b>`;
      break;
    case "REGIONAL":
      roleDescription = `en tant qu'<b>Administrateur régional</b> de <b>${region || "inconnue"}</b>`;
      break;
    case "DISTRICT":
      roleDescription = `en tant qu'<b>Administrateur de district</b> du district <b>${district || "inconnu"}</b>`;
      break;
    case "NATIONAL":
      roleDescription = `en tant qu'<b>Administrateur national</b>`;
      break;
    default:
      roleDescription = `en tant qu'<b>Utilisateur</b>`;
  }

  console.log(process.env.FRONTEND_URL);
  
  const appName = await getAppName();
  const url = `${process.env.FRONTEND_URL}/activate?id=${user.id}&token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#2c7be5;">Bienvenue sur ${appName} 🎉</h2>
      <p>Bonjour,</p>
      <p>Vous avez été invité à rejoindre la plateforme ${appName} ${roleDescription}.</p>
      <p>Pour activer votre compte et définir votre mot de passe, cliquez sur le bouton ci-dessous :</p>
      <p style="text-align:center; margin:20px 0;">
        <a href="${url}" style="background:#2c7be5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Activer mon compte
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        🔒 Ce lien est valable <b>24 heures</b>. Si vous n'êtes pas à l'origine de cette invitation, ignorez ce message.
      </p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Invitation à rejoindre ${appName}`,
      html,
    });
    console.log("Email d'invitation envoyé :", info.response);
  } catch (error) {
    console.error("Erreur envoi invitation:", error.message);
  }
};

const sendPasswordResetEmail = async ({ email, resetLink }) => {
  const appName = await getAppName();
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#2c7be5;">Réinitialisation de mot de passe</h2>
      <p>Bonjour,</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
      <p style="text-align:center; margin:20px 0;">
        <a href="${resetLink}" style="background:#2c7be5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Réinitialiser mon mot de passe
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.
      </p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Réinitialisation de mot de passe",
      html,
    });
    console.log("Email reset envoyé :", info.response);
  } catch (error) {
    console.error("Erreur envoi reset:", error.message);
  }
};

const sendPasswordResetCode = async ({ email, code, firstName }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#2c7be5;">Code de réinitialisation de mot de passe</h2>
      <p>Bonjour ${firstName || ""},</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe. Utilisez le code suivant :</p>
      <div style="text-align:center; margin:30px 0;">
        <div style="background:#f0f4f8; border:2px dashed #2c7be5; border-radius:8px; padding:20px; display:inline-block;">
          <p style="font-size:32px; font-weight:bold; letter-spacing:8px; color:#2c7be5; margin:0; font-family:monospace;">
            ${code}
          </p>
        </div>
      </div>
      <p style="font-size:14px; color:#666;">
        Ce code est valable <b>10 minutes</b> et vous avez <b>3 tentatives</b> pour le saisir correctement.
      </p>
      <p style="font-size:12px; color:#888;">
        Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.
      </p>
    </div>
  `;

  const appName = await getAppName();
  try {
    const info = await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Code de réinitialisation de mot de passe",
      html,
    });
    console.log("Email code reset envoyé :", info.response);
  } catch (error) {
    console.error("Erreur envoi code reset:", error.message);
    throw error;
  }
};

const sendTwoFactorCode = async ({ email, code }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#2c7be5;">Code de vérification</h2>
      <p>Bonjour,</p>
      <p>Voici votre code de vérification à 2 facteurs :</p>
      <p style="font-size:24px; font-weight:bold; letter-spacing:4px;">${code}</p>
      <p style="font-size:12px; color:#888;">Ce code expire dans 5 minutes.</p>
    </div>
  `;

  const appName = await getAppName();
  try {
    const info = await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Votre code de vérification",
      html,
    });
    console.log("Email 2FA envoyé :", info.response);
  } catch (error) {
    console.error("Erreur envoi 2FA:", error.message);
  }
};

const sendInvitationParentEmail = async ({
  email,
  code,
  firstName,
  lastName,
  healthCenter,
}) => {
  const appName = await getAppName();
  const url = `${process.env.FRONTEND_URL}/activate?code=${code}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#2c7be5;">Bienvenue sur ${appName} 🎉</h2>
      <p>Bonjour chers parents,</p>
      <p>Votre enfant: ${firstName} ${lastName} a été enregistré .</p>
      <p>Pour activer votre compte et définir votre mot de passe, cliquez sur le bouton ci-dessous :</p>
      <p style="text-align:center; margin:20px 0;">
        <a href="${url}" style="background:#2c7be5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Activer mon compte
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        🔒 Ce lien est valable <b>24 heures</b>. Si vous n’êtes pas à l’origine de cette invitation, ignorez ce message.
      </p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Invitation à rejoindre ${appName}`,
      html,
    });
    console.log("Email d'invitation envoyé :", info.response);
  } catch (error) {
    console.error("Erreur envoi invitation:", error.message);
  }
};

const sendVaccineRequestEmail = async ({
  agentEmail,
  agentName,
  childName,
  vaccineName,
  dose,
  healthCenter,
}) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#2c7be5;">Nouvelle demande de vaccination</h2>
      <p>Bonjour ${agentName || "Agent"},</p>
      <p>Une nouvelle demande de vaccination a été effectuée :</p>
      <div style="background:#f5f5f5; padding:15px; border-radius:5px; margin:20px 0;">
        <p><strong>Enfant :</strong> ${childName}</p>
        <p><strong>Vaccin :</strong> ${vaccineName}</p>
        <p><strong>Dose :</strong> ${dose}</p>
        <p><strong>Centre de santé :</strong> ${healthCenter || "Non spécifié"}</p>
      </div>
      <p>Veuillez vous connecter à la plateforme pour programmer le rendez-vous.</p>
      <p style="text-align:center; margin:20px 0;">
        <a href="${process.env.FRONTEND_URL}/dashboard/rendezvous" style="background:#2c7be5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Voir les demandes
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </p>
    </div>
  `;

  const appName = await getAppName();
  try {
    const info = await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_USER}>`,
      to: agentEmail,
      subject: `Nouvelle demande de vaccination - ${vaccineName}`,
      html,
    });
    console.log("Email de demande de vaccin envoyé :", info.response);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Erreur envoi email demande vaccin:", error.message);
    return { success: false, error: error.message };
  }
};

const sendStockTransferNotificationEmail = async ({
  emails,
  userIds,
  vaccineName,
  quantity,
  regionName,
}) => {
  const appName = await getAppName();
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#2c7be5;">Nouvel envoi de stock</h2>
      <p>Bonjour,</p>
      <p>Un envoi de stock vous a été effectué depuis le niveau national :</p>
      <div style="background:#f5f5f5; padding:15px; border-radius:5px; margin:20px 0;">
        <p><strong>Vaccin :</strong> ${vaccineName}</p>
        <p><strong>Quantité :</strong> ${quantity} doses</p>
        <p><strong>Région :</strong> ${regionName || "Non spécifiée"}</p>
      </div>
      <p>Veuillez vous connecter à la plateforme pour confirmer la réception du stock une fois que vous l'aurez reçu physiquement.</p>
      <p style="text-align:center; margin:20px 0;">
        <a href="${process.env.FRONTEND_URL}/dashboard/stocks" style="background:#2c7be5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Voir les envois en attente
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </p>
    </div>
  `;

  const results = [];
  for (const email of emails) {
    try {
      const info = await transporter.sendMail({
        from: `"${await getAppName()}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Nouvel envoi de stock - ${vaccineName}`,
        html,
      });
      console.log(`Email d'envoi de stock envoyé à ${email}:`, info.response);
      results.push({ email, success: true, messageId: info.messageId });
    } catch (error) {
      console.error(`Erreur envoi email à ${email}:`, error.message);
      results.push({ email, success: false, error: error.message });
    }
  }

  // Créer les notifications pour les utilisateurs
  if (userIds && userIds.length > 0) {
    try {
      const { createNotificationsForUsers } = require("./notificationService");
      await createNotificationsForUsers({
        userIds,
        title: `Nouvel envoi de stock - ${vaccineName}`,
        message: `Un envoi de ${quantity} doses de ${vaccineName} vous a été effectué depuis le niveau national${regionName ? ` pour la région ${regionName}` : ""}.`,
        type: "STOCK_TRANSFER",
      });
    } catch (notifError) {
      console.error("Erreur création notifications:", notifError);
      // Ne pas faire échouer l'opération si la création de notifications échoue
    }
  }

  return results;
};

const sendTransferRejectedEmail = async ({
  emails,
  userIds,
  vaccineName,
  quantity,
  fromName,
  toName,
}) => {
  const appName = await getAppName();
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#ef4444;">Transfert de stock refusé</h2>
      <p>Bonjour,</p>
      <p>Un transfert de stock que vous avez envoyé a été refusé :</p>
      <div style="background:#fee2e2; padding:15px; border-radius:5px; margin:20px 0; border-left:4px solid #ef4444;">
        <p><strong>Vaccin :</strong> ${vaccineName}</p>
        <p><strong>Quantité :</strong> ${quantity} doses</p>
        <p><strong>Expéditeur :</strong> ${fromName || "Non spécifié"}</p>
        <p><strong>Destinataire :</strong> ${toName || "Non spécifié"}</p>
        <p><strong>Statut :</strong> <span style="color:#ef4444; font-weight:bold;">Refusé</span></p>
      </div>
      <p>Les quantités ont été restaurées dans votre stock.</p>
      <p style="text-align:center; margin:20px 0;">
        <a href="${process.env.FRONTEND_URL || ""}/dashboard/stocks" style="background:#2c7be5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Voir mes stocks
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </p>
    </div>
  `;

  const results = [];
  for (const email of emails) {
    try {
      const info = await transporter.sendMail({
        from: `"${await getAppName()}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Transfert refusé - ${vaccineName}`,
        html,
      });
      console.log(`Email transfert refusé envoyé à ${email}:`, info.response);
      results.push({ email, success: true, messageId: info.messageId });
    } catch (error) {
      console.error(`Erreur envoi email à ${email}:`, error.message);
      results.push({ email, success: false, error: error.message });
    }
  }

  // Créer les notifications pour les utilisateurs
  if (userIds && userIds.length > 0) {
    try {
      const { createNotificationsForUsers } = require("./notificationService");
      await createNotificationsForUsers({
        userIds,
        title: `Transfert refusé - ${vaccineName}`,
        message: `Un transfert de ${quantity} doses de ${vaccineName} que vous avez envoyé à ${toName || "le destinataire"} a été refusé. Les quantités ont été restaurées dans votre stock.`,
        type: "STOCK_TRANSFER_REJECTED",
      });
    } catch (notifError) {
      console.error("Erreur création notifications:", notifError);
    }
  }

  return results;
};

const sendTransferCancelledEmail = async ({
  emails,
  userIds,
  vaccineName,
  quantity,
  fromName,
  toName,
}) => {
  const appName = await getAppName();
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#f59e0b;">Transfert de stock annulé</h2>
      <p>Bonjour,</p>
      <p>Un transfert de stock qui vous était destiné a été annulé par l'expéditeur :</p>
      <div style="background:#fef3c7; padding:15px; border-radius:5px; margin:20px 0; border-left:4px solid #f59e0b;">
        <p><strong>Vaccin :</strong> ${vaccineName}</p>
        <p><strong>Quantité :</strong> ${quantity} doses</p>
        <p><strong>Expéditeur :</strong> ${fromName || "Non spécifié"}</p>
        <p><strong>Destinataire :</strong> ${toName || "Non spécifié"}</p>
        <p><strong>Statut :</strong> <span style="color:#f59e0b; font-weight:bold;">Annulé</span></p>
      </div>
      <p>Le transfert a été annulé et les quantités ont été restaurées dans le stock de l'expéditeur.</p>
      <p style="text-align:center; margin:20px 0;">
        <a href="${process.env.FRONTEND_URL || ""}/dashboard/stocks" style="background:#2c7be5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Voir mes stocks
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </p>
    </div>
  `;

  const results = [];
  for (const email of emails) {
    try {
      const info = await transporter.sendMail({
        from: `"${await getAppName()}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Transfert annulé - ${vaccineName}`,
        html,
      });
      console.log(`Email transfert annulé envoyé à ${email}:`, info.response);
      results.push({ email, success: true, messageId: info.messageId });
    } catch (error) {
      console.error(`Erreur envoi email à ${email}:`, error.message);
      results.push({ email, success: false, error: error.message });
    }
  }

  // Créer les notifications pour les utilisateurs
  if (userIds && userIds.length > 0) {
    try {
      const { createNotificationsForUsers } = require("./notificationService");
      await createNotificationsForUsers({
        userIds,
        title: `Transfert annulé - ${vaccineName}`,
        message: `Un transfert de ${quantity} doses de ${vaccineName} qui vous était destiné depuis ${fromName || "l'expéditeur"} a été annulé.`,
        type: "STOCK_TRANSFER_CANCELLED",
      });
    } catch (notifError) {
      console.error("Erreur création notifications:", notifError);
    }
  }

  return results;
};

const sendChildAccountActivatedEmail = async ({
  agentEmails,
  childName,
  parentName,
  healthCenterName,
}) => {
  const appName = await getAppName();
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#2c7be5;">Nouveau compte activé - ${appName}</h2>
      <p>Bonjour,</p>
      <p>Un nouveau compte a été activé directement :</p>
      <div style="background:#f5f5f5; padding:15px; border-radius:5px; margin:20px 0;">
        <p><strong>Enfant :</strong> ${childName}</p>
        <p><strong>Parent :</strong> ${parentName}</p>
        <p><strong>Centre de santé :</strong> ${healthCenterName || "Non spécifié"}</p>
        <p><strong>Statut :</strong> <span style="color:#10b981; font-weight:bold;">Compte activé</span></p>
      </div>
      <p>Le compte a été activé automatiquement car aucun vaccin n'a été sélectionné.</p>
      <p style="text-align:center; margin:20px 0;">
        <a href="${process.env.FRONTEND_URL}/dashboard/enfants" style="background:#2c7be5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Voir les enfants
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </p>
    </div>
  `;

  const results = [];
  for (const email of agentEmails) {
    try {
      const info = await transporter.sendMail({
        from: `"${await getAppName()}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Nouveau compte activé - ${childName}`,
        html,
      });
      console.log(`Email compte activé envoyé à ${email}:`, info.response);
      results.push({ email, success: true, messageId: info.messageId });
    } catch (error) {
      console.error(`Erreur envoi email à ${email}:`, error.message);
      results.push({ email, success: false, error: error.message });
    }
  }
  return results;
};

const sendChildAccountPendingEmail = async ({
  agentEmails,
  childName,
  parentName,
  healthCenterName,
}) => {
  const appName = await getAppName();
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#f59e0b;">Compte en attente de vérification - ${appName}</h2>
      <p>Bonjour,</p>
      <p>Un nouveau compte nécessite votre vérification :</p>
      <div style="background:#fef3c7; padding:15px; border-radius:5px; margin:20px 0; border-left:4px solid #f59e0b;">
        <p><strong>Enfant :</strong> ${childName}</p>
        <p><strong>Parent :</strong> ${parentName}</p>
        <p><strong>Centre de santé :</strong> ${healthCenterName || "Non spécifié"}</p>
        <p><strong>Statut :</strong> <span style="color:#f59e0b; font-weight:bold;">⏳ En attente de vérification</span></p>
      </div>
      <p>Le parent a sélectionné des vaccins et uploadé des photos. Veuillez vérifier le compte et les preuves de vaccination.</p>
      <p style="text-align:center; margin:20px 0;">
        <a href="${process.env.FRONTEND_URL}/dashboard/enfants?status=inactive" style="background:#f59e0b; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Voir les comptes en attente
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </p>
    </div>
  `;

  const results = [];
  for (const email of agentEmails) {
    try {
      const info = await transporter.sendMail({
        from: `"${await getAppName()}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Compte en attente de vérification - ${childName}`,
        html,
      });
      console.log(`Email compte en attente envoyé à ${email}:`, info.response);
      results.push({ email, success: true, messageId: info.messageId });
    } catch (error) {
      console.error(`Erreur envoi email à ${email}:`, error.message);
      results.push({ email, success: false, error: error.message });
    }
  }
  return results;
};

const sendNewPhotosUploadedEmail = async ({
  agentEmails,
  childName,
  parentName,
  healthCenterName,
}) => {
  const appName = await getAppName();
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#3b82f6;">Nouvelles photos uploadées - ${appName}</h2>
      <p>Bonjour,</p>
      <p>Le parent a uploadé de nouvelles photos du carnet de vaccination :</p>
      <div style="background:#dbeafe; padding:15px; border-radius:5px; margin:20px 0; border-left:4px solid #3b82f6;">
        <p><strong>Enfant :</strong> ${childName}</p>
        <p><strong>Parent :</strong> ${parentName}</p>
        <p><strong>Centre de santé :</strong> ${healthCenterName || "Non spécifié"}</p>
        <p><strong>Action requise :</strong> Vérifier les nouvelles photos et activer le compte si tout est correct.</p>
      </div>
      <p>Veuillez vérifier les nouvelles photos et activer le compte si tout est en ordre.</p>
      <p style="text-align:center; margin:20px 0;">
        <a href="${process.env.FRONTEND_URL}/dashboard/enfants?status=inactive" style="background:#3b82f6; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Voir les comptes en attente
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </p>
    </div>
  `;

  const results = [];
  for (const email of agentEmails) {
    try {
      const info = await transporter.sendMail({
        from: `"${await getAppName()}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Nouvelles photos uploadées - ${childName}`,
        html,
      });
      console.log(`Email nouvelles photos envoyé à ${email}:`, info.response);
      results.push({ email, success: true, messageId: info.messageId });
    } catch (error) {
      console.error(`Erreur envoi email à ${email}:`, error.message);
      results.push({ email, success: false, error: error.message });
    }
  }
  return results;
};

const sendStockExpirationAlert = async ({
  email,
  agentName,
  lots,
  ownerInfo,
}) => {
  const lotsList = lots
    .map(
      (lot) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px;">${lot.vaccine.name}</td>
      <td style="padding: 10px; text-align: center;">${lot.remainingQuantity}</td>
      <td style="padding: 10px;">${new Date(lot.expiration).toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}</td>
      <td style="padding: 10px;">
        <span style="color: ${lot.daysBeforeExpiration <= 7 ? "#ef4444" : lot.daysBeforeExpiration <= 14 ? "#f59e0b" : "#3b82f6"}; font-weight: bold;">
          ${lot.daysBeforeExpiration} jours
        </span>
      </td>
    </tr>
  `
    )
    .join("");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#ef4444;">⚠️ Alerte : Stock bientôt expiré</h2>
      <p>Bonjour ${agentName || "Agent"},</p>
      <p>Nous vous informons que certains lots de vaccins sont sur le point d'expirer dans votre ${ownerInfo.type.toLowerCase()} <b>${ownerInfo.name}</b>${ownerInfo.location ? ` (${ownerInfo.location})` : ""}.</p>
      
      <div style="background:#fef2f2; padding:15px; border-radius:5px; margin:20px 0; border-left:4px solid #ef4444;">
        <h3 style="color:#ef4444; margin-top:0;">Lots concernés :</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background:#fee2e2;">
              <th style="padding: 10px; text-align: left;">Vaccin</th>
              <th style="padding: 10px; text-align: center;">Quantité restante</th>
              <th style="padding: 10px; text-align: left;">Date d'expiration</th>
              <th style="padding: 10px; text-align: left;">Délai</th>
            </tr>
          </thead>
          <tbody>
            ${lotsList}
          </tbody>
        </table>
      </div>

      <p><strong>Action requise :</strong> Veuillez utiliser ces vaccins en priorité ou les transférer vers d'autres centres si nécessaire.</p>
      
      <p style="text-align:center; margin:20px 0;">
        <a href="${process.env.FRONTEND_URL || ""}/dashboard/stocks" style="background:#ef4444; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Voir le stock
        </a>
      </p>
      
      <p style="font-size:12px; color:#888;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </p>
    </div>
  `;

  const appName = await getAppName();
  try {
    const info = await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `⚠️ Alerte : ${lots.length} lot(s) de vaccin(s) bientôt expiré(s)`,
      html,
    });
    console.log(`Email d'alerte stock expiré envoyé à ${email}:`, info.response);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Erreur envoi email alerte stock à ${email}:`, error.message);
    return { success: false, error: error.message };
  }
};

const sendAppointmentReminderEmail = async ({
  email,
  childName,
  vaccineName,
  appointmentDate,
  healthCenterName,
  notificationType,
}) => {
  const typeMessages = {
    "1_WEEK": "dans une semaine",
    "2_DAYS": "dans 2 jours",
    "1_DAY": "demain",
    "SAME_DAY": "aujourd'hui",
  };

  const message = typeMessages[notificationType] || "prochainement";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#2c7be5;">📅 Rappel de rendez-vous de vaccination</h2>
      <p>Bonjour,</p>
      <p>Nous vous rappelons que votre enfant <b>${childName}</b> a un rendez-vous de vaccination ${message}.</p>
      
      <div style="background:#eff6ff; padding:15px; border-radius:5px; margin:20px 0; border-left:4px solid #2c7be5;">
        <p><strong>Enfant :</strong> ${childName}</p>
        <p><strong>Vaccin :</strong> ${vaccineName}</p>
        <p><strong>Date et heure :</strong> ${appointmentDate}</p>
        <p><strong>Centre de santé :</strong> ${healthCenterName || "Non spécifié"}</p>
      </div>

      <p><strong>⚠️ Important :</strong> Veuillez vous présenter au centre de santé à l'heure prévue avec le carnet de vaccination de votre enfant.</p>
      
      <p style="text-align:center; margin:20px 0;">
        <a href="${process.env.FRONTEND_URL || ""}/dashboard" style="background:#2c7be5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Voir les rendez-vous
        </a>
      </p>
      
      <p style="font-size:12px; color:#888;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </p>
    </div>
  `;

  const appName = await getAppName();
  try {
    const info = await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `📅 Rappel : Rendez-vous de vaccination ${message} - ${childName}`,
      html,
    });
    console.log(`Email rappel rendez-vous envoyé à ${email}:`, info.response);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Erreur envoi email rappel rendez-vous à ${email}:`, error.message);
    return { success: false, error: error.message };
  }
};

// ==================== NOTIFICATIONS SUPERADMIN ====================

// Notifier les utilisateurs d'une entité lors d'une action du superadmin
const sendSuperAdminEntityNotification = async ({
  emails,
  userIds,
  action,
  entityType,
  entityName,
  details,
}) => {
  const appName = await getAppName();
  const actionText = {
    created: "créée",
    updated: "modifiée",
    deleted: "supprimée",
  }[action] || "modifiée";

  const entityTypeText = {
    region: "Région",
    district: "District",
    healthcenter: "Centre de santé",
  }[entityType] || "Entité";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#2c7be5;">Notification ${appName}</h2>
      <p>Bonjour,</p>
      <p>Une ${entityTypeText.toLowerCase()} a été ${actionText} par un administrateur système :</p>
      <div style="background:#f5f5f5; padding:15px; border-radius:5px; margin:20px 0;">
        <p><strong>${entityTypeText} :</strong> ${entityName}</p>
        ${details ? `<p><strong>Détails :</strong> ${details}</p>` : ""}
      </div>
      <p>Cette modification peut affecter votre accès ou vos données. Veuillez vous connecter à la plateforme pour vérifier.</p>
      <p style="text-align:center; margin:20px 0;">
        <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#2c7be5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Accéder au tableau de bord
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </p>
    </div>
  `;

  const results = [];
  for (const email of emails) {
    try {
      const info = await transporter.sendMail({
        from: `"${await getAppName()}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `${entityTypeText} ${actionText} - Notification ${appName}`,
        html,
      });
      results.push({ email, success: true, messageId: info.messageId });
    } catch (error) {
      console.error(`Erreur envoi notification entité à ${email}:`, error.message);
      results.push({ email, success: false, error: error.message });
    }
  }

  // Créer les notifications pour les utilisateurs
  if (userIds && userIds.length > 0) {
    try {
      const { createNotificationsForUsers } = require("./notificationService");
      await createNotificationsForUsers({
        userIds,
        title: `${entityTypeText} ${actionText} - ${entityName}`,
        message: `Une ${entityTypeText.toLowerCase()} a été ${actionText} par un administrateur système${details ? ` : ${details}` : ""}.`,
        type: `ENTITY_${action.toUpperCase()}`,
      });
    } catch (notifError) {
      console.error("Erreur création notifications:", notifError);
    }
  }

  return results;
};

// Notifier les utilisateurs lors d'une action sur un utilisateur
const sendSuperAdminUserNotification = async ({
  emails,
  userIds,
  action,
  userEmail,
  userName,
  role,
  details,
}) => {
  const appName = await getAppName();
  const actionText = {
    created: "créé",
    updated: "modifié",
    deleted: "supprimé",
  }[action] || "modifié";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#2c7be5;">Notification ${appName}</h2>
      <p>Bonjour,</p>
      <p>Un utilisateur a été ${actionText} par un administrateur système :</p>
      <div style="background:#f5f5f5; padding:15px; border-radius:5px; margin:20px 0;">
        <p><strong>Utilisateur :</strong> ${userName || userEmail}</p>
        <p><strong>Email :</strong> ${userEmail}</p>
        <p><strong>Rôle :</strong> ${role}</p>
        ${details ? `<p><strong>Détails :</strong> ${details}</p>` : ""}
      </div>
      ${action === "created" ? `<p>Si cet utilisateur vous concerne, vous recevrez un email d'invitation séparé.</p>` : ""}
      <p style="text-align:center; margin:20px 0;">
        <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#2c7be5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Accéder au tableau de bord
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </p>
    </div>
  `;

  const results = [];
  for (const email of emails) {
    try {
      const info = await transporter.sendMail({
        from: `"${await getAppName()}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Utilisateur ${actionText} - Notification ${appName}`,
        html,
      });
      results.push({ email, success: true, messageId: info.messageId });
    } catch (error) {
      console.error(`Erreur envoi notification utilisateur à ${email}:`, error.message);
      results.push({ email, success: false, error: error.message });
    }
  }

  // Créer les notifications pour les utilisateurs
  if (userIds && userIds.length > 0) {
    try {
      const { createNotificationsForUsers } = require("./notificationService");
      await createNotificationsForUsers({
        userIds,
        title: `Utilisateur ${actionText} - ${userName || userEmail}`,
        message: `Un utilisateur a été ${actionText} par un administrateur système${details ? ` : ${details}` : ""}.`,
        type: `USER_${action.toUpperCase()}`,
      });
    } catch (notifError) {
      console.error("Erreur création notifications:", notifError);
    }
  }

  return results;
};

// Notifier les utilisateurs lors d'un ajustement de stock
const sendSuperAdminStockAdjustmentNotification = async ({
  emails,
  userIds,
  entityType,
  entityName,
  vaccineName,
  quantity,
  adjustmentType,
}) => {
  const adjustmentText = adjustmentType === "add" ? "ajouté" : "retiré";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#2c7be5;">Ajustement de stock</h2>
      <p>Bonjour,</p>
      <p>Un ajustement de stock a été effectué par un administrateur système :</p>
      <div style="background:#f5f5f5; padding:15px; border-radius:5px; margin:20px 0;">
        <p><strong>${entityType} :</strong> ${entityName}</p>
        <p><strong>Vaccin :</strong> ${vaccineName}</p>
        <p><strong>Quantité ${adjustmentText} :</strong> ${Math.abs(quantity)}</p>
      </div>
      <p>Veuillez vous connecter à la plateforme pour vérifier les stocks.</p>
      <p style="text-align:center; margin:20px 0;">
        <a href="${process.env.FRONTEND_URL}/dashboard/stocks" style="background:#2c7be5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Voir les stocks
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </p>
    </div>
  `;

  const appName = await getAppName();
  const results = [];
  for (const email of emails) {
    try {
      const info = await transporter.sendMail({
        from: `"${appName}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Ajustement de stock - Notification ${appName}`,
        html,
      });
      results.push({ email, success: true, messageId: info.messageId });
    } catch (error) {
      console.error(`Erreur envoi notification ajustement stock à ${email}:`, error.message);
      results.push({ email, success: false, error: error.message });
    }
  }

  // Créer les notifications pour les utilisateurs
  if (userIds && userIds.length > 0) {
    try {
      const { createNotificationsForUsers } = require("./notificationService");
      await createNotificationsForUsers({
        userIds,
        title: `Ajustement de stock - ${vaccineName}`,
        message: `Un ajustement de stock a été effectué par un administrateur système : ${Math.abs(quantity)} doses ${adjustmentText} pour ${entityName}.`,
        type: "STOCK_ADJUSTMENT",
      });
    } catch (notifError) {
      console.error("Erreur création notifications:", notifError);
    }
  }

  return results;
};

// Notifier les utilisateurs lors d'un changement de paramètres système
const sendSuperAdminSettingsNotification = async ({
  emails,
  userIds,
  settingType,
  details,
}) => {
  const settingText = {
    logo: "logo de l'application",
    name: "nom de l'application",
  }[settingType] || "paramètre système";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
      <h2 style="color:#2c7be5;">Modification des paramètres système</h2>
      <p>Bonjour,</p>
      <p>Le ${settingText} a été modifié par un administrateur système.</p>
      ${details ? `<div style="background:#f5f5f5; padding:15px; border-radius:5px; margin:20px 0;">${details}</div>` : ""}
      <p>Ces modifications sont maintenant actives sur la plateforme.</p>
      <p style="text-align:center; margin:20px 0;">
        <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#2c7be5; color:#fff; padding:12px 24px; text-decoration:none; border-radius:5px; font-size:16px;">
          Accéder au tableau de bord
        </a>
      </p>
      <p style="font-size:12px; color:#888;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </p>
    </div>
  `;

  const appName = await getAppName();
  const results = [];
  for (const email of emails) {
    try {
      const info = await transporter.sendMail({
        from: `"${appName}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Modification des paramètres système - Notification ${appName}`,
        html,
      });
      results.push({ email, success: true, messageId: info.messageId });
    } catch (error) {
      console.error(`Erreur envoi notification paramètres à ${email}:`, error.message);
      results.push({ email, success: false, error: error.message });
    }
  }
  return results;
};

module.exports = {
  sendPasswordResetCode,
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendVaccineRequestEmail,
  sendTwoFactorCode,
  sendStockTransferNotificationEmail,
  sendTransferRejectedEmail,
  sendTransferCancelledEmail,
  sendChildAccountActivatedEmail,
  sendChildAccountPendingEmail,
  sendSuperAdminEntityNotification,
  sendSuperAdminUserNotification,
  sendSuperAdminStockAdjustmentNotification,
  sendSuperAdminSettingsNotification,
  sendNewPhotosUploadedEmail,
  sendStockExpirationAlert,
  sendAppointmentReminderEmail,
};