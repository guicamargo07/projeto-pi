CREATE DATABASE IF NOT EXISTS MinervaDB;
USE MinervaDB;

CREATE TABLE usuario (
    idUsuario INT PRIMARY KEY auto_increment,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    foto CHAR(1) DEFAULT 'a',
    telefone VARCHAR(20),
    sts TINYINT DEFAULT '1'
);

CREATE TABLE localizacao (
    idLocalizacao INT PRIMARY KEY auto_increment,
    regiao VARCHAR(50) NOT NULL,
    uf CHAR(2) NOT NULL,
    municipio VARCHAR(100) NOT NULL
);

CREATE TABLE instituicao (
    idInstituicao INT PRIMARY KEY auto_increment,
    codigoIes INT NOT NULL,
    nomeIes VARCHAR(200) NOT NULL,
    redeEnsino INT NOT NULL,
    categoriaAdministrativa VARCHAR(100) NOT NULL,
    organizacaoAcademica VARCHAR(100) NOT NULL,
    nivelAcademico INT NOT NULL,
    fkLocalizacao INT,
    CONSTRAINT fk_localizacao
        FOREIGN KEY (fkLocalizacao) REFERENCES localizacao(idLocalizacao)
);

CREATE TABLE curso (
    idCurso INT PRIMARY KEY auto_increment,
    codigoCurso INT NOT NULL,
    nomeCurso VARCHAR(200) NOT NULL,
    areaGeral VARCHAR(150),
    areaEspecifica VARCHAR(150),
    grauAcademico VARCHAR(100),
    modalidadeEnsino INT NOT NULL,
    fkInstituicao INT,
    CONSTRAINT fk_instituicao
        FOREIGN KEY (fkInstituicao) REFERENCES instituicao(idInstituicao)
);

CREATE TABLE dadosCurso (
    idDadosCurso INT PRIMARY KEY auto_increment,
    anoCenso INT NOT NULL,
    vagasOfertadas INT,
    inscritos INT,
    ingressantes INT,
    matriculas INT,
    concluintes INT,
    matriculas0a17 INT,
    matriculas18a24 INT,
    matriculas25a29 INT,
    matriculas30a34 INT,
    matriculas35a39 INT,
    matriculas40a49 INT,
    matriculas50a59 INT,
    matriculas60Mais INT,
    matriculasFemininas INT,
    matriculasMasculinas INT,
    fkCurso INT,
    CONSTRAINT fk_curso
        FOREIGN KEY (fkCurso) REFERENCES curso(idCurso)
);

-- ---------------------------------------------------------------------
-- TABELAS DA DASHBOARD (novas)
-- Guardam apenas contagens (INT). Os percentuais e taxas da tela
-- (ocupação, interesse, crescimento, conclusão) são calculados em cima
-- delas, comparando anos e dividindo os totais.
-- modalidadeEnsino segue o padrão da tabela curso (1 = Presencial, 2 = EAD).
-- Filtros da tela: anoCenso (ano início/fim), fkLocalizacao (região, UF e
-- município), modalidadeEnsino e fkCurso.
-- ---------------------------------------------------------------------

-- Tela VISÃO GERAL
-- Taxa de ocupação = ingressantes / vagasOfertadas
-- Taxa de crescimento = matriculas de um ano comparada ao ano anterior
-- Público predominante = faixaPredominante e seu percentual sobre matriculas
-- Evolução das matrículas = matriculas por anoCenso
CREATE TABLE dashVisaoGeral (
    idDashVisaoGeral INT PRIMARY KEY auto_increment,
    anoCenso INT NOT NULL,
    modalidadeEnsino INT NOT NULL,
    vagasOfertadas INT,
    ingressantes INT,
    matriculas INT,
    faixaPredominante VARCHAR(20),
    matriculasFaixaPredominante INT,
    fkLocalizacao INT,
    fkCurso INT,
    CONSTRAINT fk_dashvisaogeral_localizacao
        FOREIGN KEY (fkLocalizacao) REFERENCES localizacao(idLocalizacao),
    CONSTRAINT fk_dashvisaogeral_curso
        FOREIGN KEY (fkCurso) REFERENCES curso(idCurso)
);

-- Tela RETENÇÃO
-- Taxa de crescimento de concluintes = concluintes de um ano comparado ao anterior
-- Conclusão por segmento = concluintes / ingressantes por modalidadeEnsino
-- Conclusão por área = ingressantes x concluintes por areaGeral
CREATE TABLE dashRetencao (
    idDashRetencao INT PRIMARY KEY auto_increment,
    anoCenso INT NOT NULL,
    modalidadeEnsino INT NOT NULL,
    areaGeral VARCHAR(150),
    ingressantes INT,
    concluintes INT,
    fkLocalizacao INT,
    fkCurso INT,
    CONSTRAINT fk_dashretencao_localizacao
        FOREIGN KEY (fkLocalizacao) REFERENCES localizacao(idLocalizacao),
    CONSTRAINT fk_dashretencao_curso
        FOREIGN KEY (fkCurso) REFERENCES curso(idCurso)
);

-- Tela EXPANSÃO
-- Taxa de interesse = inscritos / vagasOfertadas
-- Instituições com oferta = qtdInstituicoes
-- Total de vagas = vagasOfertadas
-- Mercados em crescimento = matriculas por município (fkLocalizacao) e
-- modalidadeEnsino, comparando o ano início com o ano fim
CREATE TABLE dashExpansao (
    idDashExpansao INT PRIMARY KEY auto_increment,
    anoCenso INT NOT NULL,
    modalidadeEnsino INT NOT NULL,
    qtdInstituicoes INT,
    vagasOfertadas INT,
    inscritos INT,
    matriculas INT,
    fkLocalizacao INT,
    fkCurso INT,
    CONSTRAINT fk_dashexpansao_localizacao
        FOREIGN KEY (fkLocalizacao) REFERENCES localizacao(idLocalizacao),
    CONSTRAINT fk_dashexpansao_curso
        FOREIGN KEY (fkCurso) REFERENCES curso(idCurso)
);