# Compila o projeto e suas dependencias com Java 21.
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /build
COPY pom.xml ./
COPY src ./src
RUN mvn -B -ntp clean package

# A imagem final precisa somente do Java e do JAR executavel.
FROM eclipse-temurin:21-jre

WORKDIR /app
COPY --from=build /build/target/apachePoi-1.0-SNAPSHOT.jar /app/apache-poi.jar

# A planilha sera montada somente para leitura neste diretorio.
# O container encerra quando o processamento Java termina.
ENTRYPOINT ["java", "-jar", "/app/apache-poi.jar"]
