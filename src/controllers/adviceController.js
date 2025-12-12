const prisma = require("../config/prismaClient");

/**
 * GET /api/advice
 * Liste tous les conseils (pour NATIONAL uniquement)
 */
const getAdvice = async (req, res, next) => {
  if (req.user.role !== "NATIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const advice = await prisma.advice.findMany({
      orderBy: [
        { createdAt: "desc" },
      ],
    });

    res.json({
      total: advice.length,
      items: advice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/advice
 * Créer un nouveau conseil
 */
const createAdvice = async (req, res, next) => {
  if (req.user.role !== "NATIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { title, content, category, ageUnit, minAge, maxAge, specificAge, isActive } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        message: "Le titre et le contenu sont requis",
      });
    }

    // Validation: soit specificAge, soit (minAge et maxAge)
    if (specificAge === null && (minAge === null || maxAge === null)) {
      // Si aucun âge n'est spécifié, c'est OK (conseil pour tous les âges)
    } else if (specificAge !== null && (minAge !== null || maxAge !== null)) {
      return res.status(400).json({
        message: "Utilisez soit specificAge, soit minAge/maxAge, pas les deux",
      });
    }

    const advice = await prisma.advice.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        category: category?.trim() || null,
        ageUnit: ageUnit || null,
        minAge: minAge !== null && minAge !== undefined ? parseInt(minAge) : null,
        maxAge: maxAge !== null && maxAge !== undefined ? parseInt(maxAge) : null,
        specificAge: specificAge !== null && specificAge !== undefined ? parseInt(specificAge) : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    res.status(201).json(advice);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/advice/:id
 * Mettre à jour un conseil
 */
const updateAdvice = async (req, res, next) => {
  if (req.user.role !== "NATIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { id } = req.params;
    const { title, content, category, ageUnit, minAge, maxAge, specificAge, isActive } = req.body;

    const existing = await prisma.advice.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Conseil introuvable" });
    }

    // Validation: soit specificAge, soit (minAge et maxAge)
    if (specificAge !== null && (minAge !== null || maxAge !== null)) {
      return res.status(400).json({
        message: "Utilisez soit specificAge, soit minAge/maxAge, pas les deux",
      });
    }

    const updated = await prisma.advice.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(content !== undefined && { content: content.trim() }),
        ...(category !== undefined && { category: category?.trim() || null }),
        ...(ageUnit !== undefined && { ageUnit: ageUnit || null }),
        ...(minAge !== undefined && { minAge: minAge !== null ? parseInt(minAge) : null }),
        ...(maxAge !== undefined && { maxAge: maxAge !== null ? parseInt(maxAge) : null }),
        ...(specificAge !== undefined && { specificAge: specificAge !== null ? parseInt(specificAge) : null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/advice/:id
 * Supprimer un conseil
 */
const deleteAdvice = async (req, res, next) => {
  if (req.user.role !== "NATIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { id } = req.params;

    const existing = await prisma.advice.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Conseil introuvable" });
    }

    await prisma.advice.delete({
      where: { id },
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdvice,
  createAdvice,
  updateAdvice,
  deleteAdvice,
};


