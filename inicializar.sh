#!/usr/bin/env bash
# Execute na instancia EC2: bash ./inicializar.sh instalar
set -Eeuo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_FILE="$PROJECT_DIR/inicializar.sh"
COMPOSE_FILE="$PROJECT_DIR/compose.yaml"
COMPOSE_PROJECT=minerva
EC2_HOST=34.235.37.58
# Java e Node acessam o servico MySQL pela rede interna do Compose na EC2.
DB_HOST=db
DB_PORT=3306
CONFIG_DIR=/etc/minerva
LOG_FILE=/var/log/minerva-apache-poi.log
LOCK_FILE=/run/lock/minerva-java.lock
TIMEZONE=America/Sao_Paulo
WORKBOOK=MICRODADOS_CURSOS_2019_2024_MINERVA.xlsx
CRON_MARKER=MINERVA_APACHE_POI

falhar() {
    printf 'ERRO: %s\n' "$*" >&2
    exit 1
}

verificar_arquivos() {
    local arquivo
    for arquivo in compose.yaml DB/Dockerfile DB/arquivos/001_script.sql DB/arquivos/002_importacao.sql \
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
    command -v curl >/dev/null 2>&1 || pacotes+=(curl ca-certificates)
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
    instalar_compose
}

instalar_compose() {
    if sudo docker compose version >/dev/null 2>&1; then
        verificar_compose
        return
    fi
    # Plugin oficial, instalado para todos os usuarios sem trocar o Docker Engine.
    # Versao e SHA256 fixos: https://github.com/docker/compose/releases/tag/v5.6.1
    (
        local arquitetura checksum temporario
        arquitetura="$(uname -m)"
        case "$arquitetura" in
            x86_64)
                checksum=47737f4236e6d3ccea7291995203f8f018058783b4c3a9469119811a0b5db8c0 ;;
            aarch64|arm64)
                arquitetura=aarch64
                checksum=42cfa75f51ad0ccf290bad37899e0038a8c10a0069e85233ecc1d53e3ff1347d ;;
            *) falhar "Arquitetura nao suportada para instalar Compose: $arquitetura" ;;
        esac
        temporario="$(mktemp)"
        trap 'rm -f -- "$temporario"' EXIT
        curl --fail --show-error --location --retry 3 \
            "https://github.com/docker/compose/releases/download/v5.6.1/docker-compose-linux-$arquitetura" \
            --output "$temporario" || falhar 'Nao foi possivel baixar o plugin Compose.'
        printf '%s  %s\n' "$checksum" "$temporario" | sha256sum --check --status \
            || falhar 'O SHA256 do plugin Compose nao confere. O arquivo nao sera instalado.'
        sudo install -d -m 755 /usr/local/lib/docker/cli-plugins
        sudo install -m 755 "$temporario" /usr/local/lib/docker/cli-plugins/docker-compose
    )
    sudo docker compose version
    verificar_compose
}

verificar_compose() {
    local opcoes_up opcoes_run
    opcoes_up="$(sudo docker compose up --help)"
    opcoes_run="$(sudo docker compose run --help)"
    [[ "$opcoes_up" == *--wait-timeout* && "$opcoes_up" == *--wait* \
        && "$opcoes_run" == *--pull* ]] \
        || falhar 'O plugin Compose instalado esta desatualizado. Atualize-o antes de migrar os containers; sao necessarios up --wait --wait-timeout e run --pull.'
}

compose() {
    sudo env MINERVA_CONFIG_DIR="$CONFIG_DIR" docker compose \
        --project-name "$COMPOSE_PROJECT" --project-directory "$PROJECT_DIR" \
        --file "$COMPOSE_FILE" --env-file /dev/null "$@"
}

criar_configuracoes() {
    local arquivo existentes=0 senha_root senha_app
    for arquivo in mysql.env node.env java.env; do
        if [[ -f "$CONFIG_DIR/$arquivo" ]]; then
            existentes=$((existentes + 1))
        fi
    done
    if (( existentes == 3 )); then
        # Corrige o destino interno sem alterar senhas, banco ou opcoes JDBC.
        sed -i -e "s/^DB_HOST=.*/DB_HOST=$DB_HOST/" \
            -e "s/^DB_PORT=.*/DB_PORT=$DB_PORT/" "$CONFIG_DIR/node.env"
        sed -i -E "s|^(MINERVA_DB_URL=jdbc:mysql://)[^/]+/|\1$DB_HOST:$DB_PORT/|" "$CONFIG_DIR/java.env"
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
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_DATABASE=MinervaDB
DB_USER=minerva
DB_PASSWORD=$senha_app
TZ=$TIMEZONE
EOF
    cat > "$CONFIG_DIR/java.env" <<EOF
MINERVA_DB_URL=jdbc:mysql://$DB_HOST:$DB_PORT/MinervaDB?rewriteBatchedStatements=true&useSSL=false&allowPublicKeyRetrieval=true
MINERVA_DB_USER=minerva
MINERVA_DB_PASSWORD=$senha_app
TZ=$TIMEZONE
EOF
    chmod 600 "$CONFIG_DIR/mysql.env" "$CONFIG_DIR/node.env" "$CONFIG_DIR/java.env"
    printf 'Credenciais geradas em %s (acesso apenas do root).\n' "$CONFIG_DIR"
}

