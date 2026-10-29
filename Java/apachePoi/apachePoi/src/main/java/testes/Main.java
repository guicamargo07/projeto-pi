package testes;

import java.sql.SQLException;
import java.util.List;

public class Main {

    // Quantidade máxima de registros extraídos da planilha
    private static final int LIMITE_REGISTROS = 1000;

    // Quantidade máxima de registros exibidos no console
    private static final int LIMITE_EXIBICAO = 10;

    public static void main(String[] args) {
        String nomeArquivo = "MICRODADOS_CURSOS_2019_2024_MINERVA.xlsx";

        LogDao logDao = new LogDao();

        logDao.registrarLog("LeitorExcel", "CONCLUIDO", "Iniciando a leitura do arquivo: " + nomeArquivo, null, null);

        LeitorExcel leitorExcel = new LeitorExcel();
        List<RegistroCenso> registrosExtraidos =
                leitorExcel.extrairRegistros(nomeArquivo, LIMITE_REGISTROS);

        logDao.registrarLog("LeitorExcel", "CONCLUIDO", "Registros extraídos com sucesso da planilha.", null, registrosExtraidos.size());

        System.out.println("Registros extraídos: " + registrosExtraidos.size());

        int totalExibir = Math.min(LIMITE_EXIBICAO, registrosExtraidos.size());
        System.out.println("Exibindo " + totalExibir + " de " + registrosExtraidos.size() + " registros:");

        for (int i = 0; i < totalExibir; i++) {
            System.out.println(registrosExtraidos.get(i));
        }

        int restantes = registrosExtraidos.size() - totalExibir;
        if (restantes > 0) {
            System.out.println("... e mais " + restantes + " registros não exibidos");
        }

        try {
            CensoDao dao = new CensoDao();
            int gravados = dao.inserirRegistros(registrosExtraidos);

            // Log de sucesso
            logDao.registrarLog("CensoDao", "CONCLUIDO", "Registros gravados no banco com sucesso.", null, gravados);
            System.out.println("Registros gravados no banco: " + gravados);

        } catch (SQLException e) {
            // Log de erro
            logDao.registrarLog("CensoDao", "ERRO", "Falha ao gravar registros no banco de dados.", e.getMessage(), null);
            System.out.println("Erro ao gravar no banco: " + e.getMessage());
        }
    }
}