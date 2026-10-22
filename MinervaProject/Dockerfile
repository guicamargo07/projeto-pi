# Imagem base do Node.js
FROM node:22

# Copia os arquivos de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante do projeto
COPY . .

# Porta que o Node utilizará
EXPOSE 8080

# Inicia o servidor
CMD ["node", "app.js"]