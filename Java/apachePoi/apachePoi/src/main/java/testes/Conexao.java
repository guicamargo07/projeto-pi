package testes;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

// Esta classe só sabe abrir conexões com o banco MinervaDB.
// Os dados de acesso podem ser trocados por variáveis de ambiente,
// assim não deixamos senha escrita no código que vai para o GitHub.
public class Conexao {

    private static final String URL = valor("MINERVA_DB_URL",
            "jdbc:mysql://localhost:3306/MinervaDB?rewriteBatchedStatements=true&useSSL=false&allowPublicKeyRetrieval=true");
    private static final String USUARIO = valor("MINERVA_DB_USER", "root");
    private static final String SENHA = valor("MINERVA_DB_PASSWORD", "root");

    // Devolve uma conexão nova. Quem chamar é responsável por fechar
    // (de preferência com try-with-resources).
    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(URL, USUARIO, SENHA);
    }

    // Lê uma variável de ambiente; se não existir, usa o valor padrão.
    private static String valor(String nome, String padrao) {
        String v = System.getenv(nome);
        return (v == null || v.isBlank()) ? padrao : v;
    }
}