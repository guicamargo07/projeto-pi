function logar() {
    var emailVar = inputEmail.value;
    var senhaVar = inputSenha.value;

    if (emailVar == "" || senhaVar == "") {
        console.log('Campos inválidos')
        alert('Campos Inválidos')
        return false;
    }
    else {
        console.log('Passei')
    }

    console.log("FORM LOGIN: ", emailVar);
    console.log("FORM SENHA: ", senhaVar);

    fetch("/usuarios/autenticar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            emailServer: emailVar,
            senhaServer: senhaVar
        })
    }).then(function (resposta) {
        console.log("ESTOU NO THEN DO entrar()!")

        if (resposta.ok) {
            console.log(resposta);

            resposta.json().then(json => {
                sessionStorage.setItem('usuario', JSON.stringify({ // cria-se um objeto json para realizar verificação
                    id: json.id,
                    email: json.email,
                    nome: json.nome,
                    tipoUsuario: json.tipoUsuario,
                    foto: json.fotoUsuario
                }))

                setTimeout(function () {
                    window.location = "../../index.html";
                }, 1000); 

            });

        } else {

            console.log("Houve um erro ao tentar realizar o login!");

            resposta.text().then(texto => {
                console.error(texto);
            });
        }

    }).catch(function (erro) {
        console.log(erro);
    })

    return false;
}
