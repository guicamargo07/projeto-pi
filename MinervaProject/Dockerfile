# Imagem base do Node.js
FROM node:22

WORKDIR /app

# Copia os arquivos de dependências
COPY package*.json ./

# Instala somente as dependências de produção nas versões do lockfile.
RUN npm ci --omit=dev

# Copia somente o que o servidor precisa para funcionar.
COPY app.js LICENSE ./
COPY src ./src
COPY public ./public

# Porta que o Node utilizará
EXPOSE 8080

# Inicia o servidor
CMD ["node", "app.js"]
