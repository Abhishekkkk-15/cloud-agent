# Lightweight Node.js 20 LTS on Alpine Linux
FROM node:20-alpine

# Install minimal essential utilities for the sandbox environment
RUN apk add --no-cache \
    python3 \
    py3-pip \
    bash \
    curl \
    git

# Enable file watching polling across Docker bind mounts (fixes host reload on Windows)
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true

# Pre-seed the fullstack project template
WORKDIR /template
COPY template/ /template/

# Pre-install deps with npm (avoids pnpm symlink issues on bind mounts / Windows)
RUN npm install && npm cache clean --force

# Copy entrypoint script and normalize line endings for Linux
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

# Default container working directory where workspace is mounted
WORKDIR /app

# Published container ports:
# 4000: Vite Frontend (mapped to dynamic host port for Preview)
# 3000: Express Backend API (mapped to dynamic host port)
EXPOSE 4000 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["tail", "-f", "/dev/null"]
