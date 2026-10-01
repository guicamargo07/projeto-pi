const usuario = JSON.parse(sessionStorage.getItem('usuario'));

const vetor = ['a', 'b', 'c', 'd'];


/* ===================================================================
   NOME
=================================================================== */

let nome = usuario.nome;
function alterarNome() {
    nomeSec.innerHTML = `<input type="text" id="nomeSal" name="nome" placeholder="Digite seu nome"> <button type="submit" onclick="salvarNome()">Salvar</button>`
}

function salvarNome() {
    var nomeSalvo = nomeSal.value;
    var idSalvo = usuario.id;

    if (nomeSalvo == "") {
        alert('nome inválido');
        return;
    }
    fetch("/usuarios/salvarNome", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            idServer: idSalvo,
            salvarNomeServer: nomeSalvo
        })
    })
        .then(function (resposta) {
            console.log("resposta: ", resposta);

            if (resposta.ok) {
                usuario.nome = nomeSalvo;
                sessionStorage.setItem(
                    "usuario",
                    JSON.stringify(usuario)
                );

                console.log("Nome atualizado no sessionStorage!");

                window.location = "/pages/usuario/configUsu.html";

            } else {
                throw "Houve um erro ao tentar salvar o email!";
            }
        })
        .catch(function (erro) {
            console.log(`#ERRO: ${erro}`);
        });

    return false;
}

/* ===================================================================
   EMAIL
=================================================================== */
let email = usuario.email;
function alterarEmail() {
    emailSec.innerHTML = `<input type="text" id="emailSal" name="email" placeholder="Digite seu email"> <button type="submit" onclick="salvarEmail()">Salvar</button>`
}
function salvarEmail() {
    var emailSalvo = emailSal.value;
    var idSalvo = usuario.id;

    if (emailSalvo == "") {
        alert('Email inválido');
        return;
    } else if (
        emailSalvo.indexOf('@') === -1 ||
        emailSalvo.indexOf('.') === -1 ||
        emailSalvo.indexOf('@') > emailSalvo.lastIndexOf('.')
    ) {
        alert('Email inválido');
        return;
    }
    fetch("/usuarios/salvarEmail", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            idServer: idSalvo,
            salvarEmailServer: emailSalvo
        })
    })
        .then(function (resposta) {
            console.log("resposta: ", resposta);

            if (resposta.ok) {
                usuario.email = emailSalvo;
                sessionStorage.setItem(
                    "usuario",
                    JSON.stringify(usuario)
                );

                console.log("Email atualizada no sessionStorage!");

                window.location = "/pages/usuario/configUsu.html";

            } else {
                throw "Houve um erro ao tentar salvar o email!";
            }
        })
        .catch(function (erro) {
            console.log(`#ERRO: ${erro}`);
        });

    return false;
}

/* ===================================================================
   TELEFONE
=================================================================== */

if (usuario.telefone == null) {
    telefone = '00 00000-0000'
} else {
    telefone = usuario.telefone;
}

function aplicarMascaraTelefone(valor) {
    valor = valor.replace(/\D/g, "");

    if (valor.length > 11) {
        valor = valor.substring(0, 11);
    }

    if (valor.length <= 2) {
        return "(" + valor;
    }

    if (valor.length <= 6) {
        return "(" + valor.substring(0, 2) + ") " + valor.substring(2);
    }

    if (valor.length <= 10) {
        return "(" + valor.substring(0, 2) + ") " +
            valor.substring(2, 6) + "-" +
            valor.substring(6);
    }

    return "(" + valor.substring(0, 2) + ") " +
        valor.substring(2, 7) + "-" +
        valor.substring(7);
}

function alterarTelefone() {
    telefoneSec.innerHTML = `
        <input 
            type="tel" 
            id="telefoneSal" 
            name="telefone" 
            placeholder="(11) 99999-9999" 
            maxlength="15" 
            required
        />
        <button type="submit" onclick="salvarTelefone()">Salvar</button>
    `;

    document.getElementById("telefoneSal").addEventListener("input", function () {
        this.value = aplicarMascaraTelefone(this.value);
    });
}

