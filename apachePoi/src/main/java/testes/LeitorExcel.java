package testes;

import java.io.IOException;
import java.io.InputStream;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Iterator;
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
    private static final String[] COLUNAS = {
        "NU_ANO_CENSO", "NO_MUNICIPIO", "CO_IES", "NO_CINE_AREA_GERAL",
        "NO_CINE_AREA_ESPECIFICA", "TP_MODALIDADE_ENSINO", "QT_VG_TOTAL",
        "QT_INSCRITO_TOTAL", "QT_ING", "QT_MAT", "QT_MAT_0_17", "QT_MAT_18_24",
        "QT_MAT_25_29", "QT_MAT_30_34", "QT_MAT_35_39", "QT_MAT_40_49",
        "QT_MAT_50_59", "QT_MAT_60_MAIS", "QT_CONC"
    };

    private static class LimiteAtingido extends RuntimeException {
        LimiteAtingido() { super("Limite atingido", null, false, false); }
    }

    private static class FalhaSql extends RuntimeException {
        FalhaSql(SQLException causa) { super(causa); }
    }

    public LeitorExcel(String nomeArquivo) { super(nomeArquivo); }

    @Override
    public ResultadoLeitura processarRegistros(int limiteRegistros, int ignorarPrimeiros,
            ProcessadorRegistro<RegistroCenso> processador) throws IOException, SQLException {
        if (limiteRegistros < 0 || ignorarPrimeiros < 0) throw new IllegalArgumentException("Limites não podem ser negativos.");
        int[] total = { 0 };
        boolean completa = true;
        try (OPCPackage pacote = OPCPackage.open(nomeArquivo, PackageAccess.READ)) {
            ReadOnlySharedStringsTable textos = new ReadOnlySharedStringsTable(pacote);
            XSSFReader leitor = new XSSFReader(pacote);
            StylesTable estilos = leitor.getStylesTable();
            Iterator<InputStream> abas = leitor.getSheetsData();
            if (!abas.hasNext()) throw new IOException("A planilha não contém abas.");
            while (abas.hasNext()) {
                try (InputStream aba = abas.next()) {
                    XMLReader parser = XMLHelper.newXMLReader();
                    ManipuladorLinhas manipulador = new ManipuladorLinhas(
                            processador, total, limiteRegistros, ignorarPrimeiros);
                    parser.setContentHandler(new XSSFSheetXMLHandler(estilos, textos, manipulador, false));
                    parser.parse(new InputSource(aba));
                    if (!manipulador.cabecalhoLido) throw new IOException("A aba não contém o cabeçalho esperado.");
                }
            }
        } catch (LimiteAtingido e) {
            completa = false;
        } catch (FalhaSql e) {
            throw (SQLException) e.getCause();
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("Falha ao ler a planilha: " + e.getMessage(), e);
        }
        return new ResultadoLeitura(total[0], completa);
    }

    private class ManipuladorLinhas implements SheetContentsHandler {
        private final ProcessadorRegistro<RegistroCenso> processador;
        private final int[] total;
        private final int limite;
        private final int ignorarPrimeiros;
        private final String[] valores = new String[COLUNAS.length];
        private boolean cabecalhoLido;

        ManipuladorLinhas(ProcessadorRegistro<RegistroCenso> processador, int[] total,
                int limite, int ignorarPrimeiros) {
            this.processador = processador;
            this.total = total;
            this.limite = limite;
            this.ignorarPrimeiros = ignorarPrimeiros;
        }

        @Override
        public void startRow(int rowNum) { Arrays.fill(valores, null); }

        @Override
        public void cell(String referencia, String valor, XSSFComment comentario) {
            if (referencia == null) return;
            int coluna = new CellReference(referencia).getCol();
            if (coluna < valores.length) valores[coluna] = valor;
        }

        @Override
        public void endRow(int rowNum) {
            if (!cabecalhoLido) {
                for (int i = 0; i < COLUNAS.length; i++) {
                    if (!COLUNAS[i].equals(lerTexto(valores[i]))) {
                        throw new IllegalArgumentException("Cabeçalho inválido na coluna " + (i + 1) + "; esperado " + COLUNAS[i] + ".");
                    }
                }
                cabecalhoLido = true;
                return;
            }
            if (Arrays.stream(valores).allMatch(valor -> valor == null || valor.isBlank())) return;
            if (limite > 0 && total[0] >= limite) throw new LimiteAtingido();
            int numero = ++total[0];
            if (numero <= ignorarPrimeiros) return;
            try {
                RegistroCenso registro = montarRegistro(valores);
                if (registro.getAnoCenso() == null || registro.getAnoCenso() < 1900 || registro.getAnoCenso() > 2100) {
                    throw new IllegalArgumentException("Ano do censo inválido.");
                }
                if (registro.getModalidadeEnsino() == null || registro.getModalidadeEnsino() < 1 || registro.getModalidadeEnsino() > 2) {
                    throw new IllegalArgumentException("Modalidade de ensino inválida.");
                }
                processador.processar(registro, numero);
            } catch (SQLException e) {
                throw new FalhaSql(e);
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Linha " + (rowNum + 1) + ": " + e.getMessage(), e);
            }
        }
    }

    private RegistroCenso montarRegistro(String[] v) {
        Integer[] numeros = new Integer[COLUNAS.length];
        for (int i = 0; i < v.length; i++) {
            if (i == 1 || i == 3 || i == 4) continue;
            numeros[i] = lerInteiro(v[i]);
            if (numeros[i] != null && numeros[i] < 0) throw new IllegalArgumentException("Contagem negativa em " + COLUNAS[i] + ".");
        }
        return new RegistroCenso(numeros[0], lerTexto(v[1]), numeros[2], lerTexto(v[3]),
                lerTexto(v[4]), numeros[5], numeros[6], numeros[7], numeros[8], numeros[9],
                numeros[10], numeros[11], numeros[12], numeros[13], numeros[14], numeros[15],
                numeros[16], numeros[17], numeros[18]);
    }
}
