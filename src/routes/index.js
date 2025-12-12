const { Router } = require("express");
const healthController = require("../controllers/healthController");
const usersRouter = require("./users");
const authRouter = require("./auth");

const router = Router();

router.get("/health", healthController.check);
router.use("/users", usersRouter);
router.use("/auth", authRouter);
router.use("/healthCenter", require("./healthCenter"));
router.use("/region", require("./region"));
router.use("/vaccine", require("./vaccine"));
router.use("/commune", require("./commune"));
router.use("/district", require("./district"));
router.use("/stock", require("./stock"));
router.use("/children", require("./children"));
router.use("/systemSettings", require("./systemSettings"));
router.use("/dashboard", require("./dashboard"));
router.use("/campaigns", require("./campaign"));
router.use("/advice", require("./advice"));
router.use("/mobile", require("./mobile"));
router.use("/vaccine-requests", require("./vaccineRequests"));
router.use("/reports", require("./reports"));
router.use("/vaccination-proofs", require("./vaccinationProofs"));

module.exports = router;







