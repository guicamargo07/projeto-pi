const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

async function preparar() {
    const arquivoEnv = process.env.MINERVA_ENV_FILE || path.join(__dirname, "..", ".env");
    const config = dotenv.parse(fs.readFileSync(arquivoEnv));
    if (!["127.0.0.1", "localhost", "::1"].includes(config.DB_HOST)) {
        throw new Error("Este comando prepara somente o banco local indicado no .env.");
    }
    const conexao = await mysql.createConnection({
        host: config.DB_HOST,
        port: Number(config.DB_PORT || 3306),
        user: config.DB_USER,
        password: config.DB_PASSWORD,
        database: config.DB_DATABASE,
        connectTimeout: 10000
    });
    try {
        const sql = fs.readFileSync(path.join(__dirname, "..", "..", "DB", "arquivos", "002_importacao.sql"), "utf8");
        for (const instrucao of sql.split(";").map(texto => texto.trim()).filter(Boolean)) {
            try {
                await conexao.query(instrucao);
            } catch (erro) {
                // A preparação pode ser repetida; índices já existentes são mantidos.
                if (erro.code !== "ER_DUP_KEYNAME") throw erro;
            }
        }
        const [[resumo]] = await conexao.query("SELECT COUNT(*) AS registros, MIN(anoCenso) AS primeiroAno, MAX(anoCenso) AS ultimoAno FROM dadosCurso");
        console.log("Banco local preparado sem remover registros:", resumo);
    } finally {
        await conexao.end();
    }
}

preparar().catch(erro => {
    console.error("Não foi possível preparar o banco local:", erro.code || erro.message);
    process.exitCode = 1;
});
