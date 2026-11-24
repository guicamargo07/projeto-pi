package testes.exceptions;

public class ArgumentoInvalidoException extends RuntimeException {
    public ArgumentoInvalidoException(String message) {
        super(message);
    }
}