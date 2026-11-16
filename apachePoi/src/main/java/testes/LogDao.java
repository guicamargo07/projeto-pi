package testes;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;

public class LogDao {

    public void registrarLog(String origem, String sts, String descricao, String detalhe, Integer qtdRegistros) {
        String sql = "INSERT INTO logs (origem, sts, descricao, detalhe, qtdRegistros) VALUES (?, ?, ?, ?, ?)";

        try (Connection conn = Conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, origem);
            stmt.setString(2, sts);
            stmt.setString(3, descricao);
            stmt.setString(4, detalhe);

            if (qtdRegistros != null) {
                stmt.setInt(5, qtdRegistros);
            } else {
                stmt.setNull(5, Types.INTEGER);
            }

            stmt.executeUpdate();

        } catch (SQLException e) {
            System.err.println("Erro crítico ao salvar log no banco: " + e.getMessage());
            e.printStackTrace();
        }
    }
}