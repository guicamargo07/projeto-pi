package testes;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.apache.poi.openxml4j.opc.OPCPackage;
import org.apache.poi.openxml4j.opc.PackageAccess;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.util.XMLHelper;
import org.apache.poi.xssf.eventusermodel.ReadOnlySharedStringsTable;
import org.apache.poi.xssf.eventusermodel.XSSFReader;
import org.apache.poi.xssf.eventusermodel.XSSFSheetXMLHandler;
import org.apache.poi.xssf.eventusermodel.XSSFSheetXMLHandler.SheetContentsHandler;
import org.apache.poi.xssf.model.StylesTable;
import org.apache.poi.xssf.usermodel.XSSFComment;
import org.xml.sax.InputSource;
import org.xml.sax.XMLReader;

// Esta classe lê a planilha.xlsx e transforma cada linha em um RegistroCenso.

// IMPORTANTE: ela lê em modo "streaming". A planilha do Censo é gigante,
// então em vez de carregar tudo na memória (como o XSSFWorkbook faz),
// lemos linha por linha, como quem lê um livro página por página.
// Assim conseguimos parar assim que atingirmos o limite de registros.
public class LeitorExcel {

    // Quantidade de colunas que nos interessam na planilha (de 0 a 18)
    private static final int TOTAL_COLUNAS = 19;

    // Exceção criada só para "frear" a leitura quando o limite for atingido.
    private static class LimiteAtingido extends RuntimeException {
        LimiteAtingido() {
            // Os dois "false" desligam o rastreamento de pilha, deixando a exceção mais leve
            super("Limite atingido", null, false, false);
        }
    }

    // Método principal: recebe o nome do arquivo e o limite de registros,
    // e devolve a lista de registros lidos.
    public List<RegistroCenso> extrairRegistros(String nomeArquivo, int limiteRegistros) {
        // Lista onde vamos guardar os registros lidos
        List<RegistroCenso> registrosExtraidos = new ArrayList<>();

        System.out.printf("Iniciando leitura do arquivo %s (limite: %d registros)%n",
                nomeArquivo, limiteRegistros);

        // try-with-resources: o pacote é fechado sozinho no final, mesmo se der erro.
        // Abrimos pelo CAMINHO do arquivo (e não por InputStream) para evitar
        // o erro de "array muito grande" que aconteceu antes.
        try (OPCPackage pacote = OPCPackage.open(nomeArquivo, PackageAccess.READ)) {

            // Um .xlsx guarda os textos das células numa tabela separada ("shared strings").
            // Precisamos dela para saber o texto de cada célula.
            ReadOnlySharedStringsTable textos = new ReadOnlySharedStringsTable(pacote);

            // XSSFReader dá acesso às partes internas do arquivo (abas, estilos etc.)
            XSSFReader leitor = new XSSFReader(pacote);

            // Estilos das células (usados para interpretar números e datas)
            StylesTable estilos = leitor.getStylesTable();

            // getSheetsData().next() pega a primeira aba da planilha
            try (InputStream aba = leitor.getSheetsData().next()) {

                // O parser lê o XML da aba aos poucos e vai "avisando" o nosso
                // manipulador a cada linha e a cada célula encontrada.
                XMLReader parser = XMLHelper.newXMLReader();
                parser.setContentHandler(new XSSFSheetXMLHandler(
                        estilos, textos,
                        new ManipuladorLinhas(registrosExtraidos, limiteRegistros),
                        false)); // false = devolve o valor "cru" das células, sem formatação

                try {
                    // Começa a leitura. Só termina no fim do arquivo
                    // ou quando o ManipuladorLinhas lançar LimiteAtingido.
                    parser.parse(new InputSource(aba));
                } catch (LimiteAtingido e) {
                    // Chegamos ao limite: é o caminho esperado, não um erro
                    System.out.println("Limite de " + limiteRegistros + " registros atingido");
                }
            }

            printarLinhas();
            System.out.println("Leitura do arquivo finalizada");
            printarLinhas();

        } catch (Exception e) {
            // Qualquer problema (arquivo não encontrado, corrompido etc.) cai aqui
            System.out.println("Erro ao ler o arquivo: " + e.getMessage());
        }

        // Devolvemos o que foi lido até aqui (mesmo se houve erro no meio)
        return registrosExtraidos;
    }

    // Classe que "escuta" a leitura da planilha.
    // O parser chama startRow, cell e endRow automaticamente, na ordem em que
    // as linhas aparecem no arquivo.
    private class ManipuladorLinhas implements SheetContentsHandler {

