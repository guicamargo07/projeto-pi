create database projetoensinosuperior;
use projetoensinosuperior;

create table localizacao (
    idLocalizacao int primary key auto_increment,
    regiao varchar(50) not null,
    uf char(2) not null,
    municipio varchar(100) not null
);

create table instituicao (
    idInstituicao int primary key auto_increment,
    codigoIes int not null,
    nomeIes varchar(200) not null,
    redeEnsino int not null,
    categoriaAdministrativa varchar(100) not null,
    organizacaoAcademica varchar(100) not null,
    nivelAcademico int not null,
    fkLocalizacao int,
    constraint fk_localizacao
        foreign key (fkLocalizacao) references localizacao(idLocalizacao)
);

create table curso (
    idCurso int primary key auto_increment,
    codigoCurso int not null,
    nomeCurso varchar(200) not null,
    areaGeral varchar(150),
    areaEspecifica varchar(150),
    grauAcademico varchar(100),
    modalidadeEnsino int not null,
    fkInstituicao int,
    constraint fk_instituicao
        foreign key (fkInstituicao) references instituicao(idInstituicao)
);

create table dadosCurso (
    idDadosCurso int primary key auto_increment,
    anoCenso int not null,
    vagasOfertadas int,
    inscritos int,
    ingressantes int,
    matriculas int,
    concluintes int,
    matriculas0a17 int,
    matriculas18a24 int,
    matriculas25a29 int,
    matriculas30a34 int,
    matriculas35a39 int,
    matriculas40a49 int,
    matriculas50a59 int,
    matriculas60Mais int,
    matriculasFemininas int,
    matriculasMasculinas int,
    fkCurso int,
    constraint fk_curso
        foreign key (fkCurso) references curso(idCurso)
);