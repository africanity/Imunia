const prisma = require("../config/prismaClient");

const MONTHS_TO_DISPLAY = 6;
const AGENT_LOW_STOCK_THRESHOLD = 50;
const AGENT_EXPIRY_WINDOW_DAYS = 30;
const AGENT_GRAPH_WINDOW_DAYS = 14;

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfDay = (date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const differenceInDays = (futureDate, fromDate) => {
  const diff =
    startOfDay(futureDate).getTime() - startOfDay(fromDate).getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const buildMonthlyVaccinationSeries = (entries) => {
  const now = new Date();
  const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
    month: "short",
  });
  const counts = new Map();

  for (const entry of entries) {
    const administeredAt = new Date(entry.administeredAt);
    const key = `${administeredAt.getFullYear()}-${administeredAt.getMonth()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const series = [];

  for (let offset = MONTHS_TO_DISPLAY - 1; offset >= 0; offset -= 1) {
    const current = new Date(now);
    current.setDate(1);
    current.setHours(0, 0, 0, 0);
    current.setMonth(current.getMonth() - offset);

    const key = `${current.getFullYear()}-${current.getMonth()}`;
    series.push({
      month: monthFormatter.format(current),
      value: counts.get(key) ?? 0,
    });
  }

  return series;
};

const buildCoverageByVaccine = (entries) =>
  entries
    .map((entry) => ({
      name: entry.name,
      value: entry._count.completedByChildren,
    }))
    .filter((item) => item.value > 0);

const buildTopRegionsFromLateVaccines = (entries) => {
  const regionCount = new Map();

  for (const entry of entries) {
    const regionName =
      entry.child?.healthCenter?.district?.commune?.region?.name;

    if (!regionName) continue;
    regionCount.set(regionName, (regionCount.get(regionName) ?? 0) + 1);
  }

  return Array.from(regionCount.entries())
    .map(([region, retard]) => ({ region, retard }))
    .sort((a, b) => b.retard - a.retard)
    .slice(0, 5);
};

const buildRegionChildWhere = (regionId) => ({
  healthCenter: {
    district: {
      commune: {
        regionId,
      },
    },
  },
});

const buildDistrictChildWhere = (districtId) => ({
  healthCenter: {
    districtId,
  },
});

const createMonthsWindow = () => {
  const now = new Date();
  const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
    month: "short",
  });
  const months = [];

  for (let offset = MONTHS_TO_DISPLAY - 1; offset >= 0; offset -= 1) {
    const current = new Date(now);
    current.setDate(1);
    current.setHours(0, 0, 0, 0);
    current.setMonth(current.getMonth() - offset);
    months.push({
      key: `${current.getFullYear()}-${current.getMonth()}`,
      label: monthFormatter.format(current),
      date: new Date(current),
    });
  }

  return {
    startDate: months[0]?.date ?? new Date(now.getFullYear(), now.getMonth(), 1),
    months,
  };
};

const monthKeyFromDate = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}`;
};

const getNationalDashboardStats = async (req, res, next) => {
  if (req.user.role !== "NATIONAL" && req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ message: "Accès réservé au niveau national." });
  }

  try {
    const { regionId, districtId, healthCenterId } = req.query;

    // Construire les conditions de filtre pour les enfants
    let childrenWhere = {};
    if (healthCenterId) {
      childrenWhere = { healthCenterId };
    } else if (districtId) {
      childrenWhere = { healthCenter: { districtId } };
    } else if (regionId) {
      childrenWhere = {
        healthCenter: {
          district: {
            commune: {
              regionId,
            },
          },
        },
      };
    }

    // Construire les conditions de filtre pour les vaccinations
    let vaccinationWhere = {};
    if (healthCenterId) {
      vaccinationWhere = {
        child: {
          healthCenterId,
        },
      };
    } else if (districtId) {
      vaccinationWhere = {
        child: {
          healthCenter: {
            districtId,
          },
        },
      };
    } else if (regionId) {
      vaccinationWhere = {
        child: {
          healthCenter: {
            district: {
              commune: {
                regionId,
              },
            },
          },
        },
      };
    }

    const earliestMonth = new Date();
    earliestMonth.setDate(1);
    earliestMonth.setHours(0, 0, 0, 0);
    earliestMonth.setMonth(earliestMonth.getMonth() - (MONTHS_TO_DISPLAY - 1));

    const [
      totalChildren,
      totalVaccinations,
      recentVaccinations,
      vaccinesWithCoverage,
      lateVaccines,
    ] = await Promise.all([
      prisma.children.count({ where: childrenWhere }),
      prisma.childVaccineCompleted.count({ where: vaccinationWhere }),
      prisma.childVaccineCompleted.findMany({
        where: {
          ...vaccinationWhere,
          administeredAt: {
            gte: earliestMonth,
          },
        },
        select: {
          administeredAt: true,
        },
      }),
      prisma.vaccine.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              completedByChildren: {
                where: vaccinationWhere,
              },
            },
          },
        },
      }),
      prisma.childVaccineLate.findMany({
        where: vaccinationWhere,
        select: {
          id: true,
          child: {
            select: {
              healthCenter: {
                select: {
                  district: {
                    select: {
                      commune: {
                        select: {
                          region: {
                            select: {
                              name: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    // Trier les vaccins par count et prendre les 5 premiers
    const topVaccines = vaccinesWithCoverage
      .sort((a, b) => (b._count?.completedByChildren || 0) - (a._count?.completedByChildren || 0))
      .slice(0, 5);

    const monthlyVaccinations =
      buildMonthlyVaccinationSeries(recentVaccinations);
    const coverageByVaccine = buildCoverageByVaccine(topVaccines);
    const topRegions = buildTopRegionsFromLateVaccines(lateVaccines);

    res.json({
      totalChildren,
      totalVaccinations,
      monthlyVaccinations,
      coverageByVaccine,
      topRegions,
    });
  } catch (error) {
    next(error);
  }
};

const getAgentDashboardStats = async (req, res, next) => {
  if (req.user.role !== "AGENT") {
    return res.status(403).json({ message: "Accès réservé aux agents." });
  }

  if (!req.user.healthCenterId) {
    return res
      .status(400)
      .json({ message: "Aucun centre de santé n'est associé à cet agent." });
  }

  try {
    const healthCenterId = req.user.healthCenterId;
    const today = startOfDay(new Date());
    const tomorrow = endOfDay(today);
    const expiryLimit = addDays(today, AGENT_EXPIRY_WINDOW_DAYS);
    const graphStart = startOfDay(
      addDays(today, -(AGENT_GRAPH_WINDOW_DAYS - 1)),
    );
    const earliestMonth = new Date(today);
    earliestMonth.setDate(1);
    earliestMonth.setHours(0, 0, 0, 0);
    earliestMonth.setMonth(
      earliestMonth.getMonth() - (MONTHS_TO_DISPLAY - 1),
    );

    const [
      totalChildren,
      appointmentsToday,
      totalAppointmentsPlanned,
      vaccinationsSaisies,
      remindersSent,
      lowStocksRaw,
      expiringLotsRaw,
      dosesRaw,
      monthlyVaccinationsRaw,
      coverageByVaccineGroup,
      topLateChildrenGroup,
    ] = await Promise.all([
      prisma.children.count({
        where: { healthCenterId },
      }),
      prisma.childVaccineScheduled.count({
        where: {
          child: { healthCenterId },
          scheduledFor: {
            gte: today,
            lte: tomorrow,
          },
        },
      }),
      prisma.childVaccineScheduled.count({
        where: {
          child: { healthCenterId },
          scheduledFor: {
            gte: today,
          },
        },
      }),
      prisma.childVaccineCompleted.count({
        where: {
          child: { healthCenterId },
        },
      }),
      prisma.childVaccineLate.count({
        where: {
          child: { healthCenterId },
        },
      }),
      prisma.stockHEALTHCENTER.findMany({
        where: {
          healthCenterId,
          quantity: {
            lte: AGENT_LOW_STOCK_THRESHOLD,
          },
        },
        include: {
          vaccine: {
            select: { name: true },
          },
        },
        orderBy: {
          quantity: "asc",
        },
        take: 5,
      }),
      prisma.stockLot.findMany({
        where: {
          ownerType: "HEALTHCENTER",
          ownerId: healthCenterId,
          status: "VALID",
          expiration: {
            gt: today,
            lte: expiryLimit,
          },
        },
        select: {
          id: true,
          expiration: true,
          vaccine: {
            select: { name: true },
          },
        },
        orderBy: {
          expiration: "asc",
        },
        take: 5,
      }),
      prisma.childVaccineCompleted.findMany({
        where: {
          child: { healthCenterId },
          administeredAt: {
            gte: graphStart,
            lte: tomorrow,
          },
        },
        select: {
          administeredAt: true,
        },
      }),
      prisma.childVaccineCompleted.findMany({
        where: {
          child: { healthCenterId },
          administeredAt: {
            gte: earliestMonth,
          },
        },
        select: {
          administeredAt: true,
        },
      }),
      prisma.childVaccineCompleted.groupBy({
        by: ["vaccineId"],
        where: {
          child: { healthCenterId },
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _count: {
            vaccineId: "desc",
          },
        },
        take: 5,
      }),
      prisma.childVaccineLate.groupBy({
        by: ["childId"],
        where: {
          child: { healthCenterId },
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _count: {
            childId: "desc",
          },
        },
        take: 5,
      }),
    ]);

    const lowStocks = lowStocksRaw.map((entry) => ({
      vaccine: entry.vaccine?.name ?? "Vaccin inconnu",
      remaining: entry.quantity ?? 0,
    }));

    const expiringLots = expiringLotsRaw.map((entry) => ({
      vaccine: entry.vaccine?.name ?? "Vaccin inconnu",
      lot: entry.id,
      expiresInDays: Math.max(differenceInDays(entry.expiration, today), 0),
    }));

    const doseCounts = new Map();
    for (const entry of dosesRaw) {
      const key = startOfDay(entry.administeredAt).toISOString();
      doseCounts.set(key, (doseCounts.get(key) ?? 0) + 1);
    }

    const dosesPerDay = [];
    for (let i = 0; i < AGENT_GRAPH_WINDOW_DAYS; i += 1) {
      const current = addDays(graphStart, i);
      const key = current.toISOString();
      dosesPerDay.push({
        date: key,
        value: doseCounts.get(key) ?? 0,
      });
    }

    const monthlyVaccinations =
      buildMonthlyVaccinationSeries(monthlyVaccinationsRaw);

    const vaccineIds = coverageByVaccineGroup.map(
      (entry) => entry.vaccineId,
    );
    const childIds = topLateChildrenGroup.map((entry) => entry.childId);

    const [vaccineNameList, childNameList] = await Promise.all([
      vaccineIds.length
        ? prisma.vaccine.findMany({
            where: { id: { in: vaccineIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      childIds.length
        ? prisma.children.findMany({
            where: { id: { in: childIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : Promise.resolve([]),
    ]);

    const vaccineNameMap = new Map(
      vaccineNameList.map((vaccine) => [vaccine.id, vaccine.name]),
    );
    const childNameMap = new Map(
      childNameList.map((child) => [
        child.id,
        `${child.firstName ?? ""} ${child.lastName ?? ""}`.trim() ||
          "Enfant",
      ]),
    );

    const coverageEntries = coverageByVaccineGroup.map((entry) => ({
      name: vaccineNameMap.get(entry.vaccineId) ?? "Vaccin",
      _count: {
        completedByChildren: entry._count?._all ?? 0,
      },
    }));

    const coverageByVaccine = buildCoverageByVaccine(coverageEntries);

    const topLateChildren = topLateChildrenGroup.map((entry) => ({
      name: childNameMap.get(entry.childId) ?? "Enfant",
      retard: entry._count?._all ?? 0,
    }));

    res.json({
      totalChildren,
      appointmentsToday,
      totalAppointmentsPlanned,
      vaccinationsSaisies,
      remindersSent,
      lowStocks,
      expiringLots,
      dosesPerDay,
      monthlyVaccinations,
      coverageByVaccine,
      topLateChildren,
    });
  } catch (error) {
    next(error);
  }
};

const getRegionalDashboardStats = async (req, res, next) => {
  if (req.user.role !== "REGIONAL") {
    return res.status(403).json({ message: "Accès réservé au niveau régional." });
  }

  if (!req.user.regionId) {
    return res
      .status(400)
      .json({ message: "Aucune région n'est associée à cet utilisateur." });
  }

  try {
    const regionId = req.user.regionId;
    const regionWhere = buildRegionChildWhere(regionId);

    const earliestMonth = new Date();
    earliestMonth.setDate(1);
    earliestMonth.setHours(0, 0, 0, 0);
    earliestMonth.setMonth(earliestMonth.getMonth() - (MONTHS_TO_DISPLAY - 1));

    const [
      region,
      totalChildren,
      vaccinatedChildren,
      recentVaccinations,
      coverageRaw,
      lateVaccines,
    ] = await Promise.all([
      prisma.region.findUnique({
        where: { id: regionId },
        select: { name: true },
      }),
      prisma.children.count({
        where: regionWhere,
      }),
      prisma.children.count({
        where: {
          ...regionWhere,
          completedVaccines: {
            some: {},
          },
        },
      }),
      prisma.childVaccineCompleted.findMany({
        where: {
          administeredAt: {
            gte: earliestMonth,
          },
          child: regionWhere,
        },
        select: {
          administeredAt: true,
        },
      }),
      prisma.$queryRaw`
        SELECT
          cvc."vaccineId" AS "vaccineId",
          COUNT(*)::int AS "count"
        FROM "ChildVaccineCompleted" cvc
        INNER JOIN "Children" c ON c."id" = cvc."childId"
        INNER JOIN "HealthCenter" hc ON hc."id" = c."healthCenterId"
        INNER JOIN "District" d ON d."id" = hc."districtId"
        INNER JOIN "Commune" co ON co."id" = d."communeId"
        WHERE co."regionId" = ${regionId}
        GROUP BY cvc."vaccineId"
        ORDER BY COUNT(*) DESC
        LIMIT 5
      `,
      prisma.childVaccineLate.findMany({
        where: {
          child: regionWhere,
        },
        select: {
          id: true,
          child: {
            select: {
              healthCenter: {
                select: {
                  district: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const coverageRows = Array.isArray(coverageRaw) ? coverageRaw : [];
    const vaccineIds = coverageRows
      .map((item) => item.vaccineId)
      .filter(Boolean);
    const vaccineNames =
      vaccineIds.length > 0
        ? await prisma.vaccine.findMany({
            where: { id: { in: vaccineIds } },
            select: { id: true, name: true },
          })
        : [];
    const vaccineNameMap = new Map(
      vaccineNames.map((entry) => [entry.id, entry.name]),
    );

    const coverageByVaccine = coverageRows.map((entry) => ({
      name: vaccineNameMap.get(entry.vaccineId) ?? "Vaccin inconnu",
      value: Number(entry.count ?? 0),
    }));

    const monthlyVaccinations =
      buildMonthlyVaccinationSeries(recentVaccinations);

    const topDistrictsMap = new Map();
    for (const entry of lateVaccines) {
      const districtName =
        entry.child?.healthCenter?.district?.name ?? "District inconnu";
      topDistrictsMap.set(
        districtName,
        (topDistrictsMap.get(districtName) ?? 0) + 1,
      );
    }

    const topDistricts = Array.from(topDistrictsMap.entries())
      .map(([name, retard]) => ({ name, retard }))
      .sort((a, b) => b.retard - a.retard)
      .slice(0, 5);

    const coverageRate =
      totalChildren > 0
        ? Math.round((vaccinatedChildren / totalChildren) * 100)
        : 0;

    res.json({
      region: region?.name ?? "Région",
      totalChildren,
      vaccinatedChildren,
      coverageRate,
      activeCampaigns: 0,
      monthlyVaccinations,
      coverageByVaccine,
      topDistricts,
    });
  } catch (error) {
    next(error);
  }
};

const getDistrictDashboardStats = async (req, res, next) => {
  if (req.user.role !== "DISTRICT") {
    return res
      .status(403)
      .json({ message: "Accès réservé au niveau district." });
  }

  if (!req.user.districtId) {
    return res
      .status(400)
      .json({ message: "Aucun district n'est associé à cet utilisateur." });
  }

  try {
    const districtId = req.user.districtId;
    const districtWhere = buildDistrictChildWhere(districtId);
    const { startDate, months } = createMonthsWindow();

    const [
      district,
      totalChildren,
      vaccinatedChildren,
      coverageRaw,
      lateVaccines,
      healthCenters,
      monthlyRaw,
    ] = await Promise.all([
      prisma.district.findUnique({
        where: { id: districtId },
        select: { name: true },
      }),
      prisma.children.count({
        where: districtWhere,
      }),
      prisma.children.count({
        where: {
          ...districtWhere,
          completedVaccines: {
            some: {},
          },
        },
      }),
      prisma.$queryRaw`
        SELECT
          cvc."vaccineId" AS "vaccineId",
          COUNT(*)::int AS "count"
        FROM "ChildVaccineCompleted" cvc
        INNER JOIN "Children" c ON c."id" = cvc."childId"
        INNER JOIN "HealthCenter" hc ON hc."id" = c."healthCenterId"
        WHERE hc."districtId" = ${districtId}
        GROUP BY cvc."vaccineId"
        ORDER BY COUNT(*) DESC
        LIMIT 5
      `,
      prisma.childVaccineLate.findMany({
        where: {
          child: districtWhere,
        },
        select: {
          id: true,
          child: {
            select: {
              healthCenter: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.healthCenter.findMany({
        where: { districtId },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.$queryRaw`
        SELECT
          hc."id" AS "healthCenterId",
          date_trunc('month', cvc."administeredAt") AS month_key,
          COUNT(*)::int AS "count"
        FROM "ChildVaccineCompleted" cvc
        INNER JOIN "Children" c ON c."id" = cvc."childId"
        INNER JOIN "HealthCenter" hc ON hc."id" = c."healthCenterId"
        WHERE hc."districtId" = ${districtId}
          AND cvc."administeredAt" >= ${startDate}
        GROUP BY hc."id", month_key
      `,
    ]);

    const coverageRows = Array.isArray(coverageRaw) ? coverageRaw : [];
    const vaccineIds = coverageRows
      .map((entry) => entry.vaccineId)
      .filter(Boolean);
    const vaccineNames =
      vaccineIds.length > 0
        ? await prisma.vaccine.findMany({
            where: { id: { in: vaccineIds } },
            select: { id: true, name: true },
          })
        : [];
    const vaccineNameMap = new Map(
      vaccineNames.map((entry) => [entry.id, entry.name]),
    );

    const coverageByVaccine = coverageRows.map((entry) => ({
      name: vaccineNameMap.get(entry.vaccineId) ?? "Vaccin inconnu",
      value: Number(entry.count ?? 0),
    }));

    const topHealthCentersMap = new Map();
    for (const entry of lateVaccines) {
      const centerName = entry.child?.healthCenter?.name ?? "Centre inconnu";
      topHealthCentersMap.set(
        centerName,
        (topHealthCentersMap.get(centerName) ?? 0) + 1,
      );
    }

    const topHealthCenters = Array.from(topHealthCentersMap.entries())
      .map(([name, retard]) => ({ name, retard }))
      .sort((a, b) => b.retard - a.retard)
      .slice(0, 5);

    const monthlyRows = Array.isArray(monthlyRaw) ? monthlyRaw : [];
    const monthlyByCenterMap = new Map();
    for (const row of monthlyRows) {
      const centerId = row.healthCenterId;
      if (!centerId) continue;
      const bucket =
        monthlyByCenterMap.get(centerId) ?? new Map();
      bucket.set(monthKeyFromDate(row.month_key), Number(row.count ?? 0));
      monthlyByCenterMap.set(centerId, bucket);
    }

    const seriesWithTotals = healthCenters.map((center) => {
      const counts = monthlyByCenterMap.get(center.id) ?? new Map();
      const monthly = months.map(({ key, label }) => ({
        month: label,
        value: counts.get(key) ?? 0,
      }));
      const total = monthly.reduce((sum, point) => sum + point.value, 0);
      return {
        name: center.name,
        monthly,
        total,
      };
    });

    const sortedSeries = [...seriesWithTotals].sort(
      (a, b) => b.total - a.total,
    );
    let monthlyByHealthCenter = sortedSeries.filter((series) => series.total > 0);
    if (monthlyByHealthCenter.length === 0) {
      monthlyByHealthCenter = sortedSeries;
    }
    monthlyByHealthCenter = monthlyByHealthCenter
      .slice(0, 5)
      .map(({ total, ...rest }) => rest);

    const coverageRate =
      totalChildren > 0
        ? Math.round((vaccinatedChildren / totalChildren) * 100)
        : 0;

    res.json({
      district: district?.name ?? "District",
      totalChildren,
      vaccinatedChildren,
      coverageRate,
      activeCampaigns: 0,
      coverageByVaccine,
      topHealthCenters,
      monthlyByHealthCenter,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNationalDashboardStats,
  getAgentDashboardStats,
  getRegionalDashboardStats,
  getDistrictDashboardStats,
};

