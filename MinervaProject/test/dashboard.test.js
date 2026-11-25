const assert = require("node:assert/strict");
const http = require("node:http");
const Module = require("node:module");
const { after, before, test } = require("node:test");

// Substitui apenas a fronteira do MySQL: os testes não exigem credenciais nem banco ativo.
const caminhoBanco = require.resolve("../src/database/config");
const bancoOriginal = require.cache[caminhoBanco];
const bancoTeste = new Module(caminhoBanco);
let executarConsulta;
let consultas = [];
bancoTeste.loaded = true;
bancoTeste.exports = {
    executar(sql, parametros = []) {
        consultas.push({ sql, parametros });
        return Promise.resolve().then(() => executarConsulta(sql, parametros));
    }
};
require.cache[caminhoBanco] = bancoTeste;

function configurarBanco(responder, importacao = []) {
    consultas = [];
    executarConsulta = (sql, parametros) => {
        if (/\bFROM\s+importacaoCenso\b/i.test(sql)) {
            return typeof importacao === "function" ? importacao(sql, parametros) : importacao;
        }
        return responder(sql, parametros);
    };
}

function contexto(alteracoes = {}) {
    return {
        fonte: "dadosCurso",
        dedicada: false,
        anoInicio: 2021,
        anoFim: 2023,
        observacoes: [],
        ...alteracoes
    };
}

function anual(ano, alteracoes = {}) {
    return {
        ano,
        registros: 1,
        vagas: null,
        ingressantes: null,
        matriculas: null,
        concluintes: null,
        inscritos: null,
        instituicoes: null,
        mat0a17: null,
        mat18a24: null,
        mat25a29: null,
        mat30a34: null,
        mat35a39: null,
        mat40a49: null,
        mat50a59: null,
        mat60Mais: null,
        ...alteracoes
    };
}

function aproximadamente(recebido, esperado) {
    assert.equal(typeof recebido, "number");
    assert.ok(Math.abs(recebido - esperado) < 1e-9, `${recebido} deveria ser ${esperado}`);
}

function dadosCursoParaAvisos(sql) {
    if (sql.startsWith("SELECT 1 AS presente")) return [];
    if (sql.startsWith("SELECT MIN(")) return [{ anoMinimo: 2021, anoMaximo: 2023 }];
    if (sql.includes("GROUP BY d.anoCenso")) {
        return [anual(2023, { vagas: 100, ingressantes: 50, matriculas: 80, inscritos: 200, concluintes: 20 })];
    }
    return [];
}

let model;
let servidor;
let urlBase;

before(async () => {
    model = require("../src/models/dashboardModel");
    const express = require("express");
    const app = express();
    app.use("/dashboard", require("../src/routes/dashboard"));
    servidor = http.createServer(app);
    await new Promise((resolve, reject) => {
        servidor.once("error", reject);
        servidor.listen(0, "127.0.0.1", resolve);
    });
    urlBase = `http://127.0.0.1:${servidor.address().port}/dashboard`;
});

after(async () => {
    if (servidor) {
        servidor.closeAllConnections();
        await new Promise((resolve, reject) => servidor.close(erro => erro ? reject(erro) : resolve()));
    }
    if (bancoOriginal) require.cache[caminhoBanco] = bancoOriginal;
    else delete require.cache[caminhoBanco];
});

test("Geral calcula ocupação e crescimento pelos totais e escolhe a maior faixa etária", () => {
    const resultado = model.montarGeral(contexto({ anoInicio: 2022 }), [
        anual("2021", { matriculas: "50" }),
        anual("2022", { matriculas: "400" }),
        anual("2023", {
            vagas: "500", ingressantes: "130", matriculas: "600",
            mat18a24: "220", mat25a29: "270", mat30a34: "110"
        })
    ]);

    assert.equal(resultado.kpis.ocupacao, 26, "130 ingressantes em 500 vagas preenchem 26% das vagas");
    assert.equal(resultado.kpis.crescimento, 50, "600 matrículas sobre a base de 400 representam crescimento de 50%");
    assert.deepEqual(resultado.kpis.publicoPredominante, { faixa: "25–29 anos", percentual: 45 });
    assert.deepEqual(resultado.matriculas, [{ ano: 2022, matriculas: 400 }, { ano: 2023, matriculas: 600 }]);
    assert.equal(resultado.meta.anoReferencia, 2023);
    assert.equal(resultado.meta.anoComparacao, 2022);
    assert.equal(resultado.meta.semDados, false);
});

