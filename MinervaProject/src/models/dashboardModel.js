var database = require("../database/config");
var geografia = require("./geografia");

// Nomes de tabelas e expressões SQL vêm somente desta lista interna.
const TABELAS = Object.freeze({
    geral: "dashVisaoGeral",
    retencao: "dashRetencao",
    expansao: "dashExpansao"
});
const MODALIDADES = Object.freeze({ 1: "Presencial", 2: "EAD" });
const ANO_FINAL_PADRAO = 2021;
const ANO_PARCIAL = 2022;
const FAIXAS = [
    ["mat0a17", "matriculas0a17", "Até 17 anos"],
    ["mat18a24", "matriculas18a24", "18–24 anos"],
    ["mat25a29", "matriculas25a29", "25–29 anos"],
    ["mat30a34", "matriculas30a34", "30–34 anos"],
    ["mat35a39", "matriculas35a39", "35–39 anos"],
    ["mat40a49", "matriculas40a49", "40–49 anos"],
    ["mat50a59", "matriculas50a59", "50–59 anos"],
    ["mat60Mais", "matriculas60Mais", "60 anos ou mais"]
];

function numero(valor) {
    if (valor === null || valor === undefined || valor === "") return null;
    const resultado = Number(valor);
    return Number.isFinite(resultado) ? resultado : null;
}

function razao(numerador, denominador, percentual = false) {
    const n = numero(numerador);
    const d = numero(denominador);
    return n === null || d === null || d <= 0 ? null : n / d * (percentual ? 100 : 1);
}

function crescimento(atual, anterior) {
    const a = numero(atual);
    const b = numero(anterior);
    return a === null || b === null || b <= 0 ? null : (a - b) / b * 100;
}

async function fonteDoPainel(painel) {
    if (!Object.prototype.hasOwnProperty.call(TABELAS, painel)) throw new Error("Painel inválido.");
    const tabela = TABELAS[painel];
    let dedicada = false;
    try {
        dedicada = (await database.executar("SELECT 1 AS presente FROM " + tabela + " LIMIT 1", [])).length > 0;
    } catch (erro) {
        // Instalações anteriores podem ainda não ter as tabelas dedicadas.
        if (erro.code !== "ER_NO_SUCH_TABLE" && erro.errno !== 1146) throw erro;
    }
    return { nome: dedicada ? tabela : "dadosCurso", dedicada };
}

function estrutura(fonte) {
    const localizacao = fonte.dedicada ? "COALESCE(d.fkLocalizacao, i.fkLocalizacao)" : "i.fkLocalizacao";
    return {
        modalidade: fonte.dedicada ? "d.modalidadeEnsino" : "c.modalidadeEnsino",
        from: " FROM " + fonte.nome + " d" +
            " LEFT JOIN curso c ON c.idCurso = d.fkCurso" +
            " LEFT JOIN instituicao i ON i.idInstituicao = c.fkInstituicao" +
            " LEFT JOIN localizacao l ON l.idLocalizacao = " + localizacao
    };
}

function condicoes(fonte, filtros, anos) {
    const partes = [];
    const params = [];
    const campos = {
        regiao: "l.regiao", uf: "l.uf", localizacao: "l.idLocalizacao",
        modalidade: estrutura(fonte).modalidade, curso: "c.idCurso",
        area: fonte.nome === "dashRetencao" ? "COALESCE(d.areaGeral, c.areaGeral)" : "c.areaGeral"
    };
    for (const [campo, coluna] of Object.entries(campos)) {
        if (filtros[campo] !== undefined) {
            partes.push(coluna + " = ?");
            params.push(filtros[campo]);
        }
    }
    if (filtros.idsGeograficos !== undefined) {
        if (!filtros.idsGeograficos.length) partes.push("1 = 0");
        else {
            partes.push("l.idLocalizacao IN (" + filtros.idsGeograficos.map(() => "?").join(", ") + ")");
            params.push(...filtros.idsGeograficos);
        }
    }
    if (anos) {
        partes.push("d.anoCenso BETWEEN ? AND ?");
        params.push(anos[0], anos[1]);
    }
    return { sql: partes.length ? " WHERE " + partes.join(" AND ") : "", params };
}

function consultar(fonte, selecao, filtros, anos, final = "") {
    const where = condicoes(fonte, filtros, anos);
    return database.executar("SELECT " + selecao + estrutura(fonte).from + where.sql + final, where.params);
}

