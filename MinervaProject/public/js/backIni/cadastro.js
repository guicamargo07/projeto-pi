function cadastrar() {
    //Recupere o valor da nova input pelo nome do id
    // Agora vá para o método fetch logo abaixo
    var nomeVar = inputNome.value;
    var emailVar = inputEmail.value;
    var senhaVar = inputSenha.value;
    var confirmacaoSenhaVar = inputSenhaConfir.value;

    // Verificando se há algum campo em branco
    if (
        nomeVar == "" ||
        emailVar == "" ||
        senhaVar == "" ||
        confirmacaoSenhaVar == ""
    ) {
        alert('Todos os campos em branco')
        return;
    } else if (nomeVar.length <= 1) {
        alert('Nome com um ou menos caracteres')
        return;
    } else if (
        emailVar.indexOf('@') === -1 ||
        emailVar.indexOf('.') === -1 ||
        emailVar.indexOf('@') > emailVar.lastIndexOf('.')
    ) {
        alert('Email inválido');
        return;
    } else if (senhaVar.length <= 8) {
        alert('Senha com 8 ou menos digitos');
        return;
    } else if (senhaVar !== confirmacaoSenhaVar) {
        alert('Não é igual a senha');
        return;
    } else {

        // Enviando o valor da nova input
        fetch("/usuarios/cadastrar", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                // crie um atributo que recebe o valor recuperado aqui
                // Agora vá para o arquivo routes/usuario.js
                nomeServer: nomeVar,
                emailServer: emailVar,
                senhaServer: senhaVar,
            }),
        })
            .then(function (resposta) {
                console.log("resposta: ", resposta);

                if (resposta.ok) {
                    console.log("Cadastro realizado com sucesso! Redirecionando para tela de Login...");
                    window.location = "./login.html";
                } else {
                    throw "Houve um erro ao tentar realizar o cadastro!";
                }
            })
            .catch(function (resposta) {
                console.log(`#ERRO: ${resposta}`);
            });

        return false;
    }
}