test("Geral usa o ano calendário anterior mesmo quando ele está fora do período do gráfico", () => {
    const resultado = model.montarGeral(contexto({ anoInicio: 2023 }), [
        anual(2022, { matriculas: 100 }),
        anual(2023, { matriculas: 150 })
    ]);

    assert.equal(resultado.kpis.crescimento, 50);
    assert.deepEqual(resultado.matriculas, [{ ano: 2023, matriculas: 150 }]);
});

test("Geral e Retenção não substituem o ano calendário anterior por um ano mais antigo", () => {
    const linhas = [
        anual(2021, { matriculas: 100, concluintes: 100 }),
        anual(2023, { matriculas: 150, concluintes: 150 })
    ];

    assert.equal(model.montarGeral(contexto(), linhas).kpis.crescimento, null);
    assert.equal(model.montarRetencao(contexto(), linhas, [], []).kpis.crescimentoConcluintes, null);
});

test("Geral preserva zero observado e diferencia contagens ausentes ou denominador zero", () => {
    const observado = model.montarGeral(contexto(), [
        anual(2022, { matriculas: 100 }),
        anual(2023, { vagas: 20, ingressantes: 0, matriculas: 0 })
    ]);
    assert.equal(observado.kpis.ocupacao, 0);
    assert.equal(observado.kpis.crescimento, -100);
    assert.equal(observado.matriculas[1].matriculas, 0);
    assert.deepEqual(observado.kpis.publicoPredominante, { faixa: null, percentual: null });

    const ausente = model.montarGeral(contexto(), [anual(2023)]);
    assert.equal(ausente.kpis.ocupacao, null);
    assert.equal(ausente.kpis.crescimento, null);
    assert.equal(ausente.matriculas[0].matriculas, null);

    const baseZero = model.montarGeral(contexto(), [
        anual(2022, { matriculas: 0 }),
        anual(2023, { vagas: 0, ingressantes: 4, matriculas: 10 })
    ]);
    assert.equal(baseZero.kpis.ocupacao, null);
    assert.equal(baseZero.kpis.crescimento, null);
});

test("Geral mantém KPIs indisponíveis quando o ano final não possui registros", () => {
    const resultado = model.montarGeral(contexto(), [
        anual(2022, { vagas: 100, ingressantes: 50, matriculas: 80, mat18a24: 80 })
    ]);

    assert.equal(resultado.meta.anoReferencia, 2023);
    assert.equal(resultado.kpis.ocupacao, null);
    assert.equal(resultado.kpis.crescimento, null);
    assert.deepEqual(resultado.kpis.publicoPredominante, { faixa: null, percentual: null });
    assert.ok(resultado.meta.observacoes.some(texto => /último ano selecionado/.test(texto)));
});

test("Geral usa as contagens de faixas da tabela dedicada para o público predominante", () => {
    const resultado = model.montarGeral(contexto({ fonte: "dashVisaoGeral", dedicada: true }), [
        anual(2023, { matriculas: 1000 })
    ], [{ faixa: "18–24 anos", matriculas: "400" }, { faixa: "25–29 anos", matriculas: "600" }]);

    assert.deepEqual(resultado.kpis.publicoPredominante, { faixa: "25–29 anos", percentual: 60 });
});

