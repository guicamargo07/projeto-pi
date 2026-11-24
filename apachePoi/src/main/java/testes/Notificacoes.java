package testes;

import com.slack.api.Slack;
import com.slack.api.webhook.WebhookResponse;
import testes.exceptions.ArgumentoInvalidoException;

import java.io.IOException;

import static com.slack.api.webhook.WebhookPayloads.payload;

public class Notificacoes {

    private final String webhookUrl;

    public Notificacoes(String webhookUrl) {
        if (webhookUrl == null || webhookUrl.isBlank()) {
            throw new ArgumentoInvalidoException("A URL do webhook do Slack não pode estar vazia.");
        }
        this.webhookUrl = webhookUrl;
    }

    public void enviarNotificacao(String mensagem) throws IOException {
        WebhookResponse response = Slack.getInstance().send(
                webhookUrl,
                payload(p -> p.text(mensagem))
        );

        if (response.getCode() != 200) {
            throw new IOException("Falha ao enviar para o Slack. HTTP " + response.getCode() + ": " + response.getBody());
        }
    }
}