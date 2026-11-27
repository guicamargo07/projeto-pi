package testes;

import java.util.List;

public class Main {
    private static final int LIMITE_REGISTROS = 1000;
    private static final int LIMITE_EXIBICAO = 10;
    private static final int INTERVALO_LOG = 250;

    public static void main(String[] args) {
        String nomeArquivo = "MICRODADOS_CURSOS_2019_2024_MINERVA.xlsx";
        LogDao logDao = new LogDao();

        logDao.registrarLog(
                "Main",
                "CONCLUIDO",
                "Início do processo de carga da planilha: " + nomeArquivo,
                "Limite de extração configurado: " + LIMITE_REGISTROS,
                0
        );

        LeitorExcel leitorExcel = new LeitorExcel(nomeArquivo);
        List<RegistroCenso> registrosExtraidos;
        try {
            logDao.registrarLog(
                    "LeitorExcel",
                    "CONCLUIDO",
                    "Iniciando extração de registros do arquivo: " + nomeArquivo,
                    null,
                    0
            );

            registrosExtraidos = leitorExcel.extrairRegistros(LIMITE_REGISTROS);

            int totalExtraidos = registrosExtraidos.size();
            for (int i = INTERVALO_LOG; i <= totalExtraidos; i += INTERVALO_LOG) {
                logDao.registrarLog(
                        "LeitorExcel",
                        "CONCLUIDO",
                        "Progresso na extração da planilha (" + i + " de " + totalExtraidos + " registros)",
                        "Arquivo: " + nomeArquivo,
                        i
                );
            }

            logDao.registrarLog(
                    "LeitorExcel",
                    "CONCLUIDO",
                    "Extração da planilha concluída",
                    "Arquivo: " + nomeArquivo,
                    totalExtraidos
            );
        } catch (Exception e) {
            logDao.registrarLog(
                    "LeitorExcel",
                    "ERRO",
                    "Falha durante a extração do arquivo: " + nomeArquivo,
                    e.getMessage(),
                    0
            );
            System.out.println("Erro ao ler planilha: " + e.getMessage());
            return;
        }

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

        logDao.registrarLog(
                "Main",
                "CONCLUIDO",
                "Pré-visualização no console concluída",
                "Exibidos " + totalExibir + " de " + registrosExtraidos.size() + " registros",
                totalExibir
        );

        // Grava no banco MinervaDB
        try {
            logDao.registrarLog(
                    "CensoDao",
                    "CONCLUIDO",
                    "Iniciando persistência dos registros no banco MinervaDB",
                    "Limite configurado: " + LIMITE_REGISTROS,
                    registrosExtraidos.size()
            );

            CensoDao dao = new CensoDao();
            CensoDao.ResultadoImportacao resultado = dao.importar(leitorExcel, LIMITE_REGISTROS);
            int gravados = resultado.novosRegistros();

            for (int i = INTERVALO_LOG; i <= gravados; i += INTERVALO_LOG) {
                logDao.registrarLog(
                        "CensoDao",
                        "CONCLUIDO",
                        "Lote de gravação no banco concluído (" + i + " registros acumulados)",
                        "Tabela alvo: dadosCurso / carga Censo",
                        i
                );
            }

            logDao.registrarLog(
                    "CensoDao",
                    "CONCLUIDO",
                    "Persistência no banco concluída com sucesso",
                    "Arquivo: " + nomeArquivo + " | Total lidos na importação: " + resultado.totalRegistros(),
                    gravados
            );

            logDao.registrarLog(
                    "Main",
                    "CONCLUIDO",
                    "Carga finalizada com sucesso para o arquivo: " + nomeArquivo,
                    "Extraídos: " + registrosExtraidos.size() + " | Novos gravados: " + gravados,
                    gravados
            );

            System.out.println("Registros gravados no banco: " + gravados);
        } catch (Exception e) {
            logDao.registrarLog(
                    "CensoDao",
                    "ERRO",
                    "Erro ao gravar registros no banco MinervaDB",
                    e.getMessage(),
                    0
            );
            logDao.registrarLog(
                    "Main",
                    "ERRO",
                    "Carga abortada por falha na persistência: " + nomeArquivo,
                    e.getMessage(),
                    0
            );
            System.out.println("Erro ao gravar no banco: " + e.getMessage());
        }
    }
}