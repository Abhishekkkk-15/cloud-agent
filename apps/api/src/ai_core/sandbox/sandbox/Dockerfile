FROM alpine:3.20

# Install Node.js, NPM, Python 3, and Pip
RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    py3-pip

WORKDIR /app

# Verify installations during build
RUN node -v && python3 --version

CMD ["/bin/sh"] 