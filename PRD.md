# PRD Dashboards Minerva com dados do banco

Data: 25 de novembro de 2026. Status: implementado no projeto.

## Objetivo e resultado

As dashboards Geral, Retenção e Expansão passaram a consultar o MySQL pelo backend Node.js. Os números demonstrativos foram substituídos por indicadores, gráficos e tabela calculados com os dados do recorte selecionado. O objetivo é permitir analisar ocupação, evolução das matrículas, conclusão e oportunidades de expansão com a mesma base de dados em toda a tela.

Foram preservados o menu lateral, a identidade visual, as explicações dos indicadores e o fluxo existente de perfil e saída da sessão.

## Funcionalidades entregues

| Tela | Indicadores | Visualização |
| --- | --- | --- |
| Geral | Taxa de ocupação, crescimento de matrículas e faixa etária predominante com participação percentual | Gráfico de linhas com matrículas por ano |
| Retenção | Crescimento de concluintes e relação concluintes/ingressantes por modalidade | Barras para Presencial e EAD e gráfico de ingressantes e concluintes por área |
| Expansão | Candidatos por vaga, instituições com oferta e total de vagas | Tabela de municípios/UF com crescimento Presencial, crescimento EAD e interesse |

As três telas oferecem filtros de ano inicial, ano final, região, UF, município, modalidade e curso. As opções vêm da fonte consultada, sem listas fictícias. Região restringe UFs e municípios; UF restringe municípios. O botão **Aplicar filtros** atualiza o painel e **Limpar** restaura o período disponível e remove os demais recortes.

O contexto informa o período, o ano dos indicadores, a fonte e os filtros aplicados. Carregamento, erro, nova tentativa e ausência de registros têm estados próprios. Valores anteriores são removidos antes de uma nova consulta e em caso de erro, evitando apresentar resultados antigos como atuais.

## Fontes de dados

O schema de referência é [001_script.sql](DB/arquivos/001_script.sql).

| Painel | Fonte prioritária | Fonte alternativa |
| --- | --- | --- |
| Geral | `dashVisaoGeral` | `dadosCurso` |
| Retenção | `dashRetencao` | `dadosCurso` |
| Expansão | `dashExpansao` | `dadosCurso` |

Cada painel usa sua tabela prioritária quando ela contém pelo menos um registro. Se a tabela estiver vazia ou não existir, usa `dadosCurso`, relacionando `curso`, `instituicao` e `localizacao`. A escolha considera a tabela inteira e ocorre a cada consulta; um filtro sem resultados não provoca troca de fonte. As fontes nunca são somadas entre si.

Essa alternativa permite exibir os dados gravados pelo importador Java em `dadosCurso`. O fluxo local foi conectado ao mesmo `.env` do Node e o importador passou a processar a planilha completa em lotes. As tabelas consolidadas continuam sendo fontes opcionais; não é necessário preenchê-las para visualizar os dados importados.

Nas tabelas consolidadas, a localização explícita do registro tem prioridade. Quando ela não está preenchida, é utilizada a localização da instituição relacionada ao curso.

## Regras de cálculo

Os KPIs, as barras por modalidade e o gráfico por área usam o **ano final selecionado**. Não somam vários anos como se fossem um único ano e não retrocedem silenciosamente quando esse ano não tem registros. Sem filtros de ano, o período vai do primeiro ao último ano existente na fonte do painel.

| Métrica | Regra |
| --- | --- |
| Ocupação | Soma de ingressantes ÷ soma de vagas ofertadas × 100 |
| Crescimento de matrículas | (Matrículas do ano final − matrículas do ano anterior) ÷ matrículas do ano anterior × 100 |
| Público predominante | Faixa com a maior contagem de matrículas; participação = contagem dessa faixa ÷ total de matrículas × 100 |
| Evolução de matrículas | Soma de matrículas agrupada por ano dentro do período selecionado |
| Crescimento de concluintes | (Concluintes do ano final − concluintes do ano anterior) ÷ concluintes do ano anterior × 100 |
| Conclusão por segmento | Soma de concluintes ÷ soma de ingressantes × 100, separadamente por modalidade |
| Conclusão por área | Totais de ingressantes e concluintes agrupados pela área geral do curso |
| Interesse | Soma de inscritos ÷ soma de vagas ofertadas, em candidatos por vaga |
| Vagas | Soma de vagas ofertadas no ano final selecionado |
| Crescimento municipal | (Matrículas do ano final − matrículas do ano inicial) ÷ matrículas do ano inicial × 100, por município/UF e modalidade |

