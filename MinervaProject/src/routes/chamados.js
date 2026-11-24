var express = require("express");
var router = express.Router();

var chamadoController = require("../controllers/chamadoController");

router.post("/abrir", function (req, res) {
    chamadoController.abrir(req, res);
});

router.get("/listar/:idUsuario", function (req, res) {
    chamadoController.listar(req, res);
});

module.exports = router;