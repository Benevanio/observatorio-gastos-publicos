#!/bin/sh
set -eu

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"

log() { echo "[entrypoint] $*"; }

if [ -z "${DATABASE_URL:-}" ]; then
  log "ERRO: DATABASE_URL nao definida."
  exit 1
fi

case "$DATABASE_URL" in
  *@localhost*|*@127.0.0.1*)
    log "ERRO: DATABASE_URL aponta para localhost dentro do container. Use o host de servico 'db'."
    exit 1
    ;;
esac

wait_for() {
  host="$1"; port="$2"; label="$3"; max="$4"
  i=0
  while [ "$i" -lt "$max" ]; do
    if nc -z "$host" "$port"; then
      log "$label disponivel em $host:$port"
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  log "ERRO: $label nao respondeu em $host:$port apos ${max}s"
  return 1
}

wait_for "$DB_HOST" "$DB_PORT" "PostgreSQL" 60

if [ "${REDIS_ENABLED:-true}" = "true" ] || [ "${REDIS_ENABLED:-true}" = "1" ]; then
  wait_for "$REDIS_HOST" "$REDIS_PORT" "Redis" 30 || log "AVISO: Redis indisponivel, seguindo em modo degradado"
fi

log "Aplicando migrations (prisma migrate deploy)"
if ! npx prisma migrate deploy; then
  log "ERRO: prisma migrate deploy falhou. Nenhum fallback destrutivo sera executado."
  exit 1
fi
log "Migrations aplicadas"

if [ "${RUN_SEED:-true}" = "true" ] || [ "${RUN_SEED:-true}" = "1" ]; then
  if [ -f /app/dist/database/seed.js ]; then
    log "Verificando dados iniciais"
    node /app/dist/database/seed.js || log "AVISO: seed falhou (nao critico)"
  fi
fi

log "Iniciando backend em ${HOST:-0.0.0.0}:${PORT:-3001}"
exec "$@"