test("Retenção calcula crescimento e conclusão ponderada separadamente por modalidade", () => {
    const resultado = model.montarRetencao(contexto(), [
        anual(2022, { concluintes: "200" }), anual(2023, { ingressantes: "400", concluintes: "220" })
    ], [
        { modalidade: "1", ingressantes: "300", concluintes: "140" },
        { modalidade: "2", ingressantes: "100", concluintes: "80" }
    ], [
        { area: "Educação", ingressantes: "250", concluintes: "150" },
        { area: "Saúde", ingressantes: "150", concluintes: "70" }
    ]);

    assert.equal(resultado.kpis.crescimentoConcluintes, 10);
    aproximadamente(resultado.segmentos.find(item => item.modalidade === 1).taxa, 140 / 300 * 100);
    assert.equal(resultado.segmentos.find(item => item.modalidade === 2).taxa, 80);
    assert.deepEqual(resultado.areas, [
        { area: "Educação", ingressantes: 250, concluintes: 150 },
        { area: "Saúde", ingressantes: 150, concluintes: 70 }
    ]);
    assert.equal(resultado.meta.anoComparacao, 2022);
});

test("Retenção representa conclusão zero, denominador zero e modalidade ausente sem inventar dados", () => {
    const zero = model.montarRetencao(contexto(), [
        anual(2022, { concluintes: 100 }), anual(2023, { concluintes: 0 })
    ], [
        { modalidade: 1, ingressantes: 50, concluintes: 0 },
        { modalidade: 2, ingressantes: 0, concluintes: 0 }
    ], []);

    assert.equal(zero.kpis.crescimentoConcluintes, -100);
    assert.equal(zero.segmentos.find(item => item.modalidade === 1).taxa, 0);
    assert.equal(zero.segmentos.find(item => item.modalidade === 2).taxa, null);

    const ausente = model.montarRetencao(contexto(), [], [], []);
    assert.equal(ausente.meta.semDados, true);
    assert.equal(ausente.kpis.crescimentoConcluintes, null);
    assert.deepEqual(ausente.areas, []);
    assert.ok(ausente.segmentos.every(item => item.taxa === null));
});

test("Expansão compara os dois extremos selecionados por município/UF e mantém interesse como razão", () => {
    const resultado = model.montarExpansao(contexto(), [
        anual(2021, { vagas: 100, inscritos: 100, instituicoes: 1 }),
        anual(2023, { vagas: "1500", inscritos: "2750", instituicoes: "4" })
    ], [
        { municipio: "Santa Maria", uf: "RS", ano: 2021, modalidade: 1, matriculas: 100 },
        { municipio: "Santa Maria", uf: "RS", ano: 2022, modalidade: 1, matriculas: 999 },
        { municipio: "Santa Maria", uf: "RS", ano: 2023, modalidade: 1, matriculas: 150, inscritos: 1200, vagas: 600 },
        { municipio: "Santa Maria", uf: "RS", ano: 2021, modalidade: 2, matriculas: 200 },
        { municipio: "Santa Maria", uf: "RS", ano: 2023, modalidade: 2, matriculas: 150, inscritos: 1000, vagas: 400 },
        { municipio: "Santa Maria", uf: "SP", ano: 2021, modalidade: 1, matriculas: 50 },
        { municipio: "Santa Maria", uf: "SP", ano: 2023, modalidade: 1, matriculas: 100, inscritos: 550, vagas: 500 }
    ]);

    aproximadamente(resultado.kpis.interesse, 2750 / 1500);
    assert.equal(resultado.kpis.instituicoes, 4);
    assert.equal(resultado.kpis.vagas, 1500);
    assert.equal(resultado.meta.anoComparacao, 2021);
    assert.deepEqual(resultado.mercados, [
        { municipio: "Santa Maria", uf: "RS", presencial: 50, ead: -25, interesse: 2.2 },
        { municipio: "Santa Maria", uf: "SP", presencial: 100, ead: null, interesse: 1.1 }
    ]);
});