async function informacoesImportacao(fonte) {
    if (fonte.dedicada) return null;
    try {
        const [importacao] = await database.executar(
            "SELECT ultimaLinha, concluida FROM importacaoCenso ORDER BY atualizadoEm DESC LIMIT 1", []);
        return importacao || null;
    } catch (erro) {
        if (erro.code !== "ER_NO_SUCH_TABLE" && erro.errno !== 1146) throw erro;
        return null;
    }
}

async function prepararGeografia(filtros) {
    if (filtros.uf === undefined && filtros.regiao === undefined) return filtros;
    const locais = await database.executar("SELECT idLocalizacao, municipio, uf, regiao FROM localizacao", []);
    const idsGeograficos = locais.filter(local => geografia.corresponde(local, filtros))
        .map(local => Number(local.idLocalizacao)).filter(id => Number.isSafeInteger(id) && id > 0);
    return { ...filtros, uf: undefined, regiao: undefined, idsGeograficos };
}

async function filtros(painel = "geral", opcoes = {}) {
    const fonte = await fonteDoPainel(painel);
    const base = estrutura(fonte);
    const expressaoArea = fonte.nome === "dashRetencao" ? "COALESCE(d.areaGeral, c.areaGeral)" : "c.areaGeral";
    const consultaCursos = opcoes.compacto
        ? database.executar("SELECT DISTINCT " + expressaoArea + " AS area" + base.from +
            " WHERE " + expressaoArea + " IS NOT NULL ORDER BY area", [])
        : database.executar("SELECT DISTINCT c.idCurso, c.nomeCurso, c.areaGeral, i.codigoIes, l.municipio, l.uf, " +
            base.modalidade + " AS modalidade" + base.from +
            " WHERE c.idCurso IS NOT NULL ORDER BY c.nomeCurso, c.idCurso", []);
    const [anos, locais, cursos, modalidades, importacao] = await Promise.all([
        consultar(fonte, "DISTINCT d.anoCenso AS ano", {}, null, " ORDER BY ano"),
        database.executar("SELECT DISTINCT l.idLocalizacao, l.municipio, l.uf, l.regiao" +
            base.from + " WHERE l.idLocalizacao IS NOT NULL ORDER BY l.regiao, l.uf, l.municipio, l.idLocalizacao", []),
        consultaCursos,
        database.executar("SELECT DISTINCT " + base.modalidade + " AS modalidade" +
            base.from + " WHERE " + base.modalidade + " IN (1, 2) ORDER BY modalidade", []),
        informacoesImportacao(fonte)
    ]);
    const resolvidos = locais.map(geografia.resolverLocalidade);
    const municipios = resolvidos.map(local => ({
        idLocalizacao: numero(local.idLocalizacao),
        municipio: String(local.municipio ?? ""),
        uf: local.uf,
        regiao: local.regiao
    }));
    const regioes = [...new Set(municipios.map(local => local.regiao).filter(Boolean))];
    const ufs = [...new Map(municipios.filter(local => local.uf).map(local =>
        [local.uf + "|" + local.regiao, { uf: local.uf, regiao: local.regiao }])).values()];
    const anosDisponiveis = anos.map(linha => numero(linha.ano)).filter(ano => ano !== null).sort((a, b) => a - b);
    const anoParcial = anosDisponiveis.includes(ANO_PARCIAL) ? ANO_PARCIAL :
        (importacao && numero(importacao.concluida) === 1 && numero(importacao.ultimaLinha) >= 1048575
            ? anosDisponiveis.at(-1) ?? null : null);
    return {
        anos: anosDisponiveis,
        anoParcial,
        anoInicioPadrao: Math.min(anosDisponiveis[0] ?? ANO_FINAL_PADRAO, ANO_FINAL_PADRAO),
        anoFimPadrao: ANO_FINAL_PADRAO,
        geografia: {
            municipiosSemUf: municipios.filter(local => !local.uf).length,
            municipiosComplementados: resolvidos.filter(local => local.origemGeografia === "referencia").length
        },
        regioes,
        ufs,
        municipios,
        areas: [...new Set(cursos.map(curso => String((opcoes.compacto ? curso.area : curso.areaGeral) ?? "").trim()).filter(Boolean))],
        cursos: opcoes.compacto ? [] : cursos.map(curso => {
            const resultado = { idCurso: numero(curso.idCurso), nomeCurso: String(curso.nomeCurso ?? "") };
            if (curso.codigoIes !== undefined) resultado.codigoIes = numero(curso.codigoIes);
            if (curso.municipio !== undefined) resultado.municipio = curso.municipio;
            if (curso.uf !== undefined) resultado.uf = geografia.resolverLocalidade(curso).uf;
            if (curso.modalidade !== undefined) resultado.modalidade = numero(curso.modalidade);
            return resultado;
        }),
        modalidades: modalidades.map(linha => ({ id: numero(linha.modalidade), nome: MODALIDADES[linha.modalidade] })),
        fonte: fonte.nome
    };
}

