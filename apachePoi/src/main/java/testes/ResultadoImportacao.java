package testes;

public record ResultadoImportacao(int lidos, int inseridos, int ignorados, int comErro, String erroBanco) {}