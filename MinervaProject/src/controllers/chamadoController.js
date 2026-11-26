var chamadoModel = require("../models/chamadoModel");

function obterIdUsuario(valor) {
    if (typeof valor !== "number" && (typeof valor !== "string" || !/^\d+$/.test(valor))) {
        return null;
    }

    var idUsuario = Number(valor);
    return Number.isInteger(idUsuario) && idUsuario > 0 && idUsuario <= 2147483647 ? idUsuario : null;
}

async function abrir(req, res) {
    var dados = req.body || {};
    var titulo = typeof dados.assuntoServer === "string" ? dados.assuntoServer.trim() : "";
    var categoria = typeof dados.categoriaServer === "string" ? dados.categoriaServer.trim() : "";
    var descricao = typeof dados.descricaoServer === "string" ? dados.descricaoServer.trim() : "";
    var idUsuario = obterIdUsuario(dados.idUsuarioServer);

    if (!titulo || titulo.length > 150) {
        return res.status(400).json({ mensagem: "Informe um assunto com até 150 caracteres." });
    }
    if (!["indicadores", "arquivos", "conta", "notificacoes", "outros"].includes(categoria)) {
        return res.status(400).json({ mensagem: "Selecione uma categoria válida." });
    }
    if (!descricao) {
        return res.status(400).json({ mensagem: "Informe a descrição do chamado." });
    }
    if (Buffer.byteLength(descricao, "utf8") > 65535) {
        return res.status(400).json({ mensagem: "A descrição é muito longa. Reduza o texto e tente novamente." });
    }
    if (idUsuario === null) {
        return res.status(400).json({ mensagem: "Usuário inválido. Faça login novamente." });
    }

    try {
        var resultado = await chamadoModel.abrir(titulo, descricao, categoria, idUsuario);
        return res.status(201).json(resultado);
    } catch (erro) {
        console.error("Erro ao abrir chamado:", erro.code || erro.message || erro);
        if (erro.code === "ER_NO_REFERENCED_ROW_2") {
            return res.status(400).json({ mensagem: "Usuário não encontrado. Faça login novamente." });
        }
        return res.status(500).json({ mensagem: "Não foi possível enviar o chamado. Tente novamente." });
    }
}

async function listar(req, res) {
    var idUsuario = obterIdUsuario(req.params.idUsuario);

    if (idUsuario === null) {
        return res.status(400).json({ mensagem: "Usuário inválido. Faça login novamente." });
    }

    try {
        var resultado = await chamadoModel.listar(idUsuario);
        return res.json(resultado);
    } catch (erro) {
        console.error("Erro ao listar chamados:", erro.code || erro.message || erro);
        return res.status(500).json({ mensagem: "Não foi possível carregar seus chamados. Tente novamente." });
    }
}

module.exports = {
    abrir,
    listar
};
