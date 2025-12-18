const prisma = require("../config/prismaClient");

// Helper functions
const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getPeriodDates = (period) => {
  const now = new Date();
  const start = new Date(now);
  
  switch (period) {
    case "1month":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3months":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6months":
      start.setMonth(start.getMonth() - 6);
      break;
    case "1year":
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setMonth(start.getMonth() - 6);
  }
  
  return { start: startOfDay(start), end: now };
};

const buildMonthlyVaccinationSeries = (entries, period = "6months") => {
  const { start } = getPeriodDates(period);
  const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "short" });
  const counts = new Map();
  
  for (const entry of entries) {
    const date = new Date(entry.administeredAt || entry.scheduledFor || entry.dueDate);
    if (date < start) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  
  const series = [];
  const months = Math.ceil((new Date() - start) / (1000 * 60 * 60 * 24 * 30));
  
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const current = new Date();
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

/**
 * GET /api/reports/agent
 * Rapports pour les agents (centres de santé)
 */
const getAgentReports = async (req, res, next) => {
  if (req.user.role !== "AGENT" || !req.user.healthCenterId) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { period = "6months" } = req.query;
    const { start, end } = getPeriodDates(period);
    
    const healthCenterId = req.user.healthCenterId;
    
    // Total vaccinations
    const totalVaccinations = await prisma.childVaccineCompleted.count({
      where: {
        child: { healthCenterId },
      },
    });
    
    // This month
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const thisMonth = await prisma.childVaccineCompleted.count({
      where: {
        child: { healthCenterId },
        administeredAt: { gte: thisMonthStart },
      },
    });
    
    // This week
    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    const thisWeek = await prisma.childVaccineCompleted.count({
      where: {
        child: { healthCenterId },
        administeredAt: { gte: thisWeekStart },
      },
    });
    
    // Monthly trend
    const vaccinations = await prisma.childVaccineCompleted.findMany({
      where: {
        child: { healthCenterId },
        administeredAt: { gte: start, lte: end },
      },
      select: { administeredAt: true },
    });
    const monthlyTrendData = buildMonthlyVaccinationSeries(vaccinations, period);
    const monthlyTrend = monthlyTrendData.map((item) => ({
      month: item.month,
      count: item.value,
    }));
    
    // Stock status
    const stocks = await prisma.stockHEALTHCENTER.findMany({
      where: { healthCenterId },
      include: {
        vaccine: { select: { name: true } },
      },
    });
    
    const stockStatus = stocks.map((stock) => {
      const quantity = stock.quantity || 0;
      let status = "good";
      if (quantity < 30) status = "critical";
      else if (quantity < 50) status = "warning";
      
      return {
        vaccine: stock.vaccine?.name ?? "Vaccin inconnu",
        quantity,
        status,
      };
    });
    
    // Critical stocks (quantity < 30) - Compter les stocks du centre de santé
    const criticalStocks = stocks.filter((stock) => (stock.quantity || 0) < 30).length;
    
    // Recent activity
    const recentActivity = await prisma.childVaccineCompleted.findMany({
      where: {
        child: { healthCenterId },
      },
      take: 10,
      orderBy: { administeredAt: "desc" },
      include: {
        child: { select: { firstName: true, lastName: true } },
        vaccine: { select: { name: true } },
      },
    });
    
    res.json({
      totalVaccinations,
      thisMonth,
      thisWeek,
      criticalStocks,
      stockStatus,
      recentActivity: recentActivity.map((act) => ({
        date: act.administeredAt,
        child: `${act.child?.firstName ?? ""} ${act.child?.lastName ?? ""}`.trim() || "Enfant inconnu",
        vaccine: act.vaccine?.name ?? "Vaccin inconnu",
      })),
      monthlyTrend,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/regional
 * Rapports pour les régions
 */
const getRegionalReports = async (req, res, next) => {
  if (req.user.role !== "REGIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { period = "6months" } = req.query;
    const { start, end } = getPeriodDates(period);
    
    const regionId = req.user.regionId;
    if (!regionId) {
      return res.status(400).json({ message: "Région non associée" });
    }
    
    // Get all districts in the region
    const districts = await prisma.district.findMany({
      where: {
        commune: { regionId },
      },
      include: {
        healthCenters: {
          include: {
            childrens: true,
          },
        },
      },
    });
    
    const totalCenters = districts.length;
    
    // Get all children in the region
    const children = await prisma.children.findMany({
      where: {
        healthCenter: {
          district: {
            commune: { regionId },
          },
        },
      },
    });
    
    const totalChildren = children.length;
    
    // Total vaccinations
    const totalVaccinations = await prisma.childVaccineCompleted.count({
      where: {
        child: {
          healthCenter: {
            district: {
              commune: { regionId },
            },
          },
        },
      },
    });
    
    // Coverage rate - inclure les vaccins en retard
    const totalDueVaccines = await prisma.childVaccineDue.count({
      where: {
        child: {
          healthCenter: {
            district: {
              commune: { regionId },
            },
          },
        },
      },
    });
    
    const totalLateVaccines = await prisma.childVaccineLate.count({
      where: {
        child: {
          healthCenter: {
            district: {
              commune: { regionId },
            },
          },
        },
      },
    });
    
    // Couverture = Complétés / (Complétés + Dues + En retard) × 100%
    const totalPending = totalVaccinations + totalDueVaccines + totalLateVaccines;
    const coverageRate = totalPending > 0
      ? Math.round((totalVaccinations / totalPending) * 100)
      : 100;
    
    // Active campaigns
    const activeCampaigns = await prisma.campaign.count({
      where: {
        regionId,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });
    
    // Monthly trend
    const vaccinations = await prisma.childVaccineCompleted.findMany({
      where: {
        child: {
          healthCenter: {
            district: {
              commune: { regionId },
            },
          },
        },
        administeredAt: { gte: start, lte: end },
      },
      select: { administeredAt: true },
    });
    const monthlyTrendData = buildMonthlyVaccinationSeries(vaccinations, period);
    const monthlyTrend = monthlyTrendData.map((item) => ({
      month: item.month,
      count: item.value,
    }));
    
    // Vaccine distribution
    const vaccineStats = await prisma.childVaccineCompleted.groupBy({
      by: ["vaccineId"],
      where: {
        child: {
          healthCenter: {
            district: {
              commune: { regionId },
            },
          },
        },
      },
      _count: { id: true },
    });
    
    const totalVaccineCount = vaccineStats.reduce((sum, v) => sum + v._count.id, 0);
    const vaccineDistribution = await Promise.all(
      vaccineStats.map(async (stat) => {
        const vaccine = await prisma.vaccine.findUnique({
          where: { id: stat.vaccineId },
          select: { name: true },
        });
        return {
          vaccine: vaccine?.name || "Inconnu",
          total: stat._count.id,
          percentage: totalVaccineCount > 0
            ? Math.round((stat._count.id / totalVaccineCount) * 100)
            : 0,
        };
      })
    );
    
    // Center performance (by district)
    const centerPerformance = await Promise.all(
      districts.map(async (district) => {
        const districtChildren = await prisma.children.findMany({
          where: {
            healthCenter: { districtId: district.id },
          },
        });
        
        const districtVaccinations = await prisma.childVaccineCompleted.count({
          where: {
            child: {
              healthCenter: { districtId: district.id },
            },
          },
        });
        
        const districtDue = await prisma.childVaccineDue.count({
          where: {
            child: {
              healthCenter: { districtId: district.id },
            },
          },
        });
        
        const districtLate = await prisma.childVaccineLate.count({
          where: {
            child: {
              healthCenter: { districtId: district.id },
            },
          },
        });
        
        // Couverture = Complétés / (Complétés + Dues + En retard) × 100%
        const totalDistrictPending = districtVaccinations + districtDue + districtLate;
        const districtCoverage = totalDistrictPending > 0
          ? Math.round((districtVaccinations / totalDistrictPending) * 100)
          : 0;
        
        // Check stock status for district
        const districtStocks = await prisma.stockDISTRICT.findMany({
          where: { districtId: district.id },
        });
        
        const totalStock = districtStocks.reduce((sum, s) => sum + (s.quantity || 0), 0);
        let stockStatus = "good";
        if (totalStock < 100) stockStatus = "critical";
        else if (totalStock < 200) stockStatus = "warning";
        
        return {
          name: district.name,
          vaccinations: districtVaccinations,
          coverage: districtCoverage,
          stock: stockStatus,
        };
      })
    );
    
    // Critical stocks (quantity < 30) - Compter les stocks régionaux
    const criticalStocks = await prisma.stockREGIONAL.count({
      where: {
        regionId,
        quantity: { lt: 30 },
      },
    });
    
    // Alerts
    const alerts = [];
    if (coverageRate < 75) {
      alerts.push({
        type: "coverage",
        message: `Taux de couverture faible: ${coverageRate}%`,
        severity: "high",
      });
    }
    
    const criticalDistrictStocks = centerPerformance.filter((c) => c.stock === "critical").length;
    if (criticalDistrictStocks > 0) {
      alerts.push({
        type: "stock",
        message: `${criticalDistrictStocks} district(s) avec stocks critiques`,
        severity: "high",
      });
    }
    
    res.json({
      totalCenters,
      totalVaccinations,
      coverageRate,
      activeCampaigns,
      criticalStocks,
      centerPerformance,
      vaccineDistribution,
      monthlyTrend,
      alerts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/national
 * Rapports pour le niveau national
 */
const getNationalReports = async (req, res, next) => {
  if (req.user.role !== "NATIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { period = "6months" } = req.query;
    const { start, end } = getPeriodDates(period);
    
    // Summary
    const totalChildren = await prisma.children.count();
    const totalVaccinations = await prisma.childVaccineCompleted.count();
    const totalRegions = await prisma.region.count();
    const totalHealthCenters = await prisma.healthCenter.count();
    
    const totalDue = await prisma.childVaccineDue.count();
    const totalLate = await prisma.childVaccineLate.count();
    
    // Couverture = Complétés / (Complétés + Dues + En retard) × 100%
    const totalPending = totalVaccinations + totalDue + totalLate;
    const coverageRate = totalPending > 0
      ? Math.round((totalVaccinations / totalPending) * 100 * 10) / 10
      : 0;
    
    const campaigns = await prisma.campaign.count({
      where: {
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });
    
    // Critical stocks (quantity < 30) - Compter les stocks nationaux
    const criticalStocks = await prisma.stockNATIONAL.count({
      where: {
        quantity: { lt: 30 },
      },
    });
    
    // Monthly vaccinations
    const vaccinations = await prisma.childVaccineCompleted.findMany({
      where: {
        administeredAt: { gte: start, lte: end },
      },
      select: { administeredAt: true },
    });
    const monthlyVaccinations = buildMonthlyVaccinationSeries(vaccinations, period);
    
    // Coverage by vaccine
    const vaccineStats = await prisma.childVaccineCompleted.groupBy({
      by: ["vaccineId"],
      _count: { id: true },
    });
    
    const totalVaccineCount = vaccineStats.reduce((sum, v) => sum + v._count.id, 0);
    const coverageByVaccine = await Promise.all(
      vaccineStats.map(async (stat) => {
        const vaccine = await prisma.vaccine.findUnique({
          where: { id: stat.vaccineId },
          select: { name: true },
        });
        return {
          name: vaccine?.name || "Inconnu",
          value: stat._count.id,
          percentage: totalVaccineCount > 0
            ? Math.round((stat._count.id / totalVaccineCount) * 100)
            : 0,
        };
      })
    );
    
    // Region performance
    const regions = await prisma.region.findMany({
      include: {
        communes: {
          include: {
            district: {
              include: {
                healthCenters: {
                  include: {
                    childrens: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    
    const regionPerformance = await Promise.all(
      regions.map(async (region) => {
        const regionChildren = await prisma.children.findMany({
          where: {
            healthCenter: {
              district: {
                commune: { regionId: region.id },
              },
            },
          },
        });
        
        const regionVaccinations = await prisma.childVaccineCompleted.count({
          where: {
            child: {
              healthCenter: {
                district: {
                  commune: { regionId: region.id },
                },
              },
            },
          },
        });
        
        const regionDue = await prisma.childVaccineDue.count({
          where: {
            child: {
              healthCenter: {
                district: {
                  commune: { regionId: region.id },
                },
              },
            },
          },
        });
        
        const regionLate = await prisma.childVaccineLate.count({
          where: {
            child: {
              healthCenter: {
                district: {
                  commune: { regionId: region.id },
                },
              },
            },
          },
        });
        
        // Couverture = Complétés / (Complétés + Dues + En retard) × 100%
        const totalPending = regionVaccinations + regionDue + regionLate;
        const coverage = totalPending > 0
          ? Math.round((regionVaccinations / totalPending) * 100 * 10) / 10
          : 0;
        
        return {
          region: region.name,
          totalChildren: regionChildren.length,
          vaccinations: regionVaccinations,
          coverage,
        };
      })
    );
    
    // Top 5 best and worst regions
    const sortedRegions = [...regionPerformance].sort((a, b) => b.coverage - a.coverage);
    const top5BestRegions = sortedRegions.slice(0, 5).map((r) => ({
      region: r.region,
      coverage: r.coverage,
    }));
    const top5WorstRegions = sortedRegions.slice(-5).reverse().map((r) => ({
      region: r.region,
      coverage: r.coverage,
    }));
    
    res.json({
      summary: {
        totalChildren,
        totalVaccinations,
        totalRegions,
        totalHealthCenters,
        campaigns,
        coverageRate,
        criticalStocks,
      },
      monthlyVaccinations,
      coverageByVaccine,
      regionPerformance,
      top5BestRegions,
      top5WorstRegions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/region/:regionName
 * Détails d'une région spécifique
 */
const getRegionDetails = async (req, res, next) => {
  if (req.user.role !== "NATIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { regionName } = req.params;
    const { period = "6months" } = req.query;
    const { start, end } = getPeriodDates(period);
    
    const region = await prisma.region.findFirst({
      where: { name: regionName },
      include: {
        communes: {
          include: {
            district: true,
          },
        },
      },
    });
    
    if (!region) {
      return res.status(404).json({ message: "Région non trouvée" });
    }
    
    // Summary
    const totalChildren = await prisma.children.count({
      where: {
        healthCenter: {
          district: {
            commune: { regionId: region.id },
          },
        },
      },
    });
    
    const totalVaccinations = await prisma.childVaccineCompleted.count({
      where: {
        child: {
          healthCenter: {
            district: {
              commune: { regionId: region.id },
            },
          },
        },
      },
    });
    
    const totalDue = await prisma.childVaccineDue.count({
      where: {
        child: {
          healthCenter: {
            district: {
              commune: { regionId: region.id },
            },
          },
        },
      },
    });
    
    const totalLate = await prisma.childVaccineLate.count({
      where: {
        child: {
          healthCenter: {
            district: {
              commune: { regionId: region.id },
            },
          },
        },
      },
    });
    
    // Couverture = Complétés / (Complétés + Dues + En retard) × 100%
    const totalPending = totalVaccinations + totalDue + totalLate;
    const coverageRate = totalPending > 0
      ? Math.round((totalVaccinations / totalPending) * 100 * 10) / 10
      : 0;
    
    const overdueVaccinations = await prisma.childVaccineOverdue.count({
      where: {
        child: {
          healthCenter: {
            district: {
              commune: { regionId: region.id },
            },
          },
        },
      },
    });
    
    // District stats
    const districts = await prisma.district.findMany({
      where: {
        commune: { regionId: region.id },
      },
    });
    
    const districtStats = await Promise.all(
      districts.map(async (district) => {
        const districtChildren = await prisma.children.count({
          where: {
            healthCenter: { districtId: district.id },
          },
        });
        
        const districtVaccinations = await prisma.childVaccineCompleted.count({
          where: {
            child: {
              healthCenter: { districtId: district.id },
            },
          },
        });
        
        const districtDue = await prisma.childVaccineDue.count({
          where: {
            child: {
              healthCenter: { districtId: district.id },
            },
          },
        });
        
        const coverage = (districtVaccinations + districtDue) > 0
          ? Math.round((districtVaccinations / (districtVaccinations + districtDue)) * 100 * 10) / 10
          : 0;
        
        const agentsCount = await prisma.user.count({
          where: {
            role: "AGENT",
            healthCenter: { districtId: district.id },
            isActive: true,
          },
        });
        
        return {
          district: district.name,
          districtType: "District",
          totalChildren: districtChildren,
          vaccinations: districtVaccinations,
          coverage,
          agentsCount,
          active: true,
        };
      })
    );
    
    // Monthly vaccinations
    const vaccinations = await prisma.childVaccineCompleted.findMany({
      where: {
        child: {
          healthCenter: {
            district: {
              commune: { regionId: region.id },
            },
          },
        },
        administeredAt: { gte: start, lte: end },
      },
      select: { administeredAt: true },
    });
    const monthlyVaccinations = buildMonthlyVaccinationSeries(vaccinations, period);
    
    // Vaccine distribution
    const vaccineStats = await prisma.childVaccineCompleted.groupBy({
      by: ["vaccineId"],
      where: {
        child: {
          healthCenter: {
            district: {
              commune: { regionId: region.id },
            },
          },
        },
      },
      _count: { id: true },
    });
    
    const vaccineDistribution = await Promise.all(
      vaccineStats.map(async (stat) => {
        const vaccine = await prisma.vaccine.findUnique({
          where: { id: stat.vaccineId },
          select: { name: true },
        });
        return {
          name: vaccine?.name || "Inconnu",
          value: stat._count.id,
        };
      })
    );
    
    res.json({
      region: region.name,
      summary: {
        totalChildren,
        totalVaccinations,
        coverageRate,
        totalDistricts: districts.length,
        overdueVaccinations,
      },
      districtStats,
      vaccineDistribution,
      monthlyVaccinations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/district/:regionName/:districtName
 * Détails d'un district spécifique
 */
const getDistrictDetails = async (req, res, next) => {
  if (req.user.role !== "NATIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { regionName, districtName } = req.params;
    const { period = "6months" } = req.query;
    const { start, end } = getPeriodDates(period);
    
    const region = await prisma.region.findFirst({
      where: { name: regionName },
    });
    
    if (!region) {
      return res.status(404).json({ message: "Région non trouvée" });
    }
    
    const district = await prisma.district.findFirst({
      where: {
        name: districtName,
        commune: { regionId: region.id },
      },
      include: {
        healthCenters: true,
      },
    });
    
    if (!district) {
      return res.status(404).json({ message: "District non trouvé" });
    }
    
    // Summary
    const totalChildren = await prisma.children.count({
      where: {
        healthCenter: { districtId: district.id },
      },
    });
    
    const totalVaccinations = await prisma.childVaccineCompleted.count({
      where: {
        child: {
          healthCenter: { districtId: district.id },
        },
      },
    });
    
    const totalDue = await prisma.childVaccineDue.count({
      where: {
        child: {
          healthCenter: { districtId: district.id },
        },
      },
    });
    
    const totalLate = await prisma.childVaccineLate.count({
      where: {
        child: {
          healthCenter: { districtId: district.id },
        },
      },
    });
    
    // Couverture = Complétés / (Complétés + Dues + En retard) × 100%
    const totalPending = totalVaccinations + totalDue + totalLate;
    const coverageRate = totalPending > 0
      ? Math.round((totalVaccinations / totalPending) * 100 * 10) / 10
      : 0;
    
    const overdueVaccinations = await prisma.childVaccineOverdue.count({
      where: {
        child: {
          healthCenter: { districtId: district.id },
        },
      },
    });
    
    const totalAgents = await prisma.user.count({
      where: {
        role: "AGENT",
        healthCenter: { districtId: district.id },
      },
    });
    
    const activeAgents = await prisma.user.count({
      where: {
        role: "AGENT",
        healthCenter: { districtId: district.id },
        isActive: true,
      },
    });
    
    // Health center stats
    const healthCenterStats = await Promise.all(
      district.healthCenters.map(async (hc) => {
        const hcChildren = await prisma.children.count({
          where: { healthCenterId: hc.id },
        });
        
        const hcVaccinations = await prisma.childVaccineCompleted.count({
          where: {
            child: { healthCenterId: hc.id },
          },
        });
        
        const hcDue = await prisma.childVaccineDue.count({
          where: {
            child: { healthCenterId: hc.id },
          },
        });
        
        const coverage = (hcVaccinations + hcDue) > 0
          ? Math.round((hcVaccinations / (hcVaccinations + hcDue)) * 100 * 10) / 10
          : 0;
        
        const agentsCount = await prisma.user.count({
          where: {
            role: "AGENT",
            healthCenterId: hc.id,
          },
        });
        
        const activeAgentsCount = await prisma.user.count({
          where: {
            role: "AGENT",
            healthCenterId: hc.id,
            isActive: true,
          },
        });
        
        return {
          healthCenterId: hc.id,
          healthCenterName: hc.name,
          healthCenterType: "Centre de santé",
          totalChildren: hcChildren,
          vaccinations: hcVaccinations,
          coverage,
          agentsCount,
          activeAgentsCount,
          active: true,
        };
      })
    );
    
    // Monthly vaccinations
    const vaccinations = await prisma.childVaccineCompleted.findMany({
      where: {
        child: {
          healthCenter: { districtId: district.id },
        },
        administeredAt: { gte: start, lte: end },
      },
      select: { administeredAt: true },
    });
    const monthlyVaccinations = buildMonthlyVaccinationSeries(vaccinations, period);
    
    // Vaccine distribution
    const vaccineStats = await prisma.childVaccineCompleted.groupBy({
      by: ["vaccineId"],
      where: {
        child: {
          healthCenter: { districtId: district.id },
        },
      },
      _count: { id: true },
    });
    
    const vaccineDistribution = await Promise.all(
      vaccineStats.map(async (stat) => {
        const vaccine = await prisma.vaccine.findUnique({
          where: { id: stat.vaccineId },
          select: { name: true },
        });
        return {
          name: vaccine?.name || "Inconnu",
          value: stat._count.id,
        };
      })
    );
    
    res.json({
      region: region.name,
      district: district.name,
      summary: {
        totalChildren,
        totalVaccinations,
        coverageRate,
        totalHealthCenters: district.healthCenters.length,
        activeHealthCenters: district.healthCenters.length,
        totalAgents,
        activeAgents,
        overdueVaccinations,
      },
      healthCenterStats,
      monthlyVaccinations,
      vaccineDistribution,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/district
 * Rapports pour les utilisateurs DISTRICT (basé sur les centres de santé)
 */
const getDistrictReports = async (req, res, next) => {
  if (req.user.role !== "DISTRICT" || !req.user.districtId) {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { period = "6months" } = req.query;
    const { start, end } = getPeriodDates(period);
    const districtId = req.user.districtId;

    // Get district info
    const district = await prisma.district.findUnique({
      where: { id: districtId },
      include: {
        commune: {
          include: {
            region: true,
          },
        },
        healthCenters: true,
      },
    });

    if (!district) {
      return res.status(404).json({ message: "District non trouvé" });
    }

    const totalCenters = district.healthCenters.length;

    // Get all children in the district
    const children = await prisma.children.findMany({
      where: {
        healthCenter: {
          districtId,
        },
      },
    });

    const totalChildren = children.length;

    // Total vaccinations
    const totalVaccinations = await prisma.childVaccineCompleted.count({
      where: {
        child: {
          healthCenter: {
            districtId,
          },
        },
      },
    });

    // Coverage rate
    const totalDueVaccines = await prisma.childVaccineDue.count({
      where: {
        child: {
          healthCenter: {
            districtId,
          },
        },
      },
    });
    
    const totalLateVaccines = await prisma.childVaccineLate.count({
      where: {
        child: {
          healthCenter: {
            districtId,
          },
        },
      },
    });
    
    // Couverture = Complétés / (Complétés + Dues + En retard) × 100%
    const totalPending = totalVaccinations + totalDueVaccines + totalLateVaccines;
    const coverageRate = totalPending > 0
      ? Math.round((totalVaccinations / totalPending) * 100)
      : 100;

    // Monthly trend
    const vaccinations = await prisma.childVaccineCompleted.findMany({
      where: {
        child: {
          healthCenter: {
            districtId,
          },
        },
        administeredAt: { gte: start, lte: end },
      },
      select: { administeredAt: true },
    });
    const monthlyTrendData = buildMonthlyVaccinationSeries(vaccinations, period);
    const monthlyTrend = monthlyTrendData.map((item) => ({
      month: item.month,
      count: item.value,
    }));

    // Vaccine distribution
    const vaccineStats = await prisma.childVaccineCompleted.groupBy({
      by: ["vaccineId"],
      where: {
        child: {
          healthCenter: {
            districtId,
          },
        },
      },
      _count: { id: true },
    });

    const totalVaccineCount = vaccineStats.reduce((sum, v) => sum + v._count.id, 0);
    const vaccineDistribution = await Promise.all(
      vaccineStats.map(async (stat) => {
        const vaccine = await prisma.vaccine.findUnique({
          where: { id: stat.vaccineId },
          select: { name: true },
        });
        return {
          vaccine: vaccine?.name || "Inconnu",
          total: stat._count.id,
          percentage: totalVaccineCount > 0
            ? Math.round((stat._count.id / totalVaccineCount) * 100)
            : 0,
        };
      })
    );

    // Health center performance
    const centerPerformance = await Promise.all(
      district.healthCenters.map(async (hc) => {
        const hcChildren = await prisma.children.count({
          where: { healthCenterId: hc.id },
        });

        const hcVaccinations = await prisma.childVaccineCompleted.count({
          where: {
            child: { healthCenterId: hc.id },
          },
        });

        const hcDue = await prisma.childVaccineDue.count({
          where: {
            child: { healthCenterId: hc.id },
          },
        });
        
        const hcLate = await prisma.childVaccineLate.count({
          where: {
            child: { healthCenterId: hc.id },
          },
        });
        
        // Couverture = Complétés / (Complétés + Dues + En retard) × 100%
        const totalHcPending = hcVaccinations + hcDue + hcLate;
        const hcCoverage = totalHcPending > 0
          ? Math.round((hcVaccinations / totalHcPending) * 100)
          : 0;

        // Check stock status for health center
        const hcStocks = await prisma.stockHEALTHCENTER.findMany({
          where: { healthCenterId: hc.id },
        });

        const totalStock = hcStocks.reduce((sum, s) => sum + (s.quantity || 0), 0);
        let stockStatus = "good";
        if (totalStock < 50) stockStatus = "critical";
        else if (totalStock < 100) stockStatus = "warning";

        return {
          name: hc.name,
          vaccinations: hcVaccinations,
          coverage: hcCoverage,
          stock: stockStatus,
        };
      })
    );

    // Critical stocks (quantity < 30) - Compter les stocks district
    const criticalStocks = await prisma.stockDISTRICT.count({
      where: {
        districtId,
        quantity: { lt: 30 },
      },
    });
    
    // Alerts
    const alerts = [];
    if (coverageRate < 75) {
      alerts.push({
        type: "coverage",
        message: `Taux de couverture faible: ${coverageRate}%`,
        severity: "high",
      });
    }

    const criticalCenterStocks = centerPerformance.filter((c) => c.stock === "critical").length;
    if (criticalCenterStocks > 0) {
      alerts.push({
        type: "stock",
        message: `${criticalCenterStocks} centre(s) de santé avec stocks critiques`,
        severity: "high",
      });
    }

    res.json({
      totalCenters,
      totalVaccinations,
      coverageRate,
      criticalStocks,
      centerPerformance,
      vaccineDistribution,
      monthlyTrend,
      alerts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/healthcenter/:regionName/:districtName/:healthCenterName
 * Détails d'un centre de santé spécifique
 */
const getHealthCenterDetails = async (req, res, next) => {
  if (req.user.role !== "NATIONAL") {
    return res.status(403).json({ message: "Accès refusé" });
  }

  try {
    const { regionName, districtName, healthCenterName } = req.params;
    const { period = "6months" } = req.query;
    const { start, end } = getPeriodDates(period);
    
    const region = await prisma.region.findFirst({
      where: { name: regionName },
    });
    
    if (!region) {
      return res.status(404).json({ message: "Région non trouvée" });
    }
    
    const district = await prisma.district.findFirst({
      where: {
        name: districtName,
        commune: { regionId: region.id },
      },
    });
    
    if (!district) {
      return res.status(404).json({ message: "District non trouvé" });
    }
    
    const healthCenter = await prisma.healthCenter.findFirst({
      where: {
        name: healthCenterName,
        districtId: district.id,
      },
    });
    
    if (!healthCenter) {
      return res.status(404).json({ message: "Centre de santé non trouvé" });
    }
    
    // Summary
    const totalChildren = await prisma.children.count({
      where: { healthCenterId: healthCenter.id },
    });
    
    const totalVaccinations = await prisma.childVaccineCompleted.count({
      where: {
        child: { healthCenterId: healthCenter.id },
      },
    });
    
    const totalDue = await prisma.childVaccineDue.count({
      where: {
        child: { healthCenterId: healthCenter.id },
      },
    });
    
    const totalLate = await prisma.childVaccineLate.count({
      where: {
        child: { healthCenterId: healthCenter.id },
      },
    });
    
    // Couverture = Complétés / (Complétés + Dues + En retard) × 100%
    const totalPending = totalVaccinations + totalDue + totalLate;
    const coverageRate = totalPending > 0
      ? Math.round((totalVaccinations / totalPending) * 100 * 10) / 10
      : 0;
    
    const overdueVaccinations = await prisma.childVaccineOverdue.count({
      where: {
        child: { healthCenterId: healthCenter.id },
      },
    });
    
    const totalAgents = await prisma.user.count({
      where: {
        role: "AGENT",
        healthCenterId: healthCenter.id,
      },
    });
    
    const activeAgents = await prisma.user.count({
      where: {
        role: "AGENT",
        healthCenterId: healthCenter.id,
        isActive: true,
      },
    });
    
    // Agent stats
    const agents = await prisma.user.findMany({
      where: {
        role: "AGENT",
        healthCenterId: healthCenter.id,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        agentLevel: true,
        isActive: true,
      },
    });
    
    const agentStats = await Promise.all(
      agents.map(async (agent) => {
        const vaccinations = await prisma.childVaccineCompleted.count({
          where: {
            administeredById: agent.id,
          },
        });
        
        const childrenVaccinated = await prisma.childVaccineCompleted.groupBy({
          by: ["childId"],
          where: {
            administeredById: agent.id,
          },
        });
        
        const completedAppointments = await prisma.childVaccineScheduled.count({
          where: {
            plannerId: agent.id,
          },
        });
        
        const missedAppointments = await prisma.childVaccineOverdue.count({
          where: {
            child: {
              healthCenterId: healthCenter.id,
            },
          },
        });
        
        const cancelledAppointments = 0; // Not tracked in current schema
        
        const successRate = completedAppointments > 0
          ? Math.round((vaccinations / completedAppointments) * 100 * 10) / 10
          : 0;
        
        return {
          agentId: agent.id,
          agentName: `${agent.firstName} ${agent.lastName}`,
          agentEmail: agent.email,
          agentPhone: agent.phone,
          agentLevel: agent.agentLevel,
          active: agent.isActive,
          vaccinations,
          childrenVaccinated: childrenVaccinated.length,
          completedAppointments,
          missedAppointments,
          cancelledAppointments,
          successRate,
        };
      })
    );
    
    // Monthly vaccinations
    const vaccinations = await prisma.childVaccineCompleted.findMany({
      where: {
        child: { healthCenterId: healthCenter.id },
        administeredAt: { gte: start, lte: end },
      },
      select: { administeredAt: true },
    });
    const monthlyVaccinations = buildMonthlyVaccinationSeries(vaccinations, period);
    
    // Vaccine distribution
    const vaccineStats = await prisma.childVaccineCompleted.groupBy({
      by: ["vaccineId"],
      where: {
        child: { healthCenterId: healthCenter.id },
      },
      _count: { id: true },
    });
    
    const vaccineDistribution = await Promise.all(
      vaccineStats.map(async (stat) => {
        const vaccine = await prisma.vaccine.findUnique({
          where: { id: stat.vaccineId },
          select: { name: true },
        });
        return {
          name: vaccine?.name || "Inconnu",
          value: stat._count.id,
        };
      })
    );
    
    res.json({
      region: region.name,
      district: district.name,
      healthCenter: healthCenter.name,
      healthCenterType: "Centre de santé",
      summary: {
        totalChildren,
        totalVaccinations,
        coverageRate,
        totalAgents,
        activeAgents,
        overdueVaccinations,
      },
      agentStats,
      monthlyVaccinations,
      vaccineDistribution,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAgentReports,
  getRegionalReports,
  getNationalReports,
  getDistrictReports,
  getRegionDetails,
  getDistrictDetails,
  getHealthCenterDetails,
};

