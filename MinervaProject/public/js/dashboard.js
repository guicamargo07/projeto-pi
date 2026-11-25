(() => {
  "use strict";

  const painel = document.body.dataset.dashboard;
  if (!["geral", "retencao", "expansao"].includes(painel)) return;

  const porId = (id) => document.getElementById(id);
  const formulario = porId("dashboardFiltros");
  const campos = porId("dashboardCampos");
  const nomesFiltros = ["anoInicio", "anoFim", "regiao", "uf", "localizacao", "modalidade", "curso"];
  const filtros = Object.fromEntries(nomesFiltros.map((nome) => [nome, formulario.elements.namedItem(nome)]));
  const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const buscaCurso = porId("buscarCurso");
  let indiceCursos = [];
  let cursosPorId = new Map();
  let buscaPendente;
  let opcoes = null;
  let grafico = null;
  let requisicao = null;

  function valorNumerico(valor) {
    if (valor === null || valor === undefined || valor === "") return null;
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? convertido : null;
  }

  function formatar(valor, percentual = false, sinal = false) {
    const convertido = valorNumerico(valor);
    if (convertido === null) return "—";
    return `${sinal && convertido > 0 ? "+" : ""}${numero.format(convertido)}${percentual ? "%" : ""}`;
  }

  function colorir(elemento, valor) {
    elemento.classList.remove("valor--positivo", "valor--negativo");
    const convertido = valorNumerico(valor);
    if (convertido > 0) elemento.classList.add("valor--positivo");
    if (convertido < 0) elemento.classList.add("valor--negativo");
  }

  function kpi(id, valor, percentual = false, sinal = false) {
    const elemento = porId(id);
    if (!elemento) return;
    elemento.textContent = formatar(valor, percentual, sinal);
    colorir(elemento, sinal ? valor : null);
  }

  function preencherSelect(select, itens, obterValor, obterNome, titulo) {
    select.replaceChildren();
    if (titulo) select.add(new Option(titulo, ""));
    for (const item of itens) select.add(new Option(String(obterNome(item)), String(obterValor(item))));
  }

  function normalizarBusca(valor) {
    return String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  }

  function rotuloCurso(curso) {
    const contexto = [];
    if (Number(curso.codigoIes) > 0) contexto.push(`IES ${curso.codigoIes}`);
    if (curso.municipio) contexto.push(`${curso.municipio}${curso.uf ? ` / ${curso.uf}` : ""}`);
    const modalidade = { 1: "Presencial", 2: "EAD" }[curso.modalidade];
    if (modalidade) contexto.push(modalidade);
    if (!contexto.length) contexto.push(`ID ${curso.idCurso}`);
    return [curso.nomeCurso || "Curso sem nome informado", ...contexto].join(" · ");
  }

  function atualizarCursos() {
    const selecionado = cursosPorId.get(filtros.curso.value);
    const termo = normalizarBusca(buscaCurso.value);
    const encontrados = [];
    let total = 0;
    if (termo.length >= 2) {
      for (const item of indiceCursos) {
        if (item.busca.includes(termo)) {
          total++;
          if (encontrados.length < 100) encontrados.push(item.curso);
        }
      }
    }
    const preservado = selecionado && !encontrados.some((curso) => String(curso.idCurso) === String(selecionado.idCurso));
    if (preservado) encontrados.push(selecionado);
    preencherSelect(filtros.curso, encontrados, (curso) => curso.idCurso, rotuloCurso, "Todos os cursos");
    if (selecionado) filtros.curso.value = String(selecionado.idCurso);
    let mensagem;
    if (!indiceCursos.length) mensagem = "Nenhum curso disponível para este painel.";
    else if (termo.length < 2) mensagem = `Digite ao menos 2 caracteres para buscar entre ${inteiro.format(indiceCursos.length)} cursos.`;
    else if (!total) mensagem = "Nenhum curso encontrado para a busca.";
    else if (total > 100) mensagem = `Mostrando 100 de ${inteiro.format(total)} cursos encontrados. Refine a busca para reduzir a lista.`;
    else mensagem = `${inteiro.format(total)} ${total === 1 ? "curso encontrado" : "cursos encontrados"}.`;
    if (preservado) mensagem += " O curso selecionado foi mantido.";
    porId("cursoBuscaStatus").textContent = mensagem;
  }

  function preencherGeografia(reiniciarUf = false) {
    const regiao = filtros.regiao.value;
    const ufAnterior = reiniciarUf ? "" : filtros.uf.value;
    const municipioAnterior = reiniciarUf ? "" : filtros.localizacao.value;
    const ufs = opcoes.ufs.filter((item) => !regiao || item.regiao === regiao);
    preencherSelect(filtros.uf, ufs, (item) => item.uf, (item) => item.uf, "Todas as UFs");
    if (ufs.some((item) => item.uf === ufAnterior)) filtros.uf.value = ufAnterior;
    const municipios = opcoes.municipios.filter((item) =>
      (!regiao || item.regiao === regiao) && (!filtros.uf.value || item.uf === filtros.uf.value));
    preencherSelect(filtros.localizacao, municipios, (item) => item.idLocalizacao,
      (item) => `${item.municipio} / ${item.uf}`, "Todos os municípios");
    if (municipios.some((item) => String(item.idLocalizacao) === municipioAnterior)) {
      filtros.localizacao.value = municipioAnterior;
    }
  }

  function limparFiltros() {
    clearTimeout(buscaPendente);
    buscaCurso.value = "";
    filtros.anoInicio.selectedIndex = 0;
    filtros.anoFim.selectedIndex = Math.max(0, filtros.anoFim.options.length - 1);
    for (const nome of ["regiao", "modalidade", "curso"]) filtros[nome].value = "";
    atualizarCursos();
    preencherGeografia(true);
  }

  function estado(tipo, mensagem) {
    const aviso = porId("dashboardEstado");
    aviso.dataset.estado = tipo;
    porId("dashboardMensagem").textContent = mensagem;
    porId("dashboardTentar").hidden = tipo !== "erro";
    porId("dashboardResultados").setAttribute("aria-busy", String(tipo === "carregando"));
  }

  function destruirGrafico() {
    if (grafico) grafico.destroy();
    grafico = null;
    const canvas = document.querySelector(".grafico canvas");
    if (canvas) canvas.hidden = true;
  }

  function limparResultados() {
    document.querySelectorAll("[data-kpi]").forEach((elemento) => {
      elemento.textContent = "—";
      colorir(elemento, null);
    });
    const detalhe = porId("publicoDetalhe");
    if (detalhe) detalhe.textContent = "";
    const barras = porId("barrasSegmentos");
    if (barras) barras.replaceChildren();
    const tabela = porId("corpoTabela");
    if (tabela) tabela.replaceChildren();
    porId("dashboardObservacoes").replaceChildren();
    porId("dashboardObservacoes").hidden = true;
    destruirGrafico();
    const vazio = porId("graficoVazio");
    if (vazio) vazio.hidden = true;
  }

  async function obterJson(url, signal) {
    const resposta = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const dados = await resposta.json();
    if (!dados || typeof dados !== "object") throw new Error("Resposta inválida");
    return dados;
  }

  function nomeFonte(fonte) {
    const fontes = {
      dadosCurso: "Dados de cursos", dashVisaoGeral: "Visão geral consolidada",
      dashRetencao: "Retenção consolidada", dashExpansao: "Expansão consolidada"
    };
    return fontes[fonte] || fonte || "Não informada";
  }

  function mostrarContexto(meta, recorte) {
    const inicio = meta.anoInicio ?? recorte.anoInicio;
    const fim = meta.anoFim ?? recorte.anoFim;
    const periodo = inicio && fim ? `${inicio} a ${fim}` : "Sem período disponível";
    const referencia = meta.anoReferencia ?? "—";
    const trechos = [`Período: ${periodo}`, `Ano dos indicadores: ${referencia}`];
    if (painel !== "expansao" && meta.anoComparacao != null) {
      trechos.push(`Crescimento comparado a ${meta.anoComparacao}`);
    }
    trechos.push(`Fonte: ${nomeFonte(meta.fonte || opcoes?.fonte)}`);
    porId("dashboardContexto").textContent = trechos.join(" · ");
    porId("dashboardRecorte").textContent = Object.values(recorte.rotulos).filter(Boolean).join(" · ") || "Todas as regiões, modalidades e cursos";
    const observacoes = porId("dashboardObservacoes");
    for (const observacao of Array.isArray(meta.observacoes) ? meta.observacoes : []) {
      const item = document.createElement("li");
      item.textContent = String(observacao);
      observacoes.append(item);
    }
    observacoes.hidden = !observacoes.childElementCount;
    const titulo = porId("tituloMercados");
    if (titulo) titulo.textContent = `Mercados em crescimento · ${periodo}`;
    const tituloAreas = porId("tituloAreas");
    if (tituloAreas) tituloAreas.textContent = `Conclusão por área · ${referencia}`;
  }

  function desenharGrafico(id, tipo, rotulos, conjuntos) {
    const vazio = porId("graficoVazio");
    if (!rotulos.length || !conjuntos.some((conjunto) => conjunto.data.some((valor) => valorNumerico(valor) !== null))) {
      vazio.textContent = "Sem dados para o gráfico neste recorte.";
      vazio.hidden = false;
      return;
    }
    if (typeof Chart !== "function") {
      vazio.textContent = "Não foi possível carregar o gráfico. Recarregue a página para tentar novamente.";
      vazio.hidden = false;
      return;
    }
    const canvas = porId(id);
    canvas.hidden = false;
    grafico = new Chart(canvas, {
      type: tipo,
      data: { labels: rotulos, datasets: conjuntos },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        spanGaps: false,
        plugins: {
          legend: { display: tipo === "bar", labels: { font: { family: "Poppins" } } },
          tooltip: { callbacks: { label: (contexto) => `${contexto.dataset.label}: ${formatar(contexto.parsed.y)}` } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0, callback: (valor) => inteiro.format(valor) }, grid: { color: "#E4DFD7" } },
          x: { grid: { display: false }, ticks: { font: { family: "Poppins" } } }
        }
      }
    });
  }

  function mostrarGeral(dados) {
    kpi("kpiOcupacao", dados.kpis?.ocupacao, true);
    kpi("kpiCrescimento", dados.kpis?.crescimento, true, true);
    const publico = dados.kpis?.publicoPredominante;
    porId("kpiPublico").textContent = publico?.faixa || "—";
    porId("publicoDetalhe").textContent = publico?.faixa
      ? (valorNumerico(publico.percentual) === null ? "Percentual indisponível" : `${formatar(publico.percentual, true)} das matrículas`)
      : "";
    const linhas = Array.isArray(dados.matriculas) ? dados.matriculas : [];
    desenharGrafico("graficoMatriculas", "line", linhas.map((item) => item.ano), [{
      label: "Matrículas", data: linhas.map((item) => valorNumerico(item.matriculas)),
      borderColor: "#D4A94C", backgroundColor: "#D4A94C", borderWidth: 3, pointRadius: 4, tension: 0
    }]);
  }

  function mostrarSegmentos(segmentos) {
    const container = porId("barrasSegmentos");
    for (const [modalidade, nome] of [[1, "Presencial"], [2, "EAD"]]) {
      const segmento = segmentos.find((item) => Number(item.modalidade) === modalidade);
      const taxa = valorNumerico(segmento?.taxa);
      const linha = document.createElement("div");
      linha.className = "barra";
      const rotulo = document.createElement("span");
      rotulo.className = "barra__nome";
      rotulo.textContent = nome;
      const trilho = document.createElement("div");
      trilho.className = "barra__trilho";
      const preenchimento = document.createElement("div");
      preenchimento.className = "barra__preenchimento";
      preenchimento.style.setProperty("--valor", `${Math.max(0, Math.min(100, taxa ?? 0))}%`);
      preenchimento.setAttribute("aria-hidden", "true");
      const valor = document.createElement("span");
      valor.className = "barra__taxa";
      valor.textContent = formatar(taxa, true);
      trilho.append(preenchimento, valor);
      const detalhe = document.createElement("small");
      detalhe.className = "barra__detalhe";
      detalhe.textContent = segmento
        ? `${formatar(segmento.concluintes)} concluintes / ${formatar(segmento.ingressantes)} ingressantes`
        : "Sem dados para a modalidade";
      linha.append(rotulo, trilho, detalhe);
      container.append(linha);
    }
  }

  function mostrarRetencao(dados) {
    kpi("kpiConcluintes", dados.kpis?.crescimentoConcluintes, true, true);
    mostrarSegmentos(Array.isArray(dados.segmentos) ? dados.segmentos : []);
    const areas = Array.isArray(dados.areas) ? dados.areas : [];
    desenharGrafico("graficoAreas", "bar", areas.map((item) => item.area), [
      { label: "Ingressantes", data: areas.map((item) => valorNumerico(item.ingressantes)), backgroundColor: "#59534E", borderRadius: 4 },
      { label: "Concluintes", data: areas.map((item) => valorNumerico(item.concluintes)), backgroundColor: "#D4A94C", borderRadius: 4 }
    ]);
  }

  function mostrarExpansao(dados) {
    kpi("kpiInteresse", dados.kpis?.interesse);
    kpi("kpiInstituicoes", dados.kpis?.instituicoes);
    kpi("kpiVagas", dados.kpis?.vagas);
    const mercados = Array.isArray(dados.mercados) ? dados.mercados : [];
    const corpo = porId("corpoTabela");
    if (!mercados.length) {
      const linha = corpo.insertRow();
      const celula = linha.insertCell();
      celula.colSpan = 4;
      celula.textContent = "Sem municípios com dados neste recorte.";
      return;
    }
    for (const mercado of mercados) {
      const linha = corpo.insertRow();
      linha.insertCell().textContent = `${mercado.municipio || "Município não informado"}${mercado.uf ? ` / ${mercado.uf}` : ""}`;
      for (const nome of ["presencial", "ead"]) {
        const celula = linha.insertCell();
        celula.textContent = formatar(mercado[nome], true, true);
        colorir(celula, mercado[nome]);
      }
      const interesse = linha.insertCell();
      interesse.className = "tabela__interesse";
      interesse.textContent = formatar(mercado.interesse);
    }
  }

  async function carregarDados() {
    const inicio = valorNumerico(filtros.anoInicio.value);
    const fim = valorNumerico(filtros.anoFim.value);
    if (inicio !== null && fim !== null && inicio > fim) {
      filtros.anoFim.setCustomValidity("O ano final deve ser igual ou posterior ao ano inicial.");
      filtros.anoFim.reportValidity();
      return;
    }
    filtros.anoFim.setCustomValidity("");
    requisicao?.abort();
    const controle = new AbortController();
    requisicao = controle;
    const parametros = new URLSearchParams();
    const recorte = { anoInicio: filtros.anoInicio.value, anoFim: filtros.anoFim.value, rotulos: {} };
    for (const nome of nomesFiltros) {
      if (filtros[nome].value) parametros.set(nome, filtros[nome].value);
      if (!["anoInicio", "anoFim"].includes(nome) && filtros[nome].value) {
        recorte.rotulos[nome] = filtros[nome].selectedOptions[0].textContent;
      }
    }
    campos.disabled = true;
    limparResultados();
    porId("dashboardContexto").textContent = "Carregando o período e os indicadores…";
    porId("dashboardRecorte").textContent = "";
    estado("carregando", "Carregando os dados do painel…");
    try {
      const dados = await obterJson(`/dashboard/${painel}?${parametros}`, controle.signal);
      if (requisicao !== controle) return;
      if (!dados.meta || !dados.kpis) throw new Error("Resposta de painel inválida");
      mostrarContexto(dados.meta, recorte);
      if (painel === "geral") mostrarGeral(dados);
      if (painel === "retencao") mostrarRetencao(dados);
      if (painel === "expansao") mostrarExpansao(dados);
      estado(dados.meta.semDados ? "vazio" : "pronto", dados.meta.semDados
        ? "Nenhum dado encontrado para os filtros selecionados. Ajuste os filtros para consultar outro recorte."
        : "Dados atualizados. — indica um valor indisponível ou uma taxa sem base de comparação.");
    } catch (erro) {
      if (erro.name === "AbortError" || requisicao !== controle) return;
      limparResultados();
      porId("dashboardContexto").textContent = "Não foi possível consultar o período selecionado.";
      estado("erro", "Não foi possível carregar os dados. Verifique sua conexão e tente novamente.");
    } finally {
      if (requisicao === controle) campos.disabled = false;
    }
  }

  async function iniciar() {
    campos.disabled = true;
    estado("carregando", "Carregando as opções de filtros…");
    try {
      const dados = await obterJson(`/dashboard/filtros?painel=${painel}`);
      for (const nome of ["anos", "regioes", "ufs", "municipios", "cursos", "modalidades"]) {
        if (!Array.isArray(dados[nome])) throw new Error("Resposta de filtros inválida");
      }
      opcoes = dados;
      indiceCursos = dados.cursos.map((curso) => ({
        curso,
        busca: normalizarBusca([curso.nomeCurso, curso.municipio, curso.codigoIes, curso.idCurso].filter((valor) => valor != null).join(" "))
      }));
      cursosPorId = new Map(dados.cursos.map((curso) => [String(curso.idCurso), curso]));
      const anos = [...new Set(dados.anos.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
      preencherSelect(filtros.anoInicio, anos, (ano) => ano, (ano) => ano, anos.length ? null : "Sem anos disponíveis");
      preencherSelect(filtros.anoFim, anos, (ano) => ano, (ano) => ano, anos.length ? null : "Sem anos disponíveis");
      preencherSelect(filtros.regiao, dados.regioes, (regiao) => regiao, (regiao) => regiao, "Todas as regiões");
      preencherSelect(filtros.modalidade, dados.modalidades, (modalidade) => modalidade.id, (modalidade) => modalidade.nome, "Todas as modalidades");
      limparFiltros();
      await carregarDados();
    } catch (erro) {
      opcoes = null;
      limparResultados();
      porId("dashboardContexto").textContent = "Opções de consulta indisponíveis.";
      estado("erro", "Não foi possível carregar os filtros. Verifique sua conexão e tente novamente.");
    }
  }

  filtros.regiao.addEventListener("change", () => preencherGeografia(true));
  buscaCurso.addEventListener("input", () => {
    clearTimeout(buscaPendente);
    buscaPendente = setTimeout(atualizarCursos, 200);
  });
  filtros.uf.addEventListener("change", () => {
    filtros.localizacao.value = "";
    preencherGeografia();
  });
  for (const nome of ["anoInicio", "anoFim"]) filtros[nome].addEventListener("change", () => filtros.anoFim.setCustomValidity(""));
  formulario.addEventListener("submit", (evento) => { evento.preventDefault(); carregarDados(); });
  porId("dashboardLimpar").addEventListener("click", () => { limparFiltros(); carregarDados(); });
  porId("dashboardTentar").addEventListener("click", () => opcoes ? carregarDados() : iniciar());

  try {
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));
    if (typeof usuario?.foto === "string" && /^[a-d]$/.test(usuario.foto)) {
      porId("fotoPerfilDashboard").src = `/imgs/${usuario.foto}.png`;
    }
  } catch { /* A foto padrão permanece quando a sessão está inválida. */ }
  porId("logoutDashboard").addEventListener("click", (evento) => {
    evento.preventDefault();
    if (typeof logout === "function") logout();
  });

  iniciar();
})();
