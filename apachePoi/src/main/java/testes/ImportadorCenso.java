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

    public CensoDao.ResultadoImportacao executar(int limiteRegistros) throws IOException, SQLException {
        logDao.registrarLog("LeitorExcel", "CONCLUIDO",
                "Iniciando a importação do arquivo: " + leitor.getNomeArquivo(), null, null);

        try {
            CensoDao.ResultadoImportacao resultado = censoDao.importar(leitor, limiteRegistros);

            logDao.registrarLog("CensoDao", "CONCLUIDO",
                    "Importação finalizada. Planilha completa: " + resultado.completa(),
                    null, resultado.novosRegistros());

            System.out.println("Total confirmado: " + resultado.totalRegistros()
                    + " | Novos nesta execução: " + resultado.novosRegistros()
                    + " | Planilha completa: " + resultado.completa());

            return resultado;

        } catch (IOException | SQLException e) {
            logDao.registrarLog("CensoDao", "ERRO",
                    "Falha na importação do censo.", e.getMessage(), null);
            System.out.println("Erro na importação: " + e.getMessage());
            throw e; // o Main envia o alerta ao Slack
        }
    }
}