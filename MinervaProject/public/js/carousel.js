// Seleciona todos os elementos de slide (imagens do carousel)
let slides = document.querySelectorAll(".slide");

// Seleciona todos os indicadores (as barrinhas embaixo do carousel)
let bolinha = document.querySelectorAll(".indica");

// Seleciona os botões de seta (anterior e próximo)
let setaAnterior = document.querySelector(".seta-prev");
let setaProxima = document.querySelector(".seta-next");

// Seleciona o container do carousel (usado pra pausar o autoplay no hover)
let carouselContainer = document.querySelector(".carousel");

// Índice do slide atual, começa em 0 (primeiro slide)
let i = 0;

// Tempo do intervalo automático (em milissegundos)
let tempoTroca = 4000;

// Variável que vai guardar a referência do setInterval,
// pra gente conseguir pausar (clearInterval) e retomar depois
let autoPlay;

// Avança para o próximo slide
function nextSlide() {
    i++;
    // Se passou do último slide, volta pro primeiro
    if (i >= slides.length) {
        i = 0;
    }
    showSlide(i);
}

// Volta para o slide anterior
function prevSlide() {
    i--;
    // Se ficar negativo, pula pro último slide
    if (i < 0) {
        i = slides.length - 1;
    }
    showSlide(i);
}

// Exibe o slide de índice "i" e atualiza o indicador correspondente
function showSlide(i) {
    // Remove "active" de todos os slides
    for (let j = 0; j < slides.length; j++) {
        slides[j].classList.remove("active");
    }

    // Remove "active" de todos os indicadores
    for (let j = 0; j < bolinha.length; j++) {
        bolinha[j].classList.remove("active");
    }

    // Ativa o slide atual
    slides[i].classList.add("active");

    // Ativa o indicador atual
    bolinha[i].classList.add("active");
}

// Inicia (ou reinicia) o autoplay do carousel
function iniciarAutoPlay() {
    autoPlay = setInterval(nextSlide, tempoTroca);
}

// Para o autoplay (usado quando o mouse entra no carousel, ou após clique manual)
function pararAutoPlay() {
    clearInterval(autoPlay);
}

// Clique na seta "próximo"
setaProxima.addEventListener("click", function () {
    nextSlide();
    // Reinicia o timer pra não trocar de slide de novo logo em seguida do clique
    pararAutoPlay();
    iniciarAutoPlay();
});

// Clique na seta "anterior"
setaAnterior.addEventListener("click", function () {
    prevSlide();
    pararAutoPlay();
    iniciarAutoPlay();
});

// Clique em cada indicador: pula direto pro slide escolhido
for (let j = 0; j < bolinha.length; j++) {
    bolinha[j].addEventListener("click", function () {
        i = j;
        showSlide(i);
        pararAutoPlay();
        iniciarAutoPlay();
    });
}

// Pausa o autoplay quando o mouse entra no carousel
carouselContainer.addEventListener("mouseenter", pararAutoPlay);

// Retoma o autoplay quando o mouse sai do carousel
carouselContainer.addEventListener("mouseleave", iniciarAutoPlay);

// Inicia o autoplay assim que a página carrega
iniciarAutoPlay();