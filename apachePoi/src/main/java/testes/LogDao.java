package testes;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;

public class LogDao extends BaseDao {

    public void registrarLog(String origem, String sts, String descricao, String detalhe, Integer qtdRegistros) {
        String sql = "INSERT INTO logs (descricao, sts, origem, detalhe, qtdRegistros) VALUES (?, ?, ?, ?, ?)";

        try (Connection conn = Conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, descricao);
            stmt.setString(2, sts);
            stmt.setString(3, origem);

            if (detalhe != null) {
                stmt.setString(4, detalhe);
            } else {
                stmt.setNull(4, Types.LONGVARCHAR);
            }

            if (qtdRegistros != null) {
                stmt.setInt(5, qtdRegistros);
            } else {
                stmt.setNull(5, Types.INTEGER);
            }

            stmt.executeUpdate();

        } catch (SQLException e) {
            System.err.println("Erro crítico ao gravar log no banco via JDBC: " + e.getMessage());
            e.printStackTrace();
        }
    }
}