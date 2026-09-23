#!/bin/sh
set -e

echo "=================================================="
echo " Observatório de Gastos Públicos v1.0.0"
echo "=================================================="
echo "Node: $(node --version)"

# Wait for PostgreSQL to be ready
echo ""
echo "⏳ Aguardando PostgreSQL em ${DB_HOST:-db}:${DB_PORT:-5432}..."
MAX_RETRIES=30
RETRIES=0
until nc -z "${DB_HOST:-db}" "${DB_PORT:-5432}" 2>/dev/null; do
  RETRIES=$((RETRIES+1))
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    echo "❌ PostgreSQL não respondeu após ${MAX_RETRIES}s. Abortando."
    exit 1
  fi
  printf "."
  sleep 1
done
echo ""
echo "✅ PostgreSQL pronto!"

# Run Prisma migrations
echo ""
echo "🗄️  Executando migrations do banco..."
cd /app/backend
npx prisma migrate deploy 2>/dev/null || {
  echo "migrate deploy falhou, tentando db push..."
  npx prisma db push --accept-data-loss
}
echo "✅ Banco atualizado!"

# Seed if empty
echo ""
echo "🌱 Verificando dados iniciais..."
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.municipality.count().then(n => {
  console.log('Municípios no banco: ' + n);
  p.\$disconnect();
  process.exit(n === 0 ? 10 : 0);
}).catch(e => { console.error(e.message); p.\$disconnect(); process.exit(0); });
"
SEED_NEEDED=$?

if [ $SEED_NEEDED -eq 10 ]; then
  echo "Executando seed..."
  node /app/backend/dist/database/seed.js && echo "✅ Seed concluído!" || echo "⚠️  Seed falhou (não crítico)"
else
  echo "✅ Dados já existem, seed ignorado."
fi

# Start the application
echo ""
echo "🚀 Iniciando servidor na porta ${PORT:-3001}..."
echo "   Acesse: http://localhost:${PORT:-3001}"
echo "=================================================="
exec node /app/backend/dist/main.js
