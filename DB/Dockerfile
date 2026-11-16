# use a imagem oficial do MySQL como imagem base
FROM mysql:latest
# As credenciais sao fornecidas por --env-file ao iniciar o container.
# copie os scripts SQL de inicialização para um diretório temporário no container
COPY ./arquivos/ /docker-entrypoint-initdb.d/
# exponha a porta padrão do MySQL
EXPOSE 3306
