var chamadoModel = require("../models/chamadoModel");

function abrir(req, res) {
    var titulo = req.body.assuntoServer;
    var categoria = req.body.categoriaServer;
    var descricao = req.body.descricaoServer;
    var idUsuario = req.body.idUsuarioServer;

    if (titulo == undefined) {
        res.status(400).send("Seu assunto está undefined!");

    } else if (categoria == undefined) {
        res.status(400).send("Sua categoria está undefined!");

    } else if (descricao == undefined) {
        res.status(400).send("Sua descrição está undefined!");

    } else if (idUsuario == undefined) {
        res.status(400).send("Seu id de usuário está undefined!");

    } else {

        chamadoModel.abrir(titulo, descricao, categoria, idUsuario)
            .then(function (resultado) {
                res.json(resultado);
            })
            .catch(function (erro) {
                console.log(erro);
                res.status(500).json(erro.sqlMessage);
            });
    }
}

function listar(req, res) {
    var idUsuario = req.params.idUsuario;

    if (idUsuario == undefined) {
        res.status(400).send("Seu id de usuário está undefined!");

    } else {

        chamadoModel.listar(idUsuario)
            .then(function (resultado) {
                res.json(resultado);
            })
            .catch(function (erro) {
                console.log(erro);
                res.status(500).json(erro.sqlMessage);
            });
    }
}

module.exports = {
    abrir,
    listar
};