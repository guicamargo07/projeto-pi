package testes;

import java.sql.SQLException;
import java.util.List;

public class Main {

    // Quantidade máxima de registros extraídos da planilha
    private static final int LIMITE_REGISTROS = 1000;

    // Quantidade máxima de registros exibidos no console
    private static final int LIMITE_EXIBICAO = 10;

    public static void main(String[] args) {
        String nomeArquivo = "MICRODADOS_CURSOS_2019_2024_MINERVA.xlsx"; // ajuste para o nome do seu arquivo

        // Instancia o DAO de log via JDBC
        LogDao logDao = new LogDao();
        logDao.registrarLog("INFO", "Iniciando a execução para o arquivo: " + nomeArquivo);

        LeitorExcel leitorExcel = new LeitorExcel();
        List<RegistroCenso> registrosExtraidos =
                leitorExcel.extrairRegistros(nomeArquivo, LIMITE_REGISTROS);

        logDao.registrarLog("INFO", "Registros extraídos com sucesso: " + registrosExtraidos.size());
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

        // Grava no nosso banco
        try {
            CensoDao dao = new CensoDao();
            int gravados = dao.inserirRegistros(registrosExtraidos);

            logDao.registrarLog("INFO", "Registros gravados no banco: " + gravados);
            System.out.println("Registros gravados no banco: " + gravados);
        } catch (SQLException e) {
            logDao.registrarLog("ERROR", "Erro ao gravar no banco: " + e.getMessage());
            System.out.println("Erro ao gravar no banco: " + e.getMessage());
        }
    }
}