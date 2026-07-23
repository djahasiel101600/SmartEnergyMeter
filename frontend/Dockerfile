# Stage 1 — Build the React/Vite app
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install dependencies (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci --include=optional

# Copy source and build
# VITE_ env vars must be provided at build time via --build-arg
ARG VITE_API_URL=/api
ARG VITE_WS_URL=/ws/energy/

ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL

COPY . .
RUN npm run build

# Stage 2 — Serve with Nginx
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy built app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Django static files (admin CSS/JS) will be mounted here at runtime
# via the shared staticfiles volume from the backend container

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
