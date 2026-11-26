var dashboardModel = require("../models/dashboardModel");
var geografia = require("../models/geografia");

const PAINEIS = ["geral", "retencao", "expansao"];
const CAMPOS = ["anoInicio", "anoFim", "regiao", "uf", "localizacao", "modalidade", "curso", "area"];

function invalido(mensagem) {
    const erro = new Error(mensagem);
    erro.statusCode = 400;
    throw erro;
}

function texto(query, campo) {
    const valor = query[campo];
    if (valor === undefined) return undefined;
    if (typeof valor !== "string" || !valor.trim()) invalido("Filtro inválido: " + campo + ".");
    return valor.trim();
}

function inteiro(query, campo, minimo, maximo) {
    const valor = texto(query, campo);
    if (valor === undefined) return undefined;
    if (!/^\d+$/.test(valor)) invalido("Filtro inválido: " + campo + ".");
    const numero = Number(valor);
    if (!Number.isSafeInteger(numero) || numero < minimo || numero > maximo) {
        invalido("Filtro inválido: " + campo + ".");
    }
    return numero;
}

function validarFiltros(query) {
    if (Object.keys(query).some(campo => !CAMPOS.includes(campo))) invalido("Filtro desconhecido.");
    const filtros = {
        anoInicio: inteiro(query, "anoInicio", 1900, 2100),
        anoFim: inteiro(query, "anoFim", 1900, 2100),
        localizacao: inteiro(query, "localizacao", 1, 2147483647),
        modalidade: inteiro(query, "modalidade", 1, 2),
        curso: inteiro(query, "curso", 1, 2147483647)
    };
    const regiaoRecebida = texto(query, "regiao");
    const regiao = regiaoRecebida === geografia.REGIAO_AUSENTE ? regiaoRecebida :
        geografia.regioes.find(item => item.toLowerCase() === regiaoRecebida?.toLowerCase());
    if (regiaoRecebida !== undefined && !regiao) {
        invalido("Filtro inválido: regiao.");
    }
    const uf = texto(query, "uf");
    if (uf !== undefined && uf !== geografia.UF_AUSENTE && !geografia.ufValida(uf)) invalido("Filtro inválido: uf.");
    const area = texto(query, "area");
    if (area !== undefined && (area.length > 150 || /[\u0000-\u001f]/.test(area))) invalido("Filtro inválido: area.");
    filtros.area = area;
    filtros.regiao = regiao;
    filtros.uf = uf === undefined || uf === geografia.UF_AUSENTE ? uf : uf.toUpperCase();
    if (filtros.anoInicio !== undefined && filtros.anoFim !== undefined && filtros.anoInicio > filtros.anoFim) {
        invalido("O ano inicial não pode ser maior que o ano final.");
    }
    return filtros;
}

function responderErro(res, erro) {
    if (erro.statusCode === 400) return res.status(400).json({ erro: erro.message });
    console.error("Erro ao consultar dashboard:", erro);
    return res.status(500).json({ erro: "Não foi possível carregar os dados do dashboard." });
}

async function filtros(req, res) {
    try {
        if (Object.keys(req.query).some(campo => !["painel", "compacto"].includes(campo))) invalido("Filtro desconhecido.");
        const painel = texto(req.query, "painel") || "geral";
        if (!PAINEIS.includes(painel)) invalido("Painel inválido.");
        const compacto = texto(req.query, "compacto");
        if (compacto !== undefined && compacto !== "1") invalido("Filtro inválido: compacto.");
        return res.json(await dashboardModel.filtros(painel, { compacto: compacto === "1" }));
    } catch (erro) {
        return responderErro(res, erro);
    }
}

function consultar(painel) {
    return async function (req, res) {
        try {
            return res.json(await dashboardModel[painel](validarFiltros(req.query)));
        } catch (erro) {
            return responderErro(res, erro);
        }
    };
}

module.exports = {
    filtros,
    geral: consultar("geral"),
    retencao: consultar("retencao"),
    expansao: consultar("expansao"),
    validarFiltros
};
