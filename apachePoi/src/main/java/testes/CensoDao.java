package testes;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// DAO = Data Access Object: a classe responsável por conversar com o banco.
//
// O banco é normalizado (localizacao -> instituicao -> curso -> dadosCurso),
// mas cada linha da planilha traz tudo junto. Então, para cada RegistroCenso,
// fazemos: "acha ou cria" a localização, depois a instituição, depois o curso,
// e por fim inserimos os números em dadosCurso.
//
// ATENÇÃO: a planilha não tem algumas colunas que o banco exige (NOT NULL),
// como região, UF, nome da IES e código do curso. Para esses campos gravamos
// valores padrão (constantes abaixo). Se quiser dados reais, é preciso
// incluir essas colunas na planilha e no RegistroCenso.
public class CensoDao {

    private static final String NAO_INFORMADO = "Não informado";
    private static final String UF_NAO_INFORMADA = "NI";
    private static final int TAMANHO_LOTE = 500;

    // Caches em memória: evitam um SELECT para cada linha repetida.
    private final Map<String, Integer> cacheLocalizacao = new HashMap<>();
    private final Map<String, Integer> cacheInstituicao = new HashMap<>();
    private final Map<String, Integer> cacheCurso = new HashMap<>();

    private static final String SQL_INSERT_DADOS =
            "INSERT INTO dadosCurso (anoCenso, vagasOfertadas, inscritos, ingressantes, matriculas, " +
                    "concluintes, matriculas0a17, matriculas18a24, matriculas25a29, matriculas30a34, " +
                    "matriculas35a39, matriculas40a49, matriculas50a59, matriculas60Mais, fkCurso) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    // Grava todos os registros numa única transação: ou entra tudo, ou nada.
    // Devolve quantos registros foram gravados em dadosCurso.
    public int inserirRegistros(List<RegistroCenso> registros) throws SQLException {
        int gravados = 0;
        int ignorados = 0;

        try (Connection con = Conexao.getConnection()) {
            con.setAutoCommit(false); // controlamos o commit manualmente

            try (PreparedStatement psDados = con.prepareStatement(SQL_INSERT_DADOS)) {

                for (RegistroCenso r : registros) {
                    // anoCenso é obrigatório no banco; sem ele não dá para gravar
                    if (r.getAnoCenso() == null) {
                        ignorados++;
                        continue;
                    }

                    int idLocalizacao = obterLocalizacao(con, r);
                    int idInstituicao = obterInstituicao(con, r, idLocalizacao);
                    int idCurso = obterCurso(con, r, idInstituicao);

                    int i = 1;
                    psDados.setInt(i++, r.getAnoCenso());
                    setInteiro(psDados, i++, r.getVagasTotal());
                    setInteiro(psDados, i++, r.getInscritosTotal());
                    setInteiro(psDados, i++, r.getIngressantes());
                    setInteiro(psDados, i++, r.getMatriculas());
                    setInteiro(psDados, i++, r.getConcluintes());
                    setInteiro(psDados, i++, r.getMat0a17());
                    setInteiro(psDados, i++, r.getMat18a24());
                    setInteiro(psDados, i++, r.getMat25a29());
                    setInteiro(psDados, i++, r.getMat30a34());
                    setInteiro(psDados, i++, r.getMat35a39());
                    setInteiro(psDados, i++, r.getMat40a49());
                    setInteiro(psDados, i++, r.getMat50a59());
                    setInteiro(psDados, i++, r.getMat60Mais());
                    psDados.setInt(i, idCurso);
                    psDados.addBatch();
                    gravados++;

                    // Envia ao banco de tempos em tempos para não acumular demais
                    if (gravados % TAMANHO_LOTE == 0) {
                        psDados.executeBatch();
                    }
                }

                psDados.executeBatch(); // envia o que sobrou
                con.commit();

            } catch (SQLException e) {
                con.rollback(); // algo falhou: desfaz tudo
                throw e;
            }
        }

        if (ignorados > 0) {
            System.out.println("Registros ignorados (sem ano do censo): " + ignorados);
        }
        return gravados;
    }

    // ---------------------------------------------------------------
    // "Acha ou cria": procura a linha no banco; se não existir, insere.
    // ---------------------------------------------------------------