function salvarTelefone() {
    var telefoneSalvo = telefoneSal.value;
    var idSalvo = usuario.id;

    fetch("/usuarios/salvarTelefone", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            idServer: idSalvo,
            salvarTelefoneServer: telefoneSalvo
        })
    })
        .then(function (resposta) {
            console.log("resposta: ", resposta);

            if (resposta.ok) {
                usuario.telefone = telefoneSalvo;
                sessionStorage.setItem(
                    "usuario",
                    JSON.stringify(usuario)
                );

                console.log("Telefone atualizada no sessionStorage!");

                window.location = "/pages/usuario/configUsu.html";

            } else {
                throw "Houve um erro ao tentar salvar o email!";
            }
        })
        .catch(function (erro) {
            console.log(`#ERRO: ${erro}`);
        });

    return false;
}


/* ===================================================================
   FOTO
=================================================================== */
let foto = usuario.foto;
let onde = vetor.indexOf(usuario.foto);
fotoPerfil.src = `/imgs/${foto}.png`;

function proximo() {
    if (onde == 3) {
        onde = 0
        foto = vetor[onde]
    } else {
        onde = onde + 1
        foto = vetor[onde]
    }

    fotoPerfil.src = `/imgs/${foto}.png`;
}

function anterior() {
    if (onde == 0) {
        foto = vetor[3]
        onde = 3
    } else {
        onde = onde - 1
        foto = vetor[onde]
    }

    fotoPerfil.src = `/imgs/${foto}.png`;
}

function salvarFoto() {
    var fotoSalva = foto;
    var idSalvo = usuario.id;

    fetch("/usuarios/salvarFoto", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            idServer: idSalvo,
            salvarFotoServer: fotoSalva
        })
    })
        .then(function (resposta) {
            console.log("resposta: ", resposta);

            if (resposta.ok) {
                usuario.foto = fotoSalva;
                sessionStorage.setItem(
                    "usuario",
                    JSON.stringify(usuario)
                );

                console.log("Foto atualizada no sessionStorage!");

                window.location = "/pages/usuario/configUsu.html";

            } else {
                throw "Houve um erro ao tentar salvar a foto!";
            }
        })
        .catch(function (erro) {
            console.log(`#ERRO: ${erro}`);
        });

    return false;
}

nomeSec.innerHTML = `${nome} <button type="submit" onclick="alterarNome()">Alterar nome cadastrado</button>`;
telefoneSec.innerHTML = `${telefone} <button type="submit" onclick="alterarTelefone()">Alterar telefone cadastrado</button>`;
emailSec.innerHTML = `${email} <button type="submit" onclick="alterarEmail()">Alterar email cadastrado</button>`;

function alterarSenha() {
    var senha = senhaV.value;
    var confirma = Confirmasenha.value
    var idSalvo = usuario.id;
    if (senha.length <= 8) {
        alert('Senha com 8 ou menos digitos');
        return;
    } else if (senha !== confirma) {
        alert('Não é igual a senha');
        return;
    }
    fetch("/usuarios/salvarSenha", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            idServer: idSalvo,
            senhaServer: senha
        })
    })
        .then(function (resposta) {
            console.log("resposta: ", resposta);

            if (resposta.ok) {
                sessionStorage.setItem(
                    "usuario",
                    JSON.stringify(usuario)
                );

                alert("senha atualizada");

                window.location = "/pages/usuario/configUsu.html";

            } else {
                throw "Houve um erro ao tentar salvar a senha";
            }
        })
        .catch(function (erro) {
            console.log(`#ERRO: ${erro}`);
        });

    return false;
}

function deletar() {
    var idSalvo = usuario.id;
    fetch("/usuarios/deletarConta", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            idServer: idSalvo,
        })
    })
        .then(function (resposta) {
            console.log("resposta: ", resposta);

            if (resposta.ok) {
                sessionStorage.clear(); 
                alert("conta deletada com sucessso");

                window.location = "/index.html";

            } else {
                throw "Houve um erro ao tentar deletar a conta";
            }
        })
        .catch(function (erro) {
            console.log(`#ERRO: ${erro}`);
        });

    return false;
}
