const referencia = require("../data/municipios-ibge.json");

const UF_AUSENTE = "sem-uf";
const REGIAO_AUSENTE = "sem-regiao";
const regioesPorUf = new Map(referencia.municipios.map(item => [item.uf, item.regiao]));
const regioes = [...new Set(regioesPorUf.values())];
const municipiosPorNome = new Map();

function normalizarNome(nome) {
    return String(nome ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toUpperCase().replace(/[’']/g, "").replace(/[^A-Z0-9]+/g, " ").trim();
}

for (const municipio of referencia.municipios) {
    const chave = normalizarNome(municipio.nome);
    if (!municipiosPorNome.has(chave)) municipiosPorNome.set(chave, []);
    municipiosPorNome.get(chave).push(municipio);
}

function ufValida(valor) {
    return regioesPorUf.has(String(valor ?? "").trim().toUpperCase());
}

function resolverLocalidade(local) {
    const ufOriginal = String(local.uf ?? "").trim().toUpperCase();
    if (ufValida(ufOriginal)) {
        return { ...local, uf: ufOriginal, regiao: regioesPorUf.get(ufOriginal), origemGeografia: "cadastro" };
    }
    const candidatos = municipiosPorNome.get(normalizarNome(local.municipio)) || [];
    // Sem código municipal na fonte, um nome homônimo nunca escolhe uma UF.
    if (candidatos.length === 1) {
        return { ...local, uf: candidatos[0].uf, regiao: candidatos[0].regiao, origemGeografia: "referencia" };
    }
    const regiao = regioes.find(item => normalizarNome(item) === normalizarNome(local.regiao)) || null;
    return { ...local, uf: null, regiao, origemGeografia: "indefinida" };
}

function corresponde(local, filtros) {
    const resolvido = resolverLocalidade(local);
    return (filtros.uf === undefined || (filtros.uf === UF_AUSENTE ? !resolvido.uf : resolvido.uf === filtros.uf)) &&
        (filtros.regiao === undefined || (filtros.regiao === REGIAO_AUSENTE ? !resolvido.regiao : resolvido.regiao === filtros.regiao));
}

module.exports = { resolverLocalidade, corresponde, normalizarNome, ufValida, regioes, UF_AUSENTE, REGIAO_AUSENTE };
