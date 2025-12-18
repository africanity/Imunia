const { Router } = require("express");
const stockController = require("../controllers/stockController");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.get(
  "/national/:vaccineId/lots",
  requireAuth,
  stockController.listNationalLots,
);
router.get(
  "/regional/:vaccineId/lots",
  requireAuth,
  stockController.listRegionalLots,
);
router.get(
  "/district/:vaccineId/lots",
  requireAuth,
  stockController.listDistrictLots,
);
router.get(
  "/health-center/:vaccineId/lots",
  requireAuth,
  stockController.listHealthCenterLots,
);
router.get("/national", requireAuth, stockController.getStockNATIONAL);
router.get("/regional", requireAuth, stockController.getStockREGIONAL);
router.get("/district", requireAuth, stockController.getStockDISTRICT);
router.get("/health-center", requireAuth, stockController.getStockHEALTHCENTER);

router.post("/national", requireAuth, stockController.createStockNATIONAL);
router.post("/regional", requireAuth, stockController.createStockREGIONAL);
router.post("/district", requireAuth, stockController.createStockDISTRICT);
router.post("/health-center", requireAuth, stockController.createStockHEALTHCENTER);

router.put("/national", requireAuth, stockController.updateStockNATIONAL);
router.put("/regional", requireAuth, stockController.updateStockREGIONAL);
router.put("/district", requireAuth, stockController.updateStockDISTRICT);
router.put("/health-center", requireAuth, stockController.updateStockHEALTHCENTER);

router.put("/add-national", requireAuth, stockController.addStockNATIONAL);
router.put("/add-regional", requireAuth, stockController.addStockREGIONAL);
router.put("/add-district", requireAuth, stockController.addStockDISTRICT);
router.put("/add-health-center", requireAuth, stockController.addStockHEALTHCENTER);

router.put("/reduce-national", requireAuth, stockController.reduceStockNATIONAL);
router.put("/reduce-regional", requireAuth, stockController.reduceStockREGIONAL);
router.put("/reduce-district", requireAuth, stockController.reduceStockDISTRICT);
router.put("/reduce-health-center", requireAuth, stockController.reduceStockHEALTHCENTER);

router.post("/national/lot/:id/reduce", requireAuth, stockController.reduceLotNATIONAL);
router.delete("/lots/:id", requireAuth, stockController.deleteLot);
router.delete("/national", requireAuth, stockController.deleteStockNATIONAL);
router.delete("/regional", requireAuth, stockController.deleteStockREGIONAL);
router.delete("/district", requireAuth, stockController.deleteStockDISTRICT);
router.delete("/health-center", requireAuth, stockController.deleteStockHEALTHCENTER);

router.get("/stats/national", requireAuth, stockController.getNationalStockStats);
router.get("/stats/regional", requireAuth, stockController.getRegionalStockStats);
router.get("/stats/district", requireAuth, stockController.getDistrictStockStats);
router.get("/stats/health-center", requireAuth, stockController.getHealthCenterStockStats);

router.get("/health-center/reservations", requireAuth, stockController.getHealthCenterReservations);

router.get("/pending-transfers", requireAuth, stockController.getPendingTransfers);
router.post("/pending-transfers/:transferId/confirm", requireAuth, stockController.confirmPendingTransfer);

module.exports = router;