construir_imagens() {
    compose --profile jobs config --quiet
    compose --profile jobs build db node java
}

migrar_containers_legados() {
    local nome projeto gerenciado volume
    local -a legados=()
    # Verifica todos os nomes antes de interromper qualquer servico existente.
    for nome in db-minerva minerva; do
        if ! sudo docker container inspect "$nome" >/dev/null 2>&1; then
            continue
        fi
        projeto="$(sudo docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$nome")"
        if [[ "$projeto" == "$COMPOSE_PROJECT" ]]; then
            continue
        fi
        gerenciado="$(sudo docker inspect --format '{{index .Config.Labels "minerva.managed"}}' "$nome")"
        [[ "$gerenciado" == true && ( -z "$projeto" || "$projeto" == '<no value>' ) ]] \
            || falhar "O container $nome pertence a outra instalacao. Ele foi preservado; resolva o conflito de nomes."
        if [[ "$nome" == db-minerva ]]; then
            volume="$(sudo docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/mysql"}}{{.Name}}{{end}}{{end}}' "$nome")"
            [[ "$volume" == minerva-mysql-data ]] \
                || falhar 'O banco existente nao usa minerva-mysql-data. Migre os dados antes de substituir o container.'
        fi
        legados+=("$nome")
    done
    if (( ${#legados[@]} > 0 )); then
        printf 'Migrando containers da versao anterior para Docker Compose; o volume sera preservado.\n'
        sudo docker stop --time 60 "${legados[@]}"
        # Sem -v: o banco permanece no volume minerva-mysql-data.
        sudo docker rm "${legados[@]}"
    fi
}

aguardar_mysql() {
    local tentativa
    printf 'Aguardando o MySQL e a inicializacao das tabelas...\n'
    for ((tentativa = 1; tentativa <= 60; tentativa++)); do
        # Consulta autenticada por TCP: confirma usuario, banco e tabela de logs.
        # MYSQL_PWD evita passar a senha como argumento do processo mysql.
        if compose exec -T db sh -c '
            export MYSQL_PWD="$MYSQL_PASSWORD"
            exec mysql --protocol=TCP -h127.0.0.1 -u"$MYSQL_USER" "$MYSQL_DATABASE" \
                -Nse "SELECT 1 FROM logs LIMIT 1"
        ' >/dev/null 2>&1; then
            return
        fi
        [[ "$(compose ps --status running --services db)" == db ]] \
            || falhar 'O MySQL nao esta ativo. Execute a instalacao novamente ou consulte: sudo docker compose logs db'
        sleep 5
    done
    falhar 'MySQL nao ficou pronto em 5 minutos. Confira sudo docker compose logs db e as credenciais do volume existente.'
}

aplicar_migracao_importacao() {
    printf 'Aplicando a migracao do controle de importacao...\n'
    compose exec -T db sh -c '
        export MYSQL_PWD="$MYSQL_PASSWORD"
        exec mysql --protocol=TCP -h127.0.0.1 -u"$MYSQL_USER" "$MYSQL_DATABASE"
    ' < "$PROJECT_DIR/DB/arquivos/002_importacao.sql"
}

iniciar_servicos() {
    # Java fica no perfil jobs e nao e iniciado pelo up dos servicos permanentes.
    compose up -d --no-build --pull never --wait --wait-timeout 360 db node
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
    local arquivo
    for arquivo in mysql.env node.env java.env; do
        [[ -f "$CONFIG_DIR/$arquivo" ]] || falhar 'Execute primeiro: bash ./inicializar.sh instalar'
    done
    [[ -f "$PROJECT_DIR/apachePoi/$WORKBOOK" ]] || falhar "Planilha ausente: $PROJECT_DIR/apachePoi/$WORKBOOK"
    # O descritor fica aberto ate o compose run terminar; evita execucoes simultaneas.
    exec 9>"$LOCK_FILE"
    if ! flock -n 9; then
        printf '[%s] Importacao anterior ainda esta em execucao.\n' "$(date -Iseconds)"
        return
    fi
    printf '[%s] Iniciando Apache POI.\n' "$(date -Iseconds)"
    aguardar_mysql
    aplicar_migracao_importacao
    # Sem -d e sem politica de reinicio: o processo Java define o ciclo de vida.
    # --rm remove o container ao terminar; --no-deps preserva Node e MySQL.
    local resultado=0
    compose run --rm -T --no-deps --name minerva-java --pull never java || resultado=$?
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
        exec 9>"$LOCK_FILE"
        flock -n 9 || falhar 'Uma importacao ou instalacao ja esta em execucao. Tente novamente quando terminar.'
        criar_configuracoes
        construir_imagens
        migrar_containers_legados
        iniciar_servicos
        aplicar_migracao_importacao
        agendar_java
        printf 'Inicializacao concluida. Node: http://%s:8080; MySQL: %s:3306.\n' "$EC2_HOST" "$EC2_HOST"
        printf 'Para importar agora: sudo bash %q executar-java\n' "$SCRIPT_FILE"
    fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