async function contextoDoPainel(painel, filtrosAplicados) {
    const fonte = await fonteDoPainel(painel);
    const filtrosPreparados = await prepararGeografia(filtrosAplicados);
    const [limites = {}] = await database.executar(
        "SELECT MIN(anoCenso) AS anoMinimo, MAX(anoCenso) AS anoMaximo FROM " + fonte.nome, []);
    let anoFim = filtrosAplicados.anoFim ?? ANO_FINAL_PADRAO;
    let anoInicio = filtrosAplicados.anoInicio ?? Math.min(numero(limites.anoMinimo) ?? anoFim, anoFim);
    if (anoInicio === null) anoInicio = anoFim;
    if (anoFim === null) anoFim = anoInicio;
    // Um limite explícito fora da série produz um recorte vazio, sem inverter o período.
    if (anoInicio > anoFim) {
        if (filtrosAplicados.anoInicio !== undefined) anoFim = anoInicio;
        else anoInicio = anoFim;
    }
    const observacoes = [];
    let anoParcial = numero(limites.anoMinimo) <= ANO_PARCIAL && numero(limites.anoMaximo) >= ANO_PARCIAL ? ANO_PARCIAL : null;
    if (anoParcial === ANO_PARCIAL) observacoes.push("2022 contém informações parciais. O ano final padrão é 2021.");
    if (!fonte.dedicada) {
        observacoes.push("Indicadores calculados a partir dos dados de cursos importados.");
        {
            const importacao = await informacoesImportacao(fonte);
            if (importacao && numero(importacao.concluida) === 0) {
                observacoes.push("Importação em andamento; os indicadores refletem apenas os lotes já gravados.");
            } else if (importacao && numero(importacao.concluida) === 1 && numero(importacao.ultimaLinha) >= 1048575) {
                if (anoParcial === ANO_PARCIAL) {
                    observacoes[0] += " A planilha atingiu o limite de linhas do Excel.";
                } else {
                    anoParcial = numero(limites.anoMaximo);
                    observacoes.push("A planilha atingiu o limite de linhas do Excel; os dados de " + anoParcial + " podem estar incompletos.");
                }
            }
        }
    }
    if (fonte.dedicada && painel === "geral") observacoes.push(
        "O público predominante considera as faixas etárias predominantes em cada registro consolidado; esta fonte não contém a distribuição etária completa.");
    if (fonte.dedicada && painel === "expansao") observacoes.push(
        "A quantidade de instituições soma os totais consolidados; uma instituição pode aparecer mais de uma vez em recortes sobrepostos.");
    return { fonte: fonte.nome, dedicada: fonte.dedicada, anoInicio, anoFim, anoParcial, observacoes, filtros: filtrosPreparados };
}

function fonteDoContexto(contexto) {
    return { nome: contexto.fonte, dedicada: contexto.dedicada };
}

function resumoAnual(contexto, painel) {
    if (contexto.anoInicio === null || contexto.anoFim === null) return Promise.resolve([]);
    const fonte = fonteDoContexto(contexto);
    const campos = ["d.anoCenso AS ano", "COUNT(*) AS registros"];
    if (painel === "geral") {
        campos.push("SUM(d.vagasOfertadas) AS vagas", "SUM(d.ingressantes) AS ingressantes", "SUM(d.matriculas) AS matriculas");
        if (!fonte.dedicada) FAIXAS.forEach(([apelido, coluna]) => campos.push("SUM(d." + coluna + ") AS " + apelido));
    } else if (painel === "retencao") {
        campos.push("SUM(d.ingressantes) AS ingressantes", "SUM(d.concluintes) AS concluintes");
    } else {
        campos.push("SUM(d.vagasOfertadas) AS vagas", "SUM(d.inscritos) AS inscritos", "SUM(d.matriculas) AS matriculas");
        if (fonte.dedicada) campos.push("SUM(d.qtdInstituicoes) AS instituicoes");
        else campos.push("CASE WHEN COUNT(d.vagasOfertadas) = 0 THEN NULL ELSE COUNT(DISTINCT CASE " +
            "WHEN d.vagasOfertadas > 0 THEN CASE WHEN i.codigoIes > 0 THEN CONCAT('codigo:', i.codigoIes) " +
            "ELSE CONCAT('registro:', i.idInstituicao) END END) END AS instituicoes");
    }
    const inicioConsulta = painel === "expansao" ? contexto.anoInicio : Math.min(contexto.anoInicio, contexto.anoFim - 1);
    return consultar(fonte, campos.join(", "), contexto.filtros, [inicioConsulta, contexto.anoFim], " GROUP BY d.anoCenso ORDER BY d.anoCenso");
}

