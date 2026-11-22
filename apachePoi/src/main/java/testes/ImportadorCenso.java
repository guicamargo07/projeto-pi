package testes;

import java.sql.SQLException;
import java.util.List;

public class ImportadorCenso {

    private final LeitorArquivo<RegistroCenso> leitor;
    private final CensoDao censoDao;
    private final LogDao logDao;

    public ImportadorCenso(LeitorArquivo<RegistroCenso> leitor, CensoDao censoDao, LogDao logDao) {
        this.leitor = leitor;
        this.censoDao = censoDao;
        this.logDao = logDao;
    }

    public void executar(int limiteRegistros, int limiteExibicao) {
        logDao.registrarLog("LeitorExcel", "CONCLUIDO",
                "Iniciando a leitura do arquivo: " + leitor.getNomeArquivo(), null, null);

        List<RegistroCenso> registrosExtraidos = leitor.extrairRegistros(limiteRegistros);

        logDao.registrarLog("LeitorExcel", "CONCLUIDO",
                "Registros extraídos com sucesso da planilha.", null, registrosExtraidos.size());

        exibirResumoConsole(registrosExtraidos, limiteExibicao);

        try {
            int gravados = censoDao.inserirRegistros(registrosExtraidos);
            logDao.registrarLog("CensoDao", "CONCLUIDO",
                    "Registros gravados no banco com sucesso.", null, gravados);
            System.out.println("Registros gravados no banco: " + gravados);
        } catch (SQLException e) {
            logDao.registrarLog("CensoDao", "ERRO",
                    "Falha ao gravar registros no banco de dados.", e.getMessage(), null);
            System.out.println("Erro ao gravar no banco: " + e.getMessage());
        }
    }

    private void exibirResumoConsole(List<RegistroCenso> registros, int limiteExibicao) {
        System.out.println("Registros extraídos: " + registros.size());

        int totalExibir = Math.min(limiteExibicao, registros.size());
        System.out.println("Exibindo " + totalExibir + " de " + registros.size() + " registros:");
        for (int i = 0; i < totalExibir; i++) {
            System.out.println(registros.get(i));
        }

        int restantes = registros.size() - totalExibir;
        if (restantes > 0) {
            System.out.println("... e mais " + restantes + " registros não exibidos");
        }
    }
}