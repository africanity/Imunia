const prisma = require("../config/prismaClient");
const { sendVaccineRequestEmail } = require("../services/emailService");
const { notifyVaccineScheduled } = require("../services/notificationService");
const {
  reserveDoseForHealthCenter,
} = require("../services/stockLotService");

/**
 * Vérifie si un vaccin correspond au genre d'un enfant
 * @param {Object} vaccine - Le vaccin avec son champ gender (peut être null, 'M', ou 'F')
 * @param {string} childGender - Le genre de l'enfant ('M' ou 'F')
 * @returns {boolean} - true si le vaccin peut être administré à cet enfant
 */
const isVaccineSuitableForGender = (vaccine, childGender) => {
  // Si le vaccin n'a pas de genre spécifié (null), il est pour tous
  if (!vaccine.gender) {
    return true;
  }
  // Si le vaccin a un genre, il doit correspondre au genre de l'enfant
  return vaccine.gender === childGender;
};

/**
 * Réassigne automatiquement les doses pour tous les rendez-vous d'un enfant pour un vaccin donné
 * Les doses sont assignées selon l'ordre chronologique : le rendez-vous le plus proche prend la dose la plus petite disponible
 * @param {Object} tx - Transaction Prisma
 * @param {string} childId - ID de l'enfant
 * @param {string} vaccineId - ID du vaccin
 */
const reassignDosesForVaccine = async (tx, childId, vaccineId) => {
  // Récupérer tous les rendez-vous programmés pour ce vaccin et cet enfant, triés par date
  const scheduledAppointments = await tx.childVaccineScheduled.findMany({
    where: {
      childId,
      vaccineId,
    },
    orderBy: {
      scheduledFor: "asc",
    },
    select: {
      id: true,
      scheduledFor: true,
      dose: true,
    },
  });

  if (scheduledAppointments.length === 0) {
    return;
  }

  // Récupérer les doses déjà complétées pour ce vaccin
  const completedDoses = await tx.childVaccineCompleted.findMany({
    where: {
      childId,
      vaccineId,
    },
    select: {
      dose: true,
    },
  });

  const completedDoseValues = completedDoses
    .map((c) => (typeof c.dose === "number" ? c.dose : null))
    .filter((dose) => dose != null);

  // Calculer la prochaine dose disponible
  let nextDose = 1;
  while (completedDoseValues.includes(nextDose)) {
    nextDose++;
  }

  // Réassigner les doses selon l'ordre chronologique
  for (const appointment of scheduledAppointments) {
    // Si cette dose est déjà complétée, passer à la suivante
    while (completedDoseValues.includes(nextDose)) {
      nextDose++;
    }

    // Mettre à jour la dose si elle a changé
    if (appointment.dose !== nextDose) {
      await tx.childVaccineScheduled.update({
        where: { id: appointment.id },
        data: { dose: nextDose },
      });
    }

    nextDose++;
  }
};

/**
 * POST /api/mobile/children/:childId/vaccine-requests
 * Créer une demande de vaccin (pour les parents)
 */
