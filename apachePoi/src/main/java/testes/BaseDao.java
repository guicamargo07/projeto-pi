package testes;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;

public abstract class BaseDao {

    protected Connection obterConexao() throws SQLException {
        return Conexao.getConnection();
    }

    protected void preencher(PreparedStatement ps, Object... parametros) throws SQLException {
        for (int i = 0; i < parametros.length; i++) {
            ps.setObject(i + 1, parametros[i]);
        }
    }

    protected void setInteiro(PreparedStatement ps, int posicao, Integer valor) throws SQLException {
        if (valor == null) {
            ps.setNull(posicao, Types.INTEGER);
        } else {
            ps.setInt(posicao, valor);
        }
    }
}