O crescimento anual de Geral e Retenção usa o ano calendário imediatamente anterior ao ano final, mesmo que esse ano esteja fora do intervalo escolhido para o gráfico. Se esse ano não existir, não é substituído por outro mais antigo. A tabela de Expansão compara exatamente os dois extremos selecionados.

Taxas são calculadas a partir das somas, sem tirar a média de percentuais por curso. Numerador ausente, denominador ausente ou denominador não positivo produzem `null` na API e **—** na tela. Zero observado é mantido: por exemplo, zero concluintes com ingressantes positivos gera 0%; uma queda de uma base positiva para zero gera −100%.

Os números são formatados em português brasileiro, com até uma casa decimal. Crescimentos positivos e negativos têm cores distintas. Os gráficos usam escalas dinâmicas. Nas barras de conclusão, o preenchimento fica entre 0% e 100%, enquanto o rótulo mantém a taxa real, inclusive acima de 100%.

### Particularidades de cada fonte

Em `dadosCurso`, o público predominante compara as oito contagens de faixas etárias. Em `dashVisaoGeral`, só existem a faixa vencedora e sua contagem em cada registro. Nesse caso, o painel agrega essas contagens e informa que a distribuição completa não está disponível; o resultado não equivale necessariamente à faixa predominante de toda a população.

Em `dadosCurso`, instituições com oferta são contadas por identidade distinta de IES entre registros com vagas positivas no ano final. O código da IES é a identidade principal; sem código positivo, utiliza-se o identificador da instituição. Em `dashExpansao`, o indicador soma `qtdInstituicoes`, conforme o schema. Recortes consolidados sobrepostos podem contar uma instituição mais de uma vez; essa limitação aparece na tela.

A conclusão por segmento compara totais do mesmo ano. Não acompanha a mesma turma de ingressantes ao longo do tempo e, por isso, pode superar 100%.

## Arquitetura implementada

O fluxo segue a arquitetura já adotada no projeto:

```text
HTML e dashboard.js
        ↓ fetch
Rotas Express
        ↓
Controller com validação
        ↓
Model com consultas e cálculos
        ↓
database.executar(sql, parametros)
        ↓
MySQL
```

| Arquivo | Responsabilidade |
| --- | --- |
| [app.js](MinervaProject/app.js) | Registrar o grupo de rotas `/dashboard` |
| [dashboard.js de rotas](MinervaProject/src/routes/dashboard.js) | Declarar os quatro endpoints GET |
| [dashboardController.js](MinervaProject/src/controllers/dashboardController.js) | Validar filtros e responder com JSON e status HTTP |
| [dashboardModel.js](MinervaProject/src/models/dashboardModel.js) | Selecionar a fonte, consultar agregados e calcular indicadores |
| [config.js](MinervaProject/src/database/config.js) | Aceitar parâmetros SQL e rejeitar falhas de conexão/consulta, mantendo compatibilidade com chamadas existentes |
| [dashboard.js do navegador](MinervaProject/public/js/dashboard.js) | Carregar filtros, buscar resultados e atualizar KPIs, gráficos e tabela |
| [dashGeral.html](MinervaProject/public/dashGeral.html), [dashRetencao.html](MinervaProject/public/dashRetencao.html) e [dashExpansao.html](MinervaProject/public/dashExpansao.html) | Estrutura dos painéis e explicações das métricas |
| [dash.css](MinervaProject/public/css/dash.css) | Filtros, estados, indicadores e adaptação a telas pequenas |
| [dashboard.test.js](MinervaProject/test/dashboard.test.js) | Testes de regras de negócio e integração com as rotas Express |
| [Conexao.java](apachePoi/src/main/java/testes/Conexao.java) | Ler as credenciais locais do mesmo `.env` do Node, preservando a prioridade de `MINERVA_DB_*` no EC2 |
| [Main.java](apachePoi/src/main/java/testes/Main.java), [LeitorExcel.java](apachePoi/src/main/java/testes/LeitorExcel.java) e [CensoDao.java](apachePoi/src/main/java/testes/CensoDao.java) | Executar leitura em fluxo, adoção da carga inicial, inserção em lotes e retomada sem duplicar o mesmo arquivo |
| [002_importacao.sql](DB/arquivos/002_importacao.sql) | Criar o controle de carga e índices não únicos para a importação e as consultas |
| [preparar-banco-local.js](MinervaProject/scripts/preparar-banco-local.js) | Aplicar a preparação no banco local indicado no `.env`, sem remover registros |

