package testes;

import java.io.IOException;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public abstract class LeitorArquivo<T> {

    protected final String nomeArquivo;

    protected LeitorArquivo(String nomeArquivo) {
        this.nomeArquivo = nomeArquivo;
    }

    public String getNomeArquivo() {
        return nomeArquivo;
    }

    @FunctionalInterface
    public interface ProcessadorRegistro<T> {
        void processar(T registro, int numeroRegistro) throws SQLException;
    }

    public record ResultadoLeitura(int registrosLidos, boolean completa) {}

    public abstract ResultadoLeitura processarRegistros(int limiteRegistros, int ignorarPrimeiros,
            ProcessadorRegistro<T> processador) throws IOException, SQLException;

    // Compatibilidade para chamadas pequenas; a importação usa o processamento em fluxo.
    public List<T> extrairRegistros(int limiteRegistros) throws IOException {
        if (limiteRegistros <= 0) throw new IllegalArgumentException("Informe um limite positivo para extrair uma lista.");
        List<T> registros = new ArrayList<>();
        try {
            processarRegistros(limiteRegistros, 0, (registro, numero) -> registros.add(registro));
        } catch (SQLException e) {
            throw new IllegalStateException("Erro inesperado ao montar a lista.", e);
        }
        return registros;
    }

    protected Integer lerInteiro(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(valor.trim().replace(",", "")).intValueExact();
        } catch (NumberFormatException | ArithmeticException e) {
            throw new IllegalArgumentException("Valor inteiro inválido: " + valor, e);
        }
    }

    protected String lerTexto(String valor) {
        return (valor == null || valor.isBlank()) ? null : valor.strip();
    }

    protected void printarLinhas() {
        System.out.println("-".repeat(20));
    }
}
