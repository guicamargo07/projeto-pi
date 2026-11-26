(() => {
  "use strict";

  const painel = document.body.dataset.dashboard;
  if (!["geral", "retencao", "expansao"].includes(painel)) return;

  const porId = (id) => document.getElementById(id);
  const formulario = porId("dashboardFiltros");
  const campos = porId("dashboardCampos");
  const nomesFiltros = ["anoInicio", "anoFim", "regiao", "uf", "localizacao", "modalidade", "area"];
  const filtros = Object.fromEntries(nomesFiltros.map((nome) => [nome, formulario.elements.namedItem(nome)]));
  const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const ufsValidas = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
  const TAMANHO_PAGINA = 25;
  let mercados = [];
  let paginaMercados = 1;
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
    if (convertido !== 0 && Math.abs(convertido) < 0.01) return `${convertido < 0 ? "−" : ""}<0,01${percentual ? "%" : ""}`;
    const formato = Math.abs(convertido) < 1 ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }) : numero;
    return `${sinal && convertido > 0 ? "+" : ""}${formato.format(convertido)}${percentual ? "%" : ""}`;
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

  function nomeMunicipio(local) {
    return `${local.municipio || "Município não informado"} · ${ufsValidas.has(local.uf) ? local.uf : "UF não identificada"}`;
  }

  function marcarAlteracao(mensagem = "Filtros alterados. Clique em Aplicar filtros para atualizar os resultados.") {
    porId("filtrosPendentes").textContent = mensagem;
    porId("filtrosPendentes").hidden = false;
  }

  function preencherGeografia(reiniciarUf = false) {
    const regiao = filtros.regiao.value;
    const ufAnterior = reiniciarUf ? "" : filtros.uf.value;
    const municipioAnterior = reiniciarUf ? "" : filtros.localizacao.value;
    const daRegiao = opcoes.municipios.filter(item => !regiao ||
      (regiao === "sem-regiao" ? !item.regiao : item.regiao === regiao));
    const ufs = [...new Set(daRegiao.map(item => item.uf).filter(uf => ufsValidas.has(uf)))].sort();
    preencherSelect(filtros.uf, ufs, (uf) => uf, (uf) => uf, "Todos");
    if (daRegiao.some(item => !ufsValidas.has(item.uf))) filtros.uf.add(new Option("UF não identificada", "sem-uf"));
    if ([...filtros.uf.options].some(item => item.value === ufAnterior)) filtros.uf.value = ufAnterior;
    const municipios = daRegiao.filter(item => !filtros.uf.value ||
      (filtros.uf.value === "sem-uf" ? !ufsValidas.has(item.uf) : item.uf === filtros.uf.value))
      .sort((a, b) => a.municipio.localeCompare(b.municipio, "pt-BR"));
    preencherSelect(filtros.localizacao, municipios, (item) => item.idLocalizacao,
      nomeMunicipio, "Todos");
    if (municipios.some((item) => String(item.idLocalizacao) === municipioAnterior)) {
      filtros.localizacao.value = municipioAnterior;
    }
  }

  function limparFiltros() {
    filtros.anoInicio.value = String(opcoes.anoInicioPadrao ?? Math.min(opcoes.anos[0] ?? 2021, 2021));
    filtros.anoFim.value = String(opcoes.anoFimPadrao ?? 2021);
    if (painel === "retencao") filtros.anoInicio.value = filtros.anoFim.value;
    for (const nome of ["regiao", "modalidade", "area"]) filtros[nome].value = "";
    preencherGeografia(true);
    if (painel === "expansao") {
      porId("buscarMunicipioTabela").value = "";
      porId("ordenarMercados").value = "presencial";
      paginaMercados = 1;
    }
    porId("filtrosPendentes").hidden = true;
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
    if (tabela) {
      tabela.replaceChildren();
      porId("tabelaContagem").textContent = "";
      porId("paginaAnterior").disabled = true;
      porId("paginaSeguinte").disabled = true;
    }
    mercados = [];
    porId("dashboardObservacoes").replaceChildren();
    porId("dashboardObservacoes").hidden = true;
    destruirGrafico();
    const vazio = porId("graficoVazio");
    if (vazio) vazio.hidden = true;
  }

  async function obterJson(url, signal) {
    const resposta = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!resposta.ok) throw new Error(resposta.status === 400
      ? "Revise o período e os filtros selecionados antes de tentar novamente."
      : "Não foi possível consultar os dados agora. Tente novamente em instantes.");
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
    const trechos = painel === "retencao" ? [`Ano analisado: ${referencia}`] :
      [`Período analisado: ${periodo}`, `Indicadores: ${referencia}`];
    if (painel !== "expansao" && meta.anoComparacao != null) {
      trechos.push(`Variação em relação a ${meta.anoComparacao}`);
    }
    porId("dashboardContexto").textContent = trechos.join(" · ");
    porId("dashboardRecorte").textContent = Object.values(recorte.rotulos).filter(Boolean).join(" · ") || "Brasil · Todas as modalidades e áreas de conhecimento";
    const observacoes = porId("dashboardObservacoes");
    for (const observacao of Array.isArray(meta.observacoes) ? meta.observacoes : []) {
      if (String(observacao).startsWith("Indicadores calculados a partir")) continue;
      if (meta.anoParcial && Number(fim) < meta.anoParcial && String(observacao).includes("Excel")) continue;
      const item = document.createElement("li");
      item.textContent = String(observacao);
      observacoes.append(item);
    }
    observacoes.hidden = !observacoes.childElementCount;
    const titulo = porId("tituloMercados");
    if (titulo) titulo.textContent = `Variação de matrículas por município · ${periodo}`;
    const tituloAreas = porId("tituloAreas");
    if (tituloAreas) tituloAreas.textContent = `Ingressantes e concluintes por área · ${referencia}`;
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
    mercados = Array.isArray(dados.mercados) ? dados.mercados : [];
    paginaMercados = 1;
    renderizarMercados();
  }

  function renderizarMercados() {
    const termo = normalizarBusca(porId("buscarMunicipioTabela").value);
    const ordem = porId("ordenarMercados").value;
    const encontrados = mercados.filter(item => normalizarBusca(nomeMunicipio(item)).includes(termo));
    encontrados.sort((a, b) => {
      if (ordem !== "municipio") {
        const va = valorNumerico(a[ordem]);
        const vb = valorNumerico(b[ordem]);
        if (va !== vb) return va === null ? 1 : vb === null ? -1 : vb - va;
      }
      return nomeMunicipio(a).localeCompare(nomeMunicipio(b), "pt-BR");
    });
    const totalPaginas = Math.max(1, Math.ceil(encontrados.length / TAMANHO_PAGINA));
    paginaMercados = Math.max(1, Math.min(paginaMercados, totalPaginas));
    const inicio = (paginaMercados - 1) * TAMANHO_PAGINA;
    const linhas = encontrados.slice(inicio, inicio + TAMANHO_PAGINA);
    const corpo = porId("corpoTabela");
    corpo.replaceChildren();
    porId("paginaAnterior").disabled = paginaMercados === 1;
    porId("paginaSeguinte").disabled = paginaMercados === totalPaginas;
    porId("tabelaContagem").textContent = encontrados.length
      ? `${inteiro.format(inicio + 1)}–${inteiro.format(inicio + linhas.length)} de ${inteiro.format(encontrados.length)} municípios · página ${paginaMercados} de ${totalPaginas}`
      : "Nenhum município encontrado";
    if (!linhas.length) {
      const linha = corpo.insertRow();
      const celula = linha.insertCell();
      celula.colSpan = 4;
      celula.textContent = "Sem municípios com dados neste recorte.";
      return;
    }
    for (const mercado of linhas) {
      const linha = corpo.insertRow();
      linha.insertCell().textContent = nomeMunicipio(mercado);
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
    porId("filtrosPendentes").hidden = true;
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
        : "Resultados atualizados.");
    } catch (erro) {
      if (erro.name === "AbortError" || requisicao !== controle) return;
      limparResultados();
      porId("dashboardContexto").textContent = "Não foi possível consultar o período selecionado.";
      estado("erro", erro.message);
    } finally {
      if (requisicao === controle) campos.disabled = false;
    }
  }

  async function iniciar() {
    campos.disabled = true;
    estado("carregando", "Carregando as opções de filtros…");
    try {
      const dados = await obterJson(`/dashboard/filtros?painel=${painel}&compacto=1`);
      for (const nome of ["anos", "regioes", "ufs", "municipios", "areas", "modalidades"]) {
        if (!Array.isArray(dados[nome])) throw new Error("Resposta de filtros inválida");
      }
      opcoes = dados;
      const anos = [...new Set([...dados.anos.map(Number).filter(Number.isFinite), Number(dados.anoFimPadrao ?? 2021)])].sort((a, b) => a - b);
      const rotuloAno = ano => ano === dados.anoParcial ? `${ano} · dados parciais` : String(ano);
      if (painel !== "retencao") preencherSelect(filtros.anoInicio, anos, (ano) => ano, rotuloAno, anos.length ? null : "Sem anos disponíveis");
      preencherSelect(filtros.anoFim, anos, (ano) => ano, rotuloAno, anos.length ? null : "Sem anos disponíveis");
      const ordemRegioes = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];
      preencherSelect(filtros.regiao, [...dados.regioes].sort((a, b) => ordemRegioes.indexOf(a) - ordemRegioes.indexOf(b)),
        (regiao) => regiao, (regiao) => regiao, "Todas");
      if (dados.municipios.some(local => !local.regiao)) filtros.regiao.add(new Option("Região não identificada", "sem-regiao"));
      preencherSelect(filtros.area, dados.areas, area => area, area => area, "Todas as áreas");
      preencherSelect(filtros.modalidade, dados.modalidades, (modalidade) => modalidade.id, (modalidade) => modalidade.nome, "Todas as modalidades");
      const semUf = dados.geografia?.municipiosSemUf || 0;
      porId("geografiaAjuda").textContent = semUf
        ? `${inteiro.format(semUf)} municípios têm UF não identificada. Use essa opção no filtro Estado para consultá-los; eles já fazem parte do total sem filtro.`
        : "A seleção de região e estado restringe a lista de municípios.";
      porId("periodoAjuda").textContent = (painel === "geral"
        ? "Os indicadores usam o ano final; o gráfico mostra o intervalo."
        : "Os indicadores usam o ano final; a tabela compara os dois anos.") +
        (dados.anoParcial ? ` ${dados.anoParcial} possui informações parciais.` : "");
      if (painel === "retencao") porId("periodoAjuda").textContent =
        "Os indicadores e o gráfico usam este ano. A variação compara com o ano anterior." +
        (dados.anoParcial ? ` ${dados.anoParcial} possui informações parciais.` : "");
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
  filtros.uf.addEventListener("change", () => {
    filtros.localizacao.value = "";
    preencherGeografia();
  });
  for (const nome of nomesFiltros) filtros[nome].addEventListener("change", () => {
    filtros.anoFim.setCustomValidity("");
    if (painel === "retencao") filtros.anoInicio.value = filtros.anoFim.value;
    if (Number(filtros.anoInicio.value) > Number(filtros.anoFim.value)) {
      filtros[nome === "anoInicio" ? "anoFim" : "anoInicio"].value = filtros[nome].value;
    }
    marcarAlteracao();
    if (filtros[nome].selectedOptions) filtros[nome].title = filtros[nome].selectedOptions[0]?.textContent || "";
  });
  if (painel === "expansao") {
    for (const id of ["buscarMunicipioTabela", "ordenarMercados"]) porId(id).addEventListener("input", () => {
      paginaMercados = 1;
      renderizarMercados();
    });
    porId("paginaAnterior").addEventListener("click", () => { paginaMercados--; renderizarMercados(); });
    porId("paginaSeguinte").addEventListener("click", () => { paginaMercados++; renderizarMercados(); });
  }
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
