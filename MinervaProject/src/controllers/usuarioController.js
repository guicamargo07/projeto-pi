var usuarioModel = require("../models/usuarioModel");

function autenticar(req, res) {
    var email = req.body.emailServer;
    var senha = req.body.senhaServer;

    if (email == undefined) {
        res.status(400).send("Seu email está undefined!");
    } else if (senha == undefined) {
        res.status(400).send("Sua senha está indefinida!");
    } else {

        usuarioModel.autenticar(email, senha)
            .then(function (resultadoAutenticar) {

                console.log(`Resultados encontrados: ${resultadoAutenticar.length}`);

                if (resultadoAutenticar.length == 1) {

                    res.json({
                        id: resultadoAutenticar[0].idUsuario,
                        email: resultadoAutenticar[0].email,
                        nome: resultadoAutenticar[0].nome,
                        telefone: resultadoAutenticar[0].telefone,
                        foto: resultadoAutenticar[0].foto,
                        sts: resultadoAutenticar[0].sts
                    });

                } else if (resultadoAutenticar.length == 0) {

                    res.status(403).send("Email e/ou senha inválido(s)");

                } else {

                    res.status(403).send(
                        "Mais de um usuário com o mesmo login e senha!"
                    );
                }

            })
            .catch(function (erro) {

                console.log(erro);

                res.status(500).json(erro.sqlMessage);
            });
    }
}

function cadastrar(req, res) {

    var nome = req.body.nomeServer;
    var email = req.body.emailServer;
    var senha = req.body.senhaServer;

    if (nome == undefined) {
        res.status(400).send("Seu nome está undefined!");

    } else if (email == undefined) {
        res.status(400).send("Seu email está undefined!");

    } else if (senha == undefined) {
        res.status(400).send("Sua senha está undefined!");

    } else {

        usuarioModel.cadastrar(nome, email, senha)
            .then(function (resultado) {
                res.json(resultado);
            })
            .catch(function (erro) {

                console.log(erro);

                res.status(500).json(erro.sqlMessage);
            });
    }
}

function salvarEmail(req, res) {
   console.log("BODY RECEBIDO:", req.body);
    var email = req.body.salvarEmailServer;
    var id = req.body.idServer;

    if (email == undefined) {
        res.status(400).send("Sua email está undefined!");

    } else if (id == undefined) {
        res.status(400).send("Seu id está undefined!");

    } else {

        usuarioModel.updateEmail(id, email)
            .then(function (resultado) {
                res.json(resultado);
            })
            .catch(function (erro) {

                console.log(erro);

                res.status(500).json(erro.sqlMessage);
            });
    }
}

function salvarNome(req, res) {
   console.log("BODY RECEBIDO:", req.body);
    var nome = req.body.salvarNomeServer;
    var id = req.body.idServer;

    if (nome == undefined) {
        res.status(400).send("Sua nome está undefined!");

    } else if (id == undefined) {
        res.status(400).send("Seu id está undefined!");

    } else {

        usuarioModel.updateNome(id, nome)
            .then(function (resultado) {
                res.json(resultado);
            })
            .catch(function (erro) {

                console.log(erro);

                res.status(500).json(erro.sqlMessage);
            });
    }
}

function salvarTelefone(req, res) {
   console.log("BODY RECEBIDO:", req.body);
    var telefone = req.body.salvarTelefoneServer;
    var id = req.body.idServer;

    if (telefone == undefined) {
        res.status(400).send("Seu telefone está undefined!");

    } else if (id == undefined) {
        res.status(400).send("Seu id está undefined!");

    } else {

        usuarioModel.updateTelefone(id, telefone)
            .then(function (resultado) {
                res.json(resultado);
            })
            .catch(function (erro) {

                console.log(erro);

                res.status(500).json(erro.sqlMessage);
            });
    }
}


function salvarFoto(req, res) {
   console.log("BODY RECEBIDO:", req.body);
    var foto = req.body.salvarFotoServer;
    var id = req.body.idServer;

    if (foto == undefined) {
        res.status(400).send("Seu email está undefined!");

    } else if (id == undefined) {
        res.status(400).send("Seu id está undefined!");

    } else {

        usuarioModel.updateFoto(id, foto)
            .then(function (resultado) {
                res.json(resultado);
            })
            .catch(function (erro) {

                console.log(erro);

                res.status(500).json(erro.sqlMessage);
            });
    }
}

function salvarSenha(req, res) {
   console.log("BODY RECEBIDO:", req.body);
    var senha = req.body.senhaServer;
    var id = req.body.idServer;

    if (senha == undefined) {
        res.status(400).send("Sua senha está undefined!");

    } else if (id == undefined) {
        res.status(400).send("Seu id está undefined!");

    } else {

        usuarioModel.updateSenha(id, senha)
            .then(function (resultado) {
                res.json(resultado);
            })
            .catch(function (erro) {

                console.log(erro);

                res.status(500).json(erro.sqlMessage);
            });
    }
}

function deletarConta(req, res) {
   console.log("BODY RECEBIDO:", req.body);
    var id = req.body.idServer;
    if (id == undefined) {
        res.status(400).send("Seu id está undefined!");

    } else {

        usuarioModel.deletar(id)
            .then(function (resultado) {
                res.json(resultado);
            })
            .catch(function (erro) {
                console.log(erro);
                res.status(500).json(erro.sqlMessage);
            });
    }
}


module.exports = {
    cadastrar,
    autenticar,
    salvarFoto,
    salvarEmail,
    salvarTelefone,
    salvarNome,
    salvarSenha,
    deletarConta
};