test("Expansão preserva zero e não calcula crescimento sem base ou com base zero", () => {
    const resultado = model.montarExpansao(contexto(), [
        anual(2023, { vagas: 20, inscritos: 0, instituicoes: 0 })
    ], [
        { municipio: "Base ausente", uf: "SP", ano: 2023, modalidade: 1, matriculas: 10, inscritos: 0, vagas: 10 },
        { municipio: "Base zero", uf: "SP", ano: 2021, modalidade: 1, matriculas: 0 },
        { municipio: "Base zero", uf: "SP", ano: 2023, modalidade: 1, matriculas: 10, inscritos: 0, vagas: 0 }
    ]);

    assert.deepEqual(resultado.kpis, { interesse: 0, instituicoes: 0, vagas: 20 });
    assert.equal(resultado.mercados[0].presencial, null);
    assert.equal(resultado.mercados[0].interesse, 0);
    assert.equal(resultado.mercados[1].presencial, null);
    assert.equal(resultado.mercados[1].interesse, null);

    const ausente = model.montarExpansao(contexto(), [], []);
    assert.equal(ausente.meta.semDados, true);
    assert.deepEqual(ausente.kpis, { interesse: null, instituicoes: null, vagas: null });
});

test("Cada dashboard usa exclusivamente sua tabela dedicada quando ela possui dados", async t => {
    for (const [painel, tabela] of [["geral", "dashVisaoGeral"], ["retencao", "dashRetencao"], ["expansao", "dashExpansao"]]) {
        await t.test(painel, async () => {
            configurarBanco(sql => {
                if (sql.startsWith("SELECT 1 AS presente")) return [{ presente: 1 }];
                if (sql.startsWith("SELECT MIN(")) return [{ anoMinimo: 2021, anoMaximo: 2023 }];
                return [];
            });
            const resposta = await fetch(`${urlBase}/${painel}?curso=999`);
            assert.equal(resposta.status, 200);
            const resultado = await resposta.json();
            assert.equal(resultado.meta.fonte, tabela);
            assert.equal(resultado.meta.semDados, true, "Um filtro sem resultados não deve ativar outra fonte de dados");
            const leituras = consultas.filter(consulta => /\bFROM\s+\w+\s+d\b/.test(consulta.sql));
            assert.ok(leituras.length > 0);
            assert.ok(leituras.every(consulta => consulta.sql.includes(`FROM ${tabela} d`)));
            assert.ok(consultas.every(consulta => !consulta.sql.includes("FROM dadosCurso")));
            assert.ok(consultas.every(consulta => !/\bFROM\s+importacaoCenso\b/i.test(consulta.sql)),
                "O histórico de importação de cursos não altera observações de uma fonte dedicada");
            assert.deepEqual(consultas[0].parametros, [], "A escolha da fonte é global, independente dos filtros");
        });
    }
});

test("Tabelas dedicadas vazias ou ausentes usam dadosCurso sem mesclar as fontes", async t => {
    for (const painel of ["geral", "retencao", "expansao"]) {
        for (const ausente of [false, true]) {
            await t.test(`${painel}: tabela ${ausente ? "ausente" : "vazia"}`, async () => {
                configurarBanco(sql => {
                    if (sql.startsWith("SELECT 1 AS presente")) {
                        if (ausente) {
                            const erro = new Error("Tabela não existe nesta instalação");
                            erro.code = "ER_NO_SUCH_TABLE";
                            throw erro;
                        }
                        return [];
                    }
                    if (sql.startsWith("SELECT MIN(")) return [{ anoMinimo: 2021, anoMaximo: 2023 }];
                    return [];
                });
                const resposta = await fetch(`${urlBase}/${painel}`);
                assert.equal(resposta.status, 200);
                const resultado = await resposta.json();
                assert.equal(resultado.meta.fonte, "dadosCurso");
                const leituras = consultas.filter(consulta => /\bFROM\s+\w+\s+d\b/.test(consulta.sql));
                assert.ok(leituras.length > 0);
                assert.ok(leituras.every(consulta => consulta.sql.includes("FROM dadosCurso d")));
            });
        }
    }
});

