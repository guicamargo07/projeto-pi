const usuario = JSON.parse(sessionStorage.getItem('usuario'));

// Vetor com os caminhos das páginas públicas
let paginasPublicas = [
    "/index.html",
    "/pages/usuario/login.html",
    "/pages/usuario/cadastro.html"
];

// Pego o caminho atual
let paginaAtual = window.location.pathname;

// Pego o header da página
const header = document.getElementById('header');

if (!usuario) {

    if (!paginasPublicas.includes(paginaAtual)) {
        window.location.href = "/index.html";
    }

} else {

    header.innerHTML = `
        <div class="logoNav">
            <img src="imgs/logo.png" alt="Logo Minerva Consulting">
        </div>

        <nav class="indiceNav">
            <a href="#" class="indiceEspec">Home</a>
            <a href="#sobre-nos" class="indiceEspec">Sobre nós</a>
            <a href="#nosso-projeto" class="indiceEspec">Nosso Projeto</a>
            <a href="#contato" class="indiceEspec">Contate-nos</a>
        </nav>

        <div class="loginNav">
            <div class="perfilDropdown">

                <button class="perfilButton" id="perfilButton" type="button">
                    <img 
                        src="/imgs/${usuario.foto}.png"
                        alt="Foto de perfil"
                    >
                </button>

                <div class="dropdownMenu" id="dropdownMenu">
                    <a href="./pages/usuario/configUsu.html">Configurações</a>
                    <a href="#" id="logoutButton">Sair</a>
                </div>

            </div>
        </div>
    `;

    // Pega os elementos que acabaram de ser criados
    const perfilButton = document.getElementById('perfilButton');
    const perfilDropdown = document.querySelector('.perfilDropdown');
    const logoutButton = document.getElementById('logoutButton');

    // Abre e fecha o dropdown ao clicar na foto
    perfilButton.addEventListener('click', function (evento) {

        evento.stopPropagation();

        perfilDropdown.classList.toggle('aberto');
    });

    // Impede que clicar dentro do dropdown
    // feche ele imediatamente
    perfilDropdown.addEventListener('click', function (evento) {
        evento.stopPropagation();
    });

    // Fecha o dropdown ao clicar fora dele
    document.addEventListener('click', function () {
        perfilDropdown.classList.remove('aberto');
    });

    // ================================================================
    // BOTÃO SAIR
    // ================================================================

    logoutButton.addEventListener('click', function (evento) {

        evento.preventDefault();

        logout();
    });

    console.log("Header do usuário carregado.");
}


// ================================================================
// FUNÇÃO DE LOGOUT
// ================================================================

function logout() {

    // Apaga os dados da sessão
    sessionStorage.clear();

    // Volta para a página inicial
    window.location.href = "/index.html";
}