const createVaccineRequest = async (req, res, next) => {
  try {
    const { childId } = req.params;
    const { vaccineId, vaccineCalendarId, dose: requestedDose } = req.body;

    if (!vaccineId) {
      return res.status(400).json({
        success: false,
        message: "vaccineId est requis",
      });
    }

    // Vérifier que l'enfant existe et appartient au parent
    const child = await prisma.children.findUnique({
      where: { id: childId },
      include: {
        healthCenter: {
          include: {
            district: {
              include: {
                commune: {
                  include: {
                    region: true,
                  },
                },
              },
            },
          },
        },
        vaccine: true,
      },
    });

    if (!child) {
      return res.status(404).json({
        success: false,
        message: "Enfant non trouvé",
      });
    }

    const normalizedCalendarId =
      typeof vaccineCalendarId === "string" && vaccineCalendarId.trim().length
        ? vaccineCalendarId
        : null;

    const parsePositiveInt = (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
      }
      return Math.floor(parsed);
    };

    const findDoseInBuckets = async () => {
      if (!normalizedCalendarId) {
        return null;
      }

      const bucketWhere = {
        childId,
        vaccineId,
        vaccineCalendarId: normalizedCalendarId,
      };

      const lookups = [
        prisma.childVaccineDue.findFirst({
          where: bucketWhere,
          orderBy: { dose: "asc" },
          select: { dose: true },
        }),
        prisma.childVaccineLate.findFirst({
          where: bucketWhere,
          orderBy: { dose: "asc" },
          select: { dose: true },
        }),
        prisma.childVaccineOverdue.findFirst({
          where: bucketWhere,
          orderBy: { dose: "asc" },
          select: { dose: true },
        }),
        prisma.childVaccineScheduled.findFirst({
          where: bucketWhere,
          orderBy: { dose: "asc" },
          select: { dose: true },
        }),
      ];

      for (const resolver of lookups) {
        const record = await resolver;
        if (record?.dose) {
          return record.dose;
        }
      }

      return null;
    };

    const determineNextDose = async () => {
      const filters = {
        childId,
        vaccineId,
        ...(normalizedCalendarId ? { vaccineCalendarId: normalizedCalendarId } : {}),
      };

      const [completedMax, scheduledMax, pendingMax] = await Promise.all([
        prisma.childVaccineCompleted.aggregate({
          where: filters,
          _max: { dose: true },
        }),
        prisma.childVaccineScheduled.aggregate({
          where: filters,
          _max: { dose: true },
        }),
        prisma.vaccineRequest.aggregate({
          where: { ...filters, status: "PENDING" },
          _max: { dose: true },
        }),
      ]);

      const highestExisting = Math.max(
        completedMax._max.dose ?? 0,
        scheduledMax._max.dose ?? 0,
        pendingMax._max.dose ?? 0,
      );

      return highestExisting + 1;
    };

    // Vérifier que le vaccin existe
    const vaccine = await prisma.vaccine.findUnique({
      where: { id: vaccineId },
      select: { name: true, dosesRequired: true, gender: true },
    });

    if (!vaccine) {
      return res.status(404).json({
        success: false,
        message: "Vaccin non trouvé",
      });
    }

    if (!isVaccineSuitableForGender(vaccine, child.gender)) {
      return res.status(400).json({
        success: false,
        message: "Ce vaccin n'est pas adapté au genre de l'enfant",
      });
    }

    const totalDoses = parsePositiveInt(vaccine.dosesRequired) ?? 1;
    let resolvedDose = parsePositiveInt(requestedDose);

    if (!resolvedDose) {
      resolvedDose = await findDoseInBuckets();
    }

    if (!resolvedDose) {
      resolvedDose = await determineNextDose();
    }

    if (!resolvedDose) {
      resolvedDose = 1;
    }

    if (resolvedDose > totalDoses) {
      return res.status(400).json({
        success: false,
        message:
          "Toutes les doses de ce vaccin ont déjà été administrées ou programmées.",
      });
    }

    const existingPendingRequest = await prisma.vaccineRequest.findFirst({
      where: {
        childId,
        vaccineId,
        vaccineCalendarId: normalizedCalendarId,
        dose: resolvedDose,
        status: "PENDING",
      },
    });

    if (existingPendingRequest) {
      return res.status(400).json({
        success: false,
        message:
          "Une demande est déjà en attente pour cette dose de ce vaccin.",
      });
    }

    // Créer la demande
    const request = await prisma.vaccineRequest.create({
      data: {
        childId,
        vaccineId,
        vaccineCalendarId: normalizedCalendarId,
        dose: resolvedDose,
        status: "PENDING",
      },
      include: {
        child: {
          select: {
            firstName: true,
            lastName: true,
            healthCenter: {
              select: {
                name: true,
              },
            },
          },
        },
        vaccine: {
          select: {
            name: true,
          },
        },
      },
    });

    // Récupérer les agents du centre de santé
    const agents = await prisma.user.findMany({
      where: {
        role: "AGENT",
        healthCenterId: child.healthCenterId,
        isActive: true,
      },
      select: {
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    // Envoyer un email à chaque agent
    const emailPromises = agents.map((agent) =>
      sendVaccineRequestEmail({
        agentEmail: agent.email,
        agentName: `${agent.firstName} ${agent.lastName}`.trim(),
        childName: `${child.firstName} ${child.lastName}`.trim(),
        vaccineName: vaccine.name,
        dose: resolvedDose,
        healthCenter: child.healthCenter?.name || "Non spécifié",
      })
    );

    await Promise.allSettled(emailPromises);

    res.status(201).json({
      success: true,
      message: "Demande de vaccin créée avec succès",
      request,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/vaccine-requests
 * Récupérer les demandes de vaccin (pour les agents)
 */
const getVaccineRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};

    // Filtrer par statut si fourni
    if (status) {
      where.status = status;
    }

    // Restreindre l'accès en fonction du rôle
    if (req.user.role === "AGENT" && req.user.healthCenterId) {
      where.child = {
        healthCenterId: req.user.healthCenterId,
      };
    } else if (req.user.role === "DISTRICT" && req.user.districtId) {
      where.child = {
        healthCenter: {
          districtId: req.user.districtId,
        },
      };
    } else if (req.user.role === "REGIONAL" && req.user.regionId) {
      where.child = {
        healthCenter: {
          district: {
            commune: {
              regionId: req.user.regionId,
            },
          },
        },
      };
    }

    const [requests, total] = await Promise.all([
      prisma.vaccineRequest.findMany({
      where,
      include: {
        child: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthDate: true,
            gender: true,
            healthCenter: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
        },
        vaccine: {
          select: {
            id: true,
            name: true,
            description: true,
            dosesRequired: true,
          },
        },
        vaccineCalendar: {
          select: {
            id: true,
            description: true,
          },
        },
        scheduledBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        requestedAt: "desc",
      },
      }),
      prisma.vaccineRequest.count({ where }),
    ]);

    res.json({
      success: true,
      total,
      requests,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/vaccine-requests/:id/schedule
 * Programmer un rendez-vous à partir d'une demande
 */
const scheduleVaccineRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { scheduledFor, notes } = req.body;

    if (!scheduledFor) {
      return res.status(400).json({
        success: false,
        message: "scheduledFor est requis",
      });
    }

    const scheduledDate = new Date(scheduledFor);
    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "La date de rendez-vous est invalide",
      });
    }

    const request = await prisma.vaccineRequest.findUnique({
      where: { id },
      include: {
        child: {
          select: {
            id: true,
            healthCenterId: true,
            gender: true,
          },
        },
        vaccine: {
          select: {
            id: true,
            name: true,
            dosesRequired: true,
            gender: true,
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Demande non trouvée",
      });
    }

    // Vérifier si le vaccin correspond au genre de l'enfant
    if (!isVaccineSuitableForGender(request.vaccine, request.child.gender)) {
      return res.status(400).json({
        success: false,
        message: "Ce vaccin n'est pas adapté au genre de l'enfant",
      });
    }

    // Vérifier les permissions
    if (req.user.role === "AGENT" && req.user.healthCenterId !== request.child.healthCenterId) {
      return res.status(403).json({
        success: false,
        message: "Accès refusé",
      });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Cette demande a déjà été traitée",
      });
    }

    // Créer le rendez-vous programmé
    const result = await prisma.$transaction(async (tx) => {
      // Vérifier et réserver le stock avant de créer le rendez-vous
      let reservation;
      try {
        reservation = await reserveDoseForHealthCenter(tx, {
          vaccineId: request.vaccineId,
          healthCenterId: request.child.healthCenterId,
          quantity: 1,
          appointmentDate: scheduledDate,
        });
      } catch (stockError) {
        // Capturer les erreurs de stock et les renvoyer avec un message clair
        if (stockError.status === 400) {
          throw Object.assign(new Error(stockError.message || "Stock insuffisant pour programmer ce vaccin"), { status: 400 });
        }
        throw stockError;
      }

      // Créer l'entrée dans childVaccineScheduled
      const scheduled = await tx.childVaccineScheduled.create({
        data: {
          childId: request.childId,
          vaccineId: request.vaccineId,
          vaccineCalendarId: request.vaccineCalendarId,
          scheduledFor: scheduledDate,
          plannerId: req.user.id,
          dose: request.dose ?? 1,
        },
      });

      // Créer la réservation de stock
      await tx.stockReservation.create({
        data: {
          scheduleId: scheduled.id,
          stockLotId: reservation.lotId,
          quantity: reservation.quantity,
        },
      });

      // Réassigner toutes les doses selon l'ordre chronologique
      await reassignDosesForVaccine(tx, request.childId, request.vaccineId);

      // Mettre à jour la demande
      const updatedRequest = await tx.vaccineRequest.update({
        where: { id },
        data: {
          status: "SCHEDULED",
          scheduledFor: scheduledDate,
          scheduledById: req.user.id,
          appointmentId: scheduled.id,
          notes: notes || null,
        },
        include: {
          child: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          vaccine: {
            select: {
              id: true,
              name: true,
            },
          },
          scheduledBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Mettre à jour nextAppointment avec le prochain rendez-vous le plus proche
      const nextScheduled = await tx.childVaccineScheduled.findFirst({
        where: { childId: request.childId },
        orderBy: { scheduledFor: "asc" },
        select: { scheduledFor: true, vaccineId: true, plannerId: true },
      });

      await tx.children.update({
        where: { id: request.childId },
        data: {
          nextAppointment: nextScheduled?.scheduledFor || null,
          nextVaccineId: nextScheduled?.vaccineId || null,
          nextAgentId: nextScheduled?.plannerId || null,
        },
      });

      return { scheduled, request: updatedRequest };
    });

    // Créer une notification pour le parent (après la transaction)
    // On le fait après la transaction pour éviter les problèmes de rollback
    setImmediate(async () => {
      try {
        await notifyVaccineScheduled({
          childId: request.child.id,
          vaccineName: request.vaccine.name,
          scheduledDate: scheduledDate,
        });
      } catch (notifError) {
        // Erreur silencieuse pour la notification - ne pas bloquer la réponse
      }
    });

    res.json({
      success: true,
      message: "Rendez-vous programmé avec succès",
      appointment: result.scheduled,
      request: result.request,
    });
  } catch (error) {
    // Gérer les erreurs de stock et autres erreurs avec des messages clairs
    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message || "Impossible de programmer le rendez-vous",
      });
    }
    if (error.status === 404) {
      return res.status(404).json({
        success: false,
        message: error.message || "Ressource non trouvée",
      });
    }
    if (error.status === 403) {
      return res.status(403).json({
        success: false,
        message: error.message || "Accès refusé",
      });
    }
    next(error);
  }
};

/**
 * DELETE /api/vaccine-requests/:id
 * Annuler une demande
 */
const cancelVaccineRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const request = await prisma.vaccineRequest.findUnique({
      where: { id },
      include: {
        child: {
          select: {
            healthCenterId: true,
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Demande non trouvée",
      });
    }

    // Vérifier les permissions (parent ou agent du même centre)
    if (req.user.role === "AGENT" && req.user.healthCenterId !== request.child.healthCenterId) {
      return res.status(403).json({
        success: false,
        message: "Accès refusé",
      });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Seules les demandes en attente peuvent être annulées",
      });
    }

    await prisma.vaccineRequest.update({
      where: { id },
      data: {
        status: "CANCELLED",
      },
    });

    res.json({
      success: true,
      message: "Demande annulée avec succès",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createVaccineRequest,
  getVaccineRequests,
  scheduleVaccineRequest,
  cancelVaccineRequest,
};