test("API aplica os mesmos filtros parametrizados nos KPIs, gráficos e mercados", async t => {
    const query = new URLSearchParams({
        anoInicio: "2021", anoFim: "2023", regiao: " Sudeste ", uf: "sp",
        localizacao: "42", modalidade: "2", curso: "7"
    });
    for (const painel of ["geral", "retencao", "expansao"]) {
        await t.test(painel, async () => {
            configurarBanco(sql => {
                if (sql.startsWith("SELECT 1 AS presente")) return [];
                if (sql.startsWith("SELECT MIN(")) return [{ anoMinimo: 2021, anoMaximo: 2023 }];
                return [];
            });
            const resposta = await fetch(`${urlBase}/${painel}?${query}`);
            assert.equal(resposta.status, 200);
            const resultado = await resposta.json();
            assert.equal(resultado.meta.anoInicio, 2021);
            assert.equal(resultado.meta.anoFim, 2023);
            const leituras = consultas.filter(consulta => consulta.sql.includes("FROM dadosCurso d"));
            assert.equal(leituras.length, painel === "geral" ? 1 : painel === "retencao" ? 3 : 2);
            for (const consulta of leituras) {
                assert.deepEqual(consulta.parametros.slice(0, 5), ["Sudeste", "SP", 42, 2, 7]);
                assert.equal((consulta.sql.match(/\?/g) || []).length, consulta.parametros.length);
                assert.doesNotMatch(consulta.sql, /Sudeste|'SP'/);
                assert.ok(consulta.parametros.slice(5).every(ano => Number.isInteger(ano)));
            }
            const parametrosAnos = leituras.map(consulta => consulta.parametros.slice(5));
            assert.deepEqual(parametrosAnos, painel === "geral" ? [[2021, 2023]] :
                painel === "retencao" ? [[2021, 2023], [2023, 2023], [2023, 2023]] : [[2021, 2023], [2021, 2023]]);
        });
    }
});

test("API consulta também o ano calendário anterior ao selecionar apenas um ano", async () => {
    configurarBanco(sql => {
        if (sql.startsWith("SELECT 1 AS presente")) return [];
        if (sql.startsWith("SELECT MIN(")) return [{ anoMinimo: 2021, anoMaximo: 2023 }];
        return [anual(2022, { matriculas: 100 }), anual(2023, { matriculas: 150 })];
    });
    const resposta = await fetch(`${urlBase}/geral?anoInicio=2023&anoFim=2023`);
    assert.equal(resposta.status, 200);
    const resultado = await resposta.json();
    assert.equal(resultado.kpis.crescimento, 50);
    assert.deepEqual(resultado.matriculas, [{ ano: 2023, matriculas: 150 }]);
    const consultaAnual = consultas.find(consulta => consulta.sql.includes("FROM dadosCurso d"));
    assert.deepEqual(consultaAnual.parametros, [2022, 2023]);
});

test("API de filtros apresenta anos, modalidades e localidades vindos da fonte escolhida", async () => {
    configurarBanco(sql => {
        if (sql.startsWith("SELECT 1 AS presente")) return [];
        if (sql.includes("d.anoCenso AS ano")) return [{ ano: "2021" }, { ano: "2023" }];
        if (sql.includes("l.idLocalizacao, l.municipio")) return [
            { idLocalizacao: "10", municipio: "São Paulo", uf: "SP", regiao: "Sudeste" },
            { idLocalizacao: "11", municipio: "Campinas", uf: "SP", regiao: "Sudeste" },
            { idLocalizacao: "12", municipio: "Curitiba", uf: "PR", regiao: "Sul" }
        ];
        if (sql.includes("c.idCurso, c.nomeCurso")) return [{ idCurso: "7", nomeCurso: "Medicina" }];
        if (sql.includes("AS modalidade")) return [{ modalidade: "1" }, { modalidade: "2" }];
        throw new Error("Consulta inesperada no teste de filtros");
    });
    const resposta = await fetch(`${urlBase}/filtros?painel=retencao`);
    assert.equal(resposta.status, 200);
    const resultado = await resposta.json();
    assert.deepEqual(resultado.anos, [2021, 2023]);
    assert.deepEqual(resultado.regioes, ["Sudeste", "Sul"]);
    assert.deepEqual(resultado.ufs, [{ uf: "SP", regiao: "Sudeste" }, { uf: "PR", regiao: "Sul" }]);
    assert.deepEqual(resultado.cursos, [{ idCurso: 7, nomeCurso: "Medicina" }]);
    assert.deepEqual(resultado.modalidades, [{ id: 1, nome: "Presencial" }, { id: 2, nome: "EAD" }]);
    assert.equal(resultado.municipios[0].idLocalizacao, 10);
    assert.equal(resultado.fonte, "dadosCurso");
});

