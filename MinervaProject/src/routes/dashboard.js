var express = require("express");
var router = express.Router();
var dashboardController = require("../controllers/dashboardController");

router.get("/filtros", dashboardController.filtros);
router.get("/geral", dashboardController.geral);
router.get("/retencao", dashboardController.retencao);
router.get("/expansao", dashboardController.expansao);

module.exports = router;
