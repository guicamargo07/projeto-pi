package testes;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;

public class LogDao {

    public void registrarLog(String nivel, String mensagem) {
        String sql = "INSERT INTO tb_log (nivel, mensagem, data_hora) VALUES (?, ?, ?)";

        try (Connection conn = Conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, nivel);
            stmt.setString(2, mensagem);
            stmt.setTimestamp(3, Timestamp.valueOf(LocalDateTime.now()));
            stmt.executeUpdate();

        } catch (SQLException e) {
            System.err.println("Erro ao gravar log via JDBC: " + e.getMessage());
            e.printStackTrace();
        }
    }
}