test("As três dashboards avisam que os dados ainda estão sendo importados", async t => {
    for (const painel of ["geral", "retencao", "expansao"]) {
        await t.test(painel, async () => {
            configurarBanco(dadosCursoParaAvisos, [{
                ultimaLinha: 5000, concluida: 0, totalRegistros: 5000, atualizadoEm: "2026-11-25 12:00:00"
            }]);
            const resposta = await fetch(`${urlBase}/${painel}`);
            assert.equal(resposta.status, 200);
            const resultado = await resposta.json();
            assert.match(resultado.meta.observacoes.join(" "), /importa.*(?:andamento|curso)/i);
            assert.equal(resultado.meta.semDados, false, "A carga em andamento não deve apagar os dados já disponíveis");
            const leituraHistorico = consultas.find(consulta => /\bFROM\s+importacaoCenso\b/i.test(consulta.sql));
            assert.ok(leituraHistorico, "O estado da carga deve ser consultado para a fonte de cursos");
            assert.match(leituraHistorico.sql, /ORDER\s+BY\s+atualizadoEm\s+DESC/i);
            assert.match(leituraHistorico.sql, /LIMIT\s+1\b/i);
        });
    }
});

test("Carga concluída no limite do Excel avisa que o último ano pode estar incompleto", async t => {
    for (const painel of ["geral", "retencao", "expansao"]) {
        await t.test(painel, async () => {
            configurarBanco(dadosCursoParaAvisos, [{
                ultimaLinha: "1048575", concluida: "1", totalRegistros: "1048575", atualizadoEm: "2026-11-25 13:00:00"
            }]);
            const resposta = await fetch(`${urlBase}/${painel}`);
            assert.equal(resposta.status, 200);
            const resultado = await resposta.json();
            const observacoes = resultado.meta.observacoes.join(" ");
            assert.match(observacoes, /Excel|planilha/i);
            assert.match(observacoes, /limite/i);
            assert.match(observacoes, /parcial|incomplet/i);
            assert.doesNotMatch(observacoes, /importa.*(?:andamento|curso)/i);
        });
    }
});

test("Carga concluída abaixo do limite não recebe aviso de base parcial", async () => {
    configurarBanco(dadosCursoParaAvisos);
    const semHistorico = await (await fetch(`${urlBase}/geral`)).json();
    configurarBanco(dadosCursoParaAvisos, [{ ultimaLinha: 1048574, concluida: 1, totalRegistros: 1048574 }]);
    const resposta = await fetch(`${urlBase}/geral`);
    assert.equal(resposta.status, 200);
    const resultado = await resposta.json();
    assert.deepEqual(resultado.meta.observacoes, semHistorico.meta.observacoes);
    assert.deepEqual(resultado.kpis, semHistorico.kpis);
});

test("O aviso do limite também cobre um histórico acima de 1.048.575 linhas", async () => {
    configurarBanco(dadosCursoParaAvisos, [{ ultimaLinha: 1048576, concluida: 1, totalRegistros: 1048576 }]);
    const resposta = await fetch(`${urlBase}/geral`);
    assert.equal(resposta.status, 200);
    const resultado = await resposta.json();
    assert.match(resultado.meta.observacoes.join(" "), /limite/i);
});

