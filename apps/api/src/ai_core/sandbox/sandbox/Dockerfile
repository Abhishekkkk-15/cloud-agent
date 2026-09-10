# Lightweight Node.js 20 LTS on Alpine Linux
FROM node:20-alpine

# Install minimal essential utilities for the sandbox environment
RUN apk add --no-cache \
    python3 \
    py3-pip \
    bash \
    curl \
    git

# Configure and enable pnpm
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Enable file watching polling across Docker bind mounts (fixes host reload on Windows)
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Pre-seed the fullstack project template
WORKDIR /template
COPY template/ /template/

# Pre-install all dependencies during image build so new sandboxes start instantaneously
RUN pnpm install --no-frozen-lockfile && \
    pnpm store prune

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