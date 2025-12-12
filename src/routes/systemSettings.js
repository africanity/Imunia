  const { Router } = require("express");
  const { getSystemSettings } = require("../controllers/systemSettingsController");

  const router = Router();
  router.get("/", getSystemSettings);
  
  module.exports = router;