test("Uma carga ainda em andamento no limite não é apresentada como concluída", async () => {
    configurarBanco(dadosCursoParaAvisos, [{ ultimaLinha: 1048575, concluida: 0, totalRegistros: 1048575 }]);
    const resposta = await fetch(`${urlBase}/geral`);
    assert.equal(resposta.status, 200);
    const resultado = await resposta.json();
    const observacoes = resultado.meta.observacoes.join(" ");
    assert.match(observacoes, /importa.*(?:andamento|curso)/i);
    assert.doesNotMatch(observacoes, /limite.*Excel|Excel.*limite/i);
});

test("Instalações sem a tabela de importação continuam funcionando sem observação adicional", async t => {
    configurarBanco(dadosCursoParaAvisos);
    const semHistorico = await (await fetch(`${urlBase}/geral`)).json();
    for (const identificacao of [{ code: "ER_NO_SUCH_TABLE" }, { errno: 1146 }]) {
        await t.test(JSON.stringify(identificacao), async () => {
            configurarBanco(dadosCursoParaAvisos, () => {
                throw Object.assign(new Error("Histórico ainda não instalado"), identificacao);
            });
            const resposta = await fetch(`${urlBase}/geral`);
            assert.equal(resposta.status, 200);
            const resultado = await resposta.json();
            assert.deepEqual(resultado.meta.observacoes, semHistorico.meta.observacoes);
            assert.deepEqual(resultado.kpis, semHistorico.kpis);
        });
    }
});

test("Erros inesperados ao consultar o histórico de importação retornam 500", async t => {
    t.mock.method(console, "error", () => {});
    configurarBanco(dadosCursoParaAvisos, () => {
        const erro = new Error("informação interna confidencial");
        erro.code = "ER_TABLEACCESS_DENIED_ERROR";
        throw erro;
    });
    const resposta = await fetch(`${urlBase}/geral`);
    assert.equal(resposta.status, 500);
    assert.doesNotMatch(await resposta.text(), /confidencial|ER_TABLEACCESS_DENIED_ERROR/);
    assert.ok(consultas.some(consulta => /\bFROM\s+importacaoCenso\b/i.test(consulta.sql)));
});

test("API rejeita filtros inválidos antes de consultar o banco", async t => {
    const casos = [
        ["parâmetro desconhecido", "parametroInexistente=1"],
        ["tentativa de SQL no ano", "anoFim=2023%20OR%201%3D1"],
        ["ano abaixo do intervalo aceito", "anoInicio=1899"],
        ["ano acima do intervalo aceito", "anoFim=2101"],
        ["intervalo invertido", "anoInicio=2024&anoFim=2023"],
        ["anos duplicados viram array", "anoFim=2022&anoFim=2023"],
        ["ano como objeto", "anoFim[valor]=2023"],
        ["modalidade inexistente", "modalidade=3"],
        ["modalidades duplicadas", "modalidade=1&modalidade=2"],
        ["curso zero", "curso=0"],
        ["curso fora do limite SQL INT", "curso=2147483648"],
        ["UF inválida", "uf=SP%27"],
        ["região com expressão SQL", "regiao=Sul%27%20OR%201%3D1"]
    ];

    for (const [descricao, query] of casos) {
        await t.test(descricao, async () => {
            configurarBanco(() => { throw new Error("Filtro inválido não deveria acessar o banco"); });
            const resposta = await fetch(`${urlBase}/geral?${query}`);
            assert.equal(resposta.status, 400);
            assert.equal(consultas.length, 0);
        });
    }
});

test("API responde 500 quando o MySQL falha e não expõe detalhes da consulta", async t => {
    t.mock.method(console, "error", () => {});
    configurarBanco(() => {
        const erro = new Error("falha SQL deliberada: senha-confidencial");
        erro.sqlMessage = "senha-confidencial";
        throw erro;
    });
    const resposta = await fetch(`${urlBase}/geral`);
    assert.equal(resposta.status, 500);
    assert.doesNotMatch(await resposta.text(), /senha-confidencial|falha SQL deliberada/);
    assert.ok(consultas.length > 0);
});
