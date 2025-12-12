const tokenService = require("../services/tokenService");
const prisma = require("../config/prismaClient");

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const payload = tokenService.verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware pour l'authentification mobile (parents)
const requireMobileAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "Token manquant" });
  }

  try {
    const payload = tokenService.verifyAccessToken(token);

    // Pour les parents, le payload contient le childId dans sub
    if (payload.type !== "parent") {
      return res.status(401).json({ message: "Token invalide pour mobile" });
    }

    // Si un childId est dans l'URL (ex: /children/:childId/dashboard), vérifier qu'il correspond au token
    const urlChildId = req.params.childId;
    if (urlChildId && urlChildId !== payload.sub) {
      // Vérifier que le parent a accès à cet enfant (même numéro de téléphone)
      const child = await prisma.children.findUnique({
        where: { id: urlChildId },
        select: { phoneParent: true },
      });

      if (!child || child.phoneParent !== payload.phone) {
        return res.status(403).json({ message: "Accès refusé" });
      }
    }

    // Vérifier que l'enfant existe
    const child = await prisma.children.findUnique({
      where: { id: urlChildId || payload.sub },
    });

    if (!child) {
      return res.status(401).json({ message: "Enfant non trouvé" });
    }

    req.childId = urlChildId || payload.sub;
    req.parentPhone = payload.phone;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token invalide" });
  }
};

// Middleware pour accepter le token dans le header OU en paramètre de requête (pour affichage direct d'images)
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  let token = authHeader.replace("Bearer ", "");
  
  // Si pas de token dans le header, chercher dans les paramètres de requête
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const payload = tokenService.verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requireAuth,
  requireMobileAuth,
  optionalAuth,
};