Não foram adicionadas dependências de produção. Os gráficos continuam usando Chart.js 4.4.1, já utilizado pelo projeto por CDN. Os testes usam `node:test`, integrado ao Node.js.

## Contrato da API

| Método e rota | Resposta |
| --- | --- |
| `GET /dashboard/filtros?painel=geral` | Anos, regiões, UFs, municípios, cursos, modalidades e fonte. `painel` também aceita `retencao` e `expansao` |
| `GET /dashboard/geral` | `meta`, `kpis` e série `matriculas` |
| `GET /dashboard/retencao` | `meta`, `kpis`, `segmentos` e `areas` |
| `GET /dashboard/expansao` | `meta`, `kpis` e `mercados` |

Os endpoints de indicadores aceitam os parâmetros opcionais `anoInicio`, `anoFim`, `regiao`, `uf`, `localizacao`, `modalidade` e `curso`. Município e curso são identificadores numéricos; modalidade é 1 para Presencial e 2 para EAD. Por exemplo:

```http
GET /dashboard/retencao?anoInicio=2022&anoFim=2024&uf=SP&modalidade=1
```

`meta` contém `fonte`, `anoInicio`, `anoFim`, `anoReferencia`, `anoComparacao`, `semDados` e `observacoes`. Os valores percentuais são números na escala de 0 a 100, sem arredondamento no backend; interesse é uma razão simples. Crescimentos podem ser negativos e taxas podem ultrapassar 100%.

Filtros desconhecidos, objetos, listas, valores inválidos, anos fora de 1900–2100 e intervalos invertidos retornam HTTP 400. Falhas de banco retornam HTTP 500 com mensagem genérica; detalhes ficam no servidor. As consultas usam placeholders para valores e uma lista interna de tabelas permitidas. Textos vindos do banco são inseridos no DOM com `textContent` ou APIs equivalentes, sem interpretação como HTML.

## Validação realizada

Foram aprovados 57 testes automatizados cobrindo fórmulas, zero e ausência de dados, bases de comparação, escolha exclusiva das fontes, filtros parametrizados, avisos de importação e respostas HTTP 400/500. Para executar:

```bash
cd MinervaProject
npm test
```

Também foram executadas as consultas contra um MySQL 8 temporário, inicializado com o schema do repositório e nove registros controlados distribuídos em três anos, duas cidades e duas modalidades. As verificações incluíram fontes consolidadas, alternativa por tabela vazia ou ausente, filtros combinados e ausência de mistura entre fontes. Entre os resultados conferidos: ocupação de 72,5%, conclusão EAD de 50%, interesse de 4 candidatos por vaga e duas IES distintas no conjunto importado.

No navegador, as três telas exibiram os dados retornados pela API. Foram conferidos atualização por filtros, cascata geográfica, recuperação após erro, recorte vazio, limpeza dos filtros e comportamento em largura de 390 px. A tabela de Expansão mantém rolagem horizontal dentro do seu contêiner, sem ampliar a página.

## Execução local integrada

