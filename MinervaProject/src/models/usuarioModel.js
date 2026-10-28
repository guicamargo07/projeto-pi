var database = require("../database/config")

function autenticar(email, senha) {
    console.log("ACESSEI O USUARIO MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function entrar(): ", email, senha)
    var instrucaoSql = `
        SELECT idUsuario, nome, email, telefone, foto, sts FROM usuario WHERE email = '${email}' AND senha = '${senha}';;
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}
    
function cadastrar(nome, email, senha) {
    console.log("ACESSEI O USUARIO MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function cadastrar():", nome, email, senha);

    // Insira exatamente a query do banco aqui, lembrando da nomenclatura exata nos valores
    //  e na ordem de inserção dos dados.
    var instrucaoSql = `
        INSERT INTO usuario (nome, email, senha) VALUES ('${nome}', '${email}', '${senha}');
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function updateFoto(id, foto) {
    console.log("ACESSEI O USUARIO MODEL\n\n function updateFoto():",id,foto);
    var instrucaoSql = `
        UPDATE usuario 
        SET foto = '${foto}' 
        WHERE idUsuario = ${id};
    `;
    console.log("Executando a instrução SQL:\n" + instrucaoSql);
        return database.executar(instrucaoSql);
}

function updateEmail(id, email) {
    console.log("ACESSEI O USUARIO MODEL\n\n function updateEmail():",id,email);
    var instrucaoSql = `
        UPDATE usuario 
        SET email = '${email}' 
        WHERE idUsuario = ${id};
    `;
    console.log("Executando a instrução SQL:\n" + instrucaoSql);
        return database.executar(instrucaoSql);
}

function updateTelefone(id, telefone) {
    console.log("ACESSEI O USUARIO MODEL\n\n function updateTelefone():",id,telefone);
    var instrucaoSql = `
        UPDATE usuario 
        SET telefone = '${telefone}' 
        WHERE idUsuario = ${id};
    `;
    console.log("Executando a instrução SQL:\n" + instrucaoSql);
        return database.executar(instrucaoSql);
}

function updateNome(id, nome) {
    console.log("ACESSEI O USUARIO MODEL\n\n function updateNome():",id,nome);
    var instrucaoSql = `
        UPDATE usuario 
        SET nome = '${nome}' 
        WHERE idUsuario = ${id};
    `;
    console.log("Executando a instrução SQL:\n" + instrucaoSql);
        return database.executar(instrucaoSql);
}

function updateSenha(id, senha) {
    console.log("ACESSEI O USUARIO MODEL\n\n function updateSenha():",id,senha);
    var instrucaoSql = `
        UPDATE usuario 
        SET senha = '${senha}' 
        WHERE idUsuario = ${id};
    `;
    console.log("Executando a instrução SQL:\n" + instrucaoSql);
        return database.executar(instrucaoSql);
}

function deletar(id) {
    console.log("ACESSEI O USUARIO MODEL\n\n function updateSenha():",id);
    var instrucaoSql = `
        UPDATE usuario 
        SET sts = 0 
        WHERE idUsuario = ${id};
    `;
    console.log("Executando a instrução SQL:\n" + instrucaoSql);
        return database.executar(instrucaoSql);
}

module.exports = {
    cadastrar,
    autenticar,
    updateFoto,
    updateEmail,
    updateTelefone,
    updateNome,
    updateSenha,
    deletar
};