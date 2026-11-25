package testes;

import java.nio.file.Files;
import java.nio.file.Path;

public class Main {
    public static void main(String[] args) throws Exception {
        String nomeArquivo = "MICRODADOS_CURSOS_2019_2024_MINERVA.xlsx";
        int limite = 0;
        boolean notificarSlack = false;
        for (String argumento : args) {
            if (argumento.startsWith("--arquivo=")) nomeArquivo = argumento.substring("--arquivo=".length());
            else if (argumento.startsWith("--limite=")) {
                limite = Integer.parseInt(argumento.substring("--limite=".length()));
                if (limite < 1) throw new IllegalArgumentException("--limite deve ser um inteiro positivo.");
            } else if ("--notificar-slack".equals(argumento)) notificarSlack = true;
            else throw new IllegalArgumentException("Argumento desconhecido: " + argumento);
        }
        Path caminho = Path.of(nomeArquivo);
        if (!Files.isRegularFile(caminho) && !caminho.isAbsolute()) {
            Path alternativa = Path.of("apachePoi").resolve(caminho);
            if (Files.isRegularFile(alternativa)) caminho = alternativa;
        }
        if (!Files.isRegularFile(caminho)) throw new IllegalArgumentException("Planilha não encontrada: " + caminho.toAbsolutePath());
        LeitorArquivo<RegistroCenso> leitor = new LeitorExcel(caminho.toAbsolutePath().toString());
        ImportadorCenso importador = new ImportadorCenso(leitor, new CensoDao(), new LogDao());
        importador.executar(limite, 0);
        // A presença do webhook sozinha nunca autoriza uma mensagem externa.
        if (notificarSlack) new Notificacoes(System.getenv("SLACK_WEBHOOK_URL")).enviarNotificacao("Importação do censo concluída.");
    }
}
