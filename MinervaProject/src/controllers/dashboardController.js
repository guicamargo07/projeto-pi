var dashboardModel = require("../models/dashboardModel");

const PAINEIS = ["geral", "retencao", "expansao"];
const CAMPOS = ["anoInicio", "anoFim", "regiao", "uf", "localizacao", "modalidade", "curso"];

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
    const regiao = texto(query, "regiao");
    if (regiao !== undefined && (regiao.length > 50 || !/^[\p{L}\p{M} -]+$/u.test(regiao))) {
        invalido("Filtro inválido: regiao.");
    }
    const uf = texto(query, "uf");
    if (uf !== undefined && !/^[a-z]{2}$/i.test(uf)) invalido("Filtro inválido: uf.");
    filtros.regiao = regiao;
    filtros.uf = uf === undefined ? undefined : uf.toUpperCase();
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
        if (Object.keys(req.query).some(campo => campo !== "painel")) invalido("Filtro desconhecido.");
        const painel = texto(req.query, "painel") || "geral";
        if (!PAINEIS.includes(painel)) invalido("Painel inválido.");
        return res.json(await dashboardModel.filtros(painel));
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
