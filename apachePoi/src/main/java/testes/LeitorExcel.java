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

public class LeitorExcel extends LeitorArquivo<RegistroCenso> {

    private static final int TOTAL_COLUNAS = 19;

    private static class LimiteAtingido extends RuntimeException {
        LimiteAtingido() {
            super("Limite atingido", null, false, false);
        }
    }

    public LeitorExcel(String nomeArquivo) {
        super(nomeArquivo);
    }

    @Override
    public List<RegistroCenso> extrairRegistros(int limiteRegistros) {
        List<RegistroCenso> registrosExtraidos = new ArrayList<>();

        System.out.printf("Iniciando leitura do arquivo %s (limite: %d registros)%n",
                nomeArquivo, limiteRegistros);

        try (OPCPackage pacote = OPCPackage.open(nomeArquivo, PackageAccess.READ)) {
            ReadOnlySharedStringsTable textos = new ReadOnlySharedStringsTable(pacote);
            XSSFReader leitor = new XSSFReader(pacote);
            StylesTable estilos = leitor.getStylesTable();

            try (InputStream aba = leitor.getSheetsData().next()) {
                XMLReader parser = XMLHelper.newXMLReader();
                parser.setContentHandler(new XSSFSheetXMLHandler(
                        estilos, textos,
                        new ManipuladorLinhas(registrosExtraidos, limiteRegistros),
                        false));

                try {
                    parser.parse(new InputSource(aba));
                } catch (LimiteAtingido e) {
                    System.out.println("Limite de " + limiteRegistros + " registros atingido");
                }
            }

            printarLinhas();
            System.out.println("Leitura do arquivo finalizada");
            printarLinhas();

        } catch (Exception e) {
            System.out.println("Erro ao ler o arquivo: " + e.getMessage());
        }

        return registrosExtraidos;
    }

    private class ManipuladorLinhas implements SheetContentsHandler {

        private final List<RegistroCenso> registros;
        private final int limite;
        private final String[] valores = new String[TOTAL_COLUNAS];

        ManipuladorLinhas(List<RegistroCenso> registros, int limite) {
            this.registros = registros;
            this.limite = limite;
        }

        @Override
        public void startRow(int rowNum) {
            Arrays.fill(valores, null);
        }

        @Override
        public void cell(String referenciaCelula, String valor, XSSFComment comentario) {
            if (referenciaCelula == null) {
                return;
            }
            int coluna = new CellReference(referenciaCelula).getCol();
            if (coluna < TOTAL_COLUNAS) {
                valores[coluna] = valor;
            }
        }

        @Override
        public void endRow(int rowNum) {
            if (rowNum == 0) {
                printarCabecalho(valores);
                return;
            }
            if (registros.size() >= limite) {
                throw new LimiteAtingido();
            }
            System.out.println("Lendo linha " + rowNum);
            registros.add(montarRegistro(valores));
        }
    }

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

    private void printarCabecalho(String[] colunas) {
        printarLinhas();
        System.out.println("Lendo cabeçalho");
        for (int i = 0; i < TOTAL_COLUNAS; i++) {
            System.out.println("Coluna " + i + ": " + colunas[i]);
        }
        printarLinhas();
    }
}