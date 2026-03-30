#!/usr/bin/env bash

set -e

POSTGRES_CONTAINER="so-dev-postgres"
REDIS_CONTAINER="so-dev-redis"

echo "🔍 Checking containers..."

# PostgreSQL
if [ "$(docker ps -a -q -f name=$POSTGRES_CONTAINER)" ]; then
    echo "🟡 PostgreSQL already exists. Starting..."
    docker start $POSTGRES_CONTAINER >/dev/null
else
    echo "🟢 Creating PostgreSQL..."
    docker run -d --name $POSTGRES_CONTAINER -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=staroverlay -p 127.0.0.1:5432:5432 postgres:15 >/dev/null
fi

# Redis
if [ "$(docker ps -a -q -f name=$REDIS_CONTAINER)" ]; then
    echo "🟡 Redis already exists. Starting..."
    docker start $REDIS_CONTAINER >/dev/null
else
    echo "🟢 Creating Redis..."
    docker run -d --name $REDIS_CONTAINER -p 127.0.0.1:6379:6379 redis >/dev/null
fi

echo ""
echo "✅ Services ready:"
echo "Postgres: postgresql://user:password@localhost:5432/staroverlay"
echo "Redis:    redis://localhost:6379"
