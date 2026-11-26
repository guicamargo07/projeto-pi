package testes;

public class Main {

    private static final int LIMITE_REGISTROS = 1000;

    public static void main(String[] args) throws Exception {
        String nomeArquivo = "MICRODADOS_CURSOS_2019_2024_MINERVA.xlsx";

        String webhookUrl = System.getenv("SLACK_WEBHOOK_URL");
        Notificacoes slack = new Notificacoes(webhookUrl);

        try {
            LeitorArquivo<RegistroCenso> leitor = new LeitorExcel(nomeArquivo);
            CensoDao censoDao = new CensoDao();
            LogDao logDao = new LogDao();

            ImportadorCenso importador = new ImportadorCenso(leitor, censoDao, logDao);

            long inicio = System.currentTimeMillis();
            CensoDao.ResultadoImportacao r = importador.executar(LIMITE_REGISTROS);
            long segundos = (System.currentTimeMillis() - inicio) / 1000;

            if (r.totalRegistros() == 0) {
                slack.enviarNotificacao("🚨 Nenhum registro importado de " + nomeArquivo
                        + ". Arquivo vazio ou formato mudou?");
            } else if (r.novosRegistros() == 0 && r.completa()) {
                slack.enviarNotificacao("ℹ️ A planilha " + nomeArquivo
                        + " já tinha sido importada integralmente. Nada foi duplicado.");
            } else {
                String status = r.completa()
                        ? "✅ Importação do Censo concluída em " + segundos + "s"
                        : "⏸️ Importação parcial do Censo (limite de " + LIMITE_REGISTROS
                        + ") em " + segundos + "s";
                slack.enviarNotificacao(status + "\n"
                        + "Arquivo: " + nomeArquivo + "\n"
                        + "Novos nesta execução: " + r.novosRegistros()
                        + " | Total confirmado: " + r.totalRegistros());
            }

        } catch (Exception e) {
            slack.enviarNotificacao("🚨 Falha na importação do Censo\n"
                    + "Arquivo: " + nomeArquivo + "\n"
                    + "Erro: " + e.getClass().getSimpleName() + ": " + e.getMessage());
            throw e;
        }
    }
}