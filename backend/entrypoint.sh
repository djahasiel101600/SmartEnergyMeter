#!/usr/bin/env bash
set -e

echo "==> Running database migrations..."
python manage.py migrate --no-input

echo "==> Collecting static files..."
python manage.py collectstatic --no-input

echo "==> Starting Daphne ASGI server..."
exec daphne -b 0.0.0.0 -p 8000 backend.asgi:application