function anuaisDoPeriodo(contexto, anuais) {
    return anuais.filter(linha => numero(linha.ano) >= contexto.anoInicio && numero(linha.ano) <= contexto.anoFim);
}

function doAno(anuais, ano) {
    return anuais.find(linha => numero(linha.ano) === ano) || {};
}

function meta(contexto, anuais, expansao = false) {
    const semDados = anuaisDoPeriodo(contexto, anuais).length === 0;
    const observacoes = [...(contexto.observacoes || [])];
    if (!semDados && !anuais.some(linha => numero(linha.ano) === contexto.anoFim)) {
        observacoes.push("O último ano selecionado não possui registros para os filtros aplicados.");
    }
    return {
        fonte: contexto.fonte,
        anoInicio: contexto.anoInicio,
        anoFim: contexto.anoFim,
        anoReferencia: contexto.anoFim,
        anoComparacao: expansao ? contexto.anoInicio : (contexto.anoFim === null ? null : contexto.anoFim - 1),
        anoParcial: contexto.anoParcial ?? null,
        semDados,
        observacoes
    };
}

function montarGeral(contexto, anuais, faixas = []) {
    const atual = doAno(anuais, contexto.anoFim);
    const anterior = doAno(anuais, contexto.anoFim === null ? null : contexto.anoFim - 1);
    const distribuicao = contexto.dedicada ? faixas.map(linha =>
        ({ faixa: linha.faixa, matriculas: numero(linha.matriculas) })) :
        FAIXAS.map(([apelido, , faixa]) => ({ faixa, matriculas: numero(atual[apelido]) }));
    const predominante = distribuicao.filter(linha => linha.faixa && linha.matriculas !== null && linha.matriculas > 0)
        .sort((a, b) => b.matriculas - a.matriculas || a.faixa.localeCompare(b.faixa, "pt-BR"))[0];
    return {
        meta: meta(contexto, anuais),
        kpis: {
            ocupacao: razao(atual.ingressantes, atual.vagas, true),
            crescimento: crescimento(atual.matriculas, anterior.matriculas),
            publicoPredominante: {
                faixa: predominante ? predominante.faixa : null,
                percentual: predominante ? razao(predominante.matriculas, atual.matriculas, true) : null
            }
        },
        matriculas: anuaisDoPeriodo(contexto, anuais).map(linha => ({ ano: numero(linha.ano), matriculas: numero(linha.matriculas) }))
    };
}

async function geral(filtrosAplicados = {}) {
    const contexto = await contextoDoPainel("geral", filtrosAplicados);
    const tarefas = [resumoAnual(contexto, "geral")];
    if (contexto.dedicada && contexto.anoFim !== null) {
        tarefas.push(consultar(fonteDoContexto(contexto),
            "d.faixaPredominante AS faixa, SUM(d.matriculasFaixaPredominante) AS matriculas",
            contexto.filtros, [contexto.anoFim, contexto.anoFim],
            " GROUP BY d.faixaPredominante ORDER BY d.faixaPredominante"));
    }
    const [anuais, faixas = []] = await Promise.all(tarefas);
    return montarGeral(contexto, anuais, faixas);
}

function montarRetencao(contexto, anuais, segmentos = [], areas = []) {
    const atual = doAno(anuais, contexto.anoFim);
    const anterior = doAno(anuais, contexto.anoFim === null ? null : contexto.anoFim - 1);
    return {
        meta: meta(contexto, anuais),
        kpis: { crescimentoConcluintes: crescimento(atual.concluintes, anterior.concluintes) },
        segmentos: segmentos.map(linha => ({
            modalidade: numero(linha.modalidade), nome: MODALIDADES[linha.modalidade] || "Não informada",
            ingressantes: numero(linha.ingressantes), concluintes: numero(linha.concluintes),
            taxa: razao(linha.concluintes, linha.ingressantes, true)
        })),
        areas: areas.map(linha => ({ area: linha.area || "Não informado", ingressantes: numero(linha.ingressantes), concluintes: numero(linha.concluintes) }))
    };
}

