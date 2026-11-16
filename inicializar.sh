#!/usr/bin/env bash
# Execute na instancia EC2: bash ./inicializar.sh instalar
set -Eeuo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_FILE="$PROJECT_DIR/inicializar.sh"
CONFIG_DIR=/etc/minerva
LOG_FILE=/var/log/minerva-apache-poi.log
LOCK_FILE=/run/lock/minerva-java.lock
TIMEZONE=America/Sao_Paulo
NETWORK=minerva-network
WORKBOOK=MICRODADOS_CURSOS_2019_2024_MINERVA.xlsx
CRON_MARKER=MINERVA_APACHE_POI

falhar() {
    printf 'ERRO: %s\n' "$*" >&2
    exit 1
}

verificar_arquivos() {
    local arquivo
    for arquivo in DB/Dockerfile DB/arquivos/001_script.sql \
        MinervaProject/Dockerfile MinervaProject/package.json \
        apachePoi/Dockerfile apachePoi/pom.xml "apachePoi/$WORKBOOK"; do
        [[ -f "$PROJECT_DIR/$arquivo" ]] || falhar "Arquivo necessario ausente: $PROJECT_DIR/$arquivo"
    done
}

instalar_dependencias() {
    local cron_package docker_package
    local -a pacotes=()
    if command -v apt-get >/dev/null 2>&1; then
        CRON_SERVICE=cron
        cron_package=cron
        docker_package=docker.io
    elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
        CRON_SERVICE=crond
        cron_package=cronie
        docker_package=docker
    else
        falhar 'Use Ubuntu/Debian ou Amazon Linux com systemd.'
    fi

    command -v docker >/dev/null 2>&1 || pacotes+=("$docker_package")
    command -v crontab >/dev/null 2>&1 || pacotes+=("$cron_package")
    command -v flock >/dev/null 2>&1 || pacotes+=(util-linux)
    [[ -f "/usr/share/zoneinfo/$TIMEZONE" ]] || pacotes+=(tzdata)

    if (( ${#pacotes[@]} > 0 )); then
        if [[ "$CRON_SERVICE" == cron ]]; then
            sudo apt-get update
            sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y "${pacotes[@]}"
        elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y "${pacotes[@]}"
        else
            if ! command -v docker >/dev/null 2>&1 \
                && command -v amazon-linux-extras >/dev/null 2>&1; then
                sudo amazon-linux-extras enable docker
            fi
            sudo yum install -y "${pacotes[@]}"
        fi
    fi
    sudo systemctl enable --now docker "$CRON_SERVICE"
    sudo docker info >/dev/null
}

criar_configuracoes() {
    local arquivo existentes=0 senha_root senha_app
    for arquivo in mysql.env node.env java.env; do
        if [[ -f "$CONFIG_DIR/$arquivo" ]]; then
            existentes=$((existentes + 1))
        fi
    done
    if (( existentes == 3 )); then
        return
    fi
    (( existentes == 0 )) || falhar "Configuracao incompleta em $CONFIG_DIR; confira os tres arquivos .env."

    mkdir -p -- "$CONFIG_DIR"
    chmod 700 "$CONFIG_DIR"
    senha_root="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
    senha_app="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
    cat > "$CONFIG_DIR/mysql.env" <<EOF
MYSQL_ROOT_PASSWORD=$senha_root
MYSQL_DATABASE=MinervaDB
MYSQL_USER=minerva
MYSQL_PASSWORD=$senha_app
TZ=$TIMEZONE
EOF
    cat > "$CONFIG_DIR/node.env" <<EOF
AMBIENTE_PROCESSO=producao
APP_HOST=0.0.0.0
APP_PORT=8080
DB_HOST=db-minerva
DB_PORT=3306
DB_DATABASE=MinervaDB
DB_USER=minerva
DB_PASSWORD=$senha_app
TZ=$TIMEZONE
EOF
    cat > "$CONFIG_DIR/java.env" <<EOF
MINERVA_DB_URL=jdbc:mysql://db-minerva:3306/MinervaDB?rewriteBatchedStatements=true&useSSL=false&allowPublicKeyRetrieval=true
MINERVA_DB_USER=minerva
MINERVA_DB_PASSWORD=$senha_app
TZ=$TIMEZONE
EOF
    chmod 600 "$CONFIG_DIR/mysql.env" "$CONFIG_DIR/node.env" "$CONFIG_DIR/java.env"
    printf 'Credenciais geradas em %s (acesso apenas do root).\n' "$CONFIG_DIR"
}

construir_imagens() {
    (
        cd "$PROJECT_DIR/DB"
        sudo docker build -t minerva-db .
    )
    (
        cd "$PROJECT_DIR/MinervaProject"
        sudo docker build -t minerva-project .
    )
    (
        cd "$PROJECT_DIR/apachePoi"
        sudo docker build -t minerva-java .
    )
}

reutilizar_container() {
    local nome="$1" gerenciado
    if ! sudo docker container inspect "$nome" >/dev/null 2>&1; then
        return 1
    fi
    gerenciado="$(sudo docker inspect --format '{{index .Config.Labels "minerva.managed"}}' "$nome")"
    [[ "$gerenciado" == true ]] || falhar "O container $nome ja existe e nao foi criado por este script. Ele foi preservado; resolva o conflito de nomes antes de continuar."
    sudo docker start "$nome" >/dev/null || falhar "Nao foi possivel iniciar $nome."
    printf 'Container %s reutilizado, mantendo configuracao e dados.\n' "$nome"
}

aguardar_mysql() {
    local tentativa
    printf 'Aguardando o MySQL e a inicializacao das tabelas...\n'
    for ((tentativa = 1; tentativa <= 60; tentativa++)); do
        # Consulta autenticada por TCP: confirma usuario, banco e tabela de logs.
        # MYSQL_PWD evita passar a senha como argumento do processo mysql.
        if sudo docker exec db-minerva sh -c '
            export MYSQL_PWD="$MYSQL_PASSWORD"
            exec mysql --protocol=TCP -h127.0.0.1 -u"$MYSQL_USER" "$MYSQL_DATABASE" \
                -Nse "SELECT 1 FROM logs LIMIT 1"
        ' >/dev/null 2>&1; then
            return
        fi
        [[ "$(sudo docker inspect --format '{{.State.Running}}' db-minerva)" == true ]] \
            || falhar 'O MySQL parou. Consulte: sudo docker logs db-minerva'
        sleep 5
    done
    falhar 'MySQL nao ficou pronto em 5 minutos. Confira sudo docker logs db-minerva e as credenciais do volume existente.'
}

iniciar_servicos() {
    if ! sudo docker network inspect "$NETWORK" >/dev/null 2>&1; then
        sudo docker network create "$NETWORK" >/dev/null
    fi
    sudo docker volume create minerva-mysql-data >/dev/null

    # Comando solicitado, acrescido de rede, ambiente e volume persistente.
    if ! reutilizar_container db-minerva; then
        sudo docker run -d --name db-minerva -p 3306:3306 \
            --network "$NETWORK" --restart unless-stopped \
            --label minerva.managed=true \
            --env-file "$CONFIG_DIR/mysql.env" \
            --mount source=minerva-mysql-data,target=/var/lib/mysql \
            minerva-db
    fi
    aguardar_mysql

    # Comando solicitado, acrescido da configuracao para acessar db-minerva.
    if ! reutilizar_container minerva; then
        sudo docker run -d --name minerva -p 8080:8080 \
            --network "$NETWORK" --restart unless-stopped \
            --label minerva.managed=true \
            --env-file "$CONFIG_DIR/node.env" \
            minerva-project
    fi

    local tentativa
    for ((tentativa = 1; tentativa <= 30; tentativa++)); do
        if sudo docker exec minerva node -e '
            const http = require("http");
            const req = http.get("http://127.0.0.1:8080/", res => {
                res.resume();
                process.exit(res.statusCode < 400 ? 0 : 1);
            });
            req.on("error", () => process.exit(1));
            req.setTimeout(2000, () => { req.destroy(); process.exit(1); });
        ' >/dev/null 2>&1; then
            return
        fi
        sleep 2
    done
    falhar 'Node nao respondeu na porta 8080. Consulte: sudo docker logs minerva'
}

agendar_java() {
    local atual comando
    # O cron do Ubuntu nao suporta CRON_TZ. Ajustamos o fuso do host/daemon.
    sudo timedatectl set-timezone "$TIMEZONE"
    touch "$LOG_FILE"
    chmod 600 "$LOG_FILE"
    atual="$(sudo crontab -l 2>/dev/null || true)"
    printf -v comando '/bin/bash %q executar-java >> %s 2>&1' "$SCRIPT_FILE" "$LOG_FILE"
    {
        printf '%s\n' "$atual" | sed \
            -e "/^# BEGIN $CRON_MARKER\$/,/^# END $CRON_MARKER\$/d" \
            -e "/# $CRON_MARKER\$/d"
        printf '# BEGIN %s\nCRON_TZ=%s\nSHELL=/bin/sh\n' "$CRON_MARKER" "$TIMEZONE"
        printf '0 8 * * 5 %s # %s\n' "$comando" "$CRON_MARKER"
        printf '# END %s\n' "$CRON_MARKER"
    } | sudo crontab -
    sudo systemctl restart "$CRON_SERVICE"
    printf 'Cron do root: sexta-feira, 08h00 (%s). Log: %s\n' "$TIMEZONE" "$LOG_FILE"
}

executar_java() {
    [[ -f "$CONFIG_DIR/java.env" ]] || falhar 'Execute primeiro: bash ./inicializar.sh instalar'
    [[ -f "$PROJECT_DIR/apachePoi/$WORKBOOK" ]] || falhar "Planilha ausente: $PROJECT_DIR/apachePoi/$WORKBOOK"
    # O descritor fica aberto ate o docker run terminar; evita execucoes simultaneas.
    exec 9>"$LOCK_FILE"
    if ! flock -n 9; then
        printf '[%s] Importacao anterior ainda esta em execucao.\n' "$(date -Iseconds)"
        return
    fi
    printf '[%s] Iniciando Apache POI.\n' "$(date -Iseconds)"
    aguardar_mysql
    # Sem -d e sem politica de reinicio: o processo Java define o ciclo de vida.
    # --rm remove o container ao terminar; Node e MySQL continuam ativos.
    local resultado=0
    sudo docker run --rm --name minerva-java \
        --network "$NETWORK" \
        --env-file "$CONFIG_DIR/java.env" \
        --mount "type=bind,source=$PROJECT_DIR/apachePoi/$WORKBOOK,target=/app/$WORKBOOK,readonly" \
        minerva-java || resultado=$?
    printf '[%s] Apache POI encerrado. Codigo de saida: %s\n' "$(date -Iseconds)" "$resultado"
    return "$resultado"
}

main() {
    local acao="${1:-instalar}"
    case "$acao" in
        instalar|executar-java) ;;
        -h|--help|ajuda)
            printf 'Uso: bash ./inicializar.sh [instalar|executar-java]\n'
            return ;;
        *) falhar "Acao desconhecida: $acao" ;;
    esac
    [[ "$(uname -s)" == Linux ]] || falhar 'Execute este script na instancia Linux da AWS.'
    command -v sudo >/dev/null 2>&1 || falhar 'O comando sudo precisa estar instalado.'
    if (( EUID != 0 )); then
        exec sudo -- /bin/bash "$SCRIPT_FILE" "$acao"
    fi
    case "$PROJECT_DIR" in
        *%*|*[[:cntrl:]]*) falhar 'Use um caminho sem % ou caracteres de controle para o projeto.' ;;
    esac

    if [[ "$acao" == executar-java ]]; then
        executar_java
    else
        verificar_arquivos
        instalar_dependencias
        criar_configuracoes
        construir_imagens
        iniciar_servicos
        agendar_java
        printf 'Inicializacao concluida. Node: porta 8080; MySQL: porta 3306.\n'
        printf 'Para importar agora: sudo bash %q executar-java\n' "$SCRIPT_FILE"
    fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
