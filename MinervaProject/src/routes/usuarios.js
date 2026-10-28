var express = require("express");
var router = express.Router();

var usuarioController = require("../controllers/usuarioController");

router.post("/cadastrar", function (req, res) {
    usuarioController.cadastrar(req, res);
});

router.post("/autenticar", function (req, res) {
    usuarioController.autenticar(req, res);
});

router.post("/salvarFoto", function (req, res) {
    usuarioController.salvarFoto(req, res);
});

router.post("/salvarEmail", function (req, res) {
    usuarioController.salvarEmail(req, res);
});

router.post("/salvarTelefone", function (req, res) {
    usuarioController.salvarTelefone(req, res);
});

router.post("/salvarNome", function (req, res) {
    usuarioController.salvarNome(req, res);
});

router.post("/salvarSenha", function (req, res) {
    usuarioController.salvarSenha(req, res);
});

router.post("/deletarConta", function (req, res) {
    usuarioController.deletarConta(req, res);
});


module.exports = router;
