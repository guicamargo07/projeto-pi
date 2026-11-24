package testes;

import java.io.IOException;

public class Main {

    private static final int LIMITE_REGISTROS = 1000;
    private static final int LIMITE_EXIBICAO = 10;

    public static void main(String[] args) throws IOException {
        String nomeArquivo = "MICRODADOS_CURSOS_2019_2024_MINERVA.xlsx";

        LeitorArquivo<RegistroCenso> leitor = new LeitorExcel(nomeArquivo);
        CensoDao censoDao = new CensoDao();
        LogDao logDao = new LogDao();

        ImportadorCenso importador = new ImportadorCenso(leitor, censoDao, logDao);
        importador.executar(LIMITE_REGISTROS, LIMITE_EXIBICAO);

        String webhookUrl = System.getenv("SLACK_WEBHOOK_URL");
        Notificacoes slack = new Notificacoes(webhookUrl);

        slack.enviarNotificacao("Processo concluído com sucesso!");
    }
}