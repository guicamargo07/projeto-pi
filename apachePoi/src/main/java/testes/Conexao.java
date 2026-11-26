package testes;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Conexao {

    private static final Map<String, String> CONFIGURACAO = carregarConfiguracao();
    private static final String URL = valor("MINERVA_DB_URL", montarUrl());
    private static final String USUARIO = valor("MINERVA_DB_USER", valor("DB_USER", "root"));
    private static final String SENHA = valor("MINERVA_DB_PASSWORD", valor("DB_PASSWORD", ""));

    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, USUARIO, SENHA);
    }

    private static String montarUrl() {
        String host = valor("DB_HOST", "127.0.0.1");
        String porta = valor("DB_PORT", "3306");
        String banco = valor("DB_DATABASE", "MinervaDB");
        if (!porta.matches("\\d+") || Long.parseLong(porta) < 1 || Long.parseLong(porta) > 65535) {
            throw new IllegalArgumentException("DB_PORT deve ser uma porta entre 1 e 65535.");
        }
        return "jdbc:mysql://" + host + ":" + porta + "/" + banco
                + "?rewriteBatchedStatements=true&useSSL=false&allowPublicKeyRetrieval=true";
    }

    // Uma senha vazia explicitamente configurada não recebe outro valor.
    private static String valor(String nome, String padrao) {
        String ambiente = System.getenv(nome);
        if (ambiente != null) return ambiente;
        return CONFIGURACAO.getOrDefault(nome, padrao);
    }

    private static Map<String, String> carregarConfiguracao() {
        String explicito = System.getenv("MINERVA_ENV_FILE");
        List<Path> candidatos = explicito == null || explicito.isBlank()
                ? List.of(Path.of("MinervaProject", ".env"), Path.of("..", "MinervaProject", ".env"), Path.of(".env"))
                : List.of(Path.of(explicito));
        for (Path candidato : candidatos) {
            if (!Files.isRegularFile(candidato)) continue;
            try {
                Map<String, String> valores = new HashMap<>();
                int linha = 0;
                for (String conteudo : Files.readAllLines(candidato, StandardCharsets.UTF_8)) {
                    linha++;
                    String texto = conteudo.replace("\uFEFF", "").strip();
                    if (texto.isEmpty() || texto.startsWith("#")) continue;
                    if (texto.startsWith("export ")) texto = texto.substring(7).strip();
                    int separador = texto.indexOf('=');
                    if (separador <= 0) continue;
                    String chave = texto.substring(0, separador).strip();
                    if (!chave.matches("[A-Za-z_][A-Za-z0-9_]*")) continue;
                    String valor = texto.substring(separador + 1).strip();
                    if (valor.startsWith("\"") || valor.startsWith("'")) {
                        char aspas = valor.charAt(0);
                        int fim = valor.lastIndexOf(aspas);
                        if (fim == 0) throw new IllegalArgumentException("Aspas incompletas na linha " + linha + " do arquivo de ambiente.");
                        valor = valor.substring(1, fim);
                        if (aspas == '"') valor = valor.replace("\\n", "\n").replace("\\r", "\r");
                    } else {
                        int comentario = valor.indexOf('#');
                        if (comentario >= 0) valor = valor.substring(0, comentario).stripTrailing();
                    }
                    valores.put(chave, valor);
                }
                return valores;
            } catch (IOException e) {
                throw new IllegalStateException("Não foi possível ler o arquivo de ambiente do banco.", e);
            }
        }
        if (explicito != null && !explicito.isBlank()) {
            throw new IllegalStateException("O arquivo indicado em MINERVA_ENV_FILE não foi encontrado.");
        }
        return Map.of();
    }
}