async function retencao(filtrosAplicados = {}) {
    const contexto = await contextoDoPainel("retencao", filtrosAplicados);
    const fonte = fonteDoContexto(contexto);
    const modalidade = estrutura(fonte).modalidade;
    const area = fonte.dedicada ? "d.areaGeral" : "c.areaGeral";
    const tarefas = [resumoAnual(contexto, "retencao")];
    if (contexto.anoFim !== null) {
        const anos = [contexto.anoFim, contexto.anoFim];
        tarefas.push(consultar(fonte, modalidade + " AS modalidade, SUM(d.ingressantes) AS ingressantes, SUM(d.concluintes) AS concluintes",
            contexto.filtros, anos, " GROUP BY " + modalidade + " ORDER BY modalidade"));
        tarefas.push(consultar(fonte, area + " AS area, SUM(d.ingressantes) AS ingressantes, SUM(d.concluintes) AS concluintes",
            contexto.filtros, anos, " GROUP BY " + area + " ORDER BY area"));
    }
    const [anuais, segmentos = [], areas = []] = await Promise.all(tarefas);
    return montarRetencao(contexto, anuais, segmentos, areas);
}

function montarExpansao(contexto, anuais, linhas = []) {
    const atual = doAno(anuais, contexto.anoFim);
    const municipios = new Map();
    linhas.map(geografia.resolverLocalidade).forEach(linha => {
        const chave = JSON.stringify([linha.municipio, linha.uf]);
        if (!municipios.has(chave)) municipios.set(chave, { municipio: linha.municipio || "Não informado", uf: linha.uf || null, linhas: [] });
        municipios.get(chave).linhas.push(linha);
    });
    const mercados = [...municipios.values()].map(municipio => {
        const crescimentoModalidade = modalidade => {
            const fim = municipio.linhas.find(linha => numero(linha.ano) === contexto.anoFim && numero(linha.modalidade) === modalidade);
            const inicio = municipio.linhas.find(linha => numero(linha.ano) === contexto.anoInicio && numero(linha.modalidade) === modalidade);
            return crescimento(fim && fim.matriculas, inicio && inicio.matriculas);
        };
        const finais = municipio.linhas.filter(linha => numero(linha.ano) === contexto.anoFim);
        const somar = campo => {
            const valores = finais.map(linha => numero(linha[campo])).filter(valor => valor !== null);
            return valores.length ? valores.reduce((soma, valor) => soma + valor, 0) : null;
        };
        return {
            municipio: municipio.municipio, uf: municipio.uf,
            presencial: crescimentoModalidade(1), ead: crescimentoModalidade(2),
            interesse: razao(somar("inscritos"), somar("vagas"))
        };
    }).sort((a, b) => a.municipio.localeCompare(b.municipio, "pt-BR") || (a.uf || "").localeCompare(b.uf || ""));
    return {
        meta: meta(contexto, anuais, true),
        kpis: { interesse: razao(atual.inscritos, atual.vagas), instituicoes: numero(atual.instituicoes), vagas: numero(atual.vagas) },
        mercados
    };
}

async function expansao(filtrosAplicados = {}) {
    const contexto = await contextoDoPainel("expansao", filtrosAplicados);
    const fonte = fonteDoContexto(contexto);
    const modalidade = estrutura(fonte).modalidade;
    const tarefas = [resumoAnual(contexto, "expansao")];
    if (contexto.anoFim !== null) {
        // Somente os dois extremos são comparados; ausência de um extremo continua sendo null.
        const where = condicoes(fonte, contexto.filtros);
        tarefas.push(database.executar(
            "SELECT l.municipio, l.uf, d.anoCenso AS ano, " + modalidade + " AS modalidade, " +
            "SUM(d.matriculas) AS matriculas, SUM(d.inscritos) AS inscritos, SUM(d.vagasOfertadas) AS vagas" +
            estrutura(fonte).from + where.sql + (where.sql ? " AND " : " WHERE ") +
            "d.anoCenso IN (?, ?) GROUP BY l.municipio, l.uf, d.anoCenso, " + modalidade +
            " ORDER BY l.municipio, l.uf, d.anoCenso, modalidade",
            [...where.params, contexto.anoInicio, contexto.anoFim]));
    }
    const [anuais, mercados = []] = await Promise.all(tarefas);
    return montarExpansao(contexto, anuais, mercados);
}

module.exports = { filtros, geral, retencao, expansao, montarGeral, montarRetencao, montarExpansao };
