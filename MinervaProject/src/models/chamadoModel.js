var database = require("../database/config");

function abrir(titulo, descricao, categoria, idUsuario) {
    var instrucaoSql = `
        INSERT INTO chamados (titulo, descricao, detalhe, categoria, fkUsuario)
        VALUES (?, ?, ?, ?, ?);
    `;

    // O detalhe do atendimento ainda está vazio quando o usuário abre o chamado.
    return database.executar(instrucaoSql, [titulo, descricao, "", categoria, idUsuario]);
}

function listar(idUsuario) {
    var instrucaoSql = `
        SELECT idChamado, titulo, sts, dtAbertura
        FROM chamados
        WHERE fkUsuario = ?
        ORDER BY dtAbertura DESC, idChamado DESC
        LIMIT 5;
    `;

    return database.executar(instrucaoSql, [idUsuario]);
}

module.exports = {
    abrir,
    listar
};
