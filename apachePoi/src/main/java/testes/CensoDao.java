package testes;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class CensoDao extends BaseDao {
    private static final String NAO_INFORMADO = "Não informado";
    private static final int TAMANHO_LOTE = 1000;
    private static final int LIMITE_ADOCAO = 10000;
    private static final int LIMITE_CACHE = 20000;
    private static final String LOCK = "minerva-importacao-censo";
        private static final String[] CAMPOS_VALIDACAO = {
            "anoCenso", "municipio", "codigoIes", "areaGeral", "modalidadeEnsino", "vagasOfertadas",
            "inscritos", "ingressantes", "matriculas", "concluintes", "matriculas0a17", "matriculas18a24",
            "matriculas25a29", "matriculas30a34", "matriculas35a39", "matriculas40a49",
            "matriculas50a59", "matriculas60Mais"
        };
    private static final String SQL_INSERT_DADOS =
            "INSERT INTO dadosCurso (anoCenso, vagasOfertadas, inscritos, ingressantes, matriculas, " +
            "concluintes, matriculas0a17, matriculas18a24, matriculas25a29, matriculas30a34, " +
            "matriculas35a39, matriculas40a49, matriculas50a59, matriculas60Mais, fkCurso) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    public record ResultadoImportacao(int totalRegistros, int novosRegistros, boolean completa) {}
    private record Estado(int ultimaLinha, boolean concluida, int totalRegistros) {}

    public ResultadoImportacao importar(LeitorArquivo<RegistroCenso> leitor, int limite) throws IOException, SQLException {
        Path arquivo = Path.of(leitor.getNomeArquivo());
        String hash = sha256(arquivo);
        try (Connection con = obterConexao(); Comandos comandos = new Comandos(con)) {
            adquirirLock(comandos);
            try {
                con.setAutoCommit(false);
                Estado estado = buscarEstado(comandos, hash);
                if (estado != null && estado.concluida()) {
                    System.out.println("Esta planilha já foi importada integralmente; nenhum dado foi duplicado.");
                    return new ResultadoImportacao(estado.totalRegistros(), 0, true);
                }
                List<Object[]> existentes = estado == null ? carregarDadosLegados(comandos) : List.of();
                Sessao sessao = new Sessao(con, comandos, hash, arquivo.getFileName().toString(), estado, existentes);
                if (estado == null && existentes.isEmpty()) sessao.criarControle(0);
                else if (estado != null) System.out.println("Retomando após " + estado.ultimaLinha() + " registros confirmados.");
                else System.out.println("Validando " + existentes.size() + " registros existentes antes de adotar a importação anterior.");

                int ignorar = estado == null ? 0 : estado.ultimaLinha();
                LeitorArquivo.ResultadoLeitura leitura = leitor.processarRegistros(limite, ignorar, sessao::processar);
                if (!sessao.controleCriado) {
                    throw new SQLException("A planilha ou o limite terminou antes de validar todos os registros existentes; nenhum dado foi inserido.");
                }
                if (leitura.completa() && leitura.registrosLidos() < sessao.ultimaLinha) {
                    throw new SQLException("A planilha terminou antes do checkpoint registrado.");
                }
                sessao.confirmar(Math.max(leitura.registrosLidos(), sessao.ultimaLinha), leitura.completa());
                return new ResultadoImportacao(sessao.ultimaLinha, sessao.novosConfirmados, leitura.completa());
            } catch (IOException | SQLException | RuntimeException e) {
                try { con.rollback(); } catch (SQLException rollback) { e.addSuppressed(rollback); }
                throw e;
            } finally {
                liberarLock(comandos);
            }
        }
    }

    private void adquirirLock(Comandos comandos) throws SQLException {
        PreparedStatement ps = comandos.preparar("SELECT GET_LOCK(?, 0)");
        ps.setString(1, LOCK);
        try (ResultSet rs = ps.executeQuery()) {
            if (!rs.next() || rs.getInt(1) != 1) throw new SQLException("Outra importação está em execução.");
        }
    }

    private void liberarLock(Comandos comandos) {
        try {
            PreparedStatement ps = comandos.preparar("SELECT RELEASE_LOCK(?)");
            ps.setString(1, LOCK);
            try (ResultSet rs = ps.executeQuery()) { while (rs.next()) { /* consumir resultado */ } }
        } catch (SQLException e) {
            System.err.println("Não foi possível liberar explicitamente o lock; ele será liberado ao fechar a conexão.");
        }
    }

    private Estado buscarEstado(Comandos comandos, String hash) throws SQLException {
        PreparedStatement ps = comandos.preparar(
                "SELECT ultimaLinha, concluida, totalRegistros FROM importacaoCenso WHERE arquivoSha256 = ?");
        ps.setString(1, hash);
        try (ResultSet rs = ps.executeQuery()) {
            return rs.next() ? new Estado(rs.getInt(1), rs.getBoolean(2), rs.getInt(3)) : null;
        }
    }

    private List<Object[]> carregarDadosLegados(Comandos comandos) throws SQLException {
        long quantidade;
        try (ResultSet rs = comandos.preparar("SELECT COUNT(*) FROM dadosCurso").executeQuery()) {
            rs.next();
            quantidade = rs.getLong(1);
        }
        if (quantidade > LIMITE_ADOCAO) {
            throw new SQLException("Há mais de " + LIMITE_ADOCAO + " registros sem controle de importação. A adoção exige revisão manual.");
        }
        if (quantidade == 0) return List.of();
        String sql = "SELECT d.anoCenso, l.municipio, i.codigoIes, c.areaGeral, c.modalidadeEnsino, " +
                "d.vagasOfertadas, d.inscritos, d.ingressantes, d.matriculas, d.concluintes, " +
                "d.matriculas0a17, d.matriculas18a24, d.matriculas25a29, d.matriculas30a34, " +
                "d.matriculas35a39, d.matriculas40a49, d.matriculas50a59, d.matriculas60Mais " +
                "FROM dadosCurso d LEFT JOIN curso c ON c.idCurso = d.fkCurso " +
                "LEFT JOIN instituicao i ON i.idInstituicao = c.fkInstituicao " +
                "LEFT JOIN localizacao l ON l.idLocalizacao = i.fkLocalizacao ORDER BY d.idDadosCurso";
        List<Object[]> existentes = new ArrayList<>((int) quantidade);
        try (ResultSet rs = comandos.preparar(sql).executeQuery()) {
            while (rs.next()) {
                Object[] valores = new Object[18];
                for (int coluna = 1; coluna <= valores.length; coluna++) {
                    if (coluna == 2 || coluna == 4) valores[coluna - 1] = rs.getString(coluna);
                    else {
                        int numero = rs.getInt(coluna);
                        valores[coluna - 1] = rs.wasNull() ? null : numero;
                    }
                }
                existentes.add(valores);
            }
        }
        if (existentes.size() != quantidade) throw new SQLException("Os dados existentes mudaram durante a validação.");
        return existentes;
    }

    private static Object[] valoresPersistidos(RegistroCenso r) {
        DistribuicaoEtaria f = r.getDistribuicaoEtaria();
        return new Object[] { r.getAnoCenso(), r.getMunicipio() == null ? NAO_INFORMADO : r.getMunicipio(),
                r.getCodigoIes() == null ? 0 : r.getCodigoIes(), r.getAreaGeral(), r.getModalidadeEnsino(),
                r.getVagasTotal(), r.getInscritosTotal(), r.getIngressantes(), r.getMatriculas(), r.getConcluintes(),
                f.getMat0a17(), f.getMat18a24(), f.getMat25a29(), f.getMat30a34(),
                f.getMat35a39(), f.getMat40a49(), f.getMat50a59(), f.getMat60Mais() };
    }

    private static String descreverDivergencias(Object[] banco, Object[] planilha) {
        List<String> divergencias = new ArrayList<>();
        for (int i = 0; i < CAMPOS_VALIDACAO.length; i++) {
            if (!java.util.Objects.equals(banco[i], planilha[i])) {
                divergencias.add(CAMPOS_VALIDACAO[i] + " (Excel=" + planilha[i] + ", banco=" + banco[i] + ")");
            }
        }
        return String.join("; ", divergencias);
    }

    private class Sessao {
        private final Connection con;
        private final Comandos comandos;
        private final String hash;
        private final String nomeArquivo;
        private final List<Object[]> existentes;
        private final Map<List<Object>, Integer> existentesPendentes = new LinkedHashMap<>();
        private final Map<String, Integer> locais = cache();
        private final Map<List<Object>, Integer> instituicoes = cache();
        private final Map<List<Object>, Integer> cursos = cache();
        private int ultimaLinha;
        private int pendentes;
        private int novosConfirmados;
        private boolean controleCriado;

        Sessao(Connection con, Comandos comandos, String hash, String nomeArquivo, Estado estado, List<Object[]> existentes) {
            this.con = con;
            this.comandos = comandos;
            this.hash = hash;
            this.nomeArquivo = nomeArquivo;
            this.existentes = existentes;
            for (Object[] valores : existentes) {
                List<Object> chave = Arrays.asList(valores);
                existentesPendentes.merge(chave, 1, Integer::sum);
            }
            this.controleCriado = estado != null;
            this.ultimaLinha = estado == null ? 0 : estado.ultimaLinha();
        }

        void criarControle(int linha) throws SQLException {
            PreparedStatement ps = comandos.preparar(
                    "INSERT INTO importacaoCenso (arquivoSha256, arquivo, ultimaLinha, concluida, totalRegistros) VALUES (?, ?, ?, 0, ?)");
            preencher(ps, hash, nomeArquivo, linha, linha);
            ps.executeUpdate();
            con.commit();
            controleCriado = true;
            ultimaLinha = linha;
        }

        void processar(RegistroCenso registro, int numero) throws SQLException {
            if (!controleCriado) {
                List<Object> chave = Arrays.asList(valoresPersistidos(registro));
                Integer restantes = existentesPendentes.get(chave);
                if (restantes == null) {
                    String detalhes = numero <= existentes.size()
                        ? descreverDivergencias(existentes.get(numero - 1), valoresPersistidos(registro))
                        : "não há registro antigo nesta posição";
                    throw new SQLException("O registro " + numero + " não corresponde aos dados antigos ainda não validados. " +
                        "Diferenças na posição ordenada por idDadosCurso: " + detalhes + ". A adoção foi interrompida sem inserir dados.");
                }
                if (restantes == 1) existentesPendentes.remove(chave);
                else existentesPendentes.put(chave, restantes - 1);
                if (existentesPendentes.isEmpty()) {
                    criarControle(numero);
                    System.out.println("Importação anterior validada e adotada: " + numero + " registros preservados.");
                }
                return;
            }
            int local = obterLocalizacao(registro);
            int instituicao = obterInstituicao(registro, local);
            int curso = obterCurso(registro, instituicao);
            PreparedStatement ps = comandos.preparar(SQL_INSERT_DADOS);
            DistribuicaoEtaria f = registro.getDistribuicaoEtaria();
            Object[] valores = { registro.getAnoCenso(), registro.getVagasTotal(), registro.getInscritosTotal(),
                    registro.getIngressantes(), registro.getMatriculas(), registro.getConcluintes(), f.getMat0a17(),
                    f.getMat18a24(), f.getMat25a29(), f.getMat30a34(), f.getMat35a39(), f.getMat40a49(),
                    f.getMat50a59(), f.getMat60Mais(), curso };
            preencher(ps, valores);
            ps.addBatch();
            pendentes++;
            if (pendentes >= TAMANHO_LOTE) confirmar(numero, false);
        }

        void confirmar(int numero, boolean completa) throws SQLException {
            if (pendentes > 0) {
                PreparedStatement ps = comandos.preparar(SQL_INSERT_DADOS);
                ps.executeBatch();
                ps.clearBatch();
            }
            PreparedStatement controle = comandos.preparar(
                    "UPDATE importacaoCenso SET ultimaLinha = ?, concluida = ?, totalRegistros = ? WHERE arquivoSha256 = ?");
            preencher(controle, numero, completa, numero, hash);
            if (controle.executeUpdate() != 1) throw new SQLException("O controle da importação não foi encontrado.");
            con.commit();
            novosConfirmados += pendentes;
            pendentes = 0;
            ultimaLinha = numero;
            if (numero % 10000 == 0 || completa) System.out.println("Registros confirmados: " + numero + (completa ? " (planilha concluída)" : ""));
        }

        int obterLocalizacao(RegistroCenso r) throws SQLException {
            String municipio = r.getMunicipio() == null ? NAO_INFORMADO : r.getMunicipio();
            if (locais.containsKey(municipio)) return locais.get(municipio);
            Integer id = buscarId(comandos, "SELECT idLocalizacao FROM localizacao WHERE municipio = ? ORDER BY idLocalizacao LIMIT 1", municipio);
            if (id == null) id = inserirERetornarId(comandos,
                    "INSERT INTO localizacao (regiao, uf, municipio) VALUES (?, ?, ?)", NAO_INFORMADO, "NI", municipio);
            locais.put(municipio, id);
            return id;
        }

        int obterInstituicao(RegistroCenso r, int local) throws SQLException {
            int codigo = r.getCodigoIes() == null ? 0 : r.getCodigoIes();
            List<Object> chave = List.of(codigo, local);
            if (instituicoes.containsKey(chave)) return instituicoes.get(chave);
            Integer id = buscarId(comandos, "SELECT idInstituicao FROM instituicao WHERE codigoIes = ? AND fkLocalizacao = ? ORDER BY idInstituicao LIMIT 1", codigo, local);
            if (id == null) id = inserirERetornarId(comandos,
                    "INSERT INTO instituicao (codigoIes, nomeIes, redeEnsino, categoriaAdministrativa, organizacaoAcademica, nivelAcademico, fkLocalizacao) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    codigo, NAO_INFORMADO, 0, NAO_INFORMADO, NAO_INFORMADO, 0, local);
            instituicoes.put(chave, id);
            return id;
        }

        int obterCurso(RegistroCenso r, int instituicao) throws SQLException {
            int modalidade = r.getModalidadeEnsino() == null ? 0 : r.getModalidadeEnsino();
            List<Object> chave = Arrays.asList(instituicao, r.getAreaGeral(), modalidade);
            if (cursos.containsKey(chave)) return cursos.get(chave);
            // Mantém a identidade da importação anterior: o arquivo não fornece CO_CURSO.
            Integer id = buscarId(comandos, "SELECT idCurso FROM curso WHERE fkInstituicao = ? AND areaGeral <=> ? AND modalidadeEnsino = ? ORDER BY idCurso LIMIT 1",
                    instituicao, r.getAreaGeral(), modalidade);
            if (id == null) id = inserirERetornarId(comandos,
                    "INSERT INTO curso (codigoCurso, nomeCurso, areaGeral, grauAcademico, modalidadeEnsino, fkInstituicao) VALUES (?, ?, ?, ?, ?, ?)",
                    0, r.getAreaGeral() == null ? NAO_INFORMADO : r.getAreaGeral(), r.getAreaGeral(), NAO_INFORMADO, modalidade, instituicao);
            cursos.put(chave, id);
            return id;
        }
    }

    private static <K> Map<K, Integer> cache() {
        return new LinkedHashMap<K, Integer>(256, 0.75f, true) {
            @Override protected boolean removeEldestEntry(Map.Entry<K, Integer> entrada) { return size() > LIMITE_CACHE; }
        };
    }

    private Integer buscarId(Comandos comandos, String sql, Object... parametros) throws SQLException {
        PreparedStatement ps = comandos.preparar(sql);
        preencher(ps, parametros);
        try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getInt(1) : null; }
    }

    private int inserirERetornarId(Comandos comandos, String sql, Object... parametros) throws SQLException {
        PreparedStatement ps = comandos.prepararComChaves(sql);
        preencher(ps, parametros);
        ps.executeUpdate();
        try (ResultSet rs = ps.getGeneratedKeys()) {
            if (!rs.next()) throw new SQLException("O banco não retornou a chave do registro inserido.");
            return rs.getInt(1);
        }
    }

    private static String sha256(Path arquivo) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream entrada = Files.newInputStream(arquivo)) {
                byte[] buffer = new byte[65536];
                int lidos;
                while ((lidos = entrada.read(buffer)) != -1) digest.update(buffer, 0, lidos);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível.", e);
        }
    }

    private static class Comandos implements AutoCloseable {
        private final Connection con;
        private final Map<String, PreparedStatement> comandos = new LinkedHashMap<>();
        Comandos(Connection con) { this.con = con; }
        PreparedStatement preparar(String sql) throws SQLException { return preparar(sql, false); }
        PreparedStatement prepararComChaves(String sql) throws SQLException { return preparar(sql, true); }
        private PreparedStatement preparar(String sql, boolean chaves) throws SQLException {
            String chave = (chaves ? "chaves:" : "") + sql;
            PreparedStatement ps = comandos.get(chave);
            if (ps == null) {
                ps = chaves ? con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS) : con.prepareStatement(sql);
                comandos.put(chave, ps);
            }
            return ps;
        }
        @Override public void close() throws SQLException {
            SQLException falha = null;
            for (PreparedStatement ps : comandos.values()) {
                try { ps.close(); } catch (SQLException e) { if (falha == null) falha = e; else falha.addSuppressed(e); }
            }
            if (falha != null) throw falha;
        }
    }
}
