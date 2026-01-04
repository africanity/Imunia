/**
 * Vérifie si l'utilisateur a le rôle requis ou est SUPERADMIN
 * @param {Object} user - L'utilisateur à vérifier
 * @param {string|string[]} allowedRoles - Rôle(s) autorisé(s)
 * @returns {boolean} - true si l'utilisateur a les permissions
 */
const hasRole = (user, allowedRoles) => {
  if (!user || !user.role) {
    return false;
  }

  // SUPERADMIN a accès à tout
  if (user.role === "SUPERADMIN") {
    return true;
  }

  // Vérifier si le rôle de l'utilisateur est dans la liste des rôles autorisés
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return roles.includes(user.role);
};

/**
 * Middleware pour vérifier les permissions
 * @param {string|string[]} allowedRoles - Rôle(s) autorisé(s)
 * @returns {Function} - Middleware Express
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    if (!hasRole(req.user, allowedRoles)) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    next();
  };
};

module.exports = {
  hasRole,
  requireRole,
};
