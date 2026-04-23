# Use the official Bun image as the base
FROM oven/bun:1.3-slim AS base
WORKDIR /app

# ----- Stage 1: Install dependencies -----
FROM base AS install
# Install build dependencies for native modules (like argon2)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Install production dependencies only
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# ----- Stage 2: Production environment -----
FROM base AS release
# Copy production node_modules and the source code
COPY --from=install /temp/prod/node_modules node_modules
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port the app runs on
EXPOSE 3000

# Run as non-root user
USER bun

# Healthcheck to ensure the container is healthy
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["bun", "run", "healthcheck.ts"]

# Start the application
ENTRYPOINT [ "bun", "run", "src/index.ts" ]