        private final List<RegistroCenso> registros; // lista onde os registros são guardados
        private final int limite;                    // máximo de registros a extrair

        // Guarda os valores da linha atual, um por coluna (posição 0 = coluna A, e assim por diante)
        private final String[] valores = new String[TOTAL_COLUNAS];

        ManipuladorLinhas(List<RegistroCenso> registros, int limite) {
            this.registros = registros;
            this.limite = limite;
        }

        // Chamado quando uma linha COMEÇA: limpamos os valores da linha anterior
        @Override
        public void startRow(int rowNum) {
            Arrays.fill(valores, null);
        }

        // Chamado para cada célula da linha: guardamos o valor na posição da coluna
        @Override
        public void cell(String referenciaCelula, String valor, XSSFComment comentario) {
            if (referenciaCelula == null) {
                return;
            }
            // A referência vem como "C5" (coluna C, linha 5).
            // CellReference converte a letra da coluna em número (A=0, B=1, C=2...).
            int coluna = new CellReference(referenciaCelula).getCol();

            // Ignoramos colunas além das 19 que nos interessam
            if (coluna < TOTAL_COLUNAS) {
                valores[coluna] = valor;
            }
        }

        // Chamado quando uma linha TERMINA: aqui já temos todos os valores dela
        @Override
        public void endRow(int rowNum) {
            // Linha 0 é o cabeçalho (nomes das colunas): só mostramos, não viramos registro
            if (rowNum == 0) {
                printarCabecalho(valores);
                return;
            }

            // Se já temos registros suficientes, lançamos a exceção para parar a leitura
            if (registros.size() >= limite) {
                throw new LimiteAtingido();
            }

            System.out.println("Lendo linha " + rowNum);

            // Transforma os valores da linha em um objeto e guarda na lista
            registros.add(montarRegistro(valores));
        }
    }

    // Monta um RegistroCenso a partir dos valores da linha.
    // Os números entre colchetes são a posição da coluna na planilha (começando em 0).
    // Se a planilha tiver outra ordem de colunas, é aqui que ajustamos.
    private RegistroCenso montarRegistro(String[] v) {
        return new RegistroCenso(
                lerInteiro(v[0]),   // NU_ANO_CENSO
                lerTexto(v[1]),     // NO_MUNICIPIO
                lerInteiro(v[2]),   // CO_IES
                lerTexto(v[3]),     // NO_CINE_AREA_GERAL
                lerTexto(v[4]),     // NO_CINE_AREA_ESPECIFICA
                lerInteiro(v[5]),   // TP_MODALIDADE_ENSINO
                lerInteiro(v[6]),   // QT_VG_TOTAL
                lerInteiro(v[7]),   // QT_INSCRITO_TOTAL
                lerInteiro(v[8]),   // QT_ING
                lerInteiro(v[9]),   // QT_MAT
                lerInteiro(v[10]),  // QT_MAT_0_17
                lerInteiro(v[11]),  // QT_MAT_18_24
                lerInteiro(v[12]),  // QT_MAT_25_29
                lerInteiro(v[13]),  // QT_MAT_30_34
                lerInteiro(v[14]),  // QT_MAT_35_39
                lerInteiro(v[15]),  // QT_MAT_40_49
                lerInteiro(v[16]),  // QT_MAT_50_59
                lerInteiro(v[17]),  // QT_MAT_60_MAIS
                lerInteiro(v[18])   // QT_CONC
        );
    }

    // Converte o texto de uma célula em número inteiro.
    // Devolve null se a célula estiver vazia ou não for um número válido,
    // assim o programa não quebra com dados faltando.
    private Integer lerInteiro(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        try {
            // Passa por Double porque o Excel pode guardar "2019" como "2019.0"
            return (int) Double.parseDouble(valor.trim().replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // Devolve o texto da célula, ou null se estiver vazia
    private String lerTexto(String valor) {
        return (valor == null || valor.isBlank()) ? null : valor;
    }

    // Mostra no console o nome de cada coluna (a primeira linha da planilha)
    private void printarCabecalho(String[] colunas) {
        printarLinhas();
        System.out.println("Lendo cabeçalho");
        for (int i = 0; i < TOTAL_COLUNAS; i++) {
            System.out.println("Coluna " + i + ": " + colunas[i]);
        }
        printarLinhas();
    }

    // Imprime uma linha de traços só para separar visualmente as partes do console
    private void printarLinhas() {
        System.out.println("-".repeat(20));
    }
}