(() => {
  const ajudas = document.querySelectorAll(".kpi-ajuda");
  let ajudaAtiva = null;
  let fixada = false;
  let fechamentoPendente;

  function cancelarFechamento() {
    clearTimeout(fechamentoPendente);
  }

  function fechar() {
    cancelarFechamento();
    if (!ajudaAtiva) return;

    ajudaAtiva.querySelector(".kpi-tooltip").hidden = true;
    ajudaAtiva.querySelector("button").setAttribute("aria-expanded", "false");
    ajudaAtiva = null;
    fixada = false;
  }

  function posicionar() {
    if (!ajudaAtiva) return;

    const botao = ajudaAtiva.querySelector("button");
    const tooltip = ajudaAtiva.querySelector(".kpi-tooltip");
    const ancora = botao.getBoundingClientRect();
    const larguraTela = document.documentElement.clientWidth;
    const alturaTela = window.innerHeight;
    const margem = 12;
    const distancia = 8;

    if (ancora.bottom < 0 || ancora.top > alturaTela) {
      fechar();
      return;
    }

    tooltip.style.maxHeight = `${alturaTela - margem * 2}px`;
    const espacoAbaixo = alturaTela - ancora.bottom - distancia - margem;
    const espacoAcima = ancora.top - distancia - margem;
    const abrirAbaixo = tooltip.offsetHeight <= espacoAbaixo || espacoAbaixo >= espacoAcima;

    tooltip.style.maxHeight = `${Math.max(0, abrirAbaixo ? espacoAbaixo : espacoAcima)}px`;
    const painel = tooltip.getBoundingClientRect();
    const esquerda = Math.max(margem, Math.min(ancora.right - painel.width, larguraTela - painel.width - margem));
    const topo = abrirAbaixo ? ancora.bottom + distancia : ancora.top - painel.height - distancia;

    tooltip.style.left = `${esquerda}px`;
    tooltip.style.top = `${Math.max(margem, topo)}px`;
  }

  function abrir(ajuda, porClique = false) {
    cancelarFechamento();
    if (ajudaAtiva !== ajuda) {
      fechar();
      ajudaAtiva = ajuda;
    }

    fixada = fixada || porClique;
    ajuda.querySelector(".kpi-tooltip").hidden = false;
    ajuda.querySelector("button").setAttribute("aria-expanded", "true");
    posicionar();
  }

  ajudas.forEach((ajuda) => {
    const botao = ajuda.querySelector("button");

    ajuda.addEventListener("pointerenter", (evento) => {
      if (evento.pointerType === "mouse") abrir(ajuda);
    });

    ajuda.addEventListener("pointerleave", (evento) => {
      if (evento.pointerType !== "mouse" || fixada || ajuda.contains(document.activeElement)) return;

      // Permite atravessar o espaço entre o ícone e o tooltip sem fechá-lo.
      fechamentoPendente = setTimeout(() => {
        if (ajudaAtiva === ajuda) fechar();
      }, 150);
    });

    botao.addEventListener("focus", () => abrir(ajuda));

    ajuda.addEventListener("focusout", (evento) => {
      if (ajuda.contains(evento.relatedTarget) || ajudaAtiva !== ajuda) return;
      // Clicar no texto tira o foco do botão sem sair da explicação.
      if (!evento.relatedTarget && (fixada || ajuda.matches(":hover"))) return;
      fechar();
    });

    botao.addEventListener("click", () => {
      if (ajudaAtiva === ajuda && fixada) {
        fechar();
      } else {
        abrir(ajuda, true);
      }
    });
  });

  document.addEventListener("pointerdown", (evento) => {
    if (ajudaAtiva && !ajudaAtiva.contains(evento.target)) fechar();
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && ajudaAtiva) {
      fechar();
      evento.preventDefault();
    }
  });

  window.addEventListener("resize", posicionar);
  window.addEventListener("scroll", (evento) => {
    if (!ajudaAtiva?.querySelector(".kpi-tooltip").contains(evento.target)) posicionar();
  }, true);
})();
