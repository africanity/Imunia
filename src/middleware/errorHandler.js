const errorHandler = (error, _req, res, _next) => {
  console.error("Error:", error);
  console.error("Stack:", error.stack);
  
  let status = error.status || 500;
  let message = error.message || "Une erreur est survenue";

  // Gérer les erreurs Prisma spécifiques
  if (error.code) {
    switch (error.code) {
      case "P2002":
        // Contrainte unique violée
        const target = error.meta?.target;
        const constraintName = error.meta?.constraint;
        const metaField = error.meta?.target?.[0] ?? error.meta?.field_name;
        const modelName = error.meta?.modelName;
        
        message = null; // On va déterminer le message
        
        // Messages spécifiques pour les rendez-vous
        if (modelName === "ChildVaccineScheduled") {
          message = "Un rendez-vous existe déjà pour cet enfant avec ce vaccin et cette dose. Veuillez modifier la date ou choisir un autre vaccin.";
        } else if (modelName === "ChildVaccineCompleted") {
          message = "Cette dose a déjà été administrée à cet enfant. Veuillez vérifier les informations.";
        } else if (modelName === "ChildVaccineDue" || modelName === "ChildVaccineLate" || modelName === "ChildVaccineOverdue") {
          message = "Un enregistrement existe déjà pour cette combinaison. Veuillez vérifier les informations.";
        }
        
        if (!message && Array.isArray(target)) {
          if (target.includes("email")) {
            message = "Cet email est déjà utilisé. Veuillez utiliser un autre email.";
          } else if (target.includes("phone")) {
            message = "Ce numéro de téléphone est déjà utilisé. Veuillez utiliser un autre numéro.";
          } else if (target.includes("code")) {
            message = "Ce code est déjà utilisé. Veuillez utiliser un autre code.";
          } else if (target.includes("name")) {
            message = "Ce nom est déjà utilisé. Veuillez utiliser un autre nom.";
          } else if (target.length > 0) {
            // Essayer de mapper le premier champ du tableau
            const fieldLabels = {
              email: "email",
              phone: "numéro de téléphone",
              code: "code",
              name: "nom",
              communeid: "commune",
              districtid: "district",
              regionid: "région",
              healthcenterid: "centre de santé",
            };
            const firstField = target[0].toLowerCase();
            const label = fieldLabels[firstField] || firstField;
            message = `Ce ${label} est déjà utilisé. Veuillez utiliser un autre ${label}.`;
          }
        }
        
        if (!message && metaField) {
          const fieldLabels = {
            email: "email",
            phone: "numéro de téléphone",
            code: "code",
            name: "nom",
            communeid: "commune",
            districtid: "district",
            regionid: "région",
            healthcenterid: "centre de santé",
          };
          const label = fieldLabels[metaField.toLowerCase()] || metaField;
          message = `Ce ${label} est déjà utilisé. Veuillez utiliser un autre ${label}.`;
        }
        
        if (!message && typeof constraintName === "string") {
          const constraintLower = constraintName.toLowerCase();
          if (constraintLower.includes("email")) {
            message = "Cet email est déjà utilisé. Veuillez utiliser un autre email.";
          } else if (constraintLower.includes("phone")) {
            message = "Ce numéro de téléphone est déjà utilisé. Veuillez utiliser un autre numéro.";
          } else if (constraintLower.includes("code")) {
            message = "Ce code est déjà utilisé. Veuillez utiliser un autre code.";
          } else if (constraintLower.includes("name")) {
            message = "Ce nom est déjà utilisé. Veuillez utiliser un autre nom.";
          } else {
            // Essayer d'extraire le nom du champ depuis le nom de la contrainte
            const parts = constraintName.split("_");
            if (parts.length >= 2) {
              const fieldCandidate = parts[parts.length - 2] || parts[parts.length - 1];
              const fieldLabels = {
                email: "email",
                phone: "numéro de téléphone",
                code: "code",
                name: "nom",
                communeid: "commune",
                districtid: "district",
                regionid: "région",
                healthcenterid: "centre de santé",
              };
              const label = fieldLabels[fieldCandidate.toLowerCase()];
              if (label) {
                message = `Ce ${label} est déjà utilisé. Veuillez utiliser un autre ${label}.`;
              }
            }
          }
        }
        
        // Si on n'a toujours pas de message, utiliser un message générique mais informatif
        if (!message) {
          message = "Une des informations saisies est déjà utilisée. Veuillez vérifier et modifier les champs concernés.";
        }
        
        status = 409;
        break;
      case "P2003":
        // Contrainte de clé étrangère violée
        message = "Une référence invalide a été fournie. Veuillez vérifier les informations saisies.";
        status = 400;
        break;
      case "P2025":
        // Enregistrement non trouvé
        message = "L'enregistrement demandé n'existe pas.";
        status = 404;
        break;
      case "P2014":
        // Contrainte de relation violée
        message = "Impossible de supprimer cet élément car il est encore utilisé dans le système.";
        status = 400;
        break;
      default:
        // Autres erreurs Prisma
        if (status >= 500) {
          message = "Une erreur de base de données est survenue. Veuillez réessayer plus tard.";
        }
    }
  } else if (status >= 500) {
    // Pour les autres erreurs serveur, utiliser un message générique mais plus clair
    message = "Une erreur est survenue lors du traitement de votre demande. Veuillez réessayer plus tard.";
  }

  res.status(status).json({
    success: false,
    ok: false,
    message,
    ...(process.env.NODE_ENV !== "production" && { error: error.message, stack: error.stack }),
  });
};

module.exports = errorHandler;

