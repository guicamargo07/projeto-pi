package testes;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

public class LogDao extends BaseDao {

    private static final String SQL_INSERT_LOG =
            "INSERT INTO logs (origem, sts, descricao, detalhe, qtdRegistros) VALUES (?, ?, ?, ?, ?)";

    public void registrarLog(String origem, String sts, String descricao, String detalhe, Integer qtdRegistros) {
        try (Connection conn = obterConexao();
             PreparedStatement stmt = conn.prepareStatement(SQL_INSERT_LOG)) {

            stmt.setString(1, origem);
            stmt.setString(2, sts);
            stmt.setString(3, descricao);
            stmt.setString(4, detalhe);
            setInteiro(stmt, 5, qtdRegistros);

            stmt.executeUpdate();
        } catch (SQLException e) {
            System.err.println("Erro crítico ao salvar log no banco: " + e.getMessage());
            e.printStackTrace();
        }
    }
}