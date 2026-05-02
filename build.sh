# Build script for Render deployment

#!/usr/bin/env bash
# exit on error
set -o errexit

# Install Python dependencies
cd backend
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --no-input

# Run migrations
python manage.py migrate

# Create media directories
mkdir -p media/firmware

echo "Build completed successfully!"
