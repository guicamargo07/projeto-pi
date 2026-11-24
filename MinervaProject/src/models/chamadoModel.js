var database = require("../database/config");

function abrir(titulo, descricao, categoria, idUsuario) {
    console.log("ACESSEI O CHAMADO MODEL \n\n function abrir():", titulo, descricao, categoria, idUsuario);

    var instrucaoSql = `
        INSERT INTO chamados (titulo, descricao, categoria, fkUsuario)
        VALUES ('${titulo}', '${descricao}', '${categoria}', ${idUsuario});
    `;

    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function listar(idUsuario) {
    console.log("ACESSEI O CHAMADO MODEL \n\n function listar():", idUsuario);

    var instrucaoSql = `
        SELECT idChamado, titulo, sts, dtAbertura
        FROM chamados
        WHERE fkUsuario = ${idUsuario}
        ORDER BY dtAbertura DESC, idChamado DESC
        LIMIT 5;
    `;

    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

module.exports = {
    abrir,
    listar
};