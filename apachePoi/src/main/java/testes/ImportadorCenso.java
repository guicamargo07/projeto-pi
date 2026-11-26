package testes;

import java.io.IOException;
import java.sql.SQLException;

public class ImportadorCenso {
    private final LeitorArquivo<RegistroCenso> leitor;
    private final CensoDao censoDao;
    private final LogDao logDao;

    public ImportadorCenso(LeitorArquivo<RegistroCenso> leitor, CensoDao censoDao, LogDao logDao) {
        this.leitor = leitor;
        this.censoDao = censoDao;
        this.logDao = logDao;
    }

    public void executar(int limiteRegistros, int limiteExibicao) throws IOException, SQLException {
        System.out.println("Importando em fluxo: " + leitor.getNomeArquivo() +
                (limiteRegistros > 0 ? " (limite de " + limiteRegistros + " registros)" : " (planilha completa)"));
        try {
            CensoDao.ResultadoImportacao resultado = censoDao.importar(leitor, limiteRegistros);
            String resumo = "Registros confirmados: " + resultado.totalRegistros() +
                    "; novos nesta execução: " + resultado.novosRegistros() +
                    "; importação completa: " + resultado.completa();
            System.out.println(resumo);
            logDao.registrarLog("ImportadorCenso", "CONCLUIDO", resumo, null, resultado.novosRegistros());
        } catch (IOException | SQLException | RuntimeException e) {
            logDao.registrarLog("ImportadorCenso", "ERRO", "Falha na importação; lotes confirmados podem ser retomados.",
                    e.getMessage(), null);
            throw e;
        }
    }
}