    private int obterLocalizacao(Connection con, RegistroCenso r) throws SQLException {
        String municipio = r.getMunicipio() != null ? r.getMunicipio() : NAO_INFORMADO;

        Integer cacheado = cacheLocalizacao.get(municipio);
        if (cacheado != null) {
            return cacheado;
        }

        Integer id = buscarId(con,
                "SELECT idLocalizacao FROM localizacao WHERE municipio = ?", municipio);

        if (id == null) {
            id = inserirERetornarId(con,
                    "INSERT INTO localizacao (regiao, uf, municipio) VALUES (?, ?, ?)",
                    NAO_INFORMADO, UF_NAO_INFORMADA, municipio);
        }

        cacheLocalizacao.put(municipio, id);
        return id;
    }

    private int obterInstituicao(Connection con, RegistroCenso r, int idLocalizacao) throws SQLException {
        int codigoIes = r.getCodigoIes() != null ? r.getCodigoIes() : 0;
        String chave = codigoIes + "|" + idLocalizacao;

        Integer cacheado = cacheInstituicao.get(chave);
        if (cacheado != null) {
            return cacheado;
        }

        Integer id = buscarId(con,
                "SELECT idInstituicao FROM instituicao WHERE codigoIes = ? AND fkLocalizacao = ?",
                codigoIes, idLocalizacao);

        if (id == null) {
            id = inserirERetornarId(con,
                    "INSERT INTO instituicao (codigoIes, nomeIes, redeEnsino, categoriaAdministrativa, " +
                            "organizacaoAcademica, nivelAcademico, fkLocalizacao) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    codigoIes, NAO_INFORMADO, 0, NAO_INFORMADO, NAO_INFORMADO, 0, idLocalizacao);
        }

        cacheInstituicao.put(chave, id);
        return id;
    }

    private int obterCurso(Connection con, RegistroCenso r, int idInstituicao) throws SQLException {
        int modalidade = r.getModalidadeEnsino() != null ? r.getModalidadeEnsino() : 0;
        String chave = idInstituicao + "|" + r.getAreaGeral() + "|" + modalidade;

        Integer cacheado = cacheCurso.get(chave);
        if (cacheado != null) {
            return cacheado;
        }

        // "<=>" é o igual que também funciona com NULL no MySQL
        Integer id = buscarId(con,
                "SELECT idCurso FROM curso WHERE fkInstituicao = ? AND areaGeral <=> ? " +
                        "AND modalidadeEnsino = ?",
                idInstituicao, r.getAreaGeral(), modalidade);

        if (id == null) {
            // A planilha não traz código nem nome do curso: usamos a área geral como nome
            String nomeCurso = r.getAreaGeral() != null ? r.getAreaGeral() : NAO_INFORMADO;
            id = inserirERetornarId(con,
                    "INSERT INTO curso (codigoCurso, nomeCurso, areaGeral, " +
                            "grauAcademico, modalidadeEnsino, fkInstituicao) VALUES (?, ?, ?, ?, ?, ?)",
                    0, nomeCurso, r.getAreaGeral(),
                    NAO_INFORMADO, modalidade, idInstituicao);
        }

        cacheCurso.put(chave, id);
        return id;
    }

    // ---------------------------------------------------------------
    // Métodos auxiliares
    // ---------------------------------------------------------------

    // Executa um SELECT que devolve um id; null se não achou nada.
    private Integer buscarId(Connection con, String sql, Object... parametros) throws SQLException {
        try (PreparedStatement ps = con.prepareStatement(sql)) {
            preencher(ps, parametros);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt(1) : null;
            }
        }
    }

    // Executa um INSERT e devolve o id gerado pelo auto_increment.
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

    // Coloca cada parâmetro no seu "?" (setObject aceita null sem problema)
    private void preencher(PreparedStatement ps, Object... parametros) throws SQLException {
        for (int i = 0; i < parametros.length; i++) {
            ps.setObject(i + 1, parametros[i]);
        }
    }

    // setInt não aceita null; esta versão grava NULL no banco quando o valor é null
    private void setInteiro(PreparedStatement ps, int posicao, Integer valor) throws SQLException {
        if (valor == null) {
            ps.setNull(posicao, Types.INTEGER);
        } else {
            ps.setInt(posicao, valor);
        }
    }
}