Java e Node usam [MinervaProject/.env](MinervaProject/.env). O Node deixou de escolher `.env.dev` por uma variável fixa do código. O Java procura o arquivo do Node ao executar a partir da raiz ou da pasta `apachePoi`; `MINERVA_ENV_FILE` permite indicar outro arquivo explicitamente. Variáveis do processo prevalecem, inclusive `MINERVA_DB_URL`, `MINERVA_DB_USER` e `MINERVA_DB_PASSWORD` usados pelo Compose. Nenhuma senha de banco fica fixa no código Java.

O acesso com o `.env` indicado foi confirmado no MySQL local. A falha de autenticação observada na etapa anterior estava associada a outro arquivo de ambiente.

Para preparar o schema e iniciar o site:

```bash
cd MinervaProject
npm run db:prepare
npm start
```

O preparador cria a tabela `importacaoCenso` e os índices não únicos necessários. Ele pode ser repetido sem remover dados e recusa destinos que não sejam locais. As configurações atuais disponibilizam o site em `http://localhost:8080`.

O Java exige JDK 21 e as dependências do Maven. Executar a classe `testes.Main` a partir de `apachePoi` importa a planilha completa por padrão. `--arquivo=CAMINHO` seleciona outro arquivo; `--limite=N` interrompe após N registros para uma carga parcial retomável. Slack só é acionado com a opção explícita `--notificar-slack`; a importação local não a utiliza.

### Integridade e retomada da importação

A leitura SAX processa as linhas sem carregar a planilha inteira em memória. A cada lote de 1.000 registros, os fatos e o checkpoint são confirmados na mesma transação. O controle identifica o arquivo pelo SHA-256 e mantém a última linha confirmada, a quantidade e a conclusão. Uma falha reverte o lote pendente; reexecutar o mesmo arquivo continua após o checkpoint. Arquivos já concluídos são reconhecidos e não recebem outra carga.

Os 1.000 registros locais anteriores foram comparados com o início da planilha em ordem, multiplicidade e todos os 18 campos persistidos. A correspondência foi exata, inclusive quatro repetições legítimas. O importador valida esse prefixo novamente antes de adotá-lo. Não se criou uma chave única em `(anoCenso, fkCurso)`, pois ela eliminaria linhas legítimas da fonte.

A execução local foi concluída no MySQL configurado: 1.048.575 registros no total, dos quais 1.047.575 foram inseridos nesta carga. A distribuição por ano coincide com a planilha, não há fatos sem curso relacionado e o controle está marcado como concluído. Uma segunda execução do mesmo arquivo foi conferida: zero novas linhas e total mantido em 1.048.575.

O nome de arquivo diferente com conteúdo idêntico mantém o mesmo hash. Conteúdo alterado gera outro hash; a adoção automática de dados sem controle é limitada a 10.000 registros e exige correspondência exata. Uma nova versão grande da fonte requer uma estratégia explícita de substituição ou conciliação, para evitar sobrepor conjuntos diferentes.

### Limites da planilha disponível

Apesar do nome indicar 2019–2024, a aba disponível contém 1.048.575 registros e termina na linha física máxima do Excel, incluindo o cabeçalho. A distribuição conferida diretamente no arquivo é:

| Ano | Registros na planilha |
| --- | ---: |
| 2019 | 253.139 |
| 2020 | 344.691 |
| 2021 | 444.786 |
| 2022 | 5.959 |

Não há linhas de 2023 ou 2024. Há forte indício de truncamento e de carga parcial de 2022. As dashboards mostram o aviso de que o último ano pode estar incompleto quando a importação atinge o limite de linhas do Excel. Durante uma carga em andamento, informam que os indicadores refletem somente os lotes já confirmados.

O arquivo não fornece UF, região nem o identificador do curso. O mapeamento existente mantém município por nome, UF `NI`, região `Não informado` e curso por instituição, área geral e modalidade. Municípios homônimos não podem ser distinguidos por UF nessa fonte; os filtros de curso representam esse agrupamento, sem inventar uma identificação que não existe no arquivo.

O banco de produção e a EC2 não foram alterados nesta execução local. Para adotar o novo importador em um volume EC2 existente, aplicar previamente a migração de controle e índices. A inicialização de volumes novos já recebe os scripts SQL versionados.
