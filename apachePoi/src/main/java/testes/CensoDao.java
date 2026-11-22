package testes;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

public class CensoDao extends BaseDao {

    private static final String NAO_INFORMADO = "Não informado";
    private static final String UF_NAO_INFORMADA = "NI";
    private static final int TAMANHO_LOTE = 500;

    private static final String SQL_INSERT_DADOS =
            "INSERT INTO dadosCurso (anoCenso, vagasOfertadas, inscritos, ingressantes, matriculas, " +
                    "concluintes, matriculas0a17, matriculas18a24, matriculas25a29, matriculas30a34, " +
                    "matriculas35a39, matriculas40a49, matriculas50a59, matriculas60Mais, fkCurso) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    public int inserirRegistros(List<RegistroCenso> registros) throws SQLException {
        int gravados = 0;
        int ignorados = 0;

        try (Connection con = obterConexao()) {
            con.setAutoCommit(false);

            try (PreparedStatement psDados = con.prepareStatement(SQL_INSERT_DADOS)) {
                for (RegistroCenso r : registros) {
                    if (r.getAnoCenso() == null) {
                        ignorados++;
                        continue;
                    }

                    int idLocalizacao = obterLocalizacao(con, r);
                    int idInstituicao = obterInstituicao(con, r, idLocalizacao);
                    int idCurso = obterCurso(con, r, idInstituicao);

                    DistribuicaoEtaria faixa = r.getDistribuicaoEtaria();

                    int i = 1;
                    psDados.setInt(i++, r.getAnoCenso());
                    setInteiro(psDados, i++, r.getVagasTotal());
                    setInteiro(psDados, i++, r.getInscritosTotal());
                    setInteiro(psDados, i++, r.getIngressantes());
                    setInteiro(psDados, i++, r.getMatriculas());
                    setInteiro(psDados, i++, r.getConcluintes());
                    setInteiro(psDados, i++, faixa.getMat0a17());
                    setInteiro(psDados, i++, faixa.getMat18a24());
                    setInteiro(psDados, i++, faixa.getMat25a29());
                    setInteiro(psDados, i++, faixa.getMat30a34());
                    setInteiro(psDados, i++, faixa.getMat35a39());
                    setInteiro(psDados, i++, faixa.getMat40a49());
                    setInteiro(psDados, i++, faixa.getMat50a59());
                    setInteiro(psDados, i++, faixa.getMat60Mais());
                    psDados.setInt(i, idCurso);

                    psDados.addBatch();
                    gravados++;

                    if (gravados % TAMANHO_LOTE == 0) {
                        psDados.executeBatch();
                    }
                }

                psDados.executeBatch();
                con.commit();
            } catch (SQLException e) {
                con.rollback();
                throw e;
            }
        }

        if (ignorados > 0) {
            System.out.println("Registros ignorados (sem ano do censo): " + ignorados);
        }

        return gravados;
    }

    private int obterLocalizacao(Connection con, RegistroCenso r) throws SQLException {
        String municipio = r.getMunicipio() != null ? r.getMunicipio() : NAO_INFORMADO;

        Integer id = buscarId(con,
                "SELECT idLocalizacao FROM localizacao WHERE municipio = ?", municipio);

        if (id == null) {
            id = inserirERetornarId(con,
                    "INSERT INTO localizacao (regiao, uf, municipio) VALUES (?, ?, ?)",
                    NAO_INFORMADO, UF_NAO_INFORMADA, municipio);
        }

        return id;
    }

    private int obterInstituicao(Connection con, RegistroCenso r, int idLocalizacao) throws SQLException {
        int codigoIes = r.getCodigoIes() != null ? r.getCodigoIes() : 0;

        Integer id = buscarId(con,
                "SELECT idInstituicao FROM instituicao WHERE codigoIes = ? AND fkLocalizacao = ?",
                codigoIes, idLocalizacao);

        if (id == null) {
            id = inserirERetornarId(con,
                    "INSERT INTO instituicao (codigoIes, nomeIes, redeEnsino, categoriaAdministrativa, " +
                            "organizacaoAcademica, nivelAcademico, fkLocalizacao) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    codigoIes, NAO_INFORMADO, 0, NAO_INFORMADO, NAO_INFORMADO, 0, idLocalizacao);
        }

        return id;
    }

    private int obterCurso(Connection con, RegistroCenso r, int idInstituicao) throws SQLException {
        int modalidade = r.getModalidadeEnsino() != null ? r.getModalidadeEnsino() : 0;

        Integer id = buscarId(con,
                "SELECT idCurso FROM curso WHERE fkInstituicao = ? AND areaGeral <=> ? " +
                        "AND modalidadeEnsino = ?",
                idInstituicao, r.getAreaGeral(), modalidade);

        if (id == null) {
            String nomeCurso = r.getAreaGeral() != null ? r.getAreaGeral() : NAO_INFORMADO;
            id = inserirERetornarId(con,
                    "INSERT INTO curso (codigoCurso, nomeCurso, areaGeral, " +
                            "grauAcademico, modalidadeEnsino, fkInstituicao) VALUES (?, ?, ?, ?, ?, ?)",
                    0, nomeCurso, r.getAreaGeral(),
                    NAO_INFORMADO, modalidade, idInstituicao);
        }

        return id;
    }

    private Integer buscarId(Connection con, String sql, Object... parametros) throws SQLException {
        try (PreparedStatement ps = con.prepareStatement(sql)) {
            preencher(ps, parametros);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt(1) : null;
            }
        }
    }

    private int inserirERetornarId(Connection con, String sql, Object... parametros) throws SQLException {
        try (PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            preencher(ps, parametros);
            ps.executeUpdate();
            try (ResultSet chaves = ps.getGeneratedKeys()) {
                chaves.next();
                return chaves.getInt(1);
            }
        }
    }
}