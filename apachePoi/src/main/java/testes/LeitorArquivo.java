package testes;

import java.util.List;

public abstract class LeitorArquivo<T> {

    protected final String nomeArquivo;

    protected LeitorArquivo(String nomeArquivo) {
        this.nomeArquivo = nomeArquivo;
    }

    public String getNomeArquivo() {
        return nomeArquivo;
    }

    public abstract List<T> extrairRegistros(int limiteRegistros);

    protected Integer lerInteiro(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        try {
            return (int) Double.parseDouble(valor.trim().replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    protected String lerTexto(String valor) {
        return (valor == null || valor.isBlank()) ? null : valor;
    }

    protected void printarLinhas() {
        System.out.println("-".repeat(20));
    }
}