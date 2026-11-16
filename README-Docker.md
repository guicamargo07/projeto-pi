# Inicializacao na AWS EC2

O [inicializar.sh](./inicializar.sh) prepara Docker e cron em uma instancia Linux
com systemd (Ubuntu/Debian ou Amazon Linux 2/2023), constroi as tres imagens,
inicia MySQL e Node e instala o agendamento do Apache POI no crontab do root.
A instancia precisa estar ligada no horario agendado e ter acesso a internet
para instalar pacotes e baixar imagens/dependencias. A execucao do script na EC2
configura o agendamento; ele nao cria uma instancia nem uma regra do EventBridge.

## Executar

Copie o projeto completo para um diretorio permanente da instancia. Inclua a
planilha `apachePoi/MICRODADOS_CURSOS_2019_2024_MINERVA.xlsx`; ela e necessaria
e nao sera baixada pelo script. A pasta [apachePoi](./apachePoi) tambem precisa
conter o [pom.xml](./apachePoi/pom.xml) e os fontes Java.

Na raiz do projeto, execute:

```bash
bash ./inicializar.sh instalar
```

O script solicita sudo quando necessario. Nao e preciso instalar Node, Maven ou
Java no host: as dependencias ficam nas imagens. O Java usa Maven/JDK 21 no build
e JRE 21 para executar o JAR, conforme o [Dockerfile](./apachePoi/Dockerfile).

Os comandos de build solicitados sao executados dentro de [DB](./DB) e
[MinervaProject](./MinervaProject), respectivamente:

```bash
sudo docker build -t minerva-db .
sudo docker build -t minerva-project .
```

Os comandos `docker run` mantem os nomes `db-minerva` e `minerva`, as imagens
`minerva-db` e `minerva-project` e os mapeamentos `3306:3306` e `8080:8080`.
Recebem tambem opcoes de rede, configuracao e persistencia para que a aplicacao
funcione entre containers. O Node responde em `http://IP_DA_EC2:8080`.
Permita acesso a porta 8080 no Security Group para os clientes desejados.
As portas publicadas continuam sujeitas ao firewall/Security Group da instancia;
Node e Java acessam o banco pela rede Docker e nao exigem abrir 3306 na AWS.

## Dados e configuracao

- A rede `minerva-network` permite acessar o MySQL pelo nome `db-minerva`.
- O volume `minerva-mysql-data` guarda o banco. Os scripts de [DB/arquivos](./DB/arquivos)
  sao executados pela imagem MySQL somente quando o volume esta vazio.
- As senhas sao geradas na primeira instalacao e guardadas em
  `/etc/minerva/mysql.env`, `/etc/minerva/node.env` e `/etc/minerva/java.env`,
  com acesso exclusivo do root. O usuario `minerva` tem acesso a `MinervaDB`.
  Esses arquivos sao preservados nas proximas execucoes.
- Node e MySQL usam `unless-stopped` para voltar apos reiniciar a EC2.
- Uma nova execucao reutiliza os containers criados pelo script. Ela constroi as
  imagens novamente, mas nao substitui containers existentes nem aplica novas
  variaveis a eles. Um container com o mesmo nome criado fora do script causa
  erro; ele e preservado. A substituicao de containers exige uma operacao separada.
- Alterar uma senha no arquivo `.env` nao altera o usuario de um banco ja
  inicializado: a mudanca precisa ser feita tambem no MySQL. Nao apague o volume
  para aplicar configuracoes se precisar conservar os dados.

## Agendamento Java

O script configura o fuso **da instancia** para `America/Sao_Paulo` e reinicia o
servico cron para garantir o horario tambem no Ubuntu. Isso afeta outros servicos
e agendamentos que usam o horario local do host. O agendamento e:

```cron
CRON_TZ=America/Sao_Paulo
SHELL=/bin/sh
0 8 * * 5 /bin/bash /caminho/do/projeto/inicializar.sh executar-java >> /var/log/minerva-apache-poi.log 2>&1 # MINERVA_APACHE_POI
```

O caminho absoluto real e preenchido automaticamente. As outras entradas do
crontab sao preservadas e o bloco do Minerva e substituido, sem duplicar.
`CRON_TZ` garante o fuso no Cronie, mesmo se houver outro fuso configurado antes
no crontab; no Ubuntu, vale o fuso configurado no host.
Nao mova o projeto depois de instalar; se mover, execute a instalacao novamente.

A cada sexta-feira, as 08h00 de Brasilia, o script aguarda o MySQL e executa
`minerva-java` em primeiro plano, com a planilha montada somente para leitura.
O `flock` impede duas importacoes simultaneas. O `docker run --rm` encerra e remove
o container quando o processo Java termina, inclusive em caso de falha. Node e
MySQL continuam ativos. A EC2 permanece ligada.

Para executar uma importacao manual e conferir o agendamento e os logs:

```bash
sudo bash ./inicializar.sh executar-java
sudo crontab -l
sudo tail -n 100 /var/log/minerva-apache-poi.log
sudo docker ps
```

A execucao manual escreve no terminal; a execucao pelo cron escreve no arquivo
de log. A instalacao apenas agenda o Java, sem importar a planilha imediatamente.

## Comportamento atual do importador

O [Main.java](./apachePoi/src/main/java/testes/Main.java) limita a importacao a
1.000 registros. O [CensoDao.java](./apachePoi/src/main/java/testes/CensoDao.java)
insere novos registros em cada execucao, podendo duplicar dados ao reler a mesma
planilha. O Java atual tambem captura alguns erros sem devolver um codigo de
saida diferente de zero; confira as mensagens do log para validar a importacao.
O script preserva esse comportamento da